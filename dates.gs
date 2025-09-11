/**
 * Dates Sheet Manager
 * Builds a daily sheet from account creation to today and fills ratings
 */

const DatesManager = {
  /**
   * Returns the list of formats to track in Dates sheet
   */
  getAllFormats: function() {
    var isMinimal = false; try { var v = ConfigManager.get('minimalMode'); isMinimal = (v === true || v === 'true' || v === 'on' || v === 1); } catch (e) {}
    if (isMinimal) {
      return ['bullet', 'blitz', 'rapid'];
    }
    const baseFormats = ['bullet', 'blitz', 'rapid', 'daily', 'live960', 'daily960'];
    const variants = (CONSTANTS && CONSTANTS.VARIANTS) ? CONSTANTS.VARIANTS.filter(v => v !== 'chess' && v !== 'chess960') : [];
    const set = {};
    baseFormats.concat(variants).forEach(f => set[f] = true);
    return Object.keys(set);
  },

  /**
   * Ensures Dates sheet exists with correct headers
   */
  ensureDatesSheet: function() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Dates');
    if (!sheet) {
      sheet = ss.insertSheet('Dates');
    }
    const headers = ['date'].concat(this.getAllFormats());
    // Ensure headers without clearing existing data rows
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return sheet;
  },

  /**
   * Builds the full Dates sheet and backfills ratings for all days
   */
  buildAndBackfillAll: function() {
    const t = Trace.start('DatesManager.buildAndBackfillAll', 'start');
    const sheet = this.ensureDatesSheet();
    // Clear existing data rows (preserve header)
    const existingLastRow = sheet.getLastRow();
    if (existingLastRow > 1) {
      sheet.deleteRows(2, existingLastRow - 1);
    }
    const dateKeysDesc = this.getAllDateKeysDesc();
    if (dateKeysDesc.length === 0) {
      t.end({ days: 0 });
      return { days: 0 };
    }
    const formats = this.getAllFormats();
    // Prepare rows: today at top
    const rows = dateKeysDesc.map(dateKey => {
      const row = new Array(1 + formats.length).fill('');
      row[0] = dateKey;
      return row;
    });
    // Write all dates first
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    // Compute and fill ratings
    this.fillRatingsForRange(sheet, 2, dateKeysDesc, formats);
    t.end({ days: dateKeysDesc.length });
    return { days: dateKeysDesc.length };
  },

  /**
   * Updates only today's row in Dates sheet
   */
  updateTodayOnly: function() {
    const t = Trace.start('DatesManager.updateTodayOnly', 'start');
    const sheet = this.ensureDatesSheet();
    const formats = this.getAllFormats();
    const tz = Session.getScriptTimeZone();
    const todayKey = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
    // Find existing row or append at top if missing (normalize date values)
    const lastRow = sheet.getLastRow();
    let targetRow = null;
    if (lastRow > 1) {
      const dateValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < dateValues.length; i++) {
        const cell = dateValues[i][0];
        let cellKey = null;
        if (cell instanceof Date) {
          cellKey = Utilities.formatDate(cell, tz, 'yyyy-MM-dd');
        } else if (typeof cell === 'string') {
          const s = cell.trim();
          if (s) {
            if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
              cellKey = s;
            } else {
              const ep = TimeUtils.parseLocalDateTimeToEpochSeconds(s);
              if (ep) cellKey = Utilities.formatDate(TimeUtils.epochToLocal(ep), tz, 'yyyy-MM-dd');
            }
          }
        }
        if (cellKey === todayKey) {
          targetRow = i + 2;
          break;
        }
      }
    }
    if (!targetRow) {
      // Prepend row for today at top (row 2) and shift existing down by inserting a new row
      sheet.insertRows(2, 1);
      sheet.getRange(2, 1, 1, 1 + formats.length).setValues([[todayKey].concat(new Array(formats.length).fill(''))]);
      targetRow = 2;
    }
    // Compute desired ratings and only write if changed
    const eventsByFormat = this.getRatingsEventsByFormat();
    const endOfDayEpoch = TimeUtils.getEndOfDay(new Date(`${todayKey} 00:00:00`));
    const newRowValues = formats.map(function(fmt) {
      const rating = DatesManager.resolveRatingAtEpoch(eventsByFormat[fmt] || [], endOfDayEpoch);
      return rating != null ? rating : '';
    });
    const currentRowValues = sheet.getRange(targetRow, 2, 1, formats.length).getValues()[0];
    let changed = false;
    for (let j = 0; j < formats.length; j++) {
      const a = currentRowValues[j];
      const b = newRowValues[j];
      const aEmpty = (a === '' || a == null);
      const bEmpty = (b === '' || b == null);
      if (aEmpty && bEmpty) continue;
      const aNum = (typeof a === 'number') ? a : (aEmpty ? null : Number(a));
      const bNum = (typeof b === 'number') ? b : (bEmpty ? null : Number(b));
      if (aNum == null && bNum == null) continue;
      if (aNum !== bNum) { changed = true; break; }
    }
    if (changed) {
      sheet.getRange(targetRow, 2, 1, formats.length).setValues([newRowValues]);
    }
    t.end({ updated: todayKey, changed: changed });
    return { updated: todayKey, changed: changed };
  },

  /**
   * Returns date keys from account joined date to today, descending (today first)
   */
  getAllDateKeysDesc: function() {
    const tz = Session.getScriptTimeZone();
    const joinedDate = this.getAccountJoinedDate();
    if (!joinedDate) return [];
    // Normalize joined to start of its day
    const start = new Date(joinedDate);
    start.setHours(0, 0, 0, 0);
    // Today normalized
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const keys = [];
    for (let d = new Date(end); d >= start; d.setDate(d.getDate() - 1)) {
      keys.push(Utilities.formatDate(new Date(d), tz, 'yyyy-MM-dd'));
    }
    return keys;
  },

  /**
   * Determines account creation date. Caches in Config for reuse.
   */
  getAccountJoinedDate: function() {
    // Try cached value first
    const cached = ConfigManager.get('accountJoined');
    if (cached) {
      try {
        const d = new Date(cached);
        if (!isNaN(d.getTime())) return d;
      } catch (e) {}
    }
    const username = ConfigManager.get('username');
    if (!username) throw new Error('Username not configured. Run Initial Setup first.');
    try {
      const profile = ChessAPI.getPlayerProfile(username);
      if (profile && typeof profile.joined === 'number') {
        const d = new Date(profile.joined * 1000);
        // Cache ISO string for later
        ConfigManager.set('accountJoined', d.toISOString());
        return d;
      }
    } catch (e) {
      // Fallback to earliest game date if available
      const earliest = this.getEarliestGameDate();
      if (earliest) return earliest;
      throw e;
    }
    // Fallback to earliest game date if profile missing
    const earliest = this.getEarliestGameDate();
    if (earliest) return earliest;
    // As last resort, use today
    return new Date();
  },

  /**
   * Gets earliest game end date from Games sheet
   */
  getEarliestGameDate: function() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Games');
    if (!sheet || sheet.getLastRow() <= 1) return null;
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const endCol = headers.indexOf('end') + 1;
    if (endCol <= 0) return null;
    const values = sheet.getRange(2, endCol, sheet.getLastRow() - 1, 1).getValues();
    let minEpoch = null;
    values.forEach(r => {
      const s = r[0];
      const ep = TimeUtils.parseLocalDateTimeToEpochSeconds(s);
      if (ep) {
        if (minEpoch == null || ep < minEpoch) minEpoch = ep;
      }
    });
    return minEpoch != null ? new Date(minEpoch * 1000) : null;
  },

  /**
   * Builds map format -> sorted array of { epoch: seconds, rating: number }
   * Considers Ratings rows with specific format and STATS rows with per-format columns
   */
  getRatingsEventsByFormat: function() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Ratings');
    const eventsByFormat = {};
    const formats = this.getAllFormats();
    formats.forEach(f => eventsByFormat[f] = []);
    if (!sheet || sheet.getLastRow() <= 1) return eventsByFormat;
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const h = {};
    headers.forEach((name, idx) => h[name] = idx);
    const lastRow = sheet.getLastRow();
    const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const endStr = row[h['end']];
      const epoch = TimeUtils.parseLocalDateTimeToEpochSeconds(endStr);
      if (!epoch) continue;
      const rowFormat = (row[h['format']] || '').toString();
      const myRating = h.hasOwnProperty('my_rating') ? Number(row[h['my_rating']]) : NaN;
      // STATS row contributes per-format ratings
      if (rowFormat === 'STATS') {
        formats.forEach(fmt => {
          if (h.hasOwnProperty(fmt)) {
            const v = Number(row[h[fmt]]);
            if (!isNaN(v) && v > 0) {
              eventsByFormat[fmt].push({ epoch: epoch, rating: v });
            }
          }
        });
        continue;
      }
      // Specific format row
      const fmt = rowFormat;
      if (fmt && eventsByFormat.hasOwnProperty(fmt)) {
        let ratingValue = !isNaN(myRating) && myRating > 0 ? myRating : null;
        if (ratingValue == null && h.hasOwnProperty(fmt)) {
          const v2 = Number(row[h[fmt]]);
          if (!isNaN(v2) && v2 > 0) ratingValue = v2;
        }
        if (ratingValue != null) {
          eventsByFormat[fmt].push({ epoch: epoch, rating: ratingValue });
        }
      }
    }
    // Sort events ascending by epoch for binary search
    Object.keys(eventsByFormat).forEach(fmt => {
      eventsByFormat[fmt].sort((a, b) => a.epoch - b.epoch);
    });
    return eventsByFormat;
  },

  /**
   * Fills ratings for a contiguous range of rows starting at startRow
   */
  fillRatingsForRange: function(sheet, startRow, dateKeys, formats) {
    const tz = Session.getScriptTimeZone();
    const eventsByFormat = this.getRatingsEventsByFormat();
    const values = [];
    for (let i = 0; i < dateKeys.length; i++) {
      const dateKey = dateKeys[i];
      const endOfDayEpoch = TimeUtils.getEndOfDay(new Date(`${dateKey} 00:00:00`));
      const rowVals = new Array(formats.length);
      for (let j = 0; j < formats.length; j++) {
        const fmt = formats[j];
        const rating = this.resolveRatingAtEpoch(eventsByFormat[fmt] || [], endOfDayEpoch);
        rowVals[j] = rating != null ? rating : '';
      }
      values.push(rowVals);
    }
    if (values.length > 0) {
      // Write only the format columns (skip date col)
      sheet.getRange(startRow, 2, values.length, formats.length).setValues(values);
    }
  },

  /**
   * Resolves rating at a target epoch using nearest event (prev or next)
   */
  resolveRatingAtEpoch: function(events, targetEpoch) {
    if (!events || events.length === 0) return null;
    // Binary search: first index with epoch > target
    let lo = 0, hi = events.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (events[mid].epoch > targetEpoch) hi = mid; else lo = mid + 1;
    }
    const nextIdx = lo;
    const prevIdx = lo - 1;
    let best = null;
    if (prevIdx >= 0) {
      best = { dist: Math.abs(targetEpoch - events[prevIdx].epoch), rating: events[prevIdx].rating };
    }
    if (nextIdx < events.length) {
      const cand = { dist: Math.abs(events[nextIdx].epoch - targetEpoch), rating: events[nextIdx].rating };
      if (!best || cand.dist < best.dist) best = cand;
    }
    return best ? best.rating : null;
  }
};

/**
 * Public entry points
 */
function buildDatesSheet() {
  return DatesManager.buildAndBackfillAll();
}

function updateDatesToday() {
  return DatesManager.updateTodayOnly();
}


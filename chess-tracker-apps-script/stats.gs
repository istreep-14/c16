// Daily stats aggregation (minimal)

function updateDailyStatsAndSeal() {
  const ss = getSpreadsheet_();
  const gamesSheet = ss.getSheetByName(SHEET_NAMES.GAMES);
  if (!gamesSheet) return;
  const lastRow = gamesSheet.getLastRow();
  if (lastRow < 2) return;

  const headers = GAMES_HEADERS;
  const hIndex = {};
  headers.forEach((h, i) => hIndex[h] = i);

  const values = gamesSheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

  const tz = Session.getScriptTimeZone();
  const todayStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const yMs = new Date().getTime() - 24 * 3600 * 1000;
  const yesterdayStr = Utilities.formatDate(new Date(yMs), tz, 'yyyy-MM-dd');
  const targetDays = new Set([todayStr, yesterdayStr]);

  const agg = new Map(); // key: date|format -> {time_class->counts}

  for (const row of values) {
    const dateKey = row[hIndex['date_key']];
    if (!targetDays.has(dateKey)) continue;
    const format = row[hIndex['format']] || '';
    const timeClass = row[hIndex['time_class']] || '';
    const result = String(row[hIndex['result']] || '');
    const key = `${dateKey}|${format}|${timeClass}`;
    if (!agg.has(key)) agg.set(key, {gp: 0, w: 0, l: 0, d: 0});
    const a = agg.get(key);
    a.gp++;
    if (result === 'win') a.w++; else if (result === 'draw') a.d++; else a.l++;
  }

  const dsSheet = ss.getSheetByName(SHEET_NAMES.DAILYSTATS);
  const dsHeaders = DAILYSTATS_HEADERS;
  for (const [key, a] of agg.entries()) {
    const [dateKey, format, timeClass] = key.split('|');
    // Upsert by full composite: find by exact triple match
    let rowIdx = -1;
    const last = dsSheet.getLastRow();
    if (last >= 2) {
      const all = dsSheet.getRange(2, 1, last - 1, dsHeaders.length).getValues();
      for (let i = 0; i < all.length; i++) {
        if (String(all[i][0]) === dateKey && String(all[i][1]) === format && String(all[i][2]) === timeClass) { rowIdx = i + 2; break; }
      }
    }
    const dateCell = parseDateForSheet_(dateKey, tz);
    const row = [dateCell, format, timeClass, a.gp, a.w, a.l, a.d, '', '', '', '', getIsoNow()];
    if (rowIdx === -1) {
      insertRowsAtTop_(SHEET_NAMES.DAILYSTATS, [row]);
    } else {
      const range = dsSheet.getRange(rowIdx, 1, 1, dsHeaders.length);
      range.setValues([row]);
    }
  }
}

function recomputeAllDailyStats() {
  const ss = getSpreadsheet_();
  const gamesSheet = ss.getSheetByName(SHEET_NAMES.GAMES);
  if (!gamesSheet) return;
  const lastRow = gamesSheet.getLastRow();
  if (lastRow < 2) return;

  const headers = GAMES_HEADERS;
  const hIndex = {};
  headers.forEach((h, i) => hIndex[h] = i);

  const values = gamesSheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

  const agg = new Map(); // key: date|format|time_class -> {gp,w,l,d}
  for (const row of values) {
    const dateKey = row[hIndex['date_key']];
    if (!dateKey) continue;
    const format = row[hIndex['format']] || '';
    const timeClass = row[hIndex['time_class']] || '';
    const result = String(row[hIndex['result']] || '');
    const key = `${dateKey}|${format}|${timeClass}`;
    if (!agg.has(key)) agg.set(key, {gp: 0, w: 0, l: 0, d: 0});
    const a = agg.get(key);
    a.gp++;
    if (result === 'win') a.w++; else if (result === 'draw') a.d++; else a.l++;
  }

  const dsSheet = getOrCreateSheet_(SHEET_NAMES.DAILYSTATS, DAILYSTATS_HEADERS);
  const existingRows = dsSheet.getLastRow();
  if (existingRows > 1) {
    dsSheet.getRange(2, 1, existingRows - 1, DAILYSTATS_HEADERS.length).clearContent();
  }

  const rowsOut = [];
  for (const [key, a] of agg.entries()) {
    const [dateKey, format, timeClass] = key.split('|');
    const dateCell = parseDateForSheet_(dateKey, Session.getScriptTimeZone());
    rowsOut.push([dateCell, format, timeClass, a.gp, a.w, a.l, a.d, '', '', '', '', getIsoNow()]);
  }
  rowsOut.sort((r1, r2) => (r1[0].getTime() < r2[0].getTime() ? 1 : (r1[0].getTime() > r2[0].getTime() ? -1 : 0))); // date desc
  if (rowsOut.length > 0) insertRowsAtTop_(SHEET_NAMES.DAILYSTATS, rowsOut);
}

function parseDateForSheet_(yyyyDashMmDashDd, tz) {
  if (!yyyyDashMmDashDd) return '';
  const m = String(yyyyDashMmDashDd).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return yyyyDashMmDashDd;
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
  // Create a Date in local script timezone day. Sheets will display with date formatting.
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt;
}
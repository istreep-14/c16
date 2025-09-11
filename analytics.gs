/**
 * Analytics and Rating Calculations
 * Handles rating calculations, daily summaries, and derived metrics
 */

/**
 * Daily Stats Processor
 */
class DailyStatsProcessor {
  constructor() {
    this.username = ConfigManager.get('username');
    this.latestRatings = ConfigManager.get('latestRatings') || {};
    this.ratingHistory = {};
  }
  
  /**
   * Updates daily statistics
   */
  updateDailyStats() {
    const t = Trace.start('DailyStatsProcessor.updateDailyStats', 'start');
    SheetsManager.log('INFO', 'Daily Stats', 'Starting daily stats update');
    
    // Ensure today's ratings row is present/updated in Dates
    try { DatesManager.updateTodayOnly(); } catch (e) { try { SheetsManager.log('WARNING', 'Daily Stats', 'Failed to update Dates today', e.toString()); } catch (er) {} }

    // If Daily Stats sheet is empty, do a full rebuild once
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let dailySheet = ss.getSheetByName('Daily Stats');
    if (!dailySheet) dailySheet = SheetsManager.createDailyStatsSheet(ss);
    const dailyHasData = dailySheet && dailySheet.getLastRow() > 1;

    // Checkpoint for incremental updates
    const checkpoint = CheckpointManager.load('dailyStats') || {};
    const lastGameEpoch = checkpoint.lastGameEpoch || null;

    // Build dates data (for order and prev-day mapping)
    const datesData = this._getDatesData();
    const allDateKeysDesc = datesData.dateKeysDesc;

    if (!dailyHasData) {
      // Full rebuild path
      const allGames = SheetsManager.getGamesForDailyStats();
      const allRows = this.buildDailyRows(allGames);
      SheetsManager.writeDailyStats(allRows);
      // Update checkpoint
      checkpoint.lastGameEpoch = SheetsManager.getLastGameTimestamp() || null;
      checkpoint.lastRunAt = new Date().toISOString();
      CheckpointManager.save('dailyStats', checkpoint);
      const resultFull = { daysProcessed: allRows.length, totalGames: allGames.length };
      t.end({ daysProcessed: resultFull.daysProcessed, totalGames: resultFull.totalGames, mode: 'full' });
      return resultFull;
    }

    // Incremental path
    // Determine affected dates: new game dates since last run + last few days for safety
    const safetyWindowDays = 3;
    const fallbackKeys = allDateKeysDesc.slice(0, safetyWindowDays);
    let newGames = [];
    if (lastGameEpoch && typeof lastGameEpoch === 'number') {
      newGames = SheetsManager.getGamesForDailyStats(lastGameEpoch);
    } else {
      // No checkpoint yet: treat as no new games; fallbackKeys will ensure today/yesterday update
      newGames = [];
    }
    const affectedSet = {};
    // Add fallback recent days
    fallbackKeys.forEach(k => { if (k) affectedSet[k] = true; });
    // Add dates from new games
    newGames.forEach(g => {
      const y = g.year, m = g.month, d = g.day;
      const dk = TimeUtils.getDateKey(y, m, d);
      if (dk) affectedSet[dk] = true;
    });
    const datesToUpdate = Object.keys(affectedSet);
    if (datesToUpdate.length === 0) {
      // Nothing to do - still update checkpoint
      checkpoint.lastGameEpoch = SheetsManager.getLastGameTimestamp() || lastGameEpoch;
      checkpoint.lastRunAt = new Date().toISOString();
      CheckpointManager.save('dailyStats', checkpoint);
      const resultNoop = { daysProcessed: 0, totalGames: 0 };
      t.end({ daysProcessed: 0, totalGames: 0, mode: 'noop' });
      return resultNoop;
    }

    // Prepare games filtered to affected dates only
    const allGames = SheetsManager.getGamesForDailyStats();
    const datesToUpdateSet = {};
    datesToUpdate.forEach(k => datesToUpdateSet[k] = true);
    const gamesForAffected = allGames.filter(g => {
      const dk = TimeUtils.getDateKey(g.year, g.month, g.day);
      return !!datesToUpdateSet[dk];
    });

    // Build rows for only affected dates
    const rows = this.buildDailyRows(gamesForAffected, { onlyDates: datesToUpdate });

    // Upsert to sheet
    SheetsManager.upsertDailyStatsRows(rows, { sort: true });

    // Update checkpoint
    checkpoint.lastGameEpoch = SheetsManager.getLastGameTimestamp() || lastGameEpoch;
    checkpoint.lastRunAt = new Date().toISOString();
    CheckpointManager.save('dailyStats', checkpoint);

    const result = {
      daysProcessed: rows.length,
      totalGames: newGames.length
    };
    t.end({ daysProcessed: result.daysProcessed, totalGames: result.totalGames, mode: 'incremental' });
    return result;
  }
  
  /**
   * Calculates ratings for all games
   */
  calculateRatings(games) {
    // Sort games by end datetime ascending for correct rating chronology
    games.sort((a, b) => {
      const ea = TimeUtils.parseLocalDateTimeToEpochSeconds(a.end) || 0;
      const eb = TimeUtils.parseLocalDateTimeToEpochSeconds(b.end) || 0;
      return ea - eb;
    });
    
    // Track ratings by format
    const formatRatings = {};
    
    games.forEach(game => {
      const format = game.format;
      if (!format) return;
      
      // Initialize format tracking
      if (!formatRatings[format]) {
        formatRatings[format] = {
          lastRating: null,
          lastGame: null
        };
      }
      
      // Calculate pre-game ratings
      this.calculateGameRatings(game, formatRatings[format]);
      
      // Update format tracking
      if (game.my_rating) {
        formatRatings[format].lastRating = game.my_rating;
        formatRatings[format].lastGame = game;
      }
    });
    
    // Store rating history
    this.ratingHistory = formatRatings;
  }
  
  /**
   * Calculates ratings for a single game
   */
  calculateGameRatings(game, formatHistory) {
    // Intentionally left blank: removed pregame estimation and expected score
  }

  /**
   * Builds preformatted rows for Daily Stats sheet from games and Dates ratings
   */
  buildDailyRows(games, options) {
    const t = Trace.start('DailyStatsProcessor.buildDailyRows', 'start');
    const data = this._getDatesData();
    const dateKeys = data.dateKeysDesc; // today first
    const ratings = data.ratingsByDate; // { dateKey -> { bullet, blitz, rapid } }

    // Aggregate per-day per-format game stats (bullet/blitz/rapid only)
    const formats = ['bullet', 'blitz', 'rapid'];
    const perDay = {};
    const normalizeFormat = function(f) {
      if (!f) return '';
      const s = String(f).toLowerCase();
      return s.startsWith('chess_') ? s.substring(6) : s;
    };

    games.forEach(g => {
      const y = g.year, m = g.month, d = g.day;
      const dateKey = TimeUtils.getDateKey(y, m, d);
      const fmt = normalizeFormat(g.format);
      if (formats.indexOf(fmt) === -1) return;
      if (!perDay[dateKey]) perDay[dateKey] = {};
      if (!perDay[dateKey][fmt]) perDay[dateKey][fmt] = { games: 0, wins: 0, draws: 0, losses: 0, timeSeconds: 0 };
      const s = perDay[dateKey][fmt];
      s.games += 1;
      const outcome = g.my_outcome;
      if (outcome === 1) s.wins += 1; else if (outcome === 0.5) s.draws += 1; else if (outcome === 0) s.losses += 1;
      const dur = Number(g.game_duration_seconds || 0);
      if (!isNaN(dur) && dur > 0) s.timeSeconds += dur;
    });

    // Build rows matching Daily Stats headers in SheetsManager.createDailyStatsSheet
    const rows = [];
    const onlyDatesSet = (options && options.onlyDates && options.onlyDates.length) ? (function(arr){ const m={}; arr.forEach(k=>{ if(k) m[k]=true; }); return m; })(options.onlyDates) : null;
    for (let i = 0; i < dateKeys.length; i++) {
      const dateKey = dateKeys[i];
      if (onlyDatesSet && !onlyDatesSet[dateKey]) continue;
      const prevKey = i + 1 < dateKeys.length ? dateKeys[i + 1] : null;
      const rToday = ratings[dateKey] || { bullet: null, blitz: null, rapid: null };
      const rPrev = prevKey ? (ratings[prevKey] || { bullet: null, blitz: null, rapid: null }) : { bullet: null, blitz: null, rapid: null };

      // Pull per-format stats with zeros default
      const b = (perDay[dateKey] && perDay[dateKey].bullet) ? perDay[dateKey].bullet : { games: 0, wins: 0, draws: 0, losses: 0, timeSeconds: 0 };
      const z = (perDay[dateKey] && perDay[dateKey].blitz) ? perDay[dateKey].blitz : { games: 0, wins: 0, draws: 0, losses: 0, timeSeconds: 0 };
      const r = (perDay[dateKey] && perDay[dateKey].rapid) ? perDay[dateKey].rapid : { games: 0, wins: 0, draws: 0, losses: 0, timeSeconds: 0 };

      // Ratings from Dates sheet
      const bStart = (typeof rPrev.bullet === 'number') ? rPrev.bullet : null;
      const bEnd = (typeof rToday.bullet === 'number') ? rToday.bullet : null;
      const zStart = (typeof rPrev.blitz === 'number') ? rPrev.blitz : null;
      const zEnd = (typeof rToday.blitz === 'number') ? rToday.blitz : null;
      const rStart = (typeof rPrev.rapid === 'number') ? rPrev.rapid : null;
      const rEnd = (typeof rToday.rapid === 'number') ? rToday.rapid : null;

      const bChange = (bStart != null && bEnd != null) ? (bEnd - bStart) : 0;
      const zChange = (zStart != null && zEnd != null) ? (zEnd - zStart) : 0;
      const rChange = (rStart != null && rEnd != null) ? (rEnd - rStart) : 0;

      // Totals across main 3
      const totalGames = b.games + z.games + r.games;
      const totalWins = b.wins + z.wins + r.wins;
      const totalDraws = b.draws + z.draws + r.draws;
      const totalLosses = b.losses + z.losses + r.losses;
      const totalTime = b.timeSeconds + z.timeSeconds + r.timeSeconds;
      const totalStart = (bStart || 0) + (zStart || 0) + (rStart || 0);
      const totalEnd = (bEnd || 0) + (zEnd || 0) + (rEnd || 0);
      const totalChange = bChange + zChange + rChange;
      const avgDuration = totalGames > 0 ? (totalTime / totalGames) : 0;

      rows.push([
        dateKey,
        // bullet
        b.games, b.wins, b.draws, b.losses,
        (bStart != null ? bStart : ''), (bEnd != null ? bEnd : ''), bChange,
        b.timeSeconds, (b.games > 0 ? (b.timeSeconds / b.games) : 0),
        // blitz
        z.games, z.wins, z.draws, z.losses,
        (zStart != null ? zStart : ''), (zEnd != null ? zEnd : ''), zChange,
        z.timeSeconds, (z.games > 0 ? (z.timeSeconds / z.games) : 0),
        // rapid
        r.games, r.wins, r.draws, r.losses,
        (rStart != null ? rStart : ''), (rEnd != null ? rEnd : ''), rChange,
        r.timeSeconds, (r.games > 0 ? (r.timeSeconds / r.games) : 0),
        // totals
        totalGames, totalWins, totalDraws, totalLosses,
        totalStart, totalEnd, totalChange,
        totalTime, avgDuration
      ]);
    }
    t.end({ rows: rows.length });
    return rows;
  }

  /**
   * Reads Dates sheet and returns date keys and ratings map for bullet/blitz/rapid
   */
  _getDatesData() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Dates');
    if (!sheet) {
      try { DatesManager.buildAndBackfillAll(); } catch (e) {}
      sheet = ss.getSheetByName('Dates');
    }
    if (!sheet || sheet.getLastRow() <= 1) {
      return { dateKeysDesc: [], ratingsByDate: {} };
    }
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const h = {};
    headers.forEach((name, idx) => h[name] = idx);
    const bulletIdx = h.hasOwnProperty('bullet') ? h['bullet'] : -1;
    const blitzIdx = h.hasOwnProperty('blitz') ? h['blitz'] : -1;
    const rapidIdx = h.hasOwnProperty('rapid') ? h['rapid'] : -1;
    const lastRow = sheet.getLastRow();
    const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    const tz = Session.getScriptTimeZone();
    const dateKeys = [];
    const ratings = {};
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const cell = row[0];
      let dateKey = null;
      if (cell instanceof Date) {
        dateKey = Utilities.formatDate(cell, tz, 'yyyy-MM-dd');
      } else if (typeof cell === 'string') {
        const s = cell.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) dateKey = s; else {
          const ep = TimeUtils.parseLocalDateTimeToEpochSeconds(s);
          if (ep) dateKey = Utilities.formatDate(TimeUtils.epochToLocal(ep), tz, 'yyyy-MM-dd');
        }
      }
      if (!dateKey) continue;
      dateKeys.push(dateKey);
      const bulletVal = bulletIdx >= 0 ? Number(row[bulletIdx]) : NaN;
      const blitzVal = blitzIdx >= 0 ? Number(row[blitzIdx]) : NaN;
      const rapidVal = rapidIdx >= 0 ? Number(row[rapidIdx]) : NaN;
      ratings[dateKey] = {
        bullet: (!isNaN(bulletVal) && bulletVal > 0) ? bulletVal : null,
        blitz: (!isNaN(blitzVal) && blitzVal > 0) ? blitzVal : null,
        rapid: (!isNaN(rapidVal) && rapidVal > 0) ? rapidVal : null
      };
    }
    return { dateKeysDesc: dateKeys, ratingsByDate: ratings };
  }
  
  /**
   * Groups games by day and format
   */
  groupGamesByDay(games) {
    const dailyStats = {};
    
    games.forEach(game => {
      const dateKey = TimeUtils.getDateKey(game.year, game.month, game.day);
      
      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = {
          total: {
            games: [],
            games_played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            total_time_minutes: 0
          }
        };
      }
      
      // Add to total
      dailyStats[dateKey].total.games.push(game);
      
      // Add to format-specific
      const format = game.format || 'unknown';
      if (!dailyStats[dateKey][format]) {
        dailyStats[dateKey][format] = {
          games: [],
          games_played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          total_time_minutes: 0
        };
      }
      
      dailyStats[dateKey][format].games.push(game);
    });
    
    return dailyStats;
  }
  
  /**
   * Calculates statistics for a day
   */
  calculateDayStats(dayData, dateKey) {
    Object.keys(dayData).forEach(format => {
      const stats = dayData[format];
      const games = stats.games;
      
      if (!games || games.length === 0) return;
      
      // Count games and results
      stats.games_played = games.length;
      
      games.forEach(game => {
        // Count results (use numeric my_outcome)
        if (game.my_outcome === 1) {
          stats.wins++;
        } else if (game.my_outcome === 0) {
          stats.losses++;
        } else if (game.my_outcome === 0.5) {
          stats.draws++;
        }
        
        // Sum time
        if (game.game_duration_seconds) {
          stats.total_time_minutes += game.game_duration_seconds / 60;
        }
      });
      
      // Calculate averages
      stats.avg_game_duration = stats.total_time_minutes / stats.games_played;
      
      // Calculate opponent average rating
      const opponentRatings = games
        .filter(g => g.opponent_rating)
        .map(g => g.opponent_rating);
      
      if (opponentRatings.length > 0) {
        stats.opponents_avg_rating = Math.round(
          opponentRatings.reduce((a, b) => a + b) / opponentRatings.length
        );
      }
      
      // Calculate performance rating
      stats.performance_rating = RatingUtils.calculatePerformanceRating(games);
      
      // Calculate streaks
      const results = games.map(g => g.my_outcome).filter(r => r !== null);
      const streaks = DataUtils.calculateStreaks(results);
      stats.longest_win_streak = streaks.longestWin;
      stats.longest_loss_streak = streaks.longestLoss;
      
      // Get rating for this day
      if (format !== 'total') {
        // Find first and last game of the day
        const sortedGames = games.sort((a, b) => {
          const ea = TimeUtils.parseLocalDateTimeToEpochSeconds(a.end) || 0;
          const eb = TimeUtils.parseLocalDateTimeToEpochSeconds(b.end) || 0;
          return ea - eb;
        });
        const firstGame = sortedGames[0];
        const lastGame = sortedGames[sortedGames.length - 1];
        
        // Rating at start of day
        if (firstGame.my_pregame_rating) {
          stats.rating_start = firstGame.my_pregame_rating;
        } else if (firstGame.my_rating) {
          stats.rating_start = firstGame.my_rating;
        }
        
        // Rating at end of day (use resolver; fallback to last game's rating)
        const resolved = RatingManager.getRatingForDate(format, dateKey);
        if (resolved != null) {
          stats.rating_end = resolved;
        } else if (lastGame.my_rating) {
          stats.rating_end = lastGame.my_rating;
        }
        
        // Calculate change
        if (stats.rating_start && stats.rating_end) {
          stats.rating_change = stats.rating_end - stats.rating_start;
        }
      }
      
      // Clean up games array before writing
      delete stats.games;
    });
  }
}

/**
 * Rating Manager - handles fetching and tracking ratings
 */
const RatingManager = {
  /**
   * Gets the most recent rating for a format
   */
  getLatestRating: function(format) {
    const latestRatings = ConfigManager.get('latestRatings') || {};
    return latestRatings[`chess_${format}`] || null;
  },
  
  /**
   * Updates ratings from player stats
   */
  updateFromStats: function(stats) {
    const ratings = {};
    const formats = ['chess_bullet', 'chess_blitz', 'chess_rapid', 'chess_daily'];
    
    formats.forEach(format => {
      if (stats[format] && stats[format].last) {
        ratings[format] = stats[format].last.rating;
      }
    });
    
    ConfigManager.set('latestRatings', ratings);
    return ratings;
  },
  
  /**
   * Gets rating for end of day calculation
   */
  getRatingForDate: function(format, date) {
    try {
      // Normalize format (accepts 'chess_bullet' or 'bullet')
      const fmt = (function normalize(f) {
        if (!f) return '';
        const s = String(f).toLowerCase();
        if (s.startsWith('chess_')) return s.replace('chess_', '');
        return s;
      })(format);

      // Parse date -> end-of-day epoch seconds (local timezone)
      let targetEpoch;
      if (date instanceof Date) {
        targetEpoch = TimeUtils.getEndOfDay(date);
      } else if (typeof date === 'string') {
        const d = new Date(`${date} 00:00:00`);
        targetEpoch = TimeUtils.getEndOfDay(d);
      } else if (typeof date === 'number') {
        targetEpoch = date; // assume already epoch seconds at desired time
      }
      if (!targetEpoch && targetEpoch !== 0) {
        return null;
      }

      // Build events map from Ratings sheet
      const eventsByFormat = this._getRatingsEventsByFormat();
      const events = eventsByFormat[fmt] || [];
      if (!events || events.length === 0) return null;

      // Resolve nearest rating to end-of-day
      return this._resolveRatingAtEpoch(events, targetEpoch);
    } catch (e) {
      try { SheetsManager.log('WARNING', 'RatingManager.getRatingForDate', e.toString(), { format: format, date: date }); } catch (er) {}
      return null;
    }
  },

  /**
   * Reads Ratings sheet and returns { format -> [{ epoch, rating }] } sorted ascending by epoch
   */
  _getRatingsEventsByFormat: function() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Ratings');
    const formats = ['bullet', 'blitz', 'rapid', 'daily', 'live960', 'daily960'];
    const eventsByFormat = {};
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

      // If this is a STATS row, it contributes per-format columns
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
        let ratingValue = h.hasOwnProperty('my_rating') ? Number(row[h['my_rating']]) : NaN;
        if (isNaN(ratingValue) || ratingValue <= 0) {
          if (h.hasOwnProperty(fmt)) {
            const v2 = Number(row[h[fmt]]);
            if (!isNaN(v2) && v2 > 0) ratingValue = v2;
          }
        }
        if (!isNaN(ratingValue) && ratingValue > 0) {
          eventsByFormat[fmt].push({ epoch: epoch, rating: ratingValue });
        }
      }
    }

    // Sort by epoch ascending
    Object.keys(eventsByFormat).forEach(fmt => {
      eventsByFormat[fmt].sort((a, b) => a.epoch - b.epoch);
    });
    return eventsByFormat;
  },

  /**
   * Resolves rating at a target epoch using the nearest event (previous or next)
   */
  _resolveRatingAtEpoch: function(events, targetEpoch) {
    if (!events || events.length === 0) return null;
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
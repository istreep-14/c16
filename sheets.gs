/**
 * Sheet Management and Operations
 * Handles all spreadsheet read/write operations
 */

const SheetsManager = {
  /**
   * Creates all required sheets with headers
   */
  createAllSheets: function() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Create Games sheet
    this.createGamesSheet(ss);
    
    // Create Ratings sheet
    this.createRatingsSheet(ss);
    
    // Create Callback Queue sheet
    this.createCallbackQueueSheet(ss);
    
    // Create Daily Stats sheet
    this.createDailyStatsSheet(ss);
    
    // Create Player Stats sheet
    this.createPlayerStatsSheet(ss);
    
    // Create Logs sheet
    this.createLogsSheet(ss);
    
    // Config sheet is created by ConfigManager
    ConfigManager.getConfigSheet();
  },
  
  /**
   * Creates the Games sheet with all headers
   */
  createGamesSheet: function(ss) {
    let sheet = ss.getSheetByName('Games');
    if (!sheet) {
      sheet = ss.insertSheet('Games');
    }
    
    const headers = this.getGamesHeaders();
    
    // Clear and set headers
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    
    // Set column widths
    headers.forEach((header, index) => {
      const width = this.getColumnWidth(header);
      sheet.setColumnWidth(index + 1, width);
    });
    
    return sheet;
  },
  
  /**
   * Gets all headers for the Games sheet
   */
  getGamesHeaders: function() {
    var isMinimal = false; try { var v = ConfigManager.get('minimalMode'); isMinimal = (v === true || v === 'true' || v === 'on' || v === 1); } catch (e) {}
    if (isMinimal) {
      return [
        // Basic game info
        'url', 'time_control', 'start', 'end', 'rated',
        'date',
        
        // Time fields (parsed)
        'year', 'month', 'day', 'hour', 'minute',
        
        // Player perspective
        'my_color', 'my_username', 'my_rating', 'my_outcome', 'opponent_username', 'opponent_rating', 'opponent_result',
        
        // Game metadata
        'time_class', 'format', 'base_time_seconds', 'increment_seconds', 'termination',
        
        // Derived light metric
        'game_duration_seconds',
        
        // Processing metadata
        'processed_timestamp', 'processing_version'
      ];
    }
    return [
      // Basic game info
      'url', 'pgn', 'time_control', 'start', 'end', 'rated',
      'date', 'end_Time',
      
      // Time fields (parsed from JSON)
      'year', 'month', 'day', 'hour', 'minute', 'second',
      
      // Player info
      'white_username', 'white_rating', 'white_result',
      'black_username', 'black_rating', 'black_result',
      
      // Game metadata
      'eco', 'eco_url', 'rules', 'time_class', 'format',
      
      // Parsed time control
      'base_time_seconds', 'increment_seconds',
      
      // Derived fields
      'my_color', 'my_username', 'my_rating', 'my_outcome',
      'my_result', 'opponent_username', 'opponent_rating', 'opponent_result', 'termination',
      'game_duration_seconds', 'move_count', 'ply_count',
      
      // Move data (stored as JSON strings)
      'moves_san', 'moves_numbered', 'clocks', 'clock_seconds', 'time_per_move',
      
      // Callback data (filled later)
      'callback_processed', 'callback_timestamp',
      'white_accuracy', 'black_accuracy',
      'callback_game_id',
      
      // Additional callback-derived fields (rating changes, profiles)
      'my_rating_change_callback', 'opponent_rating_change_callback',
      'my_pregame_rating', 'opponent_pregame_rating',
      'my_country_name_callback', 'opponent_country_name_callback',
      'my_default_tab_callback', 'opponent_default_tab_callback',
      'my_post_move_action_callback', 'opponent_post_move_action_callback',
      'my_membership_level_callback', 'opponent_membership_level_callback',
      'my_membership_code_callback', 'opponent_membership_code_callback',
      'my_member_since_callback', 'opponent_member_since_callback',
      
      // Processing metadata
      'processed_timestamp', 'processing_version'
    ];
  },
  
  /**
   * Creates the Daily Stats sheet
   */
  createDailyStatsSheet: function(ss) {
    let sheet = ss.getSheetByName('Daily Stats');
    if (!sheet) {
      sheet = ss.insertSheet('Daily Stats');
    }
    const headers = this.getDailyStatsHeaders();

    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    
    return sheet;
  },

  /**
   * Returns the canonical Daily Stats headers
   */
  getDailyStatsHeaders: function() {
    // One row per date; include bullet, blitz, rapid sections and totals
    return [
      'date',
      // Bullet section
      'bullet_games', 'bullet_wins', 'bullet_draws', 'bullet_losses',
      'bullet_rating_start', 'bullet_rating_end', 'bullet_rating_change',
      'bullet_total_time_seconds', 'bullet_avg_game_duration_seconds', 'bullet_performance_rating',
      // Blitz section
      'blitz_games', 'blitz_wins', 'blitz_draws', 'blitz_losses',
      'blitz_rating_start', 'blitz_rating_end', 'blitz_rating_change',
      'blitz_total_time_seconds', 'blitz_avg_game_duration_seconds', 'blitz_performance_rating',
      // Rapid section
      'rapid_games', 'rapid_wins', 'rapid_draws', 'rapid_losses',
      'rapid_rating_start', 'rapid_rating_end', 'rapid_rating_change',
      'rapid_total_time_seconds', 'rapid_avg_game_duration_seconds', 'rapid_performance_rating',
      // Totals across bullet+blitz+rapid
      'total_games', 'total_wins', 'total_draws', 'total_losses',
      'total_rating_start', 'total_rating_end', 'total_rating_change',
      'total_time_seconds', 'avg_game_duration_seconds', 'total_performance_rating'
    ];
  },
  
  /**
   * Creates the Player Stats sheet
   */
  createPlayerStatsSheet: function(ss) {
    let sheet = ss.getSheetByName('Player Stats');
    if (!sheet) {
      sheet = ss.insertSheet('Player Stats');
    }
    
    // Headers for all possible stat fields from the API
    const headers = [
      'timestamp', 'username', 'status', 'joined', 'last_online', 'country', 'location', 'title', 'name', 'url', 'followers', 'is_streamer', 'twitch_url', 'fide',
      // Time class stats
      'chess_daily_last_rating', 'chess_daily_best_rating', 'chess_daily_best_rating_date',
      'chess_daily_win', 'chess_daily_loss', 'chess_daily_draw',
      'chess_rapid_last_rating', 'chess_rapid_best_rating', 'chess_rapid_best_rating_date',
      'chess_rapid_win', 'chess_rapid_loss', 'chess_rapid_draw',
      'chess_blitz_last_rating', 'chess_blitz_best_rating', 'chess_blitz_best_rating_date',
      'chess_blitz_win', 'chess_blitz_loss', 'chess_blitz_draw',
      'chess_bullet_last_rating', 'chess_bullet_best_rating', 'chess_bullet_best_rating_date',
      'chess_bullet_win', 'chess_bullet_loss', 'chess_bullet_draw',
      // Variant stats
      'chess960_daily_last_rating', 'chess960_daily_best_rating', 'chess960_daily_best_rating_date',
      'chess960_daily_win', 'chess960_daily_loss', 'chess960_daily_draw',
      'puzzle_rush_best_score', 'puzzle_rush_best_date',
      'tactics_highest_rating', 'tactics_highest_rating_date', 'tactics_lowest_rating', 'tactics_lowest_rating_date'
    ];
    
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    
    return sheet;
  },
  
  /**
   * Creates the Logs sheet
   */
  createLogsSheet: function(ss) {
    let sheet = ss.getSheetByName('Logs');
    if (!sheet) {
      sheet = ss.insertSheet('Logs');
    }
    
    const headers = ['timestamp', 'level', 'operation', 'message', 'details'];
    
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    
    return sheet;
  },
  
  /**
   * Updates all sheet headers (for migration)
   */
  updateAllHeaders: function() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Update Games sheet headers
    const gamesSheet = ss.getSheetByName('Games');
    if (gamesSheet) {
      const headers = this.getGamesHeaders();
      const currentHeaders = gamesSheet.getRange(1, 1, 1, gamesSheet.getLastColumn()).getValues()[0];
      
      // Add any missing headers
      const missingHeaders = headers.filter(h => !currentHeaders.includes(h));
      if (missingHeaders.length > 0) {
        const startCol = gamesSheet.getLastColumn() + 1;
        gamesSheet.getRange(1, startCol, 1, missingHeaders.length).setValues([missingHeaders]);
        gamesSheet.getRange(1, startCol, 1, missingHeaders.length).setFontWeight('bold');
      }
    }

    // Update Ratings sheet headers
    const ratingsSheet = ss.getSheetByName('Ratings');
    if (ratingsSheet) {
      const desired = ['end', 'format', 'url', 'my_rating', 'my_pregame_rating', 'bullet', 'blitz', 'rapid', 'daily', 'live960', 'daily960', 'bughouse', 'crazyhouse', 'threecheck', 'koth', 'antichess', 'atomic', 'horde', 'racingkings'];
      const current = ratingsSheet.getRange(1, 1, 1, ratingsSheet.getLastColumn()).getValues()[0];
      const missing = desired.filter(h => !current.includes(h));
      if (missing.length > 0) {
        const startCol = ratingsSheet.getLastColumn() + 1;
        ratingsSheet.getRange(1, startCol, 1, missing.length).setValues([missing]);
        ratingsSheet.getRange(1, startCol, 1, missing.length).setFontWeight('bold');
      }
    }

    // Update Daily Stats sheet headers
    const dailySheet = ss.getSheetByName('Daily Stats');
    if (dailySheet) {
      const desired = this.getDailyStatsHeaders();
      dailySheet.getRange(1, 1, 1, desired.length).setValues([desired]);
      dailySheet.getRange(1, 1, 1, desired.length).setFontWeight('bold');
      dailySheet.setFrozenRows(1);
    }
  },
  
  /**
   * Batch writes games to the sheet
   */
  batchWriteGames: function(games, options) {
    if (!games || games.length === 0) return;
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Games');
    if (!sheet) throw new Error('Games sheet not found');
    
    const headers = this.getGamesHeaders();
    const headerMap = {};
    headers.forEach((header, index) => {
      headerMap[header] = index;
    });
    
    // Convert games to rows
    const rows = games.map(game => {
      const row = new Array(headers.length).fill('');
      
      // Map game data to columns
      Object.keys(game).forEach(key => {
        if (headerMap.hasOwnProperty(key)) {
          let value = game[key];
          
          // Convert objects/arrays to JSON strings
          if (typeof value === 'object' && value !== null) {
            value = JSON.stringify(value);
          }
          
          row[headerMap[key]] = value;
        }
      });
      
      // Derived/calculated fields
      // date from year,month,day or parsed from end string
      if (headerMap.hasOwnProperty('date')) {
        const y = game.year, m = game.month, d = game.day;
        if (y && m && d) {
          row[headerMap['date']] = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        } else if (typeof game.end === 'string') {
          const dm = game.end.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (dm) {
            row[headerMap['date']] = `${dm[1]}-${dm[2]}-${dm[3]}`;
          }
        }
      }
      
      // end_Time and second from end string
      if (typeof game.end === 'string') {
        const tm = game.end.match(/\d{4}-\d{2}-\d{2}\s+(\d{2}):(\d{2}):(\d{2})$/);
        if (tm) {
          if (headerMap.hasOwnProperty('end_Time')) {
            row[headerMap['end_Time']] = `${tm[1]}:${tm[2]}:${tm[3]}`;
          }
          if (headerMap.hasOwnProperty('second')) {
            row[headerMap['second']] = parseInt(tm[3], 10);
          }
        }
      }
      
      // Ensure my_outcome numeric; fallback mapping from my_result/opponent_result
      if (headerMap.hasOwnProperty('my_outcome')) {
        let outcome = game.my_outcome;
        if (outcome === undefined || outcome === null || outcome === '') {
          const resultMap = {
            'win': 1,
            'checkmated': 0,
            'agreed': 0.5,
            'repetition': 0.5,
            'timeout': 0,
            'resigned': 0,
            'stalemate': 0.5,
            'lose': 0,
            'insufficient': 0.5,
            'timevsinsufficient': 0.5,
            'abandoned': 0
          };
          let myRes = game.my_result;
          if (!myRes && game.my_color) {
            if (game.my_color === 'white') {
              myRes = game.white_result;
            } else if (game.my_color === 'black') {
              myRes = game.black_result;
            }
          }
          if (myRes && resultMap.hasOwnProperty(myRes)) {
            outcome = resultMap[myRes];
          }
        }
        if (outcome !== undefined) {
          row[headerMap['my_outcome']] = outcome;
        }
      }
      
      // Compute termination: the result that is not 'win'; if draw, both same so use either
      if (headerMap.hasOwnProperty('termination')) {
        let term = '';
        const wr = game.white_result;
        const br = game.black_result;
        const isDraw = function(r) {
          return ['agreed', 'repetition', 'stalemate', 'insufficient', 'timevsinsufficient'].indexOf(r) !== -1;
        };
        if (wr && br) {
          if (isDraw(wr) && isDraw(br)) {
            term = wr;
          } else if (wr === 'win' && br && br !== 'win') {
            term = br;
          } else if (br === 'win' && wr && wr !== 'win') {
            term = wr;
          }
        }
        if (!term && game.pgn_termination) {
          term = game.pgn_termination;
        }
        row[headerMap['termination']] = term || '';
      }
      
      return row;
    });
    
    // Append rows
    if (rows.length > 0) {
      const t = Trace.start('Sheets.batchWriteGames', 'append rows', { rows: rows.length });
      const startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, rows.length, headers.length).setValues(rows);
      // Sort newest games on top by 'end' unless disabled
      const shouldSort = !(options && options.sort === false);
      if (shouldSort) this.sortGamesByEndDesc();
      t.end();
    }
    
    return rows.length;
  },
  
  /**
   * Gets the last game timestamp
   */
  getLastGameTimestamp: function() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Games');
    if (!sheet || sheet.getLastRow() <= 1) return null;
    
    // Get end column index
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const endCol = headers.indexOf('end') + 1;
    
    if (endCol === 0) return null;
    
    // Get all end times and find the maximum
    const endTimes = sheet.getRange(2, endCol, sheet.getLastRow() - 1, 1).getValues();
    
    let maxTime = 0;
    endTimes.forEach(row => {
      const endStr = row[0];
      if (endStr && typeof endStr === 'string') {
        const epoch = TimeUtils.parseLocalDateTimeToEpochSeconds(endStr);
        if (epoch && epoch > maxTime) {
          maxTime = epoch;
        }
      }
    });
    
    return maxTime > 0 ? maxTime : null;
  },
  
  /**
   * Creates the Ratings sheet
   */
  createRatingsSheet: function(ss) {
    let sheet = ss.getSheetByName('Ratings');
    if (!sheet) {
      sheet = ss.insertSheet('Ratings');
    }
    var isMinimal = false; try { var v = ConfigManager.get('minimalMode'); isMinimal = (v === true || v === 'true' || v === 'on' || v === 1); } catch (e) {}
    const headers = isMinimal
      ? ['end', 'format', 'url', 'my_rating', 'my_pregame_rating', 'bullet', 'blitz', 'rapid']
      : ['end', 'format', 'url', 'my_rating', 'my_pregame_rating', 'bullet', 'blitz', 'rapid', 'daily', 'live960', 'daily960', 'bughouse', 'crazyhouse', 'threecheck', 'koth', 'antichess', 'atomic', 'horde', 'racingkings'];
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return sheet;
  },
  
  /**
   * Updates the Ratings sheet based on Games and Player Stats
   */
  updateRatingsSheet: function() {
    // Disabled full recomputation for performance. Ratings are appended incrementally.
    return;
  },

  /**
   * Appends Ratings rows for a batch of games. Only the game's format column is filled.
   */
  batchAppendRatingsFromGames: function(games, options) {
    if (!games || games.length === 0) return 0;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Ratings');
    if (!sheet) sheet = this.createRatingsSheet(ss);
    let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    let headerMap = {};
    headers.forEach((h, i) => headerMap[h] = i);

    // Ensure all required format columns exist
    var isMinimal = false; try { var v = ConfigManager.get('minimalMode'); isMinimal = (v === true || v === 'true' || v === 'on' || v === 1); } catch (e) {}
    const allowedFormats = isMinimal ? ['bullet', 'blitz', 'rapid'] : ['bullet', 'blitz', 'rapid', 'daily', 'live960', 'daily960', 'bughouse', 'crazyhouse', 'threecheck', 'koth', 'antichess', 'atomic', 'horde', 'racingkings'];
    const neededFormatsSet = {};
    games.forEach(g => {
      const f = (g && g.format) ? String(g.format).trim() : '';
      if (f && allowedFormats.indexOf(f) !== -1) neededFormatsSet[f] = true;
    });
    const missingFormats = Object.keys(neededFormatsSet).filter(f => !headerMap.hasOwnProperty(f));
    if (missingFormats.length > 0) {
      const startCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, startCol, 1, missingFormats.length).setValues([missingFormats]);
      sheet.getRange(1, startCol, 1, missingFormats.length).setFontWeight('bold');
      // Refresh headers and map after adding columns
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      headerMap = {};
      headers.forEach((h, i) => headerMap[h] = i);
    }

    const rows = games.map(game => {
      const row = new Array(headers.length).fill('');
      const endStr = typeof game.end === 'string' && game.end ? game.end : '';
      if (headerMap.hasOwnProperty('end')) row[headerMap['end']] = endStr;
      if (headerMap.hasOwnProperty('format')) row[headerMap['format']] = game.format || '';
      if (headerMap.hasOwnProperty('url')) row[headerMap['url']] = game.url || '';
      if (headerMap.hasOwnProperty('my_rating') && game.my_rating != null) row[headerMap['my_rating']] = game.my_rating;
      // Only populate the specific format column with the game's rating
      if (game.format && game.my_rating != null && headerMap.hasOwnProperty(game.format)) {
        row[headerMap[game.format]] = game.my_rating;
      }
      return row;
    });

    const startRow = sheet.getLastRow() + 1;
    const t = Trace.start('Sheets.batchAppendRatingsFromGames', 'append rows', { rows: rows.length });
    sheet.getRange(startRow, 1, rows.length, headers.length).setValues(rows);
    // Sort newest on top unless disabled
    const shouldSort = !(options && options.sort === false);
    if (shouldSort) this.sortRatingsByEndDesc();
    t.end();
    return rows.length;
  },

  /**
   * Appends a Ratings row from player stats. Only known formats are filled.
   */
  appendRatingsFromPlayerStats: function(statsData, options) {
    if (!statsData) return false;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Ratings');
    if (!sheet) sheet = this.createRatingsSheet(ss);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headerMap = {};
    headers.forEach((h, i) => headerMap[h] = i);

    const row = new Array(headers.length).fill('');
    const nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    if (headerMap.hasOwnProperty('end')) row[headerMap['end']] = nowStr;
    if (headerMap.hasOwnProperty('format')) row[headerMap['format']] = 'STATS';

    var isMinimal = false; try { var v = ConfigManager.get('minimalMode'); isMinimal = (v === true || v === 'true' || v === 'on' || v === 1); } catch (e) {}
    const mappings = isMinimal
      ? [
        { stat: 'chess_bullet', col: 'bullet' },
        { stat: 'chess_blitz', col: 'blitz' },
        { stat: 'chess_rapid', col: 'rapid' }
      ]
      : [
        { stat: 'chess_bullet', col: 'bullet' },
        { stat: 'chess_blitz', col: 'blitz' },
        { stat: 'chess_rapid', col: 'rapid' },
        { stat: 'chess_daily', col: 'daily' },
        { stat: 'chess960_daily', col: 'daily960' }
      ];
    mappings.forEach(map => {
      const s = statsData[map.stat];
      if (s && s.last && s.last.rating != null && headerMap.hasOwnProperty(map.col)) {
        row[headerMap[map.col]] = s.last.rating;
      }
    });

    const t = Trace.start('Sheets.appendRatingsFromPlayerStats', 'append row');
    sheet.appendRow(row);
    const shouldSort = !(options && options.sort === false);
    if (shouldSort) this.sortRatingsByEndDesc();
    t.end();
    return true;
  },
  
  /**
   * Creates Callback Queue sheet for per-row queue
   */
  createCallbackQueueSheet: function(ss) {
    let sheet = ss.getSheetByName('Callback Queue');
    if (!sheet) {
      sheet = ss.insertSheet('Callback Queue');
    }
    const headers = ['gameId', 'url', 'format', 'isDaily', 'addedAt', 'attempts', 'lastAttempt', 'status', 'completedAt', 'lastError'];
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return sheet;
  },
  
  /**
   * Updates callback data for specific games
   */
  updateCallbackData: function(gameUpdates) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Games');
    if (!sheet) return;
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const urlCol = headers.indexOf('url') + 1;
    
    // Build URL -> row map once
    const lastRow = sheet.getLastRow();
    const urlValues = lastRow > 1 ? sheet.getRange(2, urlCol, lastRow - 1, 1).getValues() : [];
    const urlToRow = {};
    for (var i = 0; i < urlValues.length; i++) {
      var u = urlValues[i][0];
      if (u) urlToRow[u] = i + 2;
    }
    
    // Find rows to update
    const updates = [];
    gameUpdates.forEach(update => {
      const rowNum = urlToRow[update.url];
      if (rowNum) {
        updates.push({ row: rowNum, data: update });
      }
    });
    
    // Apply updates
    const t = Trace.start('Sheets.updateCallbackData', 'apply updates', { updates: updates.length });
    updates.forEach(update => {
      Object.keys(update.data).forEach(key => {
        const colIndex = headers.indexOf(key) + 1;
        if (colIndex > 0) {
          let value = update.data[key];
          if (typeof value === 'object' && value !== null) {
            value = JSON.stringify(value);
          }
          sheet.getRange(update.row, colIndex).setValue(value);
        }
      });
    });
    
    // Also update Ratings sheet with my_pregame_rating and my_rating per URL
    const ratingsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Ratings');
    if (ratingsSheet) {
      const rHeaders = ratingsSheet.getRange(1, 1, 1, ratingsSheet.getLastColumn()).getValues()[0];
      const rHeaderMap = {};
      rHeaders.forEach((h, i) => rHeaderMap[h] = i);
      const hasUrl = rHeaderMap.hasOwnProperty('url');
      if (hasUrl) {
        const urlCol = rHeaderMap['url'] + 1;
        const rLastRow = ratingsSheet.getLastRow();
        const rUrlValues = rLastRow > 1 ? ratingsSheet.getRange(2, urlCol, rLastRow - 1, 1).getValues() : [];
        const rUrlToRow = {};
        for (var j = 0; j < rUrlValues.length; j++) {
          var ru = rUrlValues[j][0];
          if (ru) rUrlToRow[ru] = j + 2;
        }
        updates.forEach(update => {
          const data = update.data || {};
          const url = data.url;
          if (!url) return;
          const rRow = rUrlToRow[url];
          if (rRow) {
            if (data.my_pregame_rating != null && rHeaderMap.hasOwnProperty('my_pregame_rating')) {
              ratingsSheet.getRange(rRow, rHeaderMap['my_pregame_rating'] + 1).setValue(data.my_pregame_rating);
            }
            if (data.my_rating != null && rHeaderMap.hasOwnProperty('my_rating')) {
              ratingsSheet.getRange(rRow, rHeaderMap['my_rating'] + 1).setValue(data.my_rating);
            }
          } else {
            // Append a new ratings row for this URL
            const gRow = sheet.getRange(update.row, 1, 1, sheet.getLastColumn()).getValues()[0];
            const gMap = {};
            headers.forEach((h, i) => gMap[h] = i);
            const newRow = new Array(rHeaders.length).fill('');
            if (rHeaderMap.hasOwnProperty('end')) newRow[rHeaderMap['end']] = gRow[gMap['end']] || '';
            if (rHeaderMap.hasOwnProperty('format')) newRow[rHeaderMap['format']] = gRow[gMap['format']] || '';
            if (rHeaderMap.hasOwnProperty('url')) newRow[rHeaderMap['url']] = url;
            if (rHeaderMap.hasOwnProperty('my_rating')) newRow[rHeaderMap['my_rating']] = (data.my_rating != null ? data.my_rating : gRow[gMap['my_rating']] || '');
            if (rHeaderMap.hasOwnProperty('my_pregame_rating')) newRow[rHeaderMap['my_pregame_rating']] = data.my_pregame_rating != null ? data.my_pregame_rating : '';
            const fmt = String(newRow[rHeaderMap['format']] || '').trim();
            if (fmt && rHeaderMap.hasOwnProperty(fmt)) {
              newRow[rHeaderMap[fmt]] = newRow[rHeaderMap['my_rating']];
            }
            ratingsSheet.appendRow(newRow);
          }
        });
        // Keep Ratings sorted newest on top
        this.sortRatingsByEndDesc();
      }
    }
    t.end();
  },

  /**
   * Sorts a sheet by header name descending (newest first)
   */
  sortSheetByHeaderDesc: function(sheetName, headerName) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() <= 2) return;
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const colIndex = headers.indexOf(headerName) + 1;
    if (colIndex <= 0) return;
    const range = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
    range.sort([{column: colIndex, ascending: false}]);
  },

  /** Sort Games by 'end' descending */
  sortGamesByEndDesc: function() {
    this.sortSheetByHeaderDesc('Games', 'end');
  },

  /** Sort Ratings by 'end' descending */
  sortRatingsByEndDesc: function() {
    this.sortSheetByHeaderDesc('Ratings', 'end');
  },
  
  /**
   * Gets games for daily stats calculation
   */
  getGamesForDailyStats: function(startDate = null) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Games');
    if (!sheet || sheet.getLastRow() <= 1) return [];
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    
    // Convert to objects
    const games = data.map(row => {
      const game = {};
      headers.forEach((header, index) => {
        let value = row[index];
        
        // Parse JSON strings
        if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
          try {
            value = JSON.parse(value);
          } catch (e) {
            // Keep as string
          }
        }
        
        game[header] = value;
      });
      return game;
    });
    
    // Filter by date if specified
    if (startDate) {
      return games.filter(game => {
        const endStr = game.end;
        if (!endStr) return false;
        const epoch = TimeUtils.parseLocalDateTimeToEpochSeconds(endStr);
        return epoch && epoch > startDate;
      });
    }
    
    return games;
  },
  
  /**
   * Writes daily stats to sheet
   */
  writeDailyStats: function(rows) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Daily Stats');
    if (!sheet) return;
    // Ensure headers are up to date without clearing data rows elsewhere
    this.ensureDailyStatsHeaders();
    
    // Clear existing data (keep headers)
    if (sheet.getLastRow() > 1) {
      sheet.deleteRows(2, sheet.getLastRow() - 1);
    }

    // Write rows (already preformatted)
    if (rows && rows.length > 0) {
      sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    }
  },

  /**
   * Ensures the Daily Stats header row matches canonical headers
   */
  ensureDailyStatsHeaders: function() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Daily Stats');
    if (!sheet) {
      sheet = this.createDailyStatsSheet(ss);
      return;
    }
    const headers = this.getDailyStatsHeaders();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  },

  /**
   * Upserts Daily Stats rows by date key (yyyy-MM-dd). Does not clear the sheet.
   */
  upsertDailyStatsRows: function(rows, options) {
    if (!rows || rows.length === 0) return 0;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Daily Stats');
    if (!sheet) sheet = this.createDailyStatsSheet(ss);
    this.ensureDailyStatsHeaders();

    // Current headers and maps
    const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const hCur = {};
    currentHeaders.forEach((name, idx) => hCur[name] = idx);
    const desiredHeaders = this.getDailyStatsHeaders();
    const hDes = {};
    desiredHeaders.forEach((name, idx) => hDes[name] = idx);

    const dateColIdx = hCur.hasOwnProperty('date') ? hCur['date'] : -1;
    if (dateColIdx < 0) throw new Error('Daily Stats sheet missing date column');

    // Build date -> row number map and cache existing rows
    const lastRow = sheet.getLastRow();
    const numCols = currentHeaders.length;
    const existingValues = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, numCols).getValues() : [];
    const tz = Session.getScriptTimeZone();
    const dateToRow = {};
    existingValues.forEach((row, i) => {
      const cell = row[dateColIdx];
      let key = null;
      if (cell instanceof Date) {
        key = Utilities.formatDate(cell, tz, 'yyyy-MM-dd');
      } else if (typeof cell === 'string') {
        const s = cell.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) key = s; else {
          const ep = TimeUtils.parseLocalDateTimeToEpochSeconds(s);
          if (ep) key = Utilities.formatDate(TimeUtils.epochToLocal(ep), tz, 'yyyy-MM-dd');
        }
      }
      if (key) dateToRow[key] = i + 2; // account for header offset
    });

    // Partition into updates and appends
    const updates = []; // { row: number, values: any[] }
    const appends = [];
    rows.forEach(srcRow => {
      const dateKey = srcRow[hDes['date']];
      if (!dateKey) return;
      const existingRowNum = dateToRow[dateKey];
      if (existingRowNum) {
        // Merge over existing row values
        const existing = existingValues[existingRowNum - 2] ? existingValues[existingRowNum - 2].slice() : new Array(numCols).fill('');
        // Overlay by header name alignment
        desiredHeaders.forEach(name => {
          const srcIdx = hDes[name];
          const dstIdx = hCur.hasOwnProperty(name) ? hCur[name] : -1;
          if (dstIdx >= 0 && srcIdx >= 0) {
            existing[dstIdx] = srcRow[srcIdx];
          }
        });
        updates.push({ row: existingRowNum, values: existing });
      } else {
        // Build a new row aligned to current headers
        const out = new Array(numCols).fill('');
        desiredHeaders.forEach(name => {
          const srcIdx = hDes[name];
          const dstIdx = hCur.hasOwnProperty(name) ? hCur[name] : -1;
          if (dstIdx >= 0 && srcIdx >= 0) {
            out[dstIdx] = srcRow[srcIdx];
          }
        });
        appends.push(out);
      }
    });

    // Apply updates (small number of rows expected)
    updates.sort((a, b) => a.row - b.row);
    updates.forEach(u => {
      sheet.getRange(u.row, 1, 1, numCols).setValues([u.values]);
    });

    // Append new rows
    if (appends.length > 0) {
      const start = sheet.getLastRow() + 1;
      sheet.getRange(start, 1, appends.length, numCols).setValues(appends);
    }

    // Optional sort by date desc
    const shouldSort = !(options && options.sort === false);
    if (shouldSort) this.sortDailyStatsByDateDesc();

    return updates.length + appends.length;
  },

  /** Sort Daily Stats by 'date' descending */
  sortDailyStatsByDateDesc: function() {
    this.sortSheetByHeaderDesc('Daily Stats', 'date');
  },
  
  /**
   * Logs a message to the Logs sheet
   */
  log: function(level, operation, message, details = '') {
    try {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Logs');
      if (!sheet) return;
      // Log level filter
      var cfgLevel = 'INFO';
      try { var lv = ConfigManager.get('logLevel'); if (typeof lv === 'string') cfgLevel = lv.toUpperCase(); } catch (e) {}
      const order = { 'TRACE': 10, 'INFO': 20, 'WARNING': 30, 'ERROR': 40 };
      const lvl = (level || 'INFO').toUpperCase();
      const min = order[cfgLevel] != null ? order[cfgLevel] : 20;
      const cur = order[lvl] != null ? order[lvl] : 20;
      if (cur < min) return;
      
      const row = [
        new Date(),
        level,
        operation,
        message,
        typeof details === 'object' ? JSON.stringify(details) : details
      ];
      
      sheet.appendRow(row);
      
      // Keep only last 1000 logs
      if (sheet.getLastRow() > 1001) {
        sheet.deleteRow(2);
      }
    } catch (e) {
      Logger.log('Error logging to sheet: ' + e.toString());
    }
  },
  
  /**
   * Gets appropriate column width for a header
   */
  getColumnWidth: function(header) {
    const widthMap = {
      'url': 200,
      'pgn': 300,
      'eco_url': 200,
      'moves_san': 150,
      'moves_numbered': 150,
      'clocks': 150,
      'clock_seconds': 150,
      'time_per_move': 150
    };
    
    return widthMap[header] || 100;
  },
  
  /**
   * Checks for duplicate games
   */
  checkDuplicates: function(games) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Games');
    if (!sheet || sheet.getLastRow() <= 1) return games;
    
    // Get existing URLs
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const urlCol = headers.indexOf('url') + 1;
    const lastRow = sheet.getLastRow();
    const existingUrlValues = sheet.getRange(2, urlCol, lastRow - 1, 1).getValues();
    const existingUrls = new Set(existingUrlValues.map(row => row[0]));
    
    // Filter out duplicates
    return games.filter(game => {
      return !existingUrls.has(game.url);
    });
  },
  
  /**
   * Appends player stats to the Player Stats sheet
   */
  appendPlayerStats: function(profileData, statsData) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Player Stats');
    if (!sheet) return;
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const row = new Array(headers.length).fill('');
    
    // Add timestamp
    row[headers.indexOf('timestamp')] = new Date();
    
    // Add profile data
    if (profileData) {
      row[headers.indexOf('username')] = profileData.username || '';
      row[headers.indexOf('status')] = profileData.status || '';
      row[headers.indexOf('joined')] = profileData.joined ? new Date(profileData.joined * 1000) : '';
      row[headers.indexOf('last_online')] = profileData.last_online ? new Date(profileData.last_online * 1000) : '';
      row[headers.indexOf('country')] = profileData.country || '';
      row[headers.indexOf('location')] = profileData.location || '';
      row[headers.indexOf('title')] = profileData.title || '';
      row[headers.indexOf('name')] = profileData.name || '';
      row[headers.indexOf('url')] = profileData.url || '';
      row[headers.indexOf('followers')] = profileData.followers || 0;
      row[headers.indexOf('is_streamer')] = profileData.is_streamer || false;
      row[headers.indexOf('twitch_url')] = profileData.twitch_url || '';
      row[headers.indexOf('fide')] = profileData.fide || '';
    }
    
    // Add stats data
    if (statsData) {
      // Chess daily stats
      if (statsData.chess_daily) {
        const daily = statsData.chess_daily;
        row[headers.indexOf('chess_daily_last_rating')] = daily.last?.rating || '';
        row[headers.indexOf('chess_daily_best_rating')] = daily.best?.rating || '';
        row[headers.indexOf('chess_daily_best_rating_date')] = daily.best?.date ? new Date(daily.best.date * 1000) : '';
        row[headers.indexOf('chess_daily_win')] = daily.record?.win || 0;
        row[headers.indexOf('chess_daily_loss')] = daily.record?.loss || 0;
        row[headers.indexOf('chess_daily_draw')] = daily.record?.draw || 0;
      }
      
      // Chess rapid stats
      if (statsData.chess_rapid) {
        const rapid = statsData.chess_rapid;
        row[headers.indexOf('chess_rapid_last_rating')] = rapid.last?.rating || '';
        row[headers.indexOf('chess_rapid_best_rating')] = rapid.best?.rating || '';
        row[headers.indexOf('chess_rapid_best_rating_date')] = rapid.best?.date ? new Date(rapid.best.date * 1000) : '';
        row[headers.indexOf('chess_rapid_win')] = rapid.record?.win || 0;
        row[headers.indexOf('chess_rapid_loss')] = rapid.record?.loss || 0;
        row[headers.indexOf('chess_rapid_draw')] = rapid.record?.draw || 0;
      }
      
      // Chess blitz stats
      if (statsData.chess_blitz) {
        const blitz = statsData.chess_blitz;
        row[headers.indexOf('chess_blitz_last_rating')] = blitz.last?.rating || '';
        row[headers.indexOf('chess_blitz_best_rating')] = blitz.best?.rating || '';
        row[headers.indexOf('chess_blitz_best_rating_date')] = blitz.best?.date ? new Date(blitz.best.date * 1000) : '';
        row[headers.indexOf('chess_blitz_win')] = blitz.record?.win || 0;
        row[headers.indexOf('chess_blitz_loss')] = blitz.record?.loss || 0;
        row[headers.indexOf('chess_blitz_draw')] = blitz.record?.draw || 0;
      }
      
      // Chess bullet stats
      if (statsData.chess_bullet) {
        const bullet = statsData.chess_bullet;
        row[headers.indexOf('chess_bullet_last_rating')] = bullet.last?.rating || '';
        row[headers.indexOf('chess_bullet_best_rating')] = bullet.best?.rating || '';
        row[headers.indexOf('chess_bullet_best_rating_date')] = bullet.best?.date ? new Date(bullet.best.date * 1000) : '';
        row[headers.indexOf('chess_bullet_win')] = bullet.record?.win || 0;
        row[headers.indexOf('chess_bullet_loss')] = bullet.record?.loss || 0;
        row[headers.indexOf('chess_bullet_draw')] = bullet.record?.draw || 0;
      }
      
      // Chess960 daily stats
      if (statsData.chess960_daily) {
        const chess960 = statsData.chess960_daily;
        row[headers.indexOf('chess960_daily_last_rating')] = chess960.last?.rating || '';
        row[headers.indexOf('chess960_daily_best_rating')] = chess960.best?.rating || '';
        row[headers.indexOf('chess960_daily_best_rating_date')] = chess960.best?.date ? new Date(chess960.best.date * 1000) : '';
        row[headers.indexOf('chess960_daily_win')] = chess960.record?.win || 0;
        row[headers.indexOf('chess960_daily_loss')] = chess960.record?.loss || 0;
        row[headers.indexOf('chess960_daily_draw')] = chess960.record?.draw || 0;
      }
      
      // Puzzle rush stats
      if (statsData.puzzle_rush && statsData.puzzle_rush.best) {
        row[headers.indexOf('puzzle_rush_best_score')] = statsData.puzzle_rush.best.score || '';
        row[headers.indexOf('puzzle_rush_best_date')] = statsData.puzzle_rush.best.date ? new Date(statsData.puzzle_rush.best.date * 1000) : '';
      }
      
      // Tactics stats
      if (statsData.tactics) {
        row[headers.indexOf('tactics_highest_rating')] = statsData.tactics.highest?.rating || '';
        row[headers.indexOf('tactics_highest_rating_date')] = statsData.tactics.highest?.date ? new Date(statsData.tactics.highest.date * 1000) : '';
        row[headers.indexOf('tactics_lowest_rating')] = statsData.tactics.lowest?.rating || '';
        row[headers.indexOf('tactics_lowest_rating_date')] = statsData.tactics.lowest?.date ? new Date(statsData.tactics.lowest.date * 1000) : '';
      }
    }
    
    // Append the row
    sheet.appendRow(row);
    
    return true;
  }
};
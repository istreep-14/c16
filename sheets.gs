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
    
    const headers = [
      'date', 'format',
      'games_played', 'wins', 'draws', 'losses',
      'rating_start', 'rating_end', 'rating_change',
      'total_time_minutes', 'avg_game_duration',
      'longest_win_streak', 'longest_loss_streak',
      'opponents_avg_rating', 'performance_rating'
    ];
    
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    
    return sheet;
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
  },
  
  /**
   * Batch writes games to the sheet
   */
  batchWriteGames: function(games) {
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
      const startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, rows.length, headers.length).setValues(rows);
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
    const headers = ['end', 'format', 'my_rating', 'my_pregame_rating', 'bullet', 'blitz', 'rapid', 'daily', 'live960', 'daily960'];
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
  batchAppendRatingsFromGames: function(games) {
    if (!games || games.length === 0) return 0;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Ratings');
    if (!sheet) sheet = this.createRatingsSheet(ss);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headerMap = {};
    headers.forEach((h, i) => headerMap[h] = i);

    const rows = games.map(game => {
      const row = new Array(headers.length).fill('');
      const endStr = typeof game.end === 'string' && game.end ? game.end : '';
      if (headerMap.hasOwnProperty('end')) row[headerMap['end']] = endStr;
      if (headerMap.hasOwnProperty('format')) row[headerMap['format']] = game.format || '';
      // Only populate the specific format column with the game's rating
      if (game.format && game.my_rating != null && headerMap.hasOwnProperty(game.format)) {
        row[headerMap[game.format]] = game.my_rating;
      }
      return row;
    });

    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, headers.length).setValues(rows);
    return rows.length;
  },

  /**
   * Appends a Ratings row from player stats. Only known formats are filled.
   */
  appendRatingsFromPlayerStats: function(statsData) {
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

    const mappings = [
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

    sheet.appendRow(row);
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
    
    // Get all URLs
    const urls = sheet.getRange(2, urlCol, sheet.getLastRow() - 1, 1).getValues();
    
    // Find rows to update
    const updates = [];
    gameUpdates.forEach(update => {
      const rowIndex = urls.findIndex(row => row[0] === update.url);
      if (rowIndex !== -1) {
        updates.push({
          row: rowIndex + 2,
          data: update
        });
      }
    });
    
    // Apply updates
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
  writeDailyStats: function(dailyStats) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Daily Stats');
    if (!sheet) return;
    
    // Clear existing data (keep headers)
    if (sheet.getLastRow() > 1) {
      sheet.deleteRows(2, sheet.getLastRow() - 1);
    }
    
    // Convert stats to rows
    const rows = [];
    Object.keys(dailyStats).forEach(dateKey => {
      const dayStats = dailyStats[dateKey];
      
      // Add total row for the day
      if (dayStats.total) {
        rows.push([
          dateKey,
          'TOTAL',
          dayStats.total.games_played || 0,
          dayStats.total.wins || 0,
          dayStats.total.draws || 0,
          dayStats.total.losses || 0,
          dayStats.total.rating_start || '',
          dayStats.total.rating_end || '',
          dayStats.total.rating_change || 0,
          dayStats.total.total_time_minutes || 0,
          dayStats.total.avg_game_duration || 0,
          dayStats.total.longest_win_streak || 0,
          dayStats.total.longest_loss_streak || 0,
          dayStats.total.opponents_avg_rating || 0,
          dayStats.total.performance_rating || 0
        ]);
      }
      
      // Add format-specific rows
      Object.keys(dayStats).forEach(format => {
        if (format !== 'total') {
          const stats = dayStats[format];
          rows.push([
            dateKey,
            format,
            stats.games_played || 0,
            stats.wins || 0,
            stats.draws || 0,
            stats.losses || 0,
            stats.rating_start || '',
            stats.rating_end || '',
            stats.rating_change || 0,
            stats.total_time_minutes || 0,
            stats.avg_game_duration || 0,
            stats.longest_win_streak || 0,
            stats.longest_loss_streak || 0,
            stats.opponents_avg_rating || 0,
            stats.performance_rating || 0
          ]);
        }
      });
    });
    
    // Write rows
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    }
  },
  
  /**
   * Logs a message to the Logs sheet
   */
  log: function(level, operation, message, details = '') {
    try {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Logs');
      if (!sheet) return;
      
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
    
    const existingData = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const existingUrls = new Set(existingData.map(row => row[urlCol - 1]));
    
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
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
      'url', 'uuid', 'pgn', 'time_control', 'end_time', 'end_time_formatted', 'rated', 'tcn', 'initial_setup',
      
      // Time fields (parsed from JSON)
      'year', 'month', 'day', 'hour', 'minute', 'timestamp_local',
      
      // Player info
      'white_username', 'white_rating', 'white_result', 'white_uuid',
      'black_username', 'black_rating', 'black_result', 'black_uuid',
      
      // Game metadata
      'eco', 'eco_url', 'rules', 'time_class', 'format', 'game_type',
      
      // Parsed time control
      'base_time_seconds', 'increment_seconds',
      
      // Derived fields
      'my_color', 'my_username', 'my_rating', 'my_result', 'my_rating_change',
      'opponent_username', 'opponent_rating', 'opponent_result',
      'game_duration_seconds', 'move_count', 'ply_count',
      
      // Rating calculations (pre-game estimates)
      'my_rating_pregame_glicko', 'opponent_rating_pregame_glicko',
      'my_rating_pregame_recent', 'opponent_rating_pregame_recent',
      'my_rating_pregame_callback', 'opponent_rating_pregame_callback',
      'rating_method_used',
      
      // Expected outcome
      'expected_score',
      
      // Move data (stored as JSON strings)
      'moves_san', 'moves_numbered', 'clocks', 'clock_seconds', 'time_per_move',
      
      // Callback data (filled later)
      'callback_processed', 'callback_timestamp',
      'white_rating_change_exact', 'black_rating_change_exact',
      'white_accuracy', 'black_accuracy',
      'callback_game_id', 'callback_variant', 'callback_initial_setup', 'callback_fen',
      'callback_pgn_headers', 'callback_analysis_depth', 'callback_best_move', 'callback_evaluation',
      'callback_clocks', 'callback_move_times', 'callback_raw_data',
      
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
    
    // Get end_time column index
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const endTimeCol = headers.indexOf('end_time') + 1;
    
    if (endTimeCol === 0) return null;
    
    // Get all end times and find the maximum
    const endTimes = sheet.getRange(2, endTimeCol, sheet.getLastRow() - 1, 1).getValues();
    
    let maxTime = 0;
    endTimes.forEach(row => {
      const time = row[0];
      if (time && typeof time === 'number' && time > maxTime) {
        maxTime = time;
      }
    });
    
    return maxTime > 0 ? maxTime : null;
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
      return games.filter(game => game.timestamp_local > startDate);
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
    
    // Get existing URLs and UUIDs
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const urlCol = headers.indexOf('url') + 1;
    const uuidCol = headers.indexOf('uuid') + 1;
    
    const existingData = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const existingUrls = new Set(existingData.map(row => row[urlCol - 1]));
    const existingUuids = new Set(existingData.map(row => row[uuidCol - 1]));
    
    // Filter out duplicates
    return games.filter(game => {
      return !existingUrls.has(game.url) && !existingUuids.has(game.uuid);
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
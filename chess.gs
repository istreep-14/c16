/**
 * Chess Game Processing and PGN Parsing
 * Handles game data parsing, format detection, and move extraction
 */

/**
 * Game Data Processor
 */
const GameDataProcessor = {
  /**
   * Processes a raw game from the API
   */
  processGame: function(rawGame, username) {
    const game = Object.assign({}, rawGame);
    
    // Resolve minimal/toggle flags
    var minimal = false; try { var mv = ConfigManager.get('minimalMode'); minimal = (mv === true || mv === 'true' || mv === 'on' || mv === 1); } catch (e) {}
    var storePGN = true; try { var sp = ConfigManager.get('storePGN'); if (sp != null) storePGN = (sp === true || sp === 'true' || sp === 'on' || sp === 1); } catch (e) {}
    var storeDetailedMoves = true; try { var sd = ConfigManager.get('storeDetailedMoves'); if (sd != null) storeDetailedMoves = (sd === true || sd === 'true' || sd === 'on' || sd === 1); } catch (e) {}
    if (minimal) { storePGN = false; storeDetailedMoves = false; }
    
    // Parse PGN data (optional)
    var pgnData = { headers: {}, moves: '' };
    if (storePGN || storeDetailedMoves) {
      pgnData = this.parsePGN(game.pgn);
      Object.assign(game, pgnData.headers);
    }
    
    // Parse time control first to get base time and increment
    const timeControl = this.parseTimeControl(game.time_control);
    Object.assign(game, timeControl);
    
    // Parse moves and clocks with time control info (optional heavy)
    if (storeDetailedMoves && pgnData && pgnData.moves) {
      const moveData = this.parseMoves(pgnData.moves, timeControl.base_time_seconds, timeControl.increment_seconds);
      Object.assign(game, moveData);
    }
    
    // Compute time anchors (start/end) and components using PGN times and end_time
    const timeAnchors = this.computeTimeAnchors(game);
    Object.assign(game, timeAnchors);
    
    // Determine format
    game.format = this.determineFormat(game);
    
    // Add perspective fields
    const perspective = this.addPerspectiveFields(game, username);
    Object.assign(game, perspective);
    
    // Add processing metadata
    game.processed_timestamp = new Date().toISOString();
    game.processing_version = '1.0';
    
    // Drop heavy fields under minimal mode
    if (minimal) {
      delete game.pgn;
      delete game.moves_san;
      delete game.moves_numbered;
      delete game.clocks;
      delete game.clock_seconds;
      delete game.time_per_move;
      delete game.pgn_opening;
      delete game.eco_url;
      delete game.pgn_current_position;
    }
    
    return game;
  },
  
  /**
   * Parses PGN string
   */
  parsePGN: function(pgn) {
    if (!pgn) return { headers: {}, moves: '' };
    
    const lines = pgn.split('\n');
    const headers = {};
    let moveSection = false;
    let moves = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        // Header line
        const match = trimmed.match(/\[(\w+)\s+"(.*)"\]/);
        if (match) {
          const key = match[1].toLowerCase();
          const value = match[2];
          
          // Map PGN headers to our schema
          const headerMap = {
            'event': 'pgn_event',
            'site': 'pgn_site',
            'date': 'pgn_date',
            'round': 'pgn_round',
            'white': 'pgn_white',
            'black': 'pgn_black',
            'result': 'pgn_result',
            'whiteelo': 'pgn_white_elo',
            'blackelo': 'pgn_black_elo',
            'eco': 'eco',  // Direct mapping to eco field
            'ecourl': 'eco_url',  // Direct mapping to eco_url field
            'opening': 'pgn_opening',
            'termination': 'pgn_termination',
            'currentposition': 'pgn_current_position',
            // Extra timing headers
            'utcdate': 'pgn_utc_date',
            'utctime': 'pgn_utc_time',
            'starttime': 'pgn_start_time',
            'endtime': 'pgn_end_time',
            'startdate': 'pgn_start_date',
            'enddate': 'pgn_end_date'
          };
          
          if (headerMap[key]) {
            headers[headerMap[key]] = value;
          }
        }
      } else if (trimmed.length > 0 && !moveSection && !trimmed.startsWith('[')) {
        // Start of moves section
        moveSection = true;
        moves.push(trimmed);
      } else if (moveSection && trimmed.length > 0) {
        moves.push(trimmed);
      }
    }
    
    return {
      headers: headers,
      moves: moves.join(' ')
    };
  },
  
  /**
   * Parses moves and extracts clock times
   */
  parseMoves: function(moveText, baseTime = null, increment = 0) {
    if (!moveText) return {};
    
    // Extract moves with clocks
    const moveRegex = /(\d+\.)\s*([a-zA-Z][a-h1-8+#=\-xO]+)\s*(?:\{[^}]*\})?\s*(?:\d+\.\.\.)?\.?\s*([a-zA-Z][a-h1-8+#=\-xO]+)?\s*(?:\{[^}]*\})?/g;
    const clockRegex = /\[%clk\s+([\d:\.]+)\]/g;
    
    const movesSan = [];
    const movesNumbered = [];
    const clocks = [];
    const clockSeconds = [];
    
    // Extract all moves
    let match;
    let moveNumber = 1;
    
    // First, extract all clock times in order
    const clockMatches = [...moveText.matchAll(clockRegex)];
    clockMatches.forEach(clockMatch => {
      const timeStr = clockMatch[1];
      clocks.push(timeStr);
      // Parse to single decimal precision
      const seconds = Math.round(this.parseClockToSeconds(timeStr) * 10) / 10;
      clockSeconds.push(seconds);
    });
    
    // Extract moves without clocks for SAN list
    const cleanMoveText = moveText.replace(/\{[^}]*\}/g, '').trim();
    const tokens = cleanMoveText.split(/\s+/);
    
    tokens.forEach(token => {
      // Skip move numbers, results, and empty tokens
      if (!token.match(/^\d+\./) && !token.match(/^(1-0|0-1|1\/2-1\/2|\*)$/) && token.length > 0) {
        movesSan.push(token);
        
        // Add to numbered moves
        if (movesNumbered.length % 2 === 0) {
          movesNumbered.push(`${Math.floor(movesNumbered.length / 2) + 1}. ${token}`);
        } else {
          movesNumbered.push(`${Math.floor(movesNumbered.length / 2) + 1}. ${token}`);
        }
      }
    });
    
    // Calculate time per move with proper logic
    const timePerMove = [];
    const initialTime = baseTime || Math.max(...clockSeconds);
    
    for (let i = 0; i < clockSeconds.length; i++) {
      let timeTaken = 0;
      
      if (i === 0) {
        // White's first move: base time - clock_seconds[0]
        timeTaken = initialTime - clockSeconds[0];
      } else if (i === 1) {
        // Black's first move: base time - clock_seconds[1]
        timeTaken = initialTime - clockSeconds[1];
      } else {
        // Subsequent moves: compare with same player's previous clock
        const prevIndex = i - 2;
        const prevClock = clockSeconds[prevIndex];
        const currentClock = clockSeconds[i];
        
        // Time taken = previous clock - current clock + increment
        timeTaken = prevClock - currentClock + increment;
      }
      
      // Round to single decimal precision
      timePerMove.push(Math.round(Math.max(0, timeTaken) * 10) / 10);
    }
    
    // Calculate game duration
    const gameDuration = this.calculateGameDuration(clockSeconds);
    
    return {
      moves_san: movesSan,
      moves_numbered: movesNumbered,
      clocks: clocks,
      clock_seconds: clockSeconds,
      time_per_move: timePerMove,
      move_count: Math.ceil(movesSan.length / 2),
      ply_count: movesSan.length,
      game_duration_seconds: gameDuration
    };
  },
  
  /**
   * Parses clock string to seconds
   */
  parseClockToSeconds: function(clockStr) {
    const parts = clockStr.split(':');
    let seconds = 0;
    
    if (parts.length === 3) {
      // HH:MM:SS
      seconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
    } else if (parts.length === 2) {
      // MM:SS
      seconds = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
    } else {
      // Just seconds
      seconds = parseFloat(clockStr);
    }
    
    return seconds;
  },
  
  /**
   * Calculates game duration from clock times
   */
  calculateGameDuration: function(clockSeconds) {
    if (!clockSeconds || clockSeconds.length < 2) return 0;
    
    // Find initial time (maximum clock value)
    const initialTime = Math.max(...clockSeconds);
    
    // Calculate total time used by both players
    let whiteTimeUsed = 0;
    let blackTimeUsed = 0;
    
    for (let i = 0; i < clockSeconds.length; i++) {
      if (i % 2 === 0) {
        // White's clock
        const prevClock = i === 0 ? initialTime : clockSeconds[i - 2];
        whiteTimeUsed += prevClock - clockSeconds[i];
      } else {
        // Black's clock
        const prevClock = i === 1 ? initialTime : clockSeconds[i - 2];
        blackTimeUsed += prevClock - clockSeconds[i];
      }
    }
    
    return Math.max(whiteTimeUsed, blackTimeUsed);
  },
  
  /**
   * Computes start/end formatted times and date components
   * Uses PGN UTC/Start for start and PGN End/end_time for end. Falls back gracefully.
   */
  computeTimeAnchors: function(game) {
    // Helpers to parse UTC date/time from PGN
    const parseUTCDateTimeToEpochMs = (dateStr, timeStr) => {
      if (!dateStr || !timeStr) return null;
      const d = String(dateStr).trim().replace(/\./g, '-');
      const t = String(timeStr).trim();
      const dm = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      const tm = t.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
      if (!dm || !tm) return null;
      const year = parseInt(dm[1], 10);
      const month = parseInt(dm[2], 10) - 1;
      const day = parseInt(dm[3], 10);
      const hour = parseInt(tm[1], 10);
      const minute = parseInt(tm[2], 10);
      const second = parseInt(tm[3], 10);
      return Date.UTC(year, month, day, hour, minute, second);
    };
    
    // Determine anchors
    let startEpochMs = null;
    let endEpochMs = null;
    
    // End: prefer PGN EndDate/EndTime, else JSON end_time
    if (game.pgn_end_date && game.pgn_end_time) {
      endEpochMs = parseUTCDateTimeToEpochMs(game.pgn_end_date, game.pgn_end_time);
    }
    if (!endEpochMs && game.end_time) {
      endEpochMs = game.end_time * 1000;
    }
    
    // Start: prefer PGN StartDate/StartTime, else UTCDate/UTCTime
    if (game.pgn_start_date && game.pgn_start_time) {
      startEpochMs = parseUTCDateTimeToEpochMs(game.pgn_start_date, game.pgn_start_time);
    } else if (game.pgn_utc_date && game.pgn_utc_time) {
      startEpochMs = parseUTCDateTimeToEpochMs(game.pgn_utc_date, game.pgn_utc_time);
    }
    
    // Duration: prefer direct difference when both anchors exist
    let durationSeconds = Number(game.game_duration_seconds) || 0;
    if (startEpochMs && endEpochMs && endEpochMs >= startEpochMs) {
      durationSeconds = Math.round((endEpochMs - startEpochMs) / 1000);
    }
    
    // If only one anchor exists, derive the other using duration when available
    if (!startEpochMs && endEpochMs && durationSeconds > 0) {
      startEpochMs = endEpochMs - durationSeconds * 1000;
    }
    if (!endEpochMs && startEpochMs && durationSeconds > 0) {
      endEpochMs = startEpochMs + durationSeconds * 1000;
    }
    
    // Require at least end anchor for downstream grouping
    if (!endEpochMs) return {};
    if (!startEpochMs) {
      startEpochMs = endEpochMs - (durationSeconds || 0) * 1000;
    }
    
    // Format to local timezone strings
    const tz = Session.getScriptTimeZone();
    const endDate = new Date(endEpochMs);
    const endStr = Utilities.formatDate(endDate, tz, 'yyyy-MM-dd HH:mm:ss');
    const startDate = new Date(startEpochMs);
    const startStr = Utilities.formatDate(startDate, tz, 'yyyy-MM-dd HH:mm:ss');
    
    return {
      year: endDate.getFullYear(),
      month: endDate.getMonth() + 1,
      day: endDate.getDate(),
      hour: endDate.getHours(),
      minute: endDate.getMinutes(),
      end: endStr,
      start: startStr,
      game_duration_seconds: durationSeconds
    };
  },
  
  // parseTimeFields deprecated in favor of computeTimeAnchors
  
  /**
   * Parses time control string
   */
  parseTimeControl: function(timeControlStr) {
    if (!timeControlStr) return {};
    
    // Handle different formats: "180", "180+1", "1/86400"
    let baseTime = 0;
    let increment = 0;
    let movesPerTime = null;
    
    if (timeControlStr.includes('/')) {
      // Daily format: moves/seconds (e.g., "1/86400" means 1 move per 86400 seconds/day)
      const parts = timeControlStr.split('/');
      movesPerTime = parseInt(parts[0]);
      baseTime = parseInt(parts[1]); // Time per move in seconds for daily games
    } else if (timeControlStr.includes('+')) {
      // Live format with increment
      const parts = timeControlStr.split('+');
      baseTime = parseInt(parts[0]);
      increment = parseInt(parts[1]);
    } else {
      // Just base time
      baseTime = parseInt(timeControlStr);
    }
    
    return {
      base_time_seconds: baseTime,
      increment_seconds: increment,
      moves_per_time: movesPerTime // For daily games
    };
  },
  
  /**
   * Classifies game speed based on time control
   */
  classifySpeed: function(baseSeconds, incrementSeconds) {
    if (!baseSeconds && baseSeconds !== 0) return '';
    
    const inc = incrementSeconds || 0;
    const classNumber = Number(baseSeconds) + Number(inc) * 40;
    
    if (classNumber < 180) return 'bullet';
    if (classNumber < 480) return 'blitz';
    if (classNumber < 1500) return 'rapid';
    return 'daily';
  },
  
  /**
   * Determines game format based on rules, time control, and URL
   */
  determineFormat: function(game) {
    // Check if daily game
    if (game.url && game.url.includes('/daily/')) {
      if (game.rules === 'chess960') {
        return 'daily960';
      }
      return 'daily';
    }
    
    // For live games
    if (game.rules && game.rules !== 'chess') {
      // Variants (except chess960)
      if (game.rules === 'chess960') {
        return 'live960';
      }
      return game.rules; // bughouse, crazyhouse, etc.
    }
    
    // Standard chess - use time class if provided
    if (game.time_class) {
      return game.time_class; // bullet, blitz, rapid
    }
    
    // Fallback - calculate time class
    const timeClass = this.classifySpeed(game.base_time_seconds, game.increment_seconds);
    return timeClass;
  },
  
  /**
   * Adds perspective fields (from user's point of view)
   */
  addPerspectiveFields: function(game, username) {
    const usernameLower = username.toLowerCase();
    const isWhite = game.white && game.white.username && 
                   game.white.username.toLowerCase() === usernameLower;
    const isBlack = game.black && game.black.username && 
                   game.black.username.toLowerCase() === usernameLower;
    
    const perspective = {
      my_color: isWhite ? 'white' : (isBlack ? 'black' : null),
      my_username: username,
      my_rating: null,
      my_result: null,
      my_outcome: null,
      opponent_username: null,
      opponent_rating: null,
      opponent_result: null
    };
    
    if (isWhite) {
      perspective.my_rating = game.white.rating;
      perspective.my_result = game.white.result;
      perspective.opponent_username = game.black ? game.black.username : null;
      perspective.opponent_rating = game.black ? game.black.rating : null;
      perspective.opponent_result = game.black ? game.black.result : null;
    } else if (isBlack) {
      perspective.my_rating = game.black.rating;
      perspective.my_result = game.black.result;
      perspective.opponent_username = game.white ? game.white.username : null;
      perspective.opponent_rating = game.white ? game.white.rating : null;
      perspective.opponent_result = game.white ? game.white.result : null;
    }
    
    // Map raw results to numeric outcomes
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
    
    if (perspective.my_result && resultMap.hasOwnProperty(perspective.my_result)) {
      perspective.my_outcome = resultMap[perspective.my_result];
    }
    
    // Flatten white/black data
    if (game.white) {
      perspective.white_username = game.white.username;
      perspective.white_rating = game.white.rating;
      perspective.white_result = game.white.result;
      // white_uuid removed from sheet; keep only if needed elsewhere
    }
    
    if (game.black) {
      perspective.black_username = game.black.username;
      perspective.black_rating = game.black.rating;
      perspective.black_result = game.black.result;
      // black_uuid removed from sheet; keep only if needed elsewhere
    }
    
    return perspective;
  }
};
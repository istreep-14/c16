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
    
    // Parse PGN data
    const pgnData = this.parsePGN(game.pgn);
    
    // Add parsed PGN headers
    Object.assign(game, pgnData.headers);
    
    // Parse moves and clocks
    const moveData = this.parseMoves(pgnData.moves);
    Object.assign(game, moveData);
    
    // Add time fields
    const timeFields = this.parseTimeFields(game.end_time);
    Object.assign(game, timeFields);
    
    // Parse time control
    const timeControl = this.parseTimeControl(game.time_control);
    Object.assign(game, timeControl);
    
    // Determine format
    game.format = this.determineFormat(game);
    
    // Add perspective fields
    const perspective = this.addPerspectiveFields(game, username);
    Object.assign(game, perspective);
    
    // Add processing metadata
    game.processed_timestamp = new Date().toISOString();
    game.processing_version = '1.0';
    
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
            'eco': 'pgn_eco',
            'opening': 'pgn_opening',
            'termination': 'pgn_termination',
            'currentposition': 'pgn_current_position'
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
  parseMoves: function(moveText) {
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
      clockSeconds.push(this.parseClockToSeconds(timeStr));
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
    
    // Calculate time per move
    const timePerMove = [];
    for (let i = 0; i < clockSeconds.length; i++) {
      if (i === 0) {
        // First move - calculate from initial time
        const initialTime = Math.max(...clockSeconds);
        timePerMove.push(initialTime - clockSeconds[i]);
      } else {
        // Check if this is the same player (every other move)
        if (i % 2 === 0) {
          // White's move - compare with white's previous clock
          const prevClock = i >= 2 ? clockSeconds[i - 2] : Math.max(...clockSeconds);
          const timeTaken = prevClock - clockSeconds[i];
          
          // Account for increment (will be added by increment logic)
          timePerMove.push(Math.max(0, timeTaken));
        } else {
          // Black's move - compare with black's previous clock
          const prevClock = i >= 2 ? clockSeconds[i - 2] : Math.max(...clockSeconds);
          const timeTaken = prevClock - clockSeconds[i];
          
          timePerMove.push(Math.max(0, timeTaken));
        }
      }
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
   * Parses time fields from epoch timestamp
   */
  parseTimeFields: function(endTime) {
    if (!endTime) return {};
    
    // Convert epoch to date
    const date = new Date(endTime * 1000);
    
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1, // 1-12
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      timestamp_local: endTime // Keep original epoch for sorting
    };
  },
  
  /**
   * Parses time control string
   */
  parseTimeControl: function(timeControlStr) {
    if (!timeControlStr) return {};
    
    // Handle different formats: "180", "180+1", "1/86400"
    let baseTime = 0;
    let increment = 0;
    
    if (timeControlStr.includes('/')) {
      // Daily format: moves/seconds
      const parts = timeControlStr.split('/');
      baseTime = parseInt(parts[1]);
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
      increment_seconds: increment
    };
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
    
    // Standard chess - use time class
    if (game.time_class) {
      return game.time_class; // bullet, blitz, rapid
    }
    
    // Fallback based on base time
    const baseTime = game.base_time_seconds || 0;
    
    if (baseTime < 180) return 'bullet';
    if (baseTime < 600) return 'blitz';
    if (baseTime < 1800) return 'rapid';
    return 'daily';
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
    
    // Convert results to numeric
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
      perspective.my_result = resultMap[perspective.my_result];
    }
    
    // Flatten white/black data
    if (game.white) {
      perspective.white_username = game.white.username;
      perspective.white_rating = game.white.rating;
      perspective.white_result = game.white.result;
      perspective.white_uuid = game.white.uuid;
    }
    
    if (game.black) {
      perspective.black_username = game.black.username;
      perspective.black_rating = game.black.rating;
      perspective.black_result = game.black.result;
      perspective.black_uuid = game.black.uuid;
    }
    
    return perspective;
  }
};
/**
 * Utility Functions
 * Common helpers for data processing and conversions
 */

/**
 * Time utilities
 */
const TimeUtils = {
  /**
   * Converts epoch timestamp to local date
   */
  epochToLocal: function(epoch) {
    return new Date(epoch * 1000);
  },
  
  /**
   * Gets date key for grouping (YYYY-MM-DD)
   */
  getDateKey: function(year, month, day) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  },
  
  /**
   * Checks if a timestamp is from today
   */
  isToday: function(timestamp) {
    const date = new Date(timestamp * 1000);
    const today = new Date();
    return date.getFullYear() === today.getFullYear() &&
           date.getMonth() === today.getMonth() &&
           date.getDate() === today.getDate();
  },
  
  /**
   * Gets the start of day timestamp
   */
  getStartOfDay: function(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return Math.floor(d.getTime() / 1000);
  },
  
  /**
   * Gets the end of day timestamp
   */
  getEndOfDay: function(date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return Math.floor(d.getTime() / 1000);
  },
  
  /**
   * Parses a local datetime string 'yyyy-MM-dd HH:mm:ss' to epoch seconds
   */
  parseLocalDateTimeToEpochSeconds: function(dateTimeStr) {
    if (!dateTimeStr) return null;
    // Handle Date objects directly
    if (dateTimeStr instanceof Date) {
      const ms = dateTimeStr.getTime();
      return isNaN(ms) ? null : Math.floor(ms / 1000);
    }
    // Handle numeric inputs (epoch seconds or milliseconds)
    if (typeof dateTimeStr === 'number') {
      if (!isFinite(dateTimeStr)) return null;
      // Heuristic: >= 1e12 is ms, else seconds
      return dateTimeStr >= 1e12 ? Math.floor(dateTimeStr / 1000) : Math.floor(dateTimeStr);
    }
    if (typeof dateTimeStr !== 'string') return null;
    const s = dateTimeStr.trim();
    // Primary format: yyyy-MM-dd HH:mm:ss
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
    if (m) {
      const year = parseInt(m[1], 10);
      const month = parseInt(m[2], 10) - 1;
      const day = parseInt(m[3], 10);
      const hour = parseInt(m[4], 10);
      const minute = parseInt(m[5], 10);
      const second = parseInt(m[6], 10);
      const d = new Date(year, month, day, hour, minute, second, 0);
      if (isNaN(d.getTime())) return null;
      return Math.floor(d.getTime() / 1000);
    }
    // ISO-like format: yyyy-MM-ddTHH:mm:ss[.sss][Z]
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z)?$/i);
    if (m) {
      const year = parseInt(m[1], 10);
      const month = parseInt(m[2], 10) - 1;
      const day = parseInt(m[3], 10);
      const hour = parseInt(m[4], 10);
      const minute = parseInt(m[5], 10);
      const second = parseInt(m[6], 10);
      const useUTC = !!m[7];
      const ms = useUTC
        ? Date.UTC(year, month, day, hour, minute, second)
        : new Date(year, month, day, hour, minute, second, 0).getTime();
      return Math.floor(ms / 1000);
    }
    // Date-only format: yyyy-MM-dd (assume start of day local)
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const year = parseInt(m[1], 10);
      const month = parseInt(m[2], 10) - 1;
      const day = parseInt(m[3], 10);
      const d = new Date(year, month, day, 0, 0, 0, 0);
      return Math.floor(d.getTime() / 1000);
    }
    // Fallback: let JS parse; if valid, return epoch seconds
    const d = new Date(s);
    if (!isNaN(d.getTime())) return Math.floor(d.getTime() / 1000);
    return null;
  },
  
  /**
   * Formats duration in seconds to readable string
   */
  formatDuration: function(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }
};

/**
 * Rating calculation utilities (pruned to essentials)
 */
const RatingUtils = {
  /**
   * Calculates performance rating for a set of games
   */
  calculatePerformanceRating: function(games) {
    if (!games || games.length === 0) return 0;
    
    let totalOpponentRating = 0;
    let totalScore = 0;
    let count = 0;
    
    games.forEach(game => {
      if (game.opponent_rating && game.my_outcome !== null) {
        totalOpponentRating += game.opponent_rating;
        totalScore += game.my_outcome;
        count++;
      }
    });
    
    if (count === 0) return 0;
    
    const avgOpponentRating = totalOpponentRating / count;
    const scorePercentage = totalScore / count;
    
    // Performance rating formula
    let adjustment = 0;
    if (scorePercentage === 1) {
      adjustment = 400; // Perfect score
    } else if (scorePercentage === 0) {
      adjustment = -400; // No wins
    } else {
      // Use inverse normal distribution approximation
      adjustment = 400 * Math.log10(scorePercentage / (1 - scorePercentage));
    }
    
    return Math.round(avgOpponentRating + adjustment);
  }
};

// Validation utilities removed (unused)

/**
 * Array and data manipulation utilities (pruned)
 */
const DataUtils = {
  /**
   * Calculates streak lengths
   */
  calculateStreaks: function(results) {
    const streaks = {
      currentWin: 0,
      currentLoss: 0,
      longestWin: 0,
      longestLoss: 0
    };
    
    let currentWinStreak = 0;
    let currentLossStreak = 0;
    
    results.forEach(result => {
      if (result === 1) {
        currentWinStreak++;
        currentLossStreak = 0;
        streaks.longestWin = Math.max(streaks.longestWin, currentWinStreak);
      } else if (result === 0) {
        currentLossStreak++;
        currentWinStreak = 0;
        streaks.longestLoss = Math.max(streaks.longestLoss, currentLossStreak);
      } else {
        currentWinStreak = 0;
        currentLossStreak = 0;
      }
    });
    
    streaks.currentWin = currentWinStreak;
    streaks.currentLoss = currentLossStreak;
    
    return streaks;
  }
};

// Error utilities removed (unused)

// Format utilities removed (unused)

/**
 * Lightweight tracing utility for function entry/exit timing
 */
const Trace = {
  isEnabled: function() {
    try {
      const flag = ConfigManager.get('traceEnabled');
      return flag === true || flag === 'true' || flag === 'on' || flag === 1;
    } catch (e) {
      return false;
    }
  },
  getMinMs: function() {
    try {
      const v = ConfigManager.get('traceMinMs');
      return typeof v === 'number' ? v : 0;
    } catch (e) {
      return 0;
    }
  },
  start: function(operation, message, details) {
    if (!this.isEnabled()) {
      return { end: function() {} };
    }
    const startMs = Date.now();
    const meta = details || {};
    try {
      SheetsManager.log('TRACE', operation, message || 'start', meta);
    } catch (e) {
      // ignore logging errors
    }
    const self = this;
    return {
      end: function(extra) {
        try {
          const duration = Date.now() - startMs;
          if (duration >= self.getMinMs()) {
            const det = Object.assign({}, meta, { duration_ms: duration }, extra || {});
            SheetsManager.log('TRACE', operation, 'end', det);
          }
        } catch (e) {
          // ignore logging errors
        }
      }
    };
  },
  step: function(operation, message, details) {
    if (!this.isEnabled()) return;
    try {
      SheetsManager.log('TRACE', operation, message, details || {});
    } catch (e) {
      // ignore
    }
  },
  wrap: function(operation, message, fn) {
    const t = this.start(operation, message);
    try {
      const result = fn();
      t.end({ result: 'ok' });
      return result;
    } catch (e) {
      try { SheetsManager.log('ERROR', operation, e.toString(), { stack: e.stack || '' }); } catch (er) {}
      t.end({ error: e && e.toString ? e.toString() : 'error' });
      throw e;
    }
  }
};
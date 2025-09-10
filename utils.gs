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
 * Rating calculation utilities
 */
const RatingUtils = {
  /**
   * Estimates pre-game rating using Glicko-2 reverse calculation
   * This is an approximation since we don't have RD values
   */
  estimatePreGameRating: function(postRating, result, opponentRating) {
    // Simplified estimation
    // Actual Glicko-2 is complex, this is an approximation
    const K = 32; // Approximate K-factor
    const expectedScore = this.getExpectedScore(postRating, opponentRating);
    const ratingChange = K * (result - expectedScore);
    
    // Pre-game rating = post-game rating - rating change
    return Math.round(postRating - ratingChange);
  },
  
  /**
   * Calculates expected score using Elo formula
   */
  getExpectedScore: function(rating1, rating2) {
    return 1 / (1 + Math.pow(10, (rating2 - rating1) / 400));
  },
  
  /**
   * Estimates rating change
   */
  estimateRatingChange: function(rating, result, opponentRating) {
    const K = 32; // Approximate K-factor
    const expectedScore = this.getExpectedScore(rating, opponentRating);
    return Math.round(K * (result - expectedScore));
  },
  
  /**
   * Calculates performance rating for a set of games
   */
  calculatePerformanceRating: function(games) {
    if (!games || games.length === 0) return 0;
    
    let totalOpponentRating = 0;
    let totalScore = 0;
    let count = 0;
    
    games.forEach(game => {
      if (game.opponent_rating && game.my_result !== null) {
        totalOpponentRating += game.opponent_rating;
        totalScore += game.my_result;
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

/**
 * Data validation utilities
 */
const ValidationUtils = {
  /**
   * Validates a game object has required fields
   */
  validateGame: function(game) {
    const requiredFields = ['url', 'end_time'];
    const missingFields = [];
    
    requiredFields.forEach(field => {
      if (!game[field]) {
        missingFields.push(field);
      }
    });
    
    if (missingFields.length > 0) {
      throw new Error(`Game missing required fields: ${missingFields.join(', ')}`);
    }
    
    return true;
  },
  
  /**
   * Validates rating is in reasonable range
   */
  validateRating: function(rating) {
    return rating && rating >= 100 && rating <= 3500;
  },
  
  /**
   * Cleans and validates username
   */
  cleanUsername: function(username) {
    if (!username) return null;
    return username.trim().toLowerCase();
  }
};

/**
 * Array and data manipulation utilities
 */
const DataUtils = {
  /**
   * Groups array of objects by a key
   */
  groupBy: function(array, key) {
    return array.reduce((groups, item) => {
      const group = item[key];
      if (!groups[group]) groups[group] = [];
      groups[group].push(item);
      return groups;
    }, {});
  },
  
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
        // Win
        currentWinStreak++;
        currentLossStreak = 0;
        streaks.longestWin = Math.max(streaks.longestWin, currentWinStreak);
      } else if (result === 0) {
        // Loss
        currentLossStreak++;
        currentWinStreak = 0;
        streaks.longestLoss = Math.max(streaks.longestLoss, currentLossStreak);
      } else {
        // Draw - breaks both streaks
        currentWinStreak = 0;
        currentLossStreak = 0;
      }
    });
    
    streaks.currentWin = currentWinStreak;
    streaks.currentLoss = currentLossStreak;
    
    return streaks;
  },
  
  /**
   * Safely parses JSON
   */
  safeJsonParse: function(str, defaultValue = null) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return defaultValue;
    }
  },
  
  /**
   * Chunks array into smaller arrays
   */
  chunk: function(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
};

/**
 * Error handling utilities
 */
const ErrorUtils = {
  /**
   * Formats error for logging
   */
  formatError: function(error, context = {}) {
    return {
      message: error.toString(),
      stack: error.stack || '',
      context: context,
      timestamp: new Date().toISOString()
    };
  },
  
  /**
   * Determines error severity
   */
  getErrorSeverity: function(error) {
    const message = error.toString().toLowerCase();
    
    if (message.includes('api') || message.includes('fetch')) {
      return 'CRITICAL';
    } else if (message.includes('sheet') || message.includes('write')) {
      return 'WARNING';
    } else {
      return 'INFO';
    }
  }
};

/**
 * Format detection utilities
 */
const FormatUtils = {
  /**
   * Gets time class from base time
   */
  getTimeClass: function(baseTimeSeconds) {
    if (baseTimeSeconds < 180) return 'bullet';
    if (baseTimeSeconds < 600) return 'blitz';
    if (baseTimeSeconds < 1800) return 'rapid';
    return 'daily';
  },
  
  /**
   * Determines if a game is daily/correspondence
   */
  isDaily: function(game) {
    return game.url && game.url.includes('/daily/');
  }
};
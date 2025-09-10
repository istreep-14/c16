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
    SheetsManager.log('INFO', 'Daily Stats', 'Starting daily stats update');
    
    // Get all games
    const games = SheetsManager.getGamesForDailyStats();
    
    if (games.length === 0) {
      return {
        daysProcessed: 0,
        totalGames: 0
      };
    }
    
    // Add rating calculations to games
    this.calculateRatings(games);
    
    // Group games by date and format
    const dailyStats = this.groupGamesByDay(games);
    
    // Calculate statistics for each day
    Object.keys(dailyStats).forEach(dateKey => {
      this.calculateDayStats(dailyStats[dateKey], dateKey);
    });
    
    // Write to sheet
    SheetsManager.writeDailyStats(dailyStats);
    
    return {
      daysProcessed: Object.keys(dailyStats).length,
      totalGames: games.length
    };
  }
  
  /**
   * Calculates ratings for all games
   */
  calculateRatings(games) {
    // Sort games by timestamp
    games.sort((a, b) => a.timestamp_local - b.timestamp_local);
    
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
    // Skip if callback data already exists
    if (game.callback_processed) {
      game.rating_method_used = 'callback';
      return;
    }
    
    // Calculate my pre-game rating
    if (game.my_rating && game.my_result !== null && game.opponent_rating) {
      // Estimate using Glicko
      game.my_rating_pregame_glicko = RatingUtils.estimatePreGameRating(
        game.my_rating,
        game.my_result,
        game.opponent_rating
      );
      
      // Estimate opponent's pre-game rating (inverse result)
      const opponentResult = 1 - game.my_result;
      game.opponent_rating_pregame_glicko = RatingUtils.estimatePreGameRating(
        game.opponent_rating,
        opponentResult,
        game.my_rating_pregame_glicko
      );
    }
    
    // Use most recent rating
    if (formatHistory.lastRating) {
      game.my_rating_pregame_recent = formatHistory.lastRating;
      
      // Calculate rating change
      const currentRating = game.my_rating || formatHistory.lastRating;
      game.my_rating_change = currentRating - formatHistory.lastRating;
      
      // Estimate opponent's pre-game rating
      if (game.opponent_rating && game.my_rating_change) {
        game.opponent_rating_pregame_recent = game.opponent_rating + game.my_rating_change;
      }
    } else {
      // First game of format - use current rating
      game.my_rating_pregame_recent = game.my_rating;
      game.my_rating_change = 0;
    }
    
    // Determine which method to use
    if (game.my_rating_pregame_recent && 
        Math.abs(game.my_rating - game.my_rating_pregame_recent) < 100) {
      // Recent rating seems reasonable
      game.rating_method_used = 'recent';
    } else {
      // Use Glicko estimate
      game.rating_method_used = 'glicko';
    }
    
    // Calculate expected score
    const myPreRating = game[`my_rating_pregame_${game.rating_method_used}`];
    const oppPreRating = game[`opponent_rating_pregame_${game.rating_method_used}`];
    
    if (myPreRating && oppPreRating) {
      game.expected_score = RatingUtils.getExpectedScore(myPreRating, oppPreRating);
    }
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
        // Count results
        if (game.my_result === 1) {
          stats.wins++;
        } else if (game.my_result === 0) {
          stats.losses++;
        } else if (game.my_result === 0.5) {
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
      const results = games.map(g => g.my_result).filter(r => r !== null);
      const streaks = DataUtils.calculateStreaks(results);
      stats.longest_win_streak = streaks.longestWin;
      stats.longest_loss_streak = streaks.longestLoss;
      
      // Get rating for this day
      if (format !== 'total') {
        // Find first and last game of the day
        const sortedGames = games.sort((a, b) => a.timestamp_local - b.timestamp_local);
        const firstGame = sortedGames[0];
        const lastGame = sortedGames[sortedGames.length - 1];
        
        // Rating at start of day
        if (firstGame.my_rating_pregame_recent) {
          stats.rating_start = firstGame.my_rating_pregame_recent;
        } else if (firstGame.my_rating_pregame_glicko) {
          stats.rating_start = firstGame.my_rating_pregame_glicko;
        }
        
        // Rating at end of day
        if (lastGame.my_rating) {
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
    // This would be called by daily stats to get the rating at a specific date
    // For now, returns the latest known rating
    return this.getLatestRating(format);
  }
};
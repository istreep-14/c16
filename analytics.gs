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
    
    // Get all games
    const games = SheetsManager.getGamesForDailyStats();
    
    if (games.length === 0) {
      const result = {
        daysProcessed: 0,
        totalGames: 0
      };
      t.end({ daysProcessed: 0, totalGames: 0 });
      return result;
    }
    
    // Add rating calculations to games
    this.calculateRatings(games);
    
    // Group games by date and format
    const dailyStats = this.groupGamesByDay(games);
    
    // Calculate statistics for each day
    Object.keys(dailyStats).forEach(dateKey => {
      const dt = Trace.start('DailyStatsProcessor.calculateDayStats', 'day', { date: dateKey });
      this.calculateDayStats(dailyStats[dateKey], dateKey);
      dt.end();
    });
    
    // Write to sheet
    SheetsManager.writeDailyStats(dailyStats);
    
    const result = {
      daysProcessed: Object.keys(dailyStats).length,
      totalGames: games.length
    };
    t.end({ daysProcessed: result.daysProcessed, totalGames: result.totalGames });
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
/**
 * Chess.com API Integration
 * Handles all API calls with rate limiting and error handling
 */

/**
 * Chess.com API client
 */
const ChessAPI = {
  BASE_URL: 'https://api.chess.com/pub',
  
  /**
   * Rate limiter state
   */
  rateLimiter: {
    requests: [],
    get limit() {
      return CONSTANTS.API_RATE_LIMIT;
    },
    get period() {
      return CONSTANTS.API_RATE_PERIOD;
    }
  },
  
  /**
   * Makes a rate-limited API request
   */
  request: function(url, options = {}) {
    const t = Trace.start('API.request', 'fetch', { url: url });
    // Check rate limit
    this.checkRateLimit();
    
    const defaultOptions = {
      method: 'GET',
      muteHttpExceptions: true,
      headers: {
        'User-Agent': 'Chess.com Logger Google Apps Script'
      }
    };
    
    const finalOptions = Object.assign({}, defaultOptions, options);
    
    let response;
    let retries = 0;
    const maxRetries = CONSTANTS.MAX_RETRIES;
    
    while (retries <= maxRetries) {
      try {
        response = UrlFetchApp.fetch(url, finalOptions);
        const code = response.getResponseCode();
        
        if (code === 200) {
          // Success - record request and return
          this.recordRequest();
          t.end({ code: 200 });
          return JSON.parse(response.getContentText());
        } else if (code === 429) {
          // Rate limited - wait and retry
          const retryAfter = response.getHeaders()['Retry-After'] || 60;
          Utilities.sleep(retryAfter * 1000);
          retries++;
        } else if (code >= 500) {
          // Server error - retry with backoff
          Utilities.sleep(CONSTANTS.RETRY_DELAY * Math.pow(2, retries));
          retries++;
        } else {
          // Client error - don't retry
          const err = new Error(`API Error ${code}: ${response.getContentText()}`);
          t.end({ error: err.toString(), code: code });
          throw err;
        }
      } catch (error) {
        if (retries >= maxRetries) {
          t.end({ error: error && error.toString ? error.toString() : 'error' });
          throw error;
        }
        Utilities.sleep(CONSTANTS.RETRY_DELAY * Math.pow(2, retries));
        retries++;
      }
    }
    
    const err = new Error('Max retries exceeded');
    t.end({ error: err.toString() });
    throw err;
  },
  
  /**
   * Checks and enforces rate limit
   */
  checkRateLimit: function() {
    const now = Date.now();
    const cutoff = now - this.rateLimiter.period;
    
    // Remove old requests
    this.rateLimiter.requests = this.rateLimiter.requests.filter(time => time > cutoff);
    
    // Check if at limit
    if (this.rateLimiter.requests.length >= this.rateLimiter.limit) {
      const oldestRequest = Math.min(...this.rateLimiter.requests);
      const waitTime = this.rateLimiter.period - (now - oldestRequest) + 1000;
      
      if (waitTime > 0) {
        SheetsManager.log('INFO', 'API', `Rate limit reached, waiting ${Math.round(waitTime/1000)}s`);
        Utilities.sleep(waitTime);
      }
    }
  },
  
  /**
   * Records a request for rate limiting
   */
  recordRequest: function() {
    this.rateLimiter.requests.push(Date.now());
  },
  
  /**
   * Gets player profile
   */
  getPlayerProfile: function(username) {
    const url = `${this.BASE_URL}/player/${username}`;
    return this.request(url);
  },
  
  /**
   * Gets player stats
   */
  getPlayerStats: function(username) {
    const url = `${this.BASE_URL}/player/${username}/stats`;
    return this.request(url);
  },
  
  /**
   * Gets list of monthly archives
   */
  getArchives: function(username) {
    const url = `${this.BASE_URL}/player/${username}/games/archives`;
    const response = this.request(url);
    return response.archives || [];
  },
  
  /**
   * Gets games from a monthly archive
   */
  getMonthlyGames: function(archiveUrl) {
    const response = this.request(archiveUrl);
    return response.games || [];
  },
  
  /**
   * Callback API for detailed game data
   */
  getGameCallback: function(gameUrl) {
    // Extract game ID and type from URL
    const match = gameUrl.match(/game\/(live|daily)\/(\d+)/);
    if (!match) {
      throw new Error('Invalid game URL: ' + gameUrl);
    }
    
    const gameType = match[1];
    const gameId = match[2];
    
    const callbackUrl = `https://www.chess.com/callback/${gameType}/game/${gameId}`;
    
    // Callback API doesn't use the same rate limiting
    const response = UrlFetchApp.fetch(callbackUrl, {
      method: 'GET',
      muteHttpExceptions: true,
      headers: {
        'User-Agent': 'Chess.com Logger Google Apps Script'
      }
    });
    
    if (response.getResponseCode() !== 200) {
      throw new Error(`Callback API Error ${response.getResponseCode()}: ${response.getContentText()}`);
    }
    
    return JSON.parse(response.getContentText());
  }
};

/**
 * Game Processor - handles fetching and processing games
 */
class GameProcessor {
  constructor(username) {
    this.username = username;
    this.startTime = Date.now();
  }
  
  /**
   * Processes new games incrementally
   */
  processNewGames(lastGameTime, checkpoint = {}) {
    const t = Trace.start('GameProcessor.processNewGames', 'start', { lastGameTime: lastGameTime, checkpoint: checkpoint });
    const archives = ChessAPI.getArchives(this.username);
    let gamesProcessed = 0;
    let totalGames = 0;
    let earliestNewGameEpoch = null;
    
    // Start from checkpoint or beginning
    let startIndex = checkpoint.archiveIndex || 0;
    let gameBuffer = checkpoint.gameBuffer || [];
    
    // Process archives from most recent, but within each monthly archive process oldest-to-newest
    for (let i = archives.length - 1 - startIndex; i >= 0; i--) {
      // Check execution time
      if (this.shouldCheckpoint()) {
        const result = {
          gamesProcessed,
          totalGames: SheetsManager.getLastGameTimestamp() ? 'Unknown' : totalGames,
          checkpoint: {
            archiveIndex: archives.length - 1 - i,
            gameBuffer,
            lastGameTime
          }
        };
        t.end({ checkpoint: true, gamesProcessed: gamesProcessed });
        return result;
      }
      
      const archive = archives[i];
      const games = ChessAPI.getMonthlyGames(archive);
      
      // Filter games newer than lastGameTime. Monthly archive is oldest->newest.
      // Keep original order so that when we append, newest end up after earlier ones in this batch.
      const newGames = lastGameTime
        ? games.filter(game => game.end_time > lastGameTime)
        : games;
      
      if (newGames.length === 0 && lastGameTime) {
        // No new games in this archive, we can stop
        break;
      }
      
      // Process games newest->oldest within each monthly archive
      const monthlyNewToOld = newGames.slice().reverse();
      const processedGames = monthlyNewToOld.map(game => GameDataProcessor.processGame(game, this.username));
      gameBuffer = gameBuffer.concat(processedGames);
      
      // Write in batches
      if (gameBuffer.length >= CONSTANTS.BATCH_SIZE) {
        const batch = gameBuffer.splice(0, CONSTANTS.BATCH_SIZE);
        const uniqueGames = SheetsManager.checkDuplicates(batch);
        
        if (uniqueGames.length > 0) {
          // Write games then keep Games sheet sorted newest-first
          SheetsManager.batchWriteGames(uniqueGames, { sort: false });
          // Append Ratings rows (they will be sorted within the helper)
          const sortedForRatings = uniqueGames.slice().sort((a, b) => {
            const ea = TimeUtils.parseLocalDateTimeToEpochSeconds(a.end) || (a.end_time || 0);
            const eb = TimeUtils.parseLocalDateTimeToEpochSeconds(b.end) || (b.end_time || 0);
            return ea - eb;
          });
          SheetsManager.batchAppendRatingsFromGames(sortedForRatings, { sort: false });
          CallbackQueueManager.addToQueue(uniqueGames);
          gamesProcessed += uniqueGames.length;
          // Track earliest epoch among this written batch
          uniqueGames.forEach(g => {
            const ep = TimeUtils.parseLocalDateTimeToEpochSeconds(g.end) || (g.end_time || 0);
            if (ep && (earliestNewGameEpoch == null || ep < earliestNewGameEpoch)) earliestNewGameEpoch = ep;
          });
        }
      }
    }
    
    // Write remaining games
    if (gameBuffer.length > 0) {
      const uniqueGames = SheetsManager.checkDuplicates(gameBuffer);
      if (uniqueGames.length > 0) {
        SheetsManager.batchWriteGames(uniqueGames, { sort: false });
        const sortedForRatings = uniqueGames.slice().sort((a, b) => {
          const ea = TimeUtils.parseLocalDateTimeToEpochSeconds(a.end) || (a.end_time || 0);
          const eb = TimeUtils.parseLocalDateTimeToEpochSeconds(b.end) || (b.end_time || 0);
          return ea - eb;
        });
        SheetsManager.batchAppendRatingsFromGames(sortedForRatings, { sort: false });
        CallbackQueueManager.addToQueue(uniqueGames);
        gamesProcessed += uniqueGames.length;
        uniqueGames.forEach(g => {
          const ep = TimeUtils.parseLocalDateTimeToEpochSeconds(g.end) || (g.end_time || 0);
          if (ep && (earliestNewGameEpoch == null || ep < earliestNewGameEpoch)) earliestNewGameEpoch = ep;
        });
      }
    }
    
    // Clear checkpoint on completion
    CheckpointManager.clear('fetchGames');
    // Single final sort for this run
    SheetsManager.sortGamesByEndDesc();
    SheetsManager.sortRatingsByEndDesc();
    
    const result = {
      gamesProcessed,
      totalGames: SheetsManager.getLastGameTimestamp() ? 'Updated' : totalGames,
      checkpoint: {},
      earliestNewGameEpoch: earliestNewGameEpoch
    };
    t.end({ gamesProcessed: gamesProcessed });
    return result;
  }
  
  /**
   * Processes all historical games
   */
  processHistoricalGames(checkpoint = {}) {
    const t = Trace.start('GameProcessor.processHistoricalGames', 'start', { checkpoint: checkpoint });
    const archives = ChessAPI.getArchives(this.username);
    let gamesProcessed = checkpoint.gamesProcessed || 0;
    let archivesProcessed = checkpoint.archivesProcessed || 0;
    
    // Start from checkpoint or beginning
    let startIndex = checkpoint.archiveIndex || 0;
    let gameBuffer = checkpoint.gameBuffer || [];
    
    // Process archives from oldest to newest
    for (let i = startIndex; i < archives.length; i++) {
      // Check execution time
      if (this.shouldCheckpoint()) {
        const result = {
          gamesProcessed,
          archivesProcessed,
          totalArchives: archives.length,
          complete: false,
          checkpoint: {
            archiveIndex: i,
            gameBuffer,
            gamesProcessed,
            archivesProcessed
          }
        };
        t.end({ checkpoint: true, gamesProcessed: gamesProcessed, archivesProcessed: archivesProcessed });
        return result;
      }
      
      const archive = archives[i];
      SheetsManager.log('INFO', 'Historical Fetch', `Processing archive ${i + 1}/${archives.length}: ${archive}`);
      
      const games = ChessAPI.getMonthlyGames(archive);
      
      // Process all games newest->oldest within the month
      const monthlyAllNewToOld = games.slice().reverse();
      const processedGames = monthlyAllNewToOld.map(game => GameDataProcessor.processGame(game, this.username));
      gameBuffer = gameBuffer.concat(processedGames);
      
      // Write in batches
      while (gameBuffer.length >= CONSTANTS.BATCH_SIZE) {
        const batch = gameBuffer.splice(0, CONSTANTS.BATCH_SIZE);
        const uniqueGames = SheetsManager.checkDuplicates(batch);
        
        if (uniqueGames.length > 0) {
          SheetsManager.batchWriteGames(uniqueGames, { sort: false });
          // Append Ratings rows in chronological order for consistency
          const sortedForRatings = uniqueGames.slice().sort((a, b) => {
            const ea = TimeUtils.parseLocalDateTimeToEpochSeconds(a.end) || (a.end_time || 0);
            const eb = TimeUtils.parseLocalDateTimeToEpochSeconds(b.end) || (b.end_time || 0);
            return ea - eb;
          });
          SheetsManager.batchAppendRatingsFromGames(sortedForRatings, { sort: false });
          CallbackQueueManager.addToQueue(uniqueGames);
          gamesProcessed += uniqueGames.length;
        }
      }
      
      archivesProcessed++;
    }
    
    // Write remaining games
    if (gameBuffer.length > 0) {
      const uniqueGames = SheetsManager.checkDuplicates(gameBuffer);
      if (uniqueGames.length > 0) {
        SheetsManager.batchWriteGames(uniqueGames, { sort: false });
        const sortedForRatings = uniqueGames.slice().sort((a, b) => {
          const ea = TimeUtils.parseLocalDateTimeToEpochSeconds(a.end) || (a.end_time || 0);
          const eb = TimeUtils.parseLocalDateTimeToEpochSeconds(b.end) || (b.end_time || 0);
          return ea - eb;
        });
        SheetsManager.batchAppendRatingsFromGames(sortedForRatings, { sort: false });
        CallbackQueueManager.addToQueue(uniqueGames);
        gamesProcessed += uniqueGames.length;
      }
    }
    
    // Clear checkpoint on completion
    CheckpointManager.clear('historicalFetch');
    // Single final sort for this run
    SheetsManager.sortGamesByEndDesc();
    SheetsManager.sortRatingsByEndDesc();
    
    const result = {
      gamesProcessed,
      archivesProcessed,
      totalArchives: archives.length,
      complete: true,
      checkpoint: {}
    };
    t.end({ gamesProcessed: gamesProcessed, archivesProcessed: archivesProcessed });
    return result;
  }
  
  /**
   * Checks if we should checkpoint due to execution time
   */
  shouldCheckpoint() {
    return (Date.now() - this.startTime) > CONSTANTS.MAX_EXECUTION_TIME;
  }
}
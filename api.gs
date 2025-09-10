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
    limit: CONSTANTS.API_RATE_LIMIT,
    period: CONSTANTS.API_RATE_PERIOD
  },
  
  /**
   * Makes a rate-limited API request
   */
  request: function(url, options = {}) {
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
          throw new Error(`API Error ${code}: ${response.getContentText()}`);
        }
      } catch (error) {
        if (retries >= maxRetries) {
          throw error;
        }
        Utilities.sleep(CONSTANTS.RETRY_DELAY * Math.pow(2, retries));
        retries++;
      }
    }
    
    throw new Error('Max retries exceeded');
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
    const archives = ChessAPI.getArchives(this.username);
    let gamesProcessed = 0;
    let totalGames = 0;
    
    // Start from checkpoint or beginning
    let startIndex = checkpoint.archiveIndex || 0;
    let gameBuffer = checkpoint.gameBuffer || [];
    
    // Process archives from most recent
    for (let i = archives.length - 1 - startIndex; i >= 0; i--) {
      // Check execution time
      if (this.shouldCheckpoint()) {
        return {
          gamesProcessed,
          totalGames: SheetsManager.getLastGameTimestamp() ? 'Unknown' : totalGames,
          checkpoint: {
            archiveIndex: archives.length - 1 - i,
            gameBuffer,
            lastGameTime
          }
        };
      }
      
      const archive = archives[i];
      const games = ChessAPI.getMonthlyGames(archive);
      
      // Filter games newer than lastGameTime
      const newGames = lastGameTime 
        ? games.filter(game => game.end_time > lastGameTime)
        : games;
      
      if (newGames.length === 0 && lastGameTime) {
        // No new games in this archive, we can stop
        break;
      }
      
      // Process games
      const processedGames = newGames.map(game => GameDataProcessor.processGame(game, this.username));
      gameBuffer = gameBuffer.concat(processedGames);
      
      // Write in batches
      if (gameBuffer.length >= CONSTANTS.BATCH_SIZE) {
        const batch = gameBuffer.splice(0, CONSTANTS.BATCH_SIZE);
        const uniqueGames = SheetsManager.checkDuplicates(batch);
        
        if (uniqueGames.length > 0) {
          SheetsManager.batchWriteGames(uniqueGames);
          CallbackQueueManager.addToQueue(uniqueGames);
          gamesProcessed += uniqueGames.length;
        }
      }
    }
    
    // Write remaining games
    if (gameBuffer.length > 0) {
      const uniqueGames = SheetsManager.checkDuplicates(gameBuffer);
      if (uniqueGames.length > 0) {
        SheetsManager.batchWriteGames(uniqueGames);
        CallbackQueueManager.addToQueue(uniqueGames);
        gamesProcessed += uniqueGames.length;
      }
    }
    
    // Clear checkpoint on completion
    CheckpointManager.clear('fetchGames');
    
    return {
      gamesProcessed,
      totalGames: SheetsManager.getLastGameTimestamp() ? 'Updated' : totalGames,
      checkpoint: {}
    };
  }
  
  /**
   * Processes all historical games
   */
  processHistoricalGames(checkpoint = {}) {
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
        return {
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
      }
      
      const archive = archives[i];
      SheetsManager.log('INFO', 'Historical Fetch', `Processing archive ${i + 1}/${archives.length}: ${archive}`);
      
      const games = ChessAPI.getMonthlyGames(archive);
      
      // Process all games
      const processedGames = games.map(game => GameDataProcessor.processGame(game, this.username));
      gameBuffer = gameBuffer.concat(processedGames);
      
      // Write in batches
      while (gameBuffer.length >= CONSTANTS.BATCH_SIZE) {
        const batch = gameBuffer.splice(0, CONSTANTS.BATCH_SIZE);
        const uniqueGames = SheetsManager.checkDuplicates(batch);
        
        if (uniqueGames.length > 0) {
          SheetsManager.batchWriteGames(uniqueGames);
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
        SheetsManager.batchWriteGames(uniqueGames);
        CallbackQueueManager.addToQueue(uniqueGames);
        gamesProcessed += uniqueGames.length;
      }
    }
    
    // Clear checkpoint on completion
    CheckpointManager.clear('historicalFetch');
    
    return {
      gamesProcessed,
      archivesProcessed,
      totalArchives: archives.length,
      complete: true,
      checkpoint: {}
    };
  }
  
  /**
   * Checks if we should checkpoint due to execution time
   */
  shouldCheckpoint() {
    return (Date.now() - this.startTime) > CONSTANTS.MAX_EXECUTION_TIME;
  }
}
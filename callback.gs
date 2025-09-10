/**
 * Callback API Processing
 * Separate processing for detailed game data with its own checkpoint system
 */

/**
 * Callback Processor - handles callback API requests separately
 */
class CallbackProcessor {
  constructor() {
    this.startTime = Date.now();
    this.processed = 0;
    this.failed = 0;
  }
  
  /**
   * Processes the callback queue
   */
  processQueue(checkpoint = {}) {
    SheetsManager.log('INFO', 'Callback', 'Starting callback queue processing');
    
    // Get pending items
    const pendingItems = CallbackQueueManager.getPending(CONSTANTS.CALLBACK_BATCH_SIZE);
    
    if (pendingItems.length === 0) {
      SheetsManager.log('INFO', 'Callback', 'No pending items in queue');
      return {
        processed: 0,
        failed: 0,
        remaining: 0,
        checkpoint: {}
      };
    }
    
    const updates = [];
    let lastProcessedId = checkpoint.lastProcessedId || null;
    
    // Process each item
    for (const item of pendingItems) {
      // Check execution time
      if (this.shouldCheckpoint()) {
        break;
      }
      
      // Skip if already processed in this run
      if (lastProcessedId && item.gameId === lastProcessedId) {
        continue;
      }
      
      try {
        // Fetch callback data
        const callbackData = this.fetchCallbackData(item);
        
        if (callbackData) {
          // Parse and prepare update
          const update = this.parseCallbackData(callbackData, item);
          updates.push(update);
          
          // Mark as completed
          CallbackQueueManager.markCompleted(item.gameId);
          this.processed++;
          
          SheetsManager.log('INFO', 'Callback', `Processed game ${item.gameId}`);
        }
        
      } catch (error) {
        // Handle error
        this.handleCallbackError(item, error);
        this.failed++;
      }
      
      lastProcessedId = item.gameId;
      
      // Small delay to avoid overwhelming the API
      Utilities.sleep(500);
    }
    
    // Apply updates to sheet
    if (updates.length > 0) {
      SheetsManager.updateCallbackData(updates);
    }
    
    // Get remaining stats
    const stats = CallbackQueueManager.getStats();
    
    return {
      processed: this.processed,
      failed: this.failed,
      remaining: stats.pending,
      checkpoint: {
        lastProcessedId: lastProcessedId
      }
    };
  }
  
  /**
   * Fetches callback data for a game
   */
  fetchCallbackData(queueItem) {
    try {
      const callbackData = ChessAPI.getGameCallback(queueItem.url);
      return callbackData;
    } catch (error) {
      throw new Error(`Failed to fetch callback: ${error.toString()}`);
    }
  }
  
  /**
   * Parses callback data into update format
   */
  parseCallbackData(callbackData, queueItem) {
    const update = {
      url: queueItem.url,
      callback_processed: true,
      callback_timestamp: new Date().toISOString()
    };
    
    // Extract rating changes
    if (callbackData.ratingChange) {
      if (callbackData.ratingChange.white !== undefined) {
        update.white_rating_change_exact = callbackData.ratingChange.white;
      }
      if (callbackData.ratingChange.black !== undefined) {
        update.black_rating_change_exact = callbackData.ratingChange.black;
      }
    }
    
    // Extract accuracies
    if (callbackData.accuracies) {
      if (callbackData.accuracies.white !== undefined) {
        update.white_accuracy = callbackData.accuracies.white;
      }
      if (callbackData.accuracies.black !== undefined) {
        update.black_accuracy = callbackData.accuracies.black;
      }
    }
    
    // Extract pre-game ratings if available
    if (callbackData.players) {
      if (callbackData.players.white && callbackData.players.white.rating) {
        update.white_rating_pregame_callback = callbackData.players.white.rating;
      }
      if (callbackData.players.black && callbackData.players.black.rating) {
        update.black_rating_pregame_callback = callbackData.players.black.rating;
      }
    }
    
    // Extract additional callback data fields
    if (callbackData.game) {
      // Game metadata
      update.callback_game_id = callbackData.game.id || '';
      update.callback_variant = callbackData.game.variant || '';
      update.callback_initial_setup = callbackData.game.initialSetup || '';
      update.callback_fen = callbackData.game.fen || '';
      update.callback_pgn_headers = JSON.stringify(callbackData.game.pgnHeaders || {});
    }
    
    // Extract analysis data if available
    if (callbackData.analysis) {
      update.callback_analysis_depth = callbackData.analysis.depth || '';
      update.callback_best_move = callbackData.analysis.bestMove || '';
      update.callback_evaluation = callbackData.analysis.evaluation || '';
    }
    
    // Extract clock data
    if (callbackData.clocks) {
      update.callback_clocks = JSON.stringify(callbackData.clocks);
    }
    
    // Extract move times if available
    if (callbackData.moveTimes) {
      update.callback_move_times = JSON.stringify(callbackData.moveTimes);
    }
    
    // Store full raw callback data for future reference
    update.callback_raw_data = JSON.stringify(callbackData);
    
    // Determine my pre-game rating and opponent's
    const username = ConfigManager.get('username').toLowerCase();
    
    if (callbackData.players) {
      const isWhite = callbackData.players.white && 
                     callbackData.players.white.username &&
                     callbackData.players.white.username.toLowerCase() === username;
      
      if (isWhite) {
        update.my_rating_pregame_callback = update.white_rating_pregame_callback;
        update.opponent_rating_pregame_callback = update.black_rating_pregame_callback;
      } else {
        update.my_rating_pregame_callback = update.black_rating_pregame_callback;
        update.opponent_rating_pregame_callback = update.white_rating_pregame_callback;
      }
    }
    
    return update;
  }
  
  /**
   * Handles callback errors
   */
  handleCallbackError(item, error) {
    const errorStr = error.toString();
    
    SheetsManager.log('WARNING', 'Callback', 
      `Failed to process game ${item.gameId}: ${errorStr}`, 
      { gameId: item.gameId, url: item.url }
    );
    
    // Update queue item
    CallbackQueueManager.markFailed(item.gameId, errorStr);
    
    // Check if permanent failure
    if (item.attempts >= 2) {
      SheetsManager.log('ERROR', 'Callback', 
        `Game ${item.gameId} permanently failed after ${item.attempts + 1} attempts`
      );
    }
  }
  
  /**
   * Checks if we should checkpoint
   */
  shouldCheckpoint() {
    return (Date.now() - this.startTime) > CONSTANTS.MAX_EXECUTION_TIME;
  }
}

/**
 * Callback utilities
 */
const CallbackUtils = {
  /**
   * Validates callback response
   */
  validateResponse: function(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid callback response format');
    }
    
    // Check for error responses
    if (data.error || data.message) {
      throw new Error(data.error || data.message);
    }
    
    return true;
  },
  
  /**
   * Extracts all available data from callback
   */
  extractAllData: function(callbackData) {
    const extracted = {};
    
    // Rating changes
    if (callbackData.ratingChange) {
      extracted.ratingChanges = callbackData.ratingChange;
    }
    
    // Accuracies
    if (callbackData.accuracies) {
      extracted.accuracies = callbackData.accuracies;
    }
    
    // Players with pre-game data
    if (callbackData.players) {
      extracted.players = callbackData.players;
    }
    
    // Game metadata
    if (callbackData.game) {
      extracted.gameData = callbackData.game;
    }
    
    // Analysis data if available
    if (callbackData.analysis) {
      extracted.analysis = callbackData.analysis;
    }
    
    return extracted;
  }
};
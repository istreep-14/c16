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
    
    // Normalize players structure (white/black or top/bottom)
    let whitePlayer = null;
    let blackPlayer = null;
    if (callbackData.players) {
      // Direct white/black
      if (callbackData.players.white || callbackData.players.black) {
        whitePlayer = callbackData.players.white || null;
        blackPlayer = callbackData.players.black || null;
      }
      // Map from top/bottom by color
      if ((!whitePlayer || !blackPlayer) && (callbackData.players.top || callbackData.players.bottom)) {
        const top = callbackData.players.top || {};
        const bottom = callbackData.players.bottom || {};
        const topColor = (top.color || '').toLowerCase();
        const bottomColor = (bottom.color || '').toLowerCase();
        if (topColor === 'white') whitePlayer = top;
        if (topColor === 'black') blackPlayer = top;
        if (bottomColor === 'white') whitePlayer = bottom;
        if (bottomColor === 'black') blackPlayer = bottom;
      }
    }
    
    // Extract rating changes from either top-level ratingChange or game.ratingChangeWhite/Black
    let ratingChangeWhite;
    let ratingChangeBlack;
    if (callbackData.ratingChange) {
      if (callbackData.ratingChange.white !== undefined) {
        ratingChangeWhite = callbackData.ratingChange.white;
      }
      if (callbackData.ratingChange.black !== undefined) {
        ratingChangeBlack = callbackData.ratingChange.black;
      }
    }
    if (callbackData.game) {
      if (callbackData.game.ratingChangeWhite !== undefined) {
        ratingChangeWhite = callbackData.game.ratingChangeWhite;
        update.game_rating_change_white = callbackData.game.ratingChangeWhite;
      }
      if (callbackData.game.ratingChangeBlack !== undefined) {
        ratingChangeBlack = callbackData.game.ratingChangeBlack;
        update.game_rating_change_black = callbackData.game.ratingChangeBlack;
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
    
    // Extract pre-game ratings if available (normalized)
    if (whitePlayer && whitePlayer.rating !== undefined) {
      update.white_rating_pregame_callback = whitePlayer.rating;
    }
    if (blackPlayer && blackPlayer.rating !== undefined) {
      update.black_rating_pregame_callback = blackPlayer.rating;
    }
    
    // Extract additional callback data fields
    if (callbackData.game) {
      // Game metadata
      update.callback_game_id = callbackData.game.id || '';
    }
    
    // Analysis fields removed
    
    // Clock fields removed
    
    // Move times removed
    
    // Do not store raw callback data
    
    // Determine me vs opponent, compute rating changes and pregame by subtraction, and capture profile fields
    const configUsername = (ConfigManager.get('username') || '').toLowerCase();
    let isWhite = false;
    let myPlayer = null;
    let opponentPlayer = null;
    
    if (whitePlayer && whitePlayer.username && whitePlayer.username.toLowerCase() === configUsername) {
      isWhite = true;
      myPlayer = whitePlayer;
      opponentPlayer = blackPlayer;
    } else if (blackPlayer && blackPlayer.username && blackPlayer.username.toLowerCase() === configUsername) {
      isWhite = false;
      myPlayer = blackPlayer;
      opponentPlayer = whitePlayer;
    } else if (callbackData.players && (callbackData.players.top || callbackData.players.bottom)) {
      const top = callbackData.players.top || {};
      const bottom = callbackData.players.bottom || {};
      if (top.username && top.username.toLowerCase() === configUsername) {
        myPlayer = top;
        opponentPlayer = bottom;
        isWhite = (top.color || '').toLowerCase() === 'white';
      } else if (bottom.username && bottom.username.toLowerCase() === configUsername) {
        myPlayer = bottom;
        opponentPlayer = top;
        isWhite = (bottom.color || '').toLowerCase() === 'white';
      }
    }
    
    // Set my/opponent pregame convenience fields (from "pregame" values captured above)
    if (isWhite) {
      update.my_rating_pregame_callback = update.white_rating_pregame_callback;
      update.opponent_rating_pregame_callback = update.black_rating_pregame_callback;
    } else {
      update.my_rating_pregame_callback = update.black_rating_pregame_callback;
      update.opponent_rating_pregame_callback = update.white_rating_pregame_callback;
    }
    
    // Map rating changes to me/opponent
    if (ratingChangeWhite !== undefined && ratingChangeBlack !== undefined) {
      update.my_rating_change_callback = isWhite ? ratingChangeWhite : ratingChangeBlack;
      update.opponent_rating_change_callback = isWhite ? ratingChangeBlack : ratingChangeWhite;
    }
    
    // Compute pregame by subtraction using player.rating - ratingChange
    const myAfter = myPlayer && typeof myPlayer.rating === 'number' ? myPlayer.rating : null;
    const oppAfter = opponentPlayer && typeof opponentPlayer.rating === 'number' ? opponentPlayer.rating : null;
    const myDelta = (isWhite ? ratingChangeWhite : ratingChangeBlack);
    const oppDelta = (isWhite ? ratingChangeBlack : ratingChangeWhite);
    if (typeof myAfter === 'number' && typeof myDelta === 'number') {
      update.my_pregame_rating = myAfter - myDelta;
    }
    if (typeof oppAfter === 'number' && typeof oppDelta === 'number') {
      update.opponent_pregame_rating = oppAfter - oppDelta;
    }
    
    // Capture profile fields for me and opponent
    const toDate = (epochSeconds) => {
      if (typeof epochSeconds === 'number') return new Date(epochSeconds * 1000);
      return '';
    };
    if (myPlayer) {
      if (myPlayer.countryName !== undefined) update.my_country_name_callback = myPlayer.countryName;
      if (myPlayer.defaultTab !== undefined) update.my_default_tab_callback = myPlayer.defaultTab;
      if (myPlayer.postMoveAction !== undefined) update.my_post_move_action_callback = myPlayer.postMoveAction;
      if (myPlayer.membershipLevel !== undefined) update.my_membership_level_callback = myPlayer.membershipLevel;
      if (myPlayer.membershipCode !== undefined) update.my_membership_code_callback = myPlayer.membershipCode;
      if (myPlayer.memberSince !== undefined) update.my_member_since_callback = toDate(myPlayer.memberSince);
    }
    if (opponentPlayer) {
      if (opponentPlayer.countryName !== undefined) update.opponent_country_name_callback = opponentPlayer.countryName;
      if (opponentPlayer.defaultTab !== undefined) update.opponent_default_tab_callback = opponentPlayer.defaultTab;
      if (opponentPlayer.postMoveAction !== undefined) update.opponent_post_move_action_callback = opponentPlayer.postMoveAction;
      if (opponentPlayer.membershipLevel !== undefined) update.opponent_membership_level_callback = opponentPlayer.membershipLevel;
      if (opponentPlayer.membershipCode !== undefined) update.opponent_membership_code_callback = opponentPlayer.membershipCode;
      if (opponentPlayer.memberSince !== undefined) update.opponent_member_since_callback = toDate(opponentPlayer.memberSince);
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
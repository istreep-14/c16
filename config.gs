/**
 * Configuration and State Management
 * Handles settings, checkpoints, and callback queue
 */

/**
 * Configuration Manager - handles all settings and state
 */
const ConfigManager = {
  /**
   * Gets a configuration value
   */
  get: function(key) {
    const sheet = this.getConfigSheet();
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        const value = data[i][1];
        // Parse JSON values
        if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
          try {
            return JSON.parse(value);
          } catch (e) {
            return value;
          }
        }
        return value;
      }
    }
    return null;
  },
  
  /**
   * Sets a configuration value
   */
  set: function(key, value) {
    const sheet = this.getConfigSheet();
    const data = sheet.getDataRange().getValues();
    
    // Convert objects/arrays to JSON
    const saveValue = (typeof value === 'object' && value !== null) 
      ? JSON.stringify(value) 
      : value;
    
    // Find existing row or add new
    let found = false;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        sheet.getRange(i + 1, 2).setValue(saveValue);
        sheet.getRange(i + 1, 3).setValue(new Date());
        found = true;
        break;
      }
    }
    
    if (!found) {
      sheet.appendRow([key, saveValue, new Date()]);
    }
  },
  
  /**
   * Gets or creates the config sheet
   */
  getConfigSheet: function() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Config');
    
    if (!sheet) {
      sheet = ss.insertSheet('Config');
      sheet.appendRow(['Key', 'Value', 'Last Updated']);
      sheet.getRange(1, 1, 1, 3).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    
    return sheet;
  }
};

/**
 * Checkpoint Manager - handles resumable operations
 */
const CheckpointManager = {
  /**
   * Saves a checkpoint
   */
  save: function(operation, data) {
    const checkpoint = {
      operation: operation,
      data: data,
      timestamp: new Date().toISOString(),
      version: 1
    };
    
    ConfigManager.set(`checkpoint_${operation}`, checkpoint);
  },
  
  /**
   * Loads a checkpoint
   */
  load: function(operation) {
    const checkpoint = ConfigManager.get(`checkpoint_${operation}`);
    return checkpoint ? checkpoint.data : {};
  },
  
  /**
   * Clears a checkpoint
   */
  clear: function(operation) {
    ConfigManager.set(`checkpoint_${operation}`, null);
  }
};

/**
 * Callback Queue Manager - manages games pending callback processing
 */
const CallbackQueueManager = {
  /**
   * Adds games to the callback queue
   */
  addToQueue: function(games) {
    let queue = ConfigManager.get('callbackQueue') || [];
    
    // Add games with metadata
    const items = games.map(game => ({
      url: game.url,
      gameId: this.extractGameId(game.url),
      format: game.time_class,
      isDaily: game.url.includes('/daily/'),
      addedAt: new Date().toISOString(),
      attempts: 0,
      lastAttempt: null,
      status: 'pending'
    }));
    
    // Avoid duplicates
    const existingIds = new Set(queue.map(item => item.gameId));
    const newItems = items.filter(item => !existingIds.has(item.gameId));
    
    queue = queue.concat(newItems);
    ConfigManager.set('callbackQueue', queue);
    
    return newItems.length;
  },
  
  /**
   * Gets pending items from the queue
   */
  getPending: function(limit = 50) {
    const queue = ConfigManager.get('callbackQueue') || [];
    return queue
      .filter(item => item.status === 'pending' && item.attempts < 3)
      .slice(0, limit);
  },
  
  /**
   * Updates an item in the queue
   */
  updateItem: function(gameId, updates) {
    let queue = ConfigManager.get('callbackQueue') || [];
    
    queue = queue.map(item => {
      if (item.gameId === gameId) {
        return Object.assign({}, item, updates, {
          lastAttempt: new Date().toISOString()
        });
      }
      return item;
    });
    
    ConfigManager.set('callbackQueue', queue);
  },
  
  /**
   * Marks an item as completed
   */
  markCompleted: function(gameId) {
    this.updateItem(gameId, {
      status: 'completed',
      completedAt: new Date().toISOString()
    });
  },
  
  /**
   * Marks an item as failed
   */
  markFailed: function(gameId, error) {
    let queue = ConfigManager.get('callbackQueue') || [];
    
    queue = queue.map(item => {
      if (item.gameId === gameId) {
        const attempts = (item.attempts || 0) + 1;
        return Object.assign({}, item, {
          attempts: attempts,
          lastAttempt: new Date().toISOString(),
          lastError: error,
          status: attempts >= 3 ? 'failed' : 'pending'
        });
      }
      return item;
    });
    
    ConfigManager.set('callbackQueue', queue);
  },
  
  /**
   * Gets queue statistics
   */
  getStats: function() {
    const queue = ConfigManager.get('callbackQueue') || [];
    
    return {
      total: queue.length,
      pending: queue.filter(item => item.status === 'pending').length,
      completed: queue.filter(item => item.status === 'completed').length,
      failed: queue.filter(item => item.status === 'failed').length,
      retrying: queue.filter(item => item.status === 'pending' && item.attempts > 0).length
    };
  },
  
  /**
   * Cleans up old completed items
   */
  cleanup: function(daysToKeep = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);
    
    let queue = ConfigManager.get('callbackQueue') || [];
    
    queue = queue.filter(item => {
      if (item.status === 'completed' && item.completedAt) {
        return new Date(item.completedAt) > cutoff;
      }
      return true;
    });
    
    ConfigManager.set('callbackQueue', queue);
  },
  
  /**
   * Extracts game ID from URL
   */
  extractGameId: function(url) {
    const match = url.match(/game\/(live|daily)\/(\d+)/);
    return match ? match[2] : null;
  }
};

/**
 * System Health checker
 */
const SystemHealth = {
  check: function() {
    const health = {
      username: ConfigManager.get('username'),
      lastFetch: ConfigManager.get('lastFetch'),
      lastStatsUpdate: ConfigManager.get('lastStatsUpdate'),
      totalGames: 0,
      callbackQueueSize: 0,
      triggerCount: 0,
      apiStatus: 'Unknown',
      sheetsStatus: 'Unknown'
    };
    
    try {
      // Check games count
      const gamesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Games');
      if (gamesSheet) {
        health.totalGames = Math.max(0, gamesSheet.getLastRow() - 1);
      }
      
      // Check callback queue
      const queueStats = CallbackQueueManager.getStats();
      health.callbackQueueSize = queueStats.pending;
      
      // Check triggers
      health.triggerCount = ScriptApp.getProjectTriggers().length;
      
      // Check Chess.com API
      try {
        const testResponse = UrlFetchApp.fetch('https://api.chess.com/pub/player/hikaru', {
          muteHttpExceptions: true
        });
        health.apiStatus = testResponse.getResponseCode() === 200 ? 'OK' : 'Error';
      } catch (e) {
        health.apiStatus = 'Unreachable';
      }
      
      // Check sheets access
      try {
        SpreadsheetApp.getActiveSpreadsheet().getName();
        health.sheetsStatus = 'OK';
      } catch (e) {
        health.sheetsStatus = 'Error';
      }
      
    } catch (error) {
      Logger.log('Error in health check: ' + error.toString());
    }
    
    return health;
  }
};

/**
 * Constants for the system
 */
const CONSTANTS = {
  BATCH_SIZE: 100,
  CALLBACK_BATCH_SIZE: 50,
  MAX_EXECUTION_TIME: 300000, // 5 minutes in milliseconds
  API_RATE_LIMIT: 300, // requests per hour
  API_RATE_PERIOD: 3600000, // 1 hour in milliseconds
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000, // 2 seconds
  
  // Time formats to classify games
  TIME_CONTROLS: {
    BULLET: [60, 180], // 1-3 minutes
    BLITZ: [180, 600], // 3-10 minutes  
    RAPID: [600, 1800], // 10-30 minutes
    DAILY: [86400, Infinity] // 1+ days
  },
  
  // Variants
  VARIANTS: [
    'chess', 'chess960', 'bughouse', 'crazyhouse', 'threecheck',
    'koth', 'antichess', 'atomic', 'horde', 'racingkings'
  ]
};
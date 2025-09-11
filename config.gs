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
   * Ensures the Callback Queue sheet exists and returns it
   */
  _getSheet: function() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Callback Queue');
    if (!sheet) {
      SheetsManager.createCallbackQueueSheet(ss);
      sheet = ss.getSheetByName('Callback Queue');
    }
    return sheet;
  },
  /**
   * Adds games to the callback queue
   */
  addToQueue: function(games) {
    const sheet = this._getSheet();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const gameIdCol = headers.indexOf('gameId') + 1;
    if (gameIdCol === 0) return 0;
    const lastRow = sheet.getLastRow();
    const existingIds = new Set();
    if (lastRow > 1) {
      const ids = sheet.getRange(2, gameIdCol, lastRow - 1, 1).getValues().map(r => r[0]);
      ids.forEach(id => existingIds.add(id));
    }
    const rowsToAppend = [];
    const nowIso = new Date().toISOString();
    games.forEach(game => {
      const gameId = this.extractGameId(game.url);
      if (!gameId || existingIds.has(gameId)) return;
      const row = [];
      // Maintain header order
      headers.forEach(h => {
        switch (h) {
          case 'gameId': row.push(gameId); break;
          case 'url': row.push(game.url || ''); break;
          case 'format': row.push(game.time_class || ''); break;
          case 'isDaily': row.push(!!(game.url && game.url.includes('/daily/'))); break;
          case 'addedAt': row.push(nowIso); break;
          case 'attempts': row.push(0); break;
          case 'lastAttempt': row.push(''); break;
          case 'status': row.push('pending'); break;
          case 'completedAt': row.push(''); break;
          case 'lastError': row.push(''); break;
          default: row.push('');
        }
      });
      rowsToAppend.push(row);
    });
    if (rowsToAppend.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, headers.length).setValues(rowsToAppend);
    }
    return rowsToAppend.length;
  },
  
  /**
   * Gets pending items from the queue
   */
  getPending: function(limit = 50) {
    const sheet = this._getSheet();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const data = sheet.getRange(2, 1, Math.max(0, sheet.getLastRow() - 1), sheet.getLastColumn()).getValues();
    const items = data.map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
    return items.filter(item => item.status === 'pending' && (item.attempts || 0) < 3).slice(0, limit);
  },
  
  /**
   * Updates an item in the queue
   */
  updateItem: function(gameId, updates) {
    const sheet = this._getSheet();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const gameIdCol = headers.indexOf('gameId') + 1;
    if (gameIdCol === 0) return;
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;
    const ids = sheet.getRange(2, gameIdCol, lastRow - 1, 1).getValues().map(r => r[0]);
    const rowIndex = ids.findIndex(id => id === gameId);
    if (rowIndex === -1) return;
    const row = rowIndex + 2;
    // Update fields
    Object.keys(updates).forEach(key => {
      const col = headers.indexOf(key) + 1;
      if (col > 0) {
        sheet.getRange(row, col).setValue(updates[key]);
      }
    });
    // Always update lastAttempt
    const lastAttemptCol = headers.indexOf('lastAttempt') + 1;
    if (lastAttemptCol > 0) sheet.getRange(row, lastAttemptCol).setValue(new Date().toISOString());
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
    const sheet = this._getSheet();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const gameIdCol = headers.indexOf('gameId') + 1;
    const attemptsCol = headers.indexOf('attempts') + 1;
    const statusCol = headers.indexOf('status') + 1;
    const lastErrorCol = headers.indexOf('lastError') + 1;
    if ([gameIdCol, attemptsCol, statusCol].some(c => c === 0)) return;
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;
    const ids = sheet.getRange(2, gameIdCol, lastRow - 1, 1).getValues().map(r => r[0]);
    const rowIndex = ids.findIndex(id => id === gameId);
    if (rowIndex === -1) return;
    const row = rowIndex + 2;
    const attempts = Number(sheet.getRange(row, attemptsCol).getValue() || 0) + 1;
    sheet.getRange(row, attemptsCol).setValue(attempts);
    if (lastErrorCol > 0) sheet.getRange(row, lastErrorCol).setValue(error || '');
    const status = attempts >= 3 ? 'failed' : 'pending';
    sheet.getRange(row, statusCol).setValue(status);
    const lastAttemptCol = headers.indexOf('lastAttempt') + 1;
    if (lastAttemptCol > 0) sheet.getRange(row, lastAttemptCol).setValue(new Date().toISOString());
  },
  
  /**
   * Gets queue statistics
   */
  getStats: function() {
    const sheet = this._getSheet();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const data = sheet.getRange(2, 1, Math.max(0, sheet.getLastRow() - 1), sheet.getLastColumn()).getValues();
    const statusCol = headers.indexOf('status') + 1;
    const attemptsCol = headers.indexOf('attempts') + 1;
    if (statusCol === 0) return { total: 0, pending: 0, completed: 0, failed: 0, retrying: 0 };
    const statuses = data.map(r => r[statusCol - 1]);
    const attempts = data.map(r => r[attemptsCol - 1] || 0);
    const total = data.length;
    const pending = statuses.filter(s => s === 'pending').length;
    const completed = statuses.filter(s => s === 'completed').length;
    const failed = statuses.filter(s => s === 'failed').length;
    const retrying = statuses.filter((s, i) => s === 'pending' && attempts[i] > 0).length;
    return { total, pending, completed, failed, retrying };
  },
  
  /**
   * Cleans up old completed items
   */
  cleanup: function(daysToKeep = 7) {
    const sheet = this._getSheet();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const completedAtCol = headers.indexOf('completedAt') + 1;
    const statusCol = headers.indexOf('status') + 1;
    if (completedAtCol === 0 || statusCol === 0) return;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);
    for (let row = sheet.getLastRow(); row >= 2; row--) {
      const status = sheet.getRange(row, statusCol).getValue();
      const completedAt = sheet.getRange(row, completedAtCol).getValue();
      if (status === 'completed' && completedAt) {
        const completedDate = new Date(completedAt);
        if (completedDate < cutoff) {
          sheet.deleteRow(row);
        }
      }
    }
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
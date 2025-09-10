/**
 * Chess.com Data Logger - Main Entry Point
 * This file handles menu creation, trigger management, and orchestrates all operations
 */

/**
 * Creates the custom menu when the spreadsheet opens
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Chess.com Logger')
    .addItem('Initial Setup', 'initialSetup')
    .addSeparator()
    .addItem('Fetch New Games', 'fetchNewGames')
    .addItem('Update Player Stats', 'updatePlayerStats')
    .addItem('Update Daily Stats', 'updateDailyStats')
    .addItem('Process Callback Queue', 'processCallbackQueue')
    .addSeparator()
    .addItem('Historical Fetch (All Games)', 'historicalFetch')
    .addItem('Update Sheet Headers', 'updateSheetHeaders')
    .addSeparator()
    .addItem('Setup Triggers', 'setupTriggers')
    .addItem('Remove All Triggers', 'removeAllTriggers')
    .addItem('Check System Health', 'checkSystemHealth')
    .addToUi();
}

/**
 * Initial setup - creates all sheets and prompts for configuration
 */
function initialSetup() {
  try {
    // Create all required sheets
    SheetsManager.createAllSheets();
    
    // Prompt for username if not set
    let username = ConfigManager.get('username');
    if (!username) {
      const ui = SpreadsheetApp.getUi();
      const response = ui.prompt(
        'Setup Chess.com Logger',
        'Enter your Chess.com username:',
        ui.ButtonSet.OK_CANCEL
      );
      
      if (response.getSelectedButton() === ui.Button.OK) {
        username = response.getResponseText().trim();
        ConfigManager.set('username', username);
        ConfigManager.set('setupDate', new Date().toISOString());
        ConfigManager.set('lastFetch', null);
        ConfigManager.set('callbackQueue', []);
        
        ui.alert('Setup Complete', 
          `Username set to: ${username}\n\n` +
          'You can now use the menu to fetch games.',
          ui.ButtonSet.OK);
      }
    } else {
      SpreadsheetApp.getUi().alert('Already Configured', 
        `Current username: ${username}`,
        SpreadsheetApp.getUi().ButtonSet.OK);
    }
  } catch (error) {
    Logger.log('Error in initial setup: ' + error.toString());
    SpreadsheetApp.getUi().alert('Setup Error', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * Fetches new games incrementally
 */
function fetchNewGames() {
  const startTime = new Date();
  const checkpoint = CheckpointManager.load('fetchGames');
  
  try {
    const username = ConfigManager.get('username');
    if (!username) {
      throw new Error('Username not configured. Run Initial Setup first.');
    }
    
    // Get last processed game timestamp
    const lastGameTime = checkpoint.lastGameTime || SheetsManager.getLastGameTimestamp();
    
    // Fetch and process new games
    const processor = new GameProcessor(username);
    const result = processor.processNewGames(lastGameTime, checkpoint);
    
    // Update checkpoint
    CheckpointManager.save('fetchGames', result.checkpoint);
    
    // Update last fetch time
    ConfigManager.set('lastFetch', new Date().toISOString());
    
    // Show results
    const duration = Math.round((new Date() - startTime) / 1000);
    SpreadsheetApp.getUi().alert(
      'Fetch Complete',
      `Processed ${result.gamesProcessed} new games in ${duration} seconds.\n` +
      `Total games in sheet: ${result.totalGames}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    
  } catch (error) {
    Logger.log('Error fetching games: ' + error.toString());
    CheckpointManager.save('fetchGames', checkpoint); // Save checkpoint on error
    SpreadsheetApp.getUi().alert('Fetch Error', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * Updates player statistics from Chess.com API
 */
function updatePlayerStats() {
  try {
    const username = ConfigManager.get('username');
    if (!username) {
      throw new Error('Username not configured. Run Initial Setup first.');
    }
    
    const stats = ChessAPI.getPlayerStats(username);
    const profile = ChessAPI.getPlayerProfile(username);
    
    // Store latest ratings for each format
    const ratings = {};
    const formats = ['chess_bullet', 'chess_blitz', 'chess_rapid', 'chess_daily'];
    
    formats.forEach(format => {
      if (stats[format] && stats[format].last) {
        ratings[format] = stats[format].last.rating;
      }
    });
    
    ConfigManager.set('latestRatings', ratings);
    ConfigManager.set('lastStatsUpdate', new Date().toISOString());
    
    SpreadsheetApp.getUi().alert(
      'Stats Updated',
      `Updated ratings for ${username}:\n` +
      Object.entries(ratings).map(([k, v]) => `${k}: ${v}`).join('\n'),
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    
  } catch (error) {
    Logger.log('Error updating stats: ' + error.toString());
    SpreadsheetApp.getUi().alert('Stats Error', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * Updates daily statistics sheet
 */
function updateDailyStats() {
  try {
    const processor = new DailyStatsProcessor();
    const result = processor.updateDailyStats();
    
    SpreadsheetApp.getUi().alert(
      'Daily Stats Updated',
      `Processed ${result.daysProcessed} days with ${result.totalGames} games.`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    
  } catch (error) {
    Logger.log('Error updating daily stats: ' + error.toString());
    SpreadsheetApp.getUi().alert('Daily Stats Error', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * Processes the callback queue for detailed game data
 */
function processCallbackQueue() {
  const startTime = new Date();
  const checkpoint = CheckpointManager.load('callback');
  
  try {
    const processor = new CallbackProcessor();
    const result = processor.processQueue(checkpoint);
    
    CheckpointManager.save('callback', result.checkpoint);
    
    const duration = Math.round((new Date() - startTime) / 1000);
    SpreadsheetApp.getUi().alert(
      'Callback Processing Complete',
      `Processed ${result.processed} games in ${duration} seconds.\n` +
      `Remaining in queue: ${result.remaining}\n` +
      `Failed: ${result.failed}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    
  } catch (error) {
    Logger.log('Error processing callbacks: ' + error.toString());
    CheckpointManager.save('callback', checkpoint);
    SpreadsheetApp.getUi().alert('Callback Error', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * Performs historical fetch of all games
 */
function historicalFetch() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Historical Fetch',
    'This will fetch ALL historical games. This may take a long time.\n\n' +
    'The process will checkpoint progress and can be resumed if interrupted.\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );
  
  if (response !== ui.Button.YES) return;
  
  const startTime = new Date();
  const checkpoint = CheckpointManager.load('historicalFetch');
  
  try {
    const username = ConfigManager.get('username');
    if (!username) {
      throw new Error('Username not configured. Run Initial Setup first.');
    }
    
    const processor = new GameProcessor(username);
    const result = processor.processHistoricalGames(checkpoint);
    
    CheckpointManager.save('historicalFetch', result.checkpoint);
    
    const duration = Math.round((new Date() - startTime) / 1000);
    ui.alert(
      result.complete ? 'Historical Fetch Complete' : 'Historical Fetch Progress',
      `Processed ${result.gamesProcessed} games in ${duration} seconds.\n` +
      `Archives completed: ${result.archivesProcessed}/${result.totalArchives}\n` +
      (result.complete ? 'All games fetched!' : 'Run again to continue.'),
      ui.ButtonSet.OK
    );
    
  } catch (error) {
    Logger.log('Error in historical fetch: ' + error.toString());
    CheckpointManager.save('historicalFetch', checkpoint);
    ui.alert('Historical Fetch Error', error.toString(), ui.ButtonSet.OK);
  }
}

/**
 * Updates sheet headers for code migration
 */
function updateSheetHeaders() {
  try {
    SheetsManager.updateAllHeaders();
    SpreadsheetApp.getUi().alert(
      'Headers Updated',
      'All sheet headers have been updated to match the current version.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (error) {
    Logger.log('Error updating headers: ' + error.toString());
    SpreadsheetApp.getUi().alert('Header Update Error', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * Sets up automatic triggers
 */
function setupTriggers() {
  try {
    // Remove existing triggers first
    removeAllTriggers();
    
    // Fetch new games every 4 hours
    ScriptApp.newTrigger('fetchNewGames')
      .timeBased()
      .everyHours(4)
      .create();
    
    // Update player stats daily at 6 AM
    ScriptApp.newTrigger('updatePlayerStats')
      .timeBased()
      .atHour(6)
      .everyDays(1)
      .create();
    
    // Update daily stats at 11:50 PM, 11:55 PM, and 12:00 AM
    [23, 23, 0].forEach((hour, index) => {
      const minute = index === 0 ? 50 : (index === 1 ? 55 : 0);
      ScriptApp.newTrigger('updateDailyStats')
        .timeBased()
        .atHour(hour)
        .nearMinute(minute)
        .everyDays(1)
        .create();
    });
    
    // Process callback queue every 6 hours
    ScriptApp.newTrigger('processCallbackQueue')
      .timeBased()
      .everyHours(6)
      .create();
    
    SpreadsheetApp.getUi().alert(
      'Triggers Created',
      'Automatic triggers have been set up:\n' +
      '- Fetch games: Every 4 hours\n' +
      '- Update stats: Daily at 6 AM\n' +
      '- Daily stats: 11:50 PM, 11:55 PM, 12:00 AM\n' +
      '- Callback queue: Every 6 hours',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    
  } catch (error) {
    Logger.log('Error setting up triggers: ' + error.toString());
    SpreadsheetApp.getUi().alert('Trigger Setup Error', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * Removes all project triggers
 */
function removeAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
}

/**
 * Checks system health and shows status
 */
function checkSystemHealth() {
  try {
    const health = SystemHealth.check();
    
    SpreadsheetApp.getUi().alert(
      'System Health Check',
      `Username: ${health.username || 'Not configured'}\n` +
      `Last fetch: ${health.lastFetch || 'Never'}\n` +
      `Total games: ${health.totalGames}\n` +
      `Callback queue: ${health.callbackQueueSize} games\n` +
      `Active triggers: ${health.triggerCount}\n` +
      `Chess.com API: ${health.apiStatus}\n` +
      `Sheets access: ${health.sheetsStatus}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    
  } catch (error) {
    Logger.log('Error checking health: ' + error.toString());
    SpreadsheetApp.getUi().alert('Health Check Error', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}
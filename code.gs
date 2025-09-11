/**
 * Chess.com Data Logger - Main Entry Point
 * Handles menu creation, trigger management, and orchestrates operations
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
    .addSeparator()
    .addItem('Build Dates Sheet (Full)', 'buildDatesSheet')
    .addItem('Update Dates (Incremental)', 'updateDatesIncremental')
    .addSeparator()
    .addItem('Build Daily Stats (Full)', 'buildDailyStatsFull')
    .addItem('Update Daily Stats', 'updateDailyStats')
    .addSeparator()
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
    SheetsManager.createAllSheets();
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
          'Username set to: ' + username + '\n\nYou can now use the menu to fetch games.',
          ui.ButtonSet.OK);
      }
    } else {
      SpreadsheetApp.getUi().alert('Already Configured', 'Current username: ' + username, SpreadsheetApp.getUi().ButtonSet.OK);
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
    const lastGameTime = checkpoint.lastGameTime || SheetsManager.getLastGameTimestamp();
    const processor = new GameProcessor(username);
    const result = processor.processNewGames(lastGameTime, checkpoint);
    CheckpointManager.save('fetchGames', result.checkpoint);
    ConfigManager.set('lastFetch', new Date().toISOString());
    // After writing games, update Dates and Daily Stats for the affected range
    try {
      if (result && typeof result.earliestNewGameEpoch === 'number' && result.earliestNewGameEpoch > 0) {
        DatesManager.updateRange(result.earliestNewGameEpoch);
        const dsp = new DailyStatsProcessor();
        dsp.updateDailyStats(result.earliestNewGameEpoch);
        // Advance incremental cursors to latest available
        const latest = SheetsManager.getLastGameTimestamp();
        if (latest) {
          ConfigManager.set('lastDatesEpoch', latest);
          ConfigManager.set('lastDailyStatsEpoch', latest);
        }
      }
    } catch (e) {
      try { SheetsManager.log('WARNING', 'PostFetch', 'Incremental Dates/DailyStats failed', { error: e && e.toString ? e.toString() : 'error' }); } catch (er) {}
    }
    const duration = Math.round((new Date() - startTime) / 1000);
    SpreadsheetApp.getUi().alert(
      'Fetch Complete',
      'Processed ' + result.gamesProcessed + ' new games in ' + duration + ' seconds.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (error) {
    Logger.log('Error fetching games: ' + error.toString());
    CheckpointManager.save('fetchGames', checkpoint);
    SpreadsheetApp.getUi().alert('Fetch Error', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * Updates Dates incrementally from lastDatesEpoch to today
 */
function updateDatesIncremental() {
  try {
    const start = ConfigManager.get('lastDatesEpoch') || 0;
    const res = DatesManager.updateRange(start);
    const latest = SheetsManager.getLastGameTimestamp();
    if (latest) ConfigManager.set('lastDatesEpoch', latest);
    SpreadsheetApp.getUi().alert(
      'Dates Updated',
      'Updated ' + (res && res.days != null ? res.days : 0) + ' day(s).',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (error) {
    Logger.log('Error updating Dates: ' + error.toString());
    SpreadsheetApp.getUi().alert('Dates Error', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
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
    SheetsManager.appendPlayerStats(profile, stats);
    SheetsManager.appendRatingsFromPlayerStats(stats);
    const ratings = {};
    const formats = ['chess_bullet', 'chess_blitz', 'chess_rapid', 'chess_daily'];
    formats.forEach(format => { if (stats[format] && stats[format].last) ratings[format] = stats[format].last.rating; });
    ConfigManager.set('latestRatings', ratings);
    ConfigManager.set('lastStatsUpdate', new Date().toISOString());
    SpreadsheetApp.getUi().alert(
      'Stats Updated',
      'Updated ratings for ' + username + ':\n' + Object.entries(ratings).map(function(e){return e[0]+': '+e[1];}).join('\n') + '\n\nData appended to Player Stats.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (error) {
    Logger.log('Error updating stats: ' + error.toString());
    SpreadsheetApp.getUi().alert('Stats Error', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * Updates daily statistics incrementally from lastDailyStatsEpoch
 */
function updateDailyStats() {
  try {
    const dsp = new DailyStatsProcessor();
    const start = ConfigManager.get('lastDailyStatsEpoch') || 0;
    const result = dsp.updateDailyStats(start);
    const latest = SheetsManager.getLastGameTimestamp();
    if (latest) ConfigManager.set('lastDailyStatsEpoch', latest);
    SpreadsheetApp.getUi().alert(
      'Daily Stats Updated',
      'Processed ' + result.daysProcessed + ' days (incremental).',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (error) {
    Logger.log('Error updating daily stats: ' + error.toString());
    SpreadsheetApp.getUi().alert('Daily Stats Error', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * Builds daily statistics fully (one-time or rebuild)
 */
function buildDailyStatsFull() {
  try {
    const dsp = new DailyStatsProcessor();
    const result = dsp.updateDailyStats(null);
    const latest = SheetsManager.getLastGameTimestamp();
    if (latest) ConfigManager.set('lastDailyStatsEpoch', latest);
    SpreadsheetApp.getUi().alert(
      'Daily Stats Built (Full)',
      'Processed ' + result.daysProcessed + ' days (full).',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (error) {
    Logger.log('Error building daily stats: ' + error.toString());
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
      'Processed ' + result.processed + ' games in ' + duration + ' seconds.\nRemaining in queue: ' + result.remaining + '\nFailed: ' + result.failed,
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
    'This will fetch ALL historical games. This may take a long time.\n\nThe process will checkpoint and can be resumed if interrupted.\n\nContinue?',
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
    // Apply fast-mode settings for historical import
    const prevMinimal = ConfigManager.get('minimalMode');
    const prevStorePGN = ConfigManager.get('storePGN');
    const prevStoreMoves = ConfigManager.get('storeDetailedMoves');
    const prevBatchSize = ConfigManager.get('batchSize');
    const prevQueueCallbacks = ConfigManager.get('queueCallbacksDuringHistorical');
    try {
      ConfigManager.set('minimalMode', true);
      ConfigManager.set('storePGN', false);
      ConfigManager.set('storeDetailedMoves', false);
      ConfigManager.set('batchSize', Math.max(CONSTANTS.BATCH_SIZE, 300));
      ConfigManager.set('queueCallbacksDuringHistorical', false);
    } catch (e) {}
    const processor = new GameProcessor(username);
    const result = processor.processHistoricalGames(checkpoint);
    CheckpointManager.save('historicalFetch', result.checkpoint);
    const duration = Math.round((new Date() - startTime) / 1000);
    ui.alert(
      result.complete ? 'Historical Fetch Complete' : 'Historical Fetch Progress',
      'Processed ' + result.gamesProcessed + ' games in ' + duration + ' seconds.\n' +
      'Archives completed: ' + result.archivesProcessed + '/' + result.totalArchives + '\n' +
      (result.complete ? 'All games fetched!' : 'Run again to continue.'),
      ui.ButtonSet.OK
    );
    // Restore previous settings
    try {
      ConfigManager.set('minimalMode', prevMinimal);
      ConfigManager.set('storePGN', prevStorePGN);
      ConfigManager.set('storeDetailedMoves', prevStoreMoves);
      ConfigManager.set('batchSize', prevBatchSize);
      ConfigManager.set('queueCallbacksDuringHistorical', prevQueueCallbacks);
    } catch (e) {}
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
    removeAllTriggers();
    // Fetch new games every 4 hours
    ScriptApp.newTrigger('fetchNewGames').timeBased().everyHours(4).create();
    // Update player stats daily at 6 AM
    ScriptApp.newTrigger('updatePlayerStats').timeBased().atHour(6).everyDays(1).create();
    // Update Dates incrementally daily at 11:55 PM
    ScriptApp.newTrigger('updateDatesIncremental').timeBased().atHour(23).nearMinute(55).everyDays(1).create();
    // Update Daily Stats daily at 12:05 AM (captures previous day)
    ScriptApp.newTrigger('updateDailyStats').timeBased().atHour(0).nearMinute(5).everyDays(1).create();
    SpreadsheetApp.getUi().alert(
      'Triggers Created',
      'Automatic triggers have been set up.',
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
  triggers.forEach(function(trigger){ ScriptApp.deleteTrigger(trigger); });
}

/**
 * Checks system health and shows status
 */
function checkSystemHealth() {
  try {
    const health = SystemHealth.check();
    SpreadsheetApp.getUi().alert(
      'System Health Check',
      'Username: ' + (health.username || 'Not configured') + '\n' +
      'Last fetch: ' + (health.lastFetch || 'Never') + '\n' +
      'Total games: ' + health.totalGames + '\n' +
      'Callback queue: ' + health.callbackQueueSize + ' games\n' +
      'Active triggers: ' + health.triggerCount + '\n' +
      'Chess.com API: ' + health.apiStatus + '\n' +
      'Sheets access: ' + health.sheetsStatus,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (error) {
    Logger.log('Error checking health: ' + error.toString());
    SpreadsheetApp.getUi().alert('Health Check Error', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}


/**
 * Entry points: menu and triggers
 */

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Chess.com Logger')
    .addItem('Initial Setup', 'initialSetup')
    .addSeparator()
    .addItem('Fetch New Games', 'jobFetch')
    .addItem('Process Work Queue', 'jobDeriveWorker')
    .addItem('Build/Update Daily Stats', 'jobBuildDailyStatsIncremental')
    .addSeparator()
    .addItem('Setup Triggers', 'setupTriggers')
    .addItem('Remove All Triggers', 'removeAllTriggers')
    .addToUi();
}

function initialSetup() {
  HeaderRepo.ensureLogsSheet();
  HeaderRepo.ensureQueueSheet();
  HeaderRepo.ensureGamesSheet();
  HeaderRepo.ensureDailyStatsSheet();
  var ui = SpreadsheetApp.getUi();
  var username = ConfigRepo.get('username');
  if (!username) {
    var resp = ui.prompt('Setup Chess.com Logger', 'Enter your Chess.com username:', ui.ButtonSet.OK_CANCEL);
    if (resp.getSelectedButton() === ui.Button.OK) {
      username = resp.getResponseText().trim();
      ConfigRepo.set('username', username);
      ui.alert('Setup Complete', 'Username set: ' + username, ui.ButtonSet.OK);
    }
  } else {
    ui.alert('Already Configured', 'Current username: ' + username, ui.ButtonSet.OK);
  }
}

function setupTriggers() {
  removeAllTriggers();
  ScriptApp.newTrigger('jobFetch').timeBased().everyHours(4).create();
  ScriptApp.newTrigger('jobDeriveWorker').timeBased().everyMinutes(15).create();
  ScriptApp.newTrigger('jobBuildDailyStatsIncremental').timeBased().everyHours(6).create();
}

function removeAllTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t){ ScriptApp.deleteTrigger(t); });
}


// Scheduler: install time-based triggers

function installTriggers() {
  resetTriggers_();
  ScriptApp.newTrigger('fetchNewGamesAndEnqueueCallbacks').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('processCallbacksBatch').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('updateDailyStatsAndSeal').timeBased().atHour(3).everyDays(1).create();
}

function resetTriggers_() {
  const names = new Set([
    'fetchNewGamesAndEnqueueCallbacks',
    'processCallbacksBatch',
    'updateDailyStatsAndSeal'
  ]);
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) {
    if (names.has(t.getHandlerFunction())) {
      ScriptApp.deleteTrigger(t);
    }
  }
}
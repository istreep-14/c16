// Project setup: create sheets, folders, and defaults

function setupProject() {
  const username = getScriptProperty('username');
  const spreadsheetId = getScriptProperty('spreadsheetId');
  if (!username) throw new Error('Set script property "username" first.');
  if (!spreadsheetId) throw new Error('Set script property "spreadsheetId" first.');

  setupSheets_();
  getOrCreateFolderByPath(DRIVE_FOLDERS.ARCHIVES_JSON);
  getOrCreateFolderByPath(DRIVE_FOLDERS.ARCHIVES_PGN);

  if (!getScriptProperty('schema_version')) setScriptProperty('schema_version', '1');
}
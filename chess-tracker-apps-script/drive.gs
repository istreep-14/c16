// Drive helpers for monthly blobs

function getOrCreateFolderByPath(path) {
  const parts = path.split('/');
  let folder = DriveApp.getRootFolder();
  for (const name of parts) {
    let it = folder.getFoldersByName(name);
    folder = it.hasNext() ? it.next() : folder.createFolder(name);
  }
  return folder;
}

function saveMonthlyJson(username, yearMonth, jsonText) {
  const folder = getOrCreateFolderByPath(DRIVE_FOLDERS.ARCHIVES_JSON);
  const name = `${username}_${yearMonth}.json`;
  const blob = Utilities.newBlob(jsonText, 'application/json', name);
  const file = folder.createFile(blob);
  return file.getId();
}

function saveMonthlyPgn(username, yearMonth, pgnText) {
  const folder = getOrCreateFolderByPath(DRIVE_FOLDERS.ARCHIVES_PGN);
  const name = `${username}_${yearMonth}.pgn`;
  const blob = Utilities.newBlob(pgnText, 'text/plain', name);
  const file = folder.createFile(blob);
  return file.getId();
}

function readFileAsString(fileId) {
  return DriveApp.getFileById(fileId).getBlob().getDataAsString();
}
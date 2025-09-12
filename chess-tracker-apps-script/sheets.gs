// Sheets helpers: spreadsheet access, headers, and batch ops

function getSpreadsheetId_() {
  const id = getScriptProperty('spreadsheetId');
  if (!id) throw new Error('Missing script property: spreadsheetId');
  return id;
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(getSpreadsheetId_());
}

function getOrCreateSheet_(name, headers) {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  ensureHeaders_(sheet, headers);
  return sheet;
}

function ensureHeaders_(sheet, headers) {
  const range = sheet.getRange(1, 1, 1, headers.length);
  const values = range.getValues();
  const current = values[0];
  let mismatch = current.length !== headers.length;
  for (let i = 0; i < headers.length && !mismatch; i++) {
    if (current[i] !== headers[i]) mismatch = true;
  }
  if (mismatch) {
    range.setValues([headers]);
  }
}

function setupSheets_() {
  getOrCreateSheet_(SHEET_NAMES.GAMES, GAMES_HEADERS);
  getOrCreateSheet_(SHEET_NAMES.GAMEMETA, GAMEMETA_HEADERS);
  getOrCreateSheet_(SHEET_NAMES.DAILYSTATS, DAILYSTATS_HEADERS);
  getOrCreateSheet_(SHEET_NAMES.ARCHIVES, ARCHIVES_HEADERS);
  getOrCreateSheet_(SHEET_NAMES.ERRORS, ERRORS_HEADERS);
}

function readColumnValues_(sheetName, columnIndexOneBased) {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const range = sheet.getRange(2, columnIndexOneBased, lastRow - 1, 1);
  return range.getValues().map(r => r[0]).filter(v => v !== '' && v != null);
}

function readColumnAsSet_(sheetName, columnIndexOneBased) {
  const set = new Set();
  for (const v of readColumnValues_(sheetName, columnIndexOneBased)) set.add(String(v));
  return set;
}

function insertRowsAtTop_(sheetName, rows) {
  if (!rows || rows.length === 0) return;
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error(`Sheet not found: ${sheetName}`);
  sheet.insertRows(2, rows.length);
  const range = sheet.getRange(2, 1, rows.length, rows[0].length);
  range.setValues(rows);
}

function findRowIndexByValue_(sheetName, headerName, value) {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return -1;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const colIndex = headers.indexOf(headerName) + 1;
  if (colIndex <= 0) return -1;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const values = sheet.getRange(2, colIndex, lastRow - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(value)) return i + 2;
  }
  return -1;
}

function upsertArchivesRow_(rowObj) {
  const sheetName = SHEET_NAMES.ARCHIVES;
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(sheetName);
  const headers = ARCHIVES_HEADERS;
  const rowIdx = findRowIndexByValue_(sheetName, 'archive_month', rowObj.archive_month);
  const rowData = headers.map(h => rowObj[h] == null ? '' : rowObj[h]);
  if (rowIdx === -1) {
    insertRowsAtTop_(sheetName, [rowData]);
  } else {
    const range = sheet.getRange(rowIdx, 1, 1, headers.length);
    range.setValues([rowData]);
  }
}
// Callbacks processor (stub)

function processCallbacksBatch() {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(SHEET_NAMES.GAMEMETA);
  if (!sheet) return;
  const headers = GAMEMETA_HEADERS;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const range = sheet.getRange(2, 1, lastRow - 1, headers.length);
  const rows = range.getValues();
  const statusIdx = headers.indexOf('callback_status');
  const gameIdIdx = headers.indexOf('game_id');
  const updated = [];
  let count = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row[statusIdx] === 'pending') {
      // Placeholder: perform enrichment here, persist JSON to Drive if needed
      row[statusIdx] = 'done';
      rows[i] = row;
      updated.push(i);
      count++;
      if (count >= 100) break; // process up to 100 per run
    }
  }
  if (updated.length > 0) {
    range.setValues(rows);
  }
}
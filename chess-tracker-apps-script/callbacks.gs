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
  const updatedIsoIdx = headers.indexOf('last_updated_iso');
  const headerIndex = {}; headers.forEach((h, i) => headerIndex[h] = i);
  const updated = [];
  let count = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row[statusIdx] === 'pending') {
      // Placeholder: perform enrichment here, persist JSON to Drive if needed
      // Example: set fields by header name if present
      // setMetaFieldsForRow_(row, headerIndex, { my_custom_field: 'value' });
      row[statusIdx] = 'done';
      if (updatedIsoIdx >= 0) row[updatedIsoIdx] = getIsoNow();
      rows[i] = row;
      updated.push(i);
      count++;
      if (count >= 100) break; // process up to 100 per run
    }
  }
  if (updated.length > 0) {
    range.setValues(rows);
    // Keep newest updates first
    sortSheetByHeaderDesc_(SHEET_NAMES.GAMEMETA, 'last_updated_iso');
  }
}

function setMetaFieldsForRow_(row, headerIndex, fields) {
  if (!fields) return row;
  for (const key in fields) {
    if (!fields.hasOwnProperty(key)) continue;
    const idx = headerIndex[key];
    if (idx != null && idx >= 0) {
      row[idx] = fields[key];
    }
  }
  return row;
}
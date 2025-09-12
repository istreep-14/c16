// Daily stats aggregation (minimal)

function updateDailyStatsAndSeal() {
  const ss = getSpreadsheet_();
  const gamesSheet = ss.getSheetByName(SHEET_NAMES.GAMES);
  if (!gamesSheet) return;
  const lastRow = gamesSheet.getLastRow();
  if (lastRow < 2) return;

  const headers = GAMES_HEADERS;
  const hIndex = {};
  headers.forEach((h, i) => hIndex[h] = i);

  const values = gamesSheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const yesterday = new Date(today.getTime() - 24 * 3600 * 1000);
  const targetDays = new Set([today.toISOString().slice(0, 10), yesterday.toISOString().slice(0, 10)]);

  const agg = new Map(); // key: date|format -> {time_class->counts}

  for (const row of values) {
    const dateKey = row[hIndex['date_key']];
    if (!targetDays.has(dateKey)) continue;
    const format = row[hIndex['format']] || '';
    const timeClass = row[hIndex['time_class']] || '';
    const result = String(row[hIndex['result']] || '');
    const key = `${dateKey}|${format}|${timeClass}`;
    if (!agg.has(key)) agg.set(key, {gp: 0, w: 0, l: 0, d: 0});
    const a = agg.get(key);
    a.gp++;
    if (result === 'win') a.w++; else if (result === 'draw') a.d++; else a.l++;
  }

  const dsSheet = ss.getSheetByName(SHEET_NAMES.DAILYSTATS);
  const dsHeaders = DAILYSTATS_HEADERS;
  for (const [key, a] of agg.entries()) {
    const [dateKey, format, timeClass] = key.split('|');
    // Find row by composite (date_key + format + time_class). We use date_key to find, then override.
    const rowIdx = findRowIndexByValue_(SHEET_NAMES.DAILYSTATS, 'date_key', dateKey);
    const row = [dateKey, format, timeClass, a.gp, a.w, a.l, a.d, '', '', '', '', getIsoNow()];
    if (rowIdx === -1) {
      insertRowsAtTop_(SHEET_NAMES.DAILYSTATS, [row]);
    } else {
      const range = dsSheet.getRange(rowIdx, 1, 1, dsHeaders.length);
      range.setValues([row]);
    }
  }
}
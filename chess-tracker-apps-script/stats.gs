// Daily stats aggregation (minimal)

function updateDailyStatsAndSeal() {
  const ss = getSpreadsheet_();
  const gamesSheet = ss.getSheetByName(SHEET_NAMES.GAMES);
  if (!gamesSheet) return;
  const lastRow = gamesSheet.getLastRow();
  if (lastRow < 2) return;

  const headers = GAMES_HEADERS;
  const dateIdx = headers.indexOf('date_key') + 1;
  const timeClassIdx = headers.indexOf('time_class') + 1;
  const resultIdx = headers.indexOf('result') + 1;

  const values = gamesSheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

  const targetDays = new Set();
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const yesterday = new Date(today.getTime() - 24 * 3600 * 1000);
  targetDays.add(today.toISOString().slice(0, 10));
  targetDays.add(yesterday.toISOString().slice(0, 10));

  const agg = new Map(); // key: date_key|time_class -> {gp,w,l,d}

  for (const row of values) {
    const dateKey = row[dateIdx - 1];
    if (!targetDays.has(dateKey)) continue;
    const timeClass = row[timeClassIdx - 1] || '';
    const result = String(row[resultIdx - 1] || '');
    const key = `${dateKey}|${timeClass}`;
    if (!agg.has(key)) agg.set(key, {gp: 0, w: 0, l: 0, d: 0});
    const a = agg.get(key);
    a.gp++;
    if (result === 'win') a.w++; else if (result === 'draw') a.d++; else a.l++;
  }

  const dsSheet = ss.getSheetByName(SHEET_NAMES.DAILYSTATS);
  const dsHeaders = DAILYSTATS_HEADERS;
  for (const [key, a] of agg.entries()) {
    const [dateKey, timeClass] = key.split('|');
    const rowIdx = findRowIndexByValue_(SHEET_NAMES.DAILYSTATS, 'date_key', dateKey);
    const row = [dateKey, timeClass, a.gp, a.w, a.l, a.d, '', '', '', '', getIsoNow()];
    if (rowIdx === -1) {
      insertRowsAtTop_(SHEET_NAMES.DAILYSTATS, [row]);
    } else {
      const range = dsSheet.getRange(rowIdx, 1, 1, dsHeaders.length);
      range.setValues([row]);
    }
  }
}
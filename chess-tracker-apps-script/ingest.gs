// Ingestion: fetch new games and enqueue callbacks

function fetchNewGamesAndEnqueueCallbacks() {
  return withLock(() => {
    const username = getScriptProperty('username');
    if (!username) throw new Error('Missing script property: username');

    // Determine months to check: current and possibly previous
    const currentYm = getCurrentYearMonth();
    const archivesIndex = fetchArchivesIndex_(username);
    const months = [];
    for (let i = archivesIndex.length - 1; i >= 0 && months.length < 2; i--) {
      const ym = ymFromArchiveUrl_(archivesIndex[i]);
      if (ym) months.push(ym);
    }

    // Build known game_id set
    const knownIds = readColumnAsSet_(SHEET_NAMES.GAMES, 1); // game_id

    const newGameRowsByMonth = {};
    const monthlyGamesRaw = {};
    const etagByMonth = {};

    // Ensure Archives sheet exists
    setupSheets_();

    // Load Archives sheet data into a map (archive_month -> row index and existing data)
    const ss = getSpreadsheet_();
    const archivesSheet = ss.getSheetByName(SHEET_NAMES.ARCHIVES);
    const lastRow = archivesSheet.getLastRow();
    const headers = ARCHIVES_HEADERS;
    const headerIndex = {};
    headers.forEach((h, i) => headerIndex[h] = i);
    const archivesMap = {};
    if (lastRow >= 2) {
      const values = archivesSheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
      for (let i = 0; i < values.length; i++) {
        const row = values[i];
        const ym = row[0];
        if (ym) archivesMap[ym] = {rowIndex: i + 2, row};
      }
    }

    // Fetch and diff per month
    for (const ym of months) {
      const existing = archivesMap[ym];
      const prevEtag = existing ? existing.row[headerIndex['etag']] : '';
      const fetched = fetchArchiveMonth_(username, ym, prevEtag);
      if (fetched.unchanged) {
        // Update last_checked_iso
        upsertArchivesRow_({
          archive_month: ym,
          status: monthIsFrozen_(ym) ? 'frozen' : 'open',
          json_file_id: existing ? existing.row[headerIndex['json_file_id']] : '',
          pgn_file_id: existing ? existing.row[headerIndex['pgn_file_id']] : '',
          etag: prevEtag || '',
          total_games: existing ? existing.row[headerIndex['total_games']] : '',
          last_checked_iso: getIsoNow()
        });
        continue;
      }
      etagByMonth[ym] = fetched.etag || '';
      monthlyGamesRaw[ym] = fetched.games;
      const parsedRows = parseGamesForUser_(username, ym, fetched.games)
        .filter(r => !knownIds.has(String(r[0])));
      if (parsedRows.length > 0) newGameRowsByMonth[ym] = parsedRows;
    }

    // Save monthly PGN files and upsert Archives, prepare pgn_file_id for new rows
    const gamesRowsToInsert = [];
    const metaRowsToInsert = [];
    const pgnIdx = GAMES_HEADERS.indexOf('pgn_file_id');

    for (const ym of Object.keys(newGameRowsByMonth)) {
      const gamesRaw = monthlyGamesRaw[ym] || [];
      const pgnText = buildMonthlyPgn_(gamesRaw);
      const pgnFileId = pgnText ? saveMonthlyPgn(username, ym, pgnText) : '';

      // Optionally save JSON as well
      const jsonText = JSON.stringify({games: gamesRaw});
      const jsonFileId = saveMonthlyJson(username, ym, jsonText);

      const parsedRows = newGameRowsByMonth[ym].map(row => {
        const copy = row.slice();
        if (pgnIdx >= 0) copy[pgnIdx] = pgnFileId; // pgn_file_id
        return copy;
      });

      gamesRowsToInsert.push(...parsedRows);

      // One meta row per game (pad to header length)
      const metaHeaders = GAMEMETA_HEADERS;
      const gidIdx = metaHeaders.indexOf('game_id');
      const statusIdx = metaHeaders.indexOf('callback_status');
      const fileIdx = metaHeaders.indexOf('callback_file_id');
      const errIdx = metaHeaders.indexOf('callback_error');
      const updIdx = metaHeaders.indexOf('last_updated_iso');

      for (const row of parsedRows) {
        const gid = row[0];
        const metaRow = new Array(metaHeaders.length).fill('');
        if (gidIdx >= 0) metaRow[gidIdx] = gid;
        if (statusIdx >= 0) metaRow[statusIdx] = 'pending';
        if (fileIdx >= 0) metaRow[fileIdx] = '';
        if (errIdx >= 0) metaRow[errIdx] = '';
        if (updIdx >= 0) metaRow[updIdx] = getIsoNow();
        metaRowsToInsert.push(metaRow);
      }

      upsertArchivesRow_({
        archive_month: ym,
        status: monthIsFrozen_(ym) ? 'frozen' : 'open',
        json_file_id: jsonFileId,
        pgn_file_id: pgnFileId,
        etag: etagByMonth[ym] || '',
        total_games: (monthlyGamesRaw[ym] || []).length,
        last_checked_iso: getIsoNow()
      });
    }

    // Insert new rows at top
    if (gamesRowsToInsert.length > 0) {
      insertRowsAtTop_(SHEET_NAMES.GAMES, gamesRowsToInsert);
    }
    if (metaRowsToInsert.length > 0) {
      insertRowsAtTop_(SHEET_NAMES.GAMEMETA, metaRowsToInsert);
    }
  });
}

function monthIsFrozen_(ym) {
  // Frozen if year-month is strictly before current year-month
  const cur = getCurrentYearMonth();
  return ym < cur;
}
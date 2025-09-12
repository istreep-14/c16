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

      // Save JSON as well
      const jsonText = JSON.stringify({games: gamesRaw});
      const jsonFileId = saveMonthlyJson(username, ym, jsonText);

      const parsedRows = newGameRowsByMonth[ym].map(row => {
        const copy = row.slice();
        if (pgnIdx >= 0) copy[pgnIdx] = pgnFileId; // pgn_file_id
        return copy;
      });

      gamesRowsToInsert.push(...parsedRows);

      // Prefill GameMeta from JSON/PGN when available
      const metaHeaders = GAMEMETA_HEADERS;
      const idx = {};
      metaHeaders.forEach((h, i) => idx[h] = i);

      for (const game of gamesRaw) {
        const url = game.url || '';
        // Only add meta rows for newly parsed game rows
        const hasRow = parsedRows.find(r => r[0] === url);
        if (!hasRow) continue;
        const metaRow = new Array(metaHeaders.length).fill('');
        if (idx['game_id'] >= 0) metaRow[idx['game_id']] = url;
        if (idx['callback_status'] >= 0) metaRow[idx['callback_status']] = 'pending';
        if (idx['last_updated_iso'] >= 0) metaRow[idx['last_updated_iso']] = getIsoNow();
        // JSON-derived where present
        if (idx['uuid'] >= 0 && game.uuid) metaRow[idx['uuid']] = game.uuid;
        if (idx['fen'] >= 0 && game.fen) metaRow[idx['fen']] = game.fen;
        if (idx['initial_setup'] >= 0 && game.initial_setup) metaRow[idx['initial_setup']] = game.initial_setup;
        if (idx['tcn'] >= 0 && game.tcn) metaRow[idx['tcn']] = game.tcn;
        if (idx['tournament'] >= 0 && game.tournament) metaRow[idx['tournament']] = game.tournament;
        if (idx['match'] >= 0 && game.match) metaRow[idx['match']] = game.match;
        if (idx['white_username'] >= 0 && game.white && game.white.username) metaRow[idx['white_username']] = game.white.username;
        if (idx['black_username'] >= 0 && game.black && game.black.username) metaRow[idx['black_username']] = game.black.username;
        if (idx['white_result'] >= 0 && game.white && game.white.result) metaRow[idx['white_result']] = game.white.result;
        if (idx['black_result'] >= 0 && game.black && game.black.result) metaRow[idx['black_result']] = game.black.result;
        if (idx['white_accuracy'] >= 0 && game.accuracies && game.accuracies.white != null) metaRow[idx['white_accuracy']] = game.accuracies.white;
        if (idx['black_accuracy'] >= 0 && game.accuracies && game.accuracies.black != null) metaRow[idx['black_accuracy']] = game.accuracies.black;

        // PGN-derived: only parse one game's PGN if embedded; monthly PGN concatenation is stored separately
        if (game.pgn) {
          const h = parsePgnHeaders_(game.pgn);
          if (idx['eco'] >= 0 && h.eco) metaRow[idx['eco']] = h.eco;
          if (idx['eco_url'] >= 0 && h.eco_url) metaRow[idx['eco_url']] = h.eco_url;
          if (idx['opening'] >= 0 && h.opening) metaRow[idx['opening']] = h.opening;
          if (idx['termination'] >= 0 && h.termination) metaRow[idx['termination']] = h.termination;
          if (idx['time_control'] >= 0 && h.time_control) metaRow[idx['time_control']] = h.time_control;
          if (idx['white_elo'] >= 0 && h.white_elo) metaRow[idx['white_elo']] = h.white_elo;
          if (idx['black_elo'] >= 0 && h.black_elo) metaRow[idx['black_elo']] = h.black_elo;
          if (idx['white_rating_diff'] >= 0 && h.white_rating_diff) metaRow[idx['white_rating_diff']] = h.white_rating_diff;
          if (idx['black_rating_diff'] >= 0 && h.black_rating_diff) metaRow[idx['black_rating_diff']] = h.black_rating_diff;
          if (idx['ply_count'] >= 0 && h.ply_count) metaRow[idx['ply_count']] = h.ply_count;
        }

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

    // Append new rows and sort newest-to-oldest
    if (gamesRowsToInsert.length > 0) {
      appendRows_(SHEET_NAMES.GAMES, gamesRowsToInsert);
      // Sort by end_time_iso descending
      sortSheetByHeaderDesc_(SHEET_NAMES.GAMES, 'end_time_iso');
    }
    if (metaRowsToInsert.length > 0) {
      appendRows_(SHEET_NAMES.GAMEMETA, metaRowsToInsert);
      // Sort by last_updated_iso descending
      sortSheetByHeaderDesc_(SHEET_NAMES.GAMEMETA, 'last_updated_iso');
    }

    // Keep Archives newest months on top
    sortSheetByHeaderDesc_(SHEET_NAMES.ARCHIVES, 'archive_month');
  });
}

function monthIsFrozen_(ym) {
  // Frozen if year-month is strictly before current year-month
  const cur = getCurrentYearMonth();
  return ym < cur;
}
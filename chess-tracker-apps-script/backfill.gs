// Historical backfill: process all archive months with resume state

function startBackfill() {
  return withLock(() => {
    const username = getScriptProperty('username');
    if (!username) throw new Error('Missing script property: username');
    setupSheets_();

    const index = fetchArchivesIndex_(username);
    const months = [];
    for (let i = 0; i < index.length; i++) {
      const ym = ymFromArchiveUrl_(index[i]);
      if (ym) months.push(ym);
    }
    // Oldest -> newest for deterministic processing
    months.sort();

    setJsonScriptProperty('backfill_state', {
      monthsPending: months,
      batchSize: 6,
      started_iso: getIsoNow()
    });
  });
}

function continueBackfill() {
  return withLock(() => {
    const state = getJsonScriptProperty('backfill_state', null);
    if (!state || !state.monthsPending || state.monthsPending.length === 0) {
      return 'Backfill not started or already complete';
    }

    const username = getScriptProperty('username');
    if (!username) throw new Error('Missing script property: username');

    const batchSize = state.batchSize || 6;
    const todo = state.monthsPending.slice(0, batchSize);

    const knownIds = readColumnAsSet_(SHEET_NAMES.GAMES, 1); // game_id

    // Prepare Archives lookup
    const ss = getSpreadsheet_();
    const archivesSheet = ss.getSheetByName(SHEET_NAMES.ARCHIVES);
    const headers = ARCHIVES_HEADERS;
    const headerIndex = {};
    headers.forEach((h, i) => headerIndex[h] = i);
    const archivesMap = {};
    const lastRow = archivesSheet.getLastRow();
    if (lastRow >= 2) {
      const values = archivesSheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
      for (let i = 0; i < values.length; i++) {
        const row = values[i];
        const ym = row[0];
        if (ym) archivesMap[ym] = {rowIndex: i + 2, row};
      }
    }

    const monthlyGamesRaw = {};
    const newGameRowsByMonth = {};
    const etagByMonth = {};

    // Fetch and parse
    for (const ym of todo) {
      const existing = archivesMap[ym];
      const prevEtag = existing ? existing.row[headerIndex['etag']] : '';
      const fetched = fetchArchiveMonth_(username, ym, prevEtag);
      if (fetched.unchanged) {
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

    // Persist: PGN/JSON, Archives, and row inserts
    const gamesRowsToInsert = [];
    const metaRowsToInsert = [];
    const pgnIdx = GAMES_HEADERS.indexOf('pgn_file_id');

    for (const ym of todo) {
      const gamesRaw = monthlyGamesRaw[ym] || [];
      const pgnText = buildMonthlyPgn_(gamesRaw);
      const pgnFileId = pgnText ? saveMonthlyPgn(username, ym, pgnText) : '';

      // Save JSON as well
      const jsonText = JSON.stringify({games: gamesRaw});
      const jsonFileId = saveMonthlyJson(username, ym, jsonText);

      const parsedRows = (newGameRowsByMonth[ym] || []).map(row => {
        const copy = row.slice();
        if (pgnIdx >= 0) copy[pgnIdx] = pgnFileId; // pgn_file_id
        return copy;
      });
      gamesRowsToInsert.push(...parsedRows);

      // Prefill GameMeta
      const metaHeaders = GAMEMETA_HEADERS;
      const idx = {};
      metaHeaders.forEach((h, i) => idx[h] = i);
      for (const game of gamesRaw) {
        const url = game.url || '';
        const hasRow = parsedRows.find(r => r[0] === url);
        if (!hasRow) continue;
        const metaRow = new Array(metaHeaders.length).fill('');
        if (idx['game_id'] >= 0) metaRow[idx['game_id']] = url;
        if (idx['callback_status'] >= 0) metaRow[idx['callback_status']] = 'pending';
        if (idx['last_updated_iso'] >= 0) metaRow[idx['last_updated_iso']] = getIsoNow();
        // JSON-derived
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
        // PGN-derived
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

    if (gamesRowsToInsert.length > 0) {
      insertRowsAtTop_(SHEET_NAMES.GAMES, gamesRowsToInsert);
    }
    if (metaRowsToInsert.length > 0) {
      insertRowsAtTop_(SHEET_NAMES.GAMEMETA, metaRowsToInsert);
    }

    // Update resume state
    state.monthsPending = state.monthsPending.slice(todo.length);
    setJsonScriptProperty('backfill_state', state);

    return `Backfill processed ${todo.length} month(s). Remaining: ${state.monthsPending.length}`;
  });
}

function cancelBackfill() {
  setScriptProperty('backfill_state', '');
}

function installBackfillTrigger() {
  ScriptApp.newTrigger('continueBackfill').timeBased().everyMinutes(10).create();
}

function removeBackfillTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) {
    if (t.getHandlerFunction() === 'continueBackfill') {
      ScriptApp.deleteTrigger(t);
    }
  }
}


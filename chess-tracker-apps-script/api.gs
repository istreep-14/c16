// Chess.com API helpers

function fetchArchivesIndex_(username) {
  const url = `https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/archives`;
  const resp = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
  const code = resp.getResponseCode();
  if (code !== 200) throw new Error(`Archives index fetch failed: ${code}`);
  const data = JSON.parse(resp.getContentText());
  return data.archives || [];
}

function ymFromArchiveUrl_(archiveUrl) {
  const m = archiveUrl.match(/\/(\d{4})\/(\d{2})$/);
  if (!m) return null;
  return `${m[1]}-${m[2]}`;
}

function fetchArchiveMonth_(username, yearMonth, prevEtag) {
  const [y, m] = yearMonth.split('-');
  const url = `https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/${y}/${m}`;
  const options = {muteHttpExceptions: true, headers: {}};
  if (prevEtag) options.headers['If-None-Match'] = prevEtag;
  const resp = UrlFetchApp.fetch(url, options);
  const code = resp.getResponseCode();
  if (code === 304) {
    return {unchanged: true, etag: prevEtag, games: []};
  }
  if (code !== 200) throw new Error(`Archive fetch ${yearMonth} failed: ${code}`);
  const etag = resp.getHeaders().ETag || '';
  const body = JSON.parse(resp.getContentText());
  const games = Array.isArray(body.games) ? body.games : [];
  return {unchanged: false, etag, games};
}

function parseGamesForUser_(username, yearMonth, games) {
  const uname = String(username).toLowerCase();
  const rows = [];
  for (const g of games) {
    const endIso = g.end_time ? new Date(g.end_time * 1000).toISOString() : '';
    const dateKey = endIso ? endIso.slice(0, 10) : '';
    const whiteUser = (g.white && g.white.username) ? String(g.white.username) : '';
    const blackUser = (g.black && g.black.username) ? String(g.black.username) : '';
    const userIsWhite = whiteUser.toLowerCase() === uname;
    const userIsBlack = blackUser.toLowerCase() === uname;
    if (!userIsWhite && !userIsBlack) continue;

    const color = userIsWhite ? 'white' : 'black';
    const opponent = userIsWhite ? blackUser : whiteUser;
    const opponentRating = userIsWhite ? (g.black && g.black.rating) : (g.white && g.white.rating);
    const userResult = userIsWhite ? (g.white && g.white.result) : (g.black && g.black.result);

    const startIso = g.start_time ? new Date(g.start_time * 1000).toISOString() : '';
    const rated = !!g.rated;
    const rules = g.rules || '';
    const timeClass = g.time_class || '';
    const url = g.url || '';

    const row = [
      url,                // game_id
      yearMonth,          // archive_month
      dateKey,            // date_key
      startIso,           // start_time_iso
      endIso,             // end_time_iso
      timeClass,          // time_class
      rated,              // rated
      rules,              // rules
      color,              // color
      opponent,           // opponent
      Number(opponentRating || 0), // opponent_rating
      userResult || '',   // result
      url,                // url
      '',                 // pgn_file_id
      '',                 // pgn_offset_start
      ''                  // pgn_offset_end
    ];
    rows.push(row);
  }
  return rows;
}

function buildMonthlyPgn_(games) {
  const parts = [];
  for (const g of games) {
    if (g.pgn) parts.push(g.pgn.trim());
  }
  return parts.join('\n\n');
}
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

function deriveFormatAndSpeed_(rules, timeClass) {
  const r = String(rules || '').toLowerCase();
  const t = String(timeClass || '').toLowerCase();
  const isDaily = t === 'daily';
  const isLive = t === 'bullet' || t === 'blitz' || t === 'rapid';
  let format = '';
  if (r === 'chess') {
    // Standard: format is the time class directly
    format = t; // bullet|blitz|rapid|daily
  } else if (r === 'chess960') {
    // Chess960 supports daily and live
    format = isDaily ? 'chess960_daily' : 'chess960_live';
  } else if (r) {
    // Other variants: format is the variant name (live-only variants on Chess.com)
    format = r;
  } else {
    format = t || '';
  }
  const speed = isDaily ? 'daily' : (isLive ? 'live' : '');
  return {format, speed};
}

function parseGamesForUser_(username, yearMonth, games) {
  const uname = String(username).toLowerCase();
  const rows = [];
  for (const g of games) {
    const tz = Session.getScriptTimeZone();
    const pgnHeaders = g.pgn ? parsePgnHeaders_(g.pgn) : null;
    // Derive end date/time
    let endDate = g.end_time ? new Date(g.end_time * 1000) : null;
    if (!endDate && pgnHeaders) {
      if (pgnHeaders.end_date && pgnHeaders.end_time) {
        endDate = parseDateTimeFromPgnParts_(pgnHeaders.end_date, pgnHeaders.end_time, true);
      } else if (pgnHeaders.utc_date && pgnHeaders.utc_time) {
        endDate = parseDateTimeFromPgnParts_(pgnHeaders.utc_date, pgnHeaders.utc_time, true);
      }
    }
    // Derive start date/time
    let startDate = g.start_time ? new Date(g.start_time * 1000) : null;
    if (!startDate && pgnHeaders) {
      if (pgnHeaders.date && pgnHeaders.start_time) {
        startDate = parseDateTimeFromPgnParts_(pgnHeaders.date, pgnHeaders.start_time, true);
      } else if (pgnHeaders.utc_date && pgnHeaders.utc_time) {
        startDate = parseDateTimeFromPgnParts_(pgnHeaders.utc_date, pgnHeaders.utc_time, true);
      }
    }
    const dateKey = endDate ? Utilities.formatDate(endDate, tz, 'yyyy-MM-dd') : (startDate ? Utilities.formatDate(startDate, tz, 'yyyy-MM-dd') : '');
    const whiteUser = (g.white && g.white.username) ? String(g.white.username) : '';
    const blackUser = (g.black && g.black.username) ? String(g.black.username) : '';
    const userIsWhite = whiteUser.toLowerCase() === uname;
    const userIsBlack = blackUser.toLowerCase() === uname;
    if (!userIsWhite && !userIsBlack) continue;

    const color = userIsWhite ? 'white' : 'black';
    const opponent = userIsWhite ? whiteUser === '' ? '' : blackUser : whiteUser;
    const opponentRating = userIsWhite ? (g.black && g.black.rating) : (g.white && g.white.rating);
    const userResult = userIsWhite ? (g.white && g.white.result) : (g.black && g.black.result);

    const startIso = startDate || '';
    const rated = !!g.rated;
    const rules = g.rules || '';
    const timeClass = g.time_class || '';
    const {format, speed} = deriveFormatAndSpeed_(rules, timeClass);
    const url = g.url || '';

    const row = [
      url,                // game_id
      yearMonth,          // archive_month
      dateKey,            // date_key
      startIso,           // start_time_iso (as Date, not ISO string)
      endDate || '',      // end_time_iso (as Date, not ISO string)
      timeClass,          // time_class
      format,             // format
      rated,              // rated
      rules,              // rules
      speed,              // speed
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

function parseDateTimeFromPgnParts_(dateStr, timeStr, assumeUTC) {
  if (!dateStr || !timeStr) return null;
  // Normalize date: supports YYYY.MM.DD or YYYY-MM-DD
  const normDate = String(dateStr).replace(/\./g, '-');
  const m = normDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const t = String(timeStr).match(/^(\d{2}):(\d{2}):(\d{2})$/);
  if (!m || !t) return null;
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
  const hh = Number(t[1]); const mm = Number(t[2]); const ss = Number(t[3]);
  if (assumeUTC) return new Date(Date.UTC(y, mo - 1, d, hh, mm, ss));
  return new Date(y, mo - 1, d, hh, mm, ss);
}

function buildMonthlyPgn_(games) {
  const parts = [];
  for (const g of games) {
    if (g.pgn) parts.push(g.pgn.trim());
  }
  return parts.join('\n\n');
}
/**
 * Lean Chess.com API client with per-run caps and backoff
 */

var ChessApi = (function() {
  var calls = 0;
  function cap() { return (typeof ConfigRepo !== 'undefined' && ConfigRepo.getNumber('MAX_API_CALLS_PER_RUN')) || CONSTANTS.MAX_API_CALLS_PER_RUN; }

  function request(url, options) {
    if (calls >= cap()) throw new Error('API cap reached for this run');
    calls++;
    var opts = options || {};
    var final = {
      method: opts.method || 'get',
      muteHttpExceptions: true,
      headers: Object.assign({ 'User-Agent': CONSTANTS.API.USER_AGENT }, opts.headers || {})
    };
    var retries = 0;
    while (retries <= CONSTANTS.MAX_RETRIES) {
      try {
        var res = UrlFetchApp.fetch(url, final);
        var code = res.getResponseCode();
        if (code === 200) return JSON.parse(res.getContentText());
        if (code === 429 || code >= 500) {
          var retryAfter = res.getHeaders()[CONSTANTS.API.HEADER_RETRY_AFTER] || 0;
          var wait = retryAfter ? (+retryAfter * 1000) : (CONSTANTS.RETRY_DELAY * Math.pow(2, retries));
          Utilities.sleep(wait);
          retries++;
          continue;
        }
        throw new Error('API Error ' + code + ': ' + res.getContentText());
      } catch (e) {
        if (retries >= CONSTANTS.MAX_RETRIES) throw e;
        Utilities.sleep(CONSTANTS.RETRY_DELAY * Math.pow(2, retries));
        retries++;
      }
    }
    throw new Error('Max retries exceeded');
  }

  function base() { return CONSTANTS.API.BASE_URL; }
  function getProfile(username) { return request(base() + '/player/' + username); }
  function getStats(username) { return request(base() + '/player/' + username + '/stats'); }
  function getArchives(username) { var r = request(base() + '/player/' + username + '/games/archives'); return r.archives || []; }
  function getMonthlyGames(archiveUrl) { var r = request(archiveUrl); return r.games || []; }
  function getCallback(gameUrl) {
    var m = gameUrl.match(new RegExp(CONSTANTS.REGEX.CHESS_COM_GAME_ID));
    if (!m) throw new Error('Invalid game URL: ' + gameUrl);
    var url = CONSTANTS.API.CALLBACK_BASE_URL + '/' + m[1] + '/game/' + m[2];
    var res = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true, headers: { 'User-Agent': CONSTANTS.API.USER_AGENT } });
    if (res.getResponseCode() !== 200) throw new Error('Callback API Error ' + res.getResponseCode());
    return JSON.parse(res.getContentText());
  }

  return { getProfile: getProfile, getStats: getStats, getArchives: getArchives, getMonthlyGames: getMonthlyGames, getCallback: getCallback };
})();


/**
 * Minimal utilities: time, logging, locks, http backoff
 */

var Log = (function() {
  function log(level, operation, message, details) {
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName(CONSTANTS.SHEETS.LOGS) || ss.insertSheet(CONSTANTS.SHEETS.LOGS);
      var row = [new Date(), level, operation, message, details ? JSON.stringify(details) : ''];
      sheet.appendRow(row);
      if (sheet.getLastRow() > (CONSTANTS.LOG_MAX_ROWS + 1)) {
        sheet.deleteRow(2);
      }
    } catch (e) {
      Logger.log('LOG_FAIL ' + (e && e.toString ? e.toString() : e));
    }
  }
  return { log: log };
})();

var Time = (function() {
  function epochToLocal(epoch) { return new Date(epoch * 1000); }
  function formatDate(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), CONSTANTS.TIME_FORMAT_DATE); }
  function formatDateTime(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), CONSTANTS.TIME_FORMAT_DATETIME); }
  function startOfDayEpoch(d) { var x = new Date(d); x.setHours(0,0,0,0); return Math.floor(x.getTime()/1000); }
  function endOfDayEpoch(d) { var x = new Date(d); x.setHours(23,59,59,999); return Math.floor(x.getTime()/1000); }
  function parseLocal(dateStr) {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return Math.floor(dateStr.getTime()/1000);
    if (typeof dateStr === 'number') return dateStr >= 1e12 ? Math.floor(dateStr/1000) : Math.floor(dateStr);
    var s = String(dateStr).trim();
    var m = s.match(new RegExp(CONSTANTS.REGEX.DATETIME_LOCAL));
    if (m) { var d=new Date(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6],0); return isNaN(d) ? null : Math.floor(d.getTime()/1000); }
    m = s.match(new RegExp(CONSTANTS.REGEX.DATETIME_ISO, 'i'));
    if (m) {
      var useUTC = !!m[7];
      var ms = useUTC ? Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6]) : new Date(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6],0).getTime();
      return Math.floor(ms/1000);
    }
    m = s.match(new RegExp(CONSTANTS.REGEX.DATE_ONLY));
    if (m) { var d2=new Date(+m[1],+m[2]-1,+m[3],0,0,0,0); return Math.floor(d2.getTime()/1000); }
    var d3 = new Date(s); return isNaN(d3) ? null : Math.floor(d3.getTime()/1000);
  }
  return { epochToLocal: epochToLocal, formatDate: formatDate, formatDateTime: formatDateTime, startOfDayEpoch: startOfDayEpoch, endOfDayEpoch: endOfDayEpoch, parseLocal: parseLocal };
})();

var Locks = (function() {
  function withLock(name, fn) {
    var lock = LockService.getDocumentLock();
    lock.waitLock(30000);
    try { return fn(); } finally { try { lock.releaseLock(); } catch (e) {} }
  }
  return { withLock: withLock };
})();

var Backoff = (function() {
  function sleep(ms) { Utilities.sleep(ms); }
  function exp(attempt) {
    var base = CONSTANTS.QUEUE.BACKOFF_BASE_MS;
    var jitter = Math.floor(Math.random() * (CONSTANTS.QUEUE.BACKOFF_JITTER_MS + 1));
    return base * Math.pow(2, Math.max(0, attempt)) + jitter;
  }
  return { sleep: sleep, exp: exp };
})();


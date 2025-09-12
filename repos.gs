/**
 * Minimal repositories: Config, Games, DailyStats, Logs, WorkQueue
 */

var ConfigRepo = (function() {
  function sheet() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(CONSTANTS.SHEETS.CONFIG) || ss.insertSheet(CONSTANTS.SHEETS.CONFIG);
    if (sh.getLastRow() === 0) { sh.appendRow(['Key','Value','UpdatedAt']); }
    return sh;
  }
  function get(key) {
    var sh = sheet();
    var data = sh.getDataRange().getValues();
    for (var i=1;i<data.length;i++) if (data[i][0] === key) return data[i][1];
    return null;
  }
  function set(key, value) {
    var sh = sheet();
    var data = sh.getDataRange().getValues();
    for (var i=1;i<data.length;i++) if (data[i][0] === key) { sh.getRange(i+1,2).setValue(value); sh.getRange(i+1,3).setValue(new Date()); return; }
    sh.appendRow([key, value, new Date()]);
  }
  function getNumber(key) { var v = get(key); return (typeof v === 'number') ? v : (v!=null ? Number(v) : null); }
  return { get: get, set: set, getNumber: getNumber };
})();

var HeaderRepo = (function() {
  function ensureGamesSheet() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(CONSTANTS.SHEETS.GAMES) || ss.insertSheet(CONSTANTS.SHEETS.GAMES);
    var headers = CONSTANTS.HEADERS.GAMES.slice();
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    return sh;
  }
  function ensureDailyStatsSheet() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(CONSTANTS.SHEETS.DAILY_STATS) || ss.insertSheet(CONSTANTS.SHEETS.DAILY_STATS);
    if (sh.getLastRow() === 0) sh.appendRow(['date']);
    sh.setFrozenRows(1);
    return sh;
  }
  function ensureLogsSheet() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(CONSTANTS.SHEETS.LOGS) || ss.insertSheet(CONSTANTS.SHEETS.LOGS);
    if (sh.getLastRow() === 0) sh.appendRow(['timestamp','level','operation','message','details']);
    sh.setFrozenRows(1);
    return sh;
  }
  function ensureQueueSheet() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(CONSTANTS.SHEETS.WORK_QUEUE) || ss.insertSheet(CONSTANTS.SHEETS.WORK_QUEUE);
    var headers = CONSTANTS.QUEUE.HEADERS;
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    return sh;
  }
  return { ensureGamesSheet: ensureGamesSheet, ensureDailyStatsSheet: ensureDailyStatsSheet, ensureLogsSheet: ensureLogsSheet, ensureQueueSheet: ensureQueueSheet };
})();

var GamesRepo = (function() {
  function sh() { return HeaderRepo.ensureGamesSheet(); }
  function headers() { return sh().getRange(1,1,1,sh().getLastColumn()).getValues()[0]; }
  function hmap() { var h=headers(),m={}; h.forEach(function(n,i){m[n]=i;}); return m; }
  function readExistingUrlSet() {
    var s = sh(); var h = hmap(); if (h.url==null) return new Set();
    var last = s.getLastRow(); if (last<=1) return new Set();
    var vals = s.getRange(2, h.url+1, last-1, 1).getValues();
    var set = new Set(); vals.forEach(function(r){ if (r[0]) set.add(r[0]); });
    return set;
  }
  function appendRows(rows) {
    if (!rows || rows.length===0) return 0;
    var s = sh(); var h = headers();
    var start = s.getLastRow()+1;
    s.getRange(start,1,rows.length,h.length).setValues(rows);
    return rows.length;
  }
  function updateByUrl(updates) {
    if (!updates || updates.length===0) return 0;
    var s = sh(); var h = headers(); var m=hmap(); var urlCol = m.url!=null?m.url+1:0; if (!urlCol) return 0;
    var last = s.getLastRow(); if (last<=1) return 0;
    var urls = s.getRange(2,urlCol,last-1,1).getValues();
    var map = {}; for (var i=0;i<urls.length;i++) { var u=urls[i][0]; if (u) map[u]=i+2; }
    updates.forEach(function(u){
      var rowNum = map[u.url]; if (!rowNum) return;
      Object.keys(u.data).forEach(function(key){ var col=m[key]; if (col!=null) s.getRange(rowNum,col+1).setValue(u.data[key]); });
    });
    return updates.length;
  }
  function getLastGameEpoch() {
    var s = sh(); var m=hmap(); if (m.end==null) return null; var last = s.getLastRow(); if (last<=1) return null;
    var vals = s.getRange(2,m.end+1,last-1,1).getValues();
    var max=0; vals.forEach(function(r){ var ep=Time.parseLocal(r[0]); if (ep && ep>max) max=ep; });
    return max||null;
  }
  return { readExistingUrlSet: readExistingUrlSet, appendRows: appendRows, updateByUrl: updateByUrl, getLastGameEpoch: getLastGameEpoch, headers: headers, hmap: hmap };
})();

var DailyStatsRepo = (function() {
  function sh() { return HeaderRepo.ensureDailyStatsSheet(); }
  function headers() { return sh().getRange(1,1,1,sh().getLastColumn()).getValues()[0]; }
  function hmap() { var h=headers(),m={}; h.forEach(function(n,i){m[n]=i;}); return m; }
  function upsertRows(rows) {
    if (!rows || rows.length===0) return 0;
    var s = sh(); var curH = headers(); var m = {}; curH.forEach(function(n,i){m[n]=i;});
    var dateIdx = m['date']; if (dateIdx==null) throw new Error('Daily Stats missing date');
    var last = s.getLastRow(); var values = last>1 ? s.getRange(2,1,last-1,curH.length).getValues() : [];
    var tz = Session.getScriptTimeZone(); var existing = {};
    for (var i=0;i<values.length;i++) { var cell=values[i][dateIdx]; var key='';
      if (cell instanceof Date) key=Utilities.formatDate(cell,tz,CONSTANTS.TIME_FORMAT_DATE); else if (cell) key=String(cell).trim();
      if (key) existing[key]=i+2; }
    var updates=[]; var appends=[];
    rows.forEach(function(r){ var dk=r[0]; var rowNum=existing[dk]; if (rowNum) updates.push({row:rowNum,values:r}); else appends.push(r); });
    updates.sort(function(a,b){return a.row-b.row;}).forEach(function(u){ s.getRange(u.row,1,1,u.values.length).setValues([u.values]); });
    if (appends.length>0) s.getRange(s.getLastRow()+1,1,appends.length,appends[0].length).setValues(appends);
    return rows.length;
  }
  return { upsertRows: upsertRows, headers: headers, hmap: hmap };
})();

var WorkQueueRepo = (function() {
  function sh() { return HeaderRepo.ensureQueueSheet(); }
  function headers() { return sh().getRange(1,1,1,sh().getLastColumn()).getValues()[0]; }
  function enqueue(items) {
    if (!items || items.length===0) return 0;
    var s = sh(); var h=headers(); var rows = items.map(function(it){ return [it.id,it.type,it.key,it.url,it.status,it.attempts,it.nextAttemptAt,it.lastError,JSON.stringify(it.payload||{}),it.addedAt||new Date(),it.updatedAt||new Date()]; });
    s.getRange(s.getLastRow()+1,1,rows.length,h.length).setValues(rows); return rows.length;
  }
  function getPending(limit) {
    var s = sh(); var h=headers(); var m={}; h.forEach(function(n,i){m[n]=i;}); var last=s.getLastRow(); if (last<=1) return [];
    var vals = s.getRange(2,1,last-1,h.length).getValues(); var out=[]; var now=Date.now();
    for (var i=0;i<vals.length;i++) {
      var v=vals[i]; var st=v[m.status]; var next=v[m.nextAttemptAt];
      var ok = st==='pending' && (!next || (next instanceof Date ? next.getTime()<=now : Time.parseLocal(next)<=Math.floor(now/1000)));
      if (ok) out.push({ row:i+2, id:v[m.id], type:v[m.type], key:v[m.key], url:v[m.url], attempts:Number(v[m.attempts]||0), payload: (function(p){ try{return JSON.parse(p||'{}');}catch(e){return {};}})(v[m.payload]) });
      if (out.length >= (limit||CONSTANTS.CALLBACK_BATCH_SIZE)) break;
    }
    return out;
  }
  function markCompleted(rows) { if (!rows||rows.length===0) return; var s=sh(); rows.forEach(function(r){ s.getRange(r, headers().indexOf('status')+1).setValue('completed'); s.getRange(r, headers().indexOf('updatedAt')+1).setValue(new Date()); }); }
  function markFailed(row, attempts, error) {
    var s=sh(); var h=headers(); var m={}; h.forEach(function(n,i){m[n]=i;});
    var maxA = CONSTANTS.QUEUE.MAX_ATTEMPTS; var st = (attempts+1)>=maxA ? 'failed' : 'pending';
    s.getRange(row, m.attempts+1).setValue(attempts+1);
    s.getRange(row, m.status+1).setValue(st);
    s.getRange(row, m.lastError+1).setValue(error||'');
    var wait = Backoff.exp(attempts);
    s.getRange(row, m.nextAttemptAt+1).setValue(new Date(Date.now()+wait));
    s.getRange(row, m.updatedAt+1).setValue(new Date());
  }
  return { enqueue: enqueue, getPending: getPending, markCompleted: markCompleted, markFailed: markFailed };
})();


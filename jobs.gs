/**
 * Jobs: fetch, derive worker, daily stats
 */

function jobFetch() {
  return Locks.withLock('fetch', function(){
    var start = Date.now();
    var username = ConfigRepo.get('username'); if (!username) throw new Error('Username not configured.');
    var archives = ChessApi.getArchives(username);
    // Look-back rule: process last archive and one prior at minimum
    var maxArchives = (ConfigRepo.getNumber('MAX_ARCHIVES_PER_RUN') || CONSTANTS.MAX_ARCHIVES_PER_RUN);
    var toProcess = archives.slice(Math.max(0, archives.length - Math.max(2, maxArchives)));
    var existing = GamesRepo.readExistingUrlSet();
    var rows=[]; var queueItems=[]; var gamesCount=0;
    var maxGames = (ConfigRepo.getNumber('MAX_GAMES_PER_RUN') || CONSTANTS.MAX_GAMES_PER_RUN);
    for (var i=toProcess.length-1;i>=0;i--) {
      var monthly = ChessApi.getMonthlyGames(toProcess[i]);
      for (var j=monthly.length-1;j>=0;j--) {
        var g = monthly[j]; var url = g.url; if (!url || existing.has(url)) continue; existing.add(url);
        // Light processing
        var white = g.white||{}; var black=g.black||{};
        var myColor = null; var myUser = (ConfigRepo.get('username')||'').toLowerCase();
        if (white.username && white.username.toLowerCase()===myUser) myColor='white'; else if (black.username && black.username.toLowerCase()===myUser) myColor='black';
        var whiteOutcome = Types.resultToOutcome(white.result); var blackOutcome = Types.resultToOutcome(black.result);
        var overallNum = Types.overallOutcomeNumeric(white.result, black.result);
        var myOutcome = myColor==='white'? whiteOutcome : (myColor==='black'? blackOutcome : null);
        var oppOutcome = (myOutcome==null)? null : (1 - myOutcome);
        var tz = Session.getScriptTimeZone();
        var endMs = g.end_time ? new Date(g.end_time*1000) : null;
        var endStr = endMs ? Utilities.formatDate(endMs, tz, CONSTANTS.TIME_FORMAT_DATETIME) : '';
        var d = endMs || new Date();
        var rowMap = {
          url: url,
          rated: g.rated || false,
          time_control: g.time_control || '',
          start: '',
          end: endStr,
          date: Utilities.formatDate(d, tz, CONSTANTS.TIME_FORMAT_DATE),
          year: d.getFullYear(), month: d.getMonth()+1, day: d.getDate(), hour: d.getHours(), minute: d.getMinutes(), second: d.getSeconds(),
          white_username: white.username||'', white_rating: white.rating||'', white_result: white.result||'',
          black_username: black.username||'', black_rating: black.rating||'', black_result: black.result||'',
          rules: g.rules||'chess', time_class: g.time_class||'', format: '', eco: '', eco_url: '', termination: g.termination||'',
          my_color: myColor, my_username: ConfigRepo.get('username')||'', my_rating: (myColor==='white'? white.rating : (myColor==='black'? black.rating: '')),
          my_outcome: myOutcome, opponent_username: (myColor==='white' ? (black.username||'') : (myColor==='black'? (white.username||'') : '')),
          opponent_rating: (myColor==='white' ? (black.rating||'') : (myColor==='black'? (white.rating||'') : '')),
          opponent_outcome: oppOutcome,
          overall_outcome_numeric: overallNum,
          base_time_seconds: null, increment_seconds: null,
          my_pregame_rating: '', opponent_pregame_rating: '', my_rating_change_callback: '', opponent_rating_change_callback: '',
          white_accuracy: '', black_accuracy: '', callback_processed: false, callback_timestamp: '', callback_game_id: '',
          game_duration_seconds: '', move_count: '', ply_count: '', moves_san: '', moves_numbered: '', clocks: '', clock_seconds: '', time_per_move: '',
          processed_timestamp: new Date().toISOString(), processing_version: '2.0'
        };
        // Derive time control basics
        var tc = String(g.time_control||'');
        if (tc.indexOf('/')>=0) { var parts = tc.split('/'); rowMap.base_time_seconds = Number(parts[1]||0); rowMap.increment_seconds = 0; }
        else if (tc.indexOf('+')>=0) { var p = tc.split('+'); rowMap.base_time_seconds = Number(p[0]||0); rowMap.increment_seconds = Number(p[1]||0); }
        else { rowMap.base_time_seconds = Number(tc||0); rowMap.increment_seconds = 0; }
        // Determine format
        if (g.url && g.url.indexOf('/daily/')>=0) { rowMap.format = (g.rules==='chess960')? 'daily960' : 'daily'; }
        else if (g.rules && g.rules!=='chess') { rowMap.format = (g.rules==='chess960')? 'live960' : g.rules; }
        else if (g.time_class) { rowMap.format = g.time_class; }
        else { var cls = (rowMap.base_time_seconds + (rowMap.increment_seconds||0)*40); rowMap.format = (cls<180?'bullet':(cls<480?'blitz':(cls<1500?'rapid':'daily'))); }
        // Materialize row respecting header order
        var h = GamesRepo.headers(); var row = new Array(h.length).fill('');
        for (var k=0;k<h.length;k++) { var key=h[k]; if (rowMap.hasOwnProperty(key)) row[k]=rowMap[key]; }
        rows.push(row); gamesCount++;
        // Queue derivations
        queueItems.push({ id: Utilities.getUuid(), type: 'heavy_derivation', key: url, url: url, status: 'pending', attempts: 0, nextAttemptAt: '', lastError: '', payload: {}, addedAt: new Date(), updatedAt: new Date() });
        queueItems.push({ id: Utilities.getUuid(), type: 'callback_enrich', key: url, url: url, status: 'pending', attempts: 0, nextAttemptAt: '', lastError: '', payload: {}, addedAt: new Date(), updatedAt: new Date() });
        if (gamesCount>=maxGames) break;
      }
      if (gamesCount>=maxGames) break;
    }
    if (rows.length>0) GamesRepo.appendRows(rows);
    if (queueItems.length>0) WorkQueueRepo.enqueue(queueItems);
    Log.log('INFO','Fetch','Fetched games', { rows: rows.length, queued: queueItems.length });
    return { games: rows.length, queued: queueItems.length, ms: Date.now()-start };
  });
}

function jobDeriveWorker() {
  return Locks.withLock('derive', function(){
    var tasks = WorkQueueRepo.getPending(CONSTANTS.CALLBACK_BATCH_SIZE);
    if (tasks.length===0) return { processed: 0 };
    var updates=[]; var completedRows=[];
    tasks.forEach(function(t){
      try {
        if (t.type==='callback_enrich') {
          var data = ChessApi.getCallback(t.url);
          var white = (data.players && (data.players.white||data.players.top)) || null;
          var black = (data.players && (data.players.black||data.players.bottom)) || null;
          var myU = (ConfigRepo.get('username')||'').toLowerCase(); var isWhite=false; var myP=null; var oppP=null;
          if (white && white.username && white.username.toLowerCase()===myU) { isWhite=true; myP=white; oppP=black; }
          else if (black && black.username && black.username.toLowerCase()===myU) { isWhite=false; myP=black; oppP=white; }
          var upd = { url: t.url, data: {} };
          if (data.ratingChange) {
            var rw = data.ratingChange.white; var rb = data.ratingChange.black;
            upd.data.my_rating_change_callback = isWhite? rw : rb;
            upd.data.opponent_rating_change_callback = isWhite? rb : rw;
          }
          if (data.accuracies) { if (data.accuracies.white!=null) upd.data.white_accuracy=data.accuracies.white; if (data.accuracies.black!=null) upd.data.black_accuracy=data.accuracies.black; }
          if (myP && typeof myP.rating==='number' && upd.data.my_rating_change_callback!=null) upd.data.my_pregame_rating = myP.rating - upd.data.my_rating_change_callback;
          if (oppP && typeof oppP.rating==='number' && upd.data.opponent_rating_change_callback!=null) upd.data.opponent_pregame_rating = oppP.rating - upd.data.opponent_rating_change_callback;
          upd.data.callback_processed = true; upd.data.callback_timestamp = new Date().toISOString();
          updates.push(upd); completedRows.push(t.row);
        } else if (t.type==='heavy_derivation') {
          // Heavy moves/clock derivation requires PGN presence in API game (not provided in archive). Skip for now unless you later add PGN source.
          // We keep the task completed to prevent blocking.
          completedRows.push(t.row);
        } else {
          completedRows.push(t.row);
        }
      } catch (e) {
        WorkQueueRepo.markFailed(t.row, t.attempts, e && e.toString ? e.toString() : 'error');
      }
    });
    if (updates.length>0) GamesRepo.updateByUrl(updates);
    if (completedRows.length>0) WorkQueueRepo.markCompleted(completedRows);
    return { processed: completedRows.length, updated: updates.length };
  });
}

function jobBuildDailyStatsIncremental() {
  return Locks.withLock('daily_stats', function(){
    var s = SpreadsheetApp.getActiveSpreadsheet();
    var g = s.getSheetByName(CONSTANTS.SHEETS.GAMES); if (!g || g.getLastRow()<=1) return { rows: 0 };
    var h = g.getRange(1,1,1,g.getLastColumn()).getValues()[0]; var m={}; h.forEach(function(n,i){m[n]=i;});
    var data = g.getRange(2,1,g.getLastRow()-1,h.length).getValues();
    var tz = Session.getScriptTimeZone();
    var perDate = {}; var formats = {};
    for (var i=0;i<data.length;i++) {
      var row = data[i]; var endStr = row[m.end]; if (!endStr) continue;
      var dk = Utilities.formatDate(new Date(Time.parseLocal(endStr)*1000), tz, CONSTANTS.TIME_FORMAT_DATE);
      var fmt = String(row[m.format]||'').trim(); if (!fmt) continue; formats[fmt]=true;
      var my = row[m.my_outcome]; var dur = Number(row[m.game_duration_seconds]||0);
      if (!perDate[dk]) perDate[dk]={}; if (!perDate[dk][fmt]) perDate[dk][fmt]={games:0,wins:0,draws:0,losses:0,time:0,opp:0,score:0,count:0,ratings:[]};
      var sfmt = perDate[dk][fmt]; sfmt.games+=1; if (my===1) sfmt.wins++; else if (my===0.5) sfmt.draws++; else if (my===0) sfmt.losses++;
      if (!isNaN(dur) && dur>0) sfmt.time += dur;
      var opp = Number(row[m.opponent_rating]||0); if (opp>0) { sfmt.opp+=opp; sfmt.score += (my||0); sfmt.count++; }
      var pre = Number(row[m.my_pregame_rating]||0); var post = Number(row[m.my_rating]||0); if (pre>0||post>0) sfmt.ratings.push({pre:pre,post:post});
    }
    var fmts = Object.keys(formats);
    // Build headers if needed: date + per-format sections
    var ds = HeaderRepo.ensureDailyStatsSheet(); var curH = ds.getRange(1,1,1,ds.getLastColumn()).getValues()[0];
    if (curH.length<=1) {
      var hdr = ['date'];
      fmts.forEach(function(f){
        hdr = hdr.concat([
          f+'_games', f+'_wins', f+'_draws', f+'_losses',
          f+'_rating_start', f+'_rating_end', f+'_rating_change',
          f+'_total_time_seconds', f+'_avg_game_duration_seconds', f+'_performance_rating'
        ]);
      });
      ds.getRange(1,1,1,hdr.length).setValues([hdr]);
    }
    // Upsert rows
    var headers = ds.getRange(1,1,1,ds.getLastColumn()).getValues()[0]; var hm={}; headers.forEach(function(n,i){hm[n]=i;});
    var rows=[]; Object.keys(perDate).forEach(function(dk){
      var out = new Array(headers.length).fill(''); out[0]=dk;
      fmts.forEach(function(f){
        var s2 = perDate[dk][f]||{games:0,wins:0,draws:0,losses:0,time:0,count:0,opp:0,score:0,ratings:[]};
        var avgDur = s2.games>0 ? (s2.time/s2.games) : 0;
        var perf = (s2.count>0) ? Math.round((s2.opp/s2.count) + 400 * Math.log10((s2.score/s2.count)/Math.max(1e-6,1-(s2.score/s2.count)))) : '';
        var rStart=''; var rEnd=''; var rChange=0; if (s2.ratings.length>0) { rStart = s2.ratings[0].pre||''; rEnd = s2.ratings[s2.ratings.length-1].post||''; if (rStart && rEnd) rChange = rEnd - rStart; }
        function set(col,val){ var idx = hm[col]; if (idx!=null) out[idx]=val; }
        set(f+'_games', s2.games); set(f+'_wins', s2.wins); set(f+'_draws', s2.draws); set(f+'_losses', s2.losses);
        set(f+'_rating_start', rStart); set(f+'_rating_end', rEnd); set(f+'_rating_change', rChange);
        set(f+'_total_time_seconds', s2.time); set(f+'_avg_game_duration_seconds', avgDur); set(f+'_performance_rating', s2.games>0?perf:'');
      });
      rows.push(out);
    });
    DailyStatsRepo.upsertRows(rows);
    Log.log('INFO','DailyStats','Upserted', { rows: rows.length });
    return { rows: rows.length };
  });
}


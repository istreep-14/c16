/**
 * Lightweight PGN parsing for heavy fields
 */

var PGN = (function(){
  function parseHeadersAndMoves(pgn) {
    if (!pgn) return { headers: {}, moves: '' };
    var lines = String(pgn).split('\n'); var headers = {}; var moves=[]; var inMoves=false;
    for (var i=0;i<lines.length;i++) {
      var t = lines[i].trim(); if (!t) continue;
      if (t[0]==='[' && t[t.length-1]===']') {
        var m = t.match(new RegExp(CONSTANTS.REGEX.PGN_HEADER));
        if (m) headers[m[1].toLowerCase()] = m[2];
      } else { inMoves = true; moves.push(t); }
    }
    return { headers: headers, moves: inMoves ? moves.join(' ') : '' };
  }
  function parseClockToSeconds(clockStr) {
    if (!clockStr) return 0; var parts = String(clockStr).split(':');
    if (parts.length===3) return (+parts[0])*3600 + (+parts[1])*60 + parseFloat(parts[2]);
    if (parts.length===2) return (+parts[0])*60 + parseFloat(parts[1]);
    return parseFloat(clockStr);
  }
  function derive(moveText, baseTime, inc) {
    if (!moveText) return {};
    var clockRe = /\[%clk\s+([\d:\.]+)\]/g; var clocks=[]; var m;
    while ((m = clockRe.exec(moveText))!==null) clocks.push(m[1]);
    var clockSeconds = clocks.map(parseClockToSeconds);
    var clean = moveText.replace(/\{[^}]*\}/g,'').trim();
    var tokens = clean.split(/\s+/);
    var movesSan = []; var movesNumbered = [];
    for (var i=0;i<tokens.length;i++) {
      var tk = tokens[i]; if (/^\d+\./.test(tk)) continue; if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(tk)) continue; if (!tk) continue;
      movesSan.push(tk);
      var idx = Math.floor(movesSan.length/2)+ (movesSan.length%2?0:0);
      movesNumbered.push(Math.floor((movesNumbered.length)/2)+1 + '. ' + tk);
    }
    var timePerMove=[]; var initial = baseTime || (clockSeconds.length? Math.max.apply(null,clockSeconds):0);
    for (var j=0;j<clockSeconds.length;j++) {
      var taken=0; if (j===0) taken = initial - clockSeconds[0]; else if (j===1) taken = initial - clockSeconds[1]; else { var prev = clockSeconds[j-2]; taken = prev - clockSeconds[j] + (inc||0); }
      timePerMove.push(Math.round(Math.max(0,taken)*10)/10);
    }
    var gameDuration = 0; if (clockSeconds.length>=2) {
      var init = initial; var wt=0, bt=0; for (var k=0;k<clockSeconds.length;k++) {
        if (k%2===0) { var prevW = (k===0?init:clockSeconds[k-2]); wt += prevW - clockSeconds[k]; }
        else { var prevB = (k===1?init:clockSeconds[k-2]); bt += prevB - clockSeconds[k]; }
      } gameDuration = Math.max(wt,bt);
    }
    return {
      moves_san: movesSan,
      moves_numbered: movesNumbered,
      clocks: clocks,
      clock_seconds: clockSeconds,
      time_per_move: timePerMove,
      move_count: Math.ceil(movesSan.length/2),
      ply_count: movesSan.length,
      game_duration_seconds: gameDuration
    };
  }
  return { parseHeadersAndMoves: parseHeadersAndMoves, derive: derive };
})();


/**
 * Header management: persists order/hide/color and applies to Games
 */

var HeaderManager = (function(){
  var SHEET = 'Headers';
  var COLS = ['name','group','order','hidden','color'];

  function colToA1(colIndex) {
    var dividend = colIndex;
    var columnName = '';
    while (dividend > 0) {
      var modulo = (dividend - 1) % 26;
      columnName = String.fromCharCode(65 + modulo) + columnName;
      dividend = Math.floor((dividend - modulo) / 26);
    }
    return columnName;
  }

  function updateHeaderLinks(gamesHeaderOrder) {
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var headersSheet = ensureSheet();
      var gamesSheet = ss.getSheetByName(CONSTANTS.SHEETS.GAMES) || HeaderRepo.ensureGamesSheet();
      var order = gamesHeaderOrder && gamesHeaderOrder.length ? gamesHeaderOrder : gamesSheet.getRange(1,1,1,gamesSheet.getLastColumn()).getValues()[0];
      var indexByName = {}; for (var i=0;i<order.length;i++) indexByName[String(order[i])] = i+1; // 1-based
      var urlBase = ss.getUrl();
      var gid = gamesSheet.getSheetId();
      var data = headersSheet.getDataRange().getValues();
      for (var r=1;r<data.length;r++) { // skip header row
        var name = String(data[r][0]||''); if (!name) continue;
        var col = indexByName[name]; if (!col) continue;
        var a1 = colToA1(col) + '1';
        var link = urlBase + '#gid=' + gid + '&range=' + a1;
        var rich = SpreadsheetApp.newRichTextValue().setText(name).setLinkUrl(link).build();
        headersSheet.getRange(r+1, 1).setRichTextValue(rich);
      }
    } catch (e) {
      // Best-effort; do not fail layout if linking fails
    }
  }

  function ensureSheet() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(SHEET) || ss.insertSheet(SHEET);
    if (sh.getLastRow() === 0) {
      sh.appendRow(COLS);
    }
    return sh;
  }

  function bootstrapGamesIfEmpty() {
    var sh = ensureSheet();
    var last = sh.getLastRow();
    if (last > 1) return; // already has data
    var headers = CONSTANTS.HEADERS.GAMES;
    var map = CONSTANTS.HEADER_GROUPS && CONSTANTS.HEADER_GROUPS.map ? CONSTANTS.HEADER_GROUPS.map : {};
    var groups = CONSTANTS.HEADER_GROUPS && CONSTANTS.HEADER_GROUPS.groups ? CONSTANTS.HEADER_GROUPS.groups : {};
    var rows = [];
    for (var i=0;i<headers.length;i++) {
      var name = headers[i];
      var meta = map[name] || { group: 'Identity', hidden: false };
      var color = groups[meta.group] || '';
      rows.push([name, meta.group||'', i+1, meta.hidden===true, color]);
    }
    if (rows.length>0) sh.getRange(2,1,rows.length,COLS.length).setValues(rows);
    updateHeaderLinks(headers);
  }

  function readGamesConfig() {
    var sh = ensureSheet();
    var data = sh.getDataRange().getValues();
    var idx = {}; for (var i=0;i<COLS.length;i++) idx[COLS[i]] = i;
    var out = [];
    for (var r=1;r<data.length;r++) {
      var row = data[r];
      var name = row[idx.name]; if (!name) continue;
      out.push({
        name: String(name),
        group: row[idx.group]||'',
        order: Number(row[idx.order]||0) || 0,
        hidden: (row[idx.hidden]===true || String(row[idx.hidden]).toLowerCase()==='true' || row[idx.hidden]===1),
        color: row[idx.color]||''
      });
    }
    if (out.length===0) { bootstrapGamesIfEmpty(); return readGamesConfig(); }
    out.sort(function(a,b){ return a.order - b.order; });
    return out;
  }

  function applyGamesLayout() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var cfg = readGamesConfig();
    var desired = cfg.map(function(c){ return c.name; });
    // Build new sheet with desired order
    var old = ss.getSheetByName(CONSTANTS.SHEETS.GAMES) || HeaderRepo.ensureGamesSheet();
    var tmpName = CONSTANTS.SHEETS.GAMES + '__tmp';
    var tmp = ss.getSheetByName(tmpName); if (tmp) ss.deleteSheet(tmp);
    tmp = ss.insertSheet(tmpName);
    tmp.getRange(1,1,1,desired.length).setValues([desired]);
    tmp.setFrozenRows(1);
    // Read old data
    var oldHeaders = old.getRange(1,1,1,old.getLastColumn()).getValues()[0];
    var hm = {}; oldHeaders.forEach(function(n,i){ hm[n]=i; });
    var last = old.getLastRow();
    var body = last>1 ? old.getRange(2,1,last-1,oldHeaders.length).getValues() : [];
    if (body.length>0) {
      var newRows = new Array(body.length);
      for (var r=0;r<body.length;r++) {
        var src = body[r];
        var out = new Array(desired.length).fill('');
        for (var c=0;c<desired.length;c++) {
          var name = desired[c]; var idx = hm[name]; if (idx!=null) out[c]=src[idx];
        }
        newRows[r]=out;
      }
      tmp.getRange(2,1,newRows.length,desired.length).setValues(newRows);
    }
    // Replace old with tmp
    ss.deleteSheet(old);
    tmp.setName(CONSTANTS.SHEETS.GAMES);
    // Apply formatting (colors, hidden)
    var headerRange = tmp.getRange(1,1,1,desired.length);
    for (var i=0;i<desired.length;i++) {
      var name2 = desired[i]; var meta = null;
      for (var j=0;j<cfg.length;j++) if (cfg[j].name===name2) { meta = cfg[j]; break; }
      if (meta && meta.color) tmp.getRange(1,i+1).setBackground(meta.color);
      if (meta && meta.hidden) tmp.hideColumns(i+1);
    }
    updateHeaderLinks(desired);
    return { columns: desired.length };
  }

  return { ensureSheet: ensureSheet, bootstrapGamesIfEmpty: bootstrapGamesIfEmpty, readGamesConfig: readGamesConfig, applyGamesLayout: applyGamesLayout };
})();

function applyHeaderLayout() {
  return HeaderManager.applyGamesLayout();
}


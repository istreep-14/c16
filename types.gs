/**
 * Data types and small helpers
 */

var Types = (function() {
  function resultToOutcome(result) {
    if (!result) return null;
    if (result === 'win') return 1;
    if (result === 'agreed' || result === 'repetition' || result === 'stalemate' || result === 'insufficient' || result === 'timevsinsufficient') return 0.5;
    if (result === 'lose' || result === 'checkmated' || result === 'timeout' || result === 'resigned' || result === 'abandoned') return 0;
    return null;
  }

  function overallOutcomeNumeric(whiteResult, blackResult) {
    var w = resultToOutcome(whiteResult);
    var b = resultToOutcome(blackResult);
    if (w == null || b == null) return null;
    // If it's a draw, both 0.5, else white win is 1, black win is 0
    if (w === 0.5 && b === 0.5) return 0.5;
    if (w === 1 && b === 0) return 1;
    if (w === 0 && b === 1) return 0;
    return null;
  }

  function overallOutcomeText(num) {
    if (num == null) return '';
    if (num === 1) return 'WhiteWin';
    if (num === 0.5) return 'Draw';
    if (num === 0) return 'BlackWin';
    return '';
  }

  return {
    resultToOutcome: resultToOutcome,
    overallOutcomeNumeric: overallOutcomeNumeric,
    overallOutcomeText: overallOutcomeText
  };
})();


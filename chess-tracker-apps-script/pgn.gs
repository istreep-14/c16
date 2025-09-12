// PGN parsing helpers

function parsePgnHeaders_(pgnText) {
  if (!pgnText) return {};
  const headers = {};
  const lines = String(pgnText).split(/\r?\n/);
  for (const line of lines) {
    if (line.length === 0) continue;
    if (line[0] !== '[') break; // header section ended
    const m = line.match(/^\[(\w+)\s+"([^"]*)"\]$/);
    if (m) headers[m[1]] = m[2];
  }
  const result = {};
  if (headers.ECO) result.eco = headers.ECO;
  if (headers.Opening) result.opening = headers.Opening;
  if (headers.Termination) result.termination = headers.Termination;
  if (headers.TimeControl) result.time_control = headers.TimeControl;
  if (headers.WhiteElo) result.white_elo = headers.WhiteElo;
  if (headers.BlackElo) result.black_elo = headers.BlackElo;
  if (headers.WhiteRatingDiff) result.white_rating_diff = headers.WhiteRatingDiff;
  if (headers.BlackRatingDiff) result.black_rating_diff = headers.BlackRatingDiff;
  if (headers.PlyCount) result.ply_count = headers.PlyCount;
  if (result.eco) result.eco_url = `https://www.chess.com/openings?eco=${encodeURIComponent(result.eco)}`;
  return result;
}
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
  // Raw date/time fields for downstream derivation
  if (headers.Date) result.date = headers.Date;           // e.g., 2025.09.12
  if (headers.EndDate) result.end_date = headers.EndDate; // e.g., 2025.09.12
  if (headers.StartDate) result.start_date = headers.StartDate;
  if (headers.StartTime) result.start_time = headers.StartTime; // e.g., 13:05:22
  if (headers.EndTime) result.end_time = headers.EndTime;       // e.g., 13:25:41
  if (headers.UTCDate) result.utc_date = headers.UTCDate;       // e.g., 2025.09.12
  if (headers.UTCTime) result.utc_time = headers.UTCTime;       // e.g., 12:05:22
  return result;
}
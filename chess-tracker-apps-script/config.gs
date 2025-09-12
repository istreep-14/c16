/***** Configuration: sheet names and header rows *****/

const SHEET_NAMES = {
  GAMES: 'Games',
  GAMEMETA: 'GameMeta',
  DAILYSTATS: 'DailyStats',
  ARCHIVES: 'Archives',
  ERRORS: 'Errors'
};

const GAMES_HEADERS = [
  'game_id',
  'archive_month',
  'date_key',
  'start_time_iso',
  'end_time_iso',
  'time_class',
  'format',
  'rated',
  'rules',
  'speed',
  'color',
  'opponent',
  'opponent_rating',
  'result',
  'url',
  'pgn_file_id',
  'pgn_offset_start',
  'pgn_offset_end'
];

const GAMEMETA_HEADERS = [
  'game_id','callback_status','callback_file_id','callback_error','last_updated_iso',
  // PGN-derived
  'eco','eco_url','opening','termination','time_control','white_elo','black_elo','white_rating_diff','black_rating_diff','ply_count',
  // JSON-derived (Chess.com API)
  'uuid','fen','initial_setup','tcn','tournament','match',
  'white_username','black_username','white_result','black_result','white_accuracy','black_accuracy'
];

const DAILYSTATS_HEADERS = [
  'date_key',
  'format',
  'time_class',
  'games_played',
  'wins',
  'losses',
  'draws',
  'streak',
  'rating_start',
  'rating_end',
  'avg_opponent_rating',
  'last_computed_iso'
];

const ARCHIVES_HEADERS = [
  'archive_month','status','json_file_id','pgn_file_id','etag','total_games','last_checked_iso'
];

const ERRORS_HEADERS = [
  'ts_iso','stage','game_id','message'
];

const DRIVE_FOLDERS = {
  ROOT: 'ChessTracker',
  ARCHIVES_JSON: 'ChessTracker/archives/json',
  ARCHIVES_PGN: 'ChessTracker/archives/pgn'
};
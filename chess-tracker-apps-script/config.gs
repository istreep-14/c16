/***** Configuration: sheet names and header rows *****/

const SHEET_NAMES = {
  GAMES: 'Games',
  GAMEMETA: 'GameMeta',
  DAILYSTATS: 'DailyStats',
  ARCHIVES: 'Archives',
  ERRORS: 'Errors'
};

const GAMES_HEADERS = [
  // identity
  'game_id','archive_month',
  // timing
  'end_date','start_time','end_time',
  // main info
  'time_class','format','rated','rules','speed','time_control','eco','eco_url','timezone','current_position','url','link',
  // colors and players in requested order
  'my_color','my_username','my_rating','my_result','opponent_username','opponent_rating','opponent_result','termination_result',
  // PGN player mirrors
  'white_username','white_elo','black_username','black_elo',
  // callback deltas and derivations
  'my_pregame_rating','opponent_pregame_rating','my_rating_change_callback','opponent_rating_change_callback',
  // file refs
  'pgn_file_id','pgn_offset_start','pgn_offset_end'
];

const GAMEMETA_HEADERS = [
  'game_id','callback_status','callback_file_id','callback_error','last_updated_iso',
  // PGN-derived
  'opening','termination','ply_count',
  // JSON-derived (Chess.com API)
  'uuid','fen','initial_setup','tcn','tournament','match',
  'white_result','black_result','white_accuracy','black_accuracy',
  // Callback-only enrichments requested
  'my_country_name_callback','opponent_country_name_callback',
  'my_default_tab_callback','opponent_default_tab_callback',
  'my_post_move_action_callback','opponent_post_move_action_callback',
  'my_membership_level_callback','opponent_membership_level_callback',
  'my_membership_code_callback','opponent_membership_code_callback',
  'my_member_since_callback','opponent_member_since_callback'
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
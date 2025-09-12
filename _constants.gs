/**
 * System Constants
 * This file loads first to ensure constants are available to all other modules
 */

/**
 * Constants for the system
 */
// Check if CONSTANTS already exists to avoid redeclaration
if (typeof CONSTANTS === 'undefined') {
  var CONSTANTS = {
  BATCH_SIZE: 100,
  CALLBACK_BATCH_SIZE: 50,
  MAX_EXECUTION_TIME: 300000, // 5 minutes in milliseconds
  API_RATE_LIMIT: 300, // requests per hour
  API_RATE_PERIOD: 3600000, // 1 hour in milliseconds
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000, // 2 seconds
  
  // Per-run caps (overridable via Config)
  MAX_API_CALLS_PER_RUN: 200,
  MAX_ARCHIVES_PER_RUN: 6,
  MAX_GAMES_PER_RUN: 1000,
  
  // Logging
  LOG_MAX_ROWS: 1000,
  LOG_LEVEL_ORDER: { 'TRACE': 10, 'INFO': 20, 'WARNING': 30, 'ERROR': 40 },
  
  // Time formats
  TIME_FORMAT_DATE: 'yyyy-MM-dd',
  TIME_FORMAT_DATETIME: 'yyyy-MM-dd HH:mm:ss',
  
  // Regex patterns (as strings; compile where used)
  REGEX: {
    DATE_ONLY: '^(\\d{4})-(\\d{2})-(\\d{2})$',
    DATETIME_LOCAL: '^(\\d{4})-(\\d{2})-(\\d{2})\\s+(\\d{2}):(\\d{2}):(\\d{2})$',
    DATETIME_ISO: '^(\\d{4})-(\\d{2})-(\\d{2})[T\\s](\\d{2}):(\\d{2}):(\\d{2})(?:\\.\\d+)?(Z)?$',
    END_TIME_TOKENS: '\\d{4}-\\d{2}-\\d{2}\\s+(\\d{2}):(\\d{2}):(\\d{2})$',
    CHESS_COM_GAME_ID: 'game/(live|daily)/(\\d+)',
    PGN_HEADER: '^\\[(\\\w+)\\s+"(.*)"\\]$',
    CLOCK_TAG: '\\[%clk\\s+([\\d:\\.]*)\\]'
  },
  
  // Sheets in the new architecture
  SHEETS: {
    GAMES: 'Games',
    DAILY_STATS: 'Daily Stats',
    CONFIG: 'Config',
    LOGS: 'Logs',
    WORK_QUEUE: 'WorkQueue'
  },
  
  // Queue configuration
  QUEUE: {
    TYPES: ['pgn_parse', 'callback_enrich', 'heavy_derivation'],
    STATUSES: ['pending', 'completed', 'failed'],
    HEADERS: ['id', 'type', 'key', 'url', 'status', 'attempts', 'nextAttemptAt', 'lastError', 'payload', 'addedAt', 'updatedAt'],
    MAX_ATTEMPTS: 3,
    BACKOFF_BASE_MS: 2000,
    BACKOFF_JITTER_MS: 500
  },
  
  // Health statuses
  HEALTH: {
    UNKNOWN: 'Unknown',
    OK: 'OK',
    ERROR: 'Error',
    UNREACHABLE: 'Unreachable'
  },
  
  // API endpoints and headers
  API: {
    BASE_URL: 'https://api.chess.com/pub',
    CALLBACK_BASE_URL: 'https://www.chess.com/callback',
    USER_AGENT: 'Chess.com Logger Google Apps Script',
    HEADER_RETRY_AFTER: 'Retry-After'
  },
  
  // Formats/variants
  FORMATS: {
    MAIN: ['bullet', 'blitz', 'rapid'],
    EXTENDED: ['daily', 'live960', 'daily960'],
    VARIANTS: ['bughouse', 'crazyhouse', 'threecheck', 'koth', 'antichess', 'atomic', 'horde', 'racingkings']
  },
  
  // Derivation (heavy) fields computed asynchronously
  DERIVATION_HEAVY_FIELDS: [
    'game_duration_seconds', 'move_count', 'ply_count', 'moves_san', 'moves_numbered',
    'clocks', 'clock_seconds', 'time_per_move'
  ],
  
  // Header registry (canonical names and group metadata). Order here is default; user can override via Headers sheet.
  HEADERS: {
    GAMES: [
      // Identity & links
      'url', 'rated',
      // Timing (light)
      'time_control', 'start', 'end', 'date', 'year', 'month', 'day', 'hour', 'minute', 'second',
      // Players
      'white_username', 'white_rating', 'white_result', 'black_username', 'black_rating', 'black_result',
      // Metadata
      'rules', 'time_class', 'format', 'eco', 'eco_url', 'termination',
      // Perspective
      'my_color', 'my_username', 'my_rating', 'my_outcome', 'opponent_username', 'opponent_rating', 'opponent_outcome',
      // Overall outcome
      'overall_outcome_numeric',
      // Parsed time control
      'base_time_seconds', 'increment_seconds',
      // Callback-derived (optional)
      'my_pregame_rating', 'opponent_pregame_rating', 'my_rating_change_callback', 'opponent_rating_change_callback',
      'white_accuracy', 'black_accuracy', 'callback_processed', 'callback_timestamp', 'callback_game_id',
      // Heavy (async)
      'game_duration_seconds', 'move_count', 'ply_count', 'moves_san', 'moves_numbered', 'clocks', 'clock_seconds', 'time_per_move',
      // Processing
      'processed_timestamp', 'processing_version'
    ],
    DAILY_STATS_CORE: [
      // Will be programmatically expanded per format
      'date'
    ]
  },
  
  // Header grouping metadata for UX (color/hidden defaults by header)
  HEADER_GROUPS: {
    groups: {
      Identity: '#E3F2FD',
      Time: '#FFF3E0',
      Players: '#E8F5E9',
      Results: '#F3E5F5',
      Metadata: '#FCE4EC',
      Callback: '#E0F7FA',
      Heavy: '#FFEBEE',
      Processing: '#ECEFF1'
    },
    map: {
      // Identity
      'url': { group: 'Identity', hidden: false },
      'rated': { group: 'Identity', hidden: false },
      // Time
      'time_control': { group: 'Time', hidden: false },
      'start': { group: 'Time', hidden: false },
      'end': { group: 'Time', hidden: false },
      'date': { group: 'Time', hidden: false },
      'year': { group: 'Time', hidden: true },
      'month': { group: 'Time', hidden: true },
      'day': { group: 'Time', hidden: true },
      'hour': { group: 'Time', hidden: true },
      'minute': { group: 'Time', hidden: true },
      'second': { group: 'Time', hidden: true },
      'base_time_seconds': { group: 'Time', hidden: true },
      'increment_seconds': { group: 'Time', hidden: true },
      // Players
      'white_username': { group: 'Players', hidden: false },
      'white_rating': { group: 'Players', hidden: false },
      'white_result': { group: 'Players', hidden: true },
      'black_username': { group: 'Players', hidden: false },
      'black_rating': { group: 'Players', hidden: false },
      'black_result': { group: 'Players', hidden: true },
      'my_color': { group: 'Players', hidden: false },
      'my_username': { group: 'Players', hidden: true },
      'my_rating': { group: 'Players', hidden: false },
      'opponent_username': { group: 'Players', hidden: false },
      'opponent_rating': { group: 'Players', hidden: false },
      // Results
      'my_outcome': { group: 'Results', hidden: false },
      'opponent_outcome': { group: 'Results', hidden: true },
      'overall_outcome_numeric': { group: 'Results', hidden: false },
      'termination': { group: 'Results', hidden: true },
      // Metadata
      'rules': { group: 'Metadata', hidden: true },
      'time_class': { group: 'Metadata', hidden: false },
      'format': { group: 'Metadata', hidden: false },
      'eco': { group: 'Metadata', hidden: true },
      'eco_url': { group: 'Metadata', hidden: true },
      // Callback
      'my_pregame_rating': { group: 'Callback', hidden: false },
      'opponent_pregame_rating': { group: 'Callback', hidden: true },
      'my_rating_change_callback': { group: 'Callback', hidden: true },
      'opponent_rating_change_callback': { group: 'Callback', hidden: true },
      'white_accuracy': { group: 'Callback', hidden: true },
      'black_accuracy': { group: 'Callback', hidden: true },
      'callback_processed': { group: 'Callback', hidden: true },
      'callback_timestamp': { group: 'Callback', hidden: true },
      'callback_game_id': { group: 'Callback', hidden: true },
      // Heavy
      'game_duration_seconds': { group: 'Heavy', hidden: true },
      'move_count': { group: 'Heavy', hidden: true },
      'ply_count': { group: 'Heavy', hidden: true },
      'moves_san': { group: 'Heavy', hidden: true },
      'moves_numbered': { group: 'Heavy', hidden: true },
      'clocks': { group: 'Heavy', hidden: true },
      'clock_seconds': { group: 'Heavy', hidden: true },
      'time_per_move': { group: 'Heavy', hidden: true },
      // Processing
      'processed_timestamp': { group: 'Processing', hidden: true },
      'processing_version': { group: 'Processing', hidden: true }
    }
  },
  
  // Variants
  VARIANTS: [
    'chess', 'chess960', 'bughouse', 'crazyhouse', 'threecheck',
    'koth', 'antichess', 'atomic', 'horde', 'racingkings'
  ]
};
}
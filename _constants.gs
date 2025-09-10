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
  
  // Variants
  VARIANTS: [
    'chess', 'chess960', 'bughouse', 'crazyhouse', 'threecheck',
    'koth', 'antichess', 'atomic', 'horde', 'racingkings'
  ]
};
}
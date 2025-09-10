/**
 * System Constants
 * This file loads first to ensure constants are available to all other modules
 */

/**
 * Constants for the system
 */
const CONSTANTS = {
  BATCH_SIZE: 100,
  CALLBACK_BATCH_SIZE: 50,
  MAX_EXECUTION_TIME: 300000, // 5 minutes in milliseconds
  API_RATE_LIMIT: 300, // requests per hour
  API_RATE_PERIOD: 3600000, // 1 hour in milliseconds
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000, // 2 seconds
  
  // Time formats to classify games
  TIME_CONTROLS: {
    BULLET: [60, 180], // 1-3 minutes
    BLITZ: [180, 600], // 3-10 minutes  
    RAPID: [600, 1800], // 10-30 minutes
    DAILY: [86400, Infinity] // 1+ days
  },
  
  // Variants
  VARIANTS: [
    'chess', 'chess960', 'bughouse', 'crazyhouse', 'threecheck',
    'koth', 'antichess', 'atomic', 'horde', 'racingkings'
  ]
};
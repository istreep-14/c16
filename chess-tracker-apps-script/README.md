# Chess Tracker (Apps Script)

Google Apps Script project to track Chess.com games into Google Sheets with monthly Drive blobs and daily aggregations.

## Setup

1. Create a Google Sheet to store data. Copy its ID.
2. Create an Apps Script project (clasp or editor) and add these files.
3. Set Script Properties:
   - `username`: your Chess.com username
   - `spreadsheetId`: the target Google Sheet ID
   - (optional) `schema_version`: `1`
4. Run `setupProject()` once to create sheets, headers, and Drive folders.
5. Run `installTriggers()` to schedule hourly/daily jobs.

### Historical backfill (first run)

1. Run `startBackfill()` to index all archive months.
2. Run `continueBackfill()` repeatedly until it reports `Remaining: 0`.
   - Optional: run `installBackfillTrigger()` to process every 10 minutes, then `removeBackfillTriggers()` when done.
3. Run `recomputeAllDailyStats()` to populate the `DailyStats` sheet across all history.

## Sheets

- `Games` (PK `game_id`):
  - game_id, archive_month, date_key, start_time_iso, end_time_iso, time_class, rated, rules, color, opponent, opponent_rating, result, url, pgn_file_id, pgn_offset_start, pgn_offset_end
- `GameMeta`:
  - game_id, callback_status, callback_file_id, callback_error, last_updated_iso
- `DailyStats` (PK `date_key`+`time_class`):
  - date_key, time_class, games_played, wins, losses, draws, streak, rating_start, rating_end, avg_opponent_rating, last_computed_iso
- `Archives` (PK `archive_month`):
  - archive_month, status, json_file_id, pgn_file_id, etag, total_games, last_checked_iso
- `Errors` (optional):
  - ts_iso, stage, game_id, message

## Drive structure

- ChessTracker/archives/json/{username}_{YYYY-MM}.json
- ChessTracker/archives/pgn/{username}_{YYYY-MM}.pgn

## Triggers

- Hourly: `fetchNewGamesAndEnqueueCallbacks`
- Hourly (staggered): `processCallbacksBatch`
- Daily: `updateDailyStatsAndSeal`
- Temporary: `continueBackfill` during initial backfill

## Notes

- Writes are batched to minimize Apps Script quotas.
- Months are frozen once final; days are sealed after all callbacks.
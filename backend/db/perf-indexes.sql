-- Performance indexes for bitcoinz_explorer (proposed; NOT applied automatically).
--
-- Run each statement on its own (CREATE/DROP INDEX CONCURRENTLY cannot run
-- inside a transaction block), e.g.:
--   psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f backend/db/perf-indexes.sql
-- CONCURRENTLY does not block the indexer's writes, but each build reads the
-- whole table, so run it off-peak. If a build fails it leaves an INVALID index:
-- drop it and rerun.

-- Serves addressMonitorService's periodic check, the bulk
-- "UPDATE addresses ... WHERE balance != (CASE ...)" (a full scan of ~1.6M rows
-- every run). The partial index holds only inconsistent rows (normally none),
-- so the check becomes an empty index scan. The predicate must stay textually
-- identical to the query's WHERE clause for the planner to use it.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_addresses_inconsistent_balance
  ON addresses (address)
  WHERE balance != (CASE WHEN (total_received - total_sent) < 0 THEN 0 ELSE (total_received - total_sent) END);

-- Serves getAddressBalanceHistory's height -> time lookup
-- ("SELECT height, time FROM blocks WHERE height = ANY($1)", up to ~300k heights
-- for busy addresses) as an index-only scan instead of 1 heap fetch per block.
-- It can also replace the duplicate idx_blocks_height (see below).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blocks_height_incl_time
  ON blocks (height) INCLUDE (time);


-- ---------------------------------------------------------------------------
-- Optional clean-up: unused / duplicate indexes (pg_stat_user_indexes showed
-- idx_scan = 0 for all of these on 2026-10-23). Each one slows down every
-- indexer insert and takes space in shared_buffers / page cache.
-- Review before running; they are commented out on purpose.
-- ---------------------------------------------------------------------------

-- GIN on transactions.vin (1.26 GB, never used; no query filters on vin with @>):
-- DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_vin;

-- GIN on transactions.vout (1.51 GB, never used):
-- DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_vout;

-- Duplicate of the UNIQUE constraint index blocks_height_key (48 MB):
-- DROP INDEX CONCURRENTLY IF EXISTS idx_blocks_height;

-- blocks.previousblockhash / nextblockhash are never used for lookups (428 MB):
-- DROP INDEX CONCURRENTLY IF EXISTS idx_blocks_prev_hash;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_blocks_next_hash;


-- ---------------------------------------------------------------------------
-- Optional maintenance (also not applied). "addresses" was last autovacuumed
-- 2026-06-29 (319k dead tuples; the wealth distribution's index-only scan
-- needed 689k heap fetches because the visibility map is stale), and "blocks"
-- in March.
-- ---------------------------------------------------------------------------
-- ALTER TABLE addresses SET (autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.02);
-- ALTER TABLE transactions SET (autovacuum_vacuum_scale_factor = 0.05, autovacuum_analyze_scale_factor = 0.02);
-- ALTER TABLE blocks SET (autovacuum_vacuum_insert_scale_factor = 0.05);
-- VACUUM (ANALYZE) addresses;

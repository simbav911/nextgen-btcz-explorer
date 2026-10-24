// Real chart data (block size, block interval, difficulty, mining revenue,
// historical network stats) aggregated from the `blocks` and `transactions`
// tables.
//
// Long ranges are served from an in-memory per-hour rollup of the whole chain:
//   - block metrics: one sequential scan of `blocks` at startup (~5-7 s, runs
//     in the background) and once a day, plus a cheap refresh of the last few
//     hours (time index) at most once a minute
//   - coinbase revenue: filled per hour from `transactions` (time index) in
//     throttled 30-day chunks, newest first; an hour is (re)loaded whenever its
//     coinbase count differs from its block count, so backfilled or reorged
//     blocks are picked up automatically
//   - both are saved to a JSON snapshot so a restart does not rescan the chain
// Ranges that need buckets shorter than one hour (<= ~2 days) are aggregated
// directly in SQL on the `blocks.time` / `transactions.time` indexes.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { getSequelize } = require('../db');
const logger = require('../utils/logger');
const { createBoundedMap } = require('../utils/cache');

const HOUR = 3600;
const DAY = 86400;
const MAX_POINTS = 250;
// Bucket sizes (seconds) to pick from; the smallest one giving <= MAX_POINTS wins
const BUCKETS = [600, 900, 1800, HOUR, 2 * HOUR, 3 * HOUR, 4 * HOUR, 6 * HOUR, 12 * HOUR,
  DAY, 2 * DAY, 3 * DAY, 7 * DAY, 14 * DAY, 30 * DAY, 60 * DAY];
// Expected work per unit of difficulty: 2^256 / powLimit (0x0007ffff...) = 2^13
const WORK_PER_DIFFICULTY = 8192;

const TAIL_HOURS = 3;               // hours re-read on every tail refresh
const TAIL_TTL_MS = 60 * 1000;
const FULL_REFRESH_MS = 24 * 3600 * 1000;
const REVENUE_CHUNK_HOURS = 30 * 24;
const REVENUE_RETRY_MS = 6 * 3600 * 1000; // an hour that stays inconsistent is retried this often
const START_DELAY_MS = 15 * 1000;
const SNAPSHOT_FILE = process.env.CHART_ROLLUP_FILE ||
  path.join(os.tmpdir(), 'btcz-explorer-chart-rollup.json');
const SNAPSHOT_VERSION = 1;

// hour -> [blocks, sizeSum, difficultySum, txSum, minHeight, maxHeight, minTime, maxTime]
let blockHours = new Map();
// hour -> [coinbaseCount, coinbaseValueSum]
const revenueHours = new Map();
const revenueAttempted = new Map(); // hour -> ms timestamp of last load attempt
let sortedHours = null;             // sorted keys of blockHours, rebuilt lazily

let readyPromise = null;
let tailPromise = null;
let lastTailRefresh = 0;
let repairPromise = null;
let started = false;

const responseCache = createBoundedMap(200);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nowSec = () => Math.floor(Date.now() / 1000);

/** Run a read-only query with its own statement_timeout */
async function query(sql, bind, timeoutMs = 20000) {
  const sequelize = getSequelize();
  if (!sequelize) throw new Error('Database not available');
  return sequelize.transaction(async (transaction) => {
    await sequelize.query(`SET LOCAL statement_timeout = ${parseInt(timeoutMs, 10)}`, { transaction });
    const [rows] = await sequelize.query(sql, { bind, transaction });
    return rows;
  });
}

// --- SQL -------------------------------------------------------------------

// $1 = from (unix, inclusive), $2 = to (exclusive), $3 = bucket seconds, $4 = anchor
// Bucket index = floor((time - anchor) / bucket); anchor is a multiple of the bucket
const BLOCK_BUCKETS_SQL = `
  SELECT (time - $4) / $3 AS b, count(*)::int AS n, sum(size)::float8 AS size,
         sum(difficulty)::float8 AS diff, sum(cardinality(tx))::int AS txs,
         min(height) AS min_h, max(height) AS max_h, min(time) AS min_t, max(time) AS max_t
  FROM blocks WHERE time >= $1 AND time < $2 GROUP BY 1`;

const REVENUE_BUCKETS_SQL = `
  SELECT (time - $4) / $3 AS b, count(*)::int AS n,
         sum((SELECT sum((v->>'value')::numeric) FROM jsonb_array_elements(vout) v))::float8 AS cb
  FROM transactions WHERE is_coinbase AND time >= $1 AND time < $2 GROUP BY 1`;

// Same, but finding each block's coinbase as its first transaction. Slower
// (one primary-key probe per block), used only where the query above does not
// match the block count (coinbase rows with is_coinbase not set).
const REVENUE_BY_BLOCK_SQL = `
  SELECT (bl.time - $4) / $3 AS b, count(*)::int AS n,
         sum((SELECT sum((v->>'value')::numeric) FROM jsonb_array_elements(t.vout) v))::float8 AS cb
  FROM blocks bl JOIN transactions t ON t.txid = bl.tx[1]
  WHERE bl.time >= $1 AND bl.time < $2 GROUP BY 1`;

const PREV_BLOCK_SQL = `
  SELECT height, time FROM blocks WHERE time < $1 ORDER BY time DESC LIMIT 1`;

const INT_MAX = 2147483647;

// --- hourly rollup -----------------------------------------------------------

function setBlockRows(map, rows) {
  for (const r of rows) {
    map.set(Number(r.b), [r.n, r.size, r.diff, r.txs, r.min_h, r.max_h, r.min_t, r.max_t]);
  }
}

async function loadBlockHours(fromHour, toHour, timeoutMs) {
  return query(BLOCK_BUCKETS_SQL, [fromHour * HOUR, Math.min(toHour * HOUR, INT_MAX), HOUR, 0], timeoutMs);
}

/** Rebuild the block rollup for the whole chain (one sequential scan) */
async function fullBlockRefresh() {
  const t0 = Date.now();
  const rows = await loadBlockHours(0, Math.ceil(INT_MAX / HOUR), 90000);
  const map = new Map();
  setBlockRows(map, rows);
  blockHours = map;
  sortedHours = null;
  lastTailRefresh = 0;
  logger.info(`Chart rollup: loaded ${map.size} block-hours in ${Date.now() - t0} ms`);
}

/** Re-read blocks and coinbase revenue for hours >= fromHour */
async function refreshFrom(fromHour) {
  const toHour = Math.ceil(INT_MAX / HOUR);
  const [blockRows, revRows] = await Promise.all([
    loadBlockHours(fromHour, toHour),
    query(REVENUE_BUCKETS_SQL, [fromHour * HOUR, INT_MAX, HOUR, 0])
  ]);
  for (const h of [...blockHours.keys()]) if (h >= fromHour) blockHours.delete(h);
  for (const h of [...revenueHours.keys()]) if (h >= fromHour) revenueHours.delete(h);
  setBlockRows(blockHours, blockRows);
  for (const r of revRows) revenueHours.set(Number(r.b), [r.n, r.cb]);
  sortedHours = null;
  const inconsistent = blockRows.some((r) => !revenueConsistent(Number(r.b))) ||
    revRows.some((r) => !revenueConsistent(Number(r.b)));
  if (inconsistent) {
    const rows = await query(REVENUE_BY_BLOCK_SQL, [fromHour * HOUR, INT_MAX, HOUR, 0]);
    for (const h of [...revenueHours.keys()]) if (h >= fromHour) revenueHours.delete(h);
    for (const r of rows) revenueHours.set(Number(r.b), [r.n, r.cb]);
  }
}

function refreshTail() {
  if (Date.now() - lastTailRefresh < TAIL_TTL_MS) return Promise.resolve();
  if (!tailPromise) {
    tailPromise = refreshFrom(Math.floor(nowSec() / HOUR) - TAIL_HOURS)
      .then(() => { lastTailRefresh = Date.now(); })
      .catch((err) => logger.warn(`Chart rollup tail refresh failed: ${err.message}`))
      .finally(() => { tailPromise = null; });
  }
  return tailPromise;
}

function getSortedHours() {
  if (!sortedHours) sortedHours = [...blockHours.keys()].sort((a, b) => a - b);
  return sortedHours;
}

function lowerBound(arr, x) {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < x) lo = mid + 1; else hi = mid;
  }
  return lo;
}

// --- coinbase revenue backfill ---------------------------------------------

function revenueConsistent(h) {
  const b = blockHours.get(h);
  const r = revenueHours.get(h);
  return (b ? b[0] : 0) === (r ? r[0] : 0);
}

/** Hours whose coinbase data is missing or stale, newest first */
function hoursNeedingRevenue(retryAll) {
  const now = Date.now();
  const out = [];
  const consider = (h) => {
    if (revenueConsistent(h)) return;
    const attempted = revenueAttempted.get(h);
    if (!retryAll && attempted && now - attempted < REVENUE_RETRY_MS) return;
    out.push(h);
  };
  for (const h of blockHours.keys()) consider(h);
  for (const h of revenueHours.keys()) if (!blockHours.has(h)) consider(h);
  return out.sort((a, b) => b - a);
}

async function loadRevenueRange(fromHour, toHour, sql) {
  const rows = await query(sql, [fromHour * HOUR, toHour * HOUR, HOUR, 0], 60000);
  const now = Date.now();
  for (let h = fromHour; h < toHour; h++) {
    revenueHours.delete(h);
    revenueAttempted.set(h, now);
  }
  for (const r of rows) revenueHours.set(Number(r.b), [r.n, r.cb]);
}

/** Load `hours` (newest first) in ranges of at most chunkHours, throttled */
async function loadRevenueHours(hours, chunkHours, sql) {
  let i = 0;
  let queries = 0;
  while (i < hours.length) {
    const top = hours[i];
    let j = i;
    while (j + 1 < hours.length && hours[j + 1] > top - chunkHours) j++;
    const q0 = Date.now();
    await loadRevenueRange(hours[j], top + 1, sql);
    queries++;
    i = j + 1;
    // Keep the duty cycle around 50% so the node and the API stay responsive
    if (i < hours.length) await sleep(Math.max(200, Date.now() - q0));
  }
  return queries;
}

/** Load coinbase revenue for every inconsistent hour, in throttled chunks */
function repairRevenue(retryAll = false) {
  if (repairPromise) return repairPromise;
  repairPromise = (async () => {
    const pending = hoursNeedingRevenue(retryAll);
    if (pending.length === 0) return;
    const t0 = Date.now();
    logger.info(`Chart rollup: loading coinbase revenue for ${pending.length} hours`);
    let queries = await loadRevenueHours(pending, REVENUE_CHUNK_HOURS, REVENUE_BUCKETS_SQL);
    const stuck = pending.filter((h) => !revenueConsistent(h));
    if (stuck.length > 0) {
      logger.info(`Chart rollup: ${stuck.length} hours have coinbase rows without is_coinbase, loading by block`);
      queries += await loadRevenueHours(stuck, 24, REVENUE_BY_BLOCK_SQL);
    }
    logger.info(`Chart rollup: coinbase revenue loaded (${queries} queries, ${Date.now() - t0} ms)`);
    saveSnapshot();
  })()
    .catch((err) => logger.warn(`Chart rollup revenue load failed: ${err.message}`))
    .finally(() => { repairPromise = null; });
  return repairPromise;
}

// --- snapshot ----------------------------------------------------------------

function saveSnapshot() {
  try {
    const data = JSON.stringify({
      version: SNAPSHOT_VERSION,
      savedAt: Date.now(),
      blocks: [...blockHours],
      revenue: [...revenueHours]
    });
    const tmp = `${SNAPSHOT_FILE}.${process.pid}.tmp`;
    fs.writeFile(tmp, data, (err) => {
      if (err) return logger.warn(`Chart rollup snapshot not saved: ${err.message}`);
      fs.rename(tmp, SNAPSHOT_FILE, (err2) => {
        if (err2) logger.warn(`Chart rollup snapshot not saved: ${err2.message}`);
      });
    });
  } catch (err) {
    logger.warn(`Chart rollup snapshot not saved: ${err.message}`);
  }
}

/** Returns the snapshot's age in ms, or null if there is no usable snapshot */
function loadSnapshot() {
  try {
    const snap = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'));
    if (snap.version !== SNAPSHOT_VERSION || !Array.isArray(snap.blocks) || !Array.isArray(snap.revenue)) {
      return null;
    }
    blockHours = new Map(snap.blocks);
    for (const [h, v] of snap.revenue) revenueHours.set(h, v);
    sortedHours = null;
    return Date.now() - snap.savedAt;
  } catch (err) {
    if (err.code !== 'ENOENT') logger.warn(`Chart rollup snapshot ignored: ${err.message}`);
    return null;
  }
}

// --- lifecycle ---------------------------------------------------------------

function ensureReady() {
  if (!readyPromise) {
    readyPromise = (async () => {
      const age = loadSnapshot();
      if (age !== null && age < 7 * 24 * 3600 * 1000) {
        // Re-read everything newer than the snapshot (plus a margin) by index
        const fromHour = Math.floor((Date.now() - age) / 1000 / HOUR) - TAIL_HOURS;
        await refreshFrom(fromHour);
        lastTailRefresh = Date.now();
        logger.info(`Chart rollup: restored snapshot (${blockHours.size} block-hours, ${Math.round(age / 60000)} min old)`);
        // Full rescan later, to pick up blocks backfilled below the snapshot
        setTimeout(periodicRefresh, 3600 * 1000).unref();
      } else {
        blockHours = new Map();
        revenueHours.clear();
        await fullBlockRefresh();
        setTimeout(periodicRefresh, FULL_REFRESH_MS).unref();
      }
      repairRevenue();
    })().catch((err) => {
      readyPromise = null; // retry on the next request
      throw err;
    });
  }
  return readyPromise;
}

async function periodicRefresh() {
  try {
    await fullBlockRefresh();
    await repairRevenue(true);
  } catch (err) {
    logger.warn(`Chart rollup refresh failed: ${err.message}`);
  } finally {
    setTimeout(periodicRefresh, FULL_REFRESH_MS).unref();
  }
}

/** Warm the rollup in the background once the database is up */
function start() {
  if (started) return;
  started = true;
  const tryStart = () => {
    if (!getSequelize()) {
      setTimeout(tryStart, START_DELAY_MS).unref();
      return;
    }
    ensureReady().catch((err) => {
      logger.warn(`Chart rollup warm-up failed: ${err.message}`);
      setTimeout(tryStart, 5 * 60 * 1000).unref();
    });
  };
  setTimeout(tryStart, START_DELAY_MS).unref();
}

// --- series ------------------------------------------------------------------

function emptyBucket(start) {
  return { start, n: 0, size: 0, diff: 0, txs: 0, minH: null, maxH: null, minT: null, maxT: null,
    cbN: 0, cb: 0, revenueComplete: true };
}

function addBlocks(bucket, v) {
  const [n, size, diff, txs, minH, maxH, minT, maxT] = v;
  bucket.n += n;
  bucket.size += size;
  bucket.diff += diff;
  bucket.txs += txs;
  bucket.minH = bucket.minH === null ? minH : Math.min(bucket.minH, minH);
  bucket.maxH = bucket.maxH === null ? maxH : Math.max(bucket.maxH, maxH);
  bucket.minT = bucket.minT === null ? minT : Math.min(bucket.minT, minT);
  bucket.maxT = bucket.maxT === null ? maxT : Math.max(bucket.maxT, maxT);
}

/** Buckets [startHour + i*bucketHours, ...) for i < count, from the hourly rollup */
function bucketsFromRollup(startHour, bucketHours, count) {
  const buckets = [];
  for (let i = 0; i < count; i++) buckets.push(emptyBucket((startHour + i * bucketHours) * HOUR));
  const endHour = startHour + bucketHours * count;
  const hours = getSortedHours();
  for (let k = lowerBound(hours, startHour); k < hours.length && hours[k] < endHour; k++) {
    const h = hours[k];
    const bucket = buckets[Math.floor((h - startHour) / bucketHours)];
    addBlocks(bucket, blockHours.get(h));
    const r = revenueHours.get(h);
    if (r) { bucket.cbN += r[0]; bucket.cb += r[1]; }
    if (!revenueConsistent(h)) bucket.revenueComplete = false;
  }
  // Last block before the range, for the first bucket's interval
  const p = lowerBound(hours, startHour) - 1;
  const prevV = p >= 0 ? blockHours.get(hours[p]) : null;
  const prev = prevV ? { maxH: prevV[5], maxT: prevV[7] } : null;
  return { buckets, prev };
}

/** Buckets aggregated directly in SQL (for sub-hour bucket sizes) */
async function bucketsFromSql(from, to, bucketSec) {
  const [blockRows, revRows, prevRows] = await Promise.all([
    query(BLOCK_BUCKETS_SQL, [from, to, bucketSec, from]),
    query(REVENUE_BUCKETS_SQL, [from, to, bucketSec, from]),
    query(PREV_BLOCK_SQL, [from])
  ]);
  const count = Math.ceil((to - from) / bucketSec);
  const buckets = [];
  for (let i = 0; i < count; i++) buckets.push(emptyBucket(from + i * bucketSec));
  for (const r of blockRows) {
    addBlocks(buckets[Number(r.b)], [r.n, r.size, r.diff, r.txs, r.min_h, r.max_h, r.min_t, r.max_t]);
  }
  const addRevenue = (rows) => {
    for (const bucket of buckets) { bucket.cbN = 0; bucket.cb = 0; }
    for (const r of rows) {
      const bucket = buckets[Number(r.b)];
      bucket.cbN += r.n;
      bucket.cb += r.cb;
    }
    return buckets.every((bucket) => bucket.cbN === bucket.n);
  };
  if (!addRevenue(revRows)) {
    addRevenue(await query(REVENUE_BY_BLOCK_SQL, [from, to, bucketSec, from]));
  }
  for (const bucket of buckets) bucket.revenueComplete = bucket.cbN === bucket.n;
  const prev = prevRows[0] ? { maxH: prevRows[0].height, maxT: prevRows[0].time } : null;
  return { buckets, prev };
}

const round = (x, digits) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};

/** Derive per-bucket metrics; empty buckets are dropped */
function toPoints({ buckets, prev }) {
  const points = [];
  let last = prev;
  for (const b of buckets) {
    if (b.n === 0) continue;
    let interval = null;
    let span = null;
    if (last && b.maxH > last.maxH) {
      span = b.maxT - last.maxT;
      interval = span / (b.maxH - last.maxH);
    } else if (b.maxH > b.minH) {
      span = b.maxT - b.minT;
      interval = span / (b.maxH - b.minH);
    }
    points.push({
      start: b.start,
      blockHeight: b.maxH,
      blocks: b.n,
      transactions: b.txs,
      blockSize: Math.round(b.size / b.n),
      difficulty: round(b.diff / b.n, 4),
      interval: interval === null ? null : round(interval, 1),
      // Network solutions/s implied by the work done over the bucket
      hashrate: span > 0 ? Math.round((b.diff * WORK_PER_DIFFICULTY) / span) : null,
      revenue: b.revenueComplete ? round(b.cb, 4) : null,
      lastBlockTime: b.maxT
    });
    last = { maxH: b.maxH, maxT: b.maxT };
  }
  return points;
}

function pickBucket(spanSec) {
  const min = spanSec / MAX_POINTS;
  return BUCKETS.find((b) => b >= min) || BUCKETS[BUCKETS.length - 1];
}

function parseDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const t = Date.parse(`${s}T00:00:00Z`);
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
}

/**
 * Resolve the charts' query parameters to a time range.
 * The frontend sends `days` (1, 7, 30, 90, 365, or 3000 for "all time"),
 * `date` = the range's start day (UTC) and `range` (1d, 7d, ..., all, custom).
 * - range=all or days >= 3000: the whole chain
 * - range=custom: [date, date + days), cut off at now
 * - otherwise "the last `days` days up to now"; without `range`, a window that
 *   ended more than two days ago is taken as [date, date + days)
 */
function resolveRange({ days, date, range } = {}) {
  const now = nowSec();
  let d = parseInt(days, 10);
  if (!Number.isFinite(d) || d < 1) d = 30;
  if (d >= 3000 || range === 'all') return { allTime: true, live: true, from: null, to: now };
  const start = parseDate(date);
  const explicit = range === 'custom' || (range === undefined && start !== null && start + d * DAY < now - 2 * DAY);
  if (start !== null && explicit) {
    if (start + d * DAY <= now) return { allTime: false, live: false, from: start, to: start + d * DAY };
    return { allTime: false, live: true, from: Math.min(start, now - HOUR), to: now };
  }
  return { allTime: false, live: true, from: now - d * DAY, to: now };
}

/**
 * Chart series for a resolved range. Each point carries every metric; the
 * routes pick the one they need. Result is cached briefly.
 */
async function getSeries(rangeParams) {
  const r = resolveRange(rangeParams);
  const span = r.allTime ? null : r.to - r.from;
  const shortBucket = span !== null ? pickBucket(span) : null;

  if (shortBucket !== null && shortBucket < HOUR) {
    // Sub-hour buckets: aggregate in SQL. Bucket edges are aligned so the
    // cache key is stable; a live range ends at the last complete bucket.
    const to = r.live ? Math.floor(r.to / shortBucket) * shortBucket : r.to;
    const count = Math.ceil(span / shortBucket);
    const from = to - count * shortBucket;
    const key = `sql:${from}:${to}:${shortBucket}`;
    let result = responseCache.get(key);
    if (!result) {
      const points = toPoints(await bucketsFromSql(from, to, shortBucket));
      result = { from, to, bucketSeconds: shortBucket, partial: points.some((p) => p.revenue === null), points };
      responseCache.set(key, result, r.live ? 60 * 1000 : 10 * 60 * 1000);
    }
    return result;
  }

  await ensureReady();
  if (r.live) await refreshTail();
  const hours = getSortedHours();
  if (hours.length === 0) return { from: r.from, to: r.to, bucketSeconds: null, partial: false, points: [] };

  // Live ranges end at the last complete hour so every bucket is complete
  const endHour = r.live ? Math.floor(r.to / HOUR) : Math.ceil(r.to / HOUR);
  const startSec = r.allTime ? hours[0] * HOUR : r.from;
  const bucketSec = pickBucket(endHour * HOUR - startSec);
  const bucketHours = bucketSec / HOUR;
  const count = Math.max(1, Math.ceil((endHour * HOUR - startSec) / bucketSec));
  const startHour = endHour - count * bucketHours;
  const key = `rollup:${startHour}:${bucketHours}:${count}`;
  let result = responseCache.get(key);
  if (!result) {
    const points = toPoints(bucketsFromRollup(startHour, bucketHours, count));
    const partial = points.some((p) => p.revenue === null);
    result = { from: startHour * HOUR, to: endHour * HOUR, bucketSeconds: bucketSec, partial, points };
    // Incomplete revenue (backfill still running): don't keep it long
    responseCache.set(key, result, partial ? 15 * 1000 : 60 * 1000);
  }
  return result;
}

/**
 * Historical network stats: buckets aligned to calendar hours/days (UTC),
 * the last one being the current (incomplete) hour/day.
 */
async function getHistorical({ days, interval } = {}) {
  let d = parseInt(days, 10);
  if (!Number.isFinite(d) || d < 1) d = 7;
  d = Math.min(d, 3650);
  let bucketHours = (interval === 'hour' || d <= 2) ? 1 : 24;
  while ((d * 24) / bucketHours > 1000) bucketHours *= 2;
  const key = `hist:${d}:${bucketHours}`;
  const cached = responseCache.get(key);
  if (cached) return cached;

  await ensureReady();
  await refreshTail();
  const nowHour = Math.floor(nowSec() / HOUR);
  const endHour = (Math.floor(nowHour / bucketHours) + 1) * bucketHours;
  const count = Math.ceil((d * 24) / bucketHours);
  const startHour = endHour - count * bucketHours;
  const points = toPoints(bucketsFromRollup(startHour, bucketHours, count));
  const stats = points.map((p) => ({
    date: bucketHours >= 24
      ? new Date(p.start * 1000).toISOString().slice(0, 10)
      : new Date(p.start * 1000).toISOString(),
    blockHeight: p.blockHeight,
    blocks: p.blocks,
    difficulty: p.difficulty,
    hashrate: p.hashrate,
    transactions: p.transactions,
    avgBlockTime: p.interval,
    avgBlockSize: p.blockSize
  }));
  const result = { interval: bucketHours >= 24 ? 'day' : 'hour', days: d, stats };
  responseCache.set(key, result, 60 * 1000);
  return result;
}

module.exports = { start, getSeries, getHistorical, resolveRange };

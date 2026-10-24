// One-off: index heights in [from, to] that are missing from the blocks table.
// If a block's transactions are already stored (and so already counted in
// address balances), only the block row is inserted to avoid double counting.
// Usage (from backend/): node reindex-missing-blocks.js <from> <to>
// Note: `?` below is the jsonb key-exists operator; queries use bind ($n), not replacements.
require('dotenv').config();
const { initializeNodeConnection, executeRpcCommand } = require('./services/bitcoinzService');
const { initializeDatabase, getSequelize } = require('./db');
const { initializeModels, getBlock } = require('./models');
const { indexBlock } = require('./services/indexerService');

const [from, to] = process.argv.slice(2).map(Number);

const insertBlockRow = async (db, block) => {
  const BlockModel = await getBlock(db);
  await BlockModel.upsert({
    hash: block.hash,
    height: block.height,
    confirmations: block.confirmations,
    size: block.size,
    version: block.version,
    version_hex: block.versionHex,
    merkleroot: block.merkleroot,
    tx: block.tx,
    time: block.time,
    mediantime: block.mediantime,
    nonce: block.nonce,
    bits: block.bits,
    difficulty: block.difficulty,
    chainwork: block.chainwork,
    previousblockhash: block.previousblockhash,
    nextblockhash: block.nextblockhash
  });
};

const main = async () => {
  if (!from || !to) throw new Error('usage: node reindex-missing-blocks.js <from> <to>');
  await initializeNodeConnection();
  await initializeDatabase();
  initializeModels();
  const db = getSequelize();
  await db.query("SET statement_timeout = '10min'");

  const [missing] = await db.query(
    'SELECT h FROM generate_series($1::int, $2::int) h WHERE NOT EXISTS (SELECT 1 FROM blocks WHERE height = h) ORDER BY h',
    { bind: [from, to] }
  );
  console.log(`${missing.length} missing heights in ${from}..${to}`);

  const stats = { indexed: 0, rowOnly: 0, skipped: 0, failed: 0 };
  for (const { h } of missing) {
    try {
      const hash = await executeRpcCommand('getblockhash', [h], 20000);
      const block = await executeRpcCommand('getblock', [hash, 1], 30000);
      // Rows in raw RPC format were saved by the old address page code, which
      // never counted them in address balances; only indexer rows count
      const [[{ n }]] = await db.query(
        `SELECT count(*)::int AS n FROM transactions
         WHERE txid = ANY($1::varchar[])
           AND NOT COALESCE(vout->0 ? 'valueZat' OR vout->0->'scriptPubKey' ? 'asm', false)`,
        { bind: [block.tx] }
      );

      if (n === 0) {
        if (await indexBlock(h, false)) stats.indexed++;
        else { stats.failed++; console.error(`Failed to index block ${h}`); }
      } else if (n === block.tx.length) {
        await insertBlockRow(db, block);
        stats.rowOnly++;
      } else {
        stats.skipped++;
        console.error(`Skipped block ${h}: ${n}/${block.tx.length} txs already stored`);
      }
    } catch (err) {
      stats.failed++;
      console.error(`Failed block ${h}: ${err.message}`);
    }
    const done = stats.indexed + stats.rowOnly + stats.skipped + stats.failed;
    if (done % 500 === 0) console.log(`${done}/${missing.length}`, stats);
  }

  console.log('Done.', stats);
  await db.close();
  process.exit(0);
};

main().catch((err) => {
  console.error('reindex-missing-blocks failed:', err);
  process.exit(1);
});

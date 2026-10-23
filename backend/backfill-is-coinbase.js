// One-off: set transactions.is_coinbase, which the indexer never wrote
// (it passed `is_coinbase` instead of the model attribute `isCoinbase`).
// Usage (from backend/): node backfill-is-coinbase.js
require('dotenv').config();
const { initializeDatabase, getSequelize } = require('./db');

const BATCH = 50000; // blocks per update

const main = async () => {
  await initializeDatabase();
  const db = getSequelize();

  const [[{ lo, hi }]] = await db.query('SELECT min(height) AS lo, max(height) AS hi FROM blocks');
  let total = 0;

  for (let start = lo; start <= hi; start += BATCH) {
    // The coinbase is always the first tx of a block
    const [, result] = await db.query(`
      UPDATE transactions t SET is_coinbase = true
      FROM blocks b
      WHERE b.height BETWEEN $1 AND $2
        AND t.txid = b.tx[1]
        AND NOT t.is_coinbase
        AND t.vin->0->>'coinbase' IS NOT NULL
    `, { bind: [start, start + BATCH - 1] });
    total += result.rowCount;
    console.log(`${Math.min(start + BATCH - 1, hi)}/${hi}: ${total} updated`);
  }

  console.log(`Done. Marked ${total} coinbase transactions.`);
  await db.close();
  process.exit(0);
};

main().catch((err) => {
  console.error('backfill-is-coinbase failed:', err);
  process.exit(1);
});

// One-off: index heights in [from, to] that are missing from the blocks table.
// Usage (from backend/): node reindex-missing-blocks.js <from> <to>
require('dotenv').config();
const winston = require('winston');
const logger = require('./utils/logger');
const { initializeNodeConnection } = require('./services/bitcoinzService');
const { initializeDatabase, getSequelize } = require('./db');
const { initializeModels } = require('./models');
const { indexBlock } = require('./services/indexerService');

// Production logger has no transports; show indexer errors here
logger.add(new winston.transports.Console({ format: winston.format.simple() }));

const [from, to] = process.argv.slice(2).map(Number);

const main = async () => {
  if (!from || !to) throw new Error('usage: node reindex-missing-blocks.js <from> <to>');
  await initializeNodeConnection();
  await initializeDatabase();
  initializeModels();
  const db = getSequelize();

  const [missing] = await db.query(
    'SELECT h FROM generate_series($1::int, $2::int) h WHERE NOT EXISTS (SELECT 1 FROM blocks WHERE height = h) ORDER BY h',
    { bind: [from, to] }
  );

  let ok = 0;
  for (const { h } of missing) {
    if (await indexBlock(h, false)) ok++;
    else console.error(`Failed to index block ${h}`);
  }

  console.log(`Done. Indexed ${ok}/${missing.length} missing blocks.`);
  await db.close();
  process.exit(0);
};

main().catch((err) => {
  console.error('reindex-missing-blocks failed:', err);
  process.exit(1);
});

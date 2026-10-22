// One-off: replace stale blocks left in the DB by old one-block forks.
// Candidates come from the node's getchaintips (valid-fork branches).
// Usage (from backend/): node fix-stale-blocks.js [--dry-run]
require('dotenv').config();
const { initializeNodeConnection, executeRpcCommand } = require('./services/bitcoinzService');
const { initializeDatabase, getSequelize } = require('./db');
const { initializeModels } = require('./models');
const { replaceStaleBlock } = require('./services/indexerService');

const dryRun = process.argv.includes('--dry-run');

const main = async () => {
  await initializeNodeConnection();
  await initializeDatabase();
  initializeModels();
  const db = getSequelize();

  const tips = await executeRpcCommand('getchaintips', [], 60000);
  const heights = new Set();
  for (const tip of tips) {
    if (tip.status === 'active' || tip.branchlen > 10) continue;
    for (let h = tip.height - tip.branchlen + 1; h <= tip.height; h++) heights.add(h);
  }

  let fixed = 0;
  for (const height of [...heights].sort((a, b) => a - b)) {
    const [rows] = await db.query('SELECT hash FROM blocks WHERE height = $1', { bind: [height] });
    const nodeHash = await executeRpcCommand('getblockhash', [height], 20000);
    if (!rows[0] || rows[0].hash === nodeHash) continue;

    console.log(`Stale block at ${height}: DB ${rows[0].hash} != node ${nodeHash}`);
    if (dryRun) continue;
    if (await replaceStaleBlock(height)) fixed++;
    else console.error(`Failed to re-index block ${height}`);
  }

  console.log(`Done. ${dryRun ? 'Dry run, nothing changed.' : `Replaced ${fixed} stale blocks.`}`);
  await db.close();
  process.exit(0);
};

main().catch((err) => {
  console.error("fix-stale-blocks failed:", err);
  process.exit(1);
});

const mongoose = require('mongoose');

const StatisticsSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  blockHeight: {
    type: Number
  },
  difficulty: {
    type: Number
  },
  hashrate: {
    type: Number
  },
  supply: {
    type: Number
  },
  transactions: {
    type: Number
  },
  avgBlockTime: {
    type: Number
  },
  avgTxPerBlock: {
    type: Number
  },
  peerCount: {
    type: Number
  },
  mempool: {
    count: Number,
    size: Number,
    bytes: Number,
    usage: Number
  }
});

// Create indexes for better performance
StatisticsSchema.index({ timestamp: -1 });

module.exports = mongoose.model('Statistics', StatisticsSchema);

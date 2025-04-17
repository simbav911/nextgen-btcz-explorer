const mongoose = require('mongoose');

const BlockSchema = new mongoose.Schema({
  hash: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  height: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  confirmations: {
    type: Number,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  strippedsize: {
    type: Number
  },
  weight: {
    type: Number
  },
  version: {
    type: Number,
    required: true
  },
  versionHex: {
    type: String
  },
  merkleroot: {
    type: String,
    required: true
  },
  tx: {
    type: [String],
    required: true
  },
  time: {
    type: Number,
    required: true
  },
  mediantime: {
    type: Number
  },
  nonce: {
    type: String,
    required: true
  },
  bits: {
    type: String,
    required: true
  },
  difficulty: {
    type: Number,
    required: true
  },
  chainwork: {
    type: String
  },
  previousblockhash: {
    type: String,
    index: true
  },
  nextblockhash: {
    type: String,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create indexes for better performance
BlockSchema.index({ height: -1 });
BlockSchema.index({ time: -1 });
BlockSchema.index({ hash: 1 });

module.exports = mongoose.model('Block', BlockSchema);

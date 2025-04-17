const mongoose = require('mongoose');

const InputSchema = new mongoose.Schema({
  txid: {
    type: String,
    index: true
  },
  vout: {
    type: Number
  },
  scriptSig: {
    asm: String,
    hex: String
  },
  sequence: Number,
  coinbase: String,
  address: {
    type: String,
    index: true
  },
  value: {
    type: Number
  }
}, { _id: false });

const OutputSchema = new mongoose.Schema({
  value: {
    type: Number
  },
  n: {
    type: Number
  },
  scriptPubKey: {
    asm: String,
    hex: String,
    reqSigs: Number,
    type: String,
    addresses: {
      type: [String],
      index: true
    }
  },
  spentTxid: {
    type: String,
    index: true
  },
  spentIndex: {
    type: Number
  },
  spentHeight: {
    type: Number
  }
}, { _id: false });

const TransactionSchema = new mongoose.Schema({
  txid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  hash: {
    type: String,
    index: true
  },
  version: {
    type: Number
  },
  size: {
    type: Number
  },
  vsize: {
    type: Number
  },
  weight: {
    type: Number
  },
  locktime: {
    type: Number
  },
  blockhash: {
    type: String,
    index: true
  },
  confirmations: {
    type: Number
  },
  time: {
    type: Number,
    index: true
  },
  blocktime: {
    type: Number
  },
  vin: [InputSchema],
  vout: [OutputSchema],
  isCoinbase: {
    type: Boolean,
    default: false
  },
  fee: {
    type: Number
  },
  valueIn: {
    type: Number
  },
  valueOut: {
    type: Number
  },
  // Add Sapling features if needed
  valueBalance: {
    type: Number
  },
  fOverwintered: {
    type: Boolean
  },
  vShieldedSpend: {
    type: Array
  },
  vShieldedOutput: {
    type: Array
  },
  bindingSig: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create indexes for better performance
TransactionSchema.index({ 'vin.address': 1 });
TransactionSchema.index({ 'vout.scriptPubKey.addresses': 1 });
TransactionSchema.index({ time: -1 });

module.exports = mongoose.model('Transaction', TransactionSchema);

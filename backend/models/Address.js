const mongoose = require('mongoose');

const AddressSchema = new mongoose.Schema({
  address: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  balance: {
    type: Number,
    default: 0
  },
  totalReceived: {
    type: Number,
    default: 0
  },
  totalSent: {
    type: Number,
    default: 0
  },
  unconfirmedBalance: {
    type: Number,
    default: 0
  },
  txCount: {
    type: Number,
    default: 0
  },
  transactions: {
    type: [String],
    default: []
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// Create indexes for better performance
AddressSchema.index({ balance: -1 });
AddressSchema.index({ txCount: -1 });

module.exports = mongoose.model('Address', AddressSchema);

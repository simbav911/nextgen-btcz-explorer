const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  if (!sequelize) return null;
  
  const Transaction = sequelize.define('Transaction', {
    txid: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false
    },
    hash: {
      type: DataTypes.STRING
    },
    version: {
      type: DataTypes.INTEGER
    },
    size: {
      type: DataTypes.INTEGER
    },
    vsize: {
      type: DataTypes.INTEGER
    },
    weight: {
      type: DataTypes.INTEGER
    },
    locktime: {
      type: DataTypes.INTEGER
    },
    blockhash: {
      type: DataTypes.STRING
    },
    confirmations: {
      type: DataTypes.INTEGER
    },
    time: {
      type: DataTypes.INTEGER
    },
    blocktime: {
      type: DataTypes.INTEGER
    },
    vin: {
      type: DataTypes.JSONB
    },
    vout: {
      type: DataTypes.JSONB
    },
    isCoinbase: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    fee: {
      type: DataTypes.FLOAT
    },
    valueIn: {
      type: DataTypes.FLOAT
    },
    valueOut: {
      type: DataTypes.FLOAT
    },
    // Sapling specific fields
    valueBalance: {
      type: DataTypes.FLOAT
    },
    fOverwintered: {
      type: DataTypes.BOOLEAN
    },
    vShieldedSpend: {
      type: DataTypes.JSONB
    },
    vShieldedOutput: {
      type: DataTypes.JSONB
    },
    bindingSig: {
      type: DataTypes.STRING
    }
  }, {
    // Don't specify a fixed table name to work with existing tables
    indexes: [
      { fields: ['blockhash'] },
      { fields: ['time'] }
    ]
  });

  return Transaction;
};

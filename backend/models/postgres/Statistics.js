const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  if (!sequelize) return null;
  
  const Statistics = sequelize.define('Statistics', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    timestamp: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    blockHeight: {
      type: DataTypes.INTEGER
    },
    difficulty: {
      type: DataTypes.FLOAT
    },
    hashrate: {
      type: DataTypes.BIGINT
    },
    supply: {
      type: DataTypes.FLOAT
    },
    transactions: {
      type: DataTypes.INTEGER
    },
    avgBlockTime: {
      type: DataTypes.FLOAT
    },
    avgTxPerBlock: {
      type: DataTypes.FLOAT
    },
    peerCount: {
      type: DataTypes.INTEGER
    },
    mempool: {
      type: DataTypes.JSONB
    }
  }, {
    indexes: [
      { fields: ['timestamp'] }
    ]
  });

  return Statistics;
};

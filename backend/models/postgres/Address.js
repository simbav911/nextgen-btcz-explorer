const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  if (!sequelize) return null;
  
  const Address = sequelize.define('Address', {
    address: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false
    },
    balance: {
      type: DataTypes.FLOAT,
      defaultValue: 0
    },
    totalReceived: {
      type: DataTypes.FLOAT,
      defaultValue: 0
    },
    totalSent: {
      type: DataTypes.FLOAT,
      defaultValue: 0
    },
    unconfirmedBalance: {
      type: DataTypes.FLOAT,
      defaultValue: 0
    },
    txCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    transactions: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    lastUpdated: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    // Don't specify a fixed table name to work with existing tables
    indexes: [
      { fields: ['balance'] },
      { fields: ['txCount'] }
    ]
  });

  return Address;
};

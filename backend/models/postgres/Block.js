const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  if (!sequelize) return null;
  
  const Block = sequelize.define('Block', {
    hash: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false
    },
    height: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true
    },
    confirmations: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    size: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    strippedsize: {
      type: DataTypes.INTEGER
    },
    weight: {
      type: DataTypes.INTEGER
    },
    version: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    versionHex: {
      type: DataTypes.STRING
    },
    merkleroot: {
      type: DataTypes.STRING,
      allowNull: false
    },
    tx: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false
    },
    time: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    mediantime: {
      type: DataTypes.INTEGER
    },
    nonce: {
      type: DataTypes.STRING,
      allowNull: false
    },
    bits: {
      type: DataTypes.STRING,
      allowNull: false
    },
    difficulty: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    chainwork: {
      type: DataTypes.STRING
    },
    previousblockhash: {
      type: DataTypes.STRING
    },
    nextblockhash: {
      type: DataTypes.STRING
    }
  }, {
    indexes: [
      { fields: ['height'] },
      { fields: ['time'] },
      { fields: ['previousblockhash'] },
      { fields: ['nextblockhash'] }
    ]
  });

  return Block;
};

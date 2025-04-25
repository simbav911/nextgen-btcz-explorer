const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SyncStatus = sequelize.define('SyncStatus', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false
    },
    lastSyncedBlock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    isRunning: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'idle'
    },
    startTime: {
      type: DataTypes.DATE
    },
    endTime: {
      type: DataTypes.DATE
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'sync_status',
    timestamps: true
  });

  return SyncStatus;
};

import React, { useState, useEffect, useContext } from 'react';
import { SocketContext } from '../contexts/SocketContext';
import { statsService } from '../services/api';

const Status = () => {
  const [stats, setStats] = useState({
    networkInfo: {
      connections: 0,
      version: '',
      subversion: '',
      protocolversion: '',
    },
    blockchainInfo: {
      blocks: 0,
      headers: 0,
      bestblockhash: '',
      difficulty: 0,
      mediantime: 0,
      verificationprogress: 0
    },
    miningInfo: {
      networkhashps: 0,
      difficulty: 0
    },
    loading: true
  });

  const socket = useContext(SocketContext);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await statsService.getNetworkStats();
        setStats({
          ...response.data,
          loading: false
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
        setStats(prev => ({ ...prev, loading: false }));
      }
    };

    fetchStats();

    // Listen for updates from socket if available
    if (socket) {
      socket.on('stats_update', (newStats) => {
        setStats(prev => ({
          ...prev,
          ...newStats,
          loading: false
        }));
      });

      return () => {
        socket.off('stats_update');
      };
    }
  }, [socket]);

  const formatHashrate = (hashrate) => {
    if (hashrate === 0) return '0 H/s';
    
    const units = ['H/s', 'KH/s', 'MH/s', 'GH/s', 'TH/s', 'PH/s', 'EH/s'];
    const i = Math.floor(Math.log(hashrate) / Math.log(1000));
    
    return parseFloat((hashrate / Math.pow(1000, i)).toFixed(2)) + ' ' + units[i];
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Unknown';
    
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Network Status</h1>
      
      {stats.loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Blockchain Info */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Blockchain Information</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Current Block Height:</span>
                <span className="font-medium">{stats.blockchainInfo.blocks.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Current Block Hash:</span>
                <span className="font-mono text-sm truncate max-w-xs">{stats.blockchainInfo.bestblockhash}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Difficulty:</span>
                <span className="font-medium">{stats.blockchainInfo.difficulty.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Median Time:</span>
                <span className="font-medium">{formatTime(stats.blockchainInfo.mediantime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Sync Progress:</span>
                <span className="font-medium">{(stats.blockchainInfo.verificationprogress * 100).toFixed(2)}%</span>
              </div>
            </div>
          </div>
          
          {/* Network Info */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Network Information</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Network Hashrate:</span>
                <span className="font-medium">{formatHashrate(stats.miningInfo.networkhashps)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Connections:</span>
                <span className="font-medium">{stats.networkInfo.connections}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Version:</span>
                <span className="font-medium">{stats.networkInfo.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">User Agent:</span>
                <span className="font-medium">{stats.networkInfo.subversion}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Protocol Version:</span>
                <span className="font-medium">{stats.networkInfo.protocolversion}</span>
              </div>
            </div>
          </div>
          
          {/* Mining Info */}
          <div className="bg-white rounded-lg shadow-md p-6 md:col-span-2">
            <h2 className="text-xl font-semibold mb-4">Mining Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium text-gray-700 mb-2">Network Difficulty:</h3>
                <div className="text-2xl font-bold">{stats.miningInfo.difficulty.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                <p className="text-gray-500 text-sm mt-1">The current mining difficulty</p>
              </div>
              <div>
                <h3 className="font-medium text-gray-700 mb-2">Network Hashrate:</h3>
                <div className="text-2xl font-bold">{formatHashrate(stats.miningInfo.networkhashps)}</div>
                <p className="text-gray-500 text-sm mt-1">Estimated network hashing power</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Status;
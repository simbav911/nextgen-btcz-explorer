import React, { useState, useEffect, useContext } from 'react';
import { FaSync, FaCheck, FaExclamationTriangle } from 'react-icons/fa';

// Contexts
import { SocketContext } from '../contexts/SocketContext';

// Services
import api from '../services/api';

const SyncStatus = () => {
  const [syncInfo, setSyncInfo] = useState({
    status: 'unknown', // 'syncing', 'synced', 'error', 'unknown'
    progress: 0,
    currentBlock: 0,
    networkBlock: 0,
    lastUpdated: null
  });
  
  const socket = useContext(SocketContext);
  
  // Check sync status when component mounts
  useEffect(() => {
    const checkSyncStatus = async () => {
      try {
        const [blockchainResponse, statsResponse] = await Promise.all([
          api.get('/stats/blockchain'),
          api.get('/stats')
        ]);
        
        const blockchainInfo = blockchainResponse.data;
        const syncProgress = blockchainInfo.verificationprogress * 100;
        
        setSyncInfo({
          status: syncProgress > 99.9 ? 'synced' : 'syncing',
          progress: syncProgress,
          currentBlock: blockchainInfo.blocks,
          networkBlock: blockchainInfo.headers,
          lastUpdated: new Date()
        });
      } catch (error) {
        console.error('Error checking sync status:', error);
        setSyncInfo({
          status: 'error',
          progress: 0,
          currentBlock: 0,
          networkBlock: 0,
          lastUpdated: new Date()
        });
      }
    };
    
    checkSyncStatus();
    
    // Set up interval to check status every 30 seconds
    const interval = setInterval(checkSyncStatus, 30000);
    
    // Clean up on unmount
    return () => clearInterval(interval);
  }, []);
  
  // Listen for socket updates
  useEffect(() => {
    if (!socket) return;
    
    socket.on('stats_update', (stats) => {
      if (stats.blockchainInfo) {
        const syncProgress = stats.blockchainInfo.verificationprogress * 100;
        
        setSyncInfo({
          status: syncProgress > 99.9 ? 'synced' : 'syncing',
          progress: syncProgress,
          currentBlock: stats.blockchainInfo.blocks,
          networkBlock: stats.blockchainInfo.headers,
          lastUpdated: new Date()
        });
      }
    });
    
    socket.on('new_block', (block) => {
      setSyncInfo(prev => {
        // Only update if the block height is actually new
        if (prev.currentBlock !== block.height) {
          return {
            ...prev,
            currentBlock: block.height,
            lastUpdated: new Date()
          };
        }
        // Otherwise, return the previous state reference
        return prev;
      });
    });
    
    return () => {
      socket.off('stats_update');
      socket.off('new_block');
    };
  }, [socket]);
  
  // Render different status components
  const renderStatusContent = () => {
    switch (syncInfo.status) {
      case 'syncing':
        return (
          <div className="flex items-center space-x-2 text-yellow-600">
            <FaSync className="animate-spin" />
            <span>
              Syncing {syncInfo.progress.toFixed(2)}% - Block {syncInfo.currentBlock} of {syncInfo.networkBlock}
            </span>
          </div>
        );
      
      case 'synced':
        return (
          <div className="flex items-center space-x-2 text-green-600">
            <FaCheck />
            <span>Synced - Block {syncInfo.currentBlock}</span>
          </div>
        );
        
      case 'error':
        return (
          <div className="flex items-center space-x-2 text-red-600">
            <FaExclamationTriangle />
            <span>Sync Error - Please check server</span>
          </div>
        );
        
      default:
        return (
          <div className="flex items-center space-x-2 text-gray-600">
            <FaSync className="animate-spin" />
            <span>Checking sync status...</span>
          </div>
        );
    }
  };
  
  return (
    <div className="px-4 py-2 bg-gray-100 rounded-full text-sm">
      {renderStatusContent()}
    </div>
  );
};

export default React.memo(SyncStatus);

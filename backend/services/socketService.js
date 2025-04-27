const logger = require('../utils/logger');
const { getBestBlockHash, getBlock, getLatestTransactions } = require('./bitcoinzService');

// Store active socket connections and last emitted block hash
let io = null;
let lastEmittedBlockHash = null;

// Time intervals for different updates (in milliseconds)
const UPDATE_INTERVALS = {
  BLOCK: 3000,     // 3 seconds for more responsive updates
  TRANSACTION: 2000,  // 2 seconds for more responsive updates
  STATS: 30000     // 30 seconds
};

// Interval references for cleanup
let blockInterval = null;
let txInterval = null;
let statsInterval = null;

// Mock data for demo
const generateMockBlock = () => {
  const height = Math.floor(800000 + Math.random() * 100);
  return {
    hash: `000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce${height.toString().padStart(3, '0')}`,
    confirmations: 1,
    size: 285 + Math.floor(Math.random() * 1000),
    strippedsize: 285 + Math.floor(Math.random() * 800),
    weight: 1140 + Math.floor(Math.random() * 2000),
    height: height,
    version: 1,
    versionHex: '00000001',
    merkleroot: `4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afded${height.toString().padStart(3, '0')}`,
    tx: [
      `4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afded${height.toString().padStart(3, '0')}`,
      `5b6d2e5cbbc99f4a43518a99d42cd98f729f87784f3dd88bc3238c8bfeed${height.toString().padStart(3, '0')}`
    ],
    time: Math.floor(Date.now() / 1000),
    mediantime: Math.floor(Date.now() / 1000) - 300,
    nonce: Math.floor(Math.random() * 1000000000).toString(16),
    bits: '1d00ffff',
    difficulty: 21659.92476,
    chainwork: '0000000000000000000000000000000000000000000000000000000100010001',
    previousblockhash: `000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce${(height-1).toString().padStart(3, '0')}`,
    nextblockhash: null
  };
};

const generateMockTransaction = () => {
  const id = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return {
    txid: `4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda${id}`,
    hash: `4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda${id}`,
    version: 1,
    size: 135 + Math.floor(Math.random() * 200),
    vsize: 135 + Math.floor(Math.random() * 200),
    weight: 540 + Math.floor(Math.random() * 400),
    locktime: 0,
    vin: [
      {
        txid: `5b6d2e5cbbc99f4a43518a99d42cd98f729f87784f3dd88bc3238c8bfeed${id}`,
        vout: 0,
        scriptSig: {
          asm: 'OP_DUP OP_HASH160 f4c03610e60ad15100929cc23da2f3a799af1725 OP_EQUALVERIFY OP_CHECKSIG',
          hex: '76a914f4c03610e60ad15100929cc23da2f3a799af172588ac'
        },
        sequence: 4294967295,
        address: `t1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa${id.substring(0, 3)}`,
        value: Math.random() * 10
      }
    ],
    vout: [
      {
        value: Math.random() * 10,
        n: 0,
        scriptPubKey: {
          asm: 'OP_DUP OP_HASH160 f4c03610e60ad15100929cc23da2f3a799af1725 OP_EQUALVERIFY OP_CHECKSIG',
          hex: '76a914f4c03610e60ad15100929cc23da2f3a799af172588ac',
          reqSigs: 1,
          type: 'pubkey',
          addresses: [
            `t1KYZ8AM11Rj6uN4qDqJRGw6MCvXaV6u3a${id.substring(0, 2)}`
          ]
        }
      }
    ],
    blockhash: `000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce${id.substring(0, 3)}`,
    confirmations: Math.floor(Math.random() * 10),
    time: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 3600),
    blocktime: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 3600)
  };
};

/**
 * Setup Socket.io event handlers and update intervals
 */
const setupSocket = (socketIo) => {
  io = socketIo;
  
  // Handle new connections
  io.on('connection', (socket) => {
    const clientAddress = socket.handshake.address;
    logger.info(`New client connected: ${clientAddress}`);
    
    // Handle subscriptions to specific data
    socket.on('subscribe', (channel) => {
      logger.debug(`Client ${clientAddress} subscribed to ${channel}`);
      socket.join(channel);
      
      // Send immediate update to new subscribers
      if (channel === 'blocks' && lastEmittedBlockHash) {
        getBestBlockHash()
          .then(hash => getBlock(hash, 1))
          .then(block => {
            socket.emit('new_block', block);
          })
          .catch(err => logger.error(`Error sending initial block to new subscriber: ${err.message}`));
      }
    });
    
    // Handle unsubscriptions
    socket.on('unsubscribe', (channel) => {
      logger.debug(`Client ${clientAddress} unsubscribed from ${channel}`);
      socket.leave(channel);
    });
    
    // Handle disconnections
    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${clientAddress}`);
    });
  });
  
  // Start update intervals
  startUpdateIntervals();
  
  return io;
};

/**
 * Start all update intervals for real-time data
 */
const startUpdateIntervals = () => {
  // Clear any existing intervals
  clearUpdateIntervals();
  
  // Cache for storing previous data to reduce redundant emissions
  const dataCache = {
    lastTransactions: new Set()
  };
  
  // Update latest block
  blockInterval = setInterval(async () => {
    try {
      // Get the best block hash
      const blockHash = await getBestBlockHash();
      
      // Skip if we've already emitted this block
      if (blockHash === lastEmittedBlockHash) {
        return;
      }
      
      // Get the block data
      const block = await getBlock(blockHash, 1);
      
      // Verify we got valid block data
      if (!block || !block.hash) {
        logger.warn('Received invalid block data from RPC');
        return;
      }
      
      // Update the cache
      lastEmittedBlockHash = block.hash;
      
      // Emit to all connected clients
      io.to('blocks').emit('new_block', block);
      logger.debug(`Emitted new block ${block.height} to ${io.sockets.adapter.rooms.get('blocks')?.size || 0} clients`);
      
      // Also emit a notification in the 'general' room for UI updates
      io.to('general').emit('notification', {
        type: 'block',
        message: `New block #${block.height} mined`,
        data: {
          height: block.height,
          hash: block.hash,
          time: block.time
        }
      });
    } catch (error) {
      logger.error('Error updating latest block:', error);
      
      // Only use mock data in development environment for debugging
      if (process.env.NODE_ENV === 'development') {
        const mockBlock = generateMockBlock();
        if (mockBlock.hash !== lastEmittedBlockHash) {
          lastEmittedBlockHash = mockBlock.hash;
          io.to('blocks').emit('new_block', mockBlock);
          logger.debug('Emitted mock block due to error');
        }
      }
    }
  }, UPDATE_INTERVALS.BLOCK);
  
  // Update latest transactions
  txInterval = setInterval(async () => {
    try {
      // Get latest transactions from the node
      const transactions = await getLatestTransactions(8);
      
      // Filter out transactions we've already emitted
      const newTransactions = transactions.filter(tx => !dataCache.lastTransactions.has(tx.txid));
      
      // If we have new transactions, emit them
      if (newTransactions.length > 0) {
        // Update the cache with new txids (keep only the most recent 100)
        newTransactions.forEach(tx => {
          dataCache.lastTransactions.add(tx.txid);
          // Keep cache size reasonable
          if (dataCache.lastTransactions.size > 100) {
            const firstItem = dataCache.lastTransactions.values().next().value;
            dataCache.lastTransactions.delete(firstItem);
          }
        });
        
        // Emit to all connected clients
        io.to('transactions').emit('new_transactions', newTransactions);
        logger.debug(`Emitted ${newTransactions.length} new transactions to ${io.sockets.adapter.rooms.get('transactions')?.size || 0} clients`);
      }
    } catch (error) {
      logger.error('Error updating latest transactions:', error);
      
      // Only use mock data in development environment
      if (process.env.NODE_ENV === 'development') {
        const mockTransactions = Array(3).fill().map(() => generateMockTransaction());
        io.to('transactions').emit('new_transactions', mockTransactions);
        logger.debug('Emitted mock transactions due to error');
      }
    }
  }, UPDATE_INTERVALS.TRANSACTION);
  
  // Add a heartbeat to notify clients of server status
  const heartbeatInterval = setInterval(() => {
    io.emit('heartbeat', { timestamp: Date.now() });
  }, 15000); // Every 15 seconds
  
  // Store the heartbeat interval for cleanup
  statsInterval = heartbeatInterval;
};

/**
 * Clear all update intervals
 */
const clearUpdateIntervals = () => {
  if (blockInterval) clearInterval(blockInterval);
  if (txInterval) clearInterval(txInterval);
  if (statsInterval) clearInterval(statsInterval);
};

/**
 * Broadcast custom event to all connected clients or a specific room
 */
const broadcastEvent = (event, data, room = null) => {
  if (!io) {
    logger.error('Socket.io not initialized');
    return;
  }
  
  if (room) {
    io.to(room).emit(event, data);
  } else {
    io.emit(event, data);
  }
};

module.exports = {
  setupSocket,
  broadcastEvent,
  clearUpdateIntervals
};

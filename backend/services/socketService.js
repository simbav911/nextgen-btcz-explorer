const logger = require('../utils/logger');
const { getBestBlockHash, getBlock, getLatestTransactions } = require('./bitcoinzService');

// Store active socket connections and last emitted block hash
let io = null;
let lastEmittedBlockHash = null;

// Time intervals for different updates (in milliseconds)
const UPDATE_INTERVALS = {
  BLOCK: 10000,   // 10 seconds
  TRANSACTION: 5000,  // 5 seconds
  STATS: 30000    // 30 seconds
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
  
  // Update latest block
  blockInterval = setInterval(async () => {
    try {
      // Try to get real block data
      getBestBlockHash()
        .then(blockHash => getBlock(blockHash, 1))
        .then(block => {
          // Only emit if this is a new block
          if (block.hash !== lastEmittedBlockHash) {
            lastEmittedBlockHash = block.hash;
            io.to('blocks').emit('new_block', block);
          }
        })
        .catch(error => {
          // If there's an error, use mock data
          logger.error('Error updating latest block:', error);
          const mockBlock = generateMockBlock();
          if (mockBlock.hash !== lastEmittedBlockHash) {
            lastEmittedBlockHash = mockBlock.hash;
            io.to('blocks').emit('new_block', mockBlock);
          }
        });
    } catch (error) {
      logger.error('Error in block update interval:', error.message);
    }
  }, UPDATE_INTERVALS.BLOCK);
  
  // Update latest transactions
  txInterval = setInterval(async () => {
    try {
      // Try to get real transaction data
      getLatestTransactions(5)
        .then(transactions => {
          io.to('transactions').emit('new_transactions', transactions);
        })
        .catch(error => {
          // If there's an error, use mock data
          logger.error('Error updating latest transactions:', error);
          const mockTransactions = Array(5).fill().map(() => generateMockTransaction());
          io.to('transactions').emit('new_transactions', mockTransactions);
        });
    } catch (error) {
      logger.error('Error in transaction update interval:', error.message);
    }
  }, UPDATE_INTERVALS.TRANSACTION);
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

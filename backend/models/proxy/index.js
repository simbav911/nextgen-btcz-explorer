const { 
  getBlockchainInfo, 
  getBlock, 
  getBlockByHeight,
  getTransaction, 
  getLatestTransactions,
  getAddressInfo
} = require('../../services/bitcoinzService');

// Create proxy models that directly call RPC instead of using database
const createProxyModels = () => {
  // Block proxy model
  const Block = {
    findOne: async (query) => {
      try {
        if (query.hash) {
          return await getBlock(query.hash);
        } else if (query.height) {
          return await getBlockByHeight(query.height);
        }
        return null;
      } catch (error) {
        console.error('Error in Block.findOne:', error);
        return null;
      }
    },
    find: async (query = {}, options = {}) => {
      try {
        const info = await getBlockchainInfo();
        const bestHeight = info.blocks;
        
        const limit = options.limit || 10;
        const offset = options.offset || 0;
        
        let blocks = [];
        for (let i = 0; i < limit && (bestHeight - i - offset) >= 0; i++) {
          const height = bestHeight - i - offset;
          const block = await getBlockByHeight(height);
          blocks.push(block);
        }
        
        return blocks;
      } catch (error) {
        console.error('Error in Block.find:', error);
        return [];
      }
    }
  };
  
  // Transaction proxy model
  const Transaction = {
    findOne: async (query) => {
      try {
        if (query.txid) {
          return await getTransaction(query.txid);
        }
        return null;
      } catch (error) {
        console.error('Error in Transaction.findOne:', error);
        return null;
      }
    },
    find: async (query = {}, options = {}) => {
      try {
        const limit = options.limit || 10;
        return await getLatestTransactions(limit);
      } catch (error) {
        console.error('Error in Transaction.find:', error);
        return [];
      }
    }
  };
  
  // Address proxy model
  const Address = {
    findOne: async (query) => {
      try {
        if (query.address) {
          return await getAddressInfo(query.address);
        }
        return null;
      } catch (error) {
        console.error('Error in Address.findOne:', error);
        return null;
      }
    }
  };
  
  // Statistics proxy model - mostly returns cache objects
  const Statistics = {
    findOne: async () => {
      try {
        const info = await getBlockchainInfo();
        // Create statistics object from blockchain info
        return {
          timestamp: new Date(),
          blockHeight: info.blocks,
          difficulty: info.difficulty,
          supply: 0, // Would need additional RPC call
          transactions: 0 // Would need additional RPC call
        };
      } catch (error) {
        console.error('Error in Statistics.findOne:', error);
        return null;
      }
    },
    find: async () => {
      // For historical stats, this is a placeholder
      // In a real implementation, you would store historical data
      return [];
    }
  };
  
  return { Block, Transaction, Address, Statistics };
};

module.exports = { createProxyModels };

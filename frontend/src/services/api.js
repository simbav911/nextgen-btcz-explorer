import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

// Create axios instance with base URL
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// API endpoints for blocks
export const blockService = {
  getLatestBlocks: (limit = 10, offset = 0) => {
    return api.get(`/blocks?limit=${limit}&offset=${offset}`);
  },
  getBlockByHash: (hash) => {
    return api.get(`/blocks/hash/${hash}`);
  },
  getBlockByHeight: (height) => {
    return api.get(`/blocks/height/${height}`);
  },
  getLatestBlock: () => {
    return api.get('/blocks/latest');
  },
};

// API endpoints for transactions
export const transactionService = {
  getLatestTransactions: (limit = 10, offset = 0) => {
    return api.get(`/transactions?limit=${limit}&offset=${offset}`);
  },
  getTransaction: (txid) => {
    return api.get(`/transactions/${txid}`);
  },
  getBlockTransactions: (blockhash) => {
    return api.get(`/transactions/block/${blockhash}`);
  },
};

// API endpoints for addresses
export const addressService = {
  getAddressInfo: (address) => {
    return api.get(`/addresses/${address}`);
  },
  getAddressTransactions: (address, limit = 10, offset = 0) => {
    return api.get(`/addresses/${address}/transactions?limit=${limit}&offset=${offset}`);
  },
  getAddressBalance: (address) => {
    return api.get(`/addresses/${address}/balance`);
  },
};

// API endpoints for stats
export const statsService = {
  getNetworkStats: () => {
    return api.get('/stats');
  },
  getHistoricalStats: (days = 7, interval = 'day') => {
    return api.get(`/stats/historical?days=${days}&interval=${interval}`);
  },
  getBlockchainInfo: () => {
    return api.get('/stats/blockchain');
  },
};

// API endpoint for search
export const searchService = {
  search: (query) => {
    return api.get(`/search?query=${encodeURIComponent(query)}`);
  },
};

// Export instance for direct use or custom requests
export default api;

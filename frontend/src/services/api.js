import axios from 'axios';
import config from '../config';

const API_URL = config.api.baseUrl;
const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';

// Create axios instance with base URL
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create axios instance for CoinGecko API
const coingeckoApi = axios.create({
  baseURL: COINGECKO_API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Simple cache implementation
const apiCache = {
  data: {},

  // Get data from cache
  get(key) {
    const cachedItem = this.data[key];
    if (!cachedItem) return null;

    // Check if the cache entry is still valid
    if (Date.now() > cachedItem.expiry) {
      delete this.data[key];
      return null;
    }

    return cachedItem.data;
  },

  // Set data in cache with expiration
  set(key, data, ttlMs = 5000) { // Default TTL: 5 seconds
    this.data[key] = {
      data,
      expiry: Date.now() + ttlMs
    };
  },

  // Clear all cache or specific key
  clear(key) {
    if (key) {
      delete this.data[key];
    } else {
      this.data = {};
    }
  }
};

// Add caching interceptor
api.interceptors.request.use(config => {
  // Only process GET requests for caching
  if (config.method !== 'get') {
    return config;
  }

  const cacheKey = `${config.url}?${JSON.stringify(config.params || {})}`;
  const cachedResponse = apiCache.get(cacheKey);

  if (cachedResponse) {
    console.log(`Using cached response for ${config.url}`);
    return {
      ...config,
      adapter: () => {
        // If a cancelToken is provided and has been used, reject the promise.
        if (config.cancelToken && config.cancelToken.reason) {
          return Promise.reject(config.cancelToken.reason);
        }
        // Otherwise, resolve with the cached data.
        return Promise.resolve({
          data: cachedResponse,
          status: 200,
          statusText: 'OK (cached)',
          headers: {},
          config: config, // Pass the original config
          cached: true     // Mark as cached
        });
      }
    };
  }

  return config;
});

// Cache successful responses
api.interceptors.response.use(response => {
  // Don't cache if it's already from cache
  if (response.cached) return response;

  // Only cache GET requests
  if (response.config.method !== 'get') return response;

  // Create a cache key from the request URL and params
  const cacheKey = `${response.config.url}?${JSON.stringify(response.config.params || {})}`;

  // Different TTL for different endpoints
  let ttl = 5000; // Default: 5 seconds

  if (response.config.url.includes('/blocks')) {
    ttl = 3000; // Blocks: cache for 3 seconds
  } else if (response.config.url.includes('/transactions')) {
    ttl = 3000; // Transactions: cache for 3 seconds
  } else if (response.config.url.includes('/stats')) {
    ttl = 30000; // Stats: cache for 30 seconds
  }

  // Cache the response data
  apiCache.set(cacheKey, response.data, ttl);

  return response;
});

// API endpoints for blocks
export const blockService = {
  getLatestBlocks: (limit = 10, offset = 0, config = {}) => {
    return api.get(`/blocks?limit=${limit}&offset=${offset}`, config);
  },
  getBlockByHash: (hash, config = {}) => {
    return api.get(`/blocks/hash/${hash}`, config);
  },
  getBlockByHeight: (height, config = {}) => {
    return api.get(`/blocks/height/${height}`, config);
  },
  getLatestBlock: (config = {}) => {
    return api.get('/blocks/latest', config);
  },
};

// API endpoints for transactions
export const transactionService = {
  getLatestTransactions: (limit = 10, offset = 0, config = {}) => {
    return api.get(`/transactions?limit=${limit}&offset=${offset}`, config);
  },
  getTransaction: (txid, config = {}) => {
    return api.get(`/transactions/${txid}`, config);
  },
  getBlockTransactions: (blockhash, config = {}) => {
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

// API endpoints for cryptocurrency prices
export const priceService = {
  getBitcoinZPrice: async () => {
    try {
      const response = await coingeckoApi.get('/simple/price', {
        params: {
          ids: 'bitcoinz',
          vs_currencies: 'usd',
          include_24hr_change: true
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching BitcoinZ price:', error);
      // Return fallback data if API fails
      return {
        bitcoinz: {
          usd: 0.000123,
          usd_24h_change: 0.5
        }
      };
    }
  },

  getCoinInfo: async (coinId) => {
    try {
      const response = await coingeckoApi.get(`/coins/${coinId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${coinId} info:`, error);
      return null;
    }
  }
};

// Export instance for direct use or custom requests
export default api;

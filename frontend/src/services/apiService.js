import axios from 'axios';

// Get API base URL from environment variables or use default
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Create an axios instance with the base URL configuration
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Chart-related API calls
export const chartService = {
  getBlockSize: (params) => api.get('/charts/block-size', { params }),
  getBlockInterval: (params) => api.get('/charts/block-interval', { params }),
  getDifficulty: (params) => api.get('/charts/difficulty', { params }),
  getMiningRevenue: (params) => api.get('/charts/mining-revenue', { params }),
  getPoolStat: (params) => api.get('/charts/pool-stat', { params }),
  getMinedBlocks: (params) => api.get('/charts/mined-block', { params }),
  
  // New method to get real historical pool distribution data
  getRealPoolStat: (params) => api.get('/pool-stats/real-pool-stat', { params }),
  
  // Generic method to fetch any chart data
  getChartData: (chartType, params) => api.get(`/charts/${chartType}`, { params })
};

// Export default axios instance for other APIs
export default api;
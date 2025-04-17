// Configuration settings for the application
const config = {
  // API and WebSocket URLs
  api: {
    baseUrl: process.env.REACT_APP_API_URL || 'http://localhost:3000/api',
    timeout: 30000
  },
  socket: {
    url: process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000',
    options: {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    }
  },
  // Pagination defaults
  pagination: {
    blocksPerPage: 10,
    transactionsPerPage: 15,
    addressTransactionsPerPage: 10
  },
  // Feature flags
  features: {
    realTimeUpdates: true,
    charts: true,
    addressBalance: true
  }
};

export default config;

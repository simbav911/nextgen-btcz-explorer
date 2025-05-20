/**
 * Application configuration
 * This file contains environment-specific configuration settings
 */

// Determine if we're in production
const isProduction = process.env.NODE_ENV === 'production';

// Base URL for API requests
const apiBaseUrl = isProduction 
  ? process.env.REACT_APP_API_URL || '/api' 
  : 'http://localhost:3001/api';

// Socket configuration
const socketConfig = {
  url: isProduction 
    ? window.location.origin  // Use the current domain in production
    : 'http://localhost:3000',
  options: {
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000,
    transports: ['websocket', 'polling']
  }
};

// Export configuration
const config = {
  api: {
    baseUrl: apiBaseUrl,
    timeout: 10000
  },
  socket: socketConfig,
  // Add other configuration sections as needed
};

export default config;

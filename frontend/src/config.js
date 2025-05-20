/**
 * Application configuration
 * This file contains environment-specific configuration settings
 */

// Determine if we're in production
const isProduction = process.env.NODE_ENV === 'production';

// Base URL for API requests
const apiBaseUrl = isProduction
  ? process.env.REACT_APP_API_URL || '/api'
  : '/api'; // Development uses relative path, proxied by dev server

// Socket configuration
const socketConfig = {
  url: window.location.origin, // Use current origin for both dev and prod
  options: {
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000,
    transports: ['websocket', 'polling'],
    path: '/socket.io' // Explicitly set the socket.io path
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

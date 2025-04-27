import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Routes, Route } from 'react-router-dom';
import { io } from 'socket.io-client';

// Import background styles
import './styles/background.css';

// Components
import ModernHeader from './components/ModernHeader';
import Footer from './components/Footer';
import Toast from './components/Toast';

// Pages
import Home from './pages/Home';
import Block from './pages/Block';
import Transaction from './pages/Transaction';
import Address from './pages/Address';
import BlockList from './pages/BlockList';
import TransactionList from './pages/TransactionList';
import Status from './pages/Status';
import Charts from './pages/Charts';
import Search from './pages/Search';
import NotFound from './pages/NotFound';
import WealthDistribution from './pages/WealthDistribution';

// Context
import { SocketContext } from './contexts/SocketContext';
import { ToastContext } from './contexts/ToastContext';

// Import background manager
import backgroundManager from './utils/backgroundManager';

// API Configuration
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000';

function App({ skipHeader = false }) {
  // Initialize state and refs
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [toast, setToast] = useState(null);
  
  // Define showToast callback
  const showToast = useCallback((message, type = 'info', duration = 5000) => {
    setToast({ message, type, duration });
    
    const timer = setTimeout(() => {
      setToast(null);
    }, duration);
    
    return () => clearTimeout(timer);
  }, []);

  // Create toast context value
  const toastContextValue = useMemo(() => ({ showToast }), [showToast]);
  
  // Initialize background animation
  useEffect(() => {
    // Initialize with the primary style
    backgroundManager.init('primary');
    
    // Clean up animation on unmount
    return () => {
      backgroundManager.stop();
    };
  }, []);
  
  // Initialize socket connection with better error handling and reconnection logic
  useEffect(() => {
    if (socketRef.current) return;

    // Create socket with improved options
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'], // Try websocket first, fallback to polling
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      forceNew: true
    });
    
    const currentSocket = socketRef.current;
    
    // Connection established
    currentSocket.on('connect', () => {
      console.log('Connected to WebSocket server');
      setIsConnected(true);
      
      // Subscribe to channels
      currentSocket.emit('subscribe', 'blocks');
      currentSocket.emit('subscribe', 'transactions');
      currentSocket.emit('subscribe', 'general');
    });
    
    // Connection error
    currentSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setIsConnected(false);
    });
    
    // Connection closed
    currentSocket.on('disconnect', (reason) => {
      console.log(`Disconnected from WebSocket server: ${reason}`);
      setIsConnected(false);
      
      // If the server closed the connection, try to reconnect immediately
      if (reason === 'io server disconnect') {
        currentSocket.connect();
      }
    });
    
    // Receive heartbeat to confirm connection is alive
    currentSocket.on('heartbeat', (data) => {
      const latency = Date.now() - data.timestamp;
      if (latency > 5000) {
        console.warn(`High socket latency detected: ${latency}ms`);
      }
    });
    
    // Notification handling
    currentSocket.on('notification', (notification) => {
      if (notification.type === 'block') {
        showToast(`New block #${notification.data.height} mined`, 'info');
      }
    });
    
    // Reconnect success
    currentSocket.on('reconnect', (attemptNumber) => {
      console.log(`Reconnected to WebSocket server after ${attemptNumber} attempts`);
      setIsConnected(true);
      
      // Re-subscribe to channels
      currentSocket.emit('subscribe', 'blocks');
      currentSocket.emit('subscribe', 'transactions');
      currentSocket.emit('subscribe', 'general');
    });
    
    // Reconnection attempt
    currentSocket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`Attempting to reconnect to WebSocket server (attempt ${attemptNumber})`);
    });
    
    // Reconnection error
    currentSocket.on('reconnect_error', (error) => {
      console.error('WebSocket reconnection error:', error);
    });
    
    // Reconnection failed
    currentSocket.on('reconnect_failed', () => {
      console.error('WebSocket reconnection failed, giving up');
      showToast('Real-time updates unavailable. Please refresh the page.', 'error', 10000);
    });
    
    // Cleanup on unmount
    return () => {
      if (currentSocket) {
        // Unsubscribe from all channels first
        currentSocket.emit('unsubscribe', 'blocks');
        currentSocket.emit('unsubscribe', 'transactions');
        currentSocket.emit('unsubscribe', 'general');
        
        // Then disconnect
        currentSocket.disconnect();
        socketRef.current = null;
      }
    };
  }, [showToast]);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Background animation container */}
      <div id="bg-animation-container" className="bg-animation-container"></div>
      
      {/* Only include the header if skipHeader is false */}
      {!skipHeader && <ModernHeader />}
      
      {/* Main content with WebSocket context */}
      <SocketContext.Provider value={socketRef.current}>
        <ToastContext.Provider value={toastContextValue}>
          <main className="flex-grow py-4 sm:py-6 md:py-8 content-container">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/blocks" element={<BlockList />} />
              <Route path="/blocks/:hash" element={<Block />} />
              <Route path="/transactions" element={<TransactionList />} />
              <Route path="/tx/:txid" element={<Transaction />} />
              <Route path="/address/:address" element={<Address />} />
              <Route path="/stats" element={<Status />} />
              <Route path="/charts" element={<Charts />} />
              <Route path="/wealth-distribution" element={<WealthDistribution />} />
              <Route path="/search" element={<Search />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <Footer />
          {toast && <Toast message={toast.message} type={toast.type} />}
        </ToastContext.Provider>
      </SocketContext.Provider>
    </div>
  );
}

export default App;
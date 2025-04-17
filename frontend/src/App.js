import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Routes, Route } from 'react-router-dom';
import { io } from 'socket.io-client';

// Components
import Header from './components/Header';
import Footer from './components/Footer';
import Toast from './components/Toast';

// Pages
import Home from './pages/Home';
import Block from './pages/Block';
import Transaction from './pages/Transaction';
import Address from './pages/Address';
import BlockList from './pages/BlockList';
import TransactionList from './pages/TransactionList';
import Stats from './pages/Stats';
import Search from './pages/Search';
import NotFound from './pages/NotFound';

// Context
import { SocketContext } from './contexts/SocketContext';
import { ToastContext } from './contexts/ToastContext';

// API Configuration
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000';

function App() {
  const socketRef = useRef(null); // Use ref for socket instance
  const [isConnected, setIsConnected] = useState(false); // Track connection status for potential UI feedback
  const [toast, setToast] = useState(null);
  
  // Initialize socket connection
  useEffect(() => {
    // Prevent creating multiple sockets if component re-renders unexpectedly
    if (socketRef.current) return;

    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    
    const currentSocket = socketRef.current;
    
    currentSocket.on('connect', () => {
      console.log('Connected to WebSocket server');
      setIsConnected(true);
      // showToast('Connected to live updates', 'success'); // Toast handled by context now
      
      // Subscribe to channels
      currentSocket.emit('subscribe', 'blocks');
      currentSocket.emit('subscribe', 'transactions');
    });
    
    currentSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setIsConnected(false);
      // showToast('Connection error. Retrying...', 'error'); // Toast handled by context now
    });
    
    currentSocket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
      setIsConnected(false);
      // showToast('Disconnected from live updates', 'warning'); // Toast handled by context now
    });
    
    // No need to setSocket state anymore
    
    // Cleanup on unmount
    return () => {
      if (currentSocket) {
        currentSocket.disconnect();
        socketRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // showToast dependency removed as it's stable via useCallback now
  
  // Stable Toast message handler using useCallback
  const showToast = useCallback((message, type = 'info', duration = 5000) => {
    setToast({ message, type, duration });
    
    // Auto-clear toast after duration
    const timer = setTimeout(() => {
      setToast(null);
    }, duration);
    
    // Optional: Clear timer if component unmounts or toast changes
    return () => clearTimeout(timer);
  }, []); // Empty dependency array means this function reference is stable

  // Memoize the Toast context value
  const toastContextValue = useMemo(() => ({ showToast }), [showToast]);

  // Add connection status toasts based on isConnected state
  useEffect(() => {
    if (isConnected) {
      showToast('Connected to live updates', 'success');
    } else if (socketRef.current) { // Only show disconnect/error if socket was initialized
      // You might want more specific error/disconnect messages here
      showToast('Disconnected from live updates. Retrying...', 'warning');
    }
  }, [isConnected, showToast]);

  return (
    // Provide the stable ref to the SocketContext
    <SocketContext.Provider value={socketRef.current}>
      {/* Provide the memoized value to ToastContext */}
      <ToastContext.Provider value={toastContextValue}>
        <div className="flex flex-col min-h-screen">
          <Header />
          <main className="flex-grow container-custom py-8">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/blocks" element={<BlockList />} />
              <Route path="/blocks/:hash" element={<Block />} />
              <Route path="/transactions" element={<TransactionList />} />
              <Route path="/tx/:txid" element={<Transaction />} />
              <Route path="/address/:address" element={<Address />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/search" element={<Search />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <Footer />
          {toast && <Toast message={toast.message} type={toast.type} />}
        </div>
      </ToastContext.Provider>
    </SocketContext.Provider>
  );
}

export default App;

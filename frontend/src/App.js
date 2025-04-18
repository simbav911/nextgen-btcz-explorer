import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Routes, Route } from 'react-router-dom';
import { io } from 'socket.io-client';

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

// API Configuration
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000';

// Using the DarkHeader component instead of defining it here

function App({ skipHeader = false }) {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [toast, setToast] = useState(null);
  
  // Initialize socket connection
  useEffect(() => {
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
      
      // Subscribe to channels
      currentSocket.emit('subscribe', 'blocks');
      currentSocket.emit('subscribe', 'transactions');
    });
    
    currentSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setIsConnected(false);
    });
    
    currentSocket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
      setIsConnected(false);
    });
    
    return () => {
      if (currentSocket) {
        currentSocket.disconnect();
        socketRef.current = null;
      }
    };
  }, []);
  
  const showToast = useCallback((message, type = 'info', duration = 5000) => {
    setToast({ message, type, duration });
    
    const timer = setTimeout(() => {
      setToast(null);
    }, duration);
    
    return () => clearTimeout(timer);
  }, []);

  const toastContextValue = useMemo(() => ({ showToast }), [showToast]);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Only include the header if skipHeader is false */}
      {!skipHeader && <ModernHeader />}
      
      {/* Main content with WebSocket context */}
      <SocketContext.Provider value={socketRef.current}>
        <ToastContext.Provider value={toastContextValue}>
          <main className="flex-grow container-custom py-8">
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
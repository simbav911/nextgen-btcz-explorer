import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Routes, Route } from 'react-router-dom';
import { io } from 'socket.io-client';

// Components
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
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000';

// Modern Header component - no state, no props, no context
const ModernHeader = () => (
  <header 
    className="bg-gradient-to-r from-blue-900 to-blue-700 shadow-lg" 
    style={{ position: "static", zIndex: 1000 }} 
  >
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center h-16">
        {/* Logo and Title */}
        <div className="flex items-center">
          <div className="flex-shrink-0 w-10">
            <img 
              src="/logo.png" 
              alt="BitcoinZ" 
              className="h-10 w-10"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://bitcoinz.global/wp-content/uploads/branding/btcz-website-logo.png';
              }}
            />
          </div>
          <div className="ml-3 flex flex-col">
            <span className="font-bold text-xl text-white tracking-wide">BitcoinZ</span>
            <span className="text-xs text-blue-200 tracking-wider">Explorer</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex space-x-8">
          <a href="/" className="text-blue-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-800 transition-colors">
            Home
          </a>
          <a href="/blocks" className="text-blue-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-800 transition-colors">
            Blocks
          </a>
          <a href="/transactions" className="text-blue-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-800 transition-colors">
            Transactions
          </a>
          <a href="/stats" className="text-blue-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-800 transition-colors">
            Statistics
          </a>
        </nav>
      </div>
    </div>
  </header>
);

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
              <Route path="/stats" element={<Stats />} />
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
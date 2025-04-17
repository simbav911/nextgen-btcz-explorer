import React, { useState, useEffect } from 'react';
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
  const [socket, setSocket] = useState(null);
  const [toast, setToast] = useState(null);
  
  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    
    newSocket.on('connect', () => {
      console.log('Connected to WebSocket server');
      showToast('Connected to live updates', 'success');
      
      // Subscribe to channels
      newSocket.emit('subscribe', 'blocks');
      newSocket.emit('subscribe', 'transactions');
    });
    
    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      showToast('Connection error. Retrying...', 'error');
    });
    
    newSocket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
      showToast('Disconnected from live updates', 'warning');
    });
    
    setSocket(newSocket);
    
    // Cleanup on unmount
    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, []);
  
  // Toast message handler
  const showToast = (message, type = 'info', duration = 5000) => {
    setToast({ message, type, duration });
    
    // Auto-clear toast after duration
    setTimeout(() => {
      setToast(null);
    }, duration);
  };
  
  return (
    <SocketContext.Provider value={socket}>
      <ToastContext.Provider value={{ showToast }}>
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

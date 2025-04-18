import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { FaSearch, FaQrcode, FaChevronDown } from 'react-icons/fa';
import { SocketContext } from '../contexts/SocketContext';
import './DarkHeader.css';

const DarkHeader = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [connectionCount, setConnectionCount] = useState(0);
  const [blockHeight, setBlockHeight] = useState(0);
  const socket = useContext(SocketContext);

  // Handle search
  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/search?query=${encodeURIComponent(searchQuery.trim())}`;
      setSearchQuery('');
    }
  };

  // Monitor block height and connections - purely for display
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // This would typically come from your API
        // For now using placeholder values
        setConnectionCount(36);
        setBlockHeight(1545719);
      } catch (error) {
        console.error('Error fetching initial data:', error);
      }
    };

    fetchInitialData();

    // Listen for updates from socket if available
    if (socket) {
      socket.on('stats_update', (stats) => {
        if (stats.networkInfo && stats.networkInfo.connections) {
          setConnectionCount(stats.networkInfo.connections);
        }
        
        if (stats.blockchainInfo && stats.blockchainInfo.blocks) {
          setBlockHeight(stats.blockchainInfo.blocks);
        }
      });

      socket.on('new_block', (block) => {
        if (block.height) {
          setBlockHeight(block.height);
        }
      });

      return () => {
        socket.off('stats_update');
        socket.off('new_block');
      };
    }
  }, [socket]);

  return (
    <header className="dark-header">
      <div className="header-container">
        {/* Logo Section */}
        <div className="logo-section">
          <Link to="/" className="logo-link">
            <span className="logo-text">BitcoinZ</span>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="main-nav">
          <Link to="/blocks" className="nav-link">Blocks</Link>
          <Link to="/charts" className="nav-link">Charts</Link>
          <Link to="/stats" className="nav-link">Status</Link>
        </nav>

        {/* Search Bar */}
        <div className="search-section">
          <form onSubmit={handleSearch} className="search-form">
            <input
              type="text"
              placeholder="Search for block, transaction or address"
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="search-button">
              <FaSearch />
            </button>
          </form>
        </div>

        {/* Status Section */}
        <div className="status-section">
          <div className="status-pill">
            <span className="status-icon">•</span>
            <span className="status-text">Conn {connectionCount}</span>
          </div>
          <div className="status-pill">
            <span className="status-text">Height {blockHeight}</span>
          </div>
          <button className="scan-button">
            <FaQrcode className="scan-icon" />
            <span className="scan-text">Scan</span>
          </button>
          <div className="bits-dropdown">
            <button className="bits-button">
              <span>bits</span>
              <FaChevronDown className="dropdown-icon" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default DarkHeader;
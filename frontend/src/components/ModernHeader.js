import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaCoins, FaCube, FaExchangeAlt, FaChartLine, FaInfoCircle, FaHome, FaBars, FaTimes } from 'react-icons/fa';

// Import the animation styles
import '../styles/animatedHeader.css';
import headerAnimationManager from '../utils/headerAnimationManager';

// Modern Header component with mobile responsiveness
const ModernHeader = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  // Initialize the header animation when component mounts
  useEffect(() => {
    // Initialize the header animation
    headerAnimationManager.init();
    
    // Set a timer to switch color sets every 240 seconds (4 minutes)
    const colorTimer = setInterval(() => {
      headerAnimationManager.nextColorSet();
    }, 240000);
    
    // Clean up on unmount
    return () => {
      clearInterval(colorTimer);
    };
  }, []);

  return (
    <header className="animated-header glass-header header-shadow" style={{ position: "static", zIndex: 1000 }}>
      {/* Animated gradient background div */}
      <div className="animated-gradient"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
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
              <h1 className="font-bold text-lg tracking-wide header-text">
                <span className="text-white">Bitcoin</span>
                <span className="text-yellow-300" style={{ textShadow: '0 0 5px rgba(251, 191, 36, 0.7)' }}>Z</span>
              </h1>
              <span className="text-xs text-white opacity-90 tracking-wider header-text">Explorer</span>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button 
              onClick={toggleMenu}
              className="text-white p-2 focus:outline-none header-text"
            >
              {isMenuOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
            </button>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex space-x-4">
            <Link to="/" className="text-white px-2 py-1 rounded-md text-sm font-medium nav-item-hover transition-colors flex items-center header-text">
              <FaHome className="mr-1" size={14} /> Home
            </Link>
            <Link to="/blocks" className="text-white px-2 py-1 rounded-md text-sm font-medium nav-item-hover transition-colors flex items-center header-text">
              <FaCube className="mr-1" size={14} /> Blocks
            </Link>
            <Link to="/transactions" className="text-white px-2 py-1 rounded-md text-sm font-medium nav-item-hover transition-colors flex items-center header-text">
              <FaExchangeAlt className="mr-1" size={14} /> Transactions
            </Link>
            <Link to="/charts" className="text-white px-2 py-1 rounded-md text-sm font-medium nav-item-hover transition-colors flex items-center header-text">
              <FaChartLine className="mr-1" size={14} /> Charts
            </Link>
            <Link to="/wealth-distribution" className="text-white px-2 py-1 rounded-md text-sm font-medium nav-item-hover transition-colors flex items-center header-text">
              <FaCoins className="mr-1" size={14} /> Wealth
            </Link>
            <Link to="/stats" className="text-white px-2 py-1 rounded-md text-sm font-medium nav-item-hover transition-colors flex items-center header-text">
              <FaInfoCircle className="mr-1" size={14} /> Statistics
            </Link>
          </nav>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMenuOpen && (
        <div className="md:hidden glass-header pb-2">
          <div className="px-4 pt-2 space-y-1">
            <Link to="/" className="text-white block px-3 py-2 rounded-md text-base font-medium nav-item-hover header-text" onClick={toggleMenu}>
              <FaHome className="inline mr-2" size={14} /> Home
            </Link>
            <Link to="/blocks" className="text-white block px-3 py-2 rounded-md text-base font-medium nav-item-hover header-text" onClick={toggleMenu}>
              <FaCube className="inline mr-2" size={14} /> Blocks
            </Link>
            <Link to="/transactions" className="text-white block px-3 py-2 rounded-md text-base font-medium nav-item-hover header-text" onClick={toggleMenu}>
              <FaExchangeAlt className="inline mr-2" size={14} /> Transactions
            </Link>
            <Link to="/charts" className="text-white block px-3 py-2 rounded-md text-base font-medium nav-item-hover header-text" onClick={toggleMenu}>
              <FaChartLine className="inline mr-2" size={14} /> Charts
            </Link>
            <Link to="/wealth-distribution" className="text-white block px-3 py-2 rounded-md text-base font-medium nav-item-hover header-text" onClick={toggleMenu}>
              <FaCoins className="inline mr-2" size={14} /> Wealth
            </Link>
            <Link to="/stats" className="text-white block px-3 py-2 rounded-md text-base font-medium nav-item-hover header-text" onClick={toggleMenu}>
              <FaInfoCircle className="inline mr-2" size={14} /> Statistics
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};

export default React.memo(ModernHeader);
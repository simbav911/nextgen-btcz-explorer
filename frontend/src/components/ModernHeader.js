import React from 'react';
import { Link } from 'react-router-dom';
import { FaCoins, FaCube, FaExchangeAlt, FaChartLine, FaChartBar, FaInfoCircle, FaHome } from 'react-icons/fa';

// Modern Header component - simple, clean and beautiful
const ModernHeader = () => {
  return (
    <header className="bg-gradient-to-r from-blue-500 via-bitcoinz-500 to-blue-400 shadow-md" style={{ position: "static", zIndex: 1000, boxShadow: '0 3px 10px rgba(0, 0, 0, 0.1)' }}>
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
              <h1 className="font-bold text-lg tracking-wide drop-shadow-sm">
                <span className="text-white">Bitcoin</span>
                <span className="text-yellow-300" style={{ textShadow: '0 0 5px rgba(251, 191, 36, 0.7)' }}>Z</span>
              </h1>
              <span className="text-xs text-white opacity-90 tracking-wider">Explorer</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex space-x-4 md:space-x-5">
            <Link to="/" className="text-white hover:text-white px-2 py-1 rounded-md text-sm font-medium hover:bg-white hover:bg-opacity-20 transition-colors flex items-center drop-shadow-sm">
              <FaHome className="mr-1" size={14} /> Home
            </Link>
            <Link to="/blocks" className="text-white hover:text-white px-2 py-1 rounded-md text-sm font-medium hover:bg-white hover:bg-opacity-20 transition-colors flex items-center drop-shadow-sm">
              <FaCube className="mr-1" size={14} /> Blocks
            </Link>
            <Link to="/transactions" className="text-white hover:text-white px-2 py-1 rounded-md text-sm font-medium hover:bg-white hover:bg-opacity-20 transition-colors flex items-center drop-shadow-sm">
              <FaExchangeAlt className="mr-1" size={14} /> Transactions
            </Link>
            <Link to="/charts" className="text-white hover:text-white px-2 py-1 rounded-md text-sm font-medium hover:bg-white hover:bg-opacity-20 transition-colors flex items-center drop-shadow-sm">
              <FaChartLine className="mr-1" size={14} /> Charts
            </Link>
            <Link to="/wealth-distribution" className="text-white hover:text-white px-2 py-1 rounded-md text-sm font-medium hover:bg-white hover:bg-opacity-20 transition-colors flex items-center drop-shadow-sm">
              <FaCoins className="mr-1" size={14} /> Wealth
            </Link>
            <Link to="/stats" className="text-white hover:text-white px-2 py-1 rounded-md text-sm font-medium hover:bg-white hover:bg-opacity-20 transition-colors flex items-center drop-shadow-sm">
              <FaInfoCircle className="mr-1" size={14} /> Statistics
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default React.memo(ModernHeader);
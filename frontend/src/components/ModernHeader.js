import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaSearch, FaCoins } from 'react-icons/fa';

// Modern Header component - simple, clean and beautiful
const ModernHeader = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/search?query=${encodeURIComponent(searchQuery.trim())}`;
      setSearchQuery('');
    }
  };

  return (
    <header className="bg-gradient-to-r from-blue-900 to-blue-700 shadow-lg" style={{ position: "static", zIndex: 1000 }}>
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
            <Link to="/" className="text-blue-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-800 transition-colors">
              Home
            </Link>
            <Link to="/blocks" className="text-blue-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-800 transition-colors">
              Blocks
            </Link>
            <Link to="/charts" className="text-blue-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-800 transition-colors">
              Charts
            </Link>
            <Link to="/transactions" className="text-blue-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-800 transition-colors">
              Transactions
            </Link>
            <Link to="/wealth-distribution" className="text-blue-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-800 transition-colors flex items-center">
              <FaCoins className="mr-1" /> Wealth Distribution
            </Link>
            <Link to="/stats" className="text-blue-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-800 transition-colors">
              Statistics
            </Link>
          </nav>

          {/* Search Form */}
          <div className="hidden md:block">
            <form onSubmit={handleSearch} className="flex">
              <input
                type="text"
                placeholder="Search blocks, transactions, addresses..."
                className="rounded-l-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border-0"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-r-md px-4 py-2"
              >
                <FaSearch />
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
};

// Use React.memo with props comparison to prevent re-renders
export default React.memo(ModernHeader);
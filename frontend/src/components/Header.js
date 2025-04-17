import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaSearch, FaBars, FaTimes } from 'react-icons/fa';

// Components
import SyncStatus from './SyncStatus';

const Header = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?query=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setMobileMenuOpen(false);
    }
  };

  return (
    <header className="bg-white shadow-md">
      <div className="container-custom">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img 
              src="/logo.png" 
              alt="BitcoinZ Explorer" 
              className="h-10 w-auto mr-3"
              onError={(e) => {
                e.target.src = 'https://bitcoinz.global/wp-content/uploads/branding/btcz-website-logo.png';
                e.target.onError = null;
              }}
            />
            <div className="flex flex-col">
              <span className="font-bold text-xl text-gray-900">BitcoinZ</span>
              <span className="text-sm text-gray-600">Explorer</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            <Link to="/" className="text-gray-700 hover:text-bitcoinz-600">Home</Link>
            <Link to="/blocks" className="text-gray-700 hover:text-bitcoinz-600">Blocks</Link>
            <Link to="/transactions" className="text-gray-700 hover:text-bitcoinz-600">Transactions</Link>
            <Link to="/stats" className="text-gray-700 hover:text-bitcoinz-600">Statistics</Link>
          </nav>

          {/* Sync Status (Desktop) */}
          <div className="hidden md:block">
            <SyncStatus />
          </div>

          {/* Desktop Search */}
          <div className="hidden md:block">
            <form onSubmit={handleSearch} className="flex">
              <input
                type="text"
                placeholder="Search blocks, transactions, addresses..."
                className="input w-64"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button
                type="submit"
                className="ml-2 btn btn-primary"
              >
                <FaSearch />
              </button>
            </form>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-gray-700 focus:outline-none"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <nav className="flex flex-col space-y-4 mb-4">
              <Link 
                to="/" 
                className="text-gray-700 hover:text-bitcoinz-600"
                onClick={() => setMobileMenuOpen(false)}
              >
                Home
              </Link>
              <Link 
                to="/blocks" 
                className="text-gray-700 hover:text-bitcoinz-600"
                onClick={() => setMobileMenuOpen(false)}
              >
                Blocks
              </Link>
              <Link 
                to="/transactions" 
                className="text-gray-700 hover:text-bitcoinz-600"
                onClick={() => setMobileMenuOpen(false)}
              >
                Transactions
              </Link>
              <Link 
                to="/stats" 
                className="text-gray-700 hover:text-bitcoinz-600"
                onClick={() => setMobileMenuOpen(false)}
              >
                Statistics
              </Link>
            </nav>
            
            {/* Mobile Search */}
            <form onSubmit={handleSearch} className="flex mb-4">
              <input
                type="text"
                placeholder="Search blocks, txs, addresses..."
                className="input flex-grow"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button
                type="submit"
                className="ml-2 btn btn-primary"
              >
                <FaSearch />
              </button>
            </form>
            
            {/* Sync Status (Mobile) */}
            <div className="mt-2">
              <SyncStatus />
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;

import React from 'react';
import { Link } from 'react-router-dom';
import { FaBars, FaTimes, FaCube, FaChartLine, FaExchangeAlt, FaChartPie, FaInfoCircle } from 'react-icons/fa';

// Static Header Component
const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <header className="bg-gradient-to-r from-blue-800 to-bitcoinz-800 text-white shadow-md">
      <div className="container-custom">
        <div className="flex justify-between items-center py-3">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img 
              src="/logo.png" 
              alt="BitcoinZ Explorer" 
              className="h-8 w-auto mr-2"
              onError={(e) => {
                e.target.src = 'https://bitcoinz.global/wp-content/uploads/branding/btcz-website-logo.png';
                e.target.onError = null;
              }}
            />
            <div className="flex flex-col">
              <span className="font-bold text-lg text-white">BitcoinZ</span>
              <span className="text-xs text-blue-200">Explorer</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link to="/" className="text-white hover:text-blue-200 transition-colors flex items-center">
              <FaCube className="mr-1" size={14} />
              <span>Home</span>
            </Link>
            <Link to="/blocks" className="text-white hover:text-blue-200 transition-colors flex items-center">
              <FaCube className="mr-1" size={14} />
              <span>Blocks</span>
            </Link>
            <Link to="/transactions" className="text-white hover:text-blue-200 transition-colors flex items-center">
              <FaExchangeAlt className="mr-1" size={14} />
              <span>Transactions</span>
            </Link>
            <Link to="/charts" className="text-white hover:text-blue-200 transition-colors flex items-center">
              <FaChartLine className="mr-1" size={14} />
              <span>Charts</span>
            </Link>
            <Link to="/wealth-distribution" className="text-white hover:text-blue-200 transition-colors flex items-center">
              <FaChartPie className="mr-1" size={14} />
              <span>Wealth Distribution</span>
            </Link>
            <Link to="/stats" className="text-white hover:text-blue-200 transition-colors flex items-center">
              <FaInfoCircle className="mr-1" size={14} />
              <span>Statistics</span>
            </Link>
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-white focus:outline-none"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-blue-700">
            <nav className="flex flex-col space-y-3 mb-4">
              <Link 
                to="/" 
                className="text-white hover:text-blue-200 flex items-center"
                onClick={() => setMobileMenuOpen(false)}
              >
                <FaCube className="mr-2" size={14} />
                Home
              </Link>
              <Link 
                to="/blocks" 
                className="text-white hover:text-blue-200 flex items-center"
                onClick={() => setMobileMenuOpen(false)}
              >
                <FaCube className="mr-2" size={14} />
                Blocks
              </Link>
              <Link 
                to="/transactions" 
                className="text-white hover:text-blue-200 flex items-center"
                onClick={() => setMobileMenuOpen(false)}
              >
                <FaExchangeAlt className="mr-2" size={14} />
                Transactions
              </Link>
              <Link 
                to="/charts" 
                className="text-white hover:text-blue-200 flex items-center"
                onClick={() => setMobileMenuOpen(false)}
              >
                <FaChartLine className="mr-2" size={14} />
                Charts
              </Link>
              <Link 
                to="/wealth-distribution" 
                className="text-white hover:text-blue-200 flex items-center"
                onClick={() => setMobileMenuOpen(false)}
              >
                <FaChartPie className="mr-2" size={14} />
                Wealth Distribution
              </Link>
              <Link 
                to="/stats" 
                className="text-white hover:text-blue-200 flex items-center"
                onClick={() => setMobileMenuOpen(false)}
              >
                <FaInfoCircle className="mr-2" size={14} />
                Statistics
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
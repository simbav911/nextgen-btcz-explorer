import React from 'react';

const ModernHeader = () => {
  return (
    <header className="bg-gradient-to-r from-blue-900 to-blue-700 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Title */}
          <div className="flex items-center">
            <img 
              src="/logo.png" 
              alt="BitcoinZ" 
              className="h-10 w-10"
            />
            <div className="ml-3 flex flex-col">
              <span className="font-bold text-xl text-white tracking-wide">BitcoinZ</span>
              <span className="text-xs text-blue-200 tracking-wider">Explorer</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex space-x-8">
            <a href="/" className="text-blue-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition duration-150 hover:bg-blue-800">
              Home
            </a>
            <a href="/blocks" className="text-blue-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition duration-150 hover:bg-blue-800">
              Blocks
            </a>
            <a href="/transactions" className="text-blue-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition duration-150 hover:bg-blue-800">
              Transactions
            </a>
            <a href="/stats" className="text-blue-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition duration-150 hover:bg-blue-800">
              Statistics
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default ModernHeader;

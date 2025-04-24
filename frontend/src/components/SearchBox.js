import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSearch } from 'react-icons/fa';

const SearchBox = ({ placeholder = 'Enter a block height, transaction hash, or address...' }) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  
  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?query=${encodeURIComponent(query.trim())}`);
      setQuery('');
    }
  };
  
  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSearch} className="relative">
        <input
          type="text"
          placeholder={placeholder}
          className="w-full py-2 px-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-bitcoinz-500 focus:border-bitcoinz-500"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ minHeight: '42px' }} /* Ensure minimum tap target size for mobile */
        />
        <button
          type="submit"
          className="absolute left-0 top-0 h-full px-3 text-gray-400 flex items-center"
          style={{ minWidth: '44px', justifyContent: 'center' }} /* Ensure minimum tap target size for mobile */
        >
          <FaSearch />
        </button>
      </form>
    </div>
  );
};

export default SearchBox;

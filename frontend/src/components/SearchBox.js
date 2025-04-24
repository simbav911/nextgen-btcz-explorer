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
          className="w-full py-3 px-12 border-2 border-white border-opacity-30 bg-white bg-opacity-20 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 text-white placeholder-white placeholder-opacity-70 shadow-lg"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ 
            minHeight: '50px',
            backdropFilter: 'blur(5px)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
          }}
        />
        <button
          type="submit"
          className="absolute left-0 top-0 h-full px-4 text-white flex items-center"
          style={{ 
            minWidth: '50px', 
            justifyContent: 'center',
            background: 'rgba(255, 255, 255, 0.1)',
            borderTopLeftRadius: '0.75rem',
            borderBottomLeftRadius: '0.75rem',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.2)'
          }}
        >
          <FaSearch size={18} />
        </button>
      </form>
    </div>
  );
};

export default SearchBox;

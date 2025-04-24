import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSearch } from 'react-icons/fa';

const SearchBox = ({ placeholder = 'Enter a block height, transaction hash, or address...' }) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  
  // Add electric animation style to document head
  useEffect(() => {
    // Create a style element
    const styleEl = document.createElement('style');
    
    // Define the animation keyframes
    const animationCSS = `
      @keyframes electricPulse {
        0% {
          opacity: 0.3;
          filter: blur(5px);
        }
        50% {
          opacity: 0.7;
          filter: blur(7px);
        }
        100% {
          opacity: 0.3;
          filter: blur(5px);
        }
      }
    `;
    
    // Set the CSS content
    styleEl.textContent = animationCSS;
    
    // Append to document head
    document.head.appendChild(styleEl);
    
    // Clean up on unmount
    return () => {
      document.head.removeChild(styleEl);
    };
  }, []);
  
  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?query=${encodeURIComponent(query.trim())}`);
      setQuery('');
    }
  };
  
  return (
    <div className="w-full max-w-2xl mx-auto relative">
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
            boxShadow: `
              0 4px 20px rgba(0, 0, 0, 0.15), 
              inset 0 1px 0 rgba(255, 255, 255, 0.2),
              0 0 15px rgba(30, 64, 175, 0.6),
              0 0 30px rgba(59, 130, 246, 0.4),
              0 0 5px #3b82f6,
              0 0 2px #60a5fa
            `,
            transition: 'all 0.3s ease'
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
      
      {/* Add a subtle electric glow effect under the search box */}
      <div 
        className="electric-glow" 
        style={{
          position: 'absolute',
          width: '90%',
          height: '5px',
          background: 'linear-gradient(90deg, rgba(59, 130, 246, 0), rgba(59, 130, 246, 0.7), rgba(59, 130, 246, 0))',
          borderRadius: '50%',
          filter: 'blur(5px)',
          left: '5%',
          marginTop: '2px',
          animation: 'electricPulse 2s infinite'
        }}
      />
    </div>
  );
};

export default SearchBox;

import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { FaSearch, FaCube, FaExchangeAlt, FaWallet, FaArrowRight } from 'react-icons/fa';

// Components
import Spinner from '../components/Spinner';
import SearchBox from '../components/SearchBox';

// Services
import { searchService } from '../services/api';

// Utils
import { formatBTCZ, formatNumber } from '../utils/formatting';

const Search = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [error, setError] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  
  // Extract query from URL
  const queryParams = new URLSearchParams(location.search);
  const query = queryParams.get('query');
  
  // Set search input from query
  useEffect(() => {
    if (query) {
      setSearchInput(query);
    }
  }, [query]);
  
  // Perform search when query changes
  useEffect(() => {
    if (!query) return;
    
    const performSearch = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Check if query is a direct BitcoinZ address (starts with t1)
        if (query.length >= 26 && query.length <= 35 && query.startsWith('t1')) {
          // Direct navigation for addresses
          navigate(`/address/${query}`);
          return;
        }
        
        const response = await searchService.search(query);
        setSearchResult(response.data);
        
        // Auto-redirect for exact matches
        if (response.data && response.data.type) {
          if (response.data.type === 'block') {
            navigate(`/blocks/${response.data.result.hash}`);
          } else if (response.data.type === 'transaction') {
            navigate(`/tx/${response.data.result.txid}`);
          } else if (response.data.type === 'address') {
            navigate(`/address/${response.data.result.address}`);
          }
        }
      } catch (error) {
        console.error('Error performing search:', error);
        
        if (error.response && error.response.status === 404) {
          setError('No results found for this query');
        } else {
          setError('Error performing search. Please try again.');
        }
        
        setSearchResult(null);
      } finally {
        setLoading(false);
      }
    };
    
    performSearch();
  }, [query, navigate]);
  
  // Handle search form submission
  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    
    navigate(`/search?query=${encodeURIComponent(searchInput.trim())}`);
  };
  
  // Render search results based on type
  const renderSearchResults = () => {
    if (!searchResult || !searchResult.type) return null;
    
    switch (searchResult.type) {
      case 'block':
        return (
          <div className="card p-6">
            <h3 className="text-xl font-bold flex items-center mb-4">
              <FaCube className="text-bitcoinz-600 mr-2" />
              Block Found
            </h3>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 font-semibold">Hash:</span>
                <span className="font-mono text-sm">{searchResult.result.hash}</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 font-semibold">Height:</span>
                <span>{formatNumber(searchResult.result.height)}</span>
              </div>
              <Link 
                to={`/blocks/${searchResult.result.hash}`}
                className="btn btn-primary w-full mt-4 flex items-center justify-center"
              >
                View Block Details <FaArrowRight className="ml-2" />
              </Link>
            </div>
          </div>
        );
        
      case 'transaction':
        return (
          <div className="card p-6">
            <h3 className="text-xl font-bold flex items-center mb-4">
              <FaExchangeAlt className="text-bitcoinz-600 mr-2" />
              Transaction Found
            </h3>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 font-semibold">Transaction ID:</span>
                <span className="font-mono text-sm truncate max-w-xs">{searchResult.result.txid}</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 font-semibold">Amount:</span>
                <span>{formatBTCZ(searchResult.result.valueOut || 0)}</span>
              </div>
              <Link 
                to={`/tx/${searchResult.result.txid}`}
                className="btn btn-primary w-full mt-4 flex items-center justify-center"
              >
                View Transaction Details <FaArrowRight className="ml-2" />
              </Link>
            </div>
          </div>
        );
        
      case 'address':
        return (
          <div className="card p-6">
            <h3 className="text-xl font-bold flex items-center mb-4">
              <FaWallet className="text-bitcoinz-600 mr-2" />
              Address Found
            </h3>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 font-semibold">Address:</span>
                <span className="font-mono text-sm truncate max-w-xs">{searchResult.result.address}</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 font-semibold">Balance:</span>
                <span>{formatBTCZ(searchResult.result.balance || 0)}</span>
              </div>
              <Link 
                to={`/address/${searchResult.result.address}`}
                className="btn btn-primary w-full mt-4 flex items-center justify-center"
              >
                View Address Details <FaArrowRight className="ml-2" />
              </Link>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="page-title mb-6">
        <FaSearch />
        Search Results
      </h1>
      
      {/* Search form */}
      <div className="mb-8">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
          <div className="flex-grow relative">
            <input
              type="text"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Search blocks, transactions, addresses..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <FaSearch className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
          </div>
          <button
            type="submit"
            className="btn btn-primary md:w-auto"
          >
            Search
          </button>
        </form>
      </div>
      
      {/* Search results */}
      {query && (
        <div className="mb-6">
          <p className="text-gray-500 mb-4">
            Search results for: <span className="font-mono font-medium">{query}</span>
          </p>
          <div className="h-px bg-gray-200 w-full"></div>
        </div>
      )}
      
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner message="Searching..." />
        </div>
      ) : error ? (
        <div className="card p-6 text-center">
          <div className="bg-yellow-50 p-8 rounded-xl border border-yellow-100 mb-4">
            <FaSearch className="mx-auto text-yellow-500 mb-4" size={48} />
            <h3 className="text-xl font-bold mb-2">No results found</h3>
            <p className="text-gray-500">{error}</p>
            <p className="mt-4 text-sm text-gray-500">
              Try searching for a block height, block hash, transaction ID, or address.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
              <h4 className="font-bold mb-2 flex items-center">
                <FaCube className="text-blue-500 mr-2" />
                Looking for a block?
              </h4>
              <p className="text-sm text-gray-600 mb-2">Try searching by:</p>
              <ul className="text-sm text-gray-600 list-disc pl-5">
                <li>Block height (e.g., 123456)</li>
                <li>Block hash (64 character string)</li>
              </ul>
            </div>
            
            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
              <h4 className="font-bold mb-2 flex items-center">
                <FaExchangeAlt className="text-green-500 mr-2" />
                Looking for a transaction?
              </h4>
              <p className="text-sm text-gray-600 mb-2">Try searching by:</p>
              <ul className="text-sm text-gray-600 list-disc pl-5">
                <li>Transaction ID (64 character string)</li>
              </ul>
            </div>
            
            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-red-500 md:col-span-2">
              <h4 className="font-bold mb-2 flex items-center">
                <FaWallet className="text-red-500 mr-2" />
                Looking for an address?
              </h4>
              <p className="text-sm text-gray-600 mb-2">Try searching by:</p>
              <ul className="text-sm text-gray-600 list-disc pl-5">
                <li>BitcoinZ address (starts with t1)</li>
                <li>Example: t1KYZ8AM11Rj6uN4qDqJRGw6MCvXaV6u3aw</li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        renderSearchResults()
      )}
      
      {!query && !loading && (
        <div className="card p-6">
          <div className="bg-blue-50 p-8 rounded-xl border border-blue-100 text-center mb-8">
            <FaSearch className="mx-auto text-blue-500 mb-4" size={48} />
            <h2 className="text-2xl font-bold mb-4">Search the BitcoinZ Blockchain</h2>
            <p className="text-gray-600 mb-6">
              Enter a block height, block hash, transaction ID, or address to get started.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
              <h3 className="font-bold mb-4 flex items-center">
                <FaCube className="text-blue-500 mr-2" />
                Block Examples
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Block Height:</p>
                  <div className="font-mono text-sm bg-gray-50 p-2 rounded">123456</div>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Block Hash:</p>
                  <div className="font-mono text-sm bg-gray-50 p-2 rounded truncate">
                    000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
              <h3 className="font-bold mb-4 flex items-center">
                <FaExchangeAlt className="text-green-500 mr-2" />
                Transaction Example
              </h3>
              <p className="text-sm text-gray-600 mb-1">Transaction ID:</p>
              <div className="font-mono text-sm bg-gray-50 p-2 rounded truncate">
                4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-red-500 md:col-span-2">
              <h3 className="font-bold mb-4 flex items-center">
                <FaWallet className="text-red-500 mr-2" />
                Address Example
              </h3>
              <p className="text-sm text-gray-600 mb-1">BitcoinZ Address:</p>
              <div className="font-mono text-sm bg-gray-50 p-2 rounded">
                t1KYZ8AM11Rj6uN4qDqJRGw6MCvXaV6u3aw
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Search;

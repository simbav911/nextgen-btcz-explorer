import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { FaSearch, FaCube, FaExchangeAlt, FaWallet } from 'react-icons/fa';

// Components
import Spinner from '../components/Spinner';
import SearchBox from '../components/SearchBox';
import BlockCard from '../components/BlockCard';
import TransactionCard from '../components/TransactionCard';
import DetailCard from '../components/DetailCard';

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
  
  // Extract query from URL
  const queryParams = new URLSearchParams(location.search);
  const query = queryParams.get('query');
  
  // Perform search when query changes
  useEffect(() => {
    if (!query) return;
    
    const performSearch = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await searchService.search(query);
        setSearchResult(response.data);
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
  }, [query]);
  
  // Redirect to appropriate page if we have an exact match
  useEffect(() => {
    if (!searchResult) return;
    
    // Auto-redirect for exact matches
    if (searchResult.type === 'block') {
      navigate(`/blocks/${searchResult.result.hash}`);
    } else if (searchResult.type === 'transaction') {
      navigate(`/tx/${searchResult.result.txid}`);
    } else if (searchResult.type === 'address') {
      navigate(`/address/${searchResult.result.address}`);
    }
  }, [searchResult, navigate]);
  
  // Render address summary
  const renderAddressSummary = (address) => {
    return (
      <div className="card p-6">
        <h3 className="text-xl font-bold flex items-center mb-4">
          <FaWallet className="text-bitcoinz-600 mr-2" />
          Address Summary
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-gray-500 text-sm">Address</p>
            <p className="font-mono break-all">{address.address}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm">Balance</p>
            <p className="font-bold">{formatBTCZ(address.balance)}</p>
          </div>
          {address.transactions && (
            <div>
              <p className="text-gray-500 text-sm">Transactions</p>
              <p>{formatNumber(address.transactions.length)}</p>
            </div>
          )}
        </div>
        
        <div className="mt-4">
          <Link to={`/address/${address.address}`} className="btn btn-primary">
            View Address Details
          </Link>
        </div>
      </div>
    );
  };
  
  // Render search results
  const renderSearchResults = () => {
    if (!searchResult) return null;
    
    switch (searchResult.type) {
      case 'block':
        return <BlockCard block={searchResult.result} />;
      case 'transaction':
        return <TransactionCard transaction={searchResult.result} />;
      case 'address':
        return renderAddressSummary(searchResult.result);
      default:
        return (
          <div className="card text-center py-8">
            <p className="text-gray-500">No results found for your search.</p>
          </div>
        );
    }
  };
  
  return (
    <div>
      <h1 className="text-3xl font-bold flex items-center mb-6">
        <FaSearch className="text-bitcoinz-600 mr-3" />
        Search Results
      </h1>
      
      <div className="mb-8">
        <SearchBox placeholder="Search again..." />
      </div>
      
      {query && (
        <div className="mb-6">
          <p className="text-gray-600">
            Search results for: <span className="font-medium">{query}</span>
          </p>
        </div>
      )}
      
      {loading ? (
        <Spinner message="Searching..." />
      ) : error ? (
        <div className="card text-center py-8">
          <p className="text-gray-500">{error}</p>
          <p className="mt-4 text-sm text-gray-500">
            Try searching for a block height, block hash, transaction ID, or address.
          </p>
        </div>
      ) : (
        renderSearchResults()
      )}
      
      {!query && !loading && (
        <div className="card text-center py-8">
          <h2 className="text-2xl font-bold mb-4">Search the BitcoinZ Blockchain</h2>
          <p className="text-gray-500 mb-6">
            Enter a block height, block hash, transaction ID, or address to get started.
          </p>
          <div className="flex flex-col space-y-4 items-center text-left text-sm text-gray-600 max-w-md mx-auto">
            <div className="flex items-center">
              <FaCube className="text-bitcoinz-600 mr-2" />
              <span><strong>Block Height Example:</strong> 123456</span>
            </div>
            <div className="flex items-center">
              <FaCube className="text-bitcoinz-600 mr-2" />
              <span><strong>Block Hash Example:</strong> 000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f</span>
            </div>
            <div className="flex items-center">
              <FaExchangeAlt className="text-bitcoinz-600 mr-2" />
              <span><strong>Transaction Example:</strong> 4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b</span>
            </div>
            <div className="flex items-center">
              <FaWallet className="text-bitcoinz-600 mr-2" />
              <span><strong>Address Example:</strong> t1KYZ8AM11Rj6uN4qDqJRGw6MCvXaV6u3aw</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Search;

import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FaCube, FaArrowLeft, FaArrowRight } from 'react-icons/fa';
import moment from 'moment';
import axios from 'axios';

// Components
import Spinner from '../components/Spinner';
import DetailCard from '../components/DetailCard';
import TransactionCard from '../components/TransactionCard';
import Pagination from '../components/Pagination';

// Services
import { blockService, transactionService } from '../services/api';

// Utils
import { formatNumber, formatTimestamp, formatBTCZ } from '../utils/formatting';
import api from '../services/api';

const Block = () => {
  const { hash } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [block, setBlock] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const txsPerPage = 20;
  
  // Helper function to decode hex to ASCII
  const hexToAscii = (hex) => {
    try {
      let str = '';
      for (let i = 0; i < hex.length; i += 2) {
        const charCode = parseInt(hex.substr(i, 2), 16);
        if (charCode >= 32 && charCode <= 126) {
          str += String.fromCharCode(charCode);
        }
      }
      return str;
    } catch (e) {
      return '';
    }
  };

  // Get pool URL based on pool name
  const getPoolUrl = (poolName) => {
    const poolUrls = {
      'Zergpool': 'https://zergpool.com',
      'Zpool': 'https://zpool.ca',
      'Z-NOMP': 'https://github.com/z-classic/z-nomp',
      'DarkFiberMines': 'https://darkfibermines.com',
      '2Mars': 'https://2mars.io',
      'Solo Pool': 'https://solo-pool.com',
      'F2Pool': 'https://www.f2pool.com',
      'ViaBTC': 'https://www.viabtc.com',
      'BTCZ Pool': 'https://btcz.pool.com',
      'SlushPool': 'https://slushpool.com',
      'AntPool': 'https://www.antpool.com',
      'BTC.COM': 'https://btc.com',
      'Poolin': 'https://www.poolin.com',
      'MiningPoolHub': 'https://miningpoolhub.com'
    };
    
    return poolUrls[poolName] || `https://www.google.com/search?q=${encodeURIComponent(poolName)}+mining+pool`;
  };

  // Fetch block data
  useEffect(() => {
    const fetchBlock = async () => {
      try {
        setLoading(true);
        
        // Determine if hash is a block hash or height
        const isHeight = /^\d+$/.test(hash);
        
        let response;
        if (isHeight) {
          response = await blockService.getBlockByHeight(parseInt(hash));
        } else {
          response = await blockService.getBlockByHash(hash);
        }
        
        setBlock(response.data);
        
        // Calculate total pages based on transaction count
        const txCount = response.data.tx.length;
        setTotalPages(Math.ceil(txCount / txsPerPage));
        
        // Fetch first page of transactions
        await fetchTransactions(response.data.tx, 1);
      } catch (error) {
        console.error('Error fetching block:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchBlock();
  }, [hash]);
  
  // Fetch transaction details for the current page
  const fetchTransactions = async (txids, page) => {
    try {
      const startIndex = (page - 1) * txsPerPage;
      const endIndex = startIndex + txsPerPage;
      const pageTransactionIds = txids.slice(startIndex, endIndex);
      
      // Fetch details for each transaction
      const txPromises = pageTransactionIds.map(txid => 
        transactionService.getTransaction(txid)
      );
      
      const results = await Promise.all(txPromises);
      setTransactions(results.map(res => res.data));
      setCurrentPage(page);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };
  
  // Handle page change
  const handlePageChange = (page) => {
    fetchTransactions(block.tx, page);
    // Scroll to transaction list
    document.getElementById('transactions-list').scrollIntoView({
      behavior: 'smooth'
    });
  };
  
  // Navigate to previous/next block
  const navigateToBlock = (height) => {
    if (height < 0) return;
    navigate(`/blocks/height/${height}`);
  };
  
  // Extract miner information if available
  const extractMinerInfo = async () => {
    if (!block) return { name: 'Unknown Pool', url: null };
    
    try {
      // First, let's check if we have a coinbase transaction
      const coinbaseTx = transactions.find(tx => 
        tx.vin && tx.vin.length > 0 && tx.vin.some(input => input.coinbase)
      );
      
      if (coinbaseTx) {
        // Common mining pools often include their name in the coinbase signature
        const knownPools = {
          'Zerg': 'Zergpool',
          'zergpool': 'Zergpool',
          'zpool': 'Zpool',
          'Z-NOMP': 'Z-NOMP',
          'darkfibermines': 'DarkFiberMines',
          '2miners': '2Mars',
          'solopool': 'Solo Pool',
          'f2pool': 'F2Pool',
          'viabtc': 'ViaBTC',
          'btcz.pool': 'BTCZ Pool',
          'slush': 'SlushPool',
          'antpool': 'AntPool',
          'btc.com': 'BTC.COM',
          'poolin': 'Poolin'
        };
        
        // Check if any known pool signature is in the coinbase data
        if (coinbaseTx.vin[0].coinbase) {
          const coinbaseHex = coinbaseTx.vin[0].coinbase;
          // Convert hex to ASCII to check for pool signatures
          const coinbaseAscii = hexToAscii(coinbaseHex);
          
          for (const [signature, poolName] of Object.entries(knownPools)) {
            if (coinbaseAscii.toLowerCase().includes(signature.toLowerCase())) {
              return { 
                name: poolName, 
                url: getPoolUrl(poolName) 
              };
            }
          }
          
          // Look for anything that might be a pool name
          const nameMatch = coinbaseAscii.match(/([A-Za-z0-9]+\s*Pool|[A-Za-z0-9]+\s*Miner)/);
          if (nameMatch) {
            const poolName = nameMatch[0];
            return { 
              name: poolName, 
              url: getPoolUrl(poolName) 
            };
          }
        }
        
        // If we have output addresses, check if they match known mining pools
        if (coinbaseTx.vout && coinbaseTx.vout.length > 0) {
          const firstOutput = coinbaseTx.vout[0];
          if (firstOutput.scriptPubKey && firstOutput.scriptPubKey.addresses) {
            const address = firstOutput.scriptPubKey.addresses[0];
            
            // Check if address matches any known mining pool addresses
            const knownAddresses = {
              't1VpYDGfKR8jkGc5LCCRj7PUdHTsRmwxeQc': 'Zergpool',
              't1N1LNyPpYRbBFoVZBsUgcuMZiGHyBJcmRN': 'MiningPoolHub'
            };
            
            if (knownAddresses[address]) {
              const poolName = knownAddresses[address];
              return { 
                name: poolName, 
                url: getPoolUrl(poolName) 
              };
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching mining pool data:', error);
    }
    
    return { name: 'Unknown Pool', url: null };
  };
  
  // Add miner information when available
  useEffect(() => {
    if (block && transactions.length > 0) {
      extractMinerInfo().then(minerInfo => {
        if (minerInfo.name !== 'Unknown Pool') {
          setBlock(prevBlock => ({
            ...prevBlock,
            minerInfo: minerInfo.name,
            minerUrl: minerInfo.url
          }));
        }
      });
    }
  }, [block, transactions]);
  
  if (loading) {
    return <Spinner message="Loading block data..." />;
  }
  
  if (!block) {
    return (
      <div className="card text-center py-8">
        <h2 className="text-2xl font-bold mb-4">Block Not Found</h2>
        <p className="text-gray-500 mb-4">
          The block you are looking for does not exist or has not been indexed yet.
        </p>
        <Link to="/" className="btn btn-primary">Back to Home</Link>
      </div>
    );
  }
  
  // Prepare block details for detail card
  const blockDetails = [
    { label: 'Hash', value: block.hash },
    { label: 'Height', value: formatNumber(block.height) },
    { label: 'Confirmations', value: formatNumber(block.confirmations) },
    { label: 'Timestamp', value: `${formatTimestamp(block.time)} (${moment.unix(block.time).fromNow()})` },
    { label: 'Difficulty', value: block.difficulty.toFixed(8) },
    { label: 'Merkle Root', value: block.merkleroot },
    { label: 'Size', value: `${formatNumber(block.size)} bytes` },
    { label: 'Version', value: block.version },
    { label: 'Nonce', value: block.nonce },
    { label: 'Bits', value: block.bits },
    { label: 'Transaction Count', value: formatNumber(block.tx.length) }
  ];
  
  // Add miner information if available
  if (block.minerInfo) {
    blockDetails.push({ 
      label: 'Mined by', 
      value: block.minerUrl ? (
        <a href={block.minerUrl} target="_blank" rel="noopener noreferrer" className="text-bitcoinz-600 hover:underline">
          {block.minerInfo}
        </a>
      ) : block.minerInfo
    });
  }
  
  // Add previous and next block if available
  if (block.previousblockhash) {
    blockDetails.push({ label: 'Previous Block', value: (
      <Link to={`/blocks/${block.previousblockhash}`} className="text-bitcoinz-600 hover:underline">
        {block.previousblockhash}
      </Link>
    )});
  }
  
  if (block.nextblockhash) {
    blockDetails.push({ label: 'Next Block', value: (
      <Link to={`/blocks/${block.nextblockhash}`} className="text-bitcoinz-600 hover:underline">
        {block.nextblockhash}
      </Link>
    )});
  }
  
  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 pb-8 sm:pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 space-y-3 sm:space-y-0">
        <h1 className="text-xl sm:text-3xl font-bold flex items-center">
          <FaCube className="text-bitcoinz-600 mr-2 sm:mr-3" size={20} />
          <span className="flex-grow truncate">Block #{formatNumber(block.height)}</span>
        </h1>
        
        <div className="flex space-x-2">
          <button
            onClick={() => navigateToBlock(block.height - 1)}
            disabled={block.height === 0}
            className={`btn btn-sm px-2 py-1 sm:px-3 sm:py-2 ${block.height === 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'btn-secondary'}`}
            aria-label="Previous Block"
          >
            <span className="hidden sm:inline"><FaArrowLeft className="mr-2" /> Previous</span>
            <span className="sm:hidden"><FaArrowLeft /></span>
          </button>
          <button
            onClick={() => navigateToBlock(block.height + 1)}
            disabled={!block.nextblockhash}
            className={`btn btn-sm px-2 py-1 sm:px-3 sm:py-2 ${!block.nextblockhash ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'btn-secondary'}`}
            aria-label="Next Block"
          >
            <span className="hidden sm:inline">Next <FaArrowRight className="ml-2" /></span>
            <span className="sm:hidden"><FaArrowRight /></span>
          </button>
        </div>
      </div>
      
      <DetailCard
        title="Block Details"
        items={blockDetails}
        copyable={['Hash', 'Merkle Root']}
      />
      
      <div id="transactions-list" className="mt-6 sm:mt-8">
        <h2 className="text-lg sm:text-2xl font-bold mb-3 sm:mb-4">Transactions ({formatNumber(block.tx.length)})</h2>
        
        {transactions.length > 0 ? (
          <>
            <div className="space-y-3 sm:space-y-4 mb-4">
              {transactions.map(tx => (
                <TransactionCard key={tx.txid} transaction={tx} />
              ))}
            </div>
            
            <div className="pb-4 sm:pb-0">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          </>
        ) : (
          <div className="card text-center py-4 sm:py-8 max-w-5xl mx-auto">
            <p className="text-gray-500">No transactions available</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Block;

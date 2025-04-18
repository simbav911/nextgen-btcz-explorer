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
  
  const txsPerPage = 10;
  
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
    if (!block) return 'Unknown';
    
    try {
      // Try to use the backend API to get mining pool information
      const response = await api.get('/charts/mined-block');
      
      if (response.data && response.data.data) {
        // The API returns mining pool data for recent blocks
        // We need to check if our block's hash or coinbase transaction matches
        
        // First, let's check if we have a coinbase transaction
        const coinbaseTx = transactions.find(tx => 
          tx.vin && tx.vin.length > 0 && tx.vin.some(input => input.coinbase)
        );
        
        if (coinbaseTx) {
          // Common mining pools often include their name in the coinbase signature
          const knownPools = {
            'Zerg': 'Zergpool',
            'zergpool': 'Zergpool',
            '/slush/': 'SlushPool',
            'Mined by AntPool': 'AntPool',
            '/BTC.COM/': 'BTC.COM',
            'ViaBTC': 'ViaBTC',
            'F2Pool': 'F2Pool',
            'Poolin': 'Poolin',
            'btcz.pool': 'BTCZ Pool',
            'solopool': 'Solo Pool',
            '2miners': '2Mars'
          };
          
          // Check if any known pool signature is in the coinbase data
          if (coinbaseTx.vin[0].coinbase) {
            const coinbaseHex = coinbaseTx.vin[0].coinbase;
            try {
              // Convert hex to ASCII to check for pool signatures
              const coinbaseAscii = Buffer.from(coinbaseHex, 'hex').toString('ascii');
              
              for (const [signature, poolName] of Object.entries(knownPools)) {
                if (coinbaseAscii.includes(signature)) {
                  return poolName;
                }
              }
            } catch (e) {
              // If conversion fails, just continue
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
                return knownAddresses[address];
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching mining pool data:', error);
    }
    
    return 'Unknown';
  };
  
  // Add miner information when available
  useEffect(() => {
    if (block && transactions.length > 0) {
      extractMinerInfo().then(minerName => {
        if (minerName !== 'Unknown') {
          setBlock(prevBlock => ({
            ...prevBlock,
            minerInfo: minerName
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
      value: block.minerInfo
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
    <div className="container-custom max-w-6xl mx-auto px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold flex items-center">
          <FaCube className="text-bitcoinz-600 mr-3" />
          Block #{formatNumber(block.height)}
        </h1>
        
        <div className="flex space-x-2">
          <button
            onClick={() => navigateToBlock(block.height - 1)}
            disabled={block.height === 0}
            className={`btn btn-sm ${block.height === 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'btn-secondary'}`}
          >
            <FaArrowLeft className="mr-2" /> Previous Block
          </button>
          <button
            onClick={() => navigateToBlock(block.height + 1)}
            disabled={!block.nextblockhash}
            className={`btn btn-sm ${!block.nextblockhash ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'btn-secondary'}`}
          >
            Next Block <FaArrowRight className="ml-2" />
          </button>
        </div>
      </div>
      
      <DetailCard
        title="Block Details"
        items={blockDetails}
        copyable={['Hash', 'Merkle Root']}
      />
      
      <div id="transactions-list" className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Transactions ({formatNumber(block.tx.length)})</h2>
        
        {transactions.length > 0 ? (
          <>
            <div className="space-y-4 mb-4">
              {transactions.map(tx => (
                <TransactionCard key={tx.txid} transaction={tx} />
              ))}
            </div>
            
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </>
        ) : (
          <div className="card text-center py-8 max-w-5xl mx-auto">
            <p className="text-gray-500">No transactions available</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Block;

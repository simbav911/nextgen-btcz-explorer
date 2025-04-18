import React, { useState, useEffect, useContext, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  FaCube, 
  FaExchangeAlt, 
  FaNetworkWired, 
  FaSearch, 
  FaDollarSign,
  FaHashtag,
  FaMountain,
  FaLayerGroup,
  FaBalanceScale
} from 'react-icons/fa';

// Components
import SearchBox from '../components/SearchBox';
import BlockCard from '../components/BlockCard';
import TransactionCard from '../components/TransactionCard';
import StatCard from '../components/StatCard';
import Spinner from '../components/Spinner';

// Contexts
import { SocketContext } from '../contexts/SocketContext';
import { ToastContext } from '../contexts/ToastContext';

// Services
import { blockService, transactionService, statsService, priceService } from '../services/api';

// Utils
import { formatNumber, formatBTCZ, formatDifficulty } from '../utils/formatting';

// Define icons outside the component for stable references
const latestBlockIcon = <FaLayerGroup className="text-blue-600" size={24} />;
const difficultyIcon = <FaBalanceScale className="text-purple-600" size={24} />;
const hashrateIcon = <FaMountain className="text-orange-600" size={24} />;
const priceIcon = <FaDollarSign className="text-green-600" size={24} />;

const Home = () => {
  const [loading, setLoading] = useState(true);
  const [latestBlocks, setLatestBlocks] = useState([]);
  const [latestTransactions, setLatestTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [btczPrice, setBtczPrice] = useState(null);
  
  const socket = useContext(SocketContext);
  const { showToast } = useContext(ToastContext);
  const notifiedBlockHeights = useRef(new Set()); // Track notified block heights
  
  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch latest blocks, transactions, stats, and price in parallel
        const [blocksResponse, txResponse, statsResponse, priceData] = await Promise.all([
          blockService.getLatestBlocks(5),
          transactionService.getLatestTransactions(5),
          statsService.getNetworkStats(),
          priceService.getBitcoinZPrice()
        ]);
        
        setLatestBlocks(blocksResponse.data.blocks);
        setLatestTransactions(txResponse.data.transactions);
        setStats(statsResponse.data);
        setBtczPrice(priceData.bitcoinz);
      } catch (error) {
        console.error('Error fetching data:', error);
        showToast('Failed to fetch blockchain data', 'error');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    
    // Set up interval to refresh price every 5 minutes
    const priceRefreshInterval = setInterval(async () => {
      try {
        const priceData = await priceService.getBitcoinZPrice();
        setBtczPrice(priceData.bitcoinz);
      } catch (error) {
        console.error('Error refreshing price:', error);
      }
    }, 5 * 60 * 1000);
    
    return () => {
      clearInterval(priceRefreshInterval);
    };
  }, [showToast]);
  
  // Listen for new blocks and transactions via socket
  useEffect(() => {
    if (!socket) return;
    
    socket.on('new_block', (block) => {
      setLatestBlocks(prevBlocks => {
        // Combine new block with previous blocks
        const combined = [block, ...prevBlocks];
        // Use a Map to deduplicate based on block hash
        const uniqueBlocksMap = new Map(combined.map(b => [b.hash, b]));
        // Convert back to an array
        let uniqueBlocksArray = Array.from(uniqueBlocksMap.values());
        // Ensure blocks are sorted by height descending
        uniqueBlocksArray.sort((a, b) => b.height - a.height);
        // Slice to limit (e.g., 5)
        const finalBlocks = uniqueBlocksArray.slice(0, 5);

        // Compare hashes to see if the list actually changed
        const newHashes = finalBlocks.map(b => b.hash);
        const prevHashes = prevBlocks.map(b => b.hash);

        if (newHashes.length !== prevHashes.length || newHashes.some((hash, index) => hash !== prevHashes[index])) {
          // Only update state if the list content has changed
          return finalBlocks;
        } else {
          // Return previous state reference if no change
          return prevBlocks;
        }
      });
      
      // Show toast only once per block height
      if (!notifiedBlockHeights.current.has(block.height)) {
        showToast(`New block #${block.height} mined`, 'info');
        notifiedBlockHeights.current.add(block.height);
      }
    });
    
    socket.on('new_transactions', (transactions) => {
      setLatestTransactions(prevTxs => {
        // Combine new and previous transactions
        const combined = [...transactions, ...prevTxs];
        // Use a Map to deduplicate based on txid
        const uniqueTxsMap = new Map(combined.map(tx => [tx.txid, tx]));
        // Convert back to an array
        const uniqueTxsArray = Array.from(uniqueTxsMap.values());
        // Slice to limit (e.g., 5)
        const finalTxs = uniqueTxsArray.slice(0, 5);

        // Compare txids to see if the list actually changed
        const newTxids = finalTxs.map(tx => tx.txid);
        const prevTxids = prevTxs.map(tx => tx.txid);

        if (newTxids.length !== prevTxids.length || newTxids.some((txid, index) => txid !== prevTxids[index])) {
          // Only update state if the list content has changed
          return finalTxs;
        } else {
          // Return previous state reference if no change
          return prevTxs;
        }
      });
    });
    
    return () => {
      socket.off('new_block');
      socket.off('new_transactions');
    };
  }, [socket, showToast]);

  // Format price with change indicator
  const formatPrice = (price) => {
    if (!price) return 'Loading...';
    
    // Format the price to 6 decimal places
    return `$${price.usd.toFixed(6)}`;
  };
  
  // Create price change object for StatCard
  const getPriceChange = () => {
    if (!btczPrice || btczPrice.usd_24h_change === undefined) return null;
    
    return {
      positive: btczPrice.usd_24h_change >= 0,
      value: `${Math.abs(btczPrice.usd_24h_change).toFixed(2)}%`,
      period: '24h'
    };
  };

  // Format difficulty to be more readable
  const formatReadableDifficulty = (difficulty) => {
    if (!difficulty) return 'Loading...';
    
    // Format with commas for better readability
    return difficulty.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  // Memoize the rendered list of blocks
  const blockCards = useMemo(() => {
    return latestBlocks.map(block => (
      <BlockCard key={block.hash} block={block} />
    ));
  }, [latestBlocks]);

  // Memoize the rendered list of transactions
  const transactionCards = useMemo(() => {
    return latestTransactions.map(tx => (
      <TransactionCard key={tx.txid} transaction={tx} />
    ));
  }, [latestTransactions]);
  
  return (
    <div className="container-custom py-4">
      {/* Hero Section with Search */}
      <div className="bg-gradient-to-r from-blue-600 to-bitcoinz-600 rounded-lg shadow-md mb-6 p-4 sm:p-6">
        <div className="text-center mb-3">
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">BitcoinZ Blockchain Explorer</h1>
          <p className="text-white text-sm opacity-90 mb-3">Search for blocks, transactions, and addresses on the BitcoinZ blockchain</p>
        </div>
        <SearchBox />
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Link to="/blocks" className="block">
          <StatCard
            title="Latest Block"
            value={stats && stats.blockchainInfo ? formatNumber(stats.blockchainInfo.blocks) : 'Loading...'}
            icon={latestBlockIcon}
            color="blue"
          />
        </Link>
        
        <Link to="/stats" className="block">
          <StatCard
            title="Difficulty"
            value={stats && stats.blockchainInfo ? formatDifficulty(stats.blockchainInfo.difficulty) : 'Loading...'}
            icon={difficultyIcon}
            color="purple"
          />
        </Link>
        
        <Link to="/stats" className="block">
          <StatCard
            title="Network Hashrate"
            value={stats && stats.miningInfo ? `${formatNumber(stats.miningInfo.networkhashps)} H/s` : 'Loading...'}
            icon={hashrateIcon}
            color="orange"
          />
        </Link>
        
        <Link to="/charts" className="block">
          <StatCard
            title="BTCZ Price"
            value={btczPrice ? `$${btczPrice.usd.toFixed(8)}` : 'Loading...'}
            icon={priceIcon}
            color="green"
            change={btczPrice ? {
              value: `${Math.abs(btczPrice.usd_24h_change).toFixed(2)}%`,
              positive: btczPrice.usd_24h_change >= 0,
              period: '24h'
            } : null}
          />
        </Link>
      </div>

      {/* Latest Blocks and Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Latest Blocks */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Latest Blocks</h2>
            <Link 
              to="/blocks" 
              className="text-bitcoinz-600 hover:text-bitcoinz-800 text-sm font-medium transition-colors duration-200 relative group"
            >
              View All
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-bitcoinz-600 transition-all duration-200 group-hover:w-full"></span>
            </Link>
          </div>
          <div className="space-y-4">
            {blockCards.length > 0 ? (
              blockCards
            ) : (
              <div className="text-center py-8 text-gray-500">No blocks found</div>
            )}
          </div>
        </div>
        
        {/* Latest Transactions */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Latest Transactions</h2>
            <Link 
              to="/transactions" 
              className="text-bitcoinz-600 hover:text-bitcoinz-800 text-sm font-medium transition-colors duration-200 relative group"
            >
              View All
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-bitcoinz-600 transition-all duration-200 group-hover:w-full"></span>
            </Link>
          </div>
          <div className="space-y-4">
            {transactionCards.length > 0 ? (
              transactionCards
            ) : (
              <div className="text-center py-8 text-gray-500">No transactions found</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(Home);

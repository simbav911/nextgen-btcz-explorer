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
  FaBalanceScale,
  FaCoins,
  FaArrowRight,
  FaClock
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
import { formatNumber, formatBTCZ, formatDifficulty, formatRelativeTime } from '../utils/formatting';

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
  
  // Use a ref to track the desired count of items to display
  const displayCountRef = useRef(8);
  
  // Use a separate ref for transaction count
  const transactionCountRef = useRef(10);
  
  const socket = useContext(SocketContext);
  const { showToast } = useContext(ToastContext);
  const notifiedBlockHeights = useRef(new Set()); // Track notified block heights
  
  // Import loading effects CSS
  useEffect(() => {
    // Import loading effects stylesheet
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/styles/loading-effects.css';
    document.head.appendChild(link);
    
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // Fetch initial data with optimized loading strategy
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Set the initial display count
        const initialDisplayCount = 8;
        displayCountRef.current = initialDisplayCount;
        transactionCountRef.current = 10;
        
        // Create placeholder blocks and transactions immediately to improve perceived loading speed
        const placeholderBlocks = Array(initialDisplayCount).fill().map((_, index) => ({
          hash: `placeholder-${Date.now()}-${index}`,
          height: 0,
          time: Math.floor(Date.now() / 1000) - index * 60,
          tx: [],
          size: 0,
          isPlaceholder: true,
          isLoading: true
        }));
        
        const placeholderTransactions = Array(transactionCountRef.current).fill().map((_, index) => {
          // Create varying placeholder transaction types to match UI appearance
          let placeholderType = 't2t'; // Default type
          
          // Simulate different transaction types for natural appearance
          if (index === 0) placeholderType = 'coinbase'; // First transaction is usually coinbase
          else if (index % 5 === 1) placeholderType = 'z2z';
          else if (index % 5 === 2) placeholderType = 't2z';
          else if (index % 5 === 3) placeholderType = 'z2t';
          
          // Create a base placeholder transaction
          const basePlaceholder = {
            txid: `placeholder-${Date.now()}-${index}`,
            time: Math.floor(Date.now() / 1000) - index * 30,
            confirmations: 0,
            isPlaceholder: true,
            isLoading: true
          };
          
          // Add specific properties based on transaction type
          if (placeholderType === 'coinbase') {
            return {
              ...basePlaceholder,
              vin: [{ coinbase: 'placeholder' }],
              vout: [{ value: 12.5 }]
            };
          } else if (placeholderType === 'z2z') {
            return {
              ...basePlaceholder,
              vShieldedSpend: [{}],
              vShieldedOutput: [{}],
              vin: [],
              vout: []
            };
          } else if (placeholderType === 't2z') {
            return {
              ...basePlaceholder,
              valueBalance: -10,
              vin: [{}],
              vout: []
            };
          } else if (placeholderType === 'z2t') {
            return {
              ...basePlaceholder,
              valueBalance: 10,
              vin: [],
              vout: [{}]
            };
          } else {
            // t2t transaction
            return {
              ...basePlaceholder,
              vin: [{ address: 'placeholder' }],
              vout: [{ scriptPubKey: { addresses: ['placeholder'] } }]
            };
          }
        });
        
        // Set placeholders while we load the real data
        setLatestBlocks(placeholderBlocks);
        setLatestTransactions(placeholderTransactions);
        
        // Split up the API calls to prioritize what's visible first
        // First fetch blocks and transactions which are immediately visible
        const [blocksResponse, txResponse] = await Promise.all([
          blockService.getLatestBlocks(initialDisplayCount),
          transactionService.getLatestTransactions(transactionCountRef.current * 2)
        ]);
        
        // Update with real data as soon as it's available
        if (blocksResponse.data.blocks && blocksResponse.data.blocks.length > 0) {
          setLatestBlocks(blocksResponse.data.blocks.slice(0, displayCountRef.current));
        }
        
        // Process transactions
        let transactions = txResponse.data.transactions || [];
        if (transactions.length < transactionCountRef.current) {
          // Keep some placeholders if needed
          const placeholdersNeeded = transactionCountRef.current - transactions.length;
          const placeholders = Array(placeholdersNeeded).fill().map((_, index) => ({
            txid: `placeholder-${Date.now()}-${index}`,
            time: Math.floor(Date.now() / 1000),
            confirmations: 0,
            vin: [],
            vout: [],
            isPlaceholder: true
          }));
          
          transactions = [...transactions, ...placeholders];
        } else {
          transactions = transactions.slice(0, transactionCountRef.current);
        }
        
        setLatestTransactions(transactions);
        
        // Then fetch stats and price data which is less time-sensitive
        const [statsResponse, priceData] = await Promise.all([
          statsService.getNetworkStats(),
          priceService.getBitcoinZPrice()
        ]);
        
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
      // Immediately show toast notification for new block
      if (!notifiedBlockHeights.current.has(block.height)) {
        showToast(`New block #${block.height} mined`, 'info');
        notifiedBlockHeights.current.add(block.height);
      }
      
      setLatestBlocks(prevBlocks => {
        // Mark the new block as fully loaded with NO blur effect at all
        const newBlock = {
          ...block,
          isLoading: false, 
          hasTransitioned: true,
          noBlur: true // Special flag to completely bypass any blur effect
        };
        
        // Combine new block with previous blocks
        const combined = [newBlock, ...prevBlocks];
        
        // Update existing blocks to remove blur as well - they should now load instantly
        const updatedPrevBlocks = prevBlocks.map(b => ({
          ...b,
          isLoading: false,
          hasTransitioned: true
        }));
        
        // Use updated previous blocks instead of originals
        const updatedCombined = [newBlock, ...updatedPrevBlocks];
        
        // Use a Map to deduplicate based on block hash
        const uniqueBlocksMap = new Map(updatedCombined.map(b => [b.hash, b]));
        
        // Convert back to an array
        let uniqueBlocksArray = Array.from(uniqueBlocksMap.values());
        
        // Ensure blocks are sorted by height descending
        uniqueBlocksArray.sort((a, b) => b.height - a.height);
        
        // Slice to limit based on our display count
        const finalBlocks = uniqueBlocksArray.slice(0, displayCountRef.current);

        // Update our display count if the number of blocks has changed
        if (finalBlocks.length !== displayCountRef.current) {
          displayCountRef.current = finalBlocks.length;
          
          // Force an update of transactions to match the new block count
          setTimeout(() => {
            setLatestTransactions(prevTxs => {
              // If we already have the right number, no need to update
              if (prevTxs.length === transactionCountRef.current) {
                return prevTxs;
              }
              
              // Otherwise, adjust the transaction list to match
              if (prevTxs.length > transactionCountRef.current) {
                // If we have too many, slice them down
                return prevTxs.slice(0, transactionCountRef.current);
              } else {
                // If we have too few, add placeholders
                const placeholdersNeeded = transactionCountRef.current - prevTxs.length;
                const placeholders = Array(placeholdersNeeded).fill().map((_, index) => {
                  // Create varying placeholder transaction types to match UI appearance
                  let placeholderType = 't2t'; // Default type
                  
                  // Simulate different transaction types for natural appearance
                  if (index === 0) placeholderType = 'coinbase'; // First transaction is usually coinbase
                  else if (index % 5 === 1) placeholderType = 'z2z';
                  else if (index % 5 === 2) placeholderType = 't2z';
                  else if (index % 5 === 3) placeholderType = 'z2t';
                  
                  // Create a base placeholder transaction
                  const basePlaceholder = {
                    txid: `placeholder-${Date.now()}-${index}`,
                    time: Math.floor(Date.now() / 1000),
                    confirmations: 0,
                    isPlaceholder: true
                  };
                  
                  // Add specific properties based on transaction type
                  if (placeholderType === 'coinbase') {
                    return {
                      ...basePlaceholder,
                      vin: [{ coinbase: 'placeholder' }],
                      vout: [{ value: 12.5 }]
                    };
                  } else if (placeholderType === 'z2z') {
                    return {
                      ...basePlaceholder,
                      vShieldedSpend: [{}],
                      vShieldedOutput: [{}],
                      vin: [],
                      vout: []
                    };
                  } else if (placeholderType === 't2z') {
                    return {
                      ...basePlaceholder,
                      valueBalance: -10,
                      vin: [{}],
                      vout: []
                    };
                  } else if (placeholderType === 'z2t') {
                    return {
                      ...basePlaceholder,
                      valueBalance: 10,
                      vin: [],
                      vout: [{}]
                    };
                  } else {
                    // t2t transaction
                    return {
                      ...basePlaceholder,
                      vin: [{ address: 'placeholder' }],
                      vout: [{ scriptPubKey: { addresses: ['placeholder'] } }]
                    };
                  }
                });
                
                return [...prevTxs, ...placeholders];
              }
            });
          }, 0);
        }

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
        // Mark all new transactions from socket as unconfirmed and ensure they have current timestamp
        const processedTransactions = transactions.map(tx => {
          // If confirmations is undefined or null, set it explicitly to 0
          const newTx = { 
            ...tx, 
            confirmations: 0, // Always treat new socket transactions as unconfirmed
            time: tx.time || Math.floor(Date.now() / 1000) // Ensure time is current if not provided
          };
          return newTx;
        });
        
        // Combine new and previous transactions
        const combined = [...processedTransactions, ...prevTxs];
        // Use a Map to deduplicate based on txid
        const uniqueTxsMap = new Map(combined.map(tx => [tx.txid, tx]));
        // Convert back to an array
        const uniqueTxsArray = Array.from(uniqueTxsMap.values());
        
        // Use our consistent display count
        const currentDisplayCount = transactionCountRef.current;
        
        // Ensure we always have exactly the right number of transactions
        let finalTxs = uniqueTxsArray.slice(0, currentDisplayCount);
        
        // If we have fewer transactions than needed, add placeholder transactions
        if (finalTxs.length < currentDisplayCount) {
          // Get the number of placeholders needed
          const placeholdersNeeded = currentDisplayCount - finalTxs.length;
          
          // Create placeholders with loading state
          const placeholders = Array(placeholdersNeeded).fill().map((_, index) => {
            // Create varying placeholder transaction types to match UI appearance
            let placeholderType = 't2t'; // Default type
            
            // Simulate different transaction types for natural appearance
            if (index === 0) placeholderType = 'coinbase'; // First transaction is usually coinbase
            else if (index % 5 === 1) placeholderType = 'z2z';
            else if (index % 5 === 2) placeholderType = 't2z';
            else if (index % 5 === 3) placeholderType = 'z2t';
            
            // Create a base placeholder transaction
            const basePlaceholder = {
              txid: `placeholder-${Date.now()}-${index}`,
              time: Math.floor(Date.now() / 1000),
              confirmations: 0,
              isPlaceholder: true
            };
            
            // Add specific properties based on transaction type
            if (placeholderType === 'coinbase') {
              return {
                ...basePlaceholder,
                vin: [{ coinbase: 'placeholder' }],
                vout: [{ value: 12.5 }]
              };
            } else if (placeholderType === 'z2z') {
              return {
                ...basePlaceholder,
                vShieldedSpend: [{}],
                vShieldedOutput: [{}],
                vin: [],
                vout: []
              };
            } else if (placeholderType === 't2z') {
              return {
                ...basePlaceholder,
                valueBalance: -10,
                vin: [{}],
                vout: []
              };
            } else if (placeholderType === 'z2t') {
              return {
                ...basePlaceholder,
                valueBalance: 10,
                vin: [],
                vout: [{}]
              };
            } else {
              // t2t transaction
              return {
                ...basePlaceholder,
                vin: [{ address: 'placeholder' }],
                vout: [{ scriptPubKey: { addresses: ['placeholder'] } }]
              };
            }
          });
          
          // Add placeholders to the final list
          finalTxs = [...finalTxs, ...placeholders];
        }

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
  }, [socket, showToast, latestBlocks]);
  
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
  
  // Transaction type classifier
  const classifyTxType = (tx) => {
    const isCoinbase = tx.vin && tx.vin.length > 0 && !!tx.vin[0].coinbase;
    if (isCoinbase) return 'coinbase';

    // Shielded fields
    const hasValueBalance = typeof tx.valueBalance === 'number' && tx.valueBalance !== 0;
    const hasVJoinSplit = tx.vjoinsplit && tx.vjoinsplit.length > 0;
    const hasShieldedSpends = tx.vShieldedSpend && tx.vShieldedSpend.length > 0;
    const hasShieldedOutputs = tx.vShieldedOutput && tx.vShieldedOutput.length > 0;

    // Transparent fields
    const hasTransparentInputs = tx.vin && tx.vin.some(v => v.address);
    const hasTransparentOutputs = tx.vout && tx.vout.some(v => v.scriptPubKey && v.scriptPubKey.addresses);

    // t->z: Shielding
    if ((hasTransparentInputs || tx.vin?.length > 0) && (hasValueBalance && tx.valueBalance < 0 || hasShieldedOutputs || hasVJoinSplit) && !hasShieldedSpends) {
      return 't2z';
    }
    // z->t: Deshielding
    if ((hasShieldedSpends || hasVJoinSplit || (hasValueBalance && tx.valueBalance > 0)) && (hasTransparentOutputs || tx.vout?.length > 0)) {
      return 'z2t';
    }
    // z->z: Fully shielded
    if ((hasShieldedSpends || hasVJoinSplit) && (hasShieldedOutputs || hasVJoinSplit) && !hasTransparentInputs && !hasTransparentOutputs) {
      return 'z2z';
    }
    // t->t: Fully transparent
    if (hasTransparentInputs && hasTransparentOutputs && !hasShieldedSpends && !hasShieldedOutputs && !hasVJoinSplit && !hasValueBalance) {
      return 't2t';
    }
    // Fallback
    return 'other';
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
  
  useEffect(() => {
    // Create a style element
    const styleEl = document.createElement('style');
    
    // Define the animation keyframes
    const animationCSS = `
      @keyframes electricTilePulse {
        0% {
          opacity: 0.4;
          filter: blur(10px);
          box-shadow: 0 0 20px rgba(37, 99, 235, 0.6);
        }
        50% {
          opacity: 0.8;
          filter: blur(15px);
          box-shadow: 0 0 40px rgba(37, 99, 235, 0.8);
        }
        100% {
          opacity: 0.4;
          filter: blur(10px);
          box-shadow: 0 0 20px rgba(37, 99, 235, 0.6);
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

  return (
    <div className="container-custom py-4">
      {/* Hero Section with Search - Enhanced with shadow effects */}
      <div className="bg-gradient-to-r from-blue-600 to-bitcoinz-600 rounded-xl shadow-lg mb-5 p-4 sm:p-5 relative"
           style={{ 
             boxShadow: `
               0 10px 25px rgba(59, 130, 246, 0.3),
               0 15px 30px rgba(37, 99, 235, 0.4),
               0 0 40px rgba(59, 130, 246, 0.25),
               0 0 70px rgba(37, 99, 235, 0.15),
               0 0 5px #3b82f6,
               0 0 2px #60a5fa
             `
           }}>
        <div className="text-center mb-3">
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-1" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
            BitcoinZ Blockchain Explorer
          </h1>
          <p className="text-white text-sm opacity-90 mb-3">Search for blocks, transactions, and addresses on the BitcoinZ blockchain</p>
        </div>
        <SearchBox />
        
        {/* Electric glow effect under the tile */}
        <div 
          className="electric-glow-tile" 
          style={{
            position: 'absolute',
            width: '90%',
            height: '10px',
            background: 'linear-gradient(90deg, rgba(37, 99, 235, 0), rgba(37, 99, 235, 0.8), rgba(37, 99, 235, 0))',
            borderRadius: '50%',
            filter: 'blur(10px)',
            left: '5%',
            bottom: '-15px',
            animation: 'electricTilePulse 3s infinite'
          }}
        />
      </div>

      {/* Stats Overview - Equal sized cards with colored shadow effects */}
      <div className="stats-grid">
        <div className="stats-card-blue rounded-xl">
          <Link to="/blocks" className="block">
            <StatCard
              title="Latest Block"
              value={stats && stats.blockchainInfo ? formatNumber(stats.blockchainInfo.blocks) : 'Loading...'}
              icon={latestBlockIcon}
              color="blue"
              isLoading={loading || !stats}
            />
          </Link>
        </div>
        
        <div className="stats-card-purple rounded-xl">
          <Link to="/stats" className="block">
            <StatCard
              title="Difficulty"
              value={stats && stats.blockchainInfo ? formatDifficulty(stats.blockchainInfo.difficulty) : 'Loading...'}
              icon={difficultyIcon}
              color="purple"
              isLoading={loading || !stats}
            />
          </Link>
        </div>
        
        <div className="stats-card-orange rounded-xl">
          <Link to="/stats" className="block">
            <StatCard
              title="Network Hashrate"
              value={stats && stats.miningInfo ? `${formatNumber(stats.miningInfo.networkhashps)} H/s` : 'Loading...'}
              icon={hashrateIcon}
              color="orange"
              isLoading={loading || !stats}
            />
          </Link>
        </div>
        
        <div className="stats-card-green rounded-xl">
          <Link to="/charts" className="block">
            <StatCard
              title="BTCZ Price"
              value={btczPrice ? `$${btczPrice.usd.toFixed(8)}` : 'Loading...'}
              icon={priceIcon}
              color="green"
              isLoading={loading || !btczPrice}
              change={btczPrice ? {
                value: `${Math.abs(btczPrice.usd_24h_change).toFixed(2)}%`,
                positive: btczPrice.usd_24h_change >= 0,
                period: '24h'
              } : null}
            />
          </Link>
        </div>
      </div>

      {/* Latest Blocks and Transactions - Styling consistent with transactions page */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Latest Blocks with shadow and glow effects */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold flex items-center">
              <div className="bg-blue-100 p-1.5 rounded-full mr-2 flex-shrink-0 shadow-sm">
                <FaCube className="text-blue-600" size={18} />
              </div>
              Latest Blocks
            </h2>
            <Link 
              to="/blocks" 
              className="text-blue-600 hover:text-blue-800 text-sm font-medium bg-blue-50 px-3 py-1 rounded-full hover:bg-blue-100 transition-colors duration-200"
            >
              View All
            </Link>
          </div>
          <div className="space-y-3 blue-glow p-3 rounded-xl bg-white shadow-lg">
            {blockCards.length > 0 ? (
              blockCards
            ) : (
              <div className="text-center py-4 text-gray-500">No blocks found</div>
            )}
          </div>
        </div>
        
        {/* Latest Transactions with shadow and glow effects */}
        <div className="latest-transactions-container">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold flex items-center">
              <div className="bg-green-100 p-1.5 rounded-full mr-2 flex-shrink-0 shadow-sm">
                <FaExchangeAlt className="text-green-600" size={18} />
              </div>
              Latest Transactions
            </h2>
            <Link 
              to="/transactions" 
              className="text-green-600 hover:text-green-800 text-sm font-medium bg-green-50 px-3 py-1 rounded-full hover:bg-green-100 transition-colors duration-200"
            >
              View All
            </Link>
          </div>
          <div className="latest-transactions space-y-5 green-glow p-3 rounded-xl bg-white shadow-lg">
            {latestTransactions.map(tx => {
              // Use the same styling logic as in the TransactionList component
              const txType = classifyTxType(tx);
              const isCoinbase = txType === 'coinbase';
              
              // Style map - same as in TransactionList
              const styleMap = {
                coinbase: {
                  bg: 'bg-gradient-to-br from-yellow-50 via-yellow-100 to-white',
                  border: '6px solid #facc15',
                  iconBg: 'bg-yellow-200',
                  icon: <FaCoins className="text-yellow-600" size={16} />,
                  label: 'Coinbase',
                  labelClass: 'bg-yellow-100 text-yellow-700',
                  shadow: '0 4px 12px rgba(250, 204, 21, 0.2)'
                },
                t2z: {
                  bg: 'bg-gradient-to-br from-purple-50 via-purple-100 to-white',
                  border: '6px solid #a78bfa',
                  iconBg: 'bg-purple-200',
                  icon: <FaArrowRight className="text-purple-600" size={16} />,
                  label: 't→z',
                  labelClass: 'bg-purple-100 text-purple-700',
                  shadow: '0 4px 12px rgba(167, 139, 250, 0.2)'
                },
                z2t: {
                  bg: 'bg-gradient-to-br from-teal-50 via-green-100 to-white',
                  border: '6px solid #14b8a6',
                  iconBg: 'bg-teal-200',
                  icon: <FaArrowRight className="text-teal-600" size={16} />,
                  label: 'z→t',
                  labelClass: 'bg-teal-100 text-teal-700',
                  shadow: '0 4px 12px rgba(20, 184, 166, 0.2)'
                },
                z2z: {
                  bg: 'bg-gradient-to-br from-blue-50 via-blue-200 to-white',
                  border: '6px solid #2563eb',
                  iconBg: 'bg-blue-300',
                  icon: <FaArrowRight className="text-blue-800" size={16} />,
                  label: 'z→z',
                  labelClass: 'bg-blue-200 text-blue-800',
                  shadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
                },
                t2t: {
                  bg: 'bg-gradient-to-br from-blue-50 via-white to-blue-100',
                  border: '6px solid #38bdf8',
                  iconBg: 'bg-blue-200',
                  icon: <FaExchangeAlt className="text-blue-600" size={16} />,
                  label: 't→t',
                  labelClass: 'bg-blue-100 text-blue-700',
                  shadow: '0 4px 12px rgba(56, 189, 248, 0.2)'
                },
                other: {
                  bg: 'bg-gradient-to-br from-gray-50 via-gray-100 to-white',
                  border: '6px solid #a3a3a3',
                  iconBg: 'bg-gray-200',
                  icon: <FaExchangeAlt className="text-gray-600" size={16} />,
                  label: 'Other',
                  labelClass: 'bg-gray-100 text-gray-700',
                  shadow: '0 4px 12px rgba(163, 163, 163, 0.2)'
                },
              };
              const style = styleMap[txType] || styleMap.other;
              
              return (
                <div
                  key={tx.txid}
                  className={`transaction-tile ${tx.isPlaceholder ? 'placeholder-tile' : ''}`}
                  style={{
                    borderLeft: style.border,
                    boxShadow: style.shadow,
                    filter: tx.isPlaceholder ? 'blur(6px)' : 'none',
                    opacity: tx.isPlaceholder ? 0.7 : 1
                  }}
                >
                  <Link to={`/tx/${tx.txid}`} className="block">
                    <div className="transaction-tile-compact">
                      {/* Top section with icon and type */}
                      <div className="transaction-header">
                        <div className="flex items-center">
                          <div className={`transaction-type-indicator ${style.iconBg}`}>
                            {style.icon}
                          </div>
                          <span className="text-sm font-medium">{isCoinbase ? 'Coinbase' : 'Transaction'}</span>
                          <span className={`ml-2 text-xs py-0.5 px-1.5 rounded-full font-medium ${style.labelClass}`}>{style.label}</span>
                        </div>
                        <span className="text-xs py-0.5 px-1.5 rounded font-medium bg-gray-50 text-gray-500 border border-gray-100">
                          {tx.confirmations > 0 ? `${tx.confirmations} Confirms` : 'Unconfirmed'}
                        </span>
                      </div>
                      
                      {/* Transaction ID and time */}
                      <div className="flex justify-between items-center text-xs text-gray-500 mb-1">
                        <div className="font-mono overflow-hidden text-overflow-ellipsis">
                          <span className="text-gray-600">ID:</span> {tx.txid.substring(0, 10)}...
                        </div>
                        <div className="flex items-center">
                          <FaClock className="mr-1" size={10} />
                          {formatRelativeTime(tx.time)}
                        </div>
                      </div>
                      
                      {/* From/To section - simplified for homepage */}
                      <div className="mt-1 flex justify-between text-xs">
                        <div className="flex-grow">
                          <span className="text-gray-500 font-medium">
                            {isCoinbase ? 'Mining Reward' : `${tx.vout ? formatBTCZ(tx.vout.reduce((sum, output) => sum + (output.value || 0), 0)) : '0.00 BTCZ'}`}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <span className="text-xs text-gray-500 mr-1">Block:</span>
                          <Link 
                            to={tx.blockhash ? `/blocks/${tx.blockhash}` : '#'} 
                            className="text-blue-600 hover:underline"
                            onClick={(e) => tx.blockhash ? e.stopPropagation() : e.preventDefault()}
                          >
                            {tx.height || (tx.blockhash ? tx.blockhash.substring(0, 6) + '...' : 'Pending')}
                          </Link>
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
            {latestTransactions.length === 0 && (
              <div className="text-center py-4 text-gray-500">No transactions found</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(Home);

import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { FaCube, FaExchangeAlt, FaNetworkWired, FaSearch } from 'react-icons/fa';

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
import { blockService, transactionService, statsService } from '../services/api';

// Utils
import { formatNumber, formatBTCZ, formatDifficulty } from '../utils/formatting';

const Home = () => {
  const [loading, setLoading] = useState(true);
  const [latestBlocks, setLatestBlocks] = useState([]);
  const [latestTransactions, setLatestTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  
  const socket = useContext(SocketContext);
  const { showToast } = useContext(ToastContext);
  
  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch latest blocks, transactions, and stats in parallel
        const [blocksResponse, txResponse, statsResponse] = await Promise.all([
          blockService.getLatestBlocks(5),
          transactionService.getLatestTransactions(5),
          statsService.getNetworkStats()
        ]);
        
        setLatestBlocks(blocksResponse.data.blocks);
        setLatestTransactions(txResponse.data.transactions);
        setStats(statsResponse.data);
      } catch (error) {
        console.error('Error fetching data:', error);
        showToast('Failed to fetch blockchain data', 'error');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [showToast]);
  
  // Listen for new blocks and transactions via socket
  useEffect(() => {
    if (!socket) return;
    
    socket.on('new_block', (block) => {
      setLatestBlocks(prevBlocks => {
        // Add block to beginning and remove last block
        const newBlocks = [block, ...prevBlocks.slice(0, -1)];
        return newBlocks;
      });
      showToast(`New block #${block.height} mined`, 'info');
    });
    
    socket.on('new_transactions', (transactions) => {
      setLatestTransactions(prevTxs => {
        // Add new transactions to beginning and limit total
        const newTxs = [...transactions, ...prevTxs].slice(0, 5);
        return newTxs;
      });
    });
    
    return () => {
      socket.off('new_block');
      socket.off('new_transactions');
    };
  }, [socket, showToast]);
  
  return (
    <div>
      {/* Hero section with search */}
      <div className="bg-gradient-to-r from-bitcoinz-700 to-bitcoinz-900 text-white py-16 px-4 rounded-lg mb-8">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">BitcoinZ Blockchain Explorer</h1>
          <p className="text-xl mb-8">
            Search for blocks, transactions, and addresses on the BitcoinZ blockchain
          </p>
          <SearchBox placeholder="Enter a block height, transaction hash, or address..." />
        </div>
      </div>
      
      {/* Stats Section */}
      {loading ? (
        <Spinner message="Loading blockchain data..." />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats && (
              <>
                <StatCard 
                  title="Latest Block" 
                  value={formatNumber(stats.blockchainInfo.blocks)} 
                  icon={<FaCube className="text-blue-600" size={24} />}
                  color="blue"
                />
                <StatCard 
                  title="Difficulty" 
                  value={formatDifficulty(stats.blockchainInfo.difficulty)} 
                  icon={<FaNetworkWired className="text-green-600" size={24} />}
                  color="green"
                />
                <StatCard 
                  title="Network Hashrate" 
                  value={formatNumber(stats.miningInfo.networkhashps)} 
                  icon={<FaNetworkWired className="text-yellow-600" size={24} />}
                  color="yellow"
                />
                <StatCard 
                  title="Connections" 
                  value={formatNumber(stats.networkInfo.connections)} 
                  icon={<FaNetworkWired className="text-red-600" size={24} />}
                  color="red"
                />
              </>
            )}
          </div>
          
          {/* Latest Blocks and Transactions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Latest Blocks */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Latest Blocks</h2>
                <Link to="/blocks" className="text-bitcoinz-600 hover:underline">View All</Link>
              </div>
              
              {latestBlocks.length > 0 ? (
                <div className="space-y-4">
                  {latestBlocks.map(block => (
                    <BlockCard key={block.hash} block={block} />
                  ))}
                </div>
              ) : (
                <div className="card text-center py-8">
                  <p className="text-gray-500">No blocks available</p>
                </div>
              )}
            </div>
            
            {/* Latest Transactions */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Latest Transactions</h2>
                <Link to="/transactions" className="text-bitcoinz-600 hover:underline">View All</Link>
              </div>
              
              {latestTransactions.length > 0 ? (
                <div className="space-y-4">
                  {latestTransactions.map(tx => (
                    <TransactionCard key={tx.txid} transaction={tx} />
                  ))}
                </div>
              ) : (
                <div className="card text-center py-8">
                  <p className="text-gray-500">No transactions available</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Home;

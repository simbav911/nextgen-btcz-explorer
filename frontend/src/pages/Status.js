import React, { useState, useEffect, useContext } from 'react';
import { SocketContext } from '../contexts/SocketContext';
import { statsService } from '../services/api';
import { motion } from 'framer-motion';
import { 
  FaChartLine, 
  FaCube, 
  FaNetworkWired, 
  FaServer, 
  FaDatabase,
  FaClock,
  FaCogs,
  FaInfoCircle,
  FaExchangeAlt,
  FaHashtag,
  FaLink,
  FaMountain,
  FaLayerGroup,
  FaUsers,
  FaBalanceScale,
  FaGlobe
} from 'react-icons/fa';

const Status = () => {
  const [stats, setStats] = useState({
    networkInfo: {
      connections: 0,
      version: '',
      subversion: '',
      protocolversion: '',
    },
    blockchainInfo: {
      blocks: 0,
      headers: 0,
      bestblockhash: '',
      difficulty: 0,
      mediantime: 0,
      verificationprogress: 0
    },
    miningInfo: {
      networkhashps: 0,
      difficulty: 0
    },
    loading: true
  });
  const [activeTab, setActiveTab] = useState('overview');

  const socket = useContext(SocketContext);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await statsService.getNetworkStats();
        setStats({
          ...response.data,
          loading: false
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
        setStats(prev => ({ ...prev, loading: false }));
      }
    };

    fetchStats();

    // Listen for updates from socket if available
    if (socket) {
      socket.on('stats_update', (newStats) => {
        setStats(prev => ({
          ...prev,
          ...newStats,
          loading: false
        }));
      });

      return () => {
        socket.off('stats_update');
      };
    }
  }, [socket]);

  const formatHashrate = (hashrate) => {
    if (hashrate === 0) return '0 H/s';
    
    const units = ['H/s', 'KH/s', 'MH/s', 'GH/s', 'TH/s', 'PH/s', 'EH/s'];
    const i = Math.floor(Math.log(hashrate) / Math.log(1000));
    
    return parseFloat((hashrate / Math.pow(1000, i)).toFixed(2)) + ' ' + units[i];
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Unknown';
    
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };
  
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5,
        ease: "easeOut"
      }
    }
  };

  // Stat card component for reuse
  const StatCard = ({ title, value, icon, color, subtitle }) => (
    <motion.div 
      variants={itemVariants}
      whileHover={{ y: -5 }}
      transition={{ type: "spring", stiffness: 300 }}
      className={`bg-white rounded-lg shadow-md p-6 border-t-4 border-${color}-500 hover:shadow-lg transition-all duration-300 shadow-${color}-100`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-700">{title}</h3>
        <div className={`bg-${color}-100 p-3 rounded-full text-${color}-600`}>
          {icon}
        </div>
      </div>
      <div className={`text-2xl font-bold text-${color}-600 mb-1`}>{value}</div>
      {subtitle && <p className="text-gray-500 text-sm">{subtitle}</p>}
    </motion.div>
  );

  // Detail item component for reuse
  const DetailItem = ({ label, value, copyable }) => (
    <motion.div 
      variants={itemVariants}
      className="flex flex-col md:flex-row py-3 border-b border-gray-100 last:border-b-0"
    >
      <div className="w-full md:w-1/3 text-gray-600 font-medium mb-1 md:mb-0">
        {label}
      </div>
      <div className="w-full md:w-2/3 font-mono text-sm bg-gray-50 p-2 rounded break-all">
        {value}
      </div>
    </motion.div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8"
      >
        <h1 className="text-3xl font-bold flex items-center mb-4 md:mb-0">
          <div className="text-bitcoinz-600 mr-3 bg-blue-50 p-2 rounded-lg border border-blue-200 shadow-sm">
            <FaGlobe size={24} className="text-blue-600" />
          </div>
          <span className="bg-gradient-to-r from-bitcoinz-600 to-blue-600 bg-clip-text text-transparent">
            Network Statistics
          </span>
        </h1>
        
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'overview'
                ? 'bg-white text-bitcoinz-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('blockchain')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'blockchain'
                ? 'bg-white text-bitcoinz-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Blockchain
          </button>
          <button
            onClick={() => setActiveTab('network')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'network'
                ? 'bg-white text-bitcoinz-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Network
          </button>
        </div>
      </motion.div>
      
      {stats.loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-bitcoinz-600"></div>
            <p className="mt-4 text-gray-600">Loading network statistics...</p>
          </div>
        </div>
      ) : (
        <>
          {activeTab === 'overview' && (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard 
                  title="Block Height" 
                  value={stats.blockchainInfo.blocks.toLocaleString()} 
                  icon={<FaLayerGroup size={22} />}
                  color="blue"
                  subtitle="Current blockchain height"
                />
                <StatCard 
                  title="Network Hashrate" 
                  value={formatHashrate(stats.miningInfo.networkhashps)} 
                  icon={<FaMountain size={22} />}
                  color="green"
                  subtitle="Estimated hashing power"
                />
                <StatCard 
                  title="Connections" 
                  value={stats.networkInfo.connections} 
                  icon={<FaUsers size={22} />}
                  color="purple"
                  subtitle="Active peer connections"
                />
                <StatCard 
                  title="Difficulty" 
                  value={stats.miningInfo.difficulty.toLocaleString(undefined, { maximumFractionDigits: 2 })} 
                  icon={<FaBalanceScale size={22} />}
                  color="red"
                  subtitle="Current mining difficulty"
                />
              </div>
              
              {/* Summary Card */}
              <motion.div
                variants={itemVariants}
                className="bg-white rounded-lg shadow-md p-6 mb-8 border border-gray-200"
              >
                <h2 className="text-xl font-bold mb-4 flex items-center">
                  <FaInfoCircle className="text-bitcoinz-600 mr-2" />
                  Network Summary
                </h2>
                <div className="prose max-w-none text-gray-700">
                  <p>
                    The BitcoinZ network is currently at block height <span className="font-semibold">{stats.blockchainInfo.blocks.toLocaleString()}</span> with 
                    a network difficulty of <span className="font-semibold">{stats.miningInfo.difficulty.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>. 
                    There are <span className="font-semibold">{stats.networkInfo.connections}</span> active connections 
                    to the network, and the network hashrate is <span className="font-semibold">{formatHashrate(stats.miningInfo.networkhashps)}</span>.
                  </p>
                  <p className="mt-4">
                    The blockchain sync status is at <span className="font-semibold">{(stats.blockchainInfo.verificationprogress * 100).toFixed(2)}%</span> and 
                    the current median time is <span className="font-semibold">{formatTime(stats.blockchainInfo.mediantime)}</span>.
                  </p>
                </div>
                
                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-500 mb-1">Node Version</div>
                    <div className="font-medium">{stats.networkInfo.version}</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-500 mb-1">Protocol Version</div>
                    <div className="font-medium">{stats.networkInfo.protocolversion}</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-500 mb-1">User Agent</div>
                    <div className="font-medium truncate">{stats.networkInfo.subversion}</div>
                  </div>
                </div>
              </motion.div>
              
              {/* Progress Card */}
              <motion.div
                variants={itemVariants}
                className="bg-white rounded-lg shadow-md p-6 mb-8 border border-gray-200"
              >
                <h2 className="text-xl font-bold mb-4 flex items-center">
                  <FaNetworkWired className="text-green-600 mr-2" />
                  Blockchain Sync Status
                </h2>
                
                <div className="mb-2 flex justify-between text-sm">
                  <span>Sync Status</span>
                  <span className="font-medium">{(stats.blockchainInfo.verificationprogress * 100).toFixed(2)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6">
                  <div 
                    className="bg-gradient-to-r from-green-500 to-blue-500 h-2.5 rounded-full" 
                    style={{ width: `${(stats.blockchainInfo.verificationprogress * 100)}%` }}
                  ></div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="mb-2 flex justify-between text-sm">
                      <span>Blocks</span>
                      <span className="font-medium">{stats.blockchainInfo.blocks.toLocaleString()}</span>
                    </div>
                    <div className="mb-2 flex justify-between text-sm">
                      <span>Headers</span>
                      <span className="font-medium">{stats.blockchainInfo.headers.toLocaleString()}</span>
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex justify-between text-sm">
                      <span>Median Time</span>
                      <span className="font-medium">{formatTime(stats.blockchainInfo.mediantime)}</span>
                    </div>
                    <div className="mb-2 flex justify-between text-sm">
                      <span>Best Block Hash</span>
                      <span className="font-mono text-xs truncate">{stats.blockchainInfo.bestblockhash}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
          
          {activeTab === 'blockchain' && (
            <motion.div
              className="bg-white rounded-lg shadow-md p-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-xl font-bold mb-6 flex items-center">
                <FaCube className="text-blue-600 mr-2" />
                Blockchain Information
              </h2>
              
              <div className="space-y-2">
                <DetailItem 
                  label="Current Block Height" 
                  value={stats.blockchainInfo.blocks.toLocaleString()} 
                />
                <DetailItem 
                  label="Current Headers" 
                  value={stats.blockchainInfo.headers.toLocaleString()} 
                />
                <DetailItem 
                  label="Best Block Hash" 
                  value={stats.blockchainInfo.bestblockhash} 
                />
                <DetailItem 
                  label="Difficulty" 
                  value={stats.blockchainInfo.difficulty.toLocaleString(undefined, { maximumFractionDigits: 8 })} 
                />
                <DetailItem 
                  label="Median Time" 
                  value={formatTime(stats.blockchainInfo.mediantime)} 
                />
                <DetailItem 
                  label="Sync Status" 
                  value={`${(stats.blockchainInfo.verificationprogress * 100).toFixed(4)}%`} 
                />
              </div>
              
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <FaCogs className="text-purple-600 mr-2" />
                  Mining Information
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-purple-50 p-6 rounded-lg border border-purple-100">
                    <h4 className="text-sm text-purple-700 font-medium mb-2">Network Hashrate</h4>
                    <div className="text-2xl font-bold text-purple-800">{formatHashrate(stats.miningInfo.networkhashps)}</div>
                    <p className="text-purple-600 text-sm mt-2">Estimated network hashing power</p>
                  </div>
                  
                  <div className="bg-blue-50 p-6 rounded-lg border border-blue-100">
                    <h4 className="text-sm text-blue-700 font-medium mb-2">Mining Difficulty</h4>
                    <div className="text-2xl font-bold text-blue-800">{stats.miningInfo.difficulty.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                    <p className="text-blue-600 text-sm mt-2">Current mining difficulty target</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          
          {activeTab === 'network' && (
            <motion.div
              className="bg-white rounded-lg shadow-md p-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-xl font-bold mb-6 flex items-center">
                <FaNetworkWired className="text-green-600 mr-2" />
                Network Information
              </h2>
              
              <div className="space-y-2">
                <DetailItem 
                  label="Connections" 
                  value={stats.networkInfo.connections} 
                />
                <DetailItem 
                  label="Version" 
                  value={stats.networkInfo.version} 
                />
                <DetailItem 
                  label="Protocol Version" 
                  value={stats.networkInfo.protocolversion} 
                />
                <DetailItem 
                  label="User Agent" 
                  value={stats.networkInfo.subversion} 
                />
              </div>
              
              <div className="mt-8 bg-gradient-to-r from-gray-50 to-gray-100 p-6 rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold mb-4">Connection Status</h3>
                
                <div className="flex items-center">
                  <div className="relative w-full bg-gray-200 h-1 rounded-full">
                    <div 
                      className="absolute top-0 left-0 h-1 bg-green-500 rounded-full" 
                      style={{ width: `${Math.min(stats.networkInfo.connections * 25, 100)}%` }}
                    ></div>
                  </div>
                  <span className="ml-4 text-lg font-bold">{stats.networkInfo.connections}</span>
                </div>
                
                <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                  <div className="text-xs text-gray-500">Poor<br/>&lt;1</div>
                  <div className="text-xs text-gray-500">Fair<br/>2</div>
                  <div className="text-xs text-gray-500">Good<br/>3</div>
                  <div className="text-xs text-gray-500">Excellent<br/>4+</div>
                </div>
                
                <div className="mt-6">
                  <p className="text-gray-600 text-sm">
                    {stats.networkInfo.connections === 0 ? (
                      <span className="text-red-600">No connections to the BitcoinZ network. Your node is isolated.</span>
                    ) : stats.networkInfo.connections < 2 ? (
                      <span className="text-orange-600">Few connections to the BitcoinZ network. Your node has limited redundancy.</span>
                    ) : stats.networkInfo.connections < 3 ? (
                      <span className="text-yellow-600">Fair number of connections to the BitcoinZ network. Your node has moderate redundancy.</span>
                    ) : (
                      <span className="text-green-600">Excellent number of connections to the BitcoinZ network. Your node has optimal decentralization.</span>
                    )}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
};

export default Status;
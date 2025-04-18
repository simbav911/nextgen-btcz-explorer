import React, { useState, useEffect } from 'react';
import { 
  FaChartLine, 
  FaCube, 
  FaNetworkWired, 
  FaExchangeAlt, 
  FaServer, 
  FaDatabase,
  FaClock,
  FaCogs,
  FaInfoCircle,
  FaHashtag
} from 'react-icons/fa';
import { Line } from 'react-chartjs-2';
import { Chart, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { motion } from 'framer-motion';

// Register Chart.js components
Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// Components
import Spinner from '../components/Spinner';
import StatCard from '../components/StatCard';
import DetailCard from '../components/DetailCard';

// Services
import { statsService } from '../services/api';

// Utils
import { formatNumber, formatDifficulty, formatBTCZ } from '../utils/formatting';

const Stats = () => {
  const [loading, setLoading] = useState(true);
  const [networkStats, setNetworkStats] = useState(null);
  const [historicalStats, setHistoricalStats] = useState(null);
  const [timeRange, setTimeRange] = useState('week'); // 'day', 'week', 'month'
  const [activeTab, setActiveTab] = useState('overview');
  
  // Fetch initial stats
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch current network stats
        const response = await statsService.getNetworkStats();
        setNetworkStats(response.data);
        
        // Fetch historical stats
        await fetchHistoricalStats('week');
      } catch (error) {
        console.error('Error fetching network stats:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  // Fetch historical stats based on time range
  const fetchHistoricalStats = async (range) => {
    try {
      const days = range === 'day' ? 1 : range === 'week' ? 7 : 30;
      const response = await statsService.getHistoricalStats(days);
      setHistoricalStats(response.data.stats);
      setTimeRange(range);
    } catch (error) {
      console.error('Error fetching historical stats:', error);
    }
  };
  
  // Handle time range change
  const handleTimeRangeChange = (range) => {
    fetchHistoricalStats(range);
  };
  
  // Create chart data from historical stats
  const createChartData = (label, dataKey, color) => {
    if (!historicalStats) return null;
    
    return {
      labels: historicalStats.map(stat => {
        const date = new Date(stat.date);
        return timeRange === 'day' 
          ? date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
          : date.toLocaleDateString([], {month: 'short', day: 'numeric'});
      }),
      datasets: [
        {
          label,
          data: historicalStats.map(stat => stat[dataKey]),
          borderColor: color,
          backgroundColor: `${color}33`,
          tension: 0.4,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 2
        }
      ]
    };
  };
  
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleFont: {
          size: 14,
          weight: 'bold'
        },
        bodyFont: {
          size: 13
        },
        padding: 12,
        cornerRadius: 8
      }
    },
    scales: {
      y: {
        beginAtZero: false,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
          drawBorder: false
        },
        ticks: {
          font: {
            size: 11
          }
        }
      },
      x: {
        grid: {
          display: false
        },
        ticks: {
          font: {
            size: 11
          },
          maxRotation: 45,
          minRotation: 45
        }
      }
    },
    animation: {
      duration: 1500,
      easing: 'easeOutQuart'
    },
    interaction: {
      mode: 'index',
      intersect: false
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner message="Loading network statistics..." />
      </div>
    );
  }
  
  if (!networkStats) {
    return (
      <div className="card text-center py-8 shadow-lg border border-red-100 bg-red-50">
        <FaInfoCircle className="text-red-500 text-4xl mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-4 text-red-700">Error Loading Statistics</h2>
        <p className="text-gray-600">
          Unable to load network statistics. Please try again later.
        </p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }
  
  // Extract data from network stats
  const { blockchainInfo, networkInfo, miningInfo } = networkStats;
  
  // Prepare blockchain details for detail card
  const blockchainDetails = [
    { label: 'Chain', value: blockchainInfo.chain },
    { label: 'Blocks', value: formatNumber(blockchainInfo.blocks) },
    { label: 'Best Block Hash', value: blockchainInfo.bestblockhash },
    { label: 'Difficulty', value: formatDifficulty(blockchainInfo.difficulty) },
    { label: 'Verification Progress', value: `${(blockchainInfo.verificationprogress * 100).toFixed(2)}%` },
    { label: 'Chain Work', value: blockchainInfo.chainwork },
    { label: 'Size on Disk', value: `${formatNumber(blockchainInfo.size_on_disk)} bytes` },
    { label: 'Pruned', value: blockchainInfo.pruned ? 'Yes' : 'No' }
  ];
  
  // Prepare network details for detail card
  const networkDetails = [
    { label: 'Version', value: networkInfo.version },
    { label: 'Protocol Version', value: networkInfo.protocolversion },
    { label: 'Connections', value: formatNumber(networkInfo.connections) },
    { label: 'Relay Fee', value: formatBTCZ(networkInfo.relayfee) },
    { label: 'Local Services', value: networkInfo.localservices },
    { label: 'Network Active', value: networkInfo.networkactive ? 'Yes' : 'No' },
    { label: 'Warnings', value: networkInfo.warnings || 'None' }
  ];
  
  // Prepare mining details for detail card
  const miningDetails = [
    { label: 'Network Hashrate', value: formatNumber(miningInfo.networkhashps) },
    { label: 'Mining Difficulty', value: formatDifficulty(miningInfo.difficulty) },
    { label: 'Generate', value: miningInfo.generate ? 'Yes' : 'No' },
    { label: 'Hashes Per Second', value: formatNumber(miningInfo.hashespersec) },
    { label: 'Pooled Transactions', value: formatNumber(miningInfo.pooledtx) }
  ];
  
  // Animation variants for staggered animations
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
  
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8"
      >
        <h1 className="text-3xl font-bold flex items-center mb-4 md:mb-0">
          <FaChartLine className="text-bitcoinz-600 mr-3" />
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
            onClick={() => setActiveTab('details')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'details'
                ? 'bg-white text-bitcoinz-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab('charts')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'charts'
                ? 'bg-white text-bitcoinz-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Charts
          </button>
        </div>
      </motion.div>
      
      {activeTab === 'overview' && (
        <>
          {/* Stats Cards */}
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
          >
            <motion.div variants={itemVariants}>
              <StatCard 
                title="Current Block Height" 
                value={formatNumber(blockchainInfo.blocks)} 
                icon={<FaCube className="text-blue-600" size={24} />}
                color="blue"
                change={{
                  positive: true,
                  value: "+1",
                  period: "last 10 min"
                }}
              />
            </motion.div>
            <motion.div variants={itemVariants}>
              <StatCard 
                title="Network Difficulty" 
                value={formatDifficulty(blockchainInfo.difficulty)} 
                icon={<FaNetworkWired className="text-green-600" size={24} />}
                color="green"
                change={{
                  positive: blockchainInfo.difficulty > 0,
                  value: "0.05%",
                  period: "24h"
                }}
              />
            </motion.div>
            <motion.div variants={itemVariants}>
              <StatCard 
                title="Active Connections" 
                value={formatNumber(networkInfo.connections)} 
                icon={<FaServer className="text-purple-600" size={24} />}
                color="purple"
              />
            </motion.div>
            <motion.div variants={itemVariants}>
              <StatCard 
                title="Mempool Size" 
                value={formatNumber(miningInfo.pooledtx)} 
                icon={<FaDatabase className="text-red-600" size={24} />}
                color="red"
              />
            </motion.div>
          </motion.div>
          
          {/* Quick Charts */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="mb-8"
          >
            <div className="card p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold flex items-center">
                  <FaHashtag className="text-bitcoinz-600 mr-2" />
                  Network Hashrate
                </h2>
                
                <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg">
                  <button 
                    onClick={() => handleTimeRangeChange('day')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      timeRange === 'day' 
                        ? 'bg-white text-bitcoinz-600 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    24h
                  </button>
                  <button 
                    onClick={() => handleTimeRangeChange('week')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      timeRange === 'week' 
                        ? 'bg-white text-bitcoinz-600 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    7d
                  </button>
                  <button 
                    onClick={() => handleTimeRangeChange('month')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      timeRange === 'month' 
                        ? 'bg-white text-bitcoinz-600 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    30d
                  </button>
                </div>
              </div>
              
              <div className="h-64">
                {historicalStats && createChartData('Network Hashrate', 'hashrate', '#3B82F6') && (
                  <Line 
                    data={createChartData('Network Hashrate', 'hashrate', '#3B82F6')} 
                    options={chartOptions} 
                  />
                )}
              </div>
            </div>
          </motion.div>
          
          {/* Summary Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="card p-6 mb-8"
          >
            <h3 className="text-xl font-bold mb-4 flex items-center">
              <FaInfoCircle className="text-bitcoinz-600 mr-2" />
              Network Summary
            </h3>
            <div className="prose max-w-none text-gray-700">
              <p>
                The BitcoinZ network is currently at block height <span className="font-semibold">{formatNumber(blockchainInfo.blocks)}</span> with 
                a network difficulty of <span className="font-semibold">{formatDifficulty(blockchainInfo.difficulty)}</span>. 
                There are <span className="font-semibold">{formatNumber(networkInfo.connections)}</span> active connections 
                to the network, and <span className="font-semibold">{formatNumber(miningInfo.pooledtx)}</span> transactions 
                are waiting in the mempool.
              </p>
              <p className="mt-4">
                The blockchain verification progress is at <span className="font-semibold">{(blockchainInfo.verificationprogress * 100).toFixed(2)}%</span> and 
                the current size on disk is <span className="font-semibold">{formatNumber(blockchainInfo.size_on_disk)}</span> bytes.
              </p>
            </div>
          </motion.div>
        </>
      )}
      
      {activeTab === 'details' && (
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          <motion.div variants={itemVariants}>
            <DetailCard 
              title={
                <div className="flex items-center">
                  <FaCube className="text-blue-600 mr-2" />
                  <span>Blockchain Information</span>
                </div>
              } 
              items={blockchainDetails} 
              copyable={['Best Block Hash', 'Chain Work']} 
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <DetailCard 
              title={
                <div className="flex items-center">
                  <FaNetworkWired className="text-green-600 mr-2" />
                  <span>Network Information</span>
                </div>
              } 
              items={networkDetails} 
              copyable={['Local Services']} 
            />
          </motion.div>
          <motion.div variants={itemVariants} className="lg:col-span-2">
            <DetailCard 
              title={
                <div className="flex items-center">
                  <FaCogs className="text-purple-600 mr-2" />
                  <span>Mining Information</span>
                </div>
              } 
              items={miningDetails} 
            />
          </motion.div>
        </motion.div>
      )}
      
      {activeTab === 'charts' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          <div className="flex justify-end mb-4">
            <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg">
              <button 
                onClick={() => handleTimeRangeChange('day')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  timeRange === 'day' 
                    ? 'bg-white text-bitcoinz-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                24h
              </button>
              <button 
                onClick={() => handleTimeRangeChange('week')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  timeRange === 'week' 
                    ? 'bg-white text-bitcoinz-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                7d
              </button>
              <button 
                onClick={() => handleTimeRangeChange('month')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  timeRange === 'month' 
                    ? 'bg-white text-bitcoinz-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                30d
              </button>
            </div>
          </div>
          
          <div className="card p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center">
              <FaHashtag className="text-blue-600 mr-2" />
              Network Hashrate
            </h3>
            <div className="h-80">
              {historicalStats && createChartData('Network Hashrate', 'hashrate', '#3B82F6') && (
                <Line 
                  data={createChartData('Network Hashrate', 'hashrate', '#3B82F6')} 
                  options={chartOptions} 
                />
              )}
            </div>
          </div>
          
          <div className="card p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center">
              <FaNetworkWired className="text-green-600 mr-2" />
              Difficulty
            </h3>
            <div className="h-80">
              {historicalStats && createChartData('Difficulty', 'difficulty', '#10B981') && (
                <Line 
                  data={createChartData('Difficulty', 'difficulty', '#10B981')} 
                  options={chartOptions} 
                />
              )}
            </div>
          </div>
          
          <div className="card p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center">
              <FaExchangeAlt className="text-purple-600 mr-2" />
              Transactions
            </h3>
            <div className="h-80">
              {historicalStats && createChartData('Transactions', 'transactions', '#8B5CF6') && (
                <Line 
                  data={createChartData('Transactions', 'transactions', '#8B5CF6')} 
                  options={chartOptions} 
                />
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Stats;

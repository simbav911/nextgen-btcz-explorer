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
  FaInfoCircle
} from 'react-icons/fa';
import { Line } from 'react-chartjs-2';
import { Chart, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

// Register Chart.js components
Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

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
      labels: historicalStats.map(stat => stat.date),
      datasets: [
        {
          label,
          data: historicalStats.map(stat => stat[dataKey]),
          borderColor: color,
          backgroundColor: `${color}33`,
          tension: 0.3,
          fill: true
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
          color: 'rgba(200, 200, 200, 0.1)'
        }
      },
      x: {
        grid: {
          display: false
        }
      }
    }
  };
  
  if (loading) {
    return <Spinner message="Loading network statistics..." />;
  }
  
  if (!networkStats) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
        <FaInfoCircle className="text-red-500 text-4xl mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-4">Error Loading Statistics</h2>
        <p className="text-gray-500 dark:text-gray-400">
          Unable to load network statistics. Please try again later.
        </p>
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
  
  return (
    <div className="pb-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold flex items-center">
          <FaChartLine className="text-bitcoinz-600 mr-3" />
          Network Status
        </h1>
        
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              activeTab === 'overview' 
                ? 'bg-white dark:bg-gray-800 text-bitcoinz-600 shadow-sm' 
                : 'text-gray-600 dark:text-gray-300 hover:text-bitcoinz-600 dark:hover:text-white'
            }`}
          >
            Overview
          </button>
          <button 
            onClick={() => setActiveTab('details')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              activeTab === 'details' 
                ? 'bg-white dark:bg-gray-800 text-bitcoinz-600 shadow-sm' 
                : 'text-gray-600 dark:text-gray-300 hover:text-bitcoinz-600 dark:hover:text-white'
            }`}
          >
            Details
          </button>
          <button 
            onClick={() => setActiveTab('charts')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              activeTab === 'charts' 
                ? 'bg-white dark:bg-gray-800 text-bitcoinz-600 shadow-sm' 
                : 'text-gray-600 dark:text-gray-300 hover:text-bitcoinz-600 dark:hover:text-white'
            }`}
          >
            Charts
          </button>
        </div>
      </div>
      
      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard 
              title="Current Block Height" 
              value={formatNumber(blockchainInfo.blocks)} 
              icon={<FaCube className="text-blue-600" size={24} />}
              color="blue"
            />
            <StatCard 
              title="Network Difficulty" 
              value={formatDifficulty(blockchainInfo.difficulty)} 
              icon={<FaNetworkWired className="text-green-600" size={24} />}
              color="green"
            />
            <StatCard 
              title="Active Connections" 
              value={formatNumber(networkInfo.connections)} 
              icon={<FaServer className="text-purple-600" size={24} />}
              color="purple"
            />
            <StatCard 
              title="Mempool Size" 
              value={formatNumber(miningInfo.pooledtx)} 
              icon={<FaDatabase className="text-red-600" size={24} />}
              color="red"
            />
          </div>
          
          {/* Network Status Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-lg overflow-hidden">
              <div className="bg-blue-600 px-6 py-4">
                <h3 className="text-xl font-bold text-white flex items-center">
                  <FaCube className="mr-2" /> Blockchain Information
                </h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Current Block Height</p>
                    <p className="text-2xl font-bold mt-1">{formatNumber(blockchainInfo.blocks)}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Difficulty</p>
                    <p className="text-2xl font-bold mt-1">{formatDifficulty(blockchainInfo.difficulty)}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Median Time</p>
                    <p className="text-2xl font-bold mt-1">{new Date(blockchainInfo.mediantime * 1000).toLocaleString()}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Sync Progress</p>
                    <p className="text-2xl font-bold mt-1">{(blockchainInfo.verificationprogress * 100).toFixed(2)}%</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-lg overflow-hidden">
              <div className="bg-purple-600 px-6 py-4">
                <h3 className="text-xl font-bold text-white flex items-center">
                  <FaNetworkWired className="mr-2" /> Network Information
                </h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Network Hashrate</p>
                    <p className="text-2xl font-bold mt-1">{formatNumber(miningInfo.networkhashps)} H/s</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Connections</p>
                    <p className="text-2xl font-bold mt-1">{formatNumber(networkInfo.connections)}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Version</p>
                    <p className="text-2xl font-bold mt-1">{networkInfo.version}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Protocol Version</p>
                    <p className="text-2xl font-bold mt-1">{networkInfo.protocolversion}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Mining Information */}
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-lg overflow-hidden mb-8">
            <div className="bg-green-600 px-6 py-4">
              <h3 className="text-xl font-bold text-white flex items-center">
                <FaCogs className="mr-2" /> Mining Information
              </h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                  <p className="text-gray-500 dark:text-gray-400 text-sm">Network Difficulty</p>
                  <p className="text-2xl font-bold mt-1">{formatDifficulty(miningInfo.difficulty)}</p>
                  <p className="text-xs text-gray-500 mt-1">The current mining difficulty</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                  <p className="text-gray-500 dark:text-gray-400 text-sm">Network Hashrate</p>
                  <p className="text-2xl font-bold mt-1">{formatNumber(miningInfo.networkhashps)} H/s</p>
                  <p className="text-xs text-gray-500 mt-1">Estimated network hashing power</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                  <p className="text-gray-500 dark:text-gray-400 text-sm">Pooled Transactions</p>
                  <p className="text-2xl font-bold mt-1">{formatNumber(miningInfo.pooledtx)}</p>
                  <p className="text-xs text-gray-500 mt-1">Transactions waiting in mempool</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      
      {/* Details Tab */}
      {activeTab === 'details' && (
        <div className="grid grid-cols-1 gap-6">
          <DetailCard 
            title={
              <div className="flex items-center text-blue-600">
                <FaCube className="mr-2" /> Blockchain Details
              </div>
            } 
            items={blockchainDetails} 
            copyable={['Best Block Hash', 'Chain Work']} 
          />
          
          <DetailCard 
            title={
              <div className="flex items-center text-purple-600">
                <FaNetworkWired className="mr-2" /> Network Details
              </div>
            } 
            items={networkDetails} 
            copyable={['Local Services']} 
          />
          
          <DetailCard 
            title={
              <div className="flex items-center text-green-600">
                <FaCogs className="mr-2" /> Mining Details
              </div>
            } 
            items={miningDetails} 
          />
        </div>
      )}
      
      {/* Charts Tab */}
      {activeTab === 'charts' && (
        <>
          <div className="flex justify-end mb-4">
            <div className="inline-flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button 
                onClick={() => handleTimeRangeChange('day')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 ${
                  timeRange === 'day' 
                    ? 'bg-white dark:bg-gray-800 text-bitcoinz-600 shadow-sm' 
                    : 'text-gray-600 dark:text-gray-300 hover:text-bitcoinz-600 dark:hover:text-white'
                }`}
              >
                24h
              </button>
              <button 
                onClick={() => handleTimeRangeChange('week')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 ${
                  timeRange === 'week' 
                    ? 'bg-white dark:bg-gray-800 text-bitcoinz-600 shadow-sm' 
                    : 'text-gray-600 dark:text-gray-300 hover:text-bitcoinz-600 dark:hover:text-white'
                }`}
              >
                7d
              </button>
              <button 
                onClick={() => handleTimeRangeChange('month')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 ${
                  timeRange === 'month' 
                    ? 'bg-white dark:bg-gray-800 text-bitcoinz-600 shadow-sm' 
                    : 'text-gray-600 dark:text-gray-300 hover:text-bitcoinz-600 dark:hover:text-white'
                }`}
              >
                30d
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4 text-blue-600 flex items-center">
                <FaChartLine className="mr-2" /> Difficulty
              </h3>
              <div className="h-64">
                {historicalStats && (
                  <Line 
                    data={createChartData('Difficulty', 'difficulty', '#3B82F6')} 
                    options={chartOptions} 
                  />
                )}
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4 text-green-600 flex items-center">
                <FaChartLine className="mr-2" /> Hashrate
              </h3>
              <div className="h-64">
                {historicalStats && (
                  <Line 
                    data={createChartData('Hashrate', 'hashrate', '#10B981')} 
                    options={chartOptions} 
                  />
                )}
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4 text-purple-600 flex items-center">
                <FaChartLine className="mr-2" /> Transactions
              </h3>
              <div className="h-64">
                {historicalStats && (
                  <Line 
                    data={createChartData('Transactions', 'transactions', '#8B5CF6')} 
                    options={chartOptions} 
                  />
                )}
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4 text-red-600 flex items-center">
                <FaChartLine className="mr-2" /> Avg. Block Time
              </h3>
              <div className="h-64">
                {historicalStats && (
                  <Line 
                    data={createChartData('Avg. Block Time', 'avgBlockTime', '#EF4444')} 
                    options={chartOptions} 
                  />
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Stats;

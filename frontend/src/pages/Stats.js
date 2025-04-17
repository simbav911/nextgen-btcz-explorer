import React, { useState, useEffect } from 'react';
import { 
  FaChartLine, 
  FaCube, 
  FaNetworkWired, 
  FaExchangeAlt, 
  FaServer, 
  FaDatabase,
  FaClock,
  FaCogs
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
      }
    },
    scales: {
      y: {
        beginAtZero: false
      }
    }
  };
  
  if (loading) {
    return <Spinner message="Loading network statistics..." />;
  }
  
  if (!networkStats) {
    return (
      <div className="card text-center py-8">
        <h2 className="text-2xl font-bold mb-4">Error Loading Statistics</h2>
        <p className="text-gray-500">
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
    <div>
      <h1 className="text-3xl font-bold flex items-center mb-6">
        <FaChartLine className="text-bitcoinz-600 mr-3" />
        Network Statistics
      </h1>
      
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
      
      {/* Charts */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Historical Data</h2>
          
          <div className="flex space-x-2">
            <button 
              onClick={() => handleTimeRangeChange('day')}
              className={`px-3 py-1 rounded ${timeRange === 'day' ? 'bg-bitcoinz-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              24h
            </button>
            <button 
              onClick={() => handleTimeRangeChange('week')}
              className={`px-3 py-1 rounded ${timeRange === 'week' ? 'bg-bitcoinz-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              7d
            </button>
            <button 
              onClick={() => handleTimeRangeChange('month')}
              className={`px-3 py-1 rounded ${timeRange === 'month' ? 'bg-bitcoinz-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              30d
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Difficulty Chart */}
          <div className="card">
            <h3 className="text-lg font-bold mb-4 flex items-center">
              <FaCogs className="mr-2 text-blue-500" />
              Difficulty
            </h3>
            <div className="h-64">
              {historicalStats ? (
                <Line 
                  data={createChartData('Difficulty', 'difficulty', 'rgba(37, 99, 235, 1)')} 
                  options={chartOptions} 
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No historical data available
                </div>
              )}
            </div>
          </div>
          
          {/* Hashrate Chart */}
          <div className="card">
            <h3 className="text-lg font-bold mb-4 flex items-center">
              <FaNetworkWired className="mr-2 text-green-500" />
              Network Hashrate
            </h3>
            <div className="h-64">
              {historicalStats ? (
                <Line 
                  data={createChartData('Hashrate', 'hashrate', 'rgba(22, 163, 74, 1)')} 
                  options={chartOptions} 
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No historical data available
                </div>
              )}
            </div>
          </div>
          
          {/* Transactions Chart */}
          <div className="card">
            <h3 className="text-lg font-bold mb-4 flex items-center">
              <FaExchangeAlt className="mr-2 text-purple-500" />
              Transaction Volume
            </h3>
            <div className="h-64">
              {historicalStats ? (
                <Line 
                  data={createChartData('Transactions', 'transactions', 'rgba(147, 51, 234, 1)')} 
                  options={chartOptions} 
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No historical data available
                </div>
              )}
            </div>
          </div>
          
          {/* Block Time Chart */}
          <div className="card">
            <h3 className="text-lg font-bold mb-4 flex items-center">
              <FaClock className="mr-2 text-red-500" />
              Average Block Time
            </h3>
            <div className="h-64">
              {historicalStats ? (
                <Line 
                  data={createChartData('Block Time (seconds)', 'avgBlockTime', 'rgba(220, 38, 38, 1)')} 
                  options={chartOptions} 
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No historical data available
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Detailed Information */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <DetailCard
          title="Blockchain Info"
          items={blockchainDetails}
          copyable={['Best Block Hash']}
        />
        
        <DetailCard
          title="Network Info"
          items={networkDetails}
        />
        
        <DetailCard
          title="Mining Info"
          items={miningDetails}
        />
      </div>
    </div>
  );
};

export default Stats;

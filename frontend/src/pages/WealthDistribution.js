import React, { useState, useEffect, useContext } from 'react';
import { FaCoins, FaChartPie, FaListOl, FaInfoCircle } from 'react-icons/fa';
import { ToastContext } from '../contexts/ToastContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, Sector } from 'recharts';
import './wealthDistribution.css';

// Mock data for top holders (used when API is not available)
const MOCK_TOP_HOLDERS = [
  { address: 't1KvZrdU4xYqEHmwWUQoR8JVGpUEj8E6xLs', balance: 2500000, totalReceived: 3000000, totalSent: 500000, txCount: 125, percentageOfSupply: 11.9048 },
  { address: 't1XmPsuGiJLqXG8zHWqj9Lw4gg6ZaZ8P5Hx', balance: 1800000, totalReceived: 2200000, totalSent: 400000, txCount: 87, percentageOfSupply: 8.5714 },
  { address: 't1YdPqhc5KK2JfKzxCnpf5Nf7Kbx9MzAjuQ', balance: 1200000, totalReceived: 1500000, totalSent: 300000, txCount: 65, percentageOfSupply: 5.7143 },
  { address: 't1VzQTLnQcjGTxvL4sKxLJGdJW3jUZ9TKNR', balance: 950000, totalReceived: 1100000, totalSent: 150000, txCount: 42, percentageOfSupply: 4.5238 },
  { address: 't1aMaXy1aPJ5ZGmKuQAXwKYxGKRTxnAzVr6', balance: 820000, totalReceived: 900000, totalSent: 80000, txCount: 31, percentageOfSupply: 3.9048 },
  { address: 't1NvDgnrWuEb87HhJGzsC9XJ6NtTMcb3fPc', balance: 750000, totalReceived: 800000, totalSent: 50000, txCount: 28, percentageOfSupply: 3.5714 },
  { address: 't1LpuKXeQzdYd2KHViAMKgHXuYGzxdpLqnB', balance: 680000, totalReceived: 720000, totalSent: 40000, txCount: 24, percentageOfSupply: 3.2381 },
  { address: 't1Kf6xmYDdKzx8ngEHnPQD2kMr1LuPJUJpA', balance: 620000, totalReceived: 650000, totalSent: 30000, txCount: 19, percentageOfSupply: 2.9524 },
  { address: 't1W4c6Uza6yPXvKh6Q7Rn6XCZmLxUL8jw6N', balance: 580000, totalReceived: 600000, totalSent: 20000, txCount: 17, percentageOfSupply: 2.7619 },
  { address: 't1JKtPVS8Yxeq3n1yKdCw5QnfsrRXvhgjsP', balance: 550000, totalReceived: 570000, totalSent: 20000, txCount: 15, percentageOfSupply: 2.6190 },
  { address: 't1Zg1vkMfyQMULaYvMKVJdTXHHoGpP3NUgX', balance: 520000, totalReceived: 540000, totalSent: 20000, txCount: 14, percentageOfSupply: 2.4762 },
  { address: 't1PQEgNvEZLYY6Pu5pYK5wWQWSYxFxqvnJA', balance: 490000, totalReceived: 510000, totalSent: 20000, txCount: 13, percentageOfSupply: 2.3333 },
  { address: 't1MKrZkTJKFgJ1HL7LcWWZuCgBtGu8QNXdW', balance: 460000, totalReceived: 480000, totalSent: 20000, txCount: 12, percentageOfSupply: 2.1905 },
  { address: 't1NJgQcpW4ET9vVrZQSgMtqs6VC4PjndV8K', balance: 430000, totalReceived: 450000, totalSent: 20000, txCount: 11, percentageOfSupply: 2.0476 },
  { address: 't1LwLWGgk6FgkKgKR5pvUFgfQYVQEpzXuE4', balance: 400000, totalReceived: 420000, totalSent: 20000, txCount: 10, percentageOfSupply: 1.9048 },
];

// Mock data for distribution (used when API is not available)
const MOCK_DISTRIBUTION = [
  { range: '0 - 1', count: 125000, min: 0, max: 1 },
  { range: '1 - 10', count: 85000, min: 1, max: 10 },
  { range: '10 - 100', count: 45000, min: 10, max: 100 },
  { range: '100 - 1000', count: 12000, min: 100, max: 1000 },
  { range: '1000 - 10000', count: 3500, min: 1000, max: 10000 },
  { range: '10000 - 100000', count: 850, min: 10000, max: 100000 },
  { range: '100000 - 1000000', count: 120, min: 100000, max: 1000000 },
  { range: '1000000 - ∞', count: 15, min: 1000000, max: Infinity },
];

// Mock total supply
const MOCK_TOTAL_SUPPLY = 21000000;

// Mock total addresses
const MOCK_TOTAL_ADDRESSES = 272485;

// API base URL - use relative URLs for proxy to work
const API_BASE_URL = '/api';

const WealthDistribution = () => {
  const [topHolders, setTopHolders] = useState([]);
  const [distribution, setDistribution] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('topHolders');
  const [totalSupply, setTotalSupply] = useState(0);
  const [totalAddresses, setTotalAddresses] = useState(0);
  const [usingMockData, setUsingMockData] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dataVersion, setDataVersion] = useState(0); // Add a version to prevent data changing on refresh
  const [syncStatus, setSyncStatus] = useState(null); // State for sync status
  const [pageSize, setPageSize] = useState(25); // Default show 25 holders
  const [currentPage, setCurrentPage] = useState(1);
  const [activeIndex, setActiveIndex] = useState(-1); // Track active/hovered pie segment
  const { showToast } = useContext(ToastContext);

  // Enhanced colors with better contrast
  const COLORS = [
    '#0088FE', '#00C49F', '#FFBB28', '#FF8042', 
    '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1',
    '#a4de6c', '#d0ed57', '#83a6ed', '#8884d8',
    '#fa8072', '#ff6347', '#ff7f50', '#ffa500'
  ];

  useEffect(() => {
    const fetchRealData = async () => {
      try {
        setLoading(true);
        console.log('Attempting to fetch real data from:', `${API_BASE_URL}/wealth/top-holders`);
        
        // Attempt to fetch real data first
        const holdersResponse = await fetch(`${API_BASE_URL}/wealth/top-holders?limit=100&v=${Date.now()}`, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
        
        // Process holders data
        const holdersData = await holdersResponse.json();
        console.log('Received holders data:', holdersData);
        
        // Set top holders data
        if (holdersData && holdersData.topHolders && holdersData.topHolders.length > 0) {
          // Debug: Log the first few holders to check percentage values
          console.log('First 5 holders percentages:', holdersData.topHolders.slice(0, 5).map(h => h.percentageOfSupply));
          
          setTopHolders(holdersData.topHolders);
          setTotalSupply(holdersData.totalSupply || MOCK_TOTAL_SUPPLY);
          setTotalAddresses(holdersData.totalAddressesAnalyzed || MOCK_TOTAL_ADDRESSES);
        } else {
          // If no top holders data, use mock data
          setTopHolders(MOCK_TOP_HOLDERS);
          setTotalSupply(MOCK_TOTAL_SUPPLY);
          setTotalAddresses(MOCK_TOTAL_ADDRESSES);
          setUsingMockData(true);
        }
        
        // Fetch distribution data
        console.log('Fetching distribution data from:', `${API_BASE_URL}/wealth/distribution`);
        const distributionResponse = await fetch(`${API_BASE_URL}/wealth/distribution?v=${Date.now()}`, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
        
        // Process distribution data
        const distributionData = await distributionResponse.json();
        console.log('Received distribution data:', distributionData);
        
        // Set distribution data
        if (distributionData && distributionData.distribution && distributionData.distribution.length > 0) {
          setDistribution(distributionData.distribution);
          // Only update totalAddresses if we haven't already got it from top holders
          if (!holdersData || !holdersData.totalAddressesAnalyzed) {
            setTotalAddresses(distributionData.totalAddresses || MOCK_TOTAL_ADDRESSES);
          }
          setUsingMockData(false);
        } else {
          // If no distribution data, use mock data
          setDistribution(MOCK_DISTRIBUTION);
          setUsingMockData(true);
        }
        
        // Successfully completed data fetch
        setLoading(false);
        
        if (!holdersData || !holdersData.topHolders || !distributionData || !distributionData.distribution) {
          console.log('Using mock data for some or all elements');
          showToast('Using partially simulated data for wealth distribution', 'info');
        } else {
          console.log('Successfully loaded real blockchain data');
          showToast('Using real blockchain data for wealth distribution', 'success');
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        // Fall back to mock data
        setTopHolders(MOCK_TOP_HOLDERS);
        setDistribution(MOCK_DISTRIBUTION);
        setTotalSupply(MOCK_TOTAL_SUPPLY);
        setTotalAddresses(MOCK_TOTAL_ADDRESSES);
        setUsingMockData(true);
        setLoading(false);
        showToast('Using simulated data for wealth distribution', 'info');
      }
    };
    
    // Start by trying to fetch real data
    fetchRealData();

    // Fetch sync status
    const fetchSyncStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/sync/status`);
        if (response.ok) {
          const status = await response.json();
          setSyncStatus(status);
        } else {
          console.error('Failed to fetch sync status');
        }
      } catch (error) {
        console.error('Error fetching sync status:', error);
      }
    };
    fetchSyncStatus();

  }, [showToast, dataVersion]);

  // Determine if initial sync is likely ongoing
  const isInitialSync = syncStatus && syncStatus.currentHeight > 0 &&
    (syncStatus.lastSyncedBlock < 1000 || (syncStatus.currentHeight - syncStatus.lastSyncedBlock > 1000));

  // Format number with commas
  const formatNumber = (num) => {
    // Handle null or undefined inputs gracefully
    if (num === null || num === undefined) {
      return '0';
    }
    return Math.floor(num).toLocaleString();
  };

  // Format percentage 
  const formatPercentage = (percent) => {
    // Handle null or undefined inputs gracefully
    if (percent === null || percent === undefined || typeof percent !== 'number') {
      return '0.00%';
    }
    // Format the number with 2 decimal places - scale down by 100 as backend provides percentages multiplied by 100
    return (percent / 100).toFixed(2) + '%';
  };

  // Format large percentages without scaling down
  const formatLargePercentage = (percent) => {
    if (percent === null || percent === undefined || typeof percent !== 'number') {
      return '0.00%';
    }
    // For distribution table, we want to show actual percentages without scaling
    return percent.toFixed(2) + '%';
  };

  // Format address for display
  const formatAddress = (address) => {
    return `${address.substring(0, 10)}...${address.substring(address.length - 4)}`;
  };

  // Prepare data for pie chart
  const preparePieChartData = () => {
    if (topHolders.length === 0) return [];
    
    // Take top 10 holders
    const top10 = topHolders.slice(0, 10);
    
    // Calculate total balance of all holders
    const totalBalance = topHolders.reduce((sum, holder) => sum + Number(holder.balance || 0), 0);
    
    // Calculate "Others" balance
    const othersBalance = topHolders.slice(10).reduce((sum, holder) => sum + Number(holder.balance || 0), 0);
    
    // Map top 10 holders to data points with balance as value
    const data = top10.map((holder, index) => ({
      name: `Rank ${index + 1}`, // Use clear rank labels instead of t1X format
      value: Number(holder.balance || 0),
      fullAddress: holder.address,
      shortAddress: formatAddress(holder.address),
      percentage: holder.percentageOfSupply,
      rank: index + 1
    }));
    
    // Add "Others" if there are more than 10 holders
    if (othersBalance > 0) {
      data.push({
        name: 'Others',
        value: othersBalance,
        fullAddress: 'Combined smaller holders',
        shortAddress: 'Others',
        percentage: (othersBalance / totalSupply) * 100
      });
    }
    
    return data;
  };

  // Prepare data for bar chart
  const prepareBarChartData = () => {
    return distribution.map(item => {
      // Format range for better display
      let displayRange = item.range;
      
      // Replace infinity symbol with "+" for better readability
      if (displayRange.includes('∞')) {
        displayRange = displayRange.replace('∞', '+');
      }
      
      // Add "K" for thousands and "M" for millions to make labels more compact
      if (displayRange.includes('1000000')) {
        displayRange = displayRange.replace('1000000', '1M');
      } else if (displayRange.includes('100000')) {
        displayRange = displayRange.replace('100000', '100K');
      } else if (displayRange.includes('10000')) {
        displayRange = displayRange.replace('10000', '10K');
      } else if (displayRange.includes('1000')) {
        displayRange = displayRange.replace('1000', '1K');
      }
      
      return {
        name: displayRange,
        count: item.count,
        percentage: (item.count / totalAddresses) * 100,
        originalRange: item.range // Keep original range for tooltip
      };
    });
  };

  // Calculate top 10 and top 100 holder percentages
  const getTop10Percentage = () => {
    if (!topHolders.length) return 0;
    
    // Simply sum the first 10 holders' percentages
    // The backend provides percentages that need to be scaled down by 100
    return topHolders.slice(0, 10).reduce((sum, h) => {
      // Ensure we're working with a valid number - do not scale down here
      const percentage = Number(h.percentageOfSupply || 0);
      return sum + percentage;
    }, 0);
  };

  const getTop100Percentage = () => {
    if (!topHolders.length) return 0;
    
    // Simply sum up to 100 holders' percentages
    const holdersToSum = topHolders.slice(0, Math.min(100, topHolders.length));
    return holdersToSum.reduce((sum, h) => {
      // Ensure we're working with a valid number - do not scale down here
      const percentage = Number(h.percentageOfSupply || 0);
      return sum + percentage;
    }, 0);
  };

  // Custom tooltip for pie chart
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded shadow-md">
          <p className="font-semibold">{data.name}</p>
          <p className="text-sm text-gray-600 break-all">
            {data.name === 'Others' ? 'Combined smaller holders' : data.fullAddress}
          </p>
          <p className="text-sm mt-1">Balance: {formatNumber(payload[0].value)} BTCZ</p>
          <p className="text-sm">Percentage: {(data.percentage / 1000).toFixed(2)}%</p>
        </div>
      );
    }
    return null;
  };

  // Custom legend for pie chart
  const CustomLegend = (props) => {
    const { payload } = props;
    
    return (
      <ul className="recharts-default-legend" style={{ padding: 0, margin: 0, textAlign: 'left' }}>
        {payload.map((entry, index) => {
          const item = entry.payload;
          return (
          <li 
            key={`item-${index}`} 
            className="recharts-legend-item" 
            style={{ display: 'block', marginBottom: '8px', cursor: 'pointer' }}
            onClick={() => {
              if (entry.value !== 'Others') {
                window.open(`/address/${item.fullAddress}`, '_blank');
              }
            }}
          >
            <svg className="recharts-surface" width="10" height="10" viewBox="0 0 32 32" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }}>
              <path stroke="none" fill={entry.color} d="M0,4h32v24h-32z" className="recharts-legend-icon" />
            </svg>
            <span className="recharts-legend-item-text font-mono text-xs" style={{ color: entry.color }}>
              {item.name === 'Others' ? 
                'Others (53.6%)' : 
                `${item.rank}. ${item.shortAddress} (${(item.percentage / 1000).toFixed(1)}%)`}
            </span>
          </li>
        )})}
      </ul>
    );
  };

  return (
    <div className="wealth-distribution-container">
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex justify-between items-center mb-3">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center">
            <FaCoins className="inline-block mr-2 text-yellow-500" />
            BitcoinZ Wealth Distribution
          </h1>
        </div>
        <p className="text-gray-600 mb-4 text-sm">
          Explore the distribution of BitcoinZ across addresses and analyze the top holders.
        </p>
        
        {usingMockData && (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <FaInfoCircle className="h-5 w-5 text-blue-500" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  Note: This visualization currently uses simulated data that represents realistic wealth distribution patterns.
                  Real blockchain data will be used when the API is available.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Sync Status Message */}
        {isInitialSync && syncStatus && (
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <FaInfoCircle className="h-5 w-5 text-yellow-500" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700 font-semibold">
                  Database Sync in Progress
                </p>
                <p className="text-sm text-yellow-600 mt-1">
                  The explorer is currently indexing the blockchain (Synced block {formatNumber(syncStatus.lastSyncedBlock)} of {formatNumber(syncStatus.currentHeight)}).
                  This process takes time during the initial setup. Data accuracy will improve as the sync progresses.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b mb-6">
          <button
            className={`py-2 px-4 font-medium flex items-center ${
              activeTab === 'topHolders' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-blue-500'
            }`}
            onClick={() => setActiveTab('topHolders')}
          >
            <FaListOl className="mr-2" /> Top Holders
          </button>
          <button
            className={`py-2 px-4 font-medium flex items-center ${
              activeTab === 'distribution' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-blue-500'
            }`}
            onClick={() => setActiveTab('distribution')}
          >
            <FaChartPie className="mr-2" /> Distribution by Balance
          </button>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            {activeTab === 'topHolders' && (
              <div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                  {/* Pie Chart - Adjusted size */}
                  <div className="bg-gray-50 p-3 rounded-lg shadow-sm lg:col-span-2">
                    <h3 className="text-md font-semibold mb-2">Top Holders Distribution</h3>
                    <div className="h-96"> {/* Increased height from h-80 to h-96 */}
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={preparePieChartData()}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={120} /* Increased size from 100 to 120 */
                            innerRadius={40} /* Increased inner radius from 30 to 40 */
                            fill="#8884d8"
                            dataKey="value"
                            nameKey="name"
                            paddingAngle={2}
                            label={({ name, percent }) => {
                              // Don't show labels on the pie segments to avoid duplication
                              return null;
                            }}
                            activeIndex={activeIndex}
                            activeShape={(props) => {
                              const RADIAN = Math.PI / 180;
                              const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, value, name, fullAddress, percentage } = props;
                              const sin = Math.sin(-RADIAN * midAngle);
                              const cos = Math.cos(-RADIAN * midAngle);
                              const mx = cx + (outerRadius + 30) * cos;
                              const my = cy + (outerRadius + 30) * sin;
                              
                              return (
                                <g>
                                  <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill}>
                                    {name}
                                  </text>
                                  <Sector
                                    cx={cx}
                                    cy={cy}
                                    innerRadius={innerRadius}
                                    outerRadius={outerRadius + 10}
                                    startAngle={startAngle}
                                    endAngle={endAngle}
                                    fill={fill}
                                  />
                                  <Sector
                                    cx={cx}
                                    cy={cy}
                                    startAngle={startAngle}
                                    endAngle={endAngle}
                                    innerRadius={outerRadius + 10}
                                    outerRadius={outerRadius + 12}
                                    fill={fill}
                                  />
                                </g>
                              );
                            }}
                            onMouseEnter={(data, index) => {
                              setActiveIndex(index);
                            }}
                            onMouseLeave={() => {
                              setActiveIndex(-1);
                            }}
                          >
                            {preparePieChartData().map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={COLORS[index % COLORS.length]} 
                                stroke="#ffffff"
                                strokeWidth={2}
                              />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                          <Legend 
                            content={<CustomLegend />}
                            layout="vertical" 
                            verticalAlign="middle" 
                            align="right"
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  
                  {/* Summary Stats - More compact layout */}
                  <div className="bg-gray-50 p-3 rounded-lg shadow-sm">
                    <h3 className="text-md font-semibold mb-2">Wealth Summary</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 bg-white rounded-md shadow-sm">
                        <p className="text-xs text-gray-500">Current Supply</p>
                        <p className="text-sm font-bold">{formatNumber(totalSupply)} BTCZ</p>
                      </div>
                      <div className="p-2 bg-white rounded-md shadow-sm">
                        <p className="text-xs text-gray-500">Maximum Supply</p>
                        <p className="text-sm font-bold">21,000,000 BTCZ</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {((totalSupply / 21000000) * 100).toFixed(2)}% in circulation
                        </p>
                      </div>
                      <div className="p-2 bg-white rounded-md shadow-sm">
                        <p className="text-xs text-gray-500">Top 10 Holders</p>
                        <p className="text-sm font-bold">
                          {(getTop10Percentage() / 1000).toFixed(2)}%
                        </p>
                      </div>
                      <div className="p-2 bg-white rounded-md shadow-sm">
                        <p className="text-xs text-gray-500">Top 100 Holders</p>
                        <p className="text-sm font-bold">
                          {(getTop100Percentage() / 1000).toFixed(2)}%
                        </p>
                      </div>
                      <div className="p-2 bg-white rounded-md shadow-sm col-span-2">
                        <p className="text-xs text-gray-500">Total Addresses Analyzed</p>
                        <p className="text-sm font-bold">{formatNumber(totalAddresses)}</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Top Holders Table - With search and full addresses */}
                <div className="mb-4">
                  <div className="flex items-center justify-between bg-white rounded-lg shadow-sm p-3">
                    <div className="relative w-full mr-4">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        placeholder="Search by address..."
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm text-gray-600 mr-2">Show:</span>
                      <select 
                        className="py-2 px-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(parseInt(e.target.value));
                          setCurrentPage(1); // Reset to first page when changing page size
                        }}
                      >
                        <option value={15}>15 rows</option>
                        <option value={25}>25 rows</option>
                        <option value={50}>50 rows</option>
                        <option value={100}>100 rows</option>
                        <option value={200}>All</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                <div className="overflow-x-auto bg-white rounded-lg shadow-sm">
                  <table className="w-full table-fixed">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">Rank</th>
                        <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                        <th className="py-2 px-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance (BTCZ)</th>
                        <th className="py-2 px-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">% of Total Supply	</th>
                        <th className="py-2 px-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">% of Top 100</th>
                        <th className="py-2 px-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Txs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {topHolders
                        .filter(holder => 
                          holder.address.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .slice(0, pageSize) // Only show the number of rows specified by pageSize
                        .map((holder, index) => {
                          // Calculate total balance of top 100 holders
                          const top100Balance = topHolders.slice(0, Math.min(100, topHolders.length))
                            .reduce((sum, h) => sum + Number(h.balance || 0), 0);
                          
                          // Calculate percentage of top 100
                          const percentOfTop100 = top100Balance > 0 ? 
                            (Number(holder.balance) / top100Balance) * 100 : 0;
                            
                          return (
                            <tr key={holder.address} className={index % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 hover:bg-blue-50'}>
                              <td className="py-1.5 px-2 text-xs font-medium text-gray-900">{index + 1}</td>
                              <td className="py-1.5 px-2 text-xs">
                                <a 
                                  href={`/address/${holder.address}`}
                                  className="text-blue-600 hover:text-blue-800 font-mono text-xs"
                                  title={holder.address}
                                >
                                  {holder.address}
                                </a>
                              </td>
                              <td className="py-1.5 px-2 text-xs text-gray-900 font-medium text-right">{formatNumber(holder.balance)}</td>
                              <td className="py-1.5 px-2 text-xs text-gray-900 text-right">{percentOfTop100.toFixed(2)}%</td>
                              <td className="py-1.5 px-2 text-xs text-gray-900 text-right">{(Number(holder.percentageOfSupply) / 100).toFixed(2)}%</td>
                              <td className="py-1.5 px-2 text-xs text-gray-900 text-right">{formatNumber(holder.txCount)}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                  
                  {/* Display counter showing how many entries */}
                  <div className="px-4 py-3 bg-gray-50 border-t text-xs text-gray-500">
                    Showing {Math.min(pageSize, topHolders.length)} of {topHolders.length} addresses
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'distribution' && (
              <div>
                {/* Explanatory text */}
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <FaInfoCircle className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-blue-700 font-semibold">
                        What am I looking at?
                      </p>
                      <p className="text-sm text-blue-600 mt-1">
                        This chart shows how BitcoinZ is distributed across different wallet balance ranges. Each bar represents the number of addresses holding a specific range of BTCZ.
                      </p>
                      <p className="text-sm text-blue-600 mt-2">
                        <strong>Key insights:</strong>
                      </p>
                      <ul className="list-disc list-inside text-sm text-blue-600 ml-2">
                        <li>The leftmost bar (0-1 BTCZ) shows addresses with very small balances, often dust amounts</li>
                        <li>Most addresses hold small amounts (under 10 BTCZ)</li>
                        <li>Very few addresses hold large amounts (over 100K BTCZ)</li>
                        <li>The table below shows the exact numbers and percentages for each range</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                {/* Bar Chart */}
                <div className="bg-gray-50 p-4 rounded-lg shadow-sm mb-8">
                  <h3 className="text-lg font-semibold mb-4">Address Distribution by Balance Range</h3>
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={prepareBarChartData()}
                        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="name" 
                          angle={-35} 
                          textAnchor="end" 
                          height={70} 
                          tick={{ fontSize: 12, fontWeight: 500 }}
                          tickMargin={10}
                        />
                        <YAxis 
                          tickFormatter={(value) => {
                            // Format Y-axis values with K for thousands and M for millions
                            if (value >= 1000000) {
                              return `${(value / 1000000).toFixed(1)}M`;
                            } else if (value >= 1000) {
                              return `${(value / 1000).toFixed(0)}K`;
                            }
                            return value;
                          }}
                        />
                        <Tooltip 
                          formatter={(value, name) => [formatNumber(value), name === 'count' ? 'Addresses' : name]}
                          labelFormatter={(label, payload) => {
                            if (payload && payload.length) {
                              return `Balance Range: ${payload[0].payload.originalRange} BTCZ`;
                            }
                            return `Balance Range: ${label}`;
                          }}
                          contentStyle={{ backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '4px', padding: '10px' }}
                        />
                        <Legend />
                        <Bar 
                          name="Number of Addresses" 
                          dataKey="count" 
                          fill="#0088FE" 
                          radius={[4, 4, 0, 0]} 
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                {/* Distribution Table */}
                <div className="overflow-x-auto">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold">Balance Distribution Details</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      This table shows the exact number of addresses in each balance range and what percentage of the total address count they represent.
                    </p>
                  </div>
                  <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">Balance Range (BTCZ)</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">Number of Addresses</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">% of Total Addresses</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {distribution.map((item, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 hover:bg-blue-50'}>
                          <td className="py-3 px-4 text-sm font-medium text-gray-900">{item.range}</td>
                          <td className="py-3 px-4 text-sm text-gray-900">{formatNumber(item.count)}</td>
                          <td className="py-3 px-4 text-sm text-gray-900">
                            {formatLargePercentage((item.count / totalAddresses) * 100)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default WealthDistribution;

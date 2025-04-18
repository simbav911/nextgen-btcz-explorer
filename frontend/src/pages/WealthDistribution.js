import React, { useState, useEffect, useContext } from 'react';
import { FaCoins, FaChartPie, FaListOl, FaInfoCircle } from 'react-icons/fa';
import { ToastContext } from '../contexts/ToastContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

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

// API base URL - use the correct backend port
const API_BASE_URL = 'http://localhost:3001/api';

const WealthDistribution = () => {
  const [topHolders, setTopHolders] = useState([]);
  const [distribution, setDistribution] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('topHolders');
  const [totalSupply, setTotalSupply] = useState(0);
  const [totalAddresses, setTotalAddresses] = useState(0);
  const [usingMockData, setUsingMockData] = useState(false);
  const { showToast } = useContext(ToastContext);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1'];

  useEffect(() => {
    const fetchRealData = async () => {
      try {
        setLoading(true);
        console.log('Attempting to fetch real data from:', `${API_BASE_URL}/wealth/top-holders`);
        
        // Attempt to fetch real data first
        const holdersResponse = await fetch(`${API_BASE_URL}/wealth/top-holders?limit=100`);
        
        if (!holdersResponse.ok) {
          console.error('Holders response not OK:', holdersResponse.status, holdersResponse.statusText);
          throw new Error(`Failed to fetch top holders data: ${holdersResponse.status}`);
        }
        
        const holdersData = await holdersResponse.json();
        console.log('Received holders data:', holdersData);
        
        if (!holdersData || !holdersData.topHolders) {
          console.error('Invalid holders data format:', holdersData);
          throw new Error('Invalid top holders data format');
        }
        
        // Process the data
        setTopHolders(holdersData.topHolders);
        setTotalSupply(holdersData.totalSupply);
        
        // Fetch distribution data
        console.log('Fetching distribution data from:', `${API_BASE_URL}/wealth/distribution`);
        const distributionResponse = await fetch(`${API_BASE_URL}/wealth/distribution`);
        
        if (!distributionResponse.ok) {
          console.error('Distribution response not OK:', distributionResponse.status, distributionResponse.statusText);
          throw new Error(`Failed to fetch distribution data: ${distributionResponse.status}`);
        }
        
        const distributionData = await distributionResponse.json();
        console.log('Received distribution data:', distributionData);
        
        if (!distributionData || !distributionData.distribution) {
          console.error('Invalid distribution data format:', distributionData);
          throw new Error('Invalid distribution data format');
        }
        
        setDistribution(distributionData.distribution);
        setTotalAddresses(distributionData.totalAddresses);
        
        // Successfully loaded real data
        setUsingMockData(false);
        setLoading(false);
        
        console.log('Successfully loaded real blockchain data');
        showToast('Using real blockchain data for wealth distribution', 'success');
      } catch (error) {
        console.error('Error fetching real data:', error);
        // Fall back to mock data
        useMockData();
      }
    };
    
    const useMockData = () => {
      console.log('Using mock data');
      // Use mock data as fallback
      setTopHolders(MOCK_TOP_HOLDERS);
      setDistribution(MOCK_DISTRIBUTION);
      setTotalSupply(MOCK_TOTAL_SUPPLY);
      setTotalAddresses(MOCK_TOTAL_ADDRESSES);
      setUsingMockData(true);
      setLoading(false);
      showToast('Using simulated data for wealth distribution', 'info');
    };
    
    // Start by trying to fetch real data
    fetchRealData();
  }, [showToast]);

  // Format number with commas
  const formatNumber = (num) => {
    return num.toLocaleString(undefined, { maximumFractionDigits: 8 });
  };

  // Format percentage
  const formatPercentage = (percent) => {
    return percent.toFixed(4) + '%';
  };

  // Prepare data for pie chart
  const preparePieChartData = () => {
    // Take top 7 holders and group the rest as "Others"
    const topN = topHolders.slice(0, 7);
    const others = topHolders.slice(7);
    
    const othersSum = others.reduce((sum, holder) => sum + holder.balance, 0);
    const othersPercentage = (othersSum / totalSupply) * 100;
    
    const chartData = [
      ...topN.map(holder => ({
        name: holder.address.substring(0, 6) + '...' + holder.address.substring(holder.address.length - 4),
        value: holder.balance,
        percentage: holder.percentageOfSupply
      })),
      {
        name: 'Others',
        value: othersSum,
        percentage: othersPercentage
      }
    ];
    
    return chartData;
  };

  // Prepare data for bar chart
  const prepareBarChartData = () => {
    return distribution.map(item => ({
      name: item.range + ' BTCZ',
      count: item.count,
      percentage: (item.count / totalAddresses) * 100
    }));
  };

  // Custom tooltip for pie chart
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-md">
          <p className="font-semibold">{payload[0].name}</p>
          <p className="text-sm">Balance: {formatNumber(payload[0].value)} BTCZ</p>
          <p className="text-sm">Percentage: {formatPercentage(payload[0].payload.percentage)}</p>
        </div>
      );
    }
    return null;
  };

  // Force refresh data
  const handleRefreshData = () => {
    setLoading(true);
    // Fetch real data again
    fetch(`${API_BASE_URL}/wealth/top-holders?limit=100`)
      .then(response => {
        if (!response.ok) throw new Error('Failed to fetch top holders');
        return response.json();
      })
      .then(holdersData => {
        setTopHolders(holdersData.topHolders);
        setTotalSupply(holdersData.totalSupply);
        
        return fetch(`${API_BASE_URL}/wealth/distribution`);
      })
      .then(response => {
        if (!response.ok) throw new Error('Failed to fetch distribution');
        return response.json();
      })
      .then(distributionData => {
        setDistribution(distributionData.distribution);
        setTotalAddresses(distributionData.totalAddresses);
        setUsingMockData(false);
        setLoading(false);
        showToast('Data refreshed successfully', 'success');
      })
      .catch(error => {
        console.error('Error refreshing data:', error);
        setLoading(false);
        showToast('Failed to refresh data', 'error');
      });
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-gray-800">
            <FaCoins className="inline-block mr-2 text-yellow-500" />
            BitcoinZ Wealth Distribution
          </h1>
          <button 
            onClick={handleRefreshData}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Data
          </button>
        </div>
        <p className="text-gray-600 mb-6">
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                  {/* Pie Chart */}
                  <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
                    <h3 className="text-lg font-semibold mb-4">Top Holders Distribution</h3>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={preparePieChartData()}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            nameKey="name"
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(2)}%)`}
                          >
                            {preparePieChartData().map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  
                  {/* Summary Stats */}
                  <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
                    <h3 className="text-lg font-semibold mb-4">Wealth Summary</h3>
                    <div className="space-y-4">
                      <div className="p-3 bg-white rounded-md shadow-sm">
                        <p className="text-sm text-gray-500">Total Supply</p>
                        <p className="text-xl font-bold">{formatNumber(totalSupply)} BTCZ</p>
                      </div>
                      <div className="p-3 bg-white rounded-md shadow-sm">
                        <p className="text-sm text-gray-500">Top 10 Holders Control</p>
                        <p className="text-xl font-bold">
                          {formatPercentage(
                            topHolders.slice(0, 10).reduce((sum, h) => sum + h.percentageOfSupply, 0)
                          )}
                        </p>
                      </div>
                      <div className="p-3 bg-white rounded-md shadow-sm">
                        <p className="text-sm text-gray-500">Top 100 Holders Control</p>
                        <p className="text-xl font-bold">
                          {formatPercentage(
                            topHolders.reduce((sum, h) => sum + h.percentageOfSupply, 0)
                          )}
                        </p>
                      </div>
                      <div className="p-3 bg-white rounded-md shadow-sm">
                        <p className="text-sm text-gray-500">Total Addresses Analyzed</p>
                        <p className="text-xl font-bold">{formatNumber(totalAddresses)}</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Top Holders Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white rounded-lg overflow-hidden">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance (BTCZ)</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">% of Supply</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transactions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {topHolders.map((holder, index) => (
                        <tr key={holder.address} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="py-3 px-4 text-sm font-medium text-gray-900">{index + 1}</td>
                          <td className="py-3 px-4 text-sm text-blue-600 hover:text-blue-800">
                            <a href={`/address/${holder.address}`}>
                              {holder.address}
                            </a>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-900">{formatNumber(holder.balance)}</td>
                          <td className="py-3 px-4 text-sm text-gray-900">{formatPercentage(holder.percentageOfSupply)}</td>
                          <td className="py-3 px-4 text-sm text-gray-900">{formatNumber(holder.txCount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {activeTab === 'distribution' && (
              <div>
                {/* Bar Chart */}
                <div className="bg-gray-50 p-4 rounded-lg shadow-sm mb-8">
                  <h3 className="text-lg font-semibold mb-4">Address Distribution by Balance Range</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={prepareBarChartData()}
                        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="name" 
                          angle={-45} 
                          textAnchor="end" 
                          height={60} 
                          tick={{ fontSize: 12 }} 
                        />
                        <YAxis />
                        <Tooltip 
                          formatter={(value, name) => [formatNumber(value), name === 'count' ? 'Addresses' : name]}
                          labelFormatter={(label) => `Balance Range: ${label}`}
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
                  <table className="min-w-full bg-white rounded-lg overflow-hidden">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance Range (BTCZ)</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number of Addresses</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">% of Total Addresses</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {distribution.map((item, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="py-3 px-4 text-sm font-medium text-gray-900">{item.range}</td>
                          <td className="py-3 px-4 text-sm text-gray-900">{formatNumber(item.count)}</td>
                          <td className="py-3 px-4 text-sm text-gray-900">
                            {formatPercentage((item.count / totalAddresses) * 100)}
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

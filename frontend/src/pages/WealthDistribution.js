import React, { useState, useEffect, useContext, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaCoins, FaChartPie, FaListOl, FaInfoCircle, FaShieldAlt } from 'react-icons/fa';
import { ToastContext } from '../contexts/ToastContext';
import { Pie, Bar } from 'react-chartjs-2';
import { Chart, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip as ChartTooltip, Legend as ChartLegend } from 'chart.js';
import './wealthDistribution.css';

// Register Chart.js components
Chart.register(ArcElement, BarElement, CategoryScale, LinearScale, ChartTooltip, ChartLegend);

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
  { range: '1000000 - \u221E', count: 15, min: 1000000, max: Infinity },
];

const MOCK_TOTAL_SUPPLY = 21000000;
const MOCK_TOTAL_ADDRESSES = 272485;
const API_BASE_URL = '/api';

const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042',
  '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1',
  '#a4de6c', '#d0ed57', '#83a6ed'
];

const WealthDistribution = () => {
  const [topHolders, setTopHolders] = useState([]);
  const [distribution, setDistribution] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('topHolders');
  const [totalSupply, setTotalSupply] = useState(0);
  const [totalAddresses, setTotalAddresses] = useState(0);
  const [usingMockData, setUsingMockData] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dataVersion, setDataVersion] = useState(0);
  const [syncStatus, setSyncStatus] = useState(null);
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [shieldedPool, setShieldedPool] = useState(null);
  const { showToast } = useContext(ToastContext);
  const navigate = useNavigate();
  const pieRef = useRef(null);

  useEffect(() => {
    const fetchRealData = async () => {
      try {
        setLoading(true);

        const holdersResponse = await fetch(`${API_BASE_URL}/wealth/top-holders?limit=100`);
        const holdersData = await holdersResponse.json();

        if (holdersData && holdersData.topHolders && holdersData.topHolders.length > 0) {
          setTopHolders(holdersData.topHolders);
          setTotalSupply(holdersData.totalSupply || MOCK_TOTAL_SUPPLY);
          setTotalAddresses(holdersData.totalAddressesAnalyzed || MOCK_TOTAL_ADDRESSES);
          if (holdersData.shieldedPool) {
            setShieldedPool(holdersData.shieldedPool);
          }
        } else {
          setTopHolders(MOCK_TOP_HOLDERS);
          setTotalSupply(MOCK_TOTAL_SUPPLY);
          setTotalAddresses(MOCK_TOTAL_ADDRESSES);
          setUsingMockData(true);
        }

        const distributionResponse = await fetch(`${API_BASE_URL}/wealth/distribution`);
        const distributionData = await distributionResponse.json();

        if (distributionData && distributionData.distribution && distributionData.distribution.length > 0) {
          setDistribution(distributionData.distribution);
          if (!holdersData || !holdersData.totalAddressesAnalyzed) {
            setTotalAddresses(distributionData.totalAddresses || MOCK_TOTAL_ADDRESSES);
          }
          setUsingMockData(false);
        } else {
          setDistribution(MOCK_DISTRIBUTION);
          setUsingMockData(true);
        }

        setLoading(false);

        if (!holdersData?.topHolders || !distributionData?.distribution) {
          showToast('Using partially simulated data for wealth distribution', 'info');
        } else {
          showToast('Using real blockchain data for wealth distribution', 'success');
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setTopHolders(MOCK_TOP_HOLDERS);
        setDistribution(MOCK_DISTRIBUTION);
        setTotalSupply(MOCK_TOTAL_SUPPLY);
        setTotalAddresses(MOCK_TOTAL_ADDRESSES);
        setUsingMockData(true);
        setLoading(false);
        showToast('Using simulated data for wealth distribution', 'info');
      }
    };

    fetchRealData();

    const fetchSyncStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/sync/status`);
        if (response.ok) {
          const status = await response.json();
          setSyncStatus(status);
        }
      } catch (error) {
        console.error('Error fetching sync status:', error);
      }
    };
    fetchSyncStatus();
  }, [showToast, dataVersion]);

  const isInitialSync = syncStatus && syncStatus.currentHeight > 0 &&
    (syncStatus.lastSyncedBlock < 1000 || (syncStatus.currentHeight - syncStatus.lastSyncedBlock > 1000));

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '0';
    return Math.floor(num).toLocaleString();
  };

  const formatLargePercentage = (percent) => {
    if (percent === null || percent === undefined || typeof percent !== 'number') return '0.00%';
    return percent.toFixed(2) + '%';
  };

  const formatAddress = (address) => {
    return `${address.substring(0, 10)}...${address.substring(address.length - 4)}`;
  };

  const getTop10Percentage = () => {
    if (!topHolders.length) return 0;
    return topHolders.slice(0, 10).reduce((sum, h) => sum + Number(h.percentageOfSupply || 0), 0);
  };

  const getTop100Percentage = () => {
    if (!topHolders.length) return 0;
    return topHolders.slice(0, Math.min(100, topHolders.length))
      .reduce((sum, h) => sum + Number(h.percentageOfSupply || 0), 0);
  };

  // Pie chart data (chart.js format)
  const preparePieChartData = () => {
    if (topHolders.length === 0) return { labels: [], datasets: [] };

    const top10 = topHolders.slice(0, 10);
    const othersBalance = topHolders.slice(10).reduce((sum, h) => sum + Number(h.balance || 0), 0);

    const labels = top10.map((h, i) => `Rank ${i + 1}`);
    const data = top10.map(h => Number(h.balance || 0));
    const bgColors = top10.map((_, i) => COLORS[i % COLORS.length]);

    if (othersBalance > 0) {
      labels.push('Others');
      data.push(othersBalance);
      bgColors.push('#cccccc');
    }

    return {
      labels,
      datasets: [{
        data,
        backgroundColor: bgColors,
        borderColor: '#ffffff',
        borderWidth: 2,
        hoverOffset: 10
      }]
    };
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '30%',
    plugins: {
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const idx = ctx.dataIndex;
            const top10 = topHolders.slice(0, 10);
            const holder = top10[idx];
            const value = ctx.parsed;
            if (holder) {
              return [
                `${formatAddress(holder.address)}`,
                `Balance: ${formatNumber(value)} BTCZ`,
                `${Number(holder.percentageOfSupply).toFixed(2)}% of supply`
              ];
            }
            return `Others: ${formatNumber(value)} BTCZ`;
          }
        }
      },
      legend: {
        position: 'right',
        labels: {
          font: { size: 11, family: 'monospace' },
          generateLabels: (chart) => {
            const data = chart.data;
            if (!data.labels.length) return [];
            const top10 = topHolders.slice(0, 10);
            return data.labels.map((label, i) => {
              const holder = top10[i];
              const pct = holder ? Number(holder.percentageOfSupply).toFixed(1) : '';
              const shortAddr = holder ? formatAddress(holder.address) : 'Others';
              return {
                text: holder ? `${i + 1}. ${shortAddr} (${pct}%)` : `Others`,
                fillStyle: data.datasets[0].backgroundColor[i],
                strokeStyle: '#ffffff',
                lineWidth: 1,
                index: i
              };
            });
          }
        },
        onClick: (e, legendItem, legend) => {
          const idx = legendItem.index;
          const top10 = topHolders.slice(0, 10);
          const holder = top10[idx];
          if (holder) {
            navigate(`/address/${holder.address}`);
          }
        }
      }
    }
  };

  // Bar chart data (chart.js format)
  const prepareBarChartData = () => {
    const labels = distribution.map(item => {
      let r = item.range;
      if (r.includes('\u221E')) r = r.replace('\u221E', '+');
      if (r.includes('1000000')) r = r.replace('1000000', '1M');
      else if (r.includes('100000')) r = r.replace('100000', '100K');
      else if (r.includes('10000')) r = r.replace('10000', '10K');
      else if (r.includes('1000')) r = r.replace('1000', '1K');
      return r;
    });

    return {
      labels,
      datasets: [{
        label: 'Number of Addresses',
        data: distribution.map(item => item.count),
        backgroundColor: '#0088FE',
        borderRadius: 4
      }]
    };
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        callbacks: {
          title: (items) => {
            if (items.length && distribution[items[0].dataIndex]) {
              return `Balance Range: ${distribution[items[0].dataIndex].range} BTCZ`;
            }
            return '';
          },
          label: (ctx) => `Addresses: ${formatNumber(ctx.parsed.y)}`
        }
      },
      legend: { display: true }
    },
    scales: {
      x: {
        ticks: { maxRotation: 35, font: { size: 12, weight: 500 } }
      },
      y: {
        ticks: {
          callback: (value) => {
            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
            return value;
          }
        }
      }
    }
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

        {isInitialSync && syncStatus && (
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <FaInfoCircle className="h-5 w-5 text-yellow-500" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700 font-semibold">Database Sync in Progress</p>
                <p className="text-sm text-yellow-600 mt-1">
                  The explorer is currently indexing the blockchain (Synced block {formatNumber(syncStatus.lastSyncedBlock)} of {formatNumber(syncStatus.currentHeight)}).
                  This process takes time during the initial setup. Data accuracy will improve as the sync progresses.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Transparent-only disclaimer */}
        <div className="bg-indigo-50 border-l-4 border-indigo-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <FaInfoCircle className="h-5 w-5 text-indigo-500" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-indigo-700 font-semibold">Transparent Addresses Only</p>
              <p className="text-sm text-indigo-600 mt-1">
                This analysis reflects transparent (t-address) balances only. Shielded (z-address) balances are private
                by design and cannot be attributed to individual addresses.
                {shieldedPool && ` Approximately ${formatNumber(shieldedPool.total)} BTCZ (${((shieldedPool.total / totalSupply) * 100).toFixed(2)}% of circulating supply) is currently held in shielded pools.`}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b mb-6">
          <button
            className={`py-2 px-4 font-medium flex items-center ${
              activeTab === 'topHolders' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-blue-500'
            }`}
            onClick={() => setActiveTab('topHolders')}
          >
            <FaListOl className="mr-2" /> Top Holders
          </button>
          <button
            className={`py-2 px-4 font-medium flex items-center ${
              activeTab === 'distribution' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-blue-500'
            }`}
            onClick={() => setActiveTab('distribution')}
          >
            <FaChartPie className="mr-2" /> Distribution by Balance
          </button>
          <button
            className={`py-2 px-4 font-medium flex items-center ${
              activeTab === 'shieldedPool' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-blue-500'
            }`}
            onClick={() => setActiveTab('shieldedPool')}
          >
            <FaShieldAlt className="mr-2" /> Shielded Pool
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
                  {/* Pie Chart */}
                  <div className="bg-gray-50 p-3 rounded-lg shadow-sm lg:col-span-2">
                    <h3 className="text-md font-semibold mb-2">Top Holders Distribution</h3>
                    <div className="h-96">
                      <Pie ref={pieRef} data={preparePieChartData()} options={pieOptions} />
                    </div>
                  </div>

                  {/* Summary Stats */}
                  <div className="bg-gray-50 p-3 rounded-lg shadow-sm">
                    <h3 className="text-md font-semibold mb-2">Wealth Summary</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 bg-white rounded-md shadow-sm">
                        <p className="text-xs text-gray-500">Current Supply</p>
                        <p className="text-sm font-bold">{formatNumber(totalSupply)} BTCZ</p>
                      </div>
                      <div className="p-2 bg-white rounded-md shadow-sm">
                        <p className="text-xs text-gray-500">Maximum Supply</p>
                        <p className="text-sm font-bold">21,000,000,000 BTCZ</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {((totalSupply / 21000000000) * 100).toFixed(2)}% in circulation
                        </p>
                      </div>
                      <div className="p-2 bg-white rounded-md shadow-sm">
                        <p className="text-xs text-gray-500">Top 10 Holders</p>
                        <p className="text-sm font-bold">{getTop10Percentage().toFixed(2)}%</p>
                      </div>
                      <div className="p-2 bg-white rounded-md shadow-sm">
                        <p className="text-xs text-gray-500">Top 100 Holders</p>
                        <p className="text-sm font-bold">{getTop100Percentage().toFixed(2)}%</p>
                      </div>
                      <div className="p-2 bg-white rounded-md shadow-sm">
                        <p className="text-xs text-gray-500">Total Addresses Analyzed</p>
                        <p className="text-sm font-bold">{formatNumber(totalAddresses)}</p>
                      </div>
                      {shieldedPool && (
                        <div className="p-2 bg-white rounded-md shadow-sm">
                          <p className="text-xs text-gray-500">Shielded Pool</p>
                          <p className="text-sm font-bold">{formatNumber(shieldedPool.total)} BTCZ</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {((shieldedPool.total / totalSupply) * 100).toFixed(2)}% of supply
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Search & page size */}
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
                        onChange={(e) => { setPageSize(parseInt(e.target.value)); setCurrentPage(1); }}
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

                {/* Top Holders Table */}
                <div className="overflow-x-auto bg-white rounded-lg shadow-sm">
                  <table className="w-full table-auto">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">Rank</th>
                        <th className="py-2.5 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                        <th className="py-2.5 px-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-40">Balance</th>
                        <th className="py-2.5 px-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-28 hidden sm:table-cell">% of Supply</th>
                        <th className="py-2.5 px-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-28 hidden md:table-cell">% of Top 100</th>
                        <th className="py-2.5 px-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-20 hidden md:table-cell">Txs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {topHolders
                        .filter(holder => holder.address.toLowerCase().includes(searchTerm.toLowerCase()))
                        .slice(0, pageSize)
                        .map((holder, index) => {
                          const top100Balance = topHolders.slice(0, Math.min(100, topHolders.length))
                            .reduce((sum, h) => sum + Number(h.balance || 0), 0);
                          const percentOfTop100 = top100Balance > 0 ?
                            (Number(holder.balance) / top100Balance) * 100 : 0;

                          return (
                            <tr key={holder.address} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 text-xs sm:text-sm`}>
                              <td className="py-2 px-3 font-medium text-gray-900">{index + 1}</td>
                              <td className="py-2 px-3">
                                <Link
                                  to={`/address/${holder.address}`}
                                  className="text-blue-600 hover:text-blue-800 font-mono"
                                  title={holder.address}
                                >
                                  <span className="hidden sm:inline">{holder.address}</span>
                                  <span className="sm:hidden">{formatAddress(holder.address)}</span>
                                </Link>
                              </td>
                              <td className="py-2 px-3 text-gray-900 font-medium text-right whitespace-nowrap">{formatNumber(holder.balance)} BTCZ</td>
                              <td className="py-2 px-3 text-gray-900 text-right hidden sm:table-cell">{Number(holder.percentageOfSupply).toFixed(2)}%</td>
                              <td className="py-2 px-3 text-gray-900 text-right hidden md:table-cell">{percentOfTop100.toFixed(2)}%</td>
                              <td className="py-2 px-3 text-gray-900 text-right hidden md:table-cell">{formatNumber(holder.txCount)}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                  <div className="px-4 py-3 bg-gray-50 border-t text-xs text-gray-500">
                    Showing {Math.min(pageSize, topHolders.length)} of {topHolders.length} addresses
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'distribution' && (
              <div>
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <FaInfoCircle className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-blue-700 font-semibold">What am I looking at?</p>
                      <p className="text-sm text-blue-600 mt-1">
                        This chart shows how BitcoinZ is distributed across different wallet balance ranges.
                      </p>
                      <ul className="list-disc list-inside text-sm text-blue-600 ml-2 mt-2">
                        <li>The leftmost bar (0-1 BTCZ) shows addresses with very small balances, often dust amounts</li>
                        <li>Most addresses hold small amounts (under 10 BTCZ)</li>
                        <li>Very few addresses hold large amounts (over 100K BTCZ)</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Bar Chart */}
                <div className="bg-gray-50 p-4 rounded-lg shadow-sm mb-8">
                  <h3 className="text-lg font-semibold mb-4">Address Distribution by Balance Range</h3>
                  <div className="h-96">
                    <Bar data={prepareBarChartData()} options={barOptions} />
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

            {activeTab === 'shieldedPool' && (
              <div>
                {shieldedPool ? (
                  <>
                    {/* Pie Chart: Transparent vs Shielded */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                      <div className="bg-gray-50 p-3 rounded-lg shadow-sm lg:col-span-2">
                        <h3 className="text-md font-semibold mb-2">Transparent vs Shielded Supply</h3>
                        <div className="h-96">
                          <Pie
                            data={{
                              labels: ['Transparent', 'Shielded (Sapling)', 'Shielded (Sprout)'],
                              datasets: [{
                                data: [
                                  totalSupply - shieldedPool.total,
                                  shieldedPool.sapling,
                                  shieldedPool.sprout
                                ],
                                backgroundColor: ['#3b82f6', '#8b5cf6', '#a78bfa'],
                                borderColor: '#ffffff',
                                borderWidth: 2,
                                hoverOffset: 10
                              }]
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              cutout: '30%',
                              plugins: {
                                tooltip: {
                                  callbacks: {
                                    label: (ctx) => {
                                      const value = ctx.parsed;
                                      const pct = ((value / totalSupply) * 100).toFixed(2);
                                      return `${formatNumber(value)} BTCZ (${pct}%)`;
                                    }
                                  }
                                },
                                legend: {
                                  position: 'right',
                                  labels: {
                                    font: { size: 12 },
                                    generateLabels: (chart) => {
                                      const data = chart.data;
                                      const values = data.datasets[0].data;
                                      return data.labels.map((label, i) => ({
                                        text: `${label}: ${((values[i] / totalSupply) * 100).toFixed(2)}%`,
                                        fillStyle: data.datasets[0].backgroundColor[i],
                                        strokeStyle: '#ffffff',
                                        lineWidth: 1,
                                        index: i
                                      }));
                                    }
                                  }
                                }
                              }
                            }}
                          />
                        </div>
                      </div>

                      {/* Shielded Pool Stats */}
                      <div className="bg-gray-50 p-3 rounded-lg shadow-sm">
                        <h3 className="text-md font-semibold mb-2">Shielded Pool Summary</h3>
                        <div className="grid grid-cols-1 gap-2">
                          <div className="p-3 bg-white rounded-md shadow-sm">
                            <p className="text-xs text-gray-500">Total Shielded</p>
                            <p className="text-sm font-bold text-purple-700">{formatNumber(shieldedPool.total)} BTCZ</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {((shieldedPool.total / totalSupply) * 100).toFixed(2)}% of circulating supply
                            </p>
                          </div>
                          <div className="p-3 bg-white rounded-md shadow-sm">
                            <p className="text-xs text-gray-500">Sapling Pool</p>
                            <p className="text-sm font-bold">{formatNumber(shieldedPool.sapling)} BTCZ</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {((shieldedPool.sapling / totalSupply) * 100).toFixed(2)}% of supply
                            </p>
                          </div>
                          <div className="p-3 bg-white rounded-md shadow-sm">
                            <p className="text-xs text-gray-500">Sprout Pool (Legacy)</p>
                            <p className="text-sm font-bold">{formatNumber(shieldedPool.sprout)} BTCZ</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {((shieldedPool.sprout / totalSupply) * 100).toFixed(2)}% of supply
                            </p>
                          </div>
                          <div className="p-3 bg-white rounded-md shadow-sm">
                            <p className="text-xs text-gray-500">Transparent Supply</p>
                            <p className="text-sm font-bold text-blue-700">{formatNumber(totalSupply - shieldedPool.total)} BTCZ</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {(((totalSupply - shieldedPool.total) / totalSupply) * 100).toFixed(2)}% of supply
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Explanation */}
                    <div className="bg-purple-50 border-l-4 border-purple-400 p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <FaShieldAlt className="h-5 w-5 text-purple-500" />
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-purple-700 font-semibold">About Shielded Pools</p>
                          <p className="text-sm text-purple-600 mt-1">
                            BitcoinZ supports two types of addresses: transparent (t-addresses) and shielded (z-addresses).
                            Shielded addresses use zero-knowledge proofs to keep transaction amounts and balances private on the blockchain.
                          </p>
                          <ul className="list-disc list-inside text-sm text-purple-600 ml-2 mt-2">
                            <li><strong>Sapling Pool</strong> — The current shielded protocol, offering efficient private transactions with improved performance</li>
                            <li><strong>Sprout Pool (Legacy)</strong> — The original shielded protocol, retained for backward compatibility</li>
                            <li>Individual z-address balances cannot be viewed by design — only the total pool values are publicly known</li>
                            <li>Users can freely move funds between transparent and shielded addresses</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <FaShieldAlt className="mx-auto mb-3 text-gray-300" size={48} />
                    <p className="text-lg font-medium">Shielded pool data is not available</p>
                    <p className="text-sm mt-1">The blockchain node may not support value pool queries.</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default WealthDistribution;

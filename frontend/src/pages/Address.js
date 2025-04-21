import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FaWallet, FaArrowUp, FaArrowDown, FaCopy, FaExchangeAlt, FaHistory, FaCalendarAlt } from 'react-icons/fa';
import { Line } from 'react-chartjs-2';
import { Chart, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import moment from 'moment';

// Register Chart.js components
Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// Components
import Spinner from '../components/Spinner';
import TransactionCard from '../components/TransactionCard';
import Pagination from '../components/Pagination';

// Constants for time ranges
const TIME_RANGES = {
  ALL: 'all',
  MONTH: 'month',
  WEEK: 'week',
  DAY: '24h'
};

// Services
import { addressService } from '../services/api';
import apiInstance from '../services/api';

// Utils
import { formatBTCZ, formatNumber } from '../utils/formatting';

const Address = () => {
  const { address } = useParams();
  
  const [loading, setLoading] = useState(true);
  const [addressInfo, setAddressInfo] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [txsLoading, setTxsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [balanceHistory, setBalanceHistory] = useState([]); 
  const [timeRange, setTimeRange] = useState(TIME_RANGES.ALL);
  const [allTransactions, setAllTransactions] = useState([]);
  
  const txsPerPage = 10;
  
  // Fetch address info
  useEffect(() => {
    const fetchAddressInfo = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch address info from API
        try {
          const response = await addressService.getAddressInfo(address);
          
          if (response.data) {
            setAddressInfo(response.data);
            
            // Calculate total pages based on transaction count
            if (response.data.txCount) {
              setTotalPages(Math.ceil(response.data.txCount / txsPerPage));
            }
            
            // Process transactions and set full transaction list
            if (response.data.transactions && response.data.transactions.length > 0) {
              // Process transactions to ensure they all have proper timestamps and values
              const processedTxs = response.data.transactions.map(tx => {
                // Ensure each transaction has a time and convert from unix timestamp
                if (!tx.time && tx.timestamp) {
                  tx.time = tx.timestamp;
                }
                
                // If transaction is missing a proper value, calculate it
                if (tx.value === undefined || tx.value === null) {
                  let txValue = 0;
                  
                  // Calculate transaction value by examining inputs and outputs
                  if (tx.vout) {
                    for (const output of tx.vout) {
                      if (output.scriptPubKey && 
                          output.scriptPubKey.addresses && 
                          output.scriptPubKey.addresses.includes(address)) {
                        txValue += parseFloat(output.value || 0);
                      }
                    }
                  }
                  
                  // Subtract inputs from this address
                  if (tx.vin) {
                    for (const input of tx.vin) {
                      if (input.address === address || 
                          (input.prevout && 
                           input.prevout.scriptPubKey && 
                           input.prevout.scriptPubKey.addresses && 
                           input.prevout.scriptPubKey.addresses.includes(address))) {
                        txValue -= parseFloat(input.value || input.prevout?.value || 0);
                      }
                    }
                  }
                  
                  tx.value = txValue;
                }
                
                return tx;
              });
              
              // Store all transactions for balance history
              setAllTransactions(processedTxs);
              
              // Sort transactions by time (newest first for display)
              const sortedTxs = [...processedTxs].sort((a, b) => b.time - a.time);
              
              // Only show first page of transactions
              const firstPageTxs = sortedTxs.slice(0, txsPerPage);
              setTransactions(firstPageTxs);
              setTxsLoading(false);
              
              console.log(`Using ${processedTxs.length} transactions to build balance history chart`);
            } else {
              // If no transactions in response, try to fetch them separately
              await fetchAddressTransactions(1);
              
              // Try to get all transactions for chart (more than just first page)
              if (response.data.txCount > txsPerPage) {
                try {
                  console.log(`Fetching all ${response.data.txCount} transactions for chart data...`);
                  const allTxResponse = await addressService.getAddressTransactions(
                    address, 
                    response.data.txCount,
                    0
                  );
                  
                  if (allTxResponse.data && allTxResponse.data.transactions) {
                    // Process all transactions
                    const allProcessedTxs = allTxResponse.data.transactions.map(tx => {
                      if (!tx.time && tx.timestamp) {
                        tx.time = tx.timestamp;
                      }
                      return tx;
                    });
                    
                    setAllTransactions(allProcessedTxs);
                    console.log(`Successfully loaded ${allProcessedTxs.length} transactions for chart data`);
                  }
                } catch (allTxError) {
                  console.error('Error fetching all transactions:', allTxError);
                }
              }
            }
          } else {
            throw new Error('API returned empty data');
          }
        } catch (apiError) {
          console.error('API error or empty data:', apiError);
          setError('Error fetching address data. Please try again later.');
        }
      } catch (error) {
        console.error('Error fetching address info:', error);
        setError('Address not found or not yet indexed');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAddressInfo();
    
    // Reset timeRange when address changes
    setTimeRange(TIME_RANGES.ALL);
  }, [address]);
  
  // Function to create a fallback balance history with just the current balance
  const createFallbackBalanceHistory = (currentBalance) => {
    const history = [];
    const days = 90; // Create 90 days of history to support all time ranges
    
    for (let i = 0; i < days; i++) {
      const date = moment().subtract(days - i - 1, 'days').format('YYYY-MM-DD');
      // Use actual balance only for the last day, zero for historical days
      // This creates a simple chart showing when balance was received
      const balance = i === days - 1 ? currentBalance : 0;
      
      history.push({
        date,
        balance
      });
    }
    
    return history;
  };
  
  // Function to build balance history from transactions
  const buildBalanceHistory = (txs) => {
    if (!txs || txs.length === 0) {
      return [];
    }
    
    // Create a copy and sort by time (oldest first)
    const sortedTxs = [...txs].sort((a, b) => a.time - b.time);
    
    let runningBalance = 0;
    let timelineData = [];
    let seenDates = new Set(); // To track dates we've already processed
    
    // Create a data point for each unique date
    sortedTxs.forEach(tx => {
      // Add transaction value to running balance
      runningBalance += Number(tx.value || 0);
      
      // Create a date key for this transaction
      const txMoment = moment.unix(tx.time);
      const dateKey = txMoment.format('YYYY-MM-DD');
      
      // If we have multiple transactions on the same day, update the balance
      if (seenDates.has(dateKey)) {
        // Find and update the existing entry
        const existingIndex = timelineData.findIndex(item => item.dateKey === dateKey);
        if (existingIndex !== -1) {
          timelineData[existingIndex].balance = Math.max(0, runningBalance);
        }
      } else {
        // Add a new data point
        timelineData.push({
          date: dateKey,
          dateKey: dateKey,
          balance: Math.max(0, runningBalance),
          timestamp: tx.time,
          blockHeight: tx.blockHeight || 0,
          txid: tx.txid
        });
        seenDates.add(dateKey);
      }
    });
    
    // Add today's point if not already there
    const todayKey = moment().format('YYYY-MM-DD');
    if (!seenDates.has(todayKey) && addressInfo && addressInfo.balance !== undefined) {
      timelineData.push({
        date: todayKey,
        dateKey: todayKey,
        balance: addressInfo.balance,
        timestamp: moment().unix(),
        isCurrent: true
      });
    }
    
    return timelineData;
  };
  
  // Function to filter history data based on selected time range
  const getFilteredBalanceHistory = () => {
    // If we don't have all transactions data, rebuild from current transactions
    const historyData = buildBalanceHistory(allTransactions.length > 0 ? allTransactions : transactions);
    
    if (historyData.length === 0) {
      return [];
    }
    
    // Filter based on selected time range
    let filtered = [];
    const now = moment();
    
    switch (timeRange) {
      case TIME_RANGES.MONTH:
        // Last 30 days
        filtered = historyData.filter(item => {
          return moment(item.date).isAfter(moment().subtract(30, 'days').startOf('day'));
        });
        break;
      
      case TIME_RANGES.WEEK:
        // Last 7 days
        filtered = historyData.filter(item => {
          return moment(item.date).isAfter(moment().subtract(7, 'days').startOf('day'));
        });
        break;
      
      case TIME_RANGES.DAY:
        // Last 24 hours
        filtered = historyData.filter(item => {
          return moment(item.date).isAfter(moment().subtract(24, 'hours'));
        });
        break;
      
      case TIME_RANGES.ALL:
      default:
        filtered = [...historyData];
        break;
    }
    
    // If we have no data in the selected range but we have overall history,
    // return the current balance as a single point
    if (filtered.length === 0 && historyData.length > 0) {
      if (addressInfo && addressInfo.balance !== undefined) {
        return [{
          date: moment().format('YYYY-MM-DD'),
          dateKey: moment().format('YYYY-MM-DD'),
          balance: addressInfo.balance,
          timestamp: moment().unix(),
          isCurrent: true
        }];
      }
    }
    
    // For better visualization, ensure we have at least two points:
    // - For empty or small filters, add the starting point
    if (filtered.length === 1) {
      const startDate = timeRange === TIME_RANGES.DAY ? 
        moment().subtract(24, 'hours') : 
        (timeRange === TIME_RANGES.WEEK ? 
          moment().subtract(7, 'days') : 
          moment().subtract(30, 'days'));
          
      filtered.unshift({
        date: startDate.format('YYYY-MM-DD'),
        dateKey: startDate.format('YYYY-MM-DD'),
        balance: 0,
        timestamp: startDate.unix(),
        isStartPoint: true
      });
    }
    
    return filtered;
  };
  
  // Fetch transactions for the current page
  const fetchAddressTransactions = async (page) => {
    try {
      setTxsLoading(true);
      
      const response = await addressService.getAddressTransactions(
        address, 
        txsPerPage, 
        (page - 1) * txsPerPage
      );
      
      if (response.data && response.data.transactions && response.data.transactions.length > 0) {
        // Process transactions to ensure they all have proper values
        const processedTxs = response.data.transactions.map(tx => {
          // Ensure each transaction has a time
          if (!tx.time && tx.timestamp) {
            tx.time = tx.timestamp;
          }
          
          // If transaction is missing a proper value, calculate it
          if (tx.value === undefined || tx.value === null) {
            let txValue = 0;
            
            // Calculate transaction value by examining inputs and outputs
            if (tx.vout) {
              for (const output of tx.vout) {
                if (output.scriptPubKey && 
                    output.scriptPubKey.addresses && 
                    output.scriptPubKey.addresses.includes(address)) {
                  txValue += parseFloat(output.value || 0);
                }
              }
            }
            
            // Subtract inputs from this address
            if (tx.vin) {
              for (const input of tx.vin) {
                if (input.address === address || 
                    (input.prevout && 
                     input.prevout.scriptPubKey && 
                     input.prevout.scriptPubKey.addresses && 
                     input.prevout.scriptPubKey.addresses.includes(address))) {
                  txValue -= parseFloat(input.value || input.prevout?.value || 0);
                }
              }
            }
            
            tx.value = txValue;
          }
          
          return tx;
        });
        
        setTransactions(processedTxs);
      } else {
        console.error('No transaction data available from API');
        setTransactions([]);
      }
      
      setCurrentPage(page);
    } catch (error) {
      console.error('Error fetching address transactions:', error);
      setTransactions([]);
    } finally {
      setTxsLoading(false);
    }
  };
  
  // Handle page change
  const handlePageChange = (page) => {
    fetchAddressTransactions(page);
    // Scroll to transaction list
    document.getElementById('transactions-list')?.scrollIntoView({
      behavior: 'smooth'
    });
  };
  
  // Copy address to clipboard
  const copyToClipboard = () => {
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  
  if (loading) {
    return <Spinner message="Loading address data..." />;
  }
  
  if (error || !addressInfo) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Address Not Found</h2>
          <p className="text-gray-500 mb-6">
            {error || 'The address you are looking for does not exist or has not been indexed yet.'}
          </p>
          <Link to="/" className="btn btn-primary">Back to Home</Link>
        </div>
      </div>
    );
  }
  
  // Get filtered balance history based on transactions
  const filteredHistory = getFilteredBalanceHistory();
  
  // Format labels based on time range
  const formatLabel = (item) => {
    // Use timestamp if available, otherwise parse date string
    const date = item.timestamp ? moment.unix(item.timestamp) : moment(item.date);
    
    switch (timeRange) {
      case '24h':
        return date.format('ha'); // 1am, 2pm etc.
      case 'week':
        return date.format('ddd'); // Mon, Tue etc.
      case 'month':
        return date.format('MMM D'); // Jan 1, Feb 2 etc.
      case 'all':
      default:
        // For all time, use month/year or just month depending on range
        const firstDate = filteredHistory.length > 0 ? 
          (filteredHistory[0].timestamp ? moment.unix(filteredHistory[0].timestamp) : moment(filteredHistory[0].date)) : 
          moment();
        const lastDate = filteredHistory.length > 0 ? 
          (filteredHistory[filteredHistory.length-1].timestamp ? moment.unix(filteredHistory[filteredHistory.length-1].timestamp) : moment(filteredHistory[filteredHistory.length-1].date)) : 
          moment();
        
        // If the range spans more than a year, show month/year
        if (lastDate.diff(firstDate, 'months') > 12) {
          return date.format('MMM YY');
        }
        // If the range spans a few months, show just month name
        else if (lastDate.diff(firstDate, 'days') > 60) {
          return date.format('MMM');
        }
        // Otherwise show month day
        else {
          return date.format('MMM D');
        }
    }
  };
  
  // Create chart data with enhanced visualization based on transactions
  const chartData = {
    labels: filteredHistory.map(item => formatLabel(item)),
    datasets: [
      {
        label: 'Balance',
        data: filteredHistory.map(item => item.balance),
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        tension: 0.2, // Lower tension for more accurate representation
        fill: true,
        pointRadius: timeRange === '24h' ? 1 : (timeRange === 'week' ? 1.5 : 2),
        pointHoverRadius: 5,
        stepped: 'after' // Use stepped line for more accurate balance representation
      }
    ]
  };
  
  // Determine appropriate tick settings based on time range
  const getTickSettings = () => {
    switch (timeRange) {
      case 'month':
        return {
          maxTicksLimit: 10,
          format: 'MMM D'
        };
      case 'week':
        return {
          maxTicksLimit: 7,
          format: 'ddd'
        };
      case '24h':
        return {
          maxTicksLimit: 6,
          format: 'ha'
        };
      case 'all':
      default:
        // For all-time view, adjust tick count based on data span
        const firstDate = filteredHistory.length > 0 ? 
          (filteredHistory[0].timestamp ? moment.unix(filteredHistory[0].timestamp) : moment(filteredHistory[0].date)) : 
          moment();
        const lastDate = filteredHistory.length > 0 ? 
          (filteredHistory[filteredHistory.length-1].timestamp ? moment.unix(filteredHistory[filteredHistory.length-1].timestamp) : moment(filteredHistory[filteredHistory.length-1].date)) : 
          moment();
        
        // Adjust tick count based on date range
        const monthsDiff = lastDate.diff(firstDate, 'months');
        if (monthsDiff > 24) {
          return {
            maxTicksLimit: 12,
            format: 'MMM YY'
          };
        } else if (monthsDiff > 6) {
          return {
            maxTicksLimit: 10,
            format: 'MMM'
          };
        } else {
          return {
            maxTicksLimit: 8,
            format: 'MMM D'
          };
        }
    }
  };
  
  const tickSettings = getTickSettings();
  
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: function(context) {
            return `Balance: ${formatBTCZ(context.raw)}`;
          },
          title: function(tooltipItems) {
            // Format the date in tooltip based on time range
            const item = tooltipItems[0];
            const dataPoint = filteredHistory[item.dataIndex];
            if (!dataPoint) return '';
            
            // Use timestamp if available, otherwise parse date string
            const date = dataPoint.timestamp ? 
              moment.unix(dataPoint.timestamp) : 
              moment(dataPoint.date);
            
            return timeRange === '24h'
              ? date.format('MMM D, h:mm a')
              : date.format('MMM D, YYYY');
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: tickSettings.maxTicksLimit
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(226, 232, 240, 0.5)'
        },
        ticks: {
          callback: function(value) {
            return formatBTCZ(value, true);
          }
        }
      }
    },
    animation: {
      duration: 1000
    },
    // Improves rendering of balance history with steps
    elements: {
      line: {
        tension: 0.1 // Lower tension for more accurate lines
      },
      point: {
        radius: timeRange === 'all' && filteredHistory.length > 30 ? 0 : undefined // Hide points in all-time view if many data points
      }
    }
  };
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Address Header */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <h1 className="page-title mb-4 md:mb-0">
            <FaWallet />
            Address Details
          </h1>
          
          <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-2 w-full md:w-auto">
            <span className="text-gray-500 text-sm mr-2">Address:</span>
            <div className="font-mono text-sm text-gray-800 truncate max-w-xs">
              {address}
            </div>
            <button 
              onClick={copyToClipboard}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              title="Copy address"
            >
              <FaCopy className={copied ? "text-green-500" : "text-gray-500"} />
            </button>
          </div>
        </div>
      </div>
      
      {/* Balance Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-lg p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-100 rounded-bl-full opacity-50"></div>
          <h3 className="text-lg font-semibold text-gray-600 mb-2">Current Balance</h3>
          <div className="text-3xl font-bold text-blue-600">
            {formatBTCZ(addressInfo.balance)}
          </div>
          {addressInfo.unconfirmedBalance > 0 && (
            <div className="text-sm text-gray-500 mt-2">
              + {formatBTCZ(addressInfo.unconfirmedBalance)} unconfirmed
            </div>
          )}
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-green-100 rounded-bl-full opacity-50"></div>
          <h3 className="text-lg font-semibold text-gray-600 mb-2 flex items-center">
            <FaArrowDown className="text-green-500 mr-2" />
            Total Received
          </h3>
          <div className="text-3xl font-bold text-green-600">
            {formatBTCZ(addressInfo.totalReceived)}
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-100 rounded-bl-full opacity-50"></div>
          <h3 className="text-lg font-semibold text-gray-600 mb-2 flex items-center">
            <FaArrowUp className="text-red-500 mr-2" />
            Total Sent
          </h3>
          <div className="text-3xl font-bold text-red-600">
            {formatBTCZ(addressInfo.totalSent)}
          </div>
        </div>
      </div>
      
      {/* Balance History Chart */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center">
            <FaHistory className="text-blue-500 mr-2" />
            Balance History
          </h2>
          
          <div className="flex items-center space-x-2 mt-2 md:mt-0">
            <div className="inline-flex items-center bg-gray-100 rounded-lg p-1">
              <button 
                onClick={() => setTimeRange('all')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  timeRange === 'all' 
                    ? 'bg-blue-500 text-white shadow-sm' 
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button 
                onClick={() => setTimeRange('month')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  timeRange === 'month' 
                    ? 'bg-blue-500 text-white shadow-sm' 
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                Month
              </button>
              <button 
                onClick={() => setTimeRange('week')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  timeRange === 'week' 
                    ? 'bg-blue-500 text-white shadow-sm' 
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                Week
              </button>
              <button 
                onClick={() => setTimeRange('24h')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  timeRange === '24h' 
                    ? 'bg-blue-500 text-white shadow-sm' 
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                24h
              </button>
            </div>
          </div>
        </div>
        
        <div className="h-72">
          {filteredHistory.length > 0 ? (
            <Line data={chartData} options={chartOptions} />
          ) : (
            <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg">
              <div className="text-center">
                <FaHistory className="mx-auto text-gray-300 mb-3" size={30} />
                <p className="text-gray-500">No transaction history available for this time range</p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Transactions */}
      <div id="transactions-list" className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
          <FaExchangeAlt className="text-blue-500 mr-2" />
          Transactions <span className="ml-2 text-gray-500">({formatNumber(addressInfo.txCount)})</span>
        </h2>
        
        {txsLoading ? (
          <Spinner message="Loading transactions..." />
        ) : transactions.length > 0 ? (
          <>
            <div className="space-y-4 mb-6">
              {transactions.map(tx => (
                <div key={tx.txid} className="border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                  <Link to={`/tx/${tx.txid}`} className="block p-4">
                    <div className="flex flex-col md:flex-row justify-between">
                      <div className="flex items-center mb-3 md:mb-0">
                        {/* Transaction type icon */}
                        <div className={`p-3 rounded-full mr-4 ${
                          tx.value >= 0
                            ? 'bg-green-100 text-green-600'
                            : 'bg-red-100 text-red-600'
                        }`}>
                          {tx.value >= 0
                            ? <FaArrowDown size={18} />
                            : <FaArrowUp size={18} />
                          }
                        </div>
                        
                        {/* Transaction details */}
                        <div>
                          <div className="font-mono text-sm text-gray-600 mb-1 truncate">
                            {tx.txid}
                          </div>
                          <div className="text-xs text-gray-500">
                            {moment.unix(tx.time).format('MMM D, YYYY h:mm A')} ({moment.unix(tx.time).fromNow()})
                          </div>
                        </div>
                      </div>
                      
                      {/* Transaction amount */}
                      <div className={`text-right ${
                        tx.value > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        <div className="text-lg font-bold">
                          {tx.value > 0 ? '+' : ''}
                          {formatBTCZ(Math.abs(tx.value || 0))}
                        </div>
                        <div className="text-xs text-gray-500">
                          {tx.confirmations > 0 
                            ? `${tx.confirmations} confirmation${tx.confirmations !== 1 ? 's' : ''}` 
                            : 'Unconfirmed'}
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
            
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <FaWallet className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-500 text-lg">No transactions found for this address</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Address;

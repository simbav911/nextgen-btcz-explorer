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

// Transaction threshold for displaying the balance history chart
const TX_THRESHOLD = 10000;


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
    
    // For very long histories (5+ years), we need to reduce data points to avoid performance issues
    const oldestTx = sortedTxs[0];
    const newestTx = sortedTxs[sortedTxs.length - 1];
    const daysDiff = moment.unix(newestTx.time).diff(moment.unix(oldestTx.time), 'days');
    
    // If we have more than 2 years of data, we'll group by weeks or months
    const groupByMonth = daysDiff > 730; // 2 years
    const groupByWeek = daysDiff > 180 && daysDiff <= 730; // 6 months to 2 years
    
    // Create a data point for each unique date, with smart grouping for long histories
    sortedTxs.forEach(tx => {
      // Add transaction value to running balance
      runningBalance += Number(tx.value || 0);
      
      // Create an appropriate date key based on the history length
      const txMoment = moment.unix(tx.time);
      let dateKey;
      
      if (groupByMonth) {
        // For very long histories, group by month
        dateKey = txMoment.format('YYYY-MM');
      } else if (groupByWeek) {
        // For medium histories, group by week
        // Use the year and week number as key
        dateKey = `${txMoment.format('YYYY')}-W${txMoment.week()}`;
      } else {
        // For shorter histories, use daily points
        dateKey = txMoment.format('YYYY-MM-DD');
      }
      
      // If we have multiple transactions in the same period, update the balance
      if (seenDates.has(dateKey)) {
        // Find and update the existing entry
        const existingIndex = timelineData.findIndex(item => item.dateKey === dateKey);
        if (existingIndex !== -1) {
          timelineData[existingIndex].balance = Math.max(0, runningBalance);
        }
      } else {
        // Add a new data point
        timelineData.push({
          date: groupByMonth ? txMoment.format('YYYY-MM-01') : 
                (groupByWeek ? txMoment.startOf('week').format('YYYY-MM-DD') : 
                 txMoment.format('YYYY-MM-DD')),
          dateKey: dateKey,
          balance: Math.max(0, runningBalance),
          timestamp: tx.time,
          blockHeight: tx.blockHeight || 0,
          txid: tx.txid,
          label: groupByMonth ? txMoment.format('MMM YY') : 
                 (groupByWeek ? txMoment.format('MMM D') : 
                  txMoment.format('MMM D'))
        });
        seenDates.add(dateKey);
      }
    });
    
    // Add today's point if not already there
    const todayMoment = moment();
    const todayKey = groupByMonth ? todayMoment.format('YYYY-MM') : 
                    (groupByWeek ? `${todayMoment.format('YYYY')}-W${todayMoment.week()}` : 
                     todayMoment.format('YYYY-MM-DD'));
                     
    if (!seenDates.has(todayKey) && addressInfo && addressInfo.balance !== undefined) {
      timelineData.push({
        date: groupByMonth ? todayMoment.format('YYYY-MM-01') : 
              (groupByWeek ? todayMoment.startOf('week').format('YYYY-MM-DD') : 
               todayMoment.format('YYYY-MM-DD')),
        dateKey: todayKey,
        balance: addressInfo.balance,
        timestamp: todayMoment.unix(),
        isCurrent: true,
        label: groupByMonth ? todayMoment.format('MMM YY') : 
               (groupByWeek ? todayMoment.format('MMM D') : 
                todayMoment.format('MMM D'))
      });
    }
    
    return timelineData;
  };
  
  // Function to create time-range data points with proper balance progression
  const getTimeRangePoints = () => {
    // Get current wallet balance
    const currentBalance = addressInfo?.balance || 0;
    
    // First sort transactions by time (oldest first)
    const sortedTxs = [...allTransactions].sort((a, b) => a.time - b.time);
    
    // Calculate the balance at each point in time
    const balanceTimeline = [];
    let runningBalance = 0;
    
    // Build full timeline from transactions
    sortedTxs.forEach(tx => {
      runningBalance += Number(tx.value || 0);
      balanceTimeline.push({
        timestamp: tx.time,
        balance: Math.max(0, runningBalance),
        txid: tx.txid
      });
    });
    
    // Now create time points based on the selected range
    if (timeRange === TIME_RANGES.DAY) {
      const points = [];
      const now = moment();
      const dayStart = moment().subtract(24, 'hours');
      
      // Create points for each 2 hours in the last 24 hours
      for (let i = 12; i >= 0; i--) {
        const pointTime = moment().subtract(i * 2, 'hours');
        const pointTimestamp = pointTime.unix();
        
        // Find the last balance before this point
        let balanceAtPoint = 0;
        for (let j = balanceTimeline.length - 1; j >= 0; j--) {
          if (balanceTimeline[j].timestamp <= pointTimestamp) {
            balanceAtPoint = balanceTimeline[j].balance;
            break;
          }
        }
        
        // If no transactions happened yet, the balance is 0
        // If this is the last point, use the current balance
        if (i === 0) {
          balanceAtPoint = currentBalance;
        }
        
        points.push({
          date: pointTime.format('YYYY-MM-DD HH:00:00'),
          dateKey: pointTime.format('YYYY-MM-DD HH:00:00'),
          label: pointTime.format('ha'), // e.g. 2pm
          balance: balanceAtPoint,
          timestamp: pointTimestamp,
          isGeneratedPoint: true
        });
      }
      
      return points;
    } 
    else if (timeRange === TIME_RANGES.WEEK) {
      const points = [];
      
      // Create a point for each day in the last week
      for (let i = 6; i >= 0; i--) {
        const pointTime = moment().subtract(i, 'days');
        const pointTimestamp = pointTime.unix();
        
        // Find the last balance before this point
        let balanceAtPoint = 0;
        for (let j = balanceTimeline.length - 1; j >= 0; j--) {
          if (balanceTimeline[j].timestamp <= pointTimestamp) {
            balanceAtPoint = balanceTimeline[j].balance;
            break;
          }
        }
        
        // If no transactions happened yet, the balance is 0
        // If this is the last point, use the current balance
        if (i === 0) {
          balanceAtPoint = currentBalance;
        }
        
        points.push({
          date: pointTime.format('YYYY-MM-DD'),
          dateKey: pointTime.format('YYYY-MM-DD'),
          label: pointTime.format('ddd'), // e.g. Mon
          balance: balanceAtPoint,
          timestamp: pointTimestamp,
          isGeneratedPoint: true
        });
      }
      
      return points;
    }
    else if (timeRange === TIME_RANGES.MONTH) {
      const points = [];
      
      // Create points at 6-day intervals for the month
      for (let i = 5; i >= 0; i--) {
        const pointTime = moment().subtract(i * 6, 'days');
        const pointTimestamp = pointTime.unix();
        
        // Find the last balance before this point
        let balanceAtPoint = 0;
        for (let j = balanceTimeline.length - 1; j >= 0; j--) {
          if (balanceTimeline[j].timestamp <= pointTimestamp) {
            balanceAtPoint = balanceTimeline[j].balance;
            break;
          }
        }
        
        // If no transactions happened yet, the balance is 0
        // If this is the last point, use the current balance
        if (i === 0) {
          balanceAtPoint = currentBalance;
        }
        
        points.push({
          date: pointTime.format('YYYY-MM-DD'),
          dateKey: pointTime.format('YYYY-MM-DD'),
          label: pointTime.format('MMM D'), // e.g. Jan 15
          balance: balanceAtPoint,
          timestamp: pointTimestamp,
          isGeneratedPoint: true
        });
      }
      
      return points;
    }
    
    // For ALL time range, return an empty array since we'll handle it differently
    return [];
  };

  // Function to get balance history based on selected time range
  const getFilteredBalanceHistory = () => {
    // If we have no transactions at all, return a simple point with current balance
    if (allTransactions.length === 0 && transactions.length === 0) {
      return [{
        date: moment().format('YYYY-MM-DD'),
        dateKey: moment().format('YYYY-MM-DD'),
        balance: addressInfo?.balance || 0,
        timestamp: moment().unix(),
        isCurrent: true
      }];
    }
    
    // If we're looking at 24h, week, or month range, use our time range points
    if (timeRange === TIME_RANGES.DAY || 
        timeRange === TIME_RANGES.WEEK || 
        timeRange === TIME_RANGES.MONTH) {
      return getTimeRangePoints();
    }
    
    // For ALL time range, use complete transaction history
    const historyData = buildBalanceHistory(allTransactions.length > 0 ? allTransactions : transactions);
    
    if (historyData.length === 0) {
      // If building history failed, return current balance as single point
      return [{
        date: moment().format('YYYY-MM-DD'),
        dateKey: moment().format('YYYY-MM-DD'),
        balance: addressInfo?.balance || 0,
        timestamp: moment().unix(),
        isCurrent: true
      }];
    }
    
    return historyData;
  };
  
  // Fetch transactions for the current page with retry logic
  const fetchAddressTransactions = async (page, retryCount = 0) => {
    try {
      setTxsLoading(true);
      
      // Show a special message for addresses with large transaction counts
      if (addressInfo && addressInfo.txCount > 1000) {
        console.log(`Fetching page ${page} of transactions for large address (${addressInfo.txCount} transactions total)`);
      }
      
      const response = await addressService.getAddressTransactions(
        address, 
        txsPerPage, 
        (page - 1) * txsPerPage
      );
      
      if (response.data && response.data.transactions) {
        // Process transactions
        const processedTxs = response.data.transactions.map(tx => {
          // Ensure each transaction has a time
          if (!tx.time && tx.timestamp) {
            tx.time = tx.timestamp;
          } else if (!tx.time) {
            // If still no time, use a reasonable default
            tx.time = Math.floor(Date.now() / 1000) - (tx.confirmations || 0) * 600; // ~10 min per block
          }
          
          // Ensure transaction has a value
          if (tx.value === undefined || tx.value === null) {
            tx.value = 0;
          }
          
          return tx;
        });
        
        // Sort transactions by time (newest first)
        const sortedTxs = processedTxs.sort((a, b) => b.time - a.time);
        
        setTransactions(sortedTxs);
        
        // Update total pages if count is provided
        if (response.data.count) {
          const newTotalPages = Math.ceil(response.data.count / txsPerPage);
          if (newTotalPages !== totalPages) {
            setTotalPages(newTotalPages);
          }
        }
      } else {
        console.warn('No transaction data available from API');
        
        // If we got a response but no transactions, use empty array
        setTransactions([]);
      }
      
      setCurrentPage(page);
    } catch (error) {
      console.error('Error fetching address transactions:', error);
      
      // Retry logic for transient errors
      if (retryCount < 2) {
        console.log(`Retrying transaction fetch (attempt ${retryCount + 1})...`);
        setTimeout(() => fetchAddressTransactions(page, retryCount + 1), 2000);
        return;
      }
      
      // If all retries failed, show error
      setTransactions([]);
    } finally {
      setTxsLoading(false);
    }
  };
  
  // Handle page change
  const handlePageChange = (page) => {
    // Show loading indicator for transactions
    setTxsLoading(true);
    
    // Fetch the new page of transactions
    fetchAddressTransactions(page);
    
    // Scroll to transaction list
    document.getElementById('transactions-list')?.scrollIntoView({
      behavior: 'smooth'
    });
    
    // For large transaction counts, we want to avoid re-fetching balance history
    // when changing transaction pages
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
          <div className="flex justify-center space-x-4">
            <Link to="/" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
              Back to Home
            </Link>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Get filtered balance history based on transactions
  const filteredHistory = getFilteredBalanceHistory();
  
  // Format labels based on time range
  const formatLabel = (item) => {
    // If the item has a pre-formatted label, use it
    if (item.label) {
      return item.label;
    }
    
    // Use timestamp if available, otherwise parse date string
    const date = item.timestamp ? moment.unix(item.timestamp) : moment(item.date);
    
    switch (timeRange) {
      case TIME_RANGES.DAY:
        // For 24h view, show hour with am/pm
        return date.format('ha'); // 1am, 2pm etc.
      
      case TIME_RANGES.WEEK:
        // For week view, show day of week
        return date.format('ddd'); // Mon, Tue etc.
      
      case TIME_RANGES.MONTH:
        // For month view, show month and day
        return date.format('MMM D'); // Jan 1, Feb 2 etc.
      
      case TIME_RANGES.ALL:
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
        tension: timeRange === TIME_RANGES.DAY ? 0 : 0.2, // Straight lines for 24h
        fill: true,
        pointRadius: (timeRange === TIME_RANGES.DAY) ? 3 : 
                     (timeRange === TIME_RANGES.WEEK) ? 3 : 
                     (timeRange === TIME_RANGES.MONTH) ? 3 : 2,
        pointHoverRadius: 5,
        stepped: timeRange === TIME_RANGES.DAY || timeRange === TIME_RANGES.WEEK ? 'after' : false // Stepped line for shorter time frames
      }
    ]
  };
  
  // Determine appropriate tick settings based on time range
  const getTickSettings = () => {
    switch (timeRange) {
      case TIME_RANGES.MONTH:
        return {
          maxTicksLimit: 10,
          format: 'MMM D'
        };
      case TIME_RANGES.WEEK:
        return {
          maxTicksLimit: 7,
          format: 'ddd'
        };
      case TIME_RANGES.DAY:
        return {
          maxTicksLimit: 12,
          format: 'ha'
        };
      case TIME_RANGES.ALL:
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
          title: function(tooltipItems) {
            if (tooltipItems.length > 0) {
              const itemIndex = tooltipItems[0].dataIndex;
              const historyData = getFilteredBalanceHistory(); // Use the function to get current data
              if (itemIndex < historyData.length) {
                const item = historyData[itemIndex];
                // Use the timestamp for precise date/time in tooltip title
                return moment.unix(item.timestamp).format('YYYY-MM-DD HH:mm:ss');
              }
            }
            return 'Date'; // Fallback title
          },
          label: function(context) {
            let label = 'Balance'; // Default label
            if (context.parsed.y !== null) {
              label += `: ${context.parsed.y.toLocaleString()} BTCZ`;
            }
            
            const itemIndex = context.dataIndex;
            const historyData = getFilteredBalanceHistory(); // Use the function to get current data
            if (itemIndex < historyData.length) {
              const item = historyData[itemIndex];
              // Add aggregation info if available (e.g., "Daily", "Weekly", "Monthly")
              // The label from getFilteredBalanceHistory already provides context,
              // so just showing the balance is sufficient for this simple fix.
            }
            
            return label;
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
          maxTicksLimit: 10, // Allow more ticks for better date representation
          callback: function(val, index) {
            const item = filteredHistory[val]; // Use filteredHistory as the source
            if (item && item.label) {
              return item.label; // Use the pre-formatted label from the data
            }
            // Fallback to default if no label is available
            return this.getLabelForValue(val);
          }
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
        },
        // For 24h and week views with no balance, adjust max so we don't show a completely flat line at 0
        suggestedMax: timeRange === TIME_RANGES.DAY || timeRange === TIME_RANGES.WEEK ? 
                      (filteredHistory.every(item => item.balance === 0) ? 1 : undefined) : 
                      undefined
      }
    },
    animation: {
      duration: 1000
    },
    // Improves rendering of balance history with steps
    elements: {
      line: {
        tension: timeRange === TIME_RANGES.DAY ? 0 : 0.1 // Straight lines for 24h, slight curve for others
      },
      point: {
        radius: 3, // Show points for all views
        hoverRadius: 6
      }
    },
    // Only use stepped charts for All view
    stepped: timeRange === TIME_RANGES.ALL ? 'after' : false
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
                onClick={() => setTimeRange(TIME_RANGES.ALL)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  timeRange === TIME_RANGES.ALL 
                    ? 'bg-blue-500 text-white shadow-sm' 
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button 
                onClick={() => setTimeRange(TIME_RANGES.MONTH)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  timeRange === TIME_RANGES.MONTH 
                    ? 'bg-blue-500 text-white shadow-sm' 
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                Month
              </button>
              <button 
                onClick={() => setTimeRange(TIME_RANGES.WEEK)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  timeRange === TIME_RANGES.WEEK 
                    ? 'bg-blue-500 text-white shadow-sm' 
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                Week
              </button>
              <button 
                onClick={() => setTimeRange(TIME_RANGES.DAY)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  timeRange === TIME_RANGES.DAY 
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
          {addressInfo && addressInfo.txCount > TX_THRESHOLD ? (
            <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg">
              <div className="text-center">
                <p className="text-gray-500">Balance history chart is not available for addresses with over {TX_THRESHOLD.toLocaleString()} transactions.</p>
              </div>
            </div>
          ) : filteredHistory.length > 0 ? (
            <Line data={chartData} options={chartOptions} />
          ) : (
            <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg">
              <div className="text-center">
                <FaHistory className="mx-auto text-gray-300 mb-3" size={30} />
                <p className="text-gray-500">
                  {timeRange === TIME_RANGES.DAY ?
                    'No transactions in the last 24 hours' :
                    timeRange === TIME_RANGES.WEEK ?
                      'No transactions in the last 7 days' :
                      timeRange === TIME_RANGES.MONTH ?
                        'No transactions in the last 30 days' :
                        'No transaction history available'
                  }
                </p>
                {timeRange !== TIME_RANGES.ALL && (
                  <button
                    onClick={() => setTimeRange(TIME_RANGES.ALL)}
                    className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 transition-colors"
                  >
                    View All History
                  </button>
                )}
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

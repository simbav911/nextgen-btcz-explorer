import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FaWallet, FaArrowUp, FaArrowDown, FaCopy, FaExchangeAlt, FaHistory } from 'react-icons/fa';
import { Line } from 'react-chartjs-2';
import { Chart, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import moment from 'moment';

// Register Chart.js components
Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// Components
import Spinner from '../components/Spinner';
import TransactionCard from '../components/TransactionCard';
import Pagination from '../components/Pagination';

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
            
            // If transactions are included in the response, use them
            if (response.data.transactions && response.data.transactions.length > 0) {
              setTransactions(response.data.transactions);
              setTxsLoading(false);
            } else {
              // Otherwise fetch transactions separately
              await fetchAddressTransactions(1);
            }
            
            // Fetch balance history
            try {
              const historyResponse = await apiInstance.get(`/addresses/${address}/history`);
              if (historyResponse.data && historyResponse.data.history && historyResponse.data.history.length > 0) {
                setBalanceHistory(historyResponse.data.history);
              } else {
                console.log('No balance history data available from API');
                // Use fallback balance history
                setBalanceHistory(createFallbackBalanceHistory(response.data.balance));
              }
            } catch (historyError) {
              console.error('Error fetching balance history:', historyError);
              // Use fallback balance history
              setBalanceHistory(createFallbackBalanceHistory(response.data.balance));
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
  }, [address]);
  
  // Function to create a fallback balance history with just the current balance
  const createFallbackBalanceHistory = (currentBalance) => {
    const history = [];
    const days = 30;
    
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
        setTransactions(response.data.transactions);
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
    document.getElementById('transactions-list').scrollIntoView({
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
  
  // Prepare chart data
  const chartData = {
    labels: balanceHistory.map(item => moment(item.date).format('MMM D')),
    datasets: [
      {
        label: 'Balance',
        data: balanceHistory.map(item => item.balance),
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        tension: 0.4,
        fill: true,
        pointRadius: 2,
        pointHoverRadius: 5
      }
    ]
  };
  
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
          maxTicksLimit: 8
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
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
          <FaHistory className="text-blue-500 mr-2" />
          Balance History
        </h2>
        <div className="h-72">
          <Line data={chartData} options={chartOptions} />
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

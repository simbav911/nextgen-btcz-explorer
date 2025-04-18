import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { FaExchangeAlt, FaClock, FaCheck, FaCoins, FaArrowRight } from 'react-icons/fa';

// Components
import Spinner from '../components/Spinner';
import Pagination from '../components/Pagination';

// Contexts
import { SocketContext } from '../contexts/SocketContext';
import { ToastContext } from '../contexts/ToastContext';

// Services
import { transactionService } from '../services/api';

// Utils
import { 
  formatTimestamp, 
  formatRelativeTime, 
  formatBTCZ, 
  formatConfirmations, 
  formatHash, 
  formatNumber 
} from '../utils/formatting';

const TRANSACTIONS_PER_PAGE = 25;

const TransactionList = () => {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTxs, setTotalTxs] = useState(0);
  
  const socket = useContext(SocketContext);
  const { showToast } = useContext(ToastContext);
  
  // Calculate total pages - this is approximate as we don't know total tx count
  const totalPages = Math.max(1, Math.ceil(totalTxs / TRANSACTIONS_PER_PAGE));
  
  // Fetch transactions for the current page
  const fetchTransactions = async (page) => {
    try {
      setLoading(true);
      
      const offset = (page - 1) * TRANSACTIONS_PER_PAGE;
      const response = await transactionService.getLatestTransactions(TRANSACTIONS_PER_PAGE, offset);
      
      setTransactions(response.data.transactions);
      
      // If it's the first page, make an estimate of total transactions
      // In a real app, this would come from the API
      if (page === 1) {
        // This is just an estimate for demo purposes
        setTotalTxs(Math.max(response.data.transactions.length * 10, 100));
      }
      
      setCurrentPage(page);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      showToast('Failed to fetch transactions', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Initial fetch
  useEffect(() => {
    fetchTransactions(1);
  }, []);
  
  // Listen for new transactions
  useEffect(() => {
    if (!socket) return;
    
    socket.on('new_transactions', (newTransactions) => {
      // Only update if we're on the first page
      if (currentPage === 1) {
        setTransactions(prevTxs => {
          // Combine new and previous transactions
          const combined = [...newTransactions, ...prevTxs];
          // Use a Map to deduplicate based on txid
          const uniqueTxsMap = new Map(combined.map(tx => [tx.txid, tx]));
          // Convert back to an array and slice
          const uniqueTxsArray = Array.from(uniqueTxsMap.values());
          return uniqueTxsArray.slice(0, TRANSACTIONS_PER_PAGE);
        });
      }
    });
    
    return () => {
      socket.off('new_transactions');
    };
  }, [socket, currentPage]);
  
  // Handle page change
  const handlePageChange = (page) => {
    fetchTransactions(page);
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold flex items-center">
          <FaExchangeAlt className="text-bitcoinz-600 mr-3" />
          Transactions
        </h1>
      </div>
      
      {loading && transactions.length === 0 ? (
        <Spinner message="Loading transactions..." />
      ) : (
        <>
          <div className="space-y-4 mb-6">
            {transactions.map(tx => {
              const isCoinbase = tx.vin && tx.vin.length > 0 && !!tx.vin[0].coinbase;
              return (
                <div
                  key={tx.txid}
                  className={`relative rounded-xl overflow-hidden shadow-md transition-shadow duration-200 border border-gray-100 hover:shadow-xl ${
                    isCoinbase
                      ? 'bg-gradient-to-br from-yellow-50 via-yellow-100 to-white'
                      : 'bg-gradient-to-br from-blue-50 via-white to-blue-100'
                  }`}
                  style={{
                    borderLeft: isCoinbase ? '6px solid #facc15' : '6px solid #38bdf8',
                    boxShadow: '0 2px 8px 0 rgba(56, 189, 248, 0.07)'
                  }}
                >
                  <Link to={`/tx/${tx.txid}`} className="block">
                    <div className="p-4">
                      <div className="flex flex-col md:flex-row justify-between">
                        {/* Left side - Transaction info */}
                        <div className="flex items-start space-x-3 mb-3 md:mb-0 md:w-2/5">
                          <div className={`${isCoinbase ? 'bg-yellow-200' : 'bg-blue-200'} p-2 rounded-full flex-shrink-0 mt-1 shadow-sm`}>
                            {isCoinbase ? 
                              <FaCoins className="text-yellow-600" size={16} /> : 
                              <FaExchangeAlt className="text-blue-600" size={16} />
                            }
                          </div>
                          <div>
                            <h3 className="text-base font-semibold flex items-center">
                              {isCoinbase ? 'Coinbase Transaction' : 'Transaction'}
                              <span className={`ml-2 text-xs py-0.5 px-2 rounded-full font-semibold ${isCoinbase ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>{tx.confirmations > 0 ? `${tx.confirmations} Confirms` : 'Unconfirmed'}</span>
                            </h3>
                            <div className="text-xs text-gray-500 mt-1">
                              <div className="flex items-center">
                                <FaClock className="mr-1" size={10} />
                                {formatRelativeTime(tx.time)}
                              </div>
                              <div className="font-mono mt-1 overflow-hidden text-overflow-ellipsis">
                                <span className="text-gray-600">ID:</span> {formatHash(tx.txid, 15)}
                              </div>
                            </div>
                          </div>
                        </div>
                        {/* Middle - Transaction details */}
                        <div className="md:w-2/5 mb-3 md:mb-0">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-xs text-gray-500 font-medium">Block</p>
                              <p className="text-sm">
                                {tx.blockhash ? (
                                  <Link 
                                    to={`/blocks/${tx.blockhash}`} 
                                    className="text-blue-600 hover:underline" 
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {tx.height || formatHash(tx.blockhash, 8)}
                                  </Link>
                                ) : (
                                  <span className="text-orange-500">Pending</span>
                                )}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 font-medium">Size</p>
                              <p className="text-sm">{tx.size ? `${formatNumber(tx.size)} bytes` : 'Unknown'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 font-medium">Inputs</p>
                              <p className="text-sm">{tx.vin ? tx.vin.length : 0}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 font-medium">Outputs</p>
                              <p className="text-sm">{tx.vout ? tx.vout.length : 0}</p>
                            </div>
                          </div>
                        </div>
                        {/* Right side - Value and fee */}
                        <div className="md:w-1/5 text-right">
                          <div>
                            <p className="text-xs text-gray-500 font-medium">Total Value</p>
                            <p className="text-base font-semibold text-green-600">
                              {tx.vout ? formatBTCZ(tx.vout.reduce((sum, output) => sum + (output.value || 0), 0)) : '0.00 BTCZ'}
                            </p>
                          </div>
                          {!isCoinbase && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-500 font-medium">Fee</p>
                              <p className="text-sm text-gray-700">
                                {tx.fee !== undefined ? formatBTCZ(tx.fee) : '0.00 BTCZ'}
                              </p>
                            </div>
                          )}
                          {isCoinbase && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-500 font-medium">Reward</p>
                              <p className="text-sm text-yellow-600 font-medium">
                                {tx.vout ? formatBTCZ(tx.vout.reduce((sum, output) => sum + (output.value || 0), 0)) : '0.00 BTCZ'}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Transaction preview - first input and output */}
                      <div className="mt-3 pt-3 border-t border-gray-100 text-xs">
                        <div className="flex flex-col md:flex-row justify-between">
                          <div className="md:w-2/5 mb-2 md:mb-0">
                            <p className="text-gray-500 font-medium mb-1">From</p>
                            {isCoinbase ? (
                              <div className="text-yellow-600 font-medium flex items-center">
                                <FaCoins className="mr-1" size={12} /> Newly Generated Coins
                              </div>
                            ) : !tx.vin || tx.vin.length === 0 ? (
                              <div className="text-gray-400">No inputs</div>
                            ) : tx.vin[0].address ? (
                              <div className="font-mono overflow-hidden text-overflow-ellipsis">
                                {tx.vin[0].address}
                                {tx.vin.length > 1 && <span className="text-gray-500 ml-1">+{tx.vin.length - 1} more</span>}
                              </div>
                            ) : (
                              <div className="text-gray-400">No inputs</div>
                            )}
                          </div>
                          <div className="md:w-1/5 flex justify-center mb-2 md:mb-0">
                            <div className="bg-blue-100 rounded-full p-1">
                              <FaArrowRight className="text-blue-600" size={14} />
                            </div>
                          </div>
                          <div className="md:w-2/5">
                            <p className="text-gray-500 font-medium mb-1">To</p>
                            {tx.vout && tx.vout.length > 0 ? (
                              <div className="font-mono overflow-hidden text-overflow-ellipsis">
                                {tx.vout[0].scriptPubKey && tx.vout[0].scriptPubKey.addresses 
                                  ? tx.vout[0].scriptPubKey.addresses[0] 
                                  : 'Unknown Address'}
                                {tx.vout.length > 1 && <span className="text-gray-500 ml-1">+{tx.vout.length - 1} more</span>}
                              </div>
                            ) : (
                              <div className="text-gray-400">No outputs</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </>
      )}
    </div>
  );
};

export default TransactionList;

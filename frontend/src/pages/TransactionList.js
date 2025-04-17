import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { FaExchangeAlt, FaClock, FaCheck } from 'react-icons/fa';

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
  formatHash 
} from '../utils/formatting';

const TRANSACTIONS_PER_PAGE = 15;

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
          // Add new transactions to beginning and remove extras
          const combined = [...newTransactions, ...prevTxs];
          return combined.slice(0, TRANSACTIONS_PER_PAGE);
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold flex items-center">
          <FaExchangeAlt className="text-bitcoinz-600 mr-3" />
          Transactions
        </h1>
      </div>
      
      {loading ? (
        <Spinner message="Loading transactions..." />
      ) : (
        <>
          {/* Transaction List */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table">
                <thead className="bg-gray-50">
                  <tr>
                    <th>Txid</th>
                    <th>Timestamp</th>
                    <th>Block</th>
                    <th>Value</th>
                    <th>Confirmations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {transactions.map(tx => {
                    const confirmationInfo = formatConfirmations(tx.confirmations || 0);
                    
                    return (
                      <tr key={tx.txid} className="hover:bg-gray-50">
                        <td className="font-mono">
                          <Link to={`/tx/${tx.txid}`} className="text-bitcoinz-600 hover:underline">
                            {formatHash(tx.txid, 10)}
                          </Link>
                        </td>
                        <td>
                          <div className="flex items-center text-sm text-gray-500">
                            <FaClock className="mr-1" />
                            <span title={tx.time ? formatTimestamp(tx.time) : 'Pending'}>
                              {tx.time ? formatRelativeTime(tx.time) : 'Pending'}
                            </span>
                          </div>
                        </td>
                        <td>
                          {tx.blockhash ? (
                            <Link to={`/blocks/${tx.blockhash}`} className="text-bitcoinz-600 hover:underline">
                              {formatHash(tx.blockhash, 8)}
                            </Link>
                          ) : (
                            <span className="text-gray-500">Mempool</span>
                          )}
                        </td>
                        <td>
                          {/* Calculate total output value */}
                          {tx.vout ? formatBTCZ(tx.vout.reduce((sum, output) => sum + (output.value || 0), 0)) : 'Unknown'}
                        </td>
                        <td>
                          <span className={`badge ${confirmationInfo.class}`}>
                            <FaCheck className="mr-1" />
                            {confirmationInfo.text}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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

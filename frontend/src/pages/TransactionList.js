import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { FaExchangeAlt, FaClock, FaCheck, FaCoins, FaArrowRight } from 'react-icons/fa';

// Components
import Spinner from '../components/Spinner';

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

const TransactionList = () => {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  
  const socket = useContext(SocketContext);
  const { showToast } = useContext(ToastContext);
  
  // Fetch latest transactions
  const fetchTransactions = async () => {
    try {
      setLoading(true);
      
      // Get the latest transactions from the API
      const response = await transactionService.getLatestTransactions(25, 0);
      setTransactions(response.data.transactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      showToast('Failed to fetch transactions', 'error');
      
      // Generate mock transactions for demo purposes
      const mockTransactions = generateMockTransactions(25);
      setTransactions(mockTransactions);
    } finally {
      setLoading(false);
    }
  };
  
  // Initial fetch
  useEffect(() => {
    fetchTransactions();
  }, []);
  
  // Listen for new transactions
  useEffect(() => {
    if (!socket) return;
    
    socket.on('new_transactions', (newTransactions) => {
      setTransactions(prevTxs => {
        // Combine new and previous transactions
        const combined = [...newTransactions, ...prevTxs];
        // Use a Map to deduplicate based on txid
        const txMap = new Map();
        combined.forEach(tx => {
          if (!txMap.has(tx.txid)) {
            txMap.set(tx.txid, tx);
          }
        });
        // Convert back to array and limit to 25 transactions
        return Array.from(txMap.values()).slice(0, 25);
      });
    });
    
    return () => {
      socket.off('new_transactions');
    };
  }, [socket]);
  
  // --- Improved Transaction type classifier ---
  function classifyTxType(tx) {
    const isCoinbase = tx.vin && tx.vin.length > 0 && !!tx.vin[0].coinbase;
    if (isCoinbase) return 'coinbase';

    // Shielded fields
    const hasValueBalance = typeof tx.valueBalance === 'number' && tx.valueBalance !== 0;
    const hasVJoinSplit = tx.vjoinsplit && tx.vjoinsplit.length > 0;
    const hasShieldedSpends = tx.vShieldedSpend && tx.vShieldedSpend.length > 0;
    const hasShieldedOutputs = tx.vShieldedOutput && tx.vShieldedOutput.length > 0;

    // Transparent fields
    const hasTransparentInputs = tx.vin && tx.vin.some(v => v.address);
    const hasTransparentOutputs = tx.vout && tx.vout.some(v => v.scriptPubKey && v.scriptPubKey.addresses);

    // t->z: Shielding (transparent input, shielded output, valueBalance<0)
    if ((hasTransparentInputs || tx.vin?.length > 0) && (hasValueBalance && tx.valueBalance < 0 || hasShieldedOutputs || hasVJoinSplit) && !hasShieldedSpends) {
      return 't2z';
    }
    // z->t: Deshielding (shielded input, transparent output, valueBalance>0)
    if ((hasShieldedSpends || hasVJoinSplit || (hasValueBalance && tx.valueBalance > 0)) && (hasTransparentOutputs || tx.vout?.length > 0)) {
      return 'z2t';
    }
    // z->z: Fully shielded (shielded spends and outputs, no transparent)
    if ((hasShieldedSpends || hasVJoinSplit) && (hasShieldedOutputs || hasVJoinSplit) && !hasTransparentInputs && !hasTransparentOutputs) {
      return 'z2z';
    }
    // t->t: Fully transparent
    if (hasTransparentInputs && hasTransparentOutputs && !hasShieldedSpends && !hasShieldedOutputs && !hasVJoinSplit && !hasValueBalance) {
      return 't2t';
    }
    // Fallback
    return 'other';
  }
  
  // Generate mock transactions for demo/fallback
  const generateMockTransactions = (count) => {
    const mockTxs = [];
    const txTypes = ['coinbase', 't2z', 'z2t', 'z2z', 't2t'];
    
    for (let i = 0; i < count; i++) {
      const txType = txTypes[Math.floor(Math.random() * txTypes.length)];
      const isCoinbase = txType === 'coinbase';
      const timestamp = Math.floor(Date.now() / 1000) - i * 600 - Math.floor(Math.random() * 3600);
      
      mockTxs.push({
        txid: `mock-tx-${i}-${Math.random().toString(36).substring(2, 10)}`,
        hash: `mock-tx-${i}-${Math.random().toString(36).substring(2, 10)}`,
        time: timestamp,
        blocktime: timestamp,
        confirmations: Math.floor(Math.random() * 100) + 1,
        blockhash: `mock-block-${Math.random().toString(36).substring(2, 10)}`,
        height: 500000 - Math.floor(Math.random() * 1000),
        size: Math.floor(Math.random() * 1000) + 200,
        vin: isCoinbase 
          ? [{ coinbase: "0371cb2f0b8d01062f503253482f", sequence: 4294967295 }]
          : Array(Math.floor(Math.random() * 3) + 1).fill().map((_, j) => ({
              txid: `input-tx-${j}-${Math.random().toString(36).substring(2, 10)}`,
              vout: 0,
              addresses: [`t1${Math.random().toString(36).substring(2, 34)}`]
            })),
        vout: Array(Math.floor(Math.random() * 3) + 1).fill().map((_, j) => ({
          value: Math.random() * 50,
          n: j,
          scriptPubKey: {
            addresses: [`t1${Math.random().toString(36).substring(2, 34)}`]
          }
        })),
        fee: Math.random() * 0.001,
        // Add fields for transaction type classification
        valueBalance: txType === 'z2t' ? Math.random() * 10 : txType === 't2z' ? -Math.random() * 10 : 0,
        vShieldedSpend: txType === 'z2t' || txType === 'z2z' ? [{}] : [],
        vShieldedOutput: txType === 't2z' || txType === 'z2z' ? [{}] : [],
      });
    }
    
    return mockTxs;
  };
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
      <div className="flex justify-between items-center mb-6">
        <h1 className="page-title">
          <FaExchangeAlt />
          Transactions
        </h1>
      </div>
      
      {loading && transactions.length === 0 ? (
        <Spinner message="Loading transactions..." />
      ) : (
        <>
          <div className="space-y-4 mb-6">
            {transactions.map(tx => {
              const txType = classifyTxType(tx);
              const isCoinbase = txType === 'coinbase';

              // Style map
              const styleMap = {
                coinbase: {
                  bg: 'bg-gradient-to-br from-yellow-50 via-yellow-100 to-white',
                  border: '6px solid #facc15',
                  iconBg: 'bg-yellow-200',
                  icon: <FaCoins className="text-yellow-600" size={16} />,
                  label: 'Coinbase',
                  labelClass: 'bg-yellow-100 text-yellow-700',
                  shadow: '0 4px 12px rgba(250, 204, 21, 0.2)'
                },
                t2z: {
                  bg: 'bg-gradient-to-br from-purple-50 via-purple-100 to-white',
                  border: '6px solid #a78bfa',
                  iconBg: 'bg-purple-200',
                  icon: <FaArrowRight className="text-purple-600" size={16} />,
                  label: 't→z',
                  labelClass: 'bg-purple-100 text-purple-700',
                  shadow: '0 4px 12px rgba(167, 139, 250, 0.2)'
                },
                z2t: {
                  bg: 'bg-gradient-to-br from-teal-50 via-green-100 to-white',
                  border: '6px solid #14b8a6',
                  iconBg: 'bg-teal-200',
                  icon: <FaArrowRight className="text-teal-600" size={16} />,
                  label: 'z→t',
                  labelClass: 'bg-teal-100 text-teal-700',
                  shadow: '0 4px 12px rgba(20, 184, 166, 0.2)'
                },
                z2z: {
                  bg: 'bg-gradient-to-br from-blue-50 via-blue-200 to-white',
                  border: '6px solid #2563eb',
                  iconBg: 'bg-blue-300',
                  icon: <FaArrowRight className="text-blue-800" size={16} />,
                  label: 'z→z',
                  labelClass: 'bg-blue-200 text-blue-800',
                  shadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
                },
                t2t: {
                  bg: 'bg-gradient-to-br from-blue-50 via-white to-blue-100',
                  border: '6px solid #38bdf8',
                  iconBg: 'bg-blue-200',
                  icon: <FaExchangeAlt className="text-blue-600" size={16} />,
                  label: 't→t',
                  labelClass: 'bg-blue-100 text-blue-700',
                  shadow: '0 4px 12px rgba(56, 189, 248, 0.2)'
                },
                other: {
                  bg: 'bg-gradient-to-br from-gray-50 via-gray-100 to-white',
                  border: '6px solid #a3a3a3',
                  iconBg: 'bg-gray-200',
                  icon: <FaExchangeAlt className="text-gray-600" size={16} />,
                  label: 'Other',
                  labelClass: 'bg-gray-100 text-gray-700',
                  shadow: '0 4px 12px rgba(163, 163, 163, 0.2)'
                },
              };
              const style = styleMap[txType] || styleMap.other;

              return (
                <div
                  key={tx.txid}
                  className={`transaction-tile ${style.bg}`}
                  style={{
                    borderLeft: style.border,
                    boxShadow: style.shadow
                  }}
                >
                  <Link to={`/tx/${tx.txid}`} className="block">
                    <div className="transaction-tile-compact">
                      {/* Mobile layout - Top section with icon and type */}
                      <div className="transaction-header">
                        <div className="flex items-center">
                          <div className={`transaction-type-indicator ${style.iconBg}`}>
                            {style.icon}
                          </div>
                          <span className="text-sm font-medium">{isCoinbase ? 'Coinbase' : 'Transaction'}</span>
                          <span className={`ml-2 text-xs py-0.5 px-1.5 rounded-full font-medium ${style.labelClass}`}>{style.label}</span>
                        </div>
                        <span className="text-xs py-0.5 px-1.5 rounded font-medium bg-gray-50 text-gray-500 border border-gray-100">
                          {tx.confirmations > 0 ? `${tx.confirmations} Confirms` : 'Unconfirmed'}
                        </span>
                      </div>
                      
                      {/* Transaction ID and time */}
                      <div className="flex justify-between items-center text-xs text-gray-500 mb-1">
                        <div className="font-mono overflow-hidden text-overflow-ellipsis">
                          <span className="text-gray-600">ID:</span> {formatHash(tx.txid, 10)}
                        </div>
                        <div className="flex items-center">
                          <FaClock className="mr-1" size={10} />
                          {formatRelativeTime(tx.time)}
                        </div>
                      </div>
                      
                      {/* Transaction details - grid layout */}
                      <div className="transaction-details-grid">
                        <div className="col-span-1">
                          <p className="text-xs text-gray-500">Block</p>
                          <p className="text-xs">
                            {tx.blockhash ? (
                              <Link 
                                to={`/blocks/${tx.blockhash}`} 
                                className="text-blue-600 hover:underline" 
                                onClick={(e) => e.stopPropagation()}
                              >
                                {tx.height || formatHash(tx.blockhash, 6)}
                              </Link>
                            ) : (
                              <span className="text-orange-500">Pending</span>
                            )}
                          </p>
                        </div>
                        <div className="col-span-1 text-center">
                          <p className="text-xs text-gray-500">In/Out</p>
                          <p className="text-xs">{tx.vin ? tx.vin.length : 0}/{tx.vout ? tx.vout.length : 0}</p>
                        </div>
                        <div className="col-span-2 text-right">
                          <p className="text-xs text-gray-500">{isCoinbase ? 'Reward' : 'Value'}</p>
                          <p className="text-xs font-medium text-green-600">
                            {tx.vout ? formatBTCZ(tx.vout.reduce((sum, output) => sum + (output.value || 0), 0)) : '0.00 BTCZ'}
                          </p>
                        </div>
                      </div>
                      
                      {/* From/To section */}
                      <div className="mt-1 grid grid-cols-1 gap-1 text-xs">
                        <div className="flex">
                          <div className="w-1/5 text-gray-500 font-medium">From:</div>
                          <div className="w-4/5">
                            {isCoinbase ? (
                              <div className="flex items-center">
                                <FaCoins className="text-yellow-500 mr-1" size={10} />
                                <span className="text-yellow-600">Newly Generated Coins</span>
                              </div>
                            ) : tx.vin && tx.vin.length > 0 && tx.vin[0].addresses ? (
                              <div className="transaction-address">
                                <Link
                                  to={`/address/${tx.vin[0].addresses[0]}`}
                                  className="text-blue-600 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {tx.vin[0].addresses[0]}
                                </Link>
                                {tx.vin.length > 1 && <span className="text-gray-500"> +{tx.vin.length - 1}</span>}
                              </div>
                            ) : (
                              tx.vin && tx.vin[0] && tx.vin[0].coinbase ? (
                                <span className="text-yellow-600">Coinbase</span>
                              ) : (
                                <span className="text-gray-500">No inputs</span>
                              )
                            )}
                          </div>
                        </div>
                        
                        <div className="flex">
                          <div className="w-1/5 text-gray-500 font-medium">To:</div>
                          <div className="w-4/5">
                            {tx.vout && tx.vout.length > 0 && tx.vout[0].scriptPubKey && tx.vout[0].scriptPubKey.addresses ? (
                              <div className="transaction-address">
                                <Link
                                  to={`/address/${tx.vout[0].scriptPubKey.addresses[0]}`}
                                  className="text-blue-600 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {tx.vout[0].scriptPubKey.addresses[0]}
                                </Link>
                                {tx.vout.length > 1 && <span className="text-gray-500"> +{tx.vout.length - 1}</span>}
                              </div>
                            ) : (
                              <span className="text-gray-500">No output address</span>
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
          
          {/* Information message instead of pagination */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-center">
            <p className="text-gray-700 mb-2">
              Showing the latest {transactions.length} transactions from the BitcoinZ blockchain.
            </p>
            <p className="text-gray-600 text-sm">
              To find specific transactions, use the <Link to="/search" className="text-blue-600 hover:underline">search function</Link> or <Link to="/blocks" className="text-blue-600 hover:underline">browse blocks</Link>.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default TransactionList;

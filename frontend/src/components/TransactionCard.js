import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaExchangeAlt, FaClock, FaCheck, FaArrowRight, FaCoins, FaLock, FaLockOpen, FaExclamationTriangle } from 'react-icons/fa';
import { formatRelativeTime, formatNumber } from '../utils/formatting';

// Transaction type classifier function
const classifyTxType = (tx) => {
  const isCoinbase = tx.vin && tx.vin.length > 0 && !!tx.vin[0].coinbase;
  if (isCoinbase) return 'coinbase';

  // Shielded fields
  const hasValueBalance = typeof tx.valueBalance === 'number' && tx.valueBalance !== 0;
  const hasVJoinSplit = tx.vjoinsplit && tx.vjoinsplit.length > 0;
  const hasShieldedSpends = tx.vShieldedSpend && tx.vShieldedSpend.length > 0;
  const hasShieldedOutputs = tx.vShieldedOutput && tx.vShieldedOutput.length > 0;
  
  // Transparent fields
  const hasTransparentInputs = tx.vin && tx.vin.length > 0 && !tx.vin[0].coinbase;
  const hasTransparentOutputs = tx.vout && tx.vout.length > 0;
  
  // t->z: Shielding (transparent input, shielded output, valueBalance<0)
  if (hasTransparentInputs && (hasShieldedOutputs || hasVJoinSplit || (hasValueBalance && tx.valueBalance < 0))) {
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
};

const TransactionCard = ({ transaction }) => {
  const {
    txid,
    time,
    vin,
    vout,
    confirmations,
    blockhash,
    isPlaceholder,
    isLoading: initialLoadingState
  } = transaction;
  
  const [isLoading, setIsLoading] = useState(isPlaceholder || initialLoadingState);
  const [hasTransitioned, setHasTransitioned] = useState(false);
  
  // Effect to transition from loading to loaded state after component mounts
  useEffect(() => {
    if (!isPlaceholder && txid) {
      // Longer delay to ensure loading animation is visible
      const timer = setTimeout(() => {
        setIsLoading(false);
        
        // Add a second timer for the transition effect
        const transitionTimer = setTimeout(() => {
          setHasTransitioned(true);
        }, 200);
        
        return () => clearTimeout(transitionTimer);
      }, 600); // Longer delay for more noticeable loading effect
      
      return () => clearTimeout(timer);
    }
  }, [isPlaceholder, txid]);
  
  // If this is a placeholder or loading state, show the loading UI with forced blur
  if (isPlaceholder || (isLoading && !hasTransitioned)) {
    return (
      <div className="transaction-tile block card p-3 sm:p-4 border-l-4 border-blue-200 shimmer placeholder-tile max-w-5xl mx-auto mb-4" style={{filter: 'blur(6px)', opacity: 0.7}}>
        <div className="flex flex-col md:flex-row md:items-center justify-between">
          <div className="flex items-center">
            <div className="bg-blue-50 p-2 rounded-full mr-2 sm:mr-3 w-8 h-8"></div>
            <div className="min-w-0">
              <div className="h-4 bg-blue-50 rounded w-24 mb-2"></div>
              <div className="h-3 bg-blue-50 rounded w-32"></div>
            </div>
          </div>
          
          <div className="mt-2 md:mt-0 text-right">
            <div className="h-3 bg-blue-50 rounded w-20 mb-1 ml-auto"></div>
            <div className="h-3 bg-blue-50 rounded w-16 mb-1 ml-auto"></div>
            <div className="h-3 bg-blue-50 rounded w-12 ml-auto"></div>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row gap-2 mt-3 items-center">
          <div className="bg-blue-50 p-2 rounded w-full md:w-2/5 h-12"></div>
          <div className="hidden md:flex items-center justify-center">
            <div className="bg-blue-50 rounded-full p-2 w-8 h-8"></div>
          </div>
          <div className="bg-blue-50 p-2 rounded w-full md:w-2/5 h-12"></div>
        </div>
      </div>
    );
  }
  
  // Classify transaction type
  const txType = classifyTxType(transaction);
  const isCoinbase = txType === 'coinbase';
  
  // Style map for different transaction types
  const styleMap = {
    coinbase: {
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-600',
      borderColor: 'border-yellow-200',
      icon: <FaCoins size={16} className="text-yellow-600" />,
      label: 'Coinbase',
      description: 'Mining Reward'
    },
    t2z: {
      bgColor: 'bg-purple-100',
      textColor: 'text-purple-600',
      borderColor: 'border-purple-200',
      icon: <FaLock size={16} className="text-purple-600" />,
      label: 't→z',
      description: 'Shielding'
    },
    z2t: {
      bgColor: 'bg-teal-100',
      textColor: 'text-teal-600',
      borderColor: 'border-teal-200',
      icon: <FaLockOpen size={16} className="text-teal-600" />,
      label: 'z→t',
      description: 'Deshielding'
    },
    z2z: {
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-700',
      borderColor: 'border-blue-200',
      icon: <FaLock size={16} className="text-blue-700" />,
      label: 'z→z',
      description: 'Shielded'
    },
    t2t: {
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-500',
      borderColor: 'border-blue-100',
      icon: <FaExchangeAlt size={16} className="text-blue-500" />,
      label: 't→t',
      description: 'Transparent'
    },
    other: {
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-600',
      borderColor: 'border-gray-200',
      icon: <FaExclamationTriangle size={16} className="text-gray-600" />,
      label: '?',
      description: 'Other'
    }
  };
  
  // Get style for current transaction type
  const style = styleMap[txType] || styleMap.other;
  
  // Check if it's a recent/pending transaction (less than 5 minutes old)
  const isPending = time && Date.now()/1000 - time < 300;
  const isVeryRecent = time && Date.now()/1000 - time < 60;
  
  return (
    <Link 
      to={`/tx/${txid}`} 
      className={`transaction-tile block card p-3 sm:p-4 hover:shadow-lg transition-shadow duration-200 border-l-4 ${style.borderColor} hover:border-bitcoinz-200 max-w-5xl mx-auto mb-4 ${hasTransitioned ? 'loaded' : 'loading-blur'} ${isPending ? 'pending-transaction' : ''}`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between">
        <div className="flex items-center">
          <div className={`${style.bgColor} p-2 rounded-full mr-2 sm:mr-3 flex-shrink-0`}>
            {style.icon}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-semibold flex items-center flex-wrap">
              <span className="mr-2">{isCoinbase ? 'Coinbase' : 'Transaction'}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${style.bgColor} ${style.textColor}`}>
                {style.label}
              </span>
            </h3>
            <p className="text-xs text-gray-500 flex items-center flex-wrap">
              <FaClock className={`mr-1 flex-shrink-0 ${isVeryRecent ? 'recent-time-icon' : ''}`} size={10} />
              <span className={`mr-2 ${isVeryRecent ? 'font-medium text-gray-600' : ''}`}>
                {isVeryRecent ? 'Just now' : formatRelativeTime(time)}
              </span>
              <span className="text-xs text-gray-500">{style.description}</span>
            </p>
          </div>
        </div>
        
        <div className="mt-2 md:mt-0 text-right">
          <div className="text-xs">
            <span className="text-gray-500">TxID:</span> 
            <span className="font-mono text-xs ml-1 text-gray-700">{txid.substring(0, 8)}...</span>
          </div>
          {blockhash && (
          <div className="text-xs text-gray-500">
            Block: <button
              type="button"
              className="text-bitcoinz-600 hover:underline bg-transparent border-none p-0 font-inherit"
              onClick={(e) => {
                e.stopPropagation(); // Prevent outer link navigation
                window.location.href = `/blocks/${blockhash}`;
              }}
            >
              {transaction.height || blockhash.substring(0, 6)}...
            </button>
          </div>
          )}
          <div className="flex items-center justify-end mt-1">
            {/* Show different status based on transaction age and confirmations */}
            {isPending ? (
              <div className="pending-label">Pending</div>
            ) : confirmations > 0 ? (
              <div className="flex items-center text-xs text-green-600">
                <FaCheck className="mr-1" size={10} />
                <span>{confirmations} {confirmations === 1 ? 'Confirm' : 'Confirms'}</span>
              </div>
            ) : (
              <div className="pending-label">Unconfirmed</div>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row gap-2 mt-3 text-xs items-center">
        <div className="bg-gray-50 p-2 rounded w-full md:w-2/5">
          <div className="text-gray-500 mb-1 font-medium">
            {isCoinbase ? 'Coinbase (New Coins)' : `${vin?.length || 0} Input${vin?.length !== 1 ? 's' : ''}`}
          </div>
          {isCoinbase ? (
            <div className="text-yellow-600 font-medium flex items-center">
              <FaCoins className="mr-1" size={12} /> Newly Generated Coins
            </div>
          ) : (
            <>
              {vin && vin.length > 0 && vin.slice(0, 2).map((input, index) => (
                <div key={index} className="font-mono text-xs truncate">
                  {input.address || 'Unknown Address'}
                </div>
              ))}
              {vin && vin.length > 2 && (
                <div className="text-xs text-gray-500">{vin.length - 2} more input(s)...</div>
              )}
              {(!vin || vin.length === 0) && (
                <div className="text-gray-400">No inputs</div>
              )}
            </>
          )}
        </div>
        
        <div className="flex md:hidden items-center justify-center w-full py-1">
          <div className={`${style.bgColor} rounded-full p-1`}>
            <FaArrowRight className={style.textColor} size={12} />
          </div>
        </div>
        
        <div className="hidden md:flex items-center justify-center">
          <div className={`${style.bgColor} rounded-full p-2`}>
            <FaArrowRight className={style.textColor} size={16} />
          </div>
        </div>
        
        <div className="bg-gray-50 p-2 rounded w-full md:w-2/5">
          <div className="text-gray-500 mb-1 font-medium">{vout?.length || 0} Output{vout?.length !== 1 ? 's' : ''}</div>
          {vout && vout.length > 0 && vout.slice(0, 2).map((output, index) => (
            <div key={index} className="flex justify-between text-xs">
              <span className="font-mono truncate max-w-[60%]">
                {output.scriptPubKey && output.scriptPubKey.addresses ? output.scriptPubKey.addresses[0] : 'Unknown Address'}
              </span>
              <span className="whitespace-nowrap ml-2">{output.value} BTCZ</span>
            </div>
          ))}
          {vout && vout.length > 2 && (
            <div className="text-xs text-gray-500">{vout.length - 2} more output(s)...</div>
          )}
          {(!vout || vout.length === 0) && (
            <div className="text-gray-400">No outputs</div>
          )}
        </div>
      </div>
      
      {/* Add Transaction Explanation Section */}
      <div className="mt-3 px-1">
        <div className="bg-blue-50 p-2 rounded text-xs border border-blue-100 text-blue-900">
          <span className="font-medium">{style.label}:</span> {style.description}
        </div>
      </div>
    </Link>
  );
};

export default TransactionCard;

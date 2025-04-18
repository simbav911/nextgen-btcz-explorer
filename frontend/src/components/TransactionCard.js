import React from 'react';
import { Link } from 'react-router-dom';
import { FaExchangeAlt, FaClock, FaCheck, FaArrowRight, FaCoins } from 'react-icons/fa';
import { formatRelativeTime, formatNumber } from '../utils/formatting';

const TransactionCard = ({ transaction }) => {
  const {
    txid,
    time,
    vin,
    vout,
    confirmations,
    blockhash
  } = transaction;
  
  // Check if this is a coinbase transaction (newly mined coins)
  const isCoinbase = vin && vin.length > 0 && vin.some(input => input.coinbase);
  
  return (
    <Link 
      to={`/tx/${txid}`} 
      className="block card hover:shadow-lg transition-shadow duration-200 hover:border-bitcoinz-200 max-w-5xl mx-auto"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between">
        <div className="flex items-center">
          <div className={`${isCoinbase ? 'bg-yellow-100' : 'bg-green-100'} p-2 rounded-full mr-3 flex-shrink-0`}>
            {isCoinbase ? 
              <FaCoins className="text-yellow-600" size={16} /> : 
              <FaExchangeAlt className="text-green-600" size={16} />
            }
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold flex items-center">
              {isCoinbase ? 'Coinbase Transaction (Newly Mined)' : 'Transaction'}
            </h3>
            <p className="text-xs text-gray-500 flex items-center">
              <FaClock className="mr-1 flex-shrink-0" size={10} />
              {formatRelativeTime(time)}
            </p>
          </div>
        </div>
        
        <div className="mt-2 md:mt-0 text-right">
          <div className="text-xs">
            <span className="text-gray-500">TxID:</span> 
            <span className="font-mono text-xs ml-1 text-gray-700">{txid.substring(0, 10)}...</span>
          </div>
          {blockhash && (
            <div className="text-xs text-gray-500">
              Block: <Link to={`/blocks/${blockhash}`} className="text-bitcoinz-600 hover:underline" onClick={(e) => e.stopPropagation()}>{formatNumber(transaction.blockheight)}</Link>
            </div>
          )}
          <div className="flex items-center justify-end mt-1">
            {confirmations > 0 && (
              <div className="flex items-center text-xs text-green-600">
                <FaCheck className="mr-1" size={10} />
                <span>{confirmations} {confirmations === 1 ? 'Confirmation' : 'Confirmations'}</span>
              </div>
            )}
            {confirmations === 0 && (
              <div className="text-xs text-orange-500">Unconfirmed</div>
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
              {vin && vin.length > 0 && vin.map((input, index) => (
                <div key={index} className="font-mono text-xs overflow-hidden text-overflow-ellipsis">
                  {input.address || 'Unknown Address'}
                </div>
              ))}
              {(!vin || vin.length === 0) && (
                <div className="text-gray-400">No inputs</div>
              )}
            </>
          )}
        </div>
        
        <div className="hidden md:flex items-center justify-center">
          <div className="bg-blue-100 rounded-full p-2">
            <FaArrowRight className="text-blue-600" size={16} />
          </div>
        </div>
        
        <div className="bg-gray-50 p-2 rounded w-full md:w-2/5">
          <div className="text-gray-500 mb-1 font-medium">{vout?.length || 0} Output{vout?.length !== 1 ? 's' : ''}</div>
          {vout && vout.length > 0 && vout.map((output, index) => (
            <div key={index} className="flex justify-between text-xs">
              <span className="font-mono overflow-hidden text-overflow-ellipsis">
                {output.scriptPubKey && output.scriptPubKey.addresses ? output.scriptPubKey.addresses[0] : 'Unknown Address'}
              </span>
              <span className="whitespace-nowrap ml-2">{output.value} BTCZ</span>
            </div>
          ))}
          {(!vout || vout.length === 0) && (
            <div className="text-gray-400">No outputs</div>
          )}
        </div>
      </div>
    </Link>
  );
};

export default TransactionCard;

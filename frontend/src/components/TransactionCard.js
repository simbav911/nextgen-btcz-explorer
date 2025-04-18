import React from 'react';
import { Link } from 'react-router-dom';
import { FaExchangeAlt, FaClock, FaCheck, FaArrowRight } from 'react-icons/fa';
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
  
  return (
    <Link 
      to={`/tx/${txid}`} 
      className="block card hover:shadow-lg transition-shadow duration-200 hover:border-bitcoinz-200 max-w-5xl mx-auto"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between">
        <div className="flex items-center">
          <div className="bg-green-100 p-2 rounded-full mr-3 flex-shrink-0">
            <FaExchangeAlt className="text-green-600" size={16} />
          </div>
          <div className="min-w-0"> {/* Add min-width: 0 to allow truncation */}
            <h3 className="text-base font-semibold">
              Transaction
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
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3 text-xs">
        <div className="bg-gray-50 p-2 rounded">
          <div className="text-gray-500 mb-1 font-medium">{vin?.length || 0} Input{vin?.length !== 1 ? 's' : ''}</div>
          {vin && vin.length > 0 && vin.slice(0, 2).map((input, index) => (
            <div key={index} className="truncate font-mono text-xs">
              {input.address || 'Unknown Address'}
            </div>
          ))}
          {vin && vin.length > 2 && (
            <div className="text-gray-400 text-xs mt-1">+ {vin.length - 2} more inputs</div>
          )}
          {(!vin || vin.length === 0) && (
            <div className="text-gray-400">No inputs</div>
          )}
        </div>
        
        <div className="flex items-center">
          <div className="bg-gray-50 p-2 rounded flex-grow">
            <div className="text-gray-500 mb-1 font-medium">{vout?.length || 0} Output{vout?.length !== 1 ? 's' : ''}</div>
            {vout && vout.length > 0 && vout.slice(0, 2).map((output, index) => (
              <div key={index} className="flex justify-between text-xs">
                <span className="truncate font-mono mr-2 flex-grow">
                  {output.scriptPubKey && output.scriptPubKey.addresses ? output.scriptPubKey.addresses[0].substring(0, 15) + '...' : 'Unknown Address'}
                </span>
                <span className="whitespace-nowrap">{output.value} BTCZ</span>
              </div>
            ))}
            {vout && vout.length > 2 && (
              <div className="text-gray-400 text-xs mt-1">+ {vout.length - 2} more outputs</div>
            )}
            {(!vout || vout.length === 0) && (
              <div className="text-gray-400">No outputs</div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};

export default TransactionCard;

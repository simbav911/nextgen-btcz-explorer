import React from 'react';
import { Link } from 'react-router-dom';
import { FaExchangeAlt, FaClock, FaCheck } from 'react-icons/fa';
import { formatTimestamp, formatRelativeTime, formatHash, formatBTCZ, formatConfirmations } from '../utils/formatting';

const TransactionCard = ({ transaction }) => {
  if (!transaction) return null;
  
  const confirmationInfo = formatConfirmations(transaction.confirmations || 0);
  
  return (
    <div className="card hover:shadow-lg transition-shadow duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between">
        <div className="flex items-center">
          <div className="bg-bitcoinz-100 p-3 rounded-full mr-4">
            <FaExchangeAlt className="text-bitcoinz-600" size={20} />
          </div>
          <div>
            <h3 className="text-lg font-semibold">
              <Link to={`/tx/${transaction.txid}`} className="hover:text-bitcoinz-600">
                Transaction
              </Link>
            </h3>
            <p className="text-sm text-gray-500 flex items-center">
              <FaClock className="mr-1" />
              {formatTimestamp(transaction.time)} ({formatRelativeTime(transaction.time)})
            </p>
          </div>
        </div>
        
        <div className="mt-4 md:mt-0">
          <span className={`badge ${confirmationInfo.class}`}>
            <FaCheck className="mr-1" />
            {confirmationInfo.text}
          </span>
        </div>
      </div>
      
      <div className="mt-4">
        <div className="text-sm mb-2">
          <span className="font-medium">TxID:</span>{' '}
          <Link to={`/tx/${transaction.txid}`} className="font-mono text-bitcoinz-600 hover:underline">
            {formatHash(transaction.txid, 16)}
          </Link>
        </div>
        
        {transaction.blockhash && (
          <div className="text-sm mb-2">
            <span className="font-medium">Block:</span>{' '}
            <Link to={`/blocks/${transaction.blockhash}`} className="font-mono text-bitcoinz-600 hover:underline">
              {formatHash(transaction.blockhash)}
            </Link>
          </div>
        )}
      </div>
      
      <div className="mt-4 border-t border-gray-200 pt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Inputs */}
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-2">
              {transaction.vin && transaction.vin.length} Input{transaction.vin && transaction.vin.length !== 1 ? 's' : ''}
            </h4>
            {transaction.vin && transaction.vin.map((input, index) => (
              <div key={index} className="text-sm mb-2">
                {input.coinbase ? (
                  <span className="text-gray-600">Coinbase (New Coins)</span>
                ) : (
                  <>
                    {input.address ? (
                      <Link to={`/address/${input.address}`} className="text-bitcoinz-600 hover:underline">
                        {formatHash(input.address, 12)}
                      </Link>
                    ) : (
                      <span className="text-gray-600">Unknown Address</span>
                    )}
                    {input.value && (
                      <span className="ml-2 text-gray-600">{formatBTCZ(input.value)}</span>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
          
          {/* Outputs */}
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-2">
              {transaction.vout && transaction.vout.length} Output{transaction.vout && transaction.vout.length !== 1 ? 's' : ''}
            </h4>
            {transaction.vout && transaction.vout.map((output, index) => (
              <div key={index} className="text-sm mb-2">
                {output.scriptPubKey && output.scriptPubKey.addresses ? (
                  <>
                    <Link to={`/address/${output.scriptPubKey.addresses[0]}`} className="text-bitcoinz-600 hover:underline">
                      {formatHash(output.scriptPubKey.addresses[0], 12)}
                    </Link>
                    <span className="ml-2 text-gray-600">{formatBTCZ(output.value)}</span>
                  </>
                ) : (
                  <span className="text-gray-600">
                    {output.scriptPubKey && output.scriptPubKey.type ? output.scriptPubKey.type : 'Unknown'}
                    {output.value !== undefined && (
                      <span className="ml-2">{formatBTCZ(output.value)}</span>
                    )}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionCard;

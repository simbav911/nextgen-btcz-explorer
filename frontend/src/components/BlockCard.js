import React from 'react';
import { Link } from 'react-router-dom';
import { FaCube, FaClock } from 'react-icons/fa';
import { formatRelativeTime, formatNumber } from '../utils/formatting';

const BlockCard = ({ block }) => {
  const {
    height,
    hash,
    time,
    size,
    difficulty,
    bits,
    nonce,
    tx_count
  } = block;
  
  return (
    <Link 
      to={`/blocks/${hash}`} 
      className="block card hover:shadow-lg transition-shadow duration-200 hover:border-bitcoinz-200"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between">
        <div className="flex items-center">
          <div className="bg-bitcoinz-100 p-3 rounded-full mr-4 flex-shrink-0">
            <FaCube className="text-bitcoinz-600" size={20} />
          </div>
          <div className="min-w-0"> {/* Add min-width: 0 to allow truncation */}
            <h3 className="text-lg font-semibold">
              Block {formatNumber(height)}
            </h3>
            <p className="text-sm text-gray-500 flex items-center">
              <FaClock className="mr-1 flex-shrink-0" />
              {formatRelativeTime(time)}
            </p>
          </div>
        </div>
        
        <div className="mt-2 md:mt-0 text-right">
          <div className="text-sm">
            <span className="text-gray-500">Hash:</span> 
            <span className="font-mono text-xs ml-1 text-gray-700">{hash.substring(0, 10)}...</span>
          </div>
          <div className="text-sm text-gray-500">
            {tx_count} {tx_count === 1 ? 'transaction' : 'transactions'}
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
        <div>
          <div className="text-gray-500">Size</div>
          <div>{formatNumber(size)} bytes</div>
        </div>
        <div>
          <div className="text-gray-500">Difficulty</div>
          <div>{typeof difficulty === 'number' ? difficulty.toFixed(2) : difficulty}</div>
        </div>
        <div>
          <div className="text-gray-500">Bits</div>
          <div className="font-mono">{bits}</div>
        </div>
        <div>
          <div className="text-gray-500">Nonce</div>
          <div className="font-mono truncate">{nonce}</div>
        </div>
      </div>
    </Link>
  );
};

export default BlockCard;

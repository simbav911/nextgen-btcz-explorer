import React from 'react';
import { Link } from 'react-router-dom';
import { FaCube, FaClock, FaExchangeAlt } from 'react-icons/fa';
import { formatTimestamp, formatRelativeTime, formatHash, formatNumber } from '../utils/formatting';

const BlockCard = ({ block }) => {
  if (!block) return null;
  
  return (
    <div className="card hover:shadow-lg transition-shadow duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between">
        <div className="flex items-center">
          <div className="bg-bitcoinz-100 p-3 rounded-full mr-4">
            <FaCube className="text-bitcoinz-600" size={20} />
          </div>
          <div>
            <h3 className="text-lg font-semibold">
              <Link to={`/blocks/${block.hash}`} className="hover:text-bitcoinz-600">
                Block {block.height.toLocaleString()}
              </Link>
            </h3>
            <p className="text-sm text-gray-500 flex items-center">
              <FaClock className="mr-1" />
              {formatTimestamp(block.time)} ({formatRelativeTime(block.time)})
            </p>
          </div>
        </div>
        
        <div className="mt-4 md:mt-0 flex flex-col items-start md:items-end">
          <div className="text-sm">
            <span className="font-medium">Hash:</span>{' '}
            <Link to={`/blocks/${block.hash}`} className="font-mono text-bitcoinz-600 hover:underline">
              {formatHash(block.hash)}
            </Link>
          </div>
          <div className="text-sm flex items-center mt-1">
            <FaExchangeAlt className="mr-1" />
            <span>{formatNumber(block.tx.length)} transactions</span>
          </div>
        </div>
      </div>
      
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-gray-500">Size</p>
          <p className="font-medium">{formatNumber(block.size)} bytes</p>
        </div>
        <div>
          <p className="text-gray-500">Difficulty</p>
          <p className="font-medium">{block.difficulty.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-gray-500">Bits</p>
          <p className="font-medium font-mono">{block.bits}</p>
        </div>
        <div>
          <p className="text-gray-500">Nonce</p>
          <p className="font-medium font-mono">{block.nonce}</p>
        </div>
      </div>
    </div>
  );
};

export default BlockCard;

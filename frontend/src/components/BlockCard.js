import React from 'react';
import { Link } from 'react-router-dom';
import { FaCube, FaClock, FaExchangeAlt } from 'react-icons/fa';
import { formatTimestamp, formatRelativeTime, formatHash, formatNumber } from '../utils/formatting';

const BlockCard = ({ block }) => {
  if (!block) return null;
  
  // Style for truncated text with ellipsis
  const truncateStyle = {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
    display: 'inline-block'
  };
  
  return (
    <div className="card hover:shadow-lg">
      <div className="flex flex-col md:flex-row md:items-center justify-between">
        <div className="flex items-center">
          <div className="bg-bitcoinz-100 p-3 rounded-full mr-4 flex-shrink-0">
            <FaCube className="text-bitcoinz-600" size={20} />
          </div>
          <div className="min-w-0"> {/* Add min-width: 0 to allow truncation */}
            <h3 className="text-lg font-semibold">
              <Link to={`/blocks/${block.hash}`} className="hover:text-bitcoinz-600">
                Block {block.height.toLocaleString()}
              </Link>
            </h3>
            <p className="text-sm text-gray-500 flex items-center">
              <FaClock className="mr-1 flex-shrink-0" />
              <span title={formatTimestamp(block.time)}>
                {formatRelativeTime(block.time)}
              </span>
            </p>
          </div>
        </div>
        
        <div className="mt-4 md:mt-0 flex flex-col items-start md:items-end">
          <div className="text-sm overflow-hidden max-w-full">
            <span className="font-medium">Hash:</span>{' '}
            <Link 
              to={`/blocks/${block.hash}`} 
              className="font-mono text-bitcoinz-600 hover:underline"
              title={block.hash}
            >
              <span style={truncateStyle}>{formatHash(block.hash)}</span>
            </Link>
          </div>
          <div className="text-sm flex items-center mt-1">
            <FaExchangeAlt className="mr-1 flex-shrink-0" />
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
          <p className="font-medium">{typeof block.difficulty === 'number' ? block.difficulty.toFixed(2) : block.difficulty}</p>
        </div>
        <div>
          <p className="text-gray-500">Bits</p>
          <p className="font-medium font-mono truncate" title={block.bits}>{block.bits}</p>
        </div>
        <div>
          <p className="text-gray-500">Nonce</p>
          <p className="font-medium font-mono truncate" title={block.nonce}>{block.nonce}</p>
        </div>
      </div>
    </div>
  );
};

export default React.memo(BlockCard);

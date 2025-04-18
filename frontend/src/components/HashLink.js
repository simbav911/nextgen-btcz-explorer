import React from 'react';
import { Link } from 'react-router-dom';
import { FaCopy } from 'react-icons/fa';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { formatHash } from '../utils/formatting';

/**
 * Component for displaying hashes with copy button and proper truncation
 * @param {string} hash - The hash to display
 * @param {string} type - The type of hash (block, tx, address)
 * @param {number} length - Number of characters to show before truncation
 * @param {boolean} showCopy - Whether to show copy button
 * @param {string} className - Optional custom className for link styling
 */
const HashLink = ({ hash, type = 'tx', length = 10, showCopy = true, className = '' }) => {
  if (!hash) return null;
  
  const getUrl = () => {
    switch (type) {
      case 'block':
        return `/blocks/${hash}`;
      case 'tx':
        return `/tx/${hash}`;
      case 'address':
        return `/address/${hash}`;
      default:
        return '#';
    }
  };
  
  const truncateStyle = {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
    display: 'inline-block'
  };

  // Determine default class based on type
  let defaultClass = "font-mono hover:underline mr-1 overflow-hidden flex-1";
  
  // Add type-specific styling
  switch (type) {
    case 'tx':
      defaultClass += " text-blue-700 font-medium";
      break;
    case 'block':
      defaultClass += " text-green-700 font-medium";
      break;
    case 'address':
      defaultClass += " text-purple-700 font-medium";
      break;
    default:
      defaultClass += " text-bitcoinz-600";
  }
  
  return (
    <div className="flex items-center w-full overflow-hidden group">
      <Link 
        to={getUrl()} 
        className={`${defaultClass} ${className}`}
        title={hash}
      >
        <span style={truncateStyle}>{formatHash(hash, length)}</span>
      </Link>
      
      {showCopy && (
        <CopyToClipboard text={hash}>
          <button 
            className="bg-white text-blue-600 hover:text-blue-800 p-1 rounded-full shadow-sm transition-colors focus:outline-none flex-shrink-0" 
            title="Copy to clipboard"
          >
            <FaCopy size={14} />
          </button>
        </CopyToClipboard>
      )}
    </div>
  );
};

export default HashLink;

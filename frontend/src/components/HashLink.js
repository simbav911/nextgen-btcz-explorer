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
 */
const HashLink = ({ hash, type = 'tx', length = 10, showCopy = true }) => {
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
  
  return (
    <div className="flex items-center w-full overflow-hidden group">
      <Link 
        to={getUrl()} 
        className="font-mono text-bitcoinz-600 hover:underline mr-1 overflow-hidden flex-1"
        title={hash}
      >
        <span style={truncateStyle}>{formatHash(hash, length)}</span>
      </Link>
      
      {showCopy && (
        <CopyToClipboard text={hash}>
          <button 
            className="text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none flex-shrink-0" 
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

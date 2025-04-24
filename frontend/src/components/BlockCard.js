import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaCube, FaClock, FaHammer } from 'react-icons/fa';
import { formatRelativeTime, formatNumber } from '../utils/formatting';
import api from '../services/api';

// Helper function to decode hex to ASCII
const hexToAscii = (hex) => {
  try {
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
      const charCode = parseInt(hex.substr(i, 2), 16);
      // Only include printable ASCII characters
      if (charCode >= 32 && charCode <= 126) {
        str += String.fromCharCode(charCode);
      }
    }
    return str;
  } catch (e) {
    console.error('Error decoding hex:', e);
    return '';
  }
};

// Function to extract pool name from coinbase data
const extractPoolName = (coinbaseHex, coinbaseTx) => {
  if (!coinbaseHex) return null;
  
  // Convert hex to ASCII to check for pool signatures
  const coinbaseAscii = hexToAscii(coinbaseHex);
  
  // Common mining pool patterns - FIRST PRIORITY
  const poolPatterns = [
    { pattern: /zpool\.ca/i, name: 'Zpool' },
    { pattern: /zergpool/i, name: 'Zergpool' },
    { pattern: /Z-NOMP/i, name: 'Z-NOMP' },
    { pattern: /darkfibermines/i, name: 'DarkFiberMines' },
    { pattern: /2miners|2mars/i, name: '2Mars' },
    { pattern: /solopool/i, name: 'Solo Pool' },
    { pattern: /f2pool/i, name: 'F2Pool' },
    { pattern: /viabtc/i, name: 'ViaBTC' },
    { pattern: /btcz\.pool/i, name: 'BTCZ Pool' },
    { pattern: /slush/i, name: 'SlushPool' },
    { pattern: /antpool/i, name: 'AntPool' },
    { pattern: /btc\.com/i, name: 'BTC.COM' },
    { pattern: /poolin/i, name: 'Poolin' }
  ];
  
  // Check for matches in the ASCII string
  for (const pool of poolPatterns) {
    if (pool.pattern.test(coinbaseAscii)) {
      return pool.name;
    }
  }
  
  // Look for anything that might be a pool name - SECOND PRIORITY
  const nameMatch = coinbaseAscii.match(/([A-Za-z0-9]+\s*Pool|[A-Za-z0-9]+\s*Miner)/);
  if (nameMatch) {
    return nameMatch[0];
  }
  
  // If we found a URL in the coinbase, use that - THIRD PRIORITY
  // But filter out swgroupe.fr which seems to be a false positive
  const urlMatch = coinbaseAscii.match(/https?:\/\/[^\s]+/);
  if (urlMatch && !urlMatch[0].includes('swgroupe.fr')) {
    const url = urlMatch[0];
    // Extract domain name from URL
    const domain = url.replace(/https?:\/\//, '').split('/')[0];
    if (domain !== 'swgroupe.fr') {
      return domain;
    }
  }
  
  // If no pool name found, return the recipient address - FOURTH PRIORITY
  if (coinbaseTx && coinbaseTx.vout && coinbaseTx.vout.length > 0) {
    const firstOutput = coinbaseTx.vout[0];
    if (firstOutput.scriptPubKey && firstOutput.scriptPubKey.addresses && firstOutput.scriptPubKey.addresses.length > 0) {
      return firstOutput.scriptPubKey.addresses[0];
    }
  }
  
  return null;
};

const BlockCard = ({ block }) => {
  const {
    height,
    hash,
    time,
    size,
    difficulty,
    bits,
    nonce,
    tx_count,
    minerInfo
  } = block;
  
  const [miner, setMiner] = useState(minerInfo || null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Try to extract miner information if not already provided
  useEffect(() => {
    // Skip if we already have mining info
    if (miner) {
      setIsLoading(false);
      return;
    }
    
    const fetchMinerInfo = async () => {
      try {
        // First get the block details to find the first transaction (coinbase)
        const blockResponse = await api.get(`/blocks/hash/${hash}`);
        
        if (blockResponse.data && blockResponse.data.tx && blockResponse.data.tx.length > 0) {
          // Get the first transaction (coinbase)
          const coinbaseTxid = blockResponse.data.tx[0];
          const txResponse = await api.get(`/transactions/${coinbaseTxid}`);
          
          if (txResponse.data && txResponse.data.vin && txResponse.data.vin.length > 0) {
            const coinbaseTx = txResponse.data.vin[0];
            
            // Check if this is a coinbase transaction
            if (coinbaseTx.coinbase) {
              // Extract pool name from coinbase data
              const poolName = extractPoolName(coinbaseTx.coinbase, txResponse.data);
              
              if (poolName) {
                setMiner(poolName);
              } else {
                // If no pool name or address found, use "Unknown Pool"
                setMiner('Unknown Pool');
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching mining pool data:', error);
        // Set a default value if there's an error
        setMiner('Unknown Pool');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMinerInfo();
  }, [hash, miner, minerInfo]);
  
  return (
    <Link 
      to={`/blocks/${hash}`} 
      className="block-card-glowing block card p-3 hover:shadow-lg transition-all duration-300 border border-gray-200 rounded-xl"
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'white',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)',
      }}
    >
      {/* Glowing background effect */}
      <div 
        className="absolute inset-0 opacity-5" 
        style={{ 
          background: 'radial-gradient(circle at 30% 30%, #3B82F6, transparent 70%)',
          zIndex: 1 
        }}
      />
      
      <div className="flex items-center justify-between mb-2 relative z-10">
        <div className="flex items-center">
          <div className="bg-blue-100 p-2 rounded-full mr-2 flex-shrink-0 shadow-md" 
               style={{ boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)' }}>
            <FaCube className="text-blue-600" size={14} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">Block {formatNumber(height)}</h3>
          </div>
        </div>
        <div className="text-xs font-medium bg-gray-100 px-2 py-1 rounded-full text-gray-600">
          {tx_count} {tx_count === 1 ? 'tx' : 'txs'}
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-1 mb-2 relative z-10">
        <div className="flex items-center text-xs">
          <FaClock className="mr-1 flex-shrink-0 text-blue-500" size={10} />
          <span className="text-gray-600 truncate">{formatRelativeTime(time)}</span>
        </div>
        
        <div className="text-xs text-center">
          <span className="text-gray-600">{formatNumber(size)} bytes</span>
        </div>
        
        <div className="text-xs text-right">
          <span className="text-gray-600 truncate">{typeof difficulty === 'number' ? difficulty.toFixed(2) : difficulty}</span>
        </div>
      </div>
      
      <div className="flex justify-between items-center text-xs relative z-10 pt-1 border-t border-gray-100">
        {(miner || !isLoading) && (
          <div className="flex items-center text-blue-600 truncate max-w-[60%]">
            <FaHammer className="mr-1 flex-shrink-0" size={10} />
            <span className="truncate font-medium">{miner || 'Unknown Pool'}</span>
          </div>
        )}
        
        <div className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600 truncate text-right">
          {hash.substring(0, 6)}...
        </div>
      </div>
    </Link>
  );
};

export default BlockCard;

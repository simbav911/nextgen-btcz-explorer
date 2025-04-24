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
      className="block card hover:shadow-lg transition-shadow duration-200 hover:border-bitcoinz-200"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between">
        <div className="flex items-center">
          <div className="bg-bitcoinz-100 p-2 sm:p-3 rounded-full mr-3 sm:mr-4 flex-shrink-0">
            <FaCube className="text-bitcoinz-600" size={16} />
          </div>
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-semibold truncate-mobile">
              Block {formatNumber(height)}
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 flex items-center">
              <FaClock className="mr-1 flex-shrink-0" size={12} />
              {formatRelativeTime(time)}
            </p>
            {/* Show mining pool info when available */}
            {(miner || !isLoading) && (
              <p className="text-xs text-blue-600 flex items-center mt-1 truncate-mobile max-w-full">
                <FaHammer className="mr-1 flex-shrink-0" size={10} />
                <span className="truncate">Mined by {miner || 'Unknown Pool'}</span>
              </p>
            )}
          </div>
        </div>
        
        <div className="mt-2 md:mt-0 text-right">
          <div className="text-xs sm:text-sm">
            <span className="text-gray-500">Hash:</span> 
            <span className="font-mono text-xs ml-1 text-gray-700">{hash.substring(0, 8)}...</span>
          </div>
          <div className="text-xs sm:text-sm text-gray-500">
            {tx_count} {tx_count === 1 ? 'tx' : 'txs'}
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mt-3 sm:mt-4 text-xs sm:text-sm">
        <div>
          <div className="text-gray-500">Size</div>
          <div>{formatNumber(size)} bytes</div>
        </div>
        <div>
          <div className="text-gray-500">Difficulty</div>
          <div className="truncate">{typeof difficulty === 'number' ? difficulty.toFixed(2) : difficulty}</div>
        </div>
        <div>
          <div className="text-gray-500">Bits</div>
          <div className="font-mono truncate">{bits}</div>
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

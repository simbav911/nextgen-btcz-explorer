import React, { useState, useEffect, useContext, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FaCube, FaClock, FaLayerGroup } from 'react-icons/fa';

// Components
import Spinner from '../components/Spinner';
import BlockCard from '../components/BlockCard';
import Pagination from '../components/Pagination';

// Contexts
import { SocketContext } from '../contexts/SocketContext';
import { ToastContext } from '../contexts/ToastContext';

// Services
import { blockService, statsService } from '../services/api';
import apiInstance from '../services/api';

// Utils
import { formatNumber, formatTimestamp, formatRelativeTime } from '../utils/formatting';

const BLOCKS_PER_PAGE = 40;

// Helper function to decode hex to ASCII
const hexToAscii = (hex) => {
  try {
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
      const charCode = parseInt(hex.substr(i, 2), 16);
      if (charCode >= 32 && charCode <= 126) {
        str += String.fromCharCode(charCode);
      }
    }
    return str;
  } catch (e) {
    return '';
  }
};

const extractPoolName = (coinbaseHex, coinbaseTx) => {
  if (!coinbaseHex) return null;
  const coinbaseAscii = hexToAscii(coinbaseHex);
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
  for (const pool of poolPatterns) {
    if (pool.pattern.test(coinbaseAscii)) {
      return pool.name;
    }
  }
  const nameMatch = coinbaseAscii.match(/([A-Za-z0-9]+\s*Pool|[A-Za-z0-9]+\s*Miner)/);
  if (nameMatch) {
    return nameMatch[0];
  }
  const urlMatch = coinbaseAscii.match(/https?:\/\/[^\s]+/);
  if (urlMatch && !urlMatch[0].includes('swgroupe.fr')) {
    const url = urlMatch[0];
    const domain = url.replace(/https?:\/\//, '').split('/')[0];
    if (domain !== 'swgroupe.fr') {
      return domain;
    }
  }
  if (coinbaseTx && coinbaseTx.vout && coinbaseTx.vout.length > 0) {
    const firstOutput = coinbaseTx.vout[0];
    if (firstOutput.scriptPubKey && firstOutput.scriptPubKey.addresses && firstOutput.scriptPubKey.addresses.length > 0) {
      return firstOutput.scriptPubKey.addresses[0];
    }
  }
  return null;
};

const getBlockPoolNames = async (blocks) => {
  const updatedBlocks = await Promise.all(blocks.map(async (block) => {
    if (block.miningPoolName) return block;
    try {
      // Fetch coinbase transaction for this block
      const blockDetail = await apiInstance.get(`/blocks/hash/${block.hash}`);
      const coinbaseTxid = blockDetail.data.tx[0];
      const txDetail = await apiInstance.get(`/transactions/${coinbaseTxid}`);
      const coinbaseVin = txDetail.data.vin[0];
      const poolName = extractPoolName(coinbaseVin.coinbase, txDetail.data);
      return { ...block, miningPoolName: poolName || 'Unknown Pool' };
    } catch {
      return { ...block, miningPoolName: 'Unknown Pool' };
    }
  }));
  return updatedBlocks;
};

const BlockList = () => {
  const [loading, setLoading] = useState(true);
  const [blocks, setBlocks] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalBlocks, setTotalBlocks] = useState(0);
  const [animateDigits, setAnimateDigits] = useState(false);
  const prevTotalRef = useRef(0);
  
  const socket = useContext(SocketContext);
  const { showToast } = useContext(ToastContext);
  
  // Calculate total pages
  const totalPages = Math.ceil(totalBlocks / BLOCKS_PER_PAGE);
  
  // Fetch blocks for the current page
  const fetchBlocks = async (page) => {
    try {
      setLoading(true);
      
      // Get current blockchain info to know the latest block height
      const infoResponse = await statsService.getBlockchainInfo();
      const latestBlockHeight = infoResponse.data.blocks;
      setTotalBlocks(latestBlockHeight + 1); // +1 because block heights start at 0
      
      const offset = (page - 1) * BLOCKS_PER_PAGE;
      const response = await blockService.getLatestBlocks(BLOCKS_PER_PAGE, offset);
      
      // --- Fetch mining pool names for each block ---
      const blocksWithPools = await getBlockPoolNames(response.data.blocks);
      setBlocks(blocksWithPools);
      setCurrentPage(page);
    } catch (error) {
      console.error('Error fetching blocks:', error);
      showToast('Failed to fetch blocks', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Initial fetch
  useEffect(() => {
    fetchBlocks(1);
  }, []);
  
  // Listen for new blocks
  useEffect(() => {
    if (!socket) return;
    
    socket.on('new_block', async (block) => {
      // Only update if we're on the first page
      if (currentPage === 1) {
        try {
          // Get mining pool info for the new block before adding it
          const blockDetail = await apiInstance.get(`/blocks/hash/${block.hash}`);
          const coinbaseTxid = blockDetail.data.tx[0];
          const txDetail = await apiInstance.get(`/transactions/${coinbaseTxid}`);
          const coinbaseVin = txDetail.data.vin[0];
          const poolName = extractPoolName(coinbaseVin.coinbase, txDetail.data);
          
          // Add mining pool info to the block
          const blockWithPool = { 
            ...block, 
            miningPoolName: poolName || 'Unknown Pool' 
          };
          
          setBlocks(prevBlocks => {
            // Add block to beginning and remove last block
            const newBlocks = [blockWithPool, ...prevBlocks.slice(0, -1)];
            return newBlocks;
          });
        } catch (error) {
          console.error('Error fetching mining pool info:', error);
          // Still add the block even if we couldn't get pool info
          setBlocks(prevBlocks => {
            const newBlocks = [
              { ...block, miningPoolName: 'Unknown Pool' }, 
              ...prevBlocks.slice(0, -1)
            ];
            return newBlocks;
          });
        }
        
        // Update total block count
        setTotalBlocks(prev => prev + 1);
      }
      
      showToast(`New block #${block.height} mined`, 'info');
    });
    
    return () => {
      socket.off('new_block');
    };
  }, [socket, currentPage, showToast]);
  
  // Effect to handle animation when totalBlocks changes
  useEffect(() => {
    if (prevTotalRef.current !== 0 && prevTotalRef.current !== totalBlocks) {
      setAnimateDigits(true);
      const timer = setTimeout(() => setAnimateDigits(false), 500);
      return () => clearTimeout(timer);
    }
    prevTotalRef.current = totalBlocks;
  }, [totalBlocks]);
  
  // Handle page change
  const handlePageChange = (page) => {
    fetchBlocks(page);
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
      <div className="flex-1 flex flex-col justify-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-24">
          <div className="flex flex-col md:flex-row items-center justify-between mb-8">
            <h1 className="page-title">
              <FaLayerGroup />
              Blocks
            </h1>
            <div className="total-blocks-counter">
              <span>Total Blocks: </span>
              <span className={animateDigits ? 'font-semibold digit-animation' : 'font-semibold'}>
                {formatNumber(totalBlocks)}
              </span>
            </div>
          </div>
          {loading ? (
            <Spinner message="Loading blocks..." />
          ) : (
            <>
              {/* Block List with blue shadow effect */}
              <div className="rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-10 min-h-[1600px] bg-white blue-shadow-effect blocks-table-container">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-base">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="py-4 px-6 text-left font-bold text-slate-600 w-1/6">Height</th>
                        <th className="py-4 px-6 text-left font-bold text-slate-600 w-1/6">Timestamp</th>
                        <th className="py-4 px-6 text-left font-bold text-slate-600 w-1/12">Transactions</th>
                        <th className="py-4 px-6 text-left font-bold text-slate-600 w-1/6">Size</th>
                        <th className="py-4 px-6 text-center font-bold text-slate-600 w-1/5">Mining Pool</th>
                        <th className="py-4 px-6 text-left font-bold text-slate-600 w-1/4">Hash</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {blocks.map((block, i) => (
                        <tr
                          key={block.hash}
                          className={
                            (i % 2 === 1 ? 'bg-slate-50 ' : '') +
                            'hover:bg-slate-200 cursor-pointer transition-colors duration-100'
                          }
                          onClick={() => window.location.assign(`/blocks/${block.hash}`)}
                        >
                          <td className="py-3 px-6 font-semibold">
                            <Link to={`/blocks/${block.hash}`} className="flex items-center text-bitcoinz-600 hover:underline" onClick={e => e.stopPropagation()}>
                              <FaCube className="mr-2" />
                              {formatNumber(block.height)}
                            </Link>
                          </td>
                          <td className="py-3 px-6">
                            <div className="flex items-center text-sm text-gray-500">
                              <FaClock className="mr-1" />
                              <span title={formatTimestamp(block.time)}>
                                {formatRelativeTime(block.time)}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-6">{formatNumber(block.tx.length)}</td>
                          <td className="py-3 px-6">{formatNumber(block.size)} bytes</td>
                          <td className="py-3 px-6 text-center">
                            {block.miningPoolName || block.poolName || block.pool || 'Unknown Pool'}
                          </td>
                          <td className="py-3 px-6 font-mono text-xs">
                            <Link to={`/blocks/${block.hash}`} className="text-bitcoinz-600 hover:underline" onClick={e => e.stopPropagation()}>
                              {block.hash.substring(0, 10)}...{block.hash.substring(block.hash.length - 10)}
                            </Link>
                          </td>
                        </tr>
                      ))}
                      {/* Filler rows to ensure at least 40 lines visually */}
                      {Array.from({ length: Math.max(0, 40 - blocks.length) }).map((_, i) => (
                        <tr key={"filler-" + i} className={((blocks.length + i) % 2 === 1) ? 'bg-slate-50' : ''}>
                          <td className="py-3 px-6">&nbsp;</td>
                          <td className="py-3 px-6">&nbsp;</td>
                          <td className="py-3 px-6">&nbsp;</td>
                          <td className="py-3 px-6">&nbsp;</td>
                          <td className="py-3 px-6">&nbsp;</td>
                          <td className="py-3 px-6">&nbsp;</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {/* Pagination */}
              <div className="flex justify-center pb-36">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlockList;

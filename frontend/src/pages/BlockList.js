import React, { useState, useEffect, useContext, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaCube, FaClock, FaLayerGroup } from 'react-icons/fa';
import axios from 'axios'; // Import axios for CancelToken

// Components
import Spinner from '../components/Spinner';
import BlockCard from '../components/BlockCard';
import Pagination from '../components/Pagination';

// Contexts
import { SocketContext } from '../contexts/SocketContext';
import { ToastContext } from '../contexts/ToastContext';

// Services
import { blockService, statsService, transactionService } from '../services/api'; // Added transactionService
import apiInstance from '../services/api';

// Utils
import { formatNumber, formatTimestamp, formatRelativeTime } from '../utils/formatting';

const BLOCKS_PER_PAGE = 50;
const LOADING_POOL_NAME_PLACEHOLDER = 'LOADING_POOL_NAME_PLACEHOLDER';

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

// Optimized getBlockPoolNames with parallel fetching and cancellation
const getBlockPoolNames = async (blocks, cancelToken) => {
  const blockDetailPromises = blocks.map(block => {
    if (block.miningPoolName) return Promise.resolve(block); // Already has pool name

    // Use blockService and transactionService which accept cancelToken
    return blockService.getBlockByHash(block.hash, { cancelToken })
      .then(blockDetailResponse => {
        if (!blockDetailResponse.data || !blockDetailResponse.data.tx || blockDetailResponse.data.tx.length === 0) {
          return { ...block, miningPoolName: 'Unknown (No TX)' };
        }
        const coinbaseTxid = blockDetailResponse.data.tx[0];
        return transactionService.getTransaction(coinbaseTxid, { cancelToken })
          .then(txDetailResponse => {
            if (!txDetailResponse.data || !txDetailResponse.data.vin || txDetailResponse.data.vin.length === 0) {
              return { ...block, miningPoolName: 'Unknown (No VIN)' };
            }
            const coinbaseVin = txDetailResponse.data.vin[0];
            const poolName = extractPoolName(coinbaseVin.coinbase, txDetailResponse.data);
            return { ...block, miningPoolName: poolName || 'Unknown Pool' };
          });
      })
      .catch(error => {
        if (axios.isCancel(error)) {
          // Don't log cancellation as an error, it's expected
        } else {
          console.error(`Error fetching pool name for block ${block.hash}:`, error);
        }
        return { ...block, miningPoolName: 'Unknown (Error)' }; // Fallback
      });
  });
  return Promise.all(blockDetailPromises);
};

const BlockList = () => {
  const [loading, setLoading] = useState(true);
  const [blocks, setBlocks] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalBlocks, setTotalBlocks] = useState(0);
  const [animateDigits, setAnimateDigits] = useState(false);
  const prevTotalRef = useRef(0);
  const isMountedRef = useRef(true); // To prevent state updates on unmounted component
  
  const socket = useContext(SocketContext);
  const { showToast } = useContext(ToastContext);
  const navigate = useNavigate();
  
  const totalPages = Math.ceil(totalBlocks / BLOCKS_PER_PAGE);
  
  // Effect for fetching blocks when component mounts or currentPage changes
  useEffect(() => {
    isMountedRef.current = true;
    const cancelTokenSource = axios.CancelToken.source();

    const fetchAndSetPoolNamesForBlocks = async (blocksData, token) => {
      try {
        const blocksWithPools = await getBlockPoolNames(blocksData, token);
        if (isMountedRef.current) {
          setBlocks(currentSetBlocks => {
            const poolDataMap = new Map(blocksWithPools.map(b => [b.hash, b.miningPoolName]));
            return currentSetBlocks.map(csb => 
              poolDataMap.has(csb.hash) 
                ? { ...csb, miningPoolName: poolDataMap.get(csb.hash) } 
                : csb
            );
          });
        }
      } catch (error) {
        if (axios.isCancel(error)) {
          console.log('Pool name fetching for list cancelled.');
        } else if (isMountedRef.current) {
          console.error('Error fetching and setting pool names:', error);
          // Optionally update blocks to show an error state for pool names
        }
      }
    };

    const fetchBlocksForPage = async (pageToFetch) => {
      try {
        if (!isMountedRef.current) return;
        setLoading(true); // For the initial list structure
        
        const infoResponse = await statsService.getBlockchainInfo({ cancelToken: cancelTokenSource.token });
        if (!isMountedRef.current) return;
        const latestBlockHeight = infoResponse.data.blocks;
        setTotalBlocks(latestBlockHeight + 1);
        
        const offset = (pageToFetch - 1) * BLOCKS_PER_PAGE;
        const listResponse = await blockService.getLatestBlocks(BLOCKS_PER_PAGE, offset, { cancelToken: cancelTokenSource.token });
        if (!isMountedRef.current) return;
        
        const initialBlocksWithPlaceholders = listResponse.data.blocks.map(b => ({
          ...b,
          miningPoolName: LOADING_POOL_NAME_PLACEHOLDER
        }));
        setBlocks(initialBlocksWithPlaceholders);
        setLoading(false); // Initial list structure is loaded

        if (isMountedRef.current && listResponse.data.blocks.length > 0) {
          fetchAndSetPoolNamesForBlocks(listResponse.data.blocks, cancelTokenSource.token);
        }
        
      } catch (error) {
        if (axios.isCancel(error)) {
          console.log('Initial block list fetch cancelled');
        } else if (isMountedRef.current) {
          console.error('Error fetching initial blocks:', error);
          showToast('Failed to fetch blocks', 'error');
          setLoading(false); 
        }
      }
    };
    
    fetchBlocksForPage(currentPage);

    return () => {
      isMountedRef.current = false;
      cancelTokenSource.cancel('BlockList component unmounted or currentPage changed.');
    };
  }, [currentPage, showToast]); // Re-run when currentPage changes
  
  // Listen for new blocks via WebSocket
  useEffect(() => {
    if (!socket) return; // No isMountedRef check here as it's for the lifetime of the listener setup

    const newBlockHandler = async (newBlockData) => {
      // Check mounted status inside the handler before async operations or state updates
      if (!isMountedRef.current) return;

      if (currentPage === 1) { // Only update if on the first page
        const newBlockCancelTokenSource = axios.CancelToken.source();
        try {
          // Fetch details for the new block to get pool name
          const blockDetail = await blockService.getBlockByHash(newBlockData.hash, { cancelToken: newBlockCancelTokenSource.token });
          if (!isMountedRef.current) return;

          const coinbaseTxid = blockDetail.data.tx[0];
          const txDetail = await transactionService.getTransaction(coinbaseTxid, { cancelToken: newBlockCancelTokenSource.token });
          if (!isMountedRef.current) return;

          const coinbaseVin = txDetail.data.vin[0];
          const poolName = extractPoolName(coinbaseVin.coinbase, txDetail.data);
          
          const blockWithPool = { ...newBlockData, miningPoolName: poolName || 'Unknown Pool' };
          
          if (isMountedRef.current) {
            setBlocks(prevBlocks => {
              if (prevBlocks.some(b => b.hash === blockWithPool.hash)) return prevBlocks;
              return [blockWithPool, ...prevBlocks.slice(0, BLOCKS_PER_PAGE - 1)];
            });
            setTotalBlocks(prev => prev + 1); // Increment total blocks
          }
        } catch (error) {
          if (axios.isCancel(error)) {
            console.log('New block processing cancelled.');
          } else if (isMountedRef.current) {
            console.error('Error processing new block from socket:', error);
            // Add block with unknown pool as fallback
            const blockWithUnknownPool = { ...newBlockData, miningPoolName: 'Unknown Pool' };
            setBlocks(prevBlocks => {
              if (prevBlocks.some(b => b.hash === blockWithUnknownPool.hash)) return prevBlocks;
              return [blockWithUnknownPool, ...prevBlocks.slice(0, BLOCKS_PER_PAGE - 1)];
            });
            setTotalBlocks(prev => prev + 1);
          }
        }
      }
      if (isMountedRef.current) { // Check again before showing toast
        showToast(`New block #${newBlockData.height} mined`, 'info');
      }
    };

    socket.on('new_block', newBlockHandler);
    
    return () => {
      socket.off('new_block', newBlockHandler);
      // isMountedRef will be false here if component unmounted,
      // so newBlockHandler won't run or will bail early.
    };
  }, [socket, currentPage, showToast]); // Add currentPage to dependencies
  
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
    setCurrentPage(page); // This will trigger the useEffect for fetching blocks
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  return (
    <div className="flex flex-col min-h-screen">
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
              {/* Mobile-optimized Block List with blue shadow effect */}
              <div className="rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-10 min-h-[600px] bg-white bg-opacity-90 blue-shadow-effect blocks-table-container">
                {/* Desktop version - hidden on mobile */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full text-base">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="py-2 px-4 text-left font-bold text-slate-700 w-1/6">Height</th>
                        <th className="py-2 px-4 text-left font-bold text-slate-700 w-1/6">Timestamp</th>
                        <th className="py-2 px-4 text-left font-bold text-slate-700 w-1/12">Transactions</th>
                        <th className="py-2 px-4 text-left font-bold text-slate-700 w-1/6">Size</th>
                        <th className="py-2 px-4 text-center font-bold text-slate-700 w-1/5">Mining Pool</th>
                        <th className="py-2 px-4 text-left font-bold text-slate-700 w-1/4">Hash</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {blocks.map((block, i) => (
                        <tr
                          key={block.hash}
                          className={
                            (i % 2 === 1 ? 'bg-slate-50' : '') +
                            ' hover:bg-blue-200 hover:bg-opacity-50 hover:shadow-inner cursor-pointer transition-all duration-200'
                          }
                          onClick={() => navigate(`/blocks/${block.hash}`)}
                        >
                          <td className="py-1.5 px-4 font-semibold">
                            <Link to={`/blocks/${block.hash}`} className="flex items-center text-bitcoinz-600 hover:underline" onClick={e => e.stopPropagation()}>
                              <FaCube className="mr-1" size={14} />
                              {formatNumber(block.height)}
                            </Link>
                          </td>
                          <td className="py-1.5 px-4">
                            <div className="flex items-center text-sm text-gray-700">
                              <FaClock className="mr-1" size={12} />
                              <span title={formatTimestamp(block.time)}>
                                {formatRelativeTime(block.time)}
                              </span>
                            </div>
                          </td>
                          <td className="py-1.5 px-4">{formatNumber(block.tx.length)}</td>
                          <td className="py-1.5 px-4">{formatNumber(block.size)} bytes</td>
                          <td className="py-1.5 px-4 text-center">
                            {block.miningPoolName === LOADING_POOL_NAME_PLACEHOLDER
                              ? <span className="text-xs italic text-gray-500">Loading...</span>
                              : (block.miningPoolName || block.poolName || block.pool || 'Unknown Pool')}
                          </td>
                          <td className="py-1.5 px-4 font-mono text-xs">
                            <Link to={`/blocks/${block.hash}`} className="text-bitcoinz-600 hover:underline" onClick={e => e.stopPropagation()}>
                              {block.hash.substring(0, 10)}...{block.hash.substring(block.hash.length - 10)}
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Mobile-optimized version - shown only on mobile */}
                <div className="block md:hidden mobile-blocks-table">
                  <div className="mobile-blocks-header">
                    <div>Height</div>
                    <div>Timestamp</div>
                    <div className="text-center">Txs</div>
                  </div>
                  <div className="divide-y divide-slate-100 bg-white">
                    {blocks.map((block, i) => (
                      <Link 
                        to={`/blocks/${block.hash}`} 
                        key={block.hash}
                        className={`block ${i % 2 === 1 ? 'bg-slate-50' : ''} hover:bg-blue-200 hover:bg-opacity-50 hover:shadow-inner transition-all duration-200`}
                      >
                        <div className="mobile-blocks-row items-center py-1.5 px-2">
                          <div className="font-semibold text-bitcoinz-600 flex items-center">
                            <FaCube className="mr-1 flex-shrink-0" size={10} />
                            <span className="truncate">{formatNumber(block.height)}</span>
                          </div>
                          <div className="text-xs text-gray-700 flex items-center">
                            <FaClock className="mr-1 flex-shrink-0" size={8} />
                            <span className="truncate">
                              {formatRelativeTime(block.time)}
                            </span>
                          </div>
                          <div className="text-center">{formatNumber(block.tx.length)}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
              {/* Pagination */}
              <div className="flex justify-center pb-12 sm:pb-36">
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

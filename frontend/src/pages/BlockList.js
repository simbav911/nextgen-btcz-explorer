import React, { useState, useEffect, useContext } from 'react';
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

// Utils
import { formatNumber, formatTimestamp, formatRelativeTime } from '../utils/formatting';

const BLOCKS_PER_PAGE = 10;

const BlockList = () => {
  const [loading, setLoading] = useState(true);
  const [blocks, setBlocks] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalBlocks, setTotalBlocks] = useState(0);
  
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
      
      setBlocks(response.data.blocks);
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
    
    socket.on('new_block', (block) => {
      // Only update if we're on the first page
      if (currentPage === 1) {
        setBlocks(prevBlocks => {
          // Add block to beginning and remove last block
          const newBlocks = [block, ...prevBlocks.slice(0, -1)];
          return newBlocks;
        });
        
        // Update total block count
        setTotalBlocks(prev => prev + 1);
      }
      
      showToast(`New block #${block.height} mined`, 'info');
    });
    
    return () => {
      socket.off('new_block');
    };
  }, [socket, currentPage, showToast]);
  
  // Handle page change
  const handlePageChange = (page) => {
    fetchBlocks(page);
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold flex items-center">
          <FaLayerGroup className="text-bitcoinz-600 mr-3" />
          Blocks
        </h1>
        
        <div className="text-gray-600">
          Total Blocks: {formatNumber(totalBlocks)}
        </div>
      </div>
      
      {loading ? (
        <Spinner message="Loading blocks..." />
      ) : (
        <>
          {/* Block List */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table">
                <thead className="bg-gray-50">
                  <tr>
                    <th>Height</th>
                    <th>Timestamp</th>
                    <th>Transactions</th>
                    <th>Size</th>
                    <th>Weight</th>
                    <th>Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {blocks.map(block => (
                    <tr key={block.hash} className="hover:bg-gray-50">
                      <td className="font-medium">
                        <Link to={`/blocks/${block.hash}`} className="flex items-center text-bitcoinz-600 hover:underline">
                          <FaCube className="mr-2" />
                          {formatNumber(block.height)}
                        </Link>
                      </td>
                      <td>
                        <div className="flex items-center text-sm text-gray-500">
                          <FaClock className="mr-1" />
                          <span title={formatTimestamp(block.time)}>
                            {formatRelativeTime(block.time)}
                          </span>
                        </div>
                      </td>
                      <td>{formatNumber(block.tx.length)}</td>
                      <td>{formatNumber(block.size)} bytes</td>
                      <td>{block.weight ? formatNumber(block.weight) : 'N/A'}</td>
                      <td className="font-mono text-xs">
                        <Link to={`/blocks/${block.hash}`} className="text-bitcoinz-600 hover:underline">
                          {block.hash.substring(0, 10)}...{block.hash.substring(block.hash.length - 10)}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </>
      )}
    </div>
  );
};

export default BlockList;

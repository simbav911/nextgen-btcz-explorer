import React, { useRef, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { getChartColors, formatDisplayDate, isToday } from './chartUtils';
import './horizontalBar.css';

/**
 * HorizontalBarChart component for displaying mined blocks by pool
 */
const HorizontalBarChart = ({ chartData }) => {
  const containerRef = useRef(null);
  const [hoveredPool, setHoveredPool] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [showAddressList, setShowAddressList] = useState(true); // Default to showing addresses
  const { poolColors } = getChartColors();
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const poolsPerPage = 15; // Show 15 pools per page
  
  if (!chartData || !chartData.data || chartData.data.length === 0) {
    return (
      <div className="chart-placeholder">
        <p>No mined blocks data available</p>
      </div>
    );
  }

  // Format pool name to handle long addresses
  const formatPoolName = (name) => {
    if (name.startsWith('Unknown (t1') || name.startsWith('Unknown (t3')) {
      // Extract the address from the name
      const addressMatch = name.match(/\((t[13][a-zA-Z0-9]{33})\)/);
      if (addressMatch && addressMatch[1]) {
        const address = addressMatch[1];
        // Truncate the address to first 8 chars + ... + last 4 chars
        const truncatedAddress = `${address.substring(0, 8)}...${address.substring(address.length - 4)}`;
        return `Unknown (${truncatedAddress})`;
      }
    }
    return name;
  };

  // Extract address from pool name
  const extractAddress = (name) => {
    const addressMatch = name.match(/\((t[13][a-zA-Z0-9]{33})\)/);
    if (addressMatch && addressMatch[1]) {
      return addressMatch[1];
    }
    return null;
  };

  // Process data to group blocks by pool
  const processData = () => {
    // Enhanced data processing to handle the filtering issue
    const poolCounts = {};
    const poolBlocks = {};
    const poolFullNames = {}; // Store full names for tooltip display
    const unknownAddresses = []; // Store unknown addresses
    let totalUnknownCount = 0;
    
    // Validation to ensure we have valid data
    if (!chartData.data || !Array.isArray(chartData.data)) {
      console.error("Invalid chart data structure:", chartData);
      return { 
        poolData: [], 
        unknownAddresses: [], 
        totalUnknownCount: 0 
      };
    }
    
    // Count blocks by pool with enhanced validation
    chartData.data.forEach(block => {
      if (!block) return; // Skip invalid blocks
      
      // Default to 'Unknown' if pool name is missing
      const poolName = (block.pool && typeof block.pool === 'string') 
        ? block.pool 
        : 'Unknown';
      
      // Check if this is an unknown pool with address
      if (poolName.startsWith('Unknown (t1') || poolName.startsWith('Unknown (t3')) {
        const address = extractAddress(poolName);
        if (address) {
          // Add to unknown addresses list if not already there
          const existingAddress = unknownAddresses.find(a => a.address === address);
          if (existingAddress) {
            existingAddress.count++;
          } else {
            unknownAddresses.push({
              address,
              count: 1,
              fullName: poolName
            });
          }
          
          // Count under general "Unknown" category
          poolCounts['Unknown'] = (poolCounts['Unknown'] || 0) + 1;
          totalUnknownCount++;
          
          // Store block heights for Unknown
          if (!poolBlocks['Unknown']) {
            poolBlocks['Unknown'] = [];
          }
          if (block.blockHeight) {
            poolBlocks['Unknown'].push(block.blockHeight);
          }
          
          // Store full name
          poolFullNames['Unknown'] = 'Unknown (Solo Miners)';
        } else {
          // Regular pool counting if address extraction failed
          poolCounts[poolName] = (poolCounts[poolName] || 0) + 1;
          poolFullNames[poolName] = poolName;
          
          if (!poolBlocks[poolName]) {
            poolBlocks[poolName] = [];
          }
          if (block.blockHeight) {
            poolBlocks[poolName].push(block.blockHeight);
          }
        }
      } else {
        // Regular pool counting
        poolCounts[poolName] = (poolCounts[poolName] || 0) + 1;
        poolFullNames[poolName] = poolName;
        
        if (!poolBlocks[poolName]) {
          poolBlocks[poolName] = [];
        }
        if (block.blockHeight) {
          poolBlocks[poolName].push(block.blockHeight);
        }
      }
    });
    
    // Sort unknown addresses by count (descending)
    unknownAddresses.sort((a, b) => b.count - a.count);
    
    // Convert to array and sort by count (descending)
    const poolData = Object.entries(poolCounts).map(([name, count]) => ({
      name,
      displayName: name === 'Unknown' ? 'Unknown (Solo Miners)' : name,
      fullName: poolFullNames[name],
      count,
      blocks: poolBlocks[name],
      isUnknown: name === 'Unknown'
    }));
    
    poolData.sort((a, b) => b.count - a.count);
    
    return { poolData, unknownAddresses, totalUnknownCount };
  };

  const { poolData, unknownAddresses, totalUnknownCount } = processData();
  const totalBlocks = chartData.data.length;
  
  // Calculate total pages
  const totalPages = Math.ceil(poolData.length / poolsPerPage);
  
  // Get current page of pools
  const indexOfLastPool = currentPage * poolsPerPage;
  const indexOfFirstPool = indexOfLastPool - poolsPerPage;
  const currentPools = poolData.slice(indexOfFirstPool, indexOfLastPool);
  
  // Change page
  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  const nextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const prevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
  
  // Calculate bar widths as percentages
  const calculateBarWidth = (count) => {
    return (count / totalBlocks) * 100;
  };

  // Handle mouse over for tooltip
  const handleMouseOver = (pool, event) => {
    setHoveredPool(pool);
    setTooltipPosition({ 
      x: event.clientX, 
      y: event.clientY 
    });
  };

  // Handle mouse out to hide tooltip
  const handleMouseOut = () => {
    setHoveredPool(null);
  };

  // Toggle address list visibility
  const toggleAddressList = () => {
    setShowAddressList(!showAddressList);
  };

  // DIRECT DATE IMPLEMENTATION WITH TODAY BUTTON FIX
  // Direct access to the raw date string from chart data
  const rawDateString = chartData.date; 
  console.log(` RAW DATE STRING FROM PROPS: ${rawDateString}`);
  
  // Get today's date string for comparison
  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  // Check if there's a stored date in localStorage
  let storedDate;
  try {
    storedDate = localStorage.getItem('minedBlocks_selectedDate');
    console.log(` STORED DATE FROM LOCALSTORAGE: ${storedDate}`);
  } catch (e) {
    console.error("Error accessing localStorage:", e);
  }
  
  // TODAY BUTTON FIX: If the raw date is today's date, use it directly
  // Otherwise, prefer localStorage if available
  let exactRequestedDate;
  
  if (rawDateString === todayString) {
    // User clicked Today button - always show today's date
    exactRequestedDate = todayString;
    console.log(" TODAY BUTTON USED - showing today's date:", todayString);
  } else {
    // For custom dates, use localStorage or fall back to props date
    exactRequestedDate = storedDate || rawDateString || todayString;
  }
  
  console.log(` FINAL DATE USED FOR DISPLAY: ${exactRequestedDate}`);
  
  // Basic direct string formatting without any Date objects
  let dateDisplay;
  try {
    // Parse the date string directly
    const parts = exactRequestedDate.split('-');
    const year = parts[0];
    const month = parseInt(parts[1]) - 1; // JS months are 0-based
    const day = parseInt(parts[2]);
    
    // Get month name
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Format as "Apr 10, 2025" without timezone conversion
    dateDisplay = `${monthNames[month]} ${day}, ${year}`;
    
    console.log(` FORMATTED FOR DISPLAY: ${dateDisplay}`);
  } catch (e) {
    console.error("Error formatting date:", e);
    dateDisplay = exactRequestedDate; // Fallback to raw date if parsing fails
  }
  
  // Use the already defined today string for comparison
  const isTodayData = exactRequestedDate === todayString;

  return (
    <div className="horizontal-bar-chart-container" ref={containerRef}>
      {/* Date badge in top-left corner */}
      <div className="chart-date-badge">
        <span className="date-pill">
          {dateDisplay}
        </span>
      </div>
      
      {/* Pagination controls - only show if we have multiple pages */}
      {totalPages > 1 && (
        <div className="pagination-controls">
          <button 
            className="pagination-button" 
            onClick={prevPage} 
            disabled={currentPage === 1}
          >
            &laquo; Previous
          </button>
          <div className="pagination-info">
            Page {currentPage} of {totalPages} ({poolData.length} pools)
          </div>
          <button 
            className="pagination-button" 
            onClick={nextPage} 
            disabled={currentPage === totalPages}
          >
            Next &raquo;
          </button>
        </div>
      )}
      
      <div className="horizontal-bar-chart">
        <div className="horizontal-bars">
          {currentPools.map((pool, index) => (
            <div 
              key={pool.name} 
              className="bar-container"
              onMouseOver={(e) => handleMouseOver(pool, e)}
              onMouseOut={handleMouseOut}
              onClick={pool.isUnknown ? toggleAddressList : undefined}
              style={{ cursor: pool.isUnknown ? 'pointer' : 'default' }}
            >
              <div 
                className="bar" 
                style={{ 
                  width: `${calculateBarWidth(pool.count)}%`,
                  backgroundColor: poolColors[(indexOfFirstPool + index) % poolColors.length]
                }}
              />
            </div>
          ))}
        </div>
        
        <div className="bar-labels">
          {currentPools.map((pool, index) => (
            <div 
              key={`label-${pool.name}`} 
              className={`bar-label ${pool.isUnknown ? 'unknown-pool' : ''}`}
              onClick={pool.isUnknown ? toggleAddressList : undefined}
            >
              <span 
                className="color-indicator" 
                style={{ backgroundColor: poolColors[(indexOfFirstPool + index) % poolColors.length] }}
              />
              <span className="pool-name" title={pool.fullName}>
                {pool.displayName}
                {pool.isUnknown && (
                  <span className="toggle-addresses">
                    {showAddressList ? ' (hide addresses)' : ' (show addresses)'}
                  </span>
                )}
              </span>
              <span className="block-count">{pool.count}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Pagination controls at bottom - only show if we have multiple pages */}
      {totalPages > 1 && (
        <div className="pagination-controls">
          <button 
            className="pagination-button" 
            onClick={prevPage} 
            disabled={currentPage === 1}
          >
            &laquo; Previous
          </button>
          <div className="pagination-info">
            Page {currentPage} of {totalPages}
          </div>
          <button 
            className="pagination-button" 
            onClick={nextPage} 
            disabled={currentPage === totalPages}
          >
            Next &raquo;
          </button>
        </div>
      )}
      
      {/* Unknown addresses list */}
      {showAddressList && unknownAddresses.length > 0 && (
        <div className="unknown-addresses-list">
          <div className="addresses-header">
            <h3>Unknown Solo Miners ({unknownAddresses.length} addresses)</h3>
            <button className="close-button" onClick={toggleAddressList}>×</button>
          </div>
          <div className="addresses-content">
            {unknownAddresses.map((item, index) => (
              <div key={`addr-${item.address}`} className="address-item">
                <span 
                  className="address-color" 
                  style={{ backgroundColor: poolColors[(poolData.length + index) % poolColors.length] }}
                />
                <span className="address-text">{item.address}</span>
                <span className="address-count">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* X-axis with ruler style */}
      <div className="x-axis-ruler">
        <div className="ruler-container">
          <div className="ruler-line"></div>
          {[0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600].map(tick => (
            <div 
              key={`tick-${tick}`} 
              className="ruler-tick" 
              style={{ left: `${(tick / 600) * 100}%` }}
            >
              <div className="tick-mark"></div>
              <div className="tick-label">{tick}</div>
            </div>
          ))}
        </div>
        <div className="ruler-label">Block count</div>
      </div>
      
      {/* Tooltip */}
      {hoveredPool && (
        <div 
          className="tooltip" 
          style={{ 
            left: `${tooltipPosition.x + 10}px`, 
            top: `${tooltipPosition.y - 40}px` 
          }}
        >
          <div className="tooltip-title">Mined by</div>
          <div className="tooltip-content">
            <span 
              className="tooltip-color" 
              style={{ 
                backgroundColor: poolColors[poolData.findIndex(p => p.name === hoveredPool.name) % poolColors.length] 
              }}
            />
            <span className="tooltip-pool">
              {hoveredPool.isUnknown 
                ? `Unknown (Solo Miners) - ${totalUnknownCount} blocks from ${unknownAddresses.length} addresses` 
                : hoveredPool.fullName}
            </span>
            <span className="tooltip-count">{hoveredPool.count}</span>
          </div>
          {hoveredPool.isUnknown && (
            <div className="tooltip-action">Click to {showAddressList ? 'hide' : 'show'} address list</div>
          )}
        </div>
      )}
    </div>
  );
};

HorizontalBarChart.propTypes = {
  chartData: PropTypes.object
};

export default HorizontalBarChart;

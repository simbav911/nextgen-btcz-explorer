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
    const poolCounts = {};
    const poolBlocks = {};
    const poolFullNames = {}; // Store full names for tooltip display
    const unknownAddresses = []; // Store unknown addresses
    let totalUnknownCount = 0;
    
    // Count blocks by pool
    chartData.data.forEach(block => {
      const poolName = block.pool || 'Unknown';
      
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
          poolBlocks['Unknown'].push(block.blockHeight);
          
          // Store full name
          poolFullNames['Unknown'] = 'Unknown (Solo Miners)';
        } else {
          // Regular pool counting if address extraction failed
          poolCounts[poolName] = (poolCounts[poolName] || 0) + 1;
          poolFullNames[poolName] = poolName;
          
          if (!poolBlocks[poolName]) {
            poolBlocks[poolName] = [];
          }
          poolBlocks[poolName].push(block.blockHeight);
        }
      } else {
        // Regular pool counting
        poolCounts[poolName] = (poolCounts[poolName] || 0) + 1;
        poolFullNames[poolName] = poolName;
        
        if (!poolBlocks[poolName]) {
          poolBlocks[poolName] = [];
        }
        poolBlocks[poolName].push(block.blockHeight);
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

  // ULTRA DIRECT DATE IMPLEMENTATION - No date transformations at all
  // Direct access to the raw date string from chart data - no formatDate call
  const rawDateString = chartData.date; 
  
  // Log the raw date string directly from the props
  console.log(`🔥 RAW DATE STRING FROM PROPS: ${rawDateString}`);
  
  // Check localStorage for the most accurate date
  let storedDate;
  try {
    storedDate = localStorage.getItem('minedBlocks_selectedDate');
    console.log(`🔥 STORED DATE FROM LOCALSTORAGE: ${storedDate}`);
  } catch (e) {
    console.error("Error accessing localStorage:", e);
  }
  
  // CRITICAL: Use stored date from localStorage if available
  // This is our source of truth for the date
  const exactRequestedDate = storedDate || rawDateString || new Date().toISOString().split('T')[0];
  console.log(`🔥 FINAL DATE USED FOR DISPLAY: ${exactRequestedDate}`);
  
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
    
    console.log(`🔥 FORMATTED FOR DISPLAY: ${dateDisplay}`);
  } catch (e) {
    console.error("Error formatting date:", e);
    dateDisplay = exactRequestedDate; // Fallback to raw date if parsing fails
  }
  
  // Simple string comparison for today check
  const now = new Date();
  const todayString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const isTodayData = exactRequestedDate === todayString;

  return (
    <div className="horizontal-bar-chart-container" ref={containerRef}>
      {/* Date badge in top-left corner */}
      <div className="chart-date-badge">
        <span className="date-pill">
          {dateDisplay}
        </span>
      </div>
      
      <div className="horizontal-bar-chart">
        <div className="horizontal-bars">
          {poolData.map((pool, index) => (
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
                  backgroundColor: poolColors[index % poolColors.length]
                }}
              />
            </div>
          ))}
        </div>
        
        <div className="bar-labels">
          {poolData.map((pool, index) => (
            <div 
              key={`label-${pool.name}`} 
              className={`bar-label ${pool.isUnknown ? 'unknown-pool' : ''}`}
              onClick={pool.isUnknown ? toggleAddressList : undefined}
            >
              <span 
                className="color-indicator" 
                style={{ backgroundColor: poolColors[index % poolColors.length] }}
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

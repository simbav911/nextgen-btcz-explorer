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
  const { poolColors } = getChartColors();

  if (!chartData || !chartData.data || chartData.data.length === 0) {
    return (
      <div className="chart-placeholder">
        <p>No mined blocks data available</p>
      </div>
    );
  }

  // Process data to group blocks by pool
  const processData = () => {
    const poolCounts = {};
    const poolBlocks = {};
    
    // Count blocks by pool
    chartData.data.forEach(block => {
      const poolName = block.pool || 'Unknown';
      poolCounts[poolName] = (poolCounts[poolName] || 0) + 1;
      
      // Store block heights for each pool
      if (!poolBlocks[poolName]) {
        poolBlocks[poolName] = [];
      }
      poolBlocks[poolName].push(block.blockHeight);
    });
    
    // Convert to array and sort by count (descending)
    const poolData = Object.entries(poolCounts).map(([name, count]) => ({
      name,
      count,
      blocks: poolBlocks[name]
    }));
    
    poolData.sort((a, b) => b.count - a.count);
    
    return poolData;
  };

  const poolData = processData();
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

  // Check if the data is for today
  const dataDate = chartData.date ? new Date(chartData.date) : new Date();
  const isTodayData = isToday(dataDate);
  const dateDisplay = formatDisplayDate(dataDate);

  return (
    <div className="horizontal-bar-chart-container" ref={containerRef}>
      {/* Add date indicator */}
      <div className="chart-date-indicator">
        <span className={`date-badge ${isTodayData ? 'today' : ''}`}>
          {isTodayData ? 'Today' : dateDisplay}
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
            <div key={`label-${pool.name}`} className="bar-label">
              <span 
                className="color-indicator" 
                style={{ backgroundColor: poolColors[index % poolColors.length] }}
              />
              <span className="pool-name">{pool.name}</span>
              <span className="block-count">{pool.count}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* X-axis */}
      <div className="x-axis">
        <div className="tick-marks">
          {[0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600].map(tick => (
            <div key={`tick-${tick}`} className="tick">
              <div className="tick-line"></div>
              <div className="tick-label">{tick}</div>
            </div>
          ))}
        </div>
        <div className="axis-label">Block count</div>
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
            <span className="tooltip-pool">{hoveredPool.name}</span>
            <span className="tooltip-count">{hoveredPool.count}</span>
          </div>
        </div>
      )}
    </div>
  );
};

HorizontalBarChart.propTypes = {
  chartData: PropTypes.object
};

export default HorizontalBarChart;

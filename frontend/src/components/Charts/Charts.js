import React, { useState, useEffect, useCallback } from 'react';
import { chartService } from '../../services/apiService';
import ChartSidebar from './ChartSidebar';
import TimeFilter from './TimeFilter';
import ChartContainer from './ChartContainer';
import { chartTypes, getChartTitle, formatDate, getDaysFromRange } from './chartUtils';
import { removeUnwantedText } from '../../utils/removeText';
import './Charts.css';

/**
 * Main Charts component that orchestrates all chart functionality
 */
const Charts = () => {
  const [activeChart, setActiveChart] = useState(chartTypes.BLOCK_SIZE);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(formatDate(new Date())); // Today's date by default
  const [timeRange, setTimeRange] = useState('1d'); // Default to 1 day (today) instead of 30d
  const [error, setError] = useState(null);

  // Generate mock data for when API fails (keeping this for non-pool charts only)
  const generateMockData = (chartType) => {
    const days = getDaysFromRange(timeRange);
    
    switch (chartType) {
      case chartTypes.BLOCK_SIZE:
        return {
          date: date,
          days: days,
          chartType: 'block-size',
          data: Array(days).fill(0).map((_, i) => ({
            blockHeight: 1545720 - i * 10,
            blockSize: Math.floor(Math.random() * 3000) + 500,
            timestamp: new Date(Date.now() - (i * 86400000)).toISOString()
          })).reverse()
        };
        
      case chartTypes.BLOCK_INTERVAL:
        return {
          date: date,
          days: days,
          chartType: 'block-interval',
          data: Array(days).fill(0).map((_, i) => ({
            blockHeight: 1545720 - i * 10,
            interval: Math.floor(Math.random() * 840) + 60,
            timestamp: new Date(Date.now() - (i * 86400000)).toISOString()
          })).reverse()
        };
        
      case chartTypes.DIFFICULTY:
        return {
          date: date,
          days: days,
          chartType: 'difficulty',
          data: Array(days).fill(0).map((_, i) => ({
            blockHeight: 1545720 - i * 10,
            difficulty: parseFloat((700 - i * 0.5 + (Math.random() * 20 - 10)).toFixed(2)),
            timestamp: new Date(Date.now() - (i * 86400000)).toISOString()
          })).reverse()
        };
        
      case chartTypes.MINING_REVENUE:
        return {
          date: date,
          days: days,
          chartType: 'mining-revenue',
          data: Array(days).fill(0).map((_, i) => ({
            blockHeight: 1545720 - i * 10,
            revenue: parseFloat((5 + Math.random() * 10).toFixed(4)),
            timestamp: new Date(Date.now() - (i * 86400000)).toISOString()
          })).reverse()
        };
        
      // Remove mock data for pool stats - must come from backend only
      case chartTypes.POOL_STAT:
      case chartTypes.MINED_BLOCK:
        return null;
        
      default:
        return null;
    }
  };

  // Fetch chart data based on active chart type and date
  const fetchChartData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Use the chart service with the correct chart type and parameters
      const days = getDaysFromRange(timeRange);
      const params = { days, date };
      
      let response;
      
      // Use specialized endpoints for pool distribution and mined blocks
      if (activeChart === chartTypes.POOL_STAT) {
        console.log('Using real pool stat endpoint for date:', date);
        response = await chartService.getRealPoolStat({ date });
      } else if (activeChart === chartTypes.MINED_BLOCK) {
        console.log('Using mined blocks endpoint for date:', date, 'days:', days);
        response = await chartService.getMinedBlocks({ date, days });
      } else {
        console.log(`Fetching ${activeChart} data for date: ${date}, days: ${days}`);
        response = await chartService.getChartData(activeChart, params);
      }
      
      console.log(`Received ${activeChart} chart data:`, response.data);
      setChartData(response.data);
    } catch (err) {
      console.error('Error fetching chart data:', err);
      
      // For the mined-block chart, show more detailed error info
      if (activeChart === chartTypes.MINED_BLOCK) {
        console.log('Detailed error info for mined-block:', err.response?.status, err.response?.data);
      }
      
      // Generate mock data when API fails, but not for pool stats
      if (activeChart !== chartTypes.POOL_STAT && activeChart !== chartTypes.MINED_BLOCK) {
        const mockData = generateMockData(activeChart);
        setChartData(mockData);
        
        // Show error message with fallback notice for non-pool charts
        setError(`Failed to load chart data from server (${err.message}). Showing sample data for demonstration purposes.`);
      } else {
        // For pool stats, don't use mock data and show a different error message
        setChartData(null);
        setError(`Failed to load mining pool data from the blockchain (${err.message}). Please try again later.`);
      }
    } finally {
      setLoading(false);
    }
  }, [activeChart, date, timeRange]);

  // Fetch data when active chart or date changes
  useEffect(() => {
    fetchChartData();
    
    // Call the cleanup function when the chart type is pool stat
    if (activeChart === chartTypes.POOL_STAT) {
      // removeUnwantedText(); // Commented out: Potential conflict with chart styles/rendering
    }
  }, [fetchChartData, activeChart]);

  // Handle chart type change
  const handleChartTypeChange = (chartType) => {
    setActiveChart(chartType);
    
    // When switching to Pool Stat or Mined Block, always reset to today's data
    if (chartType === chartTypes.POOL_STAT || chartType === chartTypes.MINED_BLOCK) {
      setDate(formatDate(new Date()));
      setTimeRange('1d'); // Default to today for these charts
    }
  };

  // Handle time filter change
  const handleTimeFilterChange = (newDate, newRange, dateRange) => {
    setDate(newDate);
    setTimeRange(newRange);
    
    // If we have a date range, we can use it for additional filtering or display
    if (dateRange && dateRange.startDate && dateRange.endDate) {
      console.log(`Date range selected: ${dateRange.startDate} to ${dateRange.endDate}`);
      // Here you could add additional logic for handling the date range
    }
  };

  return (
    <div className="charts-container">
      <ChartSidebar 
        activeChart={activeChart} 
        setActiveChart={handleChartTypeChange} 
      />
      
      <div className="chart-content">
        <div className="chart-header">
          <h1>{getChartTitle(activeChart)}</h1>
          
          <TimeFilter 
            date={date} 
            setDate={setDate} 
            applyFilter={handleTimeFilterChange} 
            showTodayDefault={activeChart === chartTypes.POOL_STAT || activeChart === chartTypes.MINED_BLOCK}
            activeChart={activeChart}
          />
        </div>
        
        <ChartContainer 
          chartData={chartData}
          activeChart={activeChart}
          loading={loading}
          error={error}
          retryFetch={fetchChartData}
        />
      </div>
    </div>
  );
};

export default Charts;
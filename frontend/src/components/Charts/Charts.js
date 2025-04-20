import React, { useState, useEffect, useCallback } from 'react';
import { chartService } from '../../services/apiService';
import ChartSidebar from './ChartSidebar';
import TimeFilter from './TimeFilter';
import ChartContainer from './ChartContainer';
import { chartTypes, getChartTitle, formatDate, getDaysFromRange } from './chartUtils';
import './Charts.css';

/**
 * Main Charts component that orchestrates all chart functionality
 */
const Charts = () => {
  const [activeChart, setActiveChart] = useState(chartTypes.BLOCK_SIZE);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(formatDate(new Date()));
  const [timeRange, setTimeRange] = useState('30d');
  const [error, setError] = useState(null);

  // Generate mock data for when API fails (keeping this from original)
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
        
      case chartTypes.POOL_STAT:
        return {
          date: date,
          chartType: 'pool-stat',
          data: [
            { name: 'Zpool', percentage: 31.8, count: 954 },
            { name: 'Zergpool', percentage: 49.0, count: 1470 },
            { name: 'Others', percentage: 11.1, count: 333 },
            { name: 'DarkFiberMines', percentage: 6.1, count: 183 },
            { name: '2Mars', percentage: 2.0, count: 60 }
          ]
        };
        
      case chartTypes.MINED_BLOCK:
        return {
          date: date,
          days: days,
          chartType: 'mined-block',
          data: Array(days * 10).fill(0).map((_, i) => ({
            blockHeight: 1545720 - i,
            pool: ['Zpool', 'Zergpool', 'Others', 'DarkFiberMines', '2Mars'][Math.floor(Math.random() * 5)],
            size: Math.floor(Math.random() * 3000) + 500,
            timestamp: new Date(Date.now() - (i * 8640000)).toISOString()
          })).reverse()
        };
        
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
      
      const response = await chartService.getChartData(activeChart, params);
      setChartData(response.data);
    } catch (err) {
      console.error('Error fetching chart data:', err);
      
      // For the mined-block chart, show more detailed error info
      if (activeChart === chartTypes.MINED_BLOCK) {
        console.log('Detailed error info for mined-block:', err.response?.status, err.response?.data);
      }
      
      // Generate mock data when API fails
      const mockData = generateMockData(activeChart);
      setChartData(mockData);
      
      // Show error message but with fallback notice
      setError(`Failed to load chart data from server (${err.message}). Showing sample data for demonstration purposes.`);
    } finally {
      setLoading(false);
    }
  }, [activeChart, date, timeRange]);

  // Fetch data when active chart or date changes
  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  // Handle chart type change
  const handleChartTypeChange = (chartType) => {
    setActiveChart(chartType);
  };

  // Handle time filter change
  const handleTimeFilterChange = (newDate, newRange) => {
    setDate(newDate);
    setTimeRange(newRange);
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
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
  const [timeRange, setTimeRange] = useState('30d'); // Default to 30 days for regular charts
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
      // CRITICAL FIX: Override any auto-generated date with what's in localStorage
      let displayDate = date;
      
      // For single-day charts, prioritize the localStorage date
      if (activeChart === chartTypes.POOL_STAT || activeChart === chartTypes.MINED_BLOCK) {
        const storageKey = activeChart === chartTypes.POOL_STAT ? 
          'poolStats_selectedDate' : 'minedBlocks_selectedDate';
        
        const savedDate = localStorage.getItem(storageKey);
        if (savedDate) {
          console.log(`⚠️ OVERRIDING with saved date for ${activeChart}: ${savedDate}`);
          displayDate = savedDate;
          
          // Force UI state to match
          if (displayDate !== date) {
            setDate(displayDate);
          }
        }
      }
      
      console.log(`⭐ EXACT DATE USED FOR REQUEST: ${displayDate}`);
      
      // Use the chart service with the correct chart type and parameters
      const days = getDaysFromRange(timeRange);
      const params = { days, date: displayDate };
      
      // Debug logging to track date values
      console.log(`Starting fetch for ${activeChart} with date:`, displayDate);
      console.log(`Current timeRange: ${timeRange}`);
      
      let response;
      
      // Use specialized endpoints for pool distribution and mined blocks
      if (activeChart === chartTypes.POOL_STAT || activeChart === chartTypes.MINED_BLOCK) {
        console.log(`🔄 Using ${activeChart} endpoint for date:`, displayDate);
        
        // Use the appropriate service based on chart type
        if (activeChart === chartTypes.POOL_STAT) {
          response = await chartService.getRealPoolStat({ date: displayDate });
        } else { // MINED_BLOCK
          response = await chartService.getMinedBlocks({ 
            date: displayDate, 
            days: 1  // Always use single day
          });
        }
        
        // CRITICAL FIX: For both chart types, force the correct date in the response
        // This ensures the chart displays exactly what was requested
        if (response.data) {
          // Always use the exact date from the UI for display consistency
          console.log(`🔄 Setting ${activeChart} data date to: ${displayDate}`);
          response.data.date = displayDate;
          
          // Also force chart content to match the display date
          if (response.data.data && Array.isArray(response.data.data)) {
            console.log(`🔄 Forcing chart data to show correct date: ${displayDate}`);
            
            // For each item in the data array, update any date-related fields
            response.data.data.forEach(item => {
              if (item.dateDisplay) {
                item.dateDisplay = displayDate;
              }
              if (item.date) {
                item.date = displayDate;
              }
            });
          }
        }
      } else {
        console.log(`Fetching ${activeChart} data for date: ${displayDate}, days: ${days}`);
        response = await chartService.getChartData(activeChart, params);
      }
      
      console.log(`Received ${activeChart} chart data:`, response.data);
      
      // CRITICAL FIX: Before updating state, ensure the data has the correct date
      if (response.data && activeChart === chartTypes.MINED_BLOCK) {
        // For Mined Blocks, force the data to have the exact date from localStorage
        try {
          const savedDate = localStorage.getItem('minedBlocks_selectedDate');
          if (savedDate) {
            console.log(`🛠️ FORCING MINED BLOCKS DATA TO USE DATE: ${savedDate}`);
            
            // Override the date in the response data
            response.data.date = savedDate;
            
            // Create a modified copy rather than changing the original
            const modifiedData = {
              ...response.data,
              date: savedDate
            };
            
            // Update chart data with the forced date
            setChartData(modifiedData);
            return; // Skip the normal update
          }
        } catch (e) {
          console.error("Error applying forced date:", e);
        }
      }
      
      // Normal update if no special handling needed
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
        // For pool stats, attempt to use alternative endpoint as fallback
        try {
          console.log("🔄 Primary endpoint failed, trying alternative pool data source");
          
          // For Pool Stat, try the mined blocks endpoint as a fallback
          if (activeChart === chartTypes.POOL_STAT) {
            const fallbackResponse = await chartService.getMinedBlocks({ 
              date: date,
              days: 1
            });
            
            if (fallbackResponse.data && fallbackResponse.data.data) {
              // Convert mined blocks data to pool stat format
              const poolStats = [];
              const poolMap = {};
              
              // Group by pool name
              fallbackResponse.data.data.forEach(block => {
                const poolName = block.pool || 'Unknown';
                if (!poolMap[poolName]) {
                  poolMap[poolName] = {
                    name: poolName,
                    count: 0,
                    percentage: 0
                  };
                }
                poolMap[poolName].count += 1;
              });
              
              // Calculate percentages
              const totalBlocks = fallbackResponse.data.data.length;
              Object.values(poolMap).forEach(pool => {
                pool.percentage = (pool.count / totalBlocks) * 100;
                poolStats.push(pool);
              });
              
              // Create a valid pool stat response
              const poolStatData = {
                ...fallbackResponse.data,
                chartType: 'pool-stat',
                date: date,
                data: poolStats
              };
              
              console.log("🔄 Successfully created pool stats from mined blocks:", poolStatData);
              setChartData(poolStatData);
              return; // Success - don't show error
            }
          }
          
          // If we got here, the fallback also failed
          throw new Error("Fallback data source also failed");
        } catch (fallbackErr) {
          console.error("Fallback data source failed:", fallbackErr);
          // For pool stats, don't use mock data and show a different error message
          setChartData(null);
          setError(`Failed to load mining pool data from the blockchain. Please try again later.`);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [activeChart, date, timeRange]);

  // Initialize with correct time range based on chart type
  useEffect(() => {
    // Store current custom date information
    const currentDate = date;
    const isCustomDate = timeRange === 'custom';
    
    // When switching to Pool Stat or Mined Block, reset to today's data
    // BUT ONLY if not coming from a custom selection
    if ((activeChart === chartTypes.POOL_STAT || activeChart === chartTypes.MINED_BLOCK) && !isCustomDate) {
      setDate(formatDate(new Date()));
      setTimeRange('1d'); // These charts work best with 1-day data
    } else {
      // For other charts, use 30-day default
      if (timeRange !== '30d' && !isCustomDate) {
        setTimeRange('30d');
        
        // Update the date to 30 days ago
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        setDate(formatDate(thirtyDaysAgo));
      }
    }
    
    // If this is a date that was explicitly selected by the user,
    // preserve it and don't reset
    if (isCustomDate) {
      console.log("Preserving custom date selection:", currentDate);
    }
  }, [activeChart]);

  // Fetch data when active chart, date, or timeRange changes
  useEffect(() => {
    // Get saved date if available before fetching data
    let dateToUse = date;
    
    // Before fetching, check if we have a saved date that should be used
    try {
      const chartStorageKey = 
        activeChart === chartTypes.POOL_STAT ? 'poolStats_selectedDate' : 
        activeChart === chartTypes.MINED_BLOCK ? 'minedBlocks_selectedDate' : null;
      
      if (chartStorageKey) {
        const savedDate = localStorage.getItem(chartStorageKey);
        if (savedDate) {
          console.log(`📊 Using saved date for ${activeChart}:`, savedDate);
          dateToUse = savedDate;
          
          // Only update state if it's different to prevent infinite loops
          if (dateToUse !== date) {
            setDate(dateToUse);
            setTimeRange('custom');
            
            // Return early - the state update will trigger another call to this effect
            return;
          }
        }
      }
    } catch (e) {
      console.warn("Error checking for saved date:", e);
    }
    
    // Now fetch chart data with the correct date
    console.log(`📊 Fetching ${activeChart} data with date:`, dateToUse);
    fetchChartData();
    
    // Save the current date selection for this chart type
    try {
      if (activeChart === chartTypes.POOL_STAT && timeRange === 'custom') {
        localStorage.setItem('poolStats_selectedDate', date);
      } 
      else if (activeChart === chartTypes.MINED_BLOCK && timeRange === 'custom') {
        localStorage.setItem('minedBlocks_selectedDate', date);
      }
    } catch (e) {
      console.warn("Could not save date selection:", e);
    }
  }, [fetchChartData, activeChart, timeRange, date]);

  // Immediate check on component mount to force correct date from localStorage
  useEffect(() => {
    // CRITICAL FIX: This runs once on component mount to override any system date
    try {
      // Check which chart we're viewing
      const chartStorageKey = 
        activeChart === chartTypes.POOL_STAT ? 'poolStats_selectedDate' : 
        activeChart === chartTypes.MINED_BLOCK ? 'minedBlocks_selectedDate' : null;
      
      // If this is a single-day chart with stored date, restore it
      if (chartStorageKey) {
        const savedDate = localStorage.getItem(chartStorageKey);
        if (savedDate) {
          console.log(`⚠️ FORCING EXACT DATE for ${activeChart}:`, savedDate);
          
          // DIRECT STATE UPDATE - avoid any transformations
          setDate(savedDate);
          setTimeRange('custom');
          
          // Override any browser timezone manipulations
          const headerDate = document.getElementById('header-date');
          if (headerDate) {
            headerDate.innerText = savedDate;
          }
        }
      }
      
      // Also set event listener to save date before page unload/refresh
      const handleBeforeUnload = () => {
        try {
          if (activeChart === chartTypes.POOL_STAT && timeRange === 'custom') {
            localStorage.setItem('poolStats_selectedDate', date);
            console.log("🔁 Saved Pool Stats date before page refresh:", date);
          } 
          else if (activeChart === chartTypes.MINED_BLOCK && timeRange === 'custom') {
            localStorage.setItem('minedBlocks_selectedDate', date);
            console.log("🔁 Saved Mined Blocks date before page refresh:", date);
          }
        } catch (e) {
          console.warn("Could not save date before page unload:", e);
        }
      };
      
      // Add event listener for page refresh/navigation
      window.addEventListener('beforeunload', handleBeforeUnload);
      
      // Clean up on component unmount
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    } catch (e) {
      console.warn("Error initializing date persistence:", e);
    }
  }, [activeChart, date, timeRange]);

  // Handle chart type change
  const handleChartTypeChange = (chartType) => {
    // CRITICAL FIX: Direct approach to ensure charts always load on first click
    console.log(`🔄 Chart navigation: ${activeChart} -> ${chartType}`);
    
    // Force clean slate for all chart transitions
    setLoading(true);
    setChartData(null);
    setError(null);
    
    // Set the chart type first
    setActiveChart(chartType);
    
    // Set appropriate default date based on chart type
    if (chartType === chartTypes.POOL_STAT || chartType === chartTypes.MINED_BLOCK) {
      // For single-day charts, use today's date
      const today = formatDate(new Date());
      setDate(today);
      setTimeRange('1d');
      
      // Clear any stored dates
      try {
        localStorage.removeItem('poolStats_selectedDate');
        localStorage.removeItem('minedBlocks_selectedDate');
      } catch (e) {
        console.warn("Error clearing localStorage:", e);
      }
    } else {
      // For multi-day charts, use 30-day range
      setTimeRange('30d');
      
      // Set date to 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      setDate(formatDate(thirtyDaysAgo));
    }
    
    // CRITICAL FIX: Use direct API call instead of fetchChartData
    // This bypasses any state issues that might prevent the chart from loading
    setTimeout(() => {
      console.log(`⚡ Direct API call for ${chartType}`);
      
      let params;
      if (chartType === chartTypes.POOL_STAT || chartType === chartTypes.MINED_BLOCK) {
        // For single-day charts
        const today = formatDate(new Date());
        params = { date: today };
      } else {
        // For multi-day charts
        const days = 30; // Always use 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        params = { 
          days: days,
          date: formatDate(thirtyDaysAgo)
        };
      }
      
      // Use the appropriate service based on chart type
      let apiPromise;
      if (chartType === chartTypes.POOL_STAT) {
        apiPromise = chartService.getRealPoolStat(params);
      } else if (chartType === chartTypes.MINED_BLOCK) {
        apiPromise = chartService.getMinedBlocks({ ...params, days: 1 });
      } else {
        apiPromise = chartService.getChartData(chartType, params);
      }
      
      // Process the API response
      apiPromise
        .then(response => {
          console.log(`✅ Direct API call successful for ${chartType}:`, response.data);
          setChartData(response.data);
          setLoading(false);
        })
        .catch(err => {
          console.error(`Error in direct API call for ${chartType}:`, err);
          
          // Generate mock data as fallback for non-pool charts
          if (chartType !== chartTypes.POOL_STAT && chartType !== chartTypes.MINED_BLOCK) {
            const mockData = generateMockData(chartType);
            if (mockData) {
              setChartData(mockData);
              setError(`Failed to load chart data from server. Showing sample data.`);
            } else {
              setError(`Failed to load ${chartType} data. Please try again.`);
            }
          } else {
            setError(`Failed to load data for ${chartType}. Please try again.`);
          }
          setLoading(false);
        });
    }, 50);
  };

  // Handle time filter change
  const handleTimeFilterChange = (newDate, newRange, dateRange) => {
    console.log(`⏱️ Time filter changed: date=${newDate}, range=${newRange}`, dateRange);
    
    // Make sure we have valid date and range values
    if (!newDate) {
      console.warn("handleTimeFilterChange called with empty date");
      return;
    }
    
    // CRITICAL FIX: Today button handling
    // If the user clicked "Today" button, clear any saved custom date
    if (newRange === '1d' && !dateRange?.isCustom) {
      console.log("⏱️ Today button selected - clearing saved dates");
      
      try {
        // Clear the appropriate localStorage value based on current chart
        if (activeChart === chartTypes.POOL_STAT) {
          localStorage.removeItem('poolStats_selectedDate');
        } 
        else if (activeChart === chartTypes.MINED_BLOCK) {
          localStorage.removeItem('minedBlocks_selectedDate');
        }
        
        // Set today's date directly, bypassing any custom date selection
        const today = formatDate(new Date());
        newDate = today;
        console.log("⏱️ Updated date to today:", today);
      } catch (e) {
        console.warn("Error clearing localStorage:", e);
      }
    }
    
    // Always use 'custom' range for user-selected dates from calendar
    // This prevents the date from being reset to 'Today'
    const effectiveRange = dateRange && dateRange.isCustom ? 'custom' : newRange;
    
    // Update the date in parent component state
    setDate(newDate);
    
    // Update the timeRange in parent component state - using 'custom' for calendar selections
    setTimeRange(effectiveRange);
    
    // Store the custom selection info to prevent unwanted resets
    if (dateRange && dateRange.isCustom) {
      console.log(`Custom date explicitly selected by user: ${newDate}`);
      // We could store this in localStorage if needed for persistence across reloads
    }
    
    // If we have a date range, we can use it for additional filtering or display
    if (dateRange && dateRange.startDate) {
      console.log(`Date range selected: ${dateRange.startDate} to ${dateRange.endDate || dateRange.startDate}`);
      
      // Special handling for single-day charts (Pool Stat, Mined Block)
      if (activeChart === chartTypes.POOL_STAT || activeChart === chartTypes.MINED_BLOCK) {
        // For these charts, we always use the startDate only
        console.log(`Setting single-day chart to date: ${dateRange.startDate}`);
      }
    }
    
    // CRITICAL FIX: Check for forceRefresh flag from Today button
    // This ensures immediate data refresh when Today button is clicked
    if (dateRange && dateRange.forceRefresh) {
      console.log(`⚡ Detected forceRefresh flag - fetching data immediately`);
      fetchChartData();
      return;
    }
    
    // Force a refresh of the chart data with a sufficient delay
    // to ensure all state updates have completed
    setTimeout(() => {
      fetchChartData();
    }, 100);
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
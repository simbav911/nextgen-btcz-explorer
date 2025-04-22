/**
 * Chart utility functions and constants
 */

// Chart types
export const chartTypes = {
  BLOCK_SIZE: 'block-size',
  BLOCK_INTERVAL: 'block-interval',
  DIFFICULTY: 'difficulty',
  MINING_REVENUE: 'mining-revenue',
  POOL_STAT: 'pool-stat',
  MINED_BLOCK: 'mined-block'
};

// Chart titles
export const getChartTitle = (activeChart) => {
  switch (activeChart) {
    case chartTypes.BLOCK_SIZE: return 'Block Size';
    case chartTypes.BLOCK_INTERVAL: return 'Block Interval';
    case chartTypes.DIFFICULTY: return 'Difficulty';
    case chartTypes.MINING_REVENUE: return 'Mining Revenue';
    case chartTypes.POOL_STAT: return 'Pool Distribution';
    case chartTypes.MINED_BLOCK: return 'Mined Blocks';
    default: return 'Chart';
  }
};

// Y-axis titles
export const getYAxisTitle = (activeChart) => {
  switch (activeChart) {
    case chartTypes.BLOCK_SIZE: return 'Size (bytes)';
    case chartTypes.BLOCK_INTERVAL: return 'Interval (seconds)';
    case chartTypes.DIFFICULTY: return 'Difficulty';
    case chartTypes.MINING_REVENUE: return 'Revenue (BTCZ)';
    case chartTypes.MINED_BLOCK: return 'Block Size (bytes)';
    default: return 'Value';
  }
};

// Format date to YYYY-MM-DD with timezone handling
export const formatDate = (date) => {
  // CRITICAL FIX: Ensure consistent date format without timezone issues
  
  try {
    // If date is already in YYYY-MM-DD format, return it directly
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      console.log("📅 Date already in correct format:", date);
      return date;
    }
    
    // Create a new date at noon to avoid timezone boundary issues
    const localDate = new Date(date);
    localDate.setHours(12, 0, 0, 0);
    
    // Get YYYY-MM-DD format in local timezone
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    
    const formattedDate = `${year}-${month}-${day}`;
    console.log(`📅 Formatted date: ${formattedDate} (from: ${date})`);
    return formattedDate;
  } catch (e) {
    console.error("Error formatting date:", e);
    
    // Fallback to current date if there's an error
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }
};

// Special function to get exact date format for API requests
// without any timezone transformations
export const getExactDateString = (dateStr) => {
  // If already in YYYY-MM-DD format, return directly
  if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateStr;
  }
  
  // Otherwise, format appropriately
  return formatDate(dateStr);
};

// CRITICAL: Special function for getting the correct date for Mined Blocks
export const getMinedBlocksDate = () => {
  try {
    // Try to get the date from localStorage first
    const storedDate = localStorage.getItem('minedBlocks_selectedDate');
    if (storedDate && storedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      console.log("📅 Using stored Mined Blocks date:", storedDate);
      return storedDate;
    }
    
    // If not available, return today's date in YYYY-MM-DD format
    const today = new Date();
    const formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return formattedDate;
  } catch (e) {
    console.error("Error getting Mined Blocks date:", e);
    // Fallback to today's date
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }
};

// Special function to set & save Mined Blocks date
export const setMinedBlocksDate = (date) => {
  try {
    // Normalize date format
    let formattedDate = date;
    if (!(typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/))) {
      // Convert to YYYY-MM-DD format
      const dateObj = new Date(date);
      formattedDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    }
    
    // Save to localStorage
    localStorage.setItem('minedBlocks_selectedDate', formattedDate);
    console.log("📅 Saved Mined Blocks date:", formattedDate);
    return formattedDate;
  } catch (e) {
    console.error("Error saving Mined Blocks date:", e);
    return date;
  }
};

// Get days from time range
export const getDaysFromRange = (range) => {
  switch (range) {
    case '1d': return 1; // Today
    case '7d': return 7;
    case '30d': return 30;
    case '90d': return 90;
    case '1y': return 365;
    case 'all': return 3000; // A large number to get all data
    case 'custom': return 1; // Default to 1 day for custom range if not specified
    default: return 30; // Default to 30 days
  }
};

// Check if a chart should default to today's data
export const shouldShowTodayDefault = (chartType) => {
  return chartType === chartTypes.POOL_STAT || chartType === chartTypes.MINED_BLOCK;
};

// Format date for display in a human-readable way
export const formatDisplayDate = (date) => {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

// Check if a date is today
export const isToday = (date) => {
  const today = new Date();
  const compareDate = typeof date === 'string' ? new Date(date) : date;
  
  return compareDate.getDate() === today.getDate() &&
         compareDate.getMonth() === today.getMonth() &&
         compareDate.getFullYear() === today.getFullYear();
};

// Get chart data value based on chart type
export const getChartValue = (item, activeChart) => {
  switch (activeChart) {
    case chartTypes.BLOCK_SIZE: return item.blockSize;
    case chartTypes.BLOCK_INTERVAL: return item.interval;
    case chartTypes.DIFFICULTY: return item.difficulty;
    case chartTypes.MINING_REVENUE: return item.revenue;
    case chartTypes.MINED_BLOCK: return item.size;
    default: return item.value;
  }
};

// Get chart colors with enhanced 3D-friendly colors
export const getChartColors = () => {
  const gradientColors = {
    primary: {
      start: 'rgba(37, 99, 235, 0.9)',
      end: 'rgba(59, 130, 246, 0.3)'
    },
    secondary: {
      start: 'rgba(79, 70, 229, 0.9)',
      end: 'rgba(129, 140, 248, 0.3)'
    },
    accent: {
      start: 'rgba(16, 185, 129, 0.9)',
      end: 'rgba(52, 211, 153, 0.3)'
    }
  };
  
  // Solid colors for 3D pie chart effect
  const poolColors = [
    'rgb(59, 130, 246)',     // Blue
    'rgb(245, 158, 11)',     // Amber
    'rgb(16, 185, 129)',     // Green
    'rgb(239, 68, 68)',      // Red
    'rgb(139, 92, 246)',     // Purple
    'rgb(249, 115, 22)',     // Orange
    'rgb(6, 182, 212)',      // Cyan
    'rgb(236, 72, 153)',     // Pink
    'rgb(79, 70, 229)',      // Indigo
    'rgb(20, 184, 166)',     // Teal
    'rgb(217, 119, 6)',      // Amber darker
    'rgb(5, 150, 105)',      // Emerald
    'rgb(124, 58, 237)',     // Violet
    'rgb(220, 38, 38)',      // Red darker
    'rgb(8, 145, 178)'       // Cyan darker
  ];
  
  return {
    gradientColors,
    poolColors,
    getPoolColor: (index) => poolColors[index % poolColors.length]
  };
};

// Format number with commas
export const formatNumber = (num) => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

// Format large numbers with appropriate suffix (K, M, B)
export const formatLargeNumber = (num) => {
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1) + 'B';
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};
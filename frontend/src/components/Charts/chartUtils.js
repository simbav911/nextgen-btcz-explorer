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

// Format date to YYYY-MM-DD
export const formatDate = (date) => {
  return date.toISOString().split('T')[0];
};

// Get days from time range
export const getDaysFromRange = (range) => {
  switch (range) {
    case '1d': return 1;
    case '7d': return 7;
    case '30d': return 30;
    case '90d': return 90;
    case '1y': return 365;
    case 'all': return 3000; // A large number to get all data
    default: return 30; // Default to 30 days
  }
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

// Get chart colors
export const getChartColors = () => {
  const gradientColors = {
    primary: {
      start: 'rgba(37, 99, 235, 0.8)',
      end: 'rgba(59, 130, 246, 0.2)'
    },
    secondary: {
      start: 'rgba(79, 70, 229, 0.8)',
      end: 'rgba(129, 140, 248, 0.2)'
    },
    accent: {
      start: 'rgba(16, 185, 129, 0.8)',
      end: 'rgba(52, 211, 153, 0.2)'
    }
  };
  
  const poolColors = [
    'rgba(37, 99, 235, 0.8)',   // Blue
    'rgba(245, 158, 11, 0.8)',  // Amber
    'rgba(16, 185, 129, 0.8)',  // Green
    'rgba(239, 68, 68, 0.8)',   // Red
    'rgba(139, 92, 246, 0.8)',  // Purple
    'rgba(249, 115, 22, 0.8)',  // Orange
    'rgba(6, 182, 212, 0.8)',   // Cyan
    'rgba(236, 72, 153, 0.8)'   // Pink
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
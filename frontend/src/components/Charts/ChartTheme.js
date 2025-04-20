/**
 * ChartTheme.js - Theme configuration for BitcoinZ explorer charts
 * 
 * This file contains theme variables and utility functions to ensure
 * visual consistency across all chart components.
 */

// Main theme colors
export const themeColors = {
  primary: {
    light: '#3b82f6', // Blue-500
    main: '#2563eb',  // Blue-600
    dark: '#1d4ed8',  // Blue-700
    darker: '#1e40af', // Blue-800
  },
  secondary: {
    light: '#a5b4fc', // Indigo-300
    main: '#6366f1',  // Indigo-500
    dark: '#4f46e5',  // Indigo-600
  },
  success: {
    light: '#34d399', // Emerald-400
    main: '#10b981',  // Emerald-500
    dark: '#059669',  // Emerald-600
  },
  warning: {
    light: '#fbbf24', // Amber-400 
    main: '#f59e0b',  // Amber-500
    dark: '#d97706',  // Amber-600
  },
  error: {
    light: '#f87171', // Red-400
    main: '#ef4444',  // Red-500
    dark: '#dc2626',  // Red-600
  },
  info: {
    light: '#38bdf8', // Sky-400
    main: '#0ea5e9',  // Sky-500
    dark: '#0284c7',  // Sky-600
  },
  neutral: {
    white: '#ffffff',
    gray100: '#f3f4f6',
    gray200: '#e5e7eb',
    gray300: '#d1d5db',
    gray400: '#9ca3af',
    gray500: '#6b7280',
    gray600: '#4b5563',
    gray700: '#374151',
    gray800: '#1f2937',
    gray900: '#111827',
    black: '#000000',
  },
};

// Generate gradient colors for charts
export const generateGradient = (ctx, startColor, endColor) => {
  if (!ctx) return startColor;
  
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, startColor);
  gradient.addColorStop(1, endColor);
  
  return gradient;
};

// Chart style configurations
export const chartStyles = {
  // Line chart styles
  line: {
    borderWidth: 3,
    pointRadius: 4,
    pointHoverRadius: 6,
    tension: 0.3,
    fill: true,
  },
  
  // Bar chart styles
  bar: {
    borderWidth: 0,
    borderRadius: 4,
    barPercentage: 0.7,
    categoryPercentage: 0.8,
  },
  
  // Pie/Doughnut chart styles
  pie: {
    borderColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 2,
    hoverOffset: 15,
    hoverBorderWidth: 3,
    hoverBorderColor: 'rgba(255, 255, 255, 1)',
  },
  
  // Common font settings
  fonts: {
    family: "'Inter', 'Segoe UI', Roboto, sans-serif",
    title: {
      size: 16,
      weight: 'bold',
    },
    label: {
      size: 14,
      weight: 'normal',
    },
    tooltip: {
      titleSize: 14,
      titleWeight: 'bold',
      bodySize: 13,
      bodyWeight: 'normal',
    },
  },
  
  // Tooltip styles
  tooltip: {
    backgroundColor: 'rgba(17, 24, 39, 0.8)',
    titleColor: 'rgba(255, 255, 255, 1)',
    bodyColor: 'rgba(255, 255, 255, 0.8)',
    padding: 12,
    cornerRadius: 8,
    displayColors: false,
    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.25)',
  },
  
  // Grid styles
  grid: {
    color: 'rgba(203, 213, 225, 0.3)',
    borderColor: 'rgba(203, 213, 225, 0.8)',
    tickColor: 'rgba(203, 213, 225, 0.8)',
    drawBorder: false,
  },
  
  // Animation settings
  animation: {
    duration: 1500,
    easing: 'easeOutQuart',
  },
};

// Pool colors for pie charts
export const poolColors = [
  'rgba(37, 99, 235, 0.8)',   // Blue
  'rgba(245, 158, 11, 0.8)',  // Amber
  'rgba(16, 185, 129, 0.8)',  // Green
  'rgba(239, 68, 68, 0.8)',   // Red
  'rgba(139, 92, 246, 0.8)',  // Purple
  'rgba(249, 115, 22, 0.8)',  // Orange
  'rgba(6, 182, 212, 0.8)',   // Cyan
  'rgba(236, 72, 153, 0.8)',  // Pink
  'rgba(34, 197, 94, 0.8)',   // Green-500
  'rgba(168, 85, 247, 0.8)',  // Purple-500
];

// Get pool color by index
export const getPoolColor = (index) => {
  return poolColors[index % poolColors.length];
};

// Common chart options to maintain consistency
export const commonChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: chartStyles.animation,
  interaction: {
    mode: 'index',
    intersect: false,
  },
  plugins: {
    legend: {
      position: 'top',
      labels: {
        font: {
          family: chartStyles.fonts.family,
          size: chartStyles.fonts.label.size,
          weight: chartStyles.fonts.label.weight,
        },
        padding: 20,
        usePointStyle: true,
        pointStyle: 'circle',
      },
    },
    tooltip: {
      backgroundColor: chartStyles.tooltip.backgroundColor,
      titleFont: {
        family: chartStyles.fonts.family,
        size: chartStyles.fonts.tooltip.titleSize,
        weight: chartStyles.fonts.tooltip.titleWeight,
      },
      bodyFont: {
        family: chartStyles.fonts.family,
        size: chartStyles.fonts.tooltip.bodySize,
        weight: chartStyles.fonts.tooltip.bodyWeight,
      },
      padding: chartStyles.tooltip.padding,
      cornerRadius: chartStyles.tooltip.cornerRadius,
      displayColors: chartStyles.tooltip.displayColors,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: {
        color: chartStyles.grid.color,
        drawBorder: chartStyles.grid.drawBorder,
      },
      ticks: {
        padding: 10,
        font: {
          family: chartStyles.fonts.family,
          size: 12,
        },
      },
    },
    x: {
      grid: {
        display: false,
        drawBorder: chartStyles.grid.drawBorder,
      },
      ticks: {
        padding: 10,
        font: {
          family: chartStyles.fonts.family,
          size: 12,
        },
      },
    },
  },
};

export default {
  themeColors,
  generateGradient,
  chartStyles,
  poolColors,
  getPoolColor,
  commonChartOptions,
};
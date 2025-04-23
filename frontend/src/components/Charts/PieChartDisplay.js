import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Pie } from 'react-chartjs-2';
import { getChartColors, formatNumber, formatDisplayDate, isToday, formatDate } from './chartUtils';
import './chartConfig'; // Import chart configuration to ensure all elements are registered
import './pie3d.css'; // Import enhanced 3D pie chart styles

/**
 * PieChartDisplay component for rendering pie/doughnut charts with enhanced 3D effect
 */
const PieChartDisplay = ({ chartData }) => {
  const chartRef = useRef(null);
  const { poolColors } = getChartColors();

  useEffect(() => {
    // Apply minimal 3D effects to the chart
    const chart = chartRef.current;
    if (chart) {
      // Get the canvas element
      const canvas = chart.canvas;
      
      // Styling is now handled by pie3d.css
      
      // Make sure the container is properly styled
      const container = canvas.parentNode;
      if (container) {
        container.style.position = 'relative';
        container.style.overflow = 'visible';
      }
    }
  }, [chartData]);

  if (!chartData || !chartData.data || chartData.data.length === 0) {
    return (
      <div className="chart-placeholder">
        <p>No pool statistics data available</p>
      </div>
    );
  }

  const prepareChartData = () => {
    // Ensure data is valid and in correct format
    const validData = chartData.data.filter(pool => 
      pool && typeof pool.percentage === 'number' && !isNaN(pool.percentage)
    );
    
    return {
      labels: validData.map(pool => pool.name || 'Unknown'),
      datasets: [{
        data: validData.map(pool => pool.percentage),
        backgroundColor: poolColors.slice(0, validData.length),
        borderColor: 'rgba(255, 255, 255, 0.9)',
        borderWidth: 2,
        hoverOffset: 10,
        hoverBorderWidth: 3,
        hoverBorderColor: 'rgba(255, 255, 255, 1)',
        offset: 0, // Remove spacing between segments for better visibility
      }]
    };
  };

  // Get today's date for comparison
  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  // DIRECT DATE IMPLEMENTATION WITH TODAY BUTTON FIX
  // Use the exact raw date from props
  const rawDate = chartData.date || formatDate(new Date());
  console.log("🟢 PieChartDisplay - Raw date from props:", rawDate);
  
  // Check localStorage for the Pool Stats date
  let storedDate;
  try {
    storedDate = localStorage.getItem('poolStats_selectedDate');
    console.log("🟢 PieChartDisplay - Stored date:", storedDate);
  } catch (e) {
    console.error("Error accessing localStorage:", e);
  }
  
  // TODAY BUTTON FIX: If raw date is today's date, use it directly
  // Otherwise, use localStorage if available
  let exactRequestedDate;
  
  if (rawDate === todayString) {
    // Today button was clicked - show today's date
    exactRequestedDate = todayString;
    console.log("🟢 TODAY BUTTON USED - showing today's date:", todayString);
  } else {
    // For custom dates, use localStorage or fall back to props date
    exactRequestedDate = storedDate || rawDate || todayString;
  }
  
  console.log("🟢 PieChartDisplay - Final date used:", exactRequestedDate);
  
  // Parse date components directly from string (no Date object)
  let dateDisplay;
  try {
    const parts = exactRequestedDate.split('-');
    const year = parts[0];
    const month = parseInt(parts[1]) - 1; // JS months are 0-based
    const day = parseInt(parts[2]);
    
    // Get month name
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Format as "Apr 10, 2025" without timezone conversion
    dateDisplay = `${monthNames[month]} ${day}, ${year}`;
    
    console.log(`🟢 PieChartDisplay - Formatted for display: ${dateDisplay}`);
  } catch (e) {
    console.error("Error formatting date:", e);
    dateDisplay = exactRequestedDate; // Fallback to raw date
  }
  
  // Check if this is today's data with direct string comparison
  const isTodayData = exactRequestedDate === todayString;

  return (
    <div className="chart-3d-container pie-chart-container">
      {/* Add date indicator */}
      <div className="chart-date-indicator">
        <span className={`date-badge ${isTodayData ? 'today' : ''}`}>
          {isTodayData ? 'Today' : dateDisplay}
        </span>
      </div>
      
      <div className="pie3d-chart">
        <Pie
          ref={chartRef}
          data={prepareChartData()}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            animation: {
              animateRotate: true,
              animateScale: true,
              duration: 1200,
              easing: 'easeOutQuart'
            },
            layout: {
              padding: {
                top: 20,
                bottom: 60,
                left: 20,
                right: 20
              }
            },
            cutout: '0%', // No cutout for a solid pie chart
            rotation: 270, // Start from top
            plugins: {
              legend: {
                position: 'right', // Put legend on right side
                align: 'center',
                labels: {
                  font: {
                    family: "'Inter', 'Segoe UI', Roboto, sans-serif",
                    size: 14,
                    weight: 'bold'
                  },
                  padding: 15,
                  usePointStyle: true,
                  pointStyle: 'circle',
                  boxWidth: 15,
                  boxHeight: 15,
                  color: '#333',
                  generateLabels: function(chart) {
                    const data = chart.data;
                    if (data.labels.length && data.datasets.length) {
                      return data.labels.map(function(label, i) {
                        const style = {
                          backgroundColor: data.datasets[0].backgroundColor[i],
                          borderColor: data.datasets[0].borderColor,
                          borderWidth: data.datasets[0].borderWidth
                        };
                        const value = data.datasets[0].data[i] || 0;
                      
                        return {
                          text: `${label}: ${value}%`,
                          fillStyle: style.backgroundColor,
                          strokeStyle: style.borderColor,
                          lineWidth: style.borderWidth,
                          hidden: false,
                          index: i
                        };
                      });
                    }
                    return [];
                  }
                }
              },
              tooltip: {
                backgroundColor: 'rgba(17, 24, 39, 0.9)', // Darker for better contrast
                titleFont: {
                  family: "'Inter', 'Segoe UI', Roboto, sans-serif",
                  size: 15, // Slightly larger
                  weight: 'bold'
                },
                bodyFont: {
                  family: "'Inter', 'Segoe UI', Roboto, sans-serif",
                  size: 14 // Slightly larger
                },
                padding: 15,
                cornerRadius: 10,
                callbacks: {
                  title: function(tooltipItems) {
                    // Add date to tooltip title
                    const dataIndex = tooltipItems[0].dataIndex;
                    const label = tooltipItems[0].label;
                    return `${label} - ${isTodayData ? 'Today' : dateDisplay}`;
                  },
                  label: function(tooltipItem) {
                    const dataset = tooltipItem.dataset;
                    const count = chartData.data[tooltipItem.dataIndex].count;
                    let label = tooltipItem.label || '';
                    
                    if (label) {
                      label += ': ';
                    }
                    
                    if (dataset.data && tooltipItem.dataIndex < dataset.data.length) {
                      label += dataset.data[tooltipItem.dataIndex] + '%';
                      if (count) {
                        label += ` (${formatNumber(count)} blocks)`;
                      }
                    }
                    
                    return label;
                  }
                }
              }
            }
          }}
        />
      </div>
      <div className="pie3d-shadow"></div>
    </div>
  );
};

PieChartDisplay.propTypes = {
  chartData: PropTypes.object
};

export default PieChartDisplay;
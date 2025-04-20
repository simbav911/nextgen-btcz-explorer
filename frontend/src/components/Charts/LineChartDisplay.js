import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Line } from 'react-chartjs-2';
import { 
  getChartTitle, 
  getYAxisTitle, 
  getChartValue, 
  getChartColors, 
  chartTypes,
  formatDisplayDate,
  isToday
} from './chartUtils';
import './chartConfig'; // Import chart configuration to ensure all elements are registered

/**
 * LineChartDisplay component for rendering line charts
 */
const LineChartDisplay = ({ chartData, activeChart }) => {
  const chartRef = useRef(null);
  const { gradientColors } = getChartColors();

  useEffect(() => {
    // Apply 3D effects after chart renders
    const chart = chartRef.current;
    if (chart) {
      // Apply shadow to the chart container for depth
      const container = chart.canvas.parentNode;
      container.style.boxShadow = '0 10px 25px rgba(0, 0, 50, 0.1)';
    }
  }, [chartData]);

  if (!chartData || !chartData.data || chartData.data.length === 0) {
    return (
      <div className="chart-placeholder">
        <p>No data available for this chart</p>
      </div>
    );
  }

  const prepareChartData = () => {
    const ctx = chartRef.current?.canvas?.getContext('2d');
    
    let gradient;
    if (ctx) {
      gradient = ctx.createLinearGradient(0, 0, 0, 400);
      gradient.addColorStop(0, gradientColors.primary.start);
      gradient.addColorStop(1, gradientColors.primary.end);
    }
    
    return {
      labels: chartData.data.map(item => 
        item.blockHeight ? `${item.blockHeight}` : ''
      ),
      datasets: [{
        label: getChartTitle(activeChart),
        data: chartData.data.map(item => getChartValue(item, activeChart)),
        borderColor: 'rgba(37, 99, 235, 1)',
        backgroundColor: gradient || gradientColors.primary.end,
        borderWidth: 3,
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: 'rgba(37, 99, 235, 1)',
        pointBorderColor: 'rgba(255, 255, 255, 1)',
        pointBorderWidth: 2,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: 'rgba(37, 99, 235, 1)',
        pointHoverBorderColor: 'rgba(255, 255, 255, 1)',
        pointHoverBorderWidth: 3,
        tension: 0.3
      }]
    };
  };

  // Check if the data is for today
  const dataDate = chartData.date ? new Date(chartData.date) : new Date();
  const isTodayData = isToday(dataDate);
  const dateDisplay = formatDisplayDate(dataDate);
  const isMinedBlockChart = activeChart === chartTypes.MINED_BLOCK;

  return (
    <div className="chart-3d-container">
      {/* Add date indicator for Mined Block chart */}
      {isMinedBlockChart && (
        <div className="chart-date-indicator">
          <span className={`date-badge ${isTodayData ? 'today' : ''}`}>
            {isTodayData ? 'Today' : dateDisplay}
          </span>
        </div>
      )}
      
      <div className="chart-3d-inner">
        <Line
          ref={chartRef}
          data={prepareChartData()}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            animation: {
              duration: 1500,
              easing: 'easeOutQuart'
            },
            interaction: {
              mode: 'index',
              intersect: false
            },
            plugins: {
              legend: {
                position: 'top',
                labels: {
                  font: {
                    family: "'Inter', 'Segoe UI', Roboto, sans-serif",
                    size: 14,
                    weight: 'bold'
                  },
                  padding: 20,
                  usePointStyle: true,
                  pointStyle: 'circle'
                }
              },
              tooltip: {
                backgroundColor: 'rgba(17, 24, 39, 0.8)',
                titleFont: {
                  family: "'Inter', 'Segoe UI', Roboto, sans-serif",
                  size: 14,
                  weight: 'bold'
                },
                bodyFont: {
                  family: "'Inter', 'Segoe UI', Roboto, sans-serif",
                  size: 13
                },
                padding: 12,
                cornerRadius: 8,
                displayColors: false,
                callbacks: {
                  title: function(tooltipItems) {
                    if (chartData.data && tooltipItems[0].dataIndex < chartData.data.length) {
                      const item = chartData.data[tooltipItems[0].dataIndex];
                      
                      // For Mined Block chart, show the date in the tooltip
                      if (isMinedBlockChart) {
                        return `Block ${item.blockHeight} - ${isTodayData ? 'Today' : dateDisplay}`;
                      }
                      
                      return `Block ${item.blockHeight}`;
                    }
                    return '';
                  },
                  label: function(context) {
                    let label = context.dataset.label || '';
                    if (label) {
                      label += ': ';
                    }
                    if (context.parsed.y !== null) {
                      label += context.parsed.y.toLocaleString();
                    }
                    
                    // For Mined Block chart, show the pool name
                    if (isMinedBlockChart && chartData.data[context.dataIndex]) {
                      const item = chartData.data[context.dataIndex];
                      if (item.pool) {
                        label += ` (${item.pool})`;
                      }
                    }
                    
                    return label;
                  }
                }
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                title: {
                  display: true,
                  text: getYAxisTitle(activeChart),
                  font: {
                    family: "'Inter', 'Segoe UI', Roboto, sans-serif",
                    size: 14,
                    weight: 'bold'
                  },
                  padding: {
                    top: 10,
                    bottom: 10
                  }
                },
                grid: {
                  color: 'rgba(203, 213, 225, 0.3)',
                  drawBorder: false
                },
                ticks: {
                  padding: 10,
                  font: {
                    family: "'Inter', 'Segoe UI', Roboto, sans-serif",
                    size: 12
                  },
                  callback: function(value) {
                    if (value >= 1000000) {
                      return (value / 1000000) + 'M';
                    } else if (value >= 1000) {
                      return (value / 1000) + 'K';
                    }
                    return value;
                  }
                }
              },
              x: {
                title: {
                  display: true,
                  text: 'Block Height',
                  font: {
                    family: "'Inter', 'Segoe UI', Roboto, sans-serif",
                    size: 14,
                    weight: 'bold'
                  },
                  padding: {
                    top: 10,
                    bottom: 10
                  }
                },
                grid: {
                  display: false,
                  drawBorder: false
                },
                ticks: {
                  maxTicksLimit: 8,
                  padding: 10,
                  font: {
                    family: "'Inter', 'Segoe UI', Roboto, sans-serif",
                    size: 12
                  },
                  callback: function(val, index) {
                    // Show fewer x-axis labels for better readability
                    const labels = this.getLabelForValue(val);
                    return index % 3 === 0 ? labels : '';
                  }
                }
              }
            }
          }}
        />
      </div>
      <div className="chart-3d-shadow"></div>
    </div>
  );
};

LineChartDisplay.propTypes = {
  chartData: PropTypes.object,
  activeChart: PropTypes.string.isRequired
};

export default LineChartDisplay;
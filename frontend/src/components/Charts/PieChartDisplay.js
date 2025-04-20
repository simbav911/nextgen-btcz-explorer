import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Pie } from 'react-chartjs-2';
import { getChartColors, formatNumber } from './chartUtils';
import './chartConfig'; // Import chart configuration to ensure all elements are registered

/**
 * PieChartDisplay component for rendering pie/doughnut charts
 */
const PieChartDisplay = ({ chartData }) => {
  const chartRef = useRef(null);
  const { poolColors } = getChartColors();

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
        borderColor: 'rgba(255, 255, 255, 0.8)',
        borderWidth: 2,
        hoverOffset: 15,
        hoverBorderWidth: 3,
        hoverBorderColor: 'rgba(255, 255, 255, 1)',
      }]
    };
  };

  return (
    <div className="chart-3d-container pie-chart-container">
      <div className="chart-3d-inner">
        <Pie
          ref={chartRef}
          data={prepareChartData()}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            animation: {
              animateRotate: true,
              animateScale: true,
              duration: 1500,
              easing: 'easeOutQuart'
            },
            cutout: '0%', // Set to 0% for pie, higher percentage for doughnut
            plugins: {
              legend: {
                position: 'right',
                align: 'center',
                labels: {
                  font: {
                    family: "'Inter', 'Segoe UI', Roboto, sans-serif",
                    size: 14
                  },
                  padding: 20,
                  usePointStyle: true,
                  pointStyle: 'circle',
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
                callbacks: {
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
      <div className="chart-3d-shadow"></div>
      
      {/* Pool stat legend/summary */}
      <div className="pool-stat-summary">
        <h3>Mining Pool Distribution</h3>
        <div className="pool-stat-grid">
          {chartData.data
            .filter(pool => pool && typeof pool.percentage === 'number' && !isNaN(pool.percentage))
            .map((pool, index) => (
              <div key={pool.name || `pool-${index}`} className="pool-stat-item">
                <div className="pool-stat-header">
                  <div className="pool-color" style={{ backgroundColor: poolColors[index % poolColors.length] }}></div>
                  <div className="pool-name">{pool.name || 'Unknown'}</div>
                </div>
                <div className="pool-stat-details">
                  <span className="pool-percentage">{pool.percentage.toFixed(1)}%</span>
                  <div className="pool-percentage-container">
                    <div className="pool-percentage-bar-bg">
                      <div 
                        className="pool-percentage-bar" 
                        style={{ 
                          width: `${pool.percentage}%`, 
                          backgroundColor: poolColors[index % poolColors.length] 
                        }}
                      ></div>
                    </div>
                  </div>
                  {pool.count !== undefined && (
                    <div className="pool-count">
                      <span className="pool-count-label">Blocks:</span>
                      <span className="pool-count-value">{formatNumber(pool.count)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

PieChartDisplay.propTypes = {
  chartData: PropTypes.object
};

export default PieChartDisplay;
import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Pie } from 'react-chartjs-2';
import { getChartColors, formatNumber } from './chartUtils';

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
    return {
      labels: chartData.data.map(pool => pool.name),
      datasets: [{
        data: chartData.data.map(pool => pool.percentage),
        backgroundColor: poolColors,
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
                        const meta = chart.getDatasetMeta(0);
                        const style = meta.controller.getStyle(i);
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
          {chartData.data.map((pool, index) => (
            <div key={pool.name} className="pool-stat-item">
              <span className="pool-color" style={{ backgroundColor: poolColors[index % poolColors.length] }}></span>
              <span className="pool-name">{pool.name}</span>
              <span className="pool-percentage">{pool.percentage}%</span>
              {pool.count && <span className="pool-count">{formatNumber(pool.count)} blocks</span>}
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
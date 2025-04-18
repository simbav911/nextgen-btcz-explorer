import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { chartService } from '../services/apiService';
import { Line, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import './Charts.css';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const ChartTypes = {
  BLOCK_SIZE: 'block-size',
  BLOCK_INTERVAL: 'block-interval',
  DIFFICULTY: 'difficulty',
  MINING_REVENUE: 'mining-revenue',
  POOL_STAT: 'pool-stat',
  MINED_BLOCK: 'mined-block'
};

const Charts = () => {
  const [activeChart, setActiveChart] = useState(ChartTypes.BLOCK_SIZE);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState(null);

  // Generate mock data for when API fails
  const generateMockData = (chartType) => {
    const days = 30;
    
    switch (chartType) {
      case ChartTypes.BLOCK_SIZE:
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
        
      case ChartTypes.BLOCK_INTERVAL:
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
        
      case ChartTypes.DIFFICULTY:
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
        
      case ChartTypes.MINING_REVENUE:
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
        
      case ChartTypes.POOL_STAT:
        return {
          date: date,
          chartType: 'pool-stat',
          data: [
            { name: 'Zpool', percentage: 31.8 },
            { name: 'Zergpool', percentage: 49.0 },
            { name: 'Others', count: 33, percentage: 11.1 },
            { name: 'DarkFiberMines', percentage: 6.1 },
            { name: '2Mars', percentage: 2.0 }
          ]
        };
        
      case ChartTypes.MINED_BLOCK:
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

  // Fetch chart data based on active chart type
  useEffect(() => {
    const fetchChartData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Use the chart service with the correct chart type
        const params = { days: 30, date };
        const response = await chartService.getChartData(activeChart, params);
        setChartData(response.data);
      } catch (err) {
        console.error('Error fetching chart data:', err);
        
        // For the mined-block chart, show more detailed error info
        if (activeChart === ChartTypes.MINED_BLOCK) {
          console.log('Detailed error info for mined-block:', err.response?.status, err.response?.data);
        }
        
        // Generate mock data when API fails
        const mockData = generateMockData(activeChart);
        setChartData(mockData);
        
        // Still show error message but with fallback notice
        setError(`Failed to load chart data from server (${err.message}). Showing sample data for demonstration purposes.`);
      } finally {
        setLoading(false);
      }
    };
    
    fetchChartData();
  }, [activeChart, date]);

  const getChartTitle = () => {
    switch (activeChart) {
      case ChartTypes.BLOCK_SIZE: return 'Block Size';
      case ChartTypes.BLOCK_INTERVAL: return 'Block Interval';
      case ChartTypes.DIFFICULTY: return 'Difficulty';
      case ChartTypes.MINING_REVENUE: return 'Mining Revenue';
      case ChartTypes.POOL_STAT: return 'Pool Stat';
      case ChartTypes.MINED_BLOCK: return 'Mined Block';
      default: return 'Chart';
    }
  };

  return (
    <div className="charts-container">
      <div className="charts-sidebar">
        <div className="charts-header">
          <div className="chart-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="64" height="64">
              <path d="M3 9h4V5H3v4zm0 5h4v-4H3v4zm5 0h4v-4H8v4zm5 0h4v-4h-4v4zM8 9h4V5H8v4zm5-4v4h4V5h-4z"/>
            </svg>
          </div>
          <h2>Charts</h2>
        </div>
        <div className="chart-buttons">
          <button 
            className={activeChart === ChartTypes.BLOCK_SIZE ? 'active' : ''}
            onClick={() => setActiveChart(ChartTypes.BLOCK_SIZE)}
          >
            Block Size
          </button>
          <button 
            className={activeChart === ChartTypes.BLOCK_INTERVAL ? 'active' : ''}
            onClick={() => setActiveChart(ChartTypes.BLOCK_INTERVAL)}
          >
            Block Interval
          </button>
          <button 
            className={activeChart === ChartTypes.DIFFICULTY ? 'active' : ''}
            onClick={() => setActiveChart(ChartTypes.DIFFICULTY)}
          >
            Difficulty
          </button>
          <button 
            className={activeChart === ChartTypes.MINING_REVENUE ? 'active' : ''}
            onClick={() => setActiveChart(ChartTypes.MINING_REVENUE)}
          >
            Mining revenue
          </button>
          <button 
            className={activeChart === ChartTypes.POOL_STAT ? 'active' : ''}
            onClick={() => setActiveChart(ChartTypes.POOL_STAT)}
          >
            Pool Stat
          </button>
          <button 
            className={activeChart === ChartTypes.MINED_BLOCK ? 'active' : ''}
            onClick={() => setActiveChart(ChartTypes.MINED_BLOCK)}
          >
            Mined Block
          </button>
        </div>
      </div>
      <div className="chart-content">
        <h1>{getChartTitle()}</h1>
        
        <div className="chart-date-selector">
          <span>{date}</span>
          <button className="date-button">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </button>
        </div>
        
        <div className="chart-display">
          {loading ? (
            <div className="chart-loading">
              <div className="spinner"></div>
              <p>Loading chart data...</p>
            </div>
          ) : error ? (
            <div className="chart-error">
              <p>{error}</p>
              <button 
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" 
                onClick={() => {
                  const currentChart = activeChart;
                  setActiveChart('');
                  setTimeout(() => setActiveChart(currentChart), 100);
                }}
              >
                Retry
              </button>
            </div>
          ) : chartData ? (
            <>
              {activeChart === ChartTypes.POOL_STAT ? (
                // Pie chart for pool stats
                <Pie 
                  data={{
                    labels: chartData.data ? chartData.data.map(pool => pool.name) : [],
                    datasets: [{
                      data: chartData.data ? chartData.data.map(pool => pool.percentage) : [],
                      backgroundColor: [
                        'rgba(54, 162, 235, 0.8)',  // Blue for Zpool
                        'rgba(255, 159, 64, 0.8)',  // Orange for Zergpool
                        'rgba(75, 192, 192, 0.8)',  // Green for Others
                        'rgba(255, 99, 132, 0.8)',  // Red for DarkFiberMines
                        'rgba(153, 102, 255, 0.8)', // Purple for 2Mars
                        'rgba(255, 205, 86, 0.8)',  // Yellow
                        'rgba(201, 203, 207, 0.8)', // Grey
                        'rgba(54, 72, 151, 0.8)',   // Dark blue
                      ],
                      borderColor: [
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 159, 64, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(255, 99, 132, 1)',
                        'rgba(153, 102, 255, 1)',
                        'rgba(255, 205, 86, 1)',
                        'rgba(201, 203, 207, 1)',
                        'rgba(54, 72, 151, 1)',
                      ],
                      borderWidth: 1,
                    }]
                  }}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: {
                        position: 'bottom',
                      },
                      tooltip: {
                        callbacks: {
                          label: function(tooltipItem) {
                            return `${tooltipItem.label}: ${tooltipItem.raw}%`;
                          }
                        }
                      }
                    }
                  }}
                />
              ) : (
                // Line chart for other types
                <Line
                  data={{
                    labels: chartData.data ? chartData.data.map(item => 
                      item.blockHeight ? `${item.blockHeight}` : ''
                    ) : [],
                    datasets: [{
                      label: getChartTitle(),
                      data: chartData.data ? chartData.data.map(item => 
                        activeChart === ChartTypes.BLOCK_SIZE ? item.blockSize :
                        activeChart === ChartTypes.BLOCK_INTERVAL ? item.interval :
                        activeChart === ChartTypes.DIFFICULTY ? item.difficulty :
                        activeChart === ChartTypes.MINING_REVENUE ? item.revenue :
                        activeChart === ChartTypes.MINED_BLOCK ? item.size :
                        item.value
                      ) : [],
                      borderColor: 'rgba(54, 162, 235, 1)',
                      backgroundColor: 'rgba(54, 162, 235, 0.5)',
                      pointRadius: 3,
                      pointHoverRadius: 5,
                      tension: 0.1
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'top',
                      },
                      tooltip: {
                        callbacks: {
                          title: function(tooltipItems) {
                            if (chartData.data && tooltipItems[0].dataIndex < chartData.data.length) {
                              return `Block ${chartData.data[tooltipItems[0].dataIndex].blockHeight}`;
                            }
                            return '';
                          }
                        }
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        title: {
                          display: true,
                          text: activeChart === ChartTypes.BLOCK_SIZE ? 'Size (bytes)' :
                                activeChart === ChartTypes.BLOCK_INTERVAL ? 'Interval (seconds)' :
                                activeChart === ChartTypes.DIFFICULTY ? 'Difficulty' :
                                activeChart === ChartTypes.MINING_REVENUE ? 'Revenue (BTCZ)' :
                                'Value'
                        }
                      },
                      x: {
                        title: {
                          display: true,
                          text: 'Block Height'
                        },
                        ticks: {
                          maxTicksLimit: 10,
                          callback: function(val, index) {
                            // Show fewer x-axis labels
                            return index % 3 === 0 ? this.getLabelForValue(val) : '';
                          }
                        }
                      }
                    }
                  }}
                />
              )}
            </>
          ) : (
            <div className="chart-placeholder">
              <p>{getChartTitle()} chart will be displayed here</p>
              <p className="chart-description">Data shows {activeChart.replace('-', ' ')} over time</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Charts;
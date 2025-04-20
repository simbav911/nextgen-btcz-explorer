import React from 'react';
import PropTypes from 'prop-types';
import LineChartDisplay from './LineChartDisplay';
import PieChartDisplay from './PieChartDisplay';
import { chartTypes } from './chartUtils';

/**
 * Chart container component that handles loading, errors, and renders the appropriate chart
 */
const ChartContainer = ({ 
  chartData, 
  activeChart, 
  loading, 
  error, 
  retryFetch 
}) => {
  if (loading) {
    return (
      <div className="chart-loading">
        <div className="spinner-container">
          <div className="spinner"></div>
          <div className="spinner-inner"></div>
        </div>
        <p>Loading chart data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chart-error">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <p>{error}</p>
        <button 
          className="retry-button" 
          onClick={retryFetch}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
          <span>Retry</span>
        </button>
      </div>
    );
  }

  if (!chartData) {
    return (
      <div className="chart-placeholder">
        <p>Select a chart type and time range to view data</p>
      </div>
    );
  }

  return (
    <div className="chart-display">
      {activeChart === chartTypes.POOL_STAT ? (
        <PieChartDisplay chartData={chartData} />
      ) : (
        <LineChartDisplay chartData={chartData} activeChart={activeChart} />
      )}
    </div>
  );
};

ChartContainer.propTypes = {
  chartData: PropTypes.object,
  activeChart: PropTypes.string.isRequired,
  loading: PropTypes.bool.isRequired,
  error: PropTypes.string,
  retryFetch: PropTypes.func.isRequired
};

export default ChartContainer;
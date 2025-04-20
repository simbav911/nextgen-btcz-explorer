import React from 'react';
import { chartTypes } from './chartUtils';
import PropTypes from 'prop-types';

/**
 * Sidebar component for chart navigation
 */
const ChartSidebar = ({ activeChart, setActiveChart }) => {
  return (
    <div className="charts-sidebar">
      <div className="charts-header">
        <div className="chart-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="64" height="64">
            <path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        </div>
        <h2>Charts</h2>
      </div>
      <div className="chart-buttons">
        {Object.entries(chartTypes).map(([key, value]) => (
          <button 
            key={key}
            className={activeChart === value ? 'active' : ''}
            onClick={() => setActiveChart(value)}
          >
            {value.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
          </button>
        ))}
      </div>
    </div>
  );
};

ChartSidebar.propTypes = {
  activeChart: PropTypes.string.isRequired,
  setActiveChart: PropTypes.func.isRequired,
};

export default ChartSidebar;
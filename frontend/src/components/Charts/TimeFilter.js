import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { formatDate } from './chartUtils';

/**
 * Time filter component for chart data
 */
const TimeFilter = ({ date, setDate, applyFilter }) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [timeRange, setTimeRange] = useState('30d'); // Default to 30 days
  const datePickerRef = useRef(null);
  
  // Predefined time ranges
  const timeRanges = [
    { label: '24 Hours', value: '1d' },
    { label: '7 Days', value: '7d' },
    { label: '30 Days', value: '30d' },
    { label: '90 Days', value: '90d' },
    { label: '1 Year', value: '1y' },
    { label: 'All Time', value: 'all' },
    { label: 'Custom', value: 'custom' }
  ];

  // Close the date picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
        setShowDatePicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleTimeRangeChange = (range) => {
    setTimeRange(range);
    
    // Calculate the date based on the range
    let newDate = new Date();
    
    switch (range) {
      case '1d':
        newDate.setDate(newDate.getDate() - 1);
        break;
      case '7d':
        newDate.setDate(newDate.getDate() - 7);
        break;
      case '30d':
        newDate.setDate(newDate.getDate() - 30);
        break;
      case '90d':
        newDate.setDate(newDate.getDate() - 90);
        break;
      case '1y':
        newDate.setFullYear(newDate.getFullYear() - 1);
        break;
      case 'all':
        // Set to earliest BitcoinZ data (approx. 2017-09-09)
        newDate = new Date('2017-09-09');
        break;
      case 'custom':
        // For custom, just show the date picker without changing the date
        setShowDatePicker(true);
        return;
      default:
        break;
    }
    
    const formattedDate = formatDate(newDate);
    setDate(formattedDate);
    applyFilter(formattedDate, range);
    setShowDatePicker(false);
  };

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setDate(newDate);
    applyFilter(newDate, 'custom');
  };

  // Get the label for the current time range
  const getCurrentRangeLabel = () => {
    const range = timeRanges.find(r => r.value === timeRange);
    return range ? range.label : 'Custom Range';
  };

  return (
    <div className="chart-time-filter">
      <div className="time-filter-buttons">
        {timeRanges.map(range => (
          <button 
            key={range.value}
            className={timeRange === range.value ? 'active' : ''}
            onClick={() => handleTimeRangeChange(range.value)}
          >
            {range.label}
          </button>
        ))}
      </div>
      
      <div className="chart-date-selector">
        <span>{getCurrentRangeLabel()}</span>
        <button 
          className="date-button"
          onClick={() => setShowDatePicker(!showDatePicker)}
          aria-label="Open date picker"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
        </button>
        
        {showDatePicker && (
          <div className="date-picker-container" ref={datePickerRef}>
            <div className="date-picker-header">
              <span>Select Date</span>
              <button 
                className="close-button"
                onClick={() => setShowDatePicker(false)}
                aria-label="Close date picker"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <input 
              type="date" 
              value={date}
              onChange={handleDateChange}
              min="2017-09-09"
              max={formatDate(new Date())}
            />
            <button 
              className="apply-button"
              onClick={() => {
                applyFilter(date, 'custom');
                setShowDatePicker(false);
              }}
            >
              Apply
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

TimeFilter.propTypes = {
  date: PropTypes.string.isRequired,
  setDate: PropTypes.func.isRequired,
  applyFilter: PropTypes.func.isRequired,
};

export default TimeFilter;
import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import Calendar from './Calendar';
import { formatDate } from './chartUtils';

// Portal component for rendering date picker outside the DOM hierarchy
const DatePickerPortal = ({ children }) => {
  const el = document.createElement('div');
  el.style.position = 'relative';
  el.style.zIndex = '9999';
  
  useEffect(() => {
    // Try to use portal-root if available, otherwise use body
    const portalRoot = document.getElementById('portal-root') || document.body;
    portalRoot.appendChild(el);
    
    return () => {
      portalRoot.removeChild(el);
    };
  }, [el]);
  
  return ReactDOM.createPortal(children, el);
};

/**
 * Time filter component for chart data
 */
const TimeFilter = ({ date, setDate, applyFilter }) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [timeRange, setTimeRange] = useState('30d'); // Default to 30 days
  const datePickerRef = useRef(null);
  const dateButtonRef = useRef(null);
  
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
    let endDate = new Date();
    let startDate = new Date();
    
    switch (range) {
      case '1d':
        startDate.setDate(endDate.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      case 'all':
        // Set to earliest BitcoinZ data (approx. 2017-09-09)
        startDate = new Date('2017-09-09');
        break;
      case 'custom':
        // For custom, just show the date picker without changing the date
        setShowDatePicker(true);
        return;
      default:
        break;
    }
    
    const formattedDate = formatDate(startDate);
    setDate(formattedDate);
    
    // Store the date range
    setDateRange({
      startDate: formatDate(startDate),
      endDate: formatDate(endDate)
    });
    
    applyFilter(formattedDate, range, {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate)
    });
    
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
  
  // Calculate position for date picker
  const getDatePickerPosition = () => {
    // Since we removed the button, we'll position relative to the time filter container
    const filterEl = document.querySelector('.chart-time-filter');
    if (!filterEl) return { top: '100px', right: '20px' };
    
    const filterRect = filterEl.getBoundingClientRect();
    
    // Calculate position to ensure it's visible
    return {
      position: 'fixed',
      top: `${filterRect.bottom + 10}px`,
      right: '20px',
    };
  };

  // Store the selected date range
  const [dateRange, setDateRange] = useState({ startDate: null, endDate: null });

  // Get a human-readable date range description with specific from/to dates
  const getDateRangeDescription = () => {
    // Format date in a human-readable way
    const formatDisplayDate = (date) => {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    };
    
    // If we're in custom mode and have a date range, show that
    if (timeRange === 'custom' && dateRange.startDate && dateRange.endDate) {
      const start = formatDisplayDate(dateRange.startDate);
      const end = formatDisplayDate(dateRange.endDate);
      
      if (start === end) {
        return `Custom: ${start}`;
      }
      
      return `From ${start} to ${end}`;
    }
    
    // Calculate the start date based on the time range
    const endDate = new Date();
    let startDate = new Date();
    
    switch(timeRange) {
      case '1d':
        startDate.setDate(endDate.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      case 'all':
        startDate = new Date('2017-09-09'); // BitcoinZ inception date
        break;
      case 'custom':
        return `Custom: ${formatDisplayDate(date)}`;
      default:
        startDate.setDate(endDate.getDate() - 30); // Default to 30 days
    }
    
    return `From ${formatDisplayDate(startDate)} to ${formatDisplayDate(endDate)}`;
  };

  return (
    <div className="chart-time-filter">
      <div className="date-range-description">
        {getDateRangeDescription()}
      </div>
      
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
      
      {/* Date selector button has been removed as requested */}
      
      {showDatePicker && (
        <DatePickerPortal>
          <div 
            className="date-picker-container" 
            ref={datePickerRef}
            style={getDatePickerPosition()}
          >
            <button 
              className="date-picker-close"
              onClick={() => setShowDatePicker(false)}
              aria-label="Close date picker"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            
            <Calendar
              selectedDate={date}
              onDateChange={(dateRange) => {
                if (dateRange.startDate && dateRange.endDate) {
                  // Format the date range for display
                  const startDate = new Date(dateRange.startDate);
                  const endDate = new Date(dateRange.endDate);
                  
                  // Use the start date for filtering
                  setDate(dateRange.startDate);
                }
              }}
              onApply={(dateRange) => {
                if (dateRange.startDate) {
                  setDate(dateRange.startDate);
                  
                  // Create a custom description for the date range
                  const startDate = new Date(dateRange.startDate);
                  const endDate = dateRange.endDate ? new Date(dateRange.endDate) : startDate;
                  
                  // Set the custom date range
                  applyFilter(dateRange.startDate, 'custom', {
                    startDate: dateRange.startDate,
                    endDate: dateRange.endDate || dateRange.startDate
                  });
                  
                  setTimeRange('custom');
                  setShowDatePicker(false);
                }
              }}
              minDate="2017-09-09"
              maxDate={formatDate(new Date())}
            />
          </div>
        </DatePickerPortal>
      )}
    </div>
  );
};

TimeFilter.propTypes = {
  date: PropTypes.string.isRequired,
  setDate: PropTypes.func.isRequired,
  applyFilter: PropTypes.func.isRequired,
};

export default TimeFilter;
import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import Calendar from './Calendar';
import { formatDate, chartTypes } from './chartUtils';

// Portal component for rendering date picker outside the DOM hierarchy
const DatePickerPortal = ({ children }) => {
  // Use a ref to keep track of the element across renders
  const elRef = useRef(null);
  
  // Only create the element once on first render
  if (!elRef.current) {
    const newEl = document.createElement('div');
    newEl.style.position = 'relative';
    newEl.style.zIndex = '9999';
    newEl.className = 'date-picker-portal'; // Add a class to help with debugging
    elRef.current = newEl;
  }
  
  useEffect(() => {
    // Try to use portal-root if available, otherwise use body
    const portalRoot = document.getElementById('portal-root') || document.body;
    portalRoot.appendChild(elRef.current);
    
    // Only remove on unmount
    return () => {
      if (portalRoot.contains(elRef.current)) {
        portalRoot.removeChild(elRef.current);
      }
    };
  }, []); // Empty dependency array - only run on mount and unmount
  
  return ReactDOM.createPortal(children, elRef.current);
};

/**
 * Time filter component for chart data
 */
const TimeFilter = ({ date, setDate, applyFilter, showTodayDefault = false, activeChart }) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [timeRange, setTimeRange] = useState(showTodayDefault ? '1d' : '30d'); // Default to 1 day if showTodayDefault is true
  const datePickerRef = useRef(null);
  const dateButtonRef = useRef(null);
  
  // Check if this is a single-day chart (Pool Distribution or Mined Block)
  const isSingleDayChart = activeChart === chartTypes.POOL_STAT || activeChart === chartTypes.MINED_BLOCK;
  
  // For mined blocks, we need to ensure date consistency
  useEffect(() => {
    if (activeChart === chartTypes.MINED_BLOCK) {
      console.log(`TimeFilter for Mined Blocks - current date: ${date}`);
      
      // Only log, don't auto-reset to today unless specifically requested
      if (timeRange === 'custom') {
        console.log(`Using custom date for Mined Blocks: ${date}`);
      }
    }
  }, [activeChart, date, timeRange]);
  
  // Update internal timeRange state when props change - but with safeguards
  // to prevent unwanted resets to Today's data
  useEffect(() => {
    // Get the effective time range from URL parameters or parent component state
    const urlParams = new URLSearchParams(window.location.search);
    const urlTimeRange = urlParams.get('timeRange');
    
    // Maintain a local reference to detect if we're in custom mode
    const isCustomTimeRange = timeRange === 'custom';
    
    // Determine what time range to use
    let effectiveTimeRange;
    
    // IMPORTANT: Don't change date if we're in custom mode and have a custom date selected
    if (isCustomTimeRange && dateRange.startDate) {
      // Keep the current custom selection - don't reset to Today
      return;
    }
    
    // Special case: If showing today's data by default (Pool stats or Mined blocks)
    // but ONLY on first load or explicit component mount, not during rerenders
    if (showTodayDefault && !isCustomTimeRange) {
      effectiveTimeRange = '1d';
    } 
    // If URL specifies a time range, use that
    else if (urlTimeRange && ['1d', '7d', '30d', '90d', '1y', 'all', 'custom'].includes(urlTimeRange)) {
      effectiveTimeRange = urlTimeRange;
    } 
    // Default to 30d for regular charts
    else {
      effectiveTimeRange = '30d';
    }
    
    // Only update if the time range has changed
    if (timeRange !== effectiveTimeRange && !isCustomTimeRange) {
      setTimeRange(effectiveTimeRange);
      
      // For single-day charts or 1d view, use today's date
      if (effectiveTimeRange === '1d' || isSingleDayChart) {
        const today = formatDate(new Date());
        setDate(today);
        applyFilter(today, effectiveTimeRange, {
          startDate: today,
          endDate: today
        });
      } 
      // For other time ranges, calculate appropriate start date
      else {
        const endDate = new Date();
        let startDate = new Date();
        
        switch(effectiveTimeRange) {
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
          default:
            startDate.setDate(endDate.getDate() - 30);
        }
        
        const formattedStartDate = formatDate(startDate);
        setDate(formattedStartDate);
        
        applyFilter(formattedStartDate, effectiveTimeRange, {
          startDate: formattedStartDate,
          endDate: formatDate(endDate)
        });
      }
    }
  }, [showTodayDefault, activeChart]); // Only run when chart type changes, removed setDate and applyFilter
  
  // Predefined time ranges
  const timeRanges = isSingleDayChart 
    ? [
        { label: 'Today', value: '1d' },
        { label: 'Custom', value: 'custom' }
      ]
    : [
        { label: 'Today', value: '1d' },
        { label: '7 Days', value: '7d' },
        { label: '30 Days', value: '30d' },
        { label: '90 Days', value: '90d' },
        { label: '1 Year', value: '1y' },
        { label: 'All Time', value: 'all' },
        { label: 'Custom', value: 'custom' }
      ];

  // Close the date picker when clicking outside
  useEffect(() => {
    // Only add the listener if the date picker is showing
    if (!showDatePicker) return;
    
    // Use a timeout to ensure this runs after the current click event finishes
    const timeoutId = setTimeout(() => {
      const handleClickOutside = (event) => {
        // Make sure we have a ref and the click is outside
        if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
          // Check if the click was on a Custom button (which should open, not close)
          const customButton = event.target.closest('button');
          const isCustomButton = customButton && 
                                 customButton.textContent.trim() === 'Custom';
          
          if (!isCustomButton) {
            setShowDatePicker(false);
          }
        }
      };
      
      // Use capture phase to get the event before it reaches other handlers
      document.addEventListener('mousedown', handleClickOutside, true);
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside, true);
      };
    }, 0);
    
    return () => clearTimeout(timeoutId);
  }, [showDatePicker]); // Re-add the listener whenever showDatePicker changes

  const handleTimeRangeChange = (range) => {
    console.log(`⏰ Time range changed to: ${range}`);
    
    // Set the new time range first
    setTimeRange(range);
    
    // CRITICAL FIX: Today button handling
    // If user clicked on "Today" button, we need to clear any saved custom date
    if (range === '1d') {
      console.log("⏰ Today button clicked - CLEARING saved dates");
      
      try {
        // Clear any saved custom dates to ensure Today button works
        if (activeChart === chartTypes.POOL_STAT) {
          localStorage.removeItem('poolStats_selectedDate');
        } else if (activeChart === chartTypes.MINED_BLOCK) {
          localStorage.removeItem('minedBlocks_selectedDate');
        }
      } catch (e) {
        console.warn("Error clearing localStorage:", e);
      }
    }
    
    // Special handling for custom date range
    if (range === 'custom') {
      console.log("⏰ Custom date range selected");
      
      // Force showing the date picker with a slight delay 
      // to ensure any click events are processed first
      setTimeout(() => {
        setShowDatePicker(true);
      }, 50);
      return;
    }
    
    // For all other ranges, calculate the date
    let newDate = new Date();
    let endDate = new Date();
    let startDate = new Date();
    
    switch (range) {
      case '1d':
        startDate = new Date(); // Today
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
        return `Custom: ${formatDisplayDate(date)}`;
      default:
        startDate.setDate(endDate.getDate() - 30); // Default to 30 days
    }
    
    const formattedDate = formatDate(startDate);
    setDate(formattedDate);
    
    // For single-day charts, always use the same date for start and end
    const dateRange = isSingleDayChart
      ? {
          startDate: formatDate(startDate),
          endDate: formatDate(startDate),
          isStandardRange: true  // Flag to indicate this isn't a custom user selection
        }
      : {
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
          isStandardRange: true  // Flag to indicate this isn't a custom user selection
        };
    
    setDateRange(dateRange);
    
    applyFilter(formattedDate, range, dateRange);
    
    // Make sure date picker is closed for non-custom ranges
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
    // Position calendar container relative to Custom button
    const buttonEl = dateButtonRef.current;
    if (!buttonEl) {
      return {
        position: 'fixed',
        top: '100px',
        left: '20px',
      };
    }
    const rect = buttonEl.getBoundingClientRect();
    return {
      position: 'fixed',
      top: `${rect.bottom + 5}px`,
      left: `${rect.left}px`,
    };
  };

  // Store the selected date range
  const [dateRange, setDateRange] = useState({ 
    startDate: date, 
    endDate: isSingleDayChart ? date : null 
  });

  // Format date in a human-readable way
  const formatDisplayDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get a human-readable date range description with specific from/to dates
  const getDateRangeDescription = () => {
    // For Mined Block and Pool Stat charts, always show the exact selected date
    if (isSingleDayChart) {
      // Show the actual date that's being used for chart data
      return formatDisplayDate(date);
    }
    
    // If we're in custom mode and have a date range, show that
    if (timeRange === 'custom' && dateRange.startDate) {
      const start = formatDisplayDate(dateRange.startDate);
      const end = dateRange.endDate ? formatDisplayDate(dateRange.endDate) : start;
      
      if (start === end) {
        return `${start}`;
      }
      
      return `From ${start} to ${end}`;
    }
    
    // Calculate the date range based on the time range
    const endDate = new Date();
    let startDate = new Date();
    
    switch(timeRange) {
      case '1d':
        // For today, just show today's date
        return `Today (${formatDisplayDate(new Date())})`;
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
        // If we somehow got here without a date range, show the selected date
        return `${formatDisplayDate(date)}`;
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
            ref={range.value === 'custom' ? dateButtonRef : null}
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
                console.log("Date selection change:", dateRange); // Debug log
                
                // Always update the internal state when a date is selected
                if (dateRange.startDate) {
                  // For both Pool Stats and Mined Blocks, handle exactly the same way
                  if (isSingleDayChart) {
                    // Treat Pool Stats and Mined Blocks identically
                    // Create a consistent date range object
                    const newDateRange = {
                      startDate: dateRange.startDate,
                      endDate: dateRange.startDate,
                      isCustom: true,
                      forcePersist: true
                    };
                    
                    // Store the date range for display
                    setDateRange(newDateRange);
                    
                    console.log(`Updating ${activeChart} chart date:`, dateRange.startDate);
                    
                    // Update the displayed date
                    setDate(dateRange.startDate);
                    
                    // Force timeRange to 'custom' to ensure persistence
                    setTimeRange('custom');
                    
                    // Apply immediately
                    applyFilter(dateRange.startDate, 'custom', newDateRange);
                    
                    // Also store in localStorage for both chart types
                    try {
                      if (activeChart === chartTypes.POOL_STAT) {
                        localStorage.setItem('poolStats_selectedDate', dateRange.startDate);
                      } else if (activeChart === chartTypes.MINED_BLOCK) {
                        localStorage.setItem('minedBlocks_selectedDate', dateRange.startDate);
                      }
                    } catch (e) {
                      console.warn("Could not save date to localStorage", e);
                    }
                  } else {
                    // For range charts, just update the displayed date for now
                    // The actual filter will be applied when user clicks Apply
                    setDate(dateRange.startDate);
                    setDateRange({
                      startDate: dateRange.startDate,
                      endDate: dateRange.endDate
                    });
                  }
                }
              }}
              onApply={(dateRange) => {
                console.log("🔵 Applying date range:", dateRange); // Debug log
                
                if (dateRange.startDate) {
                  // CRITICAL FIX: Preserve the exact date string without any manipulation
                  // This prevents the date shifting problem
                  const exactSelectedDate = dateRange.startDate;
                  console.log("🔵 TimeFilter - EXACT date to apply:", exactSelectedDate);
                  
                  // For single-day charts, ensure we use the same date for start and end
                  // but preserve the exact date string
                  const newDateRange = isSingleDayChart
                    ? {
                        startDate: exactSelectedDate,
                        endDate: exactSelectedDate,
                        exactDate: true, // Flag to indicate this is an exact date string
                        isCustom: true,
                        forcePersist: true
                      }
                    : {
                        startDate: exactSelectedDate,
                        endDate: dateRange.endDate || exactSelectedDate
                      };
                  
                  console.log("🔵 TimeFilter - Processed date range to apply:", newDateRange);
                  
                  // CRITICAL: Set the exact date in parent component without any transformation
                  setDate(exactSelectedDate);
                  
                  // Set the time range to custom to prevent auto-resets
                  setTimeRange('custom');
                  
                  // Update display range for local UI
                  setDateRange(newDateRange);
                  
                  // CRITICAL: Apply the filter with the exact date
                  applyFilter(exactSelectedDate, 'custom', newDateRange);
                  
                  // Close the date picker
                  setShowDatePicker(false);
                  
                  // For debugging
                  console.log("🔵 TimeFilter - Final applied date:", exactSelectedDate);
                }
              }}
              minDate="2017-09-09"
              maxDate={formatDate(new Date())}
              singleDateMode={isSingleDayChart} // Only allow selecting a single date for Pool Distribution and Mined Block
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
  showTodayDefault: PropTypes.bool,
  activeChart: PropTypes.string
};

export default TimeFilter;
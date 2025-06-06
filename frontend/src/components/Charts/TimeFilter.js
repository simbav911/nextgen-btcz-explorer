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
    newEl.style.position = 'fixed';
    newEl.style.top = '0';
    newEl.style.left = '0';
    newEl.style.width = '100%';
    newEl.style.height = '100%';
    newEl.style.zIndex = '9999';
    newEl.style.pointerEvents = 'none';
    newEl.className = 'date-picker-portal'; // Add a class to help with debugging
    elRef.current = newEl;
  }
  
  useEffect(() => {
    // Add to body directly for maximum z-index effectiveness
    document.body.appendChild(elRef.current);
    console.log(" Portal element added to DOM");
    
    // Only remove on unmount
    return () => {
      if (document.body.contains(elRef.current)) {
        document.body.removeChild(elRef.current);
        console.log(" Portal element removed from DOM");
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
  
  // CRITICAL FIX: Reset timeRange when activeChart changes
  // This ensures we don't show the date picker when navigating between charts
  useEffect(() => {
    // When chart type changes, reset to appropriate default
    if (isSingleDayChart) {
      setTimeRange('1d'); // Reset to Today for single-day charts
    } else {
      setTimeRange('30d'); // Reset to 30 days for multi-day charts
    }
    
    // Always hide date picker when changing chart types
    setShowDatePicker(false);
    
    console.log(` Chart type changed to ${activeChart}, reset timeRange to ${isSingleDayChart ? '1d' : '30d'}`);
  }, [activeChart, isSingleDayChart]);
  
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
            startDate.setDate(endDate.getDate() - 30); // Default to 30 days
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

  // Store the selected date range
  const [dateRange, setDateRange] = useState({ 
    startDate: date, 
    endDate: isSingleDayChart ? date : null 
  });

  const handleTimeRangeChange = (range) => {
    console.log(` Time range changed to: ${range}`);
    
    // CRITICAL FIX: If we're already in custom mode and user clicks custom again,
    // simply refresh the chart instead of showing the date picker
    if (range === 'custom' && timeRange === 'custom') {
      console.log(" Already in custom mode - refreshing chart instead of showing date picker");
      
      // Apply the current date with the current range to refresh the chart
      applyFilter(date, 'custom', {
        startDate: date,
        endDate: date,
        isCustom: true,
        forceRefresh: true
      });
      
      return;
    }
    
    // Set the new time range first
    setTimeRange(range);
    
    // CRITICAL FIX: Today button handling
    // If user clicked on "Today" button, we need to clear any saved custom date
    if (range === '1d') {
      console.log(" Today button clicked - CLEARING saved dates");
      
      try {
        // Clear any saved custom dates to ensure Today button works
        if (activeChart === chartTypes.POOL_STAT) {
          localStorage.removeItem('poolStats_selectedDate');
        } else if (activeChart === chartTypes.MINED_BLOCK) {
          localStorage.removeItem('minedBlocks_selectedDate');
        }
        
        // CRITICAL FIX: Force immediate update with today's date
        const today = formatDate(new Date());
        console.log(" FORCE IMMEDIATE UPDATE with today's date:", today);
        
        // Update local state
        setDate(today);
        
        // Create a date range object for today only
        const todayDateRange = {
          startDate: today,
          endDate: today,
          isStandardRange: true,
          forceRefresh: true // Special flag to force immediate data refresh
        };
        
        // Apply the filter immediately with the today date
        applyFilter(today, '1d', todayDateRange);
        
        // Return early to prevent the normal flow
        return;
      } catch (e) {
        console.warn("Error handling Today button click:", e);
      }
    }
    
    // Special handling for custom date range
    if (range === 'custom') {
      console.log(" Custom date range selected");
      
      // Force showing the date picker with a slight delay 
      // to ensure any click events are processed first
      setTimeout(() => {
        setShowDatePicker(true);
        console.log(" Date picker should be visible now");
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
        zIndex: 9999
      };
    }
    
    const rect = buttonEl.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    
    // Check if there's enough space below the button
    // If not, position above the button
    if (spaceBelow < 450) { // Calendar height approx
      return {
        position: 'fixed',
        top: `${Math.max(10, rect.top - 450 - 10)}px`, // 10px padding, ensure not off-screen
        left: `${rect.left}px`,
        zIndex: 9999
      };
    }
    
    // Default position below the button
    return {
      position: 'fixed',
      top: `${rect.bottom + 10}px`,
      left: `${rect.left}px`,
      zIndex: 9999
    };
  };

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
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 9999,
              width: '350px',
              background: 'white',
              borderRadius: '16px',
              boxShadow: '0 15px 35px rgba(59, 130, 246, 0.4), 0 5px 15px rgba(59, 130, 246, 0.3), 0 0 0 2px rgba(59, 130, 246, 0.2), 0 0 30px rgba(59, 130, 246, 0.25)',
              padding: '20px',
              pointerEvents: 'auto'
            }}
          >
            <button 
              className="date-picker-close"
              onClick={() => setShowDatePicker(false)}
              aria-label="Close date picker"
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'rgba(59, 130, 246, 0.1)',
                border: 'none',
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#3b82f6',
                transition: 'all 0.2s'
              }}
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
                console.log(" Applying date range:", dateRange); // Debug log
                
                if (dateRange.startDate) {
                  // CRITICAL FIX: Preserve the exact date string without any manipulation
                  // This prevents the date shifting problem
                  const exactSelectedDate = dateRange.startDate;
                  console.log(" TimeFilter - EXACT date to apply:", exactSelectedDate);
                  
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
                  
                  console.log(" TimeFilter - Processed date range to apply:", newDateRange);
                  
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
                  console.log(" TimeFilter - Final applied date:", exactSelectedDate);
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
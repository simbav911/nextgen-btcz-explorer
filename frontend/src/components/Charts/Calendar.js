import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { formatDate } from './chartUtils';

/**
 * Calendar component for date range selection
 */
const Calendar = ({ selectedDate, onDateChange, onApply, minDate, maxDate, singleDateMode = false }) => {
  // Parse the selected date
  const dateObj = new Date(selectedDate);
  const [month, setMonth] = useState(dateObj.getMonth());
  const [year, setYear] = useState(dateObj.getFullYear());
  
  // Date range selection states
  const [startDate, setStartDate] = useState(selectedDate);
  const [endDate, setEndDate] = useState(singleDateMode ? selectedDate : null);
  const [selectingStart, setSelectingStart] = useState(true); // true = selecting start date, false = selecting end date
  
  // Update the month and year when selectedDate changes
  useEffect(() => {
    const newDateObj = new Date(selectedDate);
    setMonth(newDateObj.getMonth());
    setYear(newDateObj.getFullYear());
    setStartDate(selectedDate);
    if (singleDateMode) {
      setEndDate(selectedDate);
    }
  }, [selectedDate, singleDateMode]);
  
  // Reset selection state when calendar opens or re-renders
  useEffect(() => {
    // If no dates are selected, ensure we're in "select start date" mode
    if (!startDate && !endDate) {
      setSelectingStart(true);
    }
  }, [startDate, endDate]);
  
  // Convert min/max dates to Date objects
  const minDateObj = minDate ? new Date(minDate) : new Date('2017-09-09');
  const maxDateObj = maxDate ? new Date(maxDate) : new Date();
  
  // Format date for display
  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  
  // Get days in month
  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };
  
  // Get day of week for first day of month (0 = Sunday, 6 = Saturday)
  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
  };
  
  // Generate calendar days
  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const days = [];
    
    // Add empty spaces for days before the first day of month
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: '', isCurrentMonth: false });
    }
    
    // Add days of current month
    for (let i = 1; i <= daysInMonth; i++) {
      // Create a date at noon to avoid timezone issues
      const dateObj = new Date(year, month, i, 12, 0, 0, 0);
      const dateStr = formatDate(dateObj);
      
      const isDisabled = dateObj < minDateObj || dateObj > maxDateObj;
      
      // Check if this day is in the selected range
      const isStartDate = dateStr === startDate;
      const isEndDate = dateStr === endDate;
      
      // Use noon-based dates for comparison to avoid timezone issues
      const startDateObj = startDate ? new Date(new Date(startDate).setHours(12, 0, 0, 0)) : null;
      const endDateObj = endDate ? new Date(new Date(endDate).setHours(12, 0, 0, 0)) : null;
      
      const isInRange = startDate && endDate && 
                        dateObj >= startDateObj && 
                        dateObj <= endDateObj;
      
      days.push({ 
        day: i, 
        isCurrentMonth: true,
        isStartDate,
        isEndDate,
        isInRange,
        isDisabled,
        date: dateStr
      });
    }
    
    return days;
  };
  
  // Change month
  const changeMonth = (offset) => {
    let newMonth = month + offset;
    let newYear = year;
    
    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    }
    
    setMonth(newMonth);
    setYear(newYear);
  };
  
  // Selection mode instructions
  const getSelectionInstructions = () => {
    if (singleDateMode) {
      return "Select date";
    } else if (selectingStart) {
      return "Select start date";
    } else {
      return "Select end date";
    }
  };

  // Handle day click for range selection - FIXED to eliminate date lag
  const handleDayClick = (day) => {
    if (day.isCurrentMonth && !day.isDisabled) {
      if (singleDateMode) {
        // CRITICAL FIX: Preserve the exact string date without creating new Date objects
        // that could shift the date due to timezone issues
        const exactSelectedDate = day.date; // This is already in YYYY-MM-DD format
        console.log("🔴 Calendar - EXACT selected date:", exactSelectedDate);
        
        // Set both start and end to the exact same date
        setStartDate(exactSelectedDate);
        setEndDate(exactSelectedDate);
        
        // Create the date selection object with the exact date
        const exactDateSelection = { 
          startDate: exactSelectedDate, 
          endDate: exactSelectedDate,
          isCustom: true,
          forcePersist: true,
          exactDate: true // Flag to indicate this is an exact date selection
        };
        
        // IMMEDIATE notification - no delay to prevent race conditions
        // Notify parent component immediately to synchronize UI
        onDateChange(exactDateSelection);
        
        // IMMEDIATELY apply the selection
        onApply(exactDateSelection);
        
        // For debugging
        console.log("🔴 Calendar - Date selection applied:", exactSelectedDate);
      } else {
        // Fixed logic: Always select start date first, then end date
        if (selectingStart || (!startDate && !endDate)) {
          // Start new range selection
          setStartDate(day.date);
          setEndDate(null);
          setSelectingStart(false);
          onDateChange({ startDate: day.date, endDate: null });
        } else {
          // Complete range selection
          const newStartDate = new Date(startDate);
          const clickedDate = new Date(day.date);
          
          // Ensure end date is after start date
          if (clickedDate < newStartDate) {
            // If user clicked a date before the start date, swap them
            setEndDate(startDate);
            setStartDate(day.date);
            onDateChange({ startDate: day.date, endDate: startDate });
          } else {
            setEndDate(day.date);
            onDateChange({ startDate, endDate: day.date });
          }
          
          setSelectingStart(true);
        }
      }
    }
  };
  
  // Reset selection
  const resetSelection = () => {
    // Reset to default date (today) instead of null to avoid undefined states
    const today = formatDate(new Date());
    setStartDate(today);
    setEndDate(singleDateMode ? today : null);
    setSelectingStart(true);
    onDateChange({ 
      startDate: today, 
      endDate: singleDateMode ? today : null 
    });
  };
  
  // Get month name
  const getMonthName = (monthIndex) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                   'July', 'August', 'September', 'October', 'November', 'December'];
    return months[monthIndex];
  };
  
  // Month and year navigation
  const renderMonthNavigation = () => {
    const prevMonthDisabled = new Date(year, month, 1) <= new Date(minDateObj.getFullYear(), minDateObj.getMonth(), 1);
    const nextMonthDisabled = new Date(year, month, getDaysInMonth(year, month)) >= maxDateObj;
    
    return (
      <div className="month-navigation">
        <button 
          className="month-nav-button" 
          onClick={() => changeMonth(-1)}
          disabled={prevMonthDisabled}
          aria-label="Previous month"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        
        <div className="month-year">
          <select 
            value={month} 
            onChange={(e) => setMonth(parseInt(e.target.value))}
            className="month-select"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i}>{getMonthName(i)}</option>
            ))}
          </select>
          
          <select 
            value={year} 
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="year-select"
          >
            {Array.from(
              { length: maxDateObj.getFullYear() - minDateObj.getFullYear() + 1 }, 
              (_, i) => minDateObj.getFullYear() + i
            ).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        
        <button 
          className="month-nav-button" 
          onClick={() => changeMonth(1)}
          disabled={nextMonthDisabled}
          aria-label="Next month"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
    );
  };

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <span>Select Date Range</span>
      </div>
      
      {singleDateMode ? (
        <div className="selected-date">
          <span>Selected Date:</span>
          <span className="date-value">{formatDisplayDate(startDate)}</span>
        </div>
      ) : (
        <div className="selected-range">
          <div className="range-display-row">
            <div className="range-display">
              <div className="range-label">From:</div>
              <div className={`range-value ${selectingStart ? 'selecting' : ''}`}>
                {startDate ? formatDisplayDate(startDate) : "Select start date"}
              </div>
            </div>
            
            <div className="range-display">
              <div className="range-label">To:</div>
              <div className={`range-value ${!selectingStart ? 'selecting' : ''}`}>
                {endDate ? formatDisplayDate(endDate) : (startDate ? "Now select end date" : "Select dates")}
              </div>
            </div>
          </div>
          
          <div className="range-instruction">
            {!startDate && !endDate && (
              <span className="instruction-highlight">Click on a date to start selection</span>
            )}
            {startDate && !endDate && (
              <span className="instruction-highlight">Now click another date to complete the range</span>
            )}
            {startDate && (
              <button className="reset-button" onClick={resetSelection}>
                Clear
              </button>
            )}
          </div>
        </div>
      )}
      {renderMonthNavigation()}
      <div className="weekday-header">
        <div>Sun</div>
        <div>Mon</div>
        <div>Tue</div>
        <div>Wed</div>
        <div>Thu</div>
        <div>Fri</div>
        <div>Sat</div>
      </div>
      <div className="calendar-grid">
        {generateCalendarDays().map((day, index) => (
          <div 
            key={index} 
            className={`calendar-day ${!day.isCurrentMonth ? 'empty' : ''} ${
              day.isStartDate ? 'start-date' : ''
            } ${day.isEndDate ? 'end-date' : ''} ${
              day.isInRange ? 'in-range' : ''
            } ${day.isDisabled ? 'disabled' : ''}`}
            onClick={() => !day.isDisabled && handleDayClick(day)}
          >
            {day.day}
          </div>
        ))}
      </div>
      
      <div className="calendar-actions">
        <button 
          className="calendar-button clear" 
          onClick={resetSelection}
        >
          Clear
        </button>
        <button 
          className="calendar-button apply" 
          onClick={() => {
            // Log the exact date we're applying to help with debugging
            console.log("Applying date selection:", {
              startDate: startDate,
              endDate: singleDateMode ? startDate : endDate
            });
            
            // Make sure we have a startDate
            if (!startDate) {
              // If no date is selected, use today's date at noon to avoid timezone issues
              const today = formatDate(new Date(new Date().setHours(12, 0, 0, 0)));
              setStartDate(today);
              setEndDate(singleDateMode ? today : endDate);
              onApply({ 
                startDate: today, 
                endDate: singleDateMode ? today : endDate 
              });
            } else {
              // Apply the currently selected date(s)
              // For single-day mode, explicitly use the same date for start and end
              // to ensure consistency
              if (singleDateMode) {
                onApply({ 
                  startDate: startDate, 
                  endDate: startDate  // Always use startDate for both in single mode
                });
              } else {
                onApply({ 
                  startDate, 
                  endDate: endDate || startDate 
                });
              }
            }
          }}
          disabled={!singleDateMode && !endDate}
        >
          Apply
        </button>
      </div>
    </div>
  );
};

Calendar.propTypes = {
  selectedDate: PropTypes.string.isRequired,
  onDateChange: PropTypes.func.isRequired,
  onApply: PropTypes.func.isRequired,
  minDate: PropTypes.string,
  maxDate: PropTypes.string,
  singleDateMode: PropTypes.bool
};

export default Calendar;
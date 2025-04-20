import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { formatDate } from './chartUtils';

/**
 * Calendar component for date range selection
 */
const Calendar = ({ selectedDate, onDateChange, onApply, minDate, maxDate }) => {
  // Parse the selected date
  const dateObj = new Date(selectedDate);
  const [month, setMonth] = useState(dateObj.getMonth());
  const [year, setYear] = useState(dateObj.getFullYear());
  
  // Date range selection states
  const [startDate, setStartDate] = useState(selectedDate);
  const [endDate, setEndDate] = useState(null);
  const [selectingStart, setSelectingStart] = useState(true); // true = selecting start date, false = selecting end date
  
  // Reset selection state when calendar opens or re-renders
  React.useEffect(() => {
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
      const date = new Date(year, month, i);
      const dateStr = formatDate(date);
      const isDisabled = date < minDateObj || date > maxDateObj;
      
      // Check if this day is in the selected range
      const isStartDate = dateStr === startDate;
      const isEndDate = dateStr === endDate;
      const isInRange = startDate && endDate && 
                        date >= new Date(startDate) && 
                        date <= new Date(endDate);
      
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
    if (selectingStart) {
      return "Select start date";
    } else {
      return "Select end date";
    }
  };

  // Handle day click for range selection
  const handleDayClick = (day) => {
    if (day.isCurrentMonth && !day.isDisabled) {
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
  };
  
  // Reset selection
  const resetSelection = () => {
    // Reset to default date (today) instead of null to avoid undefined states
    const today = formatDate(new Date());
    setStartDate(today);
    setEndDate(null);
    setSelectingStart(true);
    onDateChange({ startDate: today, endDate: null });
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
  
  // Render calendar days
  const renderCalendarDays = () => {
    const days = generateCalendarDays();
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    return (
      <div className="calendar-body">
        <div className="weekday-header">
          {dayLabels.map(day => (
            <div key={day} className="weekday">{day}</div>
          ))}
        </div>
        
        <div className="calendar-days">
          {days.map((day, index) => (
            <div 
              key={index} 
              className={`calendar-day 
                ${day.isCurrentMonth ? 'current-month' : 'other-month'} 
                ${day.isStartDate ? 'start-date' : ''} 
                ${day.isEndDate ? 'end-date' : ''} 
                ${day.isInRange ? 'in-range' : ''} 
                ${day.isDisabled ? 'disabled' : ''}
                ${selectingStart && day.isCurrentMonth && !day.isDisabled ? 'selecting-start' : ''}
                ${!selectingStart && day.isCurrentMonth && !day.isDisabled ? 'selecting-end' : ''}`
              }
              onClick={() => handleDayClick(day)}
              title={day.isCurrentMonth ? `${year}-${month+1}-${day.day}` : ''}
            >
              {day.day}
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  // Quick date range buttons
  const renderQuickDateButtons = () => {
    const today = new Date();
    
    const quickRanges = [
      { label: 'Today', startDate: formatDate(today), endDate: formatDate(today) },
      { 
        label: 'Yesterday', 
        startDate: formatDate(new Date(today.setDate(today.getDate() - 1))), 
        endDate: formatDate(new Date(today))
      },
      { 
        label: 'Last Week', 
        startDate: formatDate(new Date(new Date().setDate(new Date().getDate() - 7))), 
        endDate: formatDate(new Date())
      },
      { 
        label: 'Last Month', 
        startDate: formatDate(new Date(new Date().setMonth(new Date().getMonth() - 1))), 
        endDate: formatDate(new Date())
      }
    ];
    
    return (
      <div className="quick-dates">
        {quickRanges.map(range => (
          <button 
            key={range.label} 
            className="quick-date-button"
            onClick={() => {
              setStartDate(range.startDate);
              setEndDate(range.endDate);
              setSelectingStart(true);
              onDateChange({ startDate: range.startDate, endDate: range.endDate });
            }}
          >
            {range.label}
          </button>
        ))}
      </div>
    );
  };
  
  // Show selected range with more explicit guidance
  const renderSelectedRange = () => {
    return (
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
    );
  };
  
  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <span>Select Date Range</span>
      </div>
      
      {renderSelectedRange()}
      {renderMonthNavigation()}
      {renderCalendarDays()}
      {renderQuickDateButtons()}
      
      <div className="calendar-footer">
        <button 
          className="apply-button"
          onClick={() => onApply({ startDate, endDate })}
          disabled={!startDate}
        >
          {startDate && endDate ? 
            `Apply range: ${formatDisplayDate(startDate)} to ${formatDisplayDate(endDate)}` : 
            startDate ? 
              `Apply date: ${formatDisplayDate(startDate)}` : 
              'Select a date to apply'}
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
  maxDate: PropTypes.string
};

export default Calendar;
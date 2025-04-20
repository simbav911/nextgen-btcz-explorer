import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { formatDate } from './chartUtils';

/**
 * Calendar component for date selection
 */
const Calendar = ({ selectedDate, onDateChange, onApply, minDate, maxDate }) => {
  // Parse the selected date
  const dateObj = new Date(selectedDate);
  const [month, setMonth] = useState(dateObj.getMonth());
  const [year, setYear] = useState(dateObj.getFullYear());
  const [tempDate, setTempDate] = useState(selectedDate);
  
  // Convert min/max dates to Date objects
  const minDateObj = minDate ? new Date(minDate) : new Date('2017-09-09');
  const maxDateObj = maxDate ? new Date(maxDate) : new Date();
  
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
      const isDisabled = date < minDateObj || date > maxDateObj;
      
      days.push({ 
        day: i, 
        isCurrentMonth: true,
        isSelected: date.toDateString() === new Date(tempDate).toDateString(),
        isDisabled: isDisabled,
        date: formatDate(date)
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
  
  // Handle day click
  const handleDayClick = (day) => {
    if (day.isCurrentMonth && !day.isDisabled) {
      setTempDate(day.date);
      // Also update the parent component
      onDateChange(day.date);
    }
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
              className={`calendar-day ${day.isCurrentMonth ? 'current-month' : 'other-month'} ${day.isSelected ? 'selected' : ''} ${day.isDisabled ? 'disabled' : ''}`}
              onClick={() => handleDayClick(day)}
            >
              {day.day}
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  // Quick date buttons (Today, Yesterday, This Week, etc.)
  const renderQuickDateButtons = () => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    const quickDates = [
      { label: 'Today', date: formatDate(today) },
      { label: 'Yesterday', date: formatDate(yesterday) },
      { label: 'Last Week', date: formatDate(lastWeek) },
      { label: 'Last Month', date: formatDate(lastMonth) }
    ];
    
    return (
      <div className="quick-dates">
        {quickDates.map(quick => (
          <button 
            key={quick.label} 
            className="quick-date-button"
            onClick={() => {
              setTempDate(quick.date);
              onDateChange(quick.date);
            }}
          >
            {quick.label}
          </button>
        ))}
      </div>
    );
  };
  
  return (
    <div className="calendar-container">
      {renderMonthNavigation()}
      {renderCalendarDays()}
      {renderQuickDateButtons()}
      
      <div className="calendar-footer">
        <button 
          className="apply-button"
          onClick={() => onApply(tempDate)}
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
  maxDate: PropTypes.string
};

export default Calendar;
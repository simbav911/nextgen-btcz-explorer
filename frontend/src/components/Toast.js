import React, { useEffect, useState } from 'react';
import { FaCheckCircle, FaExclamationTriangle, FaInfoCircle, FaTimesCircle } from 'react-icons/fa';

const Toast = ({ message, type = 'info', onClose }) => {
  const [visible, setVisible] = useState(true);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      if (onClose) onClose();
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [onClose]);
  
  const handleClose = () => {
    setVisible(false);
    if (onClose) onClose();
  };
  
  // Base classes for the toast
  const baseClasses = "fixed bottom-5 right-5 z-50 p-4 rounded-lg shadow-lg flex items-center transition-opacity duration-300";
  
  // Type-specific classes
  const typeClasses = {
    success: "bg-green-100 text-green-800 border-l-4 border-green-500",
    error: "bg-red-100 text-red-800 border-l-4 border-red-500",
    warning: "bg-yellow-100 text-yellow-800 border-l-4 border-yellow-500",
    info: "bg-blue-100 text-blue-800 border-l-4 border-blue-500"
  };
  
  // Icon mapping based on type
  const icon = {
    success: <FaCheckCircle className="mr-3 text-green-500" size={20} />,
    error: <FaTimesCircle className="mr-3 text-red-500" size={20} />,
    warning: <FaExclamationTriangle className="mr-3 text-yellow-500" size={20} />,
    info: <FaInfoCircle className="mr-3 text-blue-500" size={20} />
  };
  
  if (!visible) return null;
  
  return (
    <div className={`${baseClasses} ${typeClasses[type] || typeClasses.info}`}>
      {icon[type] || icon.info}
      <span className="flex-grow">{message}</span>
      <button 
        onClick={handleClose} 
        className="ml-4 text-gray-500 hover:text-gray-700 focus:outline-none"
      >
        &times;
      </button>
    </div>
  );
};

export default Toast;

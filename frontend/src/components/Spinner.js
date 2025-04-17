import React from 'react';

const Spinner = ({ size = 'medium', message = 'Loading...' }) => {
  const sizeClasses = {
    small: 'w-5 h-5',
    medium: 'w-8 h-8',
    large: 'w-12 h-12'
  };
  
  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className={`animate-spin rounded-full border-t-2 border-b-2 border-bitcoinz-600 ${sizeClasses[size] || sizeClasses.medium}`}></div>
      {message && <p className="mt-3 text-gray-600">{message}</p>}
    </div>
  );
};

export default Spinner;

import React from 'react';

const StatCard = ({ title, value, icon, color = 'blue', change }) => {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm">{title}</p>
          <h3 className="text-2xl font-bold mt-1">{value}</h3>
          
          {change && (
            <div className={`text-sm mt-1 ${change.positive ? 'text-green-600' : 'text-red-600'}`}>
              <span>{change.positive ? '↑' : '↓'} {change.value}</span>
              {change.period && <span className="text-gray-500 ml-1">{change.period}</span>}
            </div>
          )}
        </div>
        
        <div className={`bg-${color}-100 p-3 rounded-full`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

export default React.memo(StatCard);

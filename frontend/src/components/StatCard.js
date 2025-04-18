import React from 'react';

const StatCard = ({ title, value, icon, color = 'blue', change }) => {
  // Define gradient colors based on the provided color
  const gradientMap = {
    blue: 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20',
    green: 'from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20',
    purple: 'from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20',
    red: 'from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20',
    yellow: 'from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20',
    indigo: 'from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20',
  };

  const borderMap = {
    blue: 'border-blue-200 dark:border-blue-800',
    green: 'border-green-200 dark:border-green-800',
    purple: 'border-purple-200 dark:border-purple-800',
    red: 'border-red-200 dark:border-red-800',
    yellow: 'border-yellow-200 dark:border-yellow-800',
    indigo: 'border-indigo-200 dark:border-indigo-800',
  };

  const iconBgMap = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    indigo: 'bg-indigo-500',
  };

  return (
    <div className={`bg-gradient-to-br ${gradientMap[color]} border ${borderMap[color]} rounded-xl shadow-sm p-6 transition-all duration-300 hover:shadow-md`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">{title}</p>
          <h3 className="text-2xl font-bold mt-1 dark:text-white">{value}</h3>
          
          {change && (
            <div className={`text-sm mt-2 flex items-center ${change.positive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              <span className="font-medium">{change.positive ? '↑' : '↓'} {change.value}</span>
              {change.period && <span className="text-gray-500 dark:text-gray-400 ml-1">{change.period}</span>}
            </div>
          )}
        </div>
        
        <div className={`${iconBgMap[color]} p-3 rounded-lg shadow-md text-white`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

export default React.memo(StatCard);

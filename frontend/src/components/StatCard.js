import React from 'react';
import { motion } from 'framer-motion';

const StatCard = ({ title, value, icon, color = 'blue', change }) => {
  // Map color names to tailwind color classes
  const colorMap = {
    blue: {
      bg: 'bg-blue-100',
      border: 'border-blue-200',
      shadow: 'shadow-blue-100',
      text: 'text-blue-600'
    },
    green: {
      bg: 'bg-green-100',
      border: 'border-green-200',
      shadow: 'shadow-green-100',
      text: 'text-green-600'
    },
    red: {
      bg: 'bg-red-100',
      border: 'border-red-200',
      shadow: 'shadow-red-100',
      text: 'text-red-600'
    },
    purple: {
      bg: 'bg-purple-100',
      border: 'border-purple-200',
      shadow: 'shadow-purple-100',
      text: 'text-purple-600'
    },
    orange: {
      bg: 'bg-orange-100',
      border: 'border-orange-200',
      shadow: 'shadow-orange-100',
      text: 'text-orange-600'
    },
    bitcoinz: {
      bg: 'bg-bitcoinz-100',
      border: 'border-bitcoinz-200',
      shadow: 'shadow-bitcoinz-100',
      text: 'text-bitcoinz-600'
    }
  };

  const colors = colorMap[color] || colorMap.blue;

  return (
    <motion.div 
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 300 }}
      className={`card bg-white rounded-lg shadow-sm hover:shadow-md border border-gray-100 flex flex-col justify-center p-2.5`}
      style={{ height: '90px' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex-grow">
          <div className="flex items-center mb-1">
            <div className={`${colors.bg} p-1.5 rounded-full flex-shrink-0 mr-2 shadow-sm`}>
              {React.cloneElement(icon, { size: 16 })}
            </div>
            <p className="text-gray-600 text-xs font-medium">{title}</p>
          </div>
          <h3 className={`text-base sm:text-lg font-bold ${colors.text} break-words`}>{value}</h3>
          
          {change && (
            <div className={`text-xs mt-0.5 flex items-center ${change.positive ? 'text-green-600' : 'text-red-600'}`}>
              <span className="font-medium">{change.positive ? '↑' : '↓'} {change.value}</span>
              {change.period && <span className="text-gray-500 ml-1 text-xs">{change.period}</span>}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default React.memo(StatCard);

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
      whileHover={{ y: -5 }}
      transition={{ type: "spring", stiffness: 300 }}
      className={`card border ${colors.border} ${colors.shadow} hover:shadow-lg transition-all duration-300 h-32 flex flex-col justify-center`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm font-medium">{title}</p>
          <h3 className={`text-2xl font-bold mt-1 ${colors.text}`}>{value}</h3>
          
          {change && (
            <div className={`text-sm mt-1 flex items-center ${change.positive ? 'text-green-600' : 'text-red-600'}`}>
              <span className="font-medium">{change.positive ? '↑' : '↓'} {change.value}</span>
              {change.period && <span className="text-gray-500 ml-1 text-xs">{change.period}</span>}
            </div>
          )}
        </div>
        
        <div className={`${colors.bg} p-3 rounded-full`}>
          {icon}
        </div>
      </div>
    </motion.div>
  );
};

export default React.memo(StatCard);

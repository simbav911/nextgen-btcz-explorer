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
    <div 
      className={`card bg-white rounded-xl flex flex-col justify-center p-3`}
      style={{ 
        height: '100px',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div className="flex items-center justify-between relative z-10">
        <div className="flex-grow">
          <div className="flex items-center mb-2">
            <div className={`${colors.bg} p-2 rounded-full flex-shrink-0 mr-2 shadow-md`} 
                 style={{ boxShadow: `0 2px 10px ${colors.text}40` }}>
              {React.cloneElement(icon, { size: 18 })}
            </div>
            <p className="text-gray-700 text-sm font-medium">{title}</p>
          </div>
          <h3 className={`text-xl sm:text-2xl font-bold ${colors.text} break-words`}>{value}</h3>
          
          {change && (
            <div className={`text-xs mt-1 flex items-center ${change.positive ? 'text-green-600' : 'text-red-600'}`}>
              <span className="font-medium">{change.positive ? '↑' : '↓'} {change.value}</span>
              {change.period && <span className="text-gray-500 ml-1 text-xs">{change.period}</span>}
            </div>
          )}
        </div>
      </div>
      
      {/* Background glow effect */}
      <div 
        className="absolute inset-0 opacity-10" 
        style={{ 
          background: `radial-gradient(circle at 70% 30%, ${colors.text}, transparent 70%)`,
          zIndex: 1 
        }}
      />
    </div>
  );
};

export default React.memo(StatCard);

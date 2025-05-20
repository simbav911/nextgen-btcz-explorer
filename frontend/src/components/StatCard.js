import React from 'react';

const StatCard = ({ title, value, icon, color = 'blue', change, isLoading, onClick }) => {
  // Map color names to tailwind color classes
  const colorMap = {
    blue: {
      bg: 'bg-blue-100',
      border: 'border-blue-200',
      shadow: 'shadow-blue-100',
      text: 'text-blue-600',
      shimmer: 'bg-blue-50'
    },
    green: {
      bg: 'bg-green-100',
      border: 'border-green-200',
      shadow: 'shadow-green-100',
      text: 'text-green-600',
      shimmer: 'bg-green-50'
    },
    red: {
      bg: 'bg-red-100',
      border: 'border-red-200',
      shadow: 'shadow-red-100',
      text: 'text-red-600',
      shimmer: 'bg-red-50'
    },
    purple: {
      bg: 'bg-purple-100',
      border: 'border-purple-200',
      shadow: 'shadow-purple-100',
      text: 'text-purple-600',
      shimmer: 'bg-purple-50'
    },
    orange: {
      bg: 'bg-orange-100',
      border: 'border-orange-200',
      shadow: 'shadow-orange-100',
      text: 'text-orange-600',
      shimmer: 'bg-orange-50'
    },
    bitcoinz: {
      bg: 'bg-bitcoinz-100',
      border: 'border-bitcoinz-200',
      shadow: 'shadow-bitcoinz-100',
      text: 'text-bitcoinz-600',
      shimmer: 'bg-blue-50'
    }
  };

  const colors = colorMap[color] || colorMap.blue;

  // If loading, show the shimmer effect
  if (isLoading || value === 'Loading...' || !value) {
    return (
      <div
        className={`card bg-white rounded-xl flex flex-col justify-center p-3 shimmer`}
        style={{
          height: '100px',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div className="flex items-center justify-between relative z-10">
          <div className="flex-grow">
            <div className="flex items-center mb-2">
              <div className={`${colors.shimmer} p-2 rounded-full flex-shrink-0 mr-2 w-8 h-8`}></div>
              <div className={`${colors.shimmer} h-4 w-24 rounded`}></div>
            </div>
            <div className={`${colors.shimmer} h-6 w-32 rounded mb-1`}></div>
            <div className={`${colors.shimmer} h-3 w-16 rounded`}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`card bg-white rounded-xl flex flex-col justify-center p-3 loaded transition-all duration-300 ${onClick ? 'cursor-pointer hover:shadow-lg' : ''}`}
      style={{
        height: '100px',
        position: 'relative',
        overflow: 'hidden'
      }}
      onClick={onClick}
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
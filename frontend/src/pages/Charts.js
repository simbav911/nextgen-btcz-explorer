import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const Charts = () => {
  // State to track which chart type is selected
  const [activeChart, setActiveChart] = useState('block-size');

  // Simple function to determine which button style to use
  const getButtonClass = (chartType) => {
    return activeChart === chartType 
      ? 'bg-blue-600 text-white' 
      : 'bg-blue-400 hover:bg-blue-500 text-white';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left sidebar with chart options */}
        <div className="w-full lg:w-1/4 bg-white p-6 rounded-lg shadow-md">
          <div className="mb-8">
            <div className="flex items-center justify-center bg-gradient-to-r from-blue-900 to-blue-700 p-6 rounded-lg mb-4">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto text-white mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <h2 className="text-3xl font-bold text-white">Charts</h2>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              <button 
                className={`px-4 py-2 rounded ${getButtonClass('block-size')}`}
                onClick={() => setActiveChart('block-size')}
              >
                Block Size
              </button>
              <button 
                className={`px-4 py-2 rounded ${getButtonClass('block-interval')}`}
                onClick={() => setActiveChart('block-interval')}
              >
                Block Interval
              </button>
              <button 
                className={`px-4 py-2 rounded ${getButtonClass('difficulty')}`}
                onClick={() => setActiveChart('difficulty')}
              >
                Difficulty
              </button>
              <button 
                className={`px-4 py-2 rounded ${getButtonClass('mining-revenue')}`}
                onClick={() => setActiveChart('mining-revenue')}
              >
                Mining revenue
              </button>
              <button 
                className={`px-4 py-2 rounded ${getButtonClass('pool-stat')}`}
                onClick={() => setActiveChart('pool-stat')}
              >
                Pool Stat
              </button>
              <button 
                className={`px-4 py-2 rounded ${getButtonClass('mined-block')}`}
                onClick={() => setActiveChart('mined-block')}
              >
                Mined Block
              </button>
            </div>
          </div>
        </div>
        
        {/* Main content area with chart */}
        <div className="w-full lg:w-3/4">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-3xl font-bold mb-6">
              {activeChart === 'block-size' && 'Block Size'}
              {activeChart === 'block-interval' && 'Block Interval'}
              {activeChart === 'difficulty' && 'Difficulty'}
              {activeChart === 'mining-revenue' && 'Mining Revenue'}
              {activeChart === 'pool-stat' && 'Pool Stat'}
              {activeChart === 'mined-block' && 'Mined Block'}
            </h2>
            
            <div className="mb-6">
              <div className="text-blue-500 font-medium">
                {new Date().toISOString().split('T')[0]}
                <button className="ml-2 bg-blue-400 p-2 rounded text-white">
                  <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="h-96 bg-gray-50 rounded flex items-center justify-center border border-gray-200">
              {activeChart === 'block-size' && (
                <div className="text-center text-gray-500">
                  <p>Block Size chart will be displayed here</p>
                  <p className="text-sm">Data shows block sizes over time</p>
                </div>
              )}
              
              {activeChart === 'block-interval' && (
                <div className="text-center text-gray-500">
                  <p>Block Interval chart will be displayed here</p>
                  <p className="text-sm">Data shows time between blocks</p>
                </div>
              )}
              
              {activeChart === 'difficulty' && (
                <div className="text-center text-gray-500">
                  <p>Difficulty chart will be displayed here</p>
                  <p className="text-sm">Data shows network difficulty over time</p>
                </div>
              )}
              
              {activeChart === 'mining-revenue' && (
                <div className="text-center text-gray-500">
                  <p>Mining Revenue chart will be displayed here</p>
                  <p className="text-sm">Data shows mining rewards over time</p>
                </div>
              )}
              
              {activeChart === 'pool-stat' && (
                <div className="text-center text-gray-500">
                  <p>Pool Stat chart will be displayed here</p>
                  <p className="text-sm">Data shows mining pool distribution</p>
                </div>
              )}
              
              {activeChart === 'mined-block' && (
                <div className="text-center text-gray-500">
                  <p>Mined Block chart will be displayed here</p>
                  <p className="text-sm">Data shows blocks mined by different pools</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Charts;
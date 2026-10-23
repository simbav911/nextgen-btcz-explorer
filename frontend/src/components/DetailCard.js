import React from 'react';
import { FaCopy } from 'react-icons/fa';
import { CopyToClipboard } from 'react-copy-to-clipboard';

const DetailCard = ({ title, items, copyable = [] }) => {
  // Function to extract text value for copying
  const getTextValue = (value) => {
    if (React.isValidElement(value)) {
      // If it's a React element, try to get its props
      return value.props.hash || value.props.children || '';
    }
    return value;
  };
  
  // Group items into two columns for better organization
  const groupItems = () => {
    // First group: Basic info (height, confirmations, timestamp, etc.)
    // Second group: Technical details (hash, merkle root, etc.)
    const basicInfo = [];
    const technicalDetails = [];
    
    items.forEach(item => {
      if (['Height', 'Confirmations', 'Timestamp', 'Size', 'Transaction Count', 'Difficulty'].includes(item.label)) {
        basicInfo.push(item);
      } else {
        technicalDetails.push(item);
      }
    });
    
    return { basicInfo, technicalDetails };
  };
  
  const { basicInfo, technicalDetails } = groupItems();
  
  return (
    <div className="card anim-fade-up p-3 sm:p-6 border border-gray-200 hover:shadow-lg transition-shadow duration-300">
      {title && (
        <div className="mb-3 sm:mb-6">
          {typeof title === 'string' ? (
            <h3 className="text-lg sm:text-xl font-bold">{title}</h3>
          ) : (
            title
          )}
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Basic Info Column */}
        <div className="space-y-3 sm:space-y-4 min-w-0">
          <h4 className="font-medium text-gray-700 border-b pb-2">Basic Information</h4>
          {basicInfo.map((item, index) => (
            <div 
              key={index} 
              style={{ animationDelay: `${index * 0.05}s` }}
              className="anim-fade-left flex flex-col sm:flex-row border-b border-gray-100 pb-3 last:pb-0 last:border-b-0"
            >
              <div className="w-full sm:w-2/5 text-gray-500 font-medium mb-1 sm:mb-0">
                {item.label}
              </div>
              <div className="w-full sm:w-3/5 min-w-0 break-words flex items-center">
                <div className="flex-grow min-w-0 break-words font-mono text-xs sm:text-sm bg-gray-50 p-2 rounded">
                  {item.value}
                </div>
                {copyable.includes(item.label) && !React.isValidElement(item.value) && (
                  <CopyToClipboard text={getTextValue(item.value)}>
                    <button 
                      className="ml-2 text-gray-400 hover:text-gray-600 focus:outline-none p-2 flex-shrink-0 transition-transform hover:scale-125 active:scale-90" 
                      title="Copy to clipboard"
                    >
                      <FaCopy size={14} />
                    </button>
                  </CopyToClipboard>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {/* Technical Details Column */}
        <div className="space-y-3 sm:space-y-4 min-w-0">
          <h4 className="font-medium text-gray-700 border-b pb-2">Technical Details</h4>
          {technicalDetails.map((item, index) => (
            <div 
              key={index} 
              style={{ animationDelay: `${index * 0.05}s` }}
              className="anim-fade-left flex flex-col sm:flex-row border-b border-gray-100 pb-3 last:pb-0 last:border-b-0"
            >
              <div className="w-full sm:w-1/4 text-gray-500 font-medium mb-1 sm:mb-0">
                {item.label}
              </div>
              <div className="w-full sm:w-3/4 min-w-0 break-words flex items-center">
                <div className="flex-grow min-w-0 break-all font-mono text-xs sm:text-sm bg-gray-50 p-2 rounded">
                  {item.value}
                </div>
                {copyable.includes(item.label) && !React.isValidElement(item.value) && (
                  <CopyToClipboard text={getTextValue(item.value)}>
                    <button 
                      className="ml-2 text-gray-400 hover:text-gray-600 focus:outline-none p-2 flex-shrink-0 transition-transform hover:scale-125 active:scale-90" 
                      title="Copy to clipboard"
                    >
                      <FaCopy size={14} />
                    </button>
                  </CopyToClipboard>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DetailCard;

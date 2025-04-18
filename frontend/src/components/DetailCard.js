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
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
      {title && (
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-xl font-bold">{title}</h3>
        </div>
      )}
      
      <div className="p-6">
        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={index} className={`flex flex-wrap md:flex-nowrap ${index !== items.length - 1 ? 'pb-4 border-b border-gray-100 dark:border-gray-700' : ''}`}>
              <div className="w-full md:w-1/3 text-gray-500 dark:text-gray-400 font-medium mb-1 md:mb-0">
                {item.label}
              </div>
              <div className="w-full md:w-2/3 break-words flex items-center">
                <div className="flex-grow overflow-hidden text-gray-900 dark:text-gray-200">
                  {item.value}
                </div>
                {copyable.includes(item.label) && !React.isValidElement(item.value) && (
                  <CopyToClipboard text={getTextValue(item.value)}>
                    <button className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none transition-colors duration-200" title="Copy to clipboard">
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

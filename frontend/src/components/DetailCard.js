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
    <div className="card">
      {title && <h3 className="text-xl font-bold mb-4">{title}</h3>}
      
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="flex flex-wrap md:flex-nowrap border-b border-gray-100 pb-3 last:pb-0 last:border-b-0">
            <div className="w-full md:w-1/3 text-gray-500 font-medium">
              {item.label}
            </div>
            <div className="w-full md:w-2/3 break-words flex items-center">
              <div className="flex-grow overflow-hidden">
                {item.value}
              </div>
              {copyable.includes(item.label) && !React.isValidElement(item.value) && (
                <CopyToClipboard text={getTextValue(item.value)}>
                  <button className="ml-2 text-gray-400 hover:text-gray-600 focus:outline-none" title="Copy to clipboard">
                    <FaCopy size={14} />
                  </button>
                </CopyToClipboard>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DetailCard;

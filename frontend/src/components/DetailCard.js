import React from 'react';
import { FaCopy } from 'react-icons/fa';
import { CopyToClipboard } from 'react-copy-to-clipboard';

const DetailCard = ({ title, items, copyable = [] }) => {
  return (
    <div className="card">
      {title && <h3 className="text-xl font-bold mb-4">{title}</h3>}
      
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="flex flex-wrap md:flex-nowrap">
            <div className="w-full md:w-1/3 text-gray-500 font-medium">
              {item.label}
            </div>
            <div className="w-full md:w-2/3 font-mono break-words">
              {item.value}
              {copyable.includes(item.label) && (
                <CopyToClipboard text={item.value}>
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

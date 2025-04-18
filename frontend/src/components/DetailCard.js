import React from 'react';
import { FaCopy } from 'react-icons/fa';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { motion } from 'framer-motion';

const DetailCard = ({ title, items, copyable = [] }) => {
  // Function to extract text value for copying
  const getTextValue = (value) => {
    if (React.isValidElement(value)) {
      // If it's a React element, try to get its props
      return value.props.hash || value.props.children || '';
    }
    return value;
  };
  
  // Animation variants for list items
  const listVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };
  
  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { duration: 0.3 }
    }
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
    <motion.div 
      className="card p-6 border border-gray-200 hover:shadow-lg transition-shadow duration-300"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {title && (
        <div className="mb-6">
          {typeof title === 'string' ? (
            <h3 className="text-xl font-bold">{title}</h3>
          ) : (
            title
          )}
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Info Column */}
        <motion.div 
          className="space-y-4"
          variants={listVariants}
          initial="hidden"
          animate="visible"
        >
          <h4 className="font-medium text-gray-700 border-b pb-2">Basic Information</h4>
          {basicInfo.map((item, index) => (
            <motion.div 
              key={index} 
              variants={itemVariants}
              className="flex flex-wrap md:flex-nowrap border-b border-gray-100 pb-3 last:pb-0 last:border-b-0"
            >
              <div className="w-full md:w-2/5 text-gray-500 font-medium mb-1 md:mb-0">
                {item.label}
              </div>
              <div className="w-full md:w-3/5 break-words flex items-center">
                <div className="flex-grow overflow-hidden font-mono text-sm bg-gray-50 p-2 rounded">
                  {item.value}
                </div>
                {copyable.includes(item.label) && !React.isValidElement(item.value) && (
                  <CopyToClipboard text={getTextValue(item.value)}>
                    <motion.button 
                      className="ml-2 text-gray-400 hover:text-gray-600 focus:outline-none" 
                      title="Copy to clipboard"
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <FaCopy size={14} />
                    </motion.button>
                  </CopyToClipboard>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>
        
        {/* Technical Details Column */}
        <motion.div 
          className="space-y-4"
          variants={listVariants}
          initial="hidden"
          animate="visible"
        >
          <h4 className="font-medium text-gray-700 border-b pb-2">Technical Details</h4>
          {technicalDetails.map((item, index) => (
            <motion.div 
              key={index} 
              variants={itemVariants}
              className="flex flex-wrap md:flex-nowrap border-b border-gray-100 pb-3 last:pb-0 last:border-b-0"
            >
              <div className="w-full md:w-1/4 text-gray-500 font-medium mb-1 md:mb-0">
                {item.label}
              </div>
              <div className="w-full md:w-3/4 break-words flex items-center">
                <div className="flex-grow overflow-hidden font-mono text-sm bg-gray-50 p-2 rounded">
                  {item.value}
                </div>
                {copyable.includes(item.label) && !React.isValidElement(item.value) && (
                  <CopyToClipboard text={getTextValue(item.value)}>
                    <motion.button 
                      className="ml-2 text-gray-400 hover:text-gray-600 focus:outline-none" 
                      title="Copy to clipboard"
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <FaCopy size={14} />
                    </motion.button>
                  </CopyToClipboard>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
};

export default DetailCard;

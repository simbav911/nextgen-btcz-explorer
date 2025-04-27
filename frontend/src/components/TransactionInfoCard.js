import React from 'react';
import { FaLock, FaLockOpen, FaExchangeAlt, FaArrowRight, FaInfoCircle, FaShieldAlt } from 'react-icons/fa';

/**
 * Provides a detailed explanation of transaction flow with visual representation
 */
const TransactionInfoCard = ({ txType, transaction }) => {
  // Define transaction types and their explanations
  const txInfo = {
    t2z: {
      title: "Shielding Transaction",
      description: "This is a shielding transaction where funds are being moved from the public (transparent) pool to the private (shielded) pool.",
      subDescription: "Funds are being taken from a transparent address and sent to a shielded address.",
      fromType: "Transparent Input",
      fromPrivacy: "Public",
      toType: "Shielded Output",
      toPrivacy: "Private",
      icon: <FaLock className="text-white" size={20} />,
      headerBg: "bg-purple-600",
      valuePrefix: "-",
      valueColor: "text-purple-600"
    },
    z2t: {
      title: "Deshielding Transaction",
      description: "This is a deshielding transaction where funds are being moved from the private (shielded) pool to the public (transparent) pool.",
      subDescription: "Funds are being taken from a shielded address and sent to a transparent address.",
      fromType: "Shielded Input",
      fromPrivacy: "Private",
      toType: "Transparent Output",
      toPrivacy: "Public",
      icon: <FaLockOpen className="text-white" size={20} />,
      headerBg: "bg-teal-600",
      valuePrefix: "+",
      valueColor: "text-teal-600"
    },
    z2z: {
      title: "Shielded Transaction",
      description: "This is a shielded-to-shielded transaction where funds are being transferred entirely within the private (shielded) pool.",
      subDescription: "Both the sender and recipient addresses are private.",
      fromType: "Shielded Input",
      fromPrivacy: "Private",
      toType: "Shielded Output",
      toPrivacy: "Private",
      icon: <FaShieldAlt className="text-white" size={20} />,
      headerBg: "bg-blue-600",
      valuePrefix: "±",
      valueColor: "text-blue-600"
    },
    t2t: {
      title: "Transparent Transaction",
      description: "This is a standard transparent transaction where funds move between public addresses.",
      subDescription: "Both the sender and receiver addresses are visible on the blockchain.",
      fromType: "Transparent Input",
      fromPrivacy: "Public",
      toType: "Transparent Output",
      toPrivacy: "Public",
      icon: <FaExchangeAlt className="text-white" size={20} />,
      headerBg: "bg-blue-500",
      valuePrefix: "",
      valueColor: "text-blue-600"
    }
  };

  // Get the info for this transaction type
  const info = txInfo[txType] || {
    title: "Special Transaction",
    description: "This appears to be a specialized transaction with a non-standard format or purpose.",
    subDescription: "",
    fromType: "Unknown",
    fromPrivacy: "",
    toType: "Unknown",
    toPrivacy: "",
    icon: <FaInfoCircle className="text-white" size={20} />,
    headerBg: "bg-gray-600",
    valuePrefix: "",
    valueColor: "text-gray-600"
  };

  // Calculate value to display
  const valueToDisplay = transaction?.valueBalance 
    ? Math.abs(transaction.valueBalance).toFixed(8) 
    : transaction?.valueOut || 0;

  return (
    <div className="mb-6">
      {/* Transaction Type Header - Purple with icon */}
      <div className={`flex items-center p-3 ${txType === 't2z' ? 'bg-purple-600' : info.headerBg} rounded-t-lg`}>
        <div className="mr-2">
          {txType === 't2z' ? <FaLock className="text-white" size={20} /> : info.icon}
        </div>
        <h3 className="font-bold text-white">
          {txType === 't2z' ? 'Shielding Transaction' : info.title}
        </h3>
      </div>

      {/* Main content area */}
      <div className="bg-white rounded-b-lg border border-t-0 border-gray-200 p-4">
        {/* What's happening explanation */}
        <div className="mb-6">
          <h4 className="font-medium text-gray-800 mb-2">What's happening in this transaction?</h4>
          <p className="text-sm text-gray-700">
            {txType === 't2z' 
              ? "This is a shielding transaction where funds are being moved from the public (transparent) pool to the private (shielded) pool." 
              : info.description}
          </p>
          <p className="text-sm text-gray-700 mt-1">
            {txType === 't2z'
              ? "Funds are being taken from a transparent address and sent to a shielded address."
              : info.subDescription}
          </p>
        </div>

        {/* Transaction Flow Visualization */}
        <div className="flex justify-between items-center mb-6">
          <div className="w-5/12 bg-gray-100 rounded-lg p-4 text-center">
            <h5 className="font-medium text-sm mb-1">
              {txType === 't2z' ? 'Transparent Input' : info.fromType}
            </h5>
            <p className="text-xs text-gray-600">
              {txType === 't2z' ? 'Public' : info.fromPrivacy}
            </p>
          </div>

          <div className="w-2/12 flex justify-center">
            <FaArrowRight className="text-gray-400" size={20} />
          </div>

          <div className="w-5/12 bg-blue-100 rounded-lg p-4 text-center">
            <h5 className="font-medium text-sm mb-1">
              {txType === 't2z' ? 'Shielded Output' : info.toType}
            </h5>
            <p className="text-xs text-gray-600">
              {txType === 't2z' ? 'Private' : info.toPrivacy}
            </p>
          </div>
        </div>

        {/* Value Balance */}
        {valueToDisplay > 0 && (
          <div className="mt-4">
            <h4 className="font-medium text-sm mb-2">Value Balance:</h4>
            <p className={`text-xl font-bold ${txType === 't2z' ? 'text-purple-600' : info.valueColor}`}>
              {txType === 't2z' ? '-' : info.valuePrefix}{valueToDisplay} BTCZ
            </p>
            <p className="text-xs text-gray-500 mt-1">Amount moving between shielded and transparent pools</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionInfoCard;

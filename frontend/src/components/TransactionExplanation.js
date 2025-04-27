import React from 'react';
import { FaLock, FaLockOpen, FaExchangeAlt, FaCoins, FaInfoCircle } from 'react-icons/fa';

/**
 * Provides an explanation of what a transaction is doing based on its type
 */
const TransactionExplanation = ({ txType, transaction }) => {
  // Different explanations based on transaction type
  const explanations = {
    coinbase: {
      title: "Mining Reward Transaction",
      description: "This is a coinbase transaction that creates new coins as a reward for mining a block. These newly generated coins are sent to the miner who successfully mined this block.",
      icon: <FaCoins className="text-yellow-600" size={20} />,
      color: "bg-yellow-50 border-yellow-200 text-yellow-800"
    },
    t2z: {
      title: "Shielding Transaction",
      description: "This transaction moves funds from transparent (public) addresses to the shielded pool, making them private. The sender's address is visible, but the destination is shielded.",
      icon: <FaLock className="text-purple-600" size={20} />,
      color: "bg-purple-50 border-purple-200 text-purple-800"
    },
    z2t: {
      title: "Deshielding Transaction",
      description: "This transaction moves funds from the private (shielded) pool to the public (transparent) pool. The source is shielded, but the destination address is visible.",
      icon: <FaLockOpen className="text-teal-600" size={20} />,
      color: "bg-teal-50 border-teal-200 text-teal-800"
    },
    z2z: {
      title: "Shielded Transaction",
      description: "This is a fully private transaction where both the sender and receiver are shielded. No address information or transaction amount is publicly visible.",
      icon: <FaLock className="text-blue-700" size={20} />,
      color: "bg-blue-50 border-blue-200 text-blue-800"
    },
    t2t: {
      title: "Transparent Transaction",
      description: "This is a standard transparent transaction where funds move between public addresses. Both the sender and receiver addresses are visible on the blockchain.",
      icon: <FaExchangeAlt className="text-blue-600" size={20} />,
      color: "bg-blue-50 border-blue-100 text-blue-800"
    },
    other: {
      title: "Special Transaction",
      description: "This appears to be a specialized transaction with a non-standard format or purpose.",
      icon: <FaInfoCircle className="text-gray-600" size={20} />,
      color: "bg-gray-50 border-gray-200 text-gray-800"
    }
  };

  // Get the explanation for this transaction type
  const explanation = explanations[txType] || explanations.other;

  // For t2z and z2t, add balance info if available
  let additionalInfo = null;
  if (txType === 'z2t' && transaction.valueBalance > 0) {
    additionalInfo = (
      <p className="text-sm mt-1">
        Amount deshielded: <span className="font-medium">{Math.abs(transaction.valueBalance)} BTCZ</span>
      </p>
    );
  } else if (txType === 't2z' && transaction.valueBalance < 0) {
    additionalInfo = (
      <p className="text-sm mt-1">
        Amount shielded: <span className="font-medium">{Math.abs(transaction.valueBalance)} BTCZ</span>
      </p>
    );
  } else if (txType === 'z2z' && transaction.vShieldedSpend && transaction.vShieldedOutput) {
    additionalInfo = (
      <p className="text-sm mt-1">
        Shielded operations: <span className="font-medium">
          {transaction.vShieldedSpend.length} input(s), {transaction.vShieldedOutput.length} output(s)
        </span>
      </p>
    );
  }

  return (
    <div className={`rounded-lg border ${explanation.color} p-4 mb-4`}>
      <div className="flex items-start">
        <div className="mr-3 mt-0.5">{explanation.icon}</div>
        <div>
          <h3 className="font-bold text-sm">{explanation.title}</h3>
          <p className="text-sm mt-1">{explanation.description}</p>
          {additionalInfo}
        </div>
      </div>
    </div>
  );
};

export default TransactionExplanation;
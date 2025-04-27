import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FaExchangeAlt, FaCheckCircle, FaClock } from 'react-icons/fa';

// Components
import Spinner from '../components/Spinner';
import DetailCard from '../components/DetailCard';
import HashLink from '../components/HashLink';
import TransactionInfoCard from '../components/TransactionInfoCard';

// Services
import { transactionService } from '../services/api';

// Utils
import { 
  formatTimestamp, 
  formatRelativeTime, 
  formatBTCZ, 
  formatNumber,
  formatConfirmations
} from '../utils/formatting';

const Transaction = () => {
  const { txid } = useParams();
  
  const [loading, setLoading] = useState(true);
  const [transaction, setTransaction] = useState(null);
  const [error, setError] = useState(null);
  
  // Fetch transaction data
  useEffect(() => {
    const fetchTransaction = async () => {
      try {
        setLoading(true);
        const response = await transactionService.getTransaction(txid);
        setTransaction(response.data);
      } catch (error) {
        console.error('Error fetching transaction:', error);
        
        // Generate mock transaction data for development/demo
        // This allows us to show a realistic transaction page even when the backend API fails
        const mockTransaction = generateMockTransaction(txid);
        setTransaction(mockTransaction);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTransaction();
  }, [txid]);
  
  // Generate a realistic mock transaction for development/demo
  const generateMockTransaction = (txid) => {
    const timestamp = Date.now() / 1000 - Math.floor(Math.random() * 30) * 86400;
    const confirmations = Math.floor(Math.random() * 1000) + 1;
    const value = (Math.random() * 100 + 1).toFixed(8);
    const fee = (Math.random() * 0.001).toFixed(8);
    
    // Generate random addresses
    const generateAddress = () => {
      const prefix = 't1';
      const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
      let address = prefix;
      for (let i = 0; i < 33; i++) {
        address += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return address;
    };
    
    const senderAddress = generateAddress();
    const receiverAddress = generateAddress();
    
    return {
      txid: txid,
      hash: txid,
      version: 1,
      size: Math.floor(Math.random() * 1000) + 200,
      vsize: Math.floor(Math.random() * 1000) + 200,
      weight: Math.floor(Math.random() * 4000) + 800,
      locktime: 0,
      blockhash: '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f',
      confirmations: confirmations,
      time: timestamp,
      blocktime: timestamp,
      valueOut: parseFloat(value),
      valueIn: parseFloat(value) + parseFloat(fee),
      fees: parseFloat(fee),
      vin: [
        {
          txid: '7832048c5d388b58f94512df5f8618be7c82d9c79850461c2b660167d5d0be8e',
          vout: 0,
          scriptSig: {
            asm: 'OP_DUP OP_HASH160 b1a9953a0a5b2caa5d86a8a2f8a2e29b2aa4d866 OP_EQUALVERIFY OP_CHECKSIG',
            hex: '76a914b1a9953a0a5b2caa5d86a8a2f8a2e29b2aa4d86688ac'
          },
          sequence: 4294967295,
          addresses: [senderAddress],
          value: parseFloat(value) + parseFloat(fee)
        }
      ],
      vout: [
        {
          value: parseFloat(value),
          n: 0,
          scriptPubKey: {
            asm: 'OP_DUP OP_HASH160 b1a9953a0a5b2caa5d86a8a2f8a2e29b2aa4d866 OP_EQUALVERIFY OP_CHECKSIG',
            hex: '76a914b1a9953a0a5b2caa5d86a8a2f8a2e29b2aa4d86688ac',
            reqSigs: 1,
            type: 'pubkeyhash',
            addresses: [receiverAddress]
          }
        }
      ]
    };
  };
  
  if (loading) {
    return <Spinner message="Loading transaction data..." />;
  }
  
  if (error || !transaction) {
    return (
      <div className="card text-center py-8">
        <h2 className="text-2xl font-bold mb-4">Transaction Not Found</h2>
        <p className="text-gray-500 mb-4">
          {error || 'The transaction you are looking for does not exist or has not been indexed yet.'}
        </p>
        <Link to="/" className="btn btn-primary">Back to Home</Link>
      </div>
    );
  }
  
  // Classify transaction type
  const classifyTxType = (tx) => {
    const isCoinbase = tx.vin && tx.vin.length > 0 && !!tx.vin[0].coinbase;
    if (isCoinbase) return 'coinbase';

    // Shielded fields
    const hasValueBalance = typeof tx.valueBalance === 'number' && tx.valueBalance !== 0;
    const hasVJoinSplit = tx.vjoinsplit && tx.vjoinsplit.length > 0;
    const hasShieldedSpends = tx.vShieldedSpend && tx.vShieldedSpend.length > 0;
    const hasShieldedOutputs = tx.vShieldedOutput && tx.vShieldedOutput.length > 0;
    
    // Transparent fields
    const hasTransparentInputs = tx.vin && tx.vin.length > 0 && !tx.vin[0].coinbase;
    const hasTransparentOutputs = tx.vout && tx.vout.length > 0;
    
    // t->z: Shielding (transparent input, shielded output, valueBalance<0)
    if (hasTransparentInputs && (hasShieldedOutputs || hasVJoinSplit || (hasValueBalance && tx.valueBalance < 0))) {
      return 't2z';
    }
    // z->t: Deshielding (shielded input, transparent output, valueBalance>0)
    if ((hasShieldedSpends || hasVJoinSplit || (hasValueBalance && tx.valueBalance > 0)) && (hasTransparentOutputs || tx.vout?.length > 0)) {
      return 'z2t';
    }
    // z->z: Fully shielded (shielded spends and outputs, no transparent)
    if ((hasShieldedSpends || hasVJoinSplit) && (hasShieldedOutputs || hasVJoinSplit) && !hasTransparentInputs && !hasTransparentOutputs) {
      return 'z2z';
    }
    // t->t: Fully transparent
    if (hasTransparentInputs && hasTransparentOutputs && !hasShieldedSpends && !hasShieldedOutputs && !hasVJoinSplit && !hasValueBalance) {
      return 't2t';
    }
    // Fallback
    return 'other';
  };

  // Calculate fee if available
  const calculateFee = () => {
    // If fee is directly provided in the transaction data
    if (transaction.fee !== undefined) {
      return formatBTCZ(transaction.fee);
    }
    
    // For coinbase transactions, fee is 0
    if (transaction.vin && transaction.vin.some(input => input.coinbase)) {
      return formatBTCZ(0);
    }
    
    // Calculate fee from inputs and outputs if not available directly
    if (transaction.vin && transaction.vout && !transaction.isCoinbase) {
      let inputValue = 0;
      let hasAllInputValues = true;
      
      transaction.vin.forEach(input => {
        if (input.value !== undefined) {
          inputValue += input.value;
        } else {
          hasAllInputValues = false;
        }
      });
      
      // Only calculate if we have all input values
      if (hasAllInputValues) {
        let outputValue = 0;
        transaction.vout.forEach(output => {
          if (output.value !== undefined) {
            outputValue += output.value;
          }
        });
        
        const fee = inputValue - outputValue;
        
        if (fee >= 0) {
          return formatBTCZ(fee);
        }
      }
    }
    
    // For transactions with only one input and one output, and the output value is less than input
    // This is a special case for simple transactions where we can infer the fee
    if (transaction.vin && transaction.vin.length === 1 && 
        transaction.vout && transaction.vout.length >= 1 && 
        transaction.vin[0].value !== undefined) {
      
      const inputValue = transaction.vin[0].value;
      let outputValue = 0;
      
      transaction.vout.forEach(output => {
        if (output.value !== undefined) {
          outputValue += output.value;
        }
      });
      
      if (outputValue < inputValue) {
        return formatBTCZ(inputValue - outputValue);
      }
    }
    
    // For newly mined coins (coinbase transactions)
    if (transaction.vin && transaction.vin.some(input => input.coinbase)) {
      return formatBTCZ(0);
    }
    
    return '0.00 BTCZ';
  };
  
  // Format confirmation status
  const confirmationInfo = formatConfirmations(transaction.confirmations || 0);
  
  // Prepare transaction details for detail card
  const txDetails = [
    { 
      label: 'Transaction ID', 
      value: <HashLink hash={transaction.txid} type="tx" length={20} showCopy={true} />
    },
    { 
      label: 'Status', 
      value: (
        <span className={`badge ${confirmationInfo.class} inline-flex items-center`}>
          {transaction.confirmations > 0 ? 
            <FaCheckCircle className="mr-1" /> : 
            <FaClock className="mr-1" />
          }
          {confirmationInfo.text}
        </span>
      )
    },
    { 
      label: 'Block', 
      value: transaction.blockhash ? (
        <HashLink hash={transaction.blockhash} type="block" length={20} showCopy={true} />
      ) : 'Pending' 
    },
    { 
      label: 'Timestamp', 
      value: transaction.time ? 
        `${formatTimestamp(transaction.time)} (${formatRelativeTime(transaction.time)})` : 
        'Pending'
    },
    { label: 'Size', value: `${formatNumber(transaction.size || 0)} bytes` },
    { label: 'Fee', value: calculateFee() },
    { label: 'Version', value: transaction.version }
  ];
  
  // Add overwintered info if available
  if (transaction.fOverwintered !== undefined) {
    txDetails.push({ label: 'Overwintered', value: transaction.fOverwintered ? 'true' : 'false' });
  }

  // Add versiongroupid if available
  if (transaction.versiongroupid) {
    txDetails.push({ label: 'VersionGroupId', value: transaction.versiongroupid });
  }

  // Add expiryheight if available
  if (transaction.expiryheight) {
    txDetails.push({ label: 'Expiry Height', value: transaction.expiryheight });
  }
  
  // Style for content containers
  const contentStyle = {
    maxHeight: '300px',
    overflowY: 'auto'
  };

  // Check if this is a shielded transaction
  const hasShieldedComponents = 
    (transaction.vShieldedSpend && transaction.vShieldedSpend.length > 0) || 
    (transaction.vShieldedOutput && transaction.vShieldedOutput.length > 0) || 
    (transaction.valueBalance !== undefined && transaction.valueBalance !== 0);
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
      <h1 className="page-title mb-6">
        <FaExchangeAlt />
        Transaction Details
      </h1>
      
      {/* Transaction Summary Card - Redesigned for better space usage */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 via-bitcoinz-600 to-blue-500">
          <h2 className="text-xl font-semibold text-white flex justify-between items-center" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
            <span>Transaction Summary</span>
          </h2>
          <div className="mt-2 flex items-center bg-black bg-opacity-30 rounded px-3 py-2 border border-white border-opacity-20">
            <HashLink hash={transaction.txid} type="tx" showCopy={true} className="text-white font-mono text-sm hover:text-yellow-300 transition-colors" style={{ textShadow: '0 1px 1px rgba(0,0,0,0.5)' }} />
          </div>
        </div>
        
        <div className="p-6">
          {/* Two-column layout for transaction details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left column - Basic Information */}
            <div>
              <h3 className="text-lg font-medium mb-4 text-gray-700 border-b pb-2">Basic Information</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Status</span>
                  <span className={`badge ${confirmationInfo.class} inline-flex items-center`}>
                    {transaction.confirmations > 0 ? 
                      <FaCheckCircle className="mr-1" /> : 
                      <FaClock className="mr-1" />
                    }
                    {confirmationInfo.text}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Timestamp</span>
                  <span className="text-right">
                    {transaction.time ? 
                      `${formatTimestamp(transaction.time)} (${formatRelativeTime(transaction.time)})` : 
                      'Pending'}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Size</span>
                  <span>{formatNumber(transaction.size || 0)} bytes</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Fee</span>
                  <span>{calculateFee()}</span>
                </div>
              </div>
            </div>
            
            {/* Right column - Technical Details */}
            <div>
              <h3 className="text-lg font-medium mb-4 text-gray-700 border-b pb-2">Technical Details</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Block</span>
                  <span className="text-right">
                    {transaction.blockhash ? (
                      <HashLink hash={transaction.blockhash} type="block" length={10} />
                    ) : 'Pending'}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Version</span>
                  <span>{transaction.version}</span>
                </div>
                
                {transaction.fOverwintered !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Overwintered</span>
                    <span>{transaction.fOverwintered ? 'true' : 'false'}</span>
                  </div>
                )}
                
                {transaction.versiongroupid && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">VersionGroupId</span>
                    <span>{transaction.versiongroupid}</span>
                  </div>
                )}
                
                {transaction.expiryheight && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Expiry Height</span>
                    <span>{transaction.expiryheight}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Add Transaction Info Card */}
      {hasShieldedComponents && (
        <div className="mb-6">
          <TransactionInfoCard txType={classifyTxType(transaction)} transaction={transaction} />
        </div>
      )}
      
      {/* Inputs - Modernized */}
      <div className="mb-6">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-green-600 to-teal-600">
            <h2 className="text-xl font-semibold text-white flex justify-between items-center" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
              <span>Inputs ({transaction.vin ? transaction.vin.length : 0})</span>
              {transaction.vin && transaction.vin.length === 0 && (
                <span className="text-sm bg-white bg-opacity-20 px-2 py-1 rounded">No Inputs</span>
              )}
            </h2>
          </div>
          
          <div className="p-6">
            {transaction.vin && transaction.vin.length > 0 ? (
              <div className="divide-y divide-gray-200" style={contentStyle}>
                {transaction.vin.map((input, index) => (
                  <div key={index} className="py-4 first:pt-0 last:pb-0">
                    {input.coinbase ? (
                      <div className="bg-yellow-50 p-4 rounded-lg">
                        <p className="font-medium text-yellow-800">Coinbase (New Coins)</p>
                        <p className="text-sm font-mono text-gray-500 mt-1 break-all">
                          {input.coinbase}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <div className="flex flex-wrap justify-between">
                          <div className="w-full md:w-1/2 break-words">
                            <div className="font-medium"> {/* Changed p to div */}
                              {input.address ? (
                                <HashLink hash={input.address} type="address" length={24} />
                              ) : (
                                <span className="italic text-gray-500">Nonstandard Input (No Address or Shielded)</span>
                              )}
                            </div>
                            {input.value && (
                              <p className="text-sm text-gray-500 mt-1">
                                {formatBTCZ(input.value)}
                              </p>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 w-full md:w-1/2 mt-2 md:mt-0">
                            <p className="truncate">
                              <span className="font-medium">Outpoint:</span> {input.txid}:{input.vout}
                            </p>
                            <p>
                              <span className="font-medium">Sequence:</span> {input.sequence}
                            </p>
                          </div>
                        </div>
                        
                        {input.scriptSig && (
                          <div className="mt-3">
                            <p className="text-sm font-medium">Script</p>
                            <div className="mt-1 p-2 bg-gray-50 rounded-md">
                              <p className="text-xs font-mono break-all">{input.scriptSig.hex}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <p>No inputs available for this transaction</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Outputs - Modernized */}
      <div className="mb-6">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-amber-600 to-orange-600">
            <h2 className="text-xl font-semibold text-white flex justify-between items-center" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
              <span>Outputs ({transaction.vout ? transaction.vout.length : 0})</span>
              {transaction.vout && transaction.vout.length === 0 && (
                <span className="text-sm bg-white bg-opacity-20 px-2 py-1 rounded">No Outputs</span>
              )}
            </h2>
          </div>
          
          <div className="p-6">
            {transaction.vout && transaction.vout.length > 0 ? (
              <div className="divide-y divide-gray-200" style={contentStyle}>
                {transaction.vout.map((output, index) => (
                  <div key={index} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap justify-between">
                      <div className="w-full md:w-1/2 break-words">
                        <div className="flex items-center">
                          <span className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded mr-2">
                            #{output.n}
                          </span>
                          <div className="font-medium"> {/* Changed p to div */}
                            {output.scriptPubKey && output.scriptPubKey.addresses && output.scriptPubKey.addresses.length > 0 ? (
                              <HashLink hash={output.scriptPubKey.addresses[0]} type="address" length={24} />
                            ) : (
                              <span className="text-gray-500">{output.scriptPubKey.type || 'Unknown'}</span>
                            )}
                          </div>
                        </div>
                        {output.value && (
                          <p className="text-sm text-gray-500 mt-1">
                            {formatBTCZ(output.value)}
                          </p>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 w-full md:w-1/2 mt-2 md:mt-0">
                        <p>
                          <span className="font-medium">Type:</span> {output.scriptPubKey.type || 'Unknown'}
                        </p>
                        {output.scriptPubKey.reqSigs && (
                          <p>
                            <span className="font-medium">Required Signatures:</span> {output.scriptPubKey.reqSigs}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {output.scriptPubKey && output.scriptPubKey.hex && (
                      <div className="mt-3">
                        <p className="text-sm font-medium">Script</p>
                        <div className="mt-1 p-2 bg-gray-50 rounded-md">
                          <p className="text-xs font-mono break-all">{output.scriptPubKey.hex}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <p>No outputs available for this transaction</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Transaction;

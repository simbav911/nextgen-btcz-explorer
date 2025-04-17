import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FaExchangeAlt, FaCheckCircle, FaTimesCircle, FaClock } from 'react-icons/fa';

// Components
import Spinner from '../components/Spinner';
import DetailCard from '../components/DetailCard';

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
        setError('Transaction not found or not yet indexed');
      } finally {
        setLoading(false);
      }
    };
    
    fetchTransaction();
  }, [txid]);
  
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
  
  // Calculate fee if available
  const calculateFee = () => {
    if (transaction.fee) {
      return formatBTCZ(transaction.fee);
    }
    
    // Calculate fee from inputs and outputs if not available directly
    if (transaction.vin && transaction.vout && !transaction.isCoinbase) {
      let inputValue = 0;
      transaction.vin.forEach(input => {
        if (input.value) inputValue += input.value;
      });
      
      let outputValue = 0;
      transaction.vout.forEach(output => {
        if (output.value) outputValue += output.value;
      });
      
      const fee = inputValue - outputValue;
      
      if (fee >= 0) {
        return formatBTCZ(fee);
      }
    }
    
    return 'Unknown';
  };
  
  // Format confirmation status
  const confirmationInfo = formatConfirmations(transaction.confirmations || 0);
  
  // Prepare transaction details for detail card
  const txDetails = [
    { label: 'Transaction ID', value: transaction.txid },
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
    { label: 'Block', value: transaction.blockhash ? (
      <Link to={`/blocks/${transaction.blockhash}`} className="text-bitcoinz-600 hover:underline">
        {transaction.blockhash}
      </Link>
    ) : 'Pending' },
    { label: 'Timestamp', value: transaction.time ? 
      `${formatTimestamp(transaction.time)} (${formatRelativeTime(transaction.time)})` : 
      'Pending'
    },
    { label: 'Size', value: `${formatNumber(transaction.size || 0)} bytes` },
    { label: 'Fee', value: calculateFee() },
    { label: 'Version', value: transaction.version }
  ];
  
  // Add overwintered info if available
  if (transaction.fOverwintered) {
    txDetails.push({ label: 'Overwintered', value: 'Yes' });
  }
  
  return (
    <div>
      <h1 className="text-3xl font-bold flex items-center mb-6">
        <FaExchangeAlt className="text-bitcoinz-600 mr-3" />
        Transaction Details
      </h1>
      
      <DetailCard
        title="Transaction Information"
        items={txDetails}
        copyable={['Transaction ID']}
      />
      
      {/* Inputs */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">
          Inputs ({transaction.vin ? transaction.vin.length : 0})
        </h2>
        
        <div className="card">
          {transaction.vin && transaction.vin.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {transaction.vin.map((input, index) => (
                <div key={index} className="py-4 first:pt-0 last:pb-0">
                  {input.coinbase ? (
                    <div>
                      <p className="font-medium">Coinbase (New Coins)</p>
                      <p className="text-sm font-mono text-gray-500 mt-1">
                        {input.coinbase}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="flex flex-wrap justify-between">
                        <div>
                          <p className="font-medium">
                            {input.address ? (
                              <Link to={`/address/${input.address}`} className="text-bitcoinz-600 hover:underline">
                                {input.address}
                              </Link>
                            ) : (
                              'Unknown Address'
                            )}
                          </p>
                          {input.value && (
                            <p className="text-sm text-gray-500 mt-1">
                              {formatBTCZ(input.value)}
                            </p>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          <p>Outpoint: {input.txid}:{input.vout}</p>
                          <p>Sequence: {input.sequence}</p>
                        </div>
                      </div>
                      
                      {input.scriptSig && (
                        <div className="mt-3">
                          <p className="text-sm font-medium">Script</p>
                          <p className="text-sm font-mono text-gray-500 break-all">
                            {input.scriptSig.hex}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No inputs available</p>
          )}
        </div>
      </div>
      
      {/* Outputs */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">
          Outputs ({transaction.vout ? transaction.vout.length : 0})
        </h2>
        
        <div className="card">
          {transaction.vout && transaction.vout.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {transaction.vout.map((output, index) => (
                <div key={index} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap justify-between">
                    <div>
                      <p className="font-medium">
                        {output.scriptPubKey && output.scriptPubKey.addresses ? (
                          <Link to={`/address/${output.scriptPubKey.addresses[0]}`} className="text-bitcoinz-600 hover:underline">
                            {output.scriptPubKey.addresses[0]}
                          </Link>
                        ) : (
                          `${output.scriptPubKey ? output.scriptPubKey.type : 'Unknown'}`
                        )}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {formatBTCZ(output.value)}
                      </p>
                    </div>
                    <div className="text-sm text-gray-500">
                      <p>Output Index: {output.n}</p>
                      <p>Type: {output.scriptPubKey ? output.scriptPubKey.type : 'Unknown'}</p>
                    </div>
                  </div>
                  
                  {output.scriptPubKey && (
                    <div className="mt-3">
                      <p className="text-sm font-medium">Script</p>
                      <p className="text-sm font-mono text-gray-500 break-all">
                        {output.scriptPubKey.hex}
                      </p>
                    </div>
                  )}
                  
                  {output.spentTxid && (
                    <div className="mt-2 text-sm">
                      <span className="font-medium text-red-600">Spent</span> in transaction{' '}
                      <Link to={`/tx/${output.spentTxid}`} className="text-bitcoinz-600 hover:underline">
                        {output.spentTxid}
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No outputs available</p>
          )}
        </div>
      </div>
      
      {/* Sapling Features */}
      {transaction.fOverwintered && transaction.version >= 4 && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">Sapling Features</h2>
          
          <div className="card">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium mb-3">Value Balance</h3>
                <p>{formatBTCZ(transaction.valueBalance || 0)}</p>
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-3">Binding Signature</h3>
                <p className="font-mono text-sm break-all">{transaction.bindingSig || 'None'}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div>
                <h3 className="text-lg font-medium mb-3">
                  Shielded Spends ({transaction.spendDescs ? transaction.spendDescs.length : 0})
                </h3>
                {transaction.spendDescs && transaction.spendDescs.length > 0 ? (
                  <div className="space-y-3">
                    {transaction.spendDescs.map((desc, index) => (
                      <div key={index} className="text-sm font-mono text-gray-600">
                        Spend {index + 1}: {JSON.stringify(desc)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No shielded spends</p>
                )}
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-3">
                  Shielded Outputs ({transaction.outputDescs ? transaction.outputDescs.length : 0})
                </h3>
                {transaction.outputDescs && transaction.outputDescs.length > 0 ? (
                  <div className="space-y-3">
                    {transaction.outputDescs.map((desc, index) => (
                      <div key={index} className="text-sm font-mono text-gray-600">
                        Output {index + 1}: {JSON.stringify(desc)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No shielded outputs</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Raw Transaction */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Raw Transaction</h2>
        
        <div className="card">
          <details>
            <summary className="cursor-pointer text-bitcoinz-600 font-medium hover:text-bitcoinz-800">
              Show Raw Transaction Data
            </summary>
            <pre className="mt-4 text-sm overflow-x-auto bg-gray-100 p-4 rounded">
              {JSON.stringify(transaction, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
};

export default Transaction;

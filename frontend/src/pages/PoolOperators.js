import React from 'react';

const PoolOperators = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Pool Operators</h1>
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-semibold mb-4">Information for Pool Operators</h2>
        <p className="mb-4">
          This explorer provides complete REST and WebSocket APIs that can be used for writing web wallets and other apps that need more advanced blockchain queries than provided by bitcoinzd RPC.
        </p>
        <p className="mb-4">
          Check out the source code on GitHub: <a href="https://github.com/simbav911/nextgen-btcz-explorer" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">https://github.com/simbav911/nextgen-btcz-explorer</a>
        </p>
        <div className="mt-6 p-4 border border-gray-300 rounded-md bg-gray-50">
          <h3 className="text-xl font-semibold mb-3">Display Your Pool Under 'Mined By'</h3>
          <p className="mb-2">To display your pool under the 'Mined By' section, please edit your Z-NOMP hex string in:</p>
          <code className="block bg-gray-200 p-3 rounded-md text-sm mb-3">
            /z-nomp/node_modules/stratum-pool/lib/transactions.js
          </code>
          <p className="mb-2">Find:</p>
          <pre className="bg-gray-200 p-3 rounded-md text-sm overflow-x-auto mb-3">
            <code>
Buffer('5a2d4e4f4d50212068747470733a2f2f6769746875622e636f6d2f6a6f7368756179616275742f7a2d6e6f6d70', 'hex')]); //Z-NOMP!
            </code>
          </pre>
          <p className="mb-2">
            HEX encode a string containing the name of your pool and the URL, then replace the above with your own HEX string. The encoded string should be of the following format:
          </p>
          <code className="block bg-gray-200 p-3 rounded-md text-sm">
            YourPoolName https://your.pool.url
          </code>
        </div>
      </div>
    </div>
  );
};

export default PoolOperators;

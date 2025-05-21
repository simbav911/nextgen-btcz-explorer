import React from 'react';

const Developers = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Developers</h1>
      <div className="bg-white shadow-md rounded-lg p-6 md:p-8 mx-auto max-w-4xl">
        <h2 className="text-2xl font-semibold mb-4">Developer Resources</h2>
        <p className="mb-4">
          This explorer provides complete REST and WebSocket APIs that can be used for writing web wallets and other apps that need more advanced blockchain queries than provided by bitcoinzd RPC.
        </p>
        <p className="mb-4">
          Check out the source code on GitHub: <a href="https://github.com/simbav911/nextgen-btcz-explorer" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">https://github.com/simbav911/nextgen-btcz-explorer</a>
        </p>

        <h3 className="text-xl font-semibold mb-3 mt-6">Available API Endpoints</h3>
        <p className="mb-4">All API endpoints are prefixed with <code className="bg-gray-200 p-1 rounded-md text-sm">/api</code>.</p>

        <div className="space-y-6">
          <div>
            <h4 className="text-lg font-semibold mb-2">Mining Information</h4>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li><code className="bg-gray-200 p-1 rounded-md text-sm">GET /mining/info</code>: Retrieves mining-related information including latest blocks, difficulty, network hashrate, and BTCZ price.</li>
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-2">CoinMarketCap (CMC) Supply Information</h4>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li><code className="bg-gray-200 p-1 rounded-md text-sm">GET /cmc/supply</code>: Gets the total and maximum supply of BitcoinZ, typically for CoinMarketCap or similar services.</li>
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-2">Address Information</h4>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li><code className="bg-gray-200 p-1 rounded-md text-sm">GET /address/:address</code>: Fetches detailed information for a specific BitcoinZ address.</li>
              <li><code className="bg-gray-200 p-1 rounded-md text-sm">GET /address/:address/transactions</code>: Retrieves a list of transactions for a given address. Supports <code className="bg-gray-200 p-1 rounded-md text-sm">limit</code> and <code className="bg-gray-200 p-1 rounded-md text-sm">offset</code> query parameters for pagination.</li>
              <li><code className="bg-gray-200 p-1 rounded-md text-sm">GET /address/:address/balance</code>: Gets the current balance, total received, total sent, and unconfirmed balance for an address.</li>
              <li><code className="bg-gray-200 p-1 rounded-md text-sm">GET /address/:address/history</code>: Fetches the balance history for an address. Supports a <code className="bg-gray-200 p-1 rounded-md text-sm">days</code> query parameter (default 30).</li>
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-2">Block Information</h4>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li><code className="bg-gray-200 p-1 rounded-md text-sm">GET /blocks</code>: Retrieves a list of the latest blocks. Supports <code className="bg-gray-200 p-1 rounded-md text-sm">limit</code> and <code className="bg-gray-200 p-1 rounded-md text-sm">offset</code> query parameters.</li>
              <li><code className="bg-gray-200 p-1 rounded-md text-sm">GET /blocks/hash/:hash</code>: Fetches a specific block by its hash.</li>
              <li><code className="bg-gray-200 p-1 rounded-md text-sm">GET /blocks/height/:height</code>: Fetches a specific block by its height.</li>
              <li><code className="bg-gray-200 p-1 rounded-md text-sm">GET /blocks/latest</code>: Retrieves the most recent block.</li>
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-2">Transaction Information</h4>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li><code className="bg-gray-200 p-1 rounded-md text-sm">GET /transactions</code>: Retrieves a list of the latest transactions. Supports <code className="bg-gray-200 p-1 rounded-md text-sm">limit</code> and <code className="bg-gray-200 p-1 rounded-md text-sm">offset</code> query parameters.</li>
              <li><code className="bg-gray-200 p-1 rounded-md text-sm">GET /transactions/:txid</code>: Fetches a specific transaction by its TXID.</li>
              <li><code className="bg-gray-200 p-1 rounded-md text-sm">GET /transactions/block/:blockhash</code>: Retrieves all transactions within a specific block hash.</li>
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-2">Network Statistics</h4>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li><code className="bg-gray-200 p-1 rounded-md text-sm">GET /stats</code>: Retrieves current network statistics.</li>
              <li><code className="bg-gray-200 p-1 rounded-md text-sm">GET /stats/historical</code>: Fetches historical network statistics. Supports <code className="bg-gray-200 p-1 rounded-md text-sm">days</code> and <code className="bg-gray-200 p-1 rounded-md text-sm">interval</code> query parameters.</li>
              <li><code className="bg-gray-200 p-1 rounded-md text-sm">GET /stats/blockchain</code>: Retrieves general blockchain information.</li>
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-2">Wealth Distribution</h4>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li><code className="bg-gray-200 p-1 rounded-md text-sm">GET /wealth/top-holders</code>: Retrieves a list of the top BitcoinZ holders. Supports a <code className="bg-gray-200 p-1 rounded-md text-sm">limit</code> query parameter.</li>
              <li><code className="bg-gray-200 p-1 rounded-md text-sm">GET /wealth/distribution</code>: Fetches data on wealth distribution across different balance ranges.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Developers;

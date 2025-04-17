# Modern BitcoinZ Explorer

A modern, full-featured blockchain explorer for BitcoinZ built with Node.js, React, and PostgreSQL.

![BitcoinZ Explorer](https://bitcoinz.global/wp-content/uploads/branding/btcz-website-logo.png)

## Features

- **Modern Design**: Clean, responsive user interface built with React and Tailwind CSS
- **Real-time Updates**: Live updates for blocks and transactions using WebSockets
- **Comprehensive Data**: Detailed information about blocks, transactions, and addresses
- **Advanced Search**: Search for blocks, transactions, and addresses
- **Network Statistics**: Charts and metrics showing network health and performance
- **API Support**: Fully featured REST API for blockchain data
- **Mobile Friendly**: Responsive design works on all devices

## Architecture

The application consists of three main components:

1. **Backend**: Node.js/Express server that connects to a BitcoinZ node and provides REST API endpoints
2. **Frontend**: React-based single-page application with a modern UI
3. **Database**: PostgreSQL for storing and indexing blockchain data

## Prerequisites

- Node.js (v16+)
- PostgreSQL (v10+)
- BitcoinZ full node (with RPC enabled)

## Quick Start

The easiest way to start the explorer is using the provided start script:

```bash
# Make the script executable if needed
chmod +x start.sh

# Run the script
./start.sh
```

This will:
1. Check PostgreSQL connection
2. Create database tables if needed
3. Start the backend server
4. Start the frontend development server

## Manual Installation

### Database Setup

1. Make sure PostgreSQL is running
2. Create a database named `bitcoinz_explorer`
3. Initialize the database schema:

```bash
cd backend
node setup-db.js
```

### Backend Setup

```bash
cd backend
npm install
npm start
```

### Frontend Setup

```bash
cd frontend
npm install
npm start
```

## Configuration

### BitcoinZ Node Configuration

The explorer connects to a running BitcoinZ node. Make sure your `bitcoinz.conf` file has the following settings:

```
server=1
txindex=1
addressindex=1
spentindex=1
rpcuser=your_rpc_username
rpcpassword=your_rpc_password
rpcbind=127.0.0.1
rpcport=1978
```

### Backend Configuration

Configuration is managed through environment variables in the `.env` file:

```
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration (PostgreSQL)
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bitcoinz_explorer
DB_USER=postgres
DB_PASSWORD=postgres

# BitcoinZ Node Connection
BITCOINZ_RPC_HOST=127.0.0.1
BITCOINZ_RPC_PORT=1978
BITCOINZ_RPC_USER=your_rpc_username
BITCOINZ_RPC_PASS=your_rpc_password
```

## Data Synchronization

The explorer automatically synchronizes blockchain data from your BitcoinZ node to the PostgreSQL database. This includes:

- Block data
- Transaction details
- Address balances and history
- Network statistics

Synchronization happens automatically when the backend starts and continues in the background. The initial sync may take some time depending on your blockchain size.

## API Endpoints

The backend provides the following API endpoints:

- **GET /api/blocks** - Get latest blocks
- **GET /api/blocks/:hash** - Get block by hash
- **GET /api/blocks/height/:height** - Get block by height
- **GET /api/transactions** - Get latest transactions
- **GET /api/transactions/:txid** - Get transaction details
- **GET /api/addresses/:address** - Get address information
- **GET /api/stats** - Get network statistics
- **GET /api/search?query=** - Search for blocks, transactions, or addresses

## Troubleshooting

### Connection to BitcoinZ Node Fails

- Verify your BitcoinZ node is running
- Check the RPC credentials in the `.env` file
- Make sure the RPC port is correct and accessible

### Database Connection Issues

- Verify PostgreSQL is running
- Check the database credentials in the `.env` file
- Make sure the database has been created

### Initial Sync Takes Too Long

- The initial sync reads all blockchain data into the database
- This can take some time depending on the blockchain size
- The explorer is usable during sync, but some data may be incomplete

## Development

### Backend Development

```bash
cd backend
npm run dev
```

This will start the backend with nodemon for automatic reloading during development.

### Frontend Development

```bash
cd frontend
npm start
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- BitcoinZ Community
- Original bitcore-node-btcz explorer

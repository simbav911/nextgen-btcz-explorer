-- Create database if it doesn't exist
CREATE DATABASE bitcoinz_explorer;

-- Connect to the database
\c bitcoinz_explorer;

-- Create extension for additional features
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create blocks table
CREATE TABLE IF NOT EXISTS blocks (
    hash VARCHAR(255) PRIMARY KEY,
    height INTEGER NOT NULL UNIQUE,
    confirmations INTEGER NOT NULL,
    size INTEGER NOT NULL,
    strippedsize INTEGER,
    weight INTEGER,
    version INTEGER NOT NULL,
    version_hex VARCHAR(255),
    merkleroot VARCHAR(255) NOT NULL,
    tx TEXT[] NOT NULL,
    time INTEGER NOT NULL,
    mediantime INTEGER,
    nonce VARCHAR(255) NOT NULL,
    bits VARCHAR(255) NOT NULL,
    difficulty FLOAT NOT NULL,
    chainwork VARCHAR(255),
    previousblockhash VARCHAR(255),
    nextblockhash VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for blocks
CREATE INDEX IF NOT EXISTS idx_blocks_height ON blocks(height);
CREATE INDEX IF NOT EXISTS idx_blocks_time ON blocks(time);
CREATE INDEX IF NOT EXISTS idx_blocks_prev_hash ON blocks(previousblockhash);
CREATE INDEX IF NOT EXISTS idx_blocks_next_hash ON blocks(nextblockhash);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
    txid VARCHAR(255) PRIMARY KEY,
    hash VARCHAR(255),
    version INTEGER,
    size INTEGER,
    vsize INTEGER,
    weight INTEGER,
    locktime INTEGER,
    blockhash VARCHAR(255),
    confirmations INTEGER,
    time INTEGER,
    blocktime INTEGER,
    vin JSONB,
    vout JSONB,
    is_coinbase BOOLEAN DEFAULT FALSE,
    fee FLOAT,
    value_in FLOAT,
    value_out FLOAT,
    value_balance FLOAT,
    f_overwintered BOOLEAN,
    v_shielded_spend JSONB,
    v_shielded_output JSONB,
    binding_sig VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for transactions
CREATE INDEX IF NOT EXISTS idx_transactions_blockhash ON transactions(blockhash);
CREATE INDEX IF NOT EXISTS idx_transactions_time ON transactions(time);

-- Create GIN indexes for JSON fields
CREATE INDEX IF NOT EXISTS idx_transactions_vin ON transactions USING GIN (vin);
CREATE INDEX IF NOT EXISTS idx_transactions_vout ON transactions USING GIN (vout);

-- Create addresses table
CREATE TABLE IF NOT EXISTS addresses (
    address VARCHAR(255) PRIMARY KEY,
    balance FLOAT DEFAULT 0,
    total_received FLOAT DEFAULT 0,
    total_sent FLOAT DEFAULT 0,
    unconfirmed_balance FLOAT DEFAULT 0,
    tx_count INTEGER DEFAULT 0,
    transactions TEXT[] DEFAULT '{}',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for addresses
CREATE INDEX IF NOT EXISTS idx_addresses_balance ON addresses(balance);
CREATE INDEX IF NOT EXISTS idx_addresses_tx_count ON addresses(tx_count);

-- Create statistics table
CREATE TABLE IF NOT EXISTS statistics (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    block_height INTEGER,
    difficulty FLOAT,
    hashrate BIGINT,
    supply FLOAT,
    transactions INTEGER,
    avg_block_time FLOAT,
    avg_tx_per_block FLOAT,
    peer_count INTEGER,
    mempool JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for statistics
CREATE INDEX IF NOT EXISTS idx_statistics_timestamp ON statistics(timestamp);

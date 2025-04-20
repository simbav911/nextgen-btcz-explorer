/**
 * Test script for pool distribution tracking functionality
 * 
 * This script tests the pool distribution tracking functionality by:
 * 1. Retrieving real blockchain data for a specific date
 * 2. Generating pool distribution statistics
 */

const axios = require('axios');

// Test API endpoints
const testApiEndpoints = async () => {
  try {
    // Test pool distribution endpoint
    console.log('Testing pool distribution endpoint:');
    console.log('=================================');
    const today = new Date().toISOString().split('T')[0];
    const response = await axios.get(`http://localhost:3001/api/pool-stats/real-pool-stat?date=${today}`);
    
    console.log(`Date: ${response.data.date}`);
    console.log(`Chart Type: ${response.data.chartType}`);
    console.log('Pool Distribution:');
    response.data.data.forEach(pool => {
      console.log(`- ${pool.name}: ${pool.percentage}% (${pool.count} blocks)`);
    });
    console.log('');
    
    // Test mined blocks endpoint
    console.log('Testing mined blocks endpoint:');
    console.log('============================');
    const minedBlocksResponse = await axios.get(`http://localhost:3001/api/pool-stats/mined-blocks?date=${today}&days=1`);
    
    console.log(`Date: ${minedBlocksResponse.data.date}`);
    console.log(`Days: ${minedBlocksResponse.data.days}`);
    console.log(`Chart Type: ${minedBlocksResponse.data.chartType}`);
    console.log(`Total Blocks: ${minedBlocksResponse.data.data.length}`);
    
    if (minedBlocksResponse.data.data.length > 0) {
      console.log('Sample Blocks:');
      minedBlocksResponse.data.data.slice(0, 5).forEach(block => {
        console.log(`- Block ${block.blockHeight}: Mined by ${block.pool}, Size: ${block.size} bytes`);
      });
    } else {
      console.log('No blocks found for today');
    }
    
  } catch (error) {
    console.error('Error testing API endpoints:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
};

// Run the API endpoint tests
testApiEndpoints();

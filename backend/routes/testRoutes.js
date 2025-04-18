const express = require('express');
const router = express.Router();

// Simple test endpoint
router.get('/', (req, res) => {
  console.log('Test endpoint hit!');
  res.json({
    success: true,
    message: 'Test endpoint is working'
  });
});

module.exports = router;
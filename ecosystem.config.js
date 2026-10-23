module.exports = {
  apps: [
    {
      name: 'btcz-explorer-backend',
      cwd: './backend',
      script: 'index.js',
      env: {
        NODE_ENV: 'production',
      },
      // One instance: the indexer runs only on instance 0, and the API is
      // light enough after caching; a second copy just doubles memory.
      instances: 1,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      // Let V8 collect garbage well before pm2's hard restart limit
      node_args: '--max-old-space-size=768',
      max_memory_restart: '1G'
    }
    // The frontend is a static build served by the backend or Apache.
    // No separate PM2 process is needed to "run" the frontend in production
    // after `npm run build` has been executed.
  ]
};

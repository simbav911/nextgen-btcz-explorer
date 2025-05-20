module.exports = {
  apps: [
    {
      name: 'btcz-explorer-backend',
      cwd: './backend',
      script: 'index.js',
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    }
    // The frontend is a static build served by the backend or Apache.
    // No separate PM2 process is needed to "run" the frontend in production
    // after `npm run build` has been executed.
  ]
};

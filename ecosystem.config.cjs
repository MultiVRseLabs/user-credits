/**
 * PM2 process definition for the user-credits transaction server.
 *
 * Usage (from repo root on Linux):
 *   npm install
 *   npm run build
 *   cp .env.example .env   # then edit .env
 *   pm2 start ecosystem.config.cjs
 *
 * Do NOT use `npm run serve` under PM2 — build once, then run dist/server.js.
 */
module.exports = {
  apps: [
    {
      name: "user-credits-server",
      script: "dist/server.js",
      cwd: __dirname,
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env_file: ".env",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};

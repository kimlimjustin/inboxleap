// Copies the root .env file to apps/server/.env
const fs = require('fs');
const path = require('path');

const rootEnv = path.resolve(__dirname, '../.env');
const serverEnv = path.resolve(__dirname, '../apps/server/.env');

fs.copyFile(rootEnv, serverEnv, (err) => {
  if (err) {
    console.error('❌ Failed to copy .env to server:', err);
    process.exit(1);
  } else {
    console.log('✅ .env copied to apps/server/.env');
  }
});

#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load configuration
const configPath = path.resolve(__dirname, '..', 'config.json');
const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf-8')) : {};
const defaultPorts = config.ports || { frontend: 5173, backend: 3000 };

// Parse command line arguments
const args = process.argv.slice(2);

// Find port arguments (command line overrides config)
const serverPortArg = args.find(arg => arg.startsWith('--server-port='))?.split('=')[1] || defaultPorts.backend;
const webPortArg = args.find(arg => arg.startsWith('--web-port='))?.split('=')[1] || defaultPorts.frontend;

// Check if we should start both or individual services
const startServer = !args.includes('--web-only');
const startWeb = !args.includes('--server-only');

console.log(`🚀 Starting services with custom ports:`);
if (startServer) console.log(`📡 Server: http://localhost:${serverPortArg}`);
if (startWeb) console.log(`🌐 Web: http://localhost:${webPortArg}`);
console.log('');

const processes = [];

// Start server if requested
if (startServer) {
  console.log('Starting server...');
  const serverEnv = { ...process.env, PORT: serverPortArg };
  const serverProcess = spawn('pnpm', ['--filter', '@email-task-router/server', 'run', 'dev'], {
    stdio: 'inherit',
    env: serverEnv,
    cwd: path.resolve(__dirname, '..')
  });

  serverProcess.on('error', (err) => {
    console.error('❌ Server failed to start:', err);
  });

  processes.push(serverProcess);
}

// Start web if requested
if (startWeb) {
  console.log('Starting web...');
  const webEnv = { ...process.env, VITE_API_PORT: serverPortArg };
  const webProcess = spawn('pnpm', ['--filter', '@email-task-router/web', 'run', 'dev', '--port', webPortArg, '--host'], {
    stdio: 'inherit',
    env: webEnv,
    cwd: path.resolve(__dirname, '..')
  });

  webProcess.on('error', (err) => {
    console.error('❌ Web failed to start:', err);
  });

  processes.push(webProcess);
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down services...');
  processes.forEach(proc => {
    if (proc && !proc.killed) {
      proc.kill('SIGINT');
    }
  });
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down services...');
  processes.forEach(proc => {
    if (proc && !proc.killed) {
      proc.kill('SIGTERM');
    }
  });
  process.exit(0);
});
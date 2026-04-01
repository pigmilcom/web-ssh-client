import { SSHWebSocketServer } from './websocket-server';

const PORT = parseInt(process.env.SSH_WS_PORT || '8080', 10);

const server = new SSHWebSocketServer(PORT);

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SSH Server] Received SIGTERM, shutting down...');
  server.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[SSH Server] Received SIGINT, shutting down...');
  server.close();
  process.exit(0);
});

console.log(`[SSH Server] WebSocket server started on port ${PORT}`);
console.log('[SSH Server] Ready to accept connections');

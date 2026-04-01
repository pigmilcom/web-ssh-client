/**
 * Custom production server — runs Next.js + SSH WebSocket server
 * on a single port so Coolify (or any Docker host) only needs to
 * expose one port.
 *
 * Used by:  npm start  (NODE_ENV=production)
 * Dev uses: npm run dev:all  (two separate processes via concurrently)
 */
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { SSHWebSocketServer } from './websocket-server';

const port = parseInt(process.env.PORT || '3000', 10);
const app = next({ dev: false });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // Attach WebSocket server to the same HTTP server — no extra port needed.
  const wss = new SSHWebSocketServer(httpServer);

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`[Server] Web SSH Client ready on http://0.0.0.0:${port}`);
  });

  const shutdown = () => {
    console.log('[Server] Shutting down…');
    wss.close();
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
});

import { WebSocketServer, WebSocket } from 'ws';
import { SSHConnection } from './ssh-manager';
import type { 
  WSMessage, 
  ConnectPayload, 
  DataPayload, 
  ResizePayload,
  SFTPListPayload,
  SFTPTransferPayload,
  SFTPOperationPayload,
  PortForwardStartPayload,
  KeyboardInteractiveResponse,
  ConnectionStatus
} from '../types/ssh';

interface SessionData {
  ws: WebSocket;
  ssh: SSHConnection | null;
  sessionId: string;
  bytesReceived: number;
  bytesSent: number;
  connectedAt: number | null;
}

export class SSHWebSocketServer {
  private wss: WebSocketServer;
  private sessions: Map<string, SessionData> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(port: number = 8080) {
    this.wss = new WebSocketServer({ port });
    this.setupServer();
    console.log(`[SSH WebSocket Server] Running on ws://localhost:${port}`);
  }

  private setupServer(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      const sessionId = this.generateSessionId();
      
      const sessionData: SessionData = {
        ws,
        ssh: null,
        sessionId,
        bytesReceived: 0,
        bytesSent: 0,
        connectedAt: null,
      };
      
      this.sessions.set(sessionId, sessionData);
      
      // Send session ID to client
      this.send(ws, {
        type: 'status',
        sessionId,
        payload: { status: 'ready', message: 'Session ready' },
      });

      ws.on('message', (data: Buffer) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          this.handleMessage(sessionId, message);
        } catch (err) {
          this.sendError(ws, sessionId, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        this.cleanup(sessionId);
      });

      ws.on('error', (err) => {
        console.error(`[Session ${sessionId}] WebSocket error:`, err);
        this.cleanup(sessionId);
      });
    });

    // Ping clients periodically
    this.pingInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      });
    }, 30000);
  }

  private handleMessage(sessionId: string, message: WSMessage): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    switch (message.type) {
      case 'connect':
        this.handleConnect(session, message.payload as ConnectPayload);
        break;
      
      case 'disconnect':
        this.handleDisconnect(session);
        break;
      
      case 'data':
        this.handleData(session, message.payload as DataPayload);
        break;
      
      case 'resize':
        this.handleResize(session, message.payload as ResizePayload);
        break;
      
      case 'keyboard-interactive':
        this.handleKeyboardInteractive(session, message.payload as KeyboardInteractiveResponse);
        break;
      
      case 'sftp:list':
        this.handleSFTPList(session, message.payload as SFTPListPayload);
        break;
      
      case 'sftp:stat':
        this.handleSFTPStat(session, message.payload as SFTPOperationPayload);
        break;
      
      case 'sftp:download':
        this.handleSFTPDownload(session, message.payload as SFTPTransferPayload);
        break;
      
      case 'sftp:upload':
        this.handleSFTPUpload(session, message.payload as SFTPTransferPayload & { data: string });
        break;
      
      case 'sftp:delete':
        this.handleSFTPDelete(session, message.payload as SFTPOperationPayload);
        break;
      
      case 'sftp:mkdir':
        this.handleSFTPMkdir(session, message.payload as SFTPOperationPayload);
        break;
      
      case 'sftp:rename':
        this.handleSFTPRename(session, message.payload as SFTPOperationPayload);
        break;
      
      case 'portforward:start':
        this.handlePortForwardStart(session, message.payload as PortForwardStartPayload);
        break;
      
      case 'portforward:stop':
        this.handlePortForwardStop(session, message.payload as { id: string });
        break;
      
      default:
        this.sendError(session.ws, sessionId, `Unknown message type: ${message.type}`);
    }
  }

  private handleConnect(session: SessionData, payload: ConnectPayload): void {
    if (session.ssh) {
      session.ssh.disconnect();
    }

    const ssh = new SSHConnection(payload.config, {
      onData: (data) => {
        session.bytesReceived += data.length;
        this.send(session.ws, {
          type: 'data',
          sessionId: session.sessionId,
          payload: { data },
        });
      },
      onError: (error) => {
        this.send(session.ws, {
          type: 'error',
          sessionId: session.sessionId,
          payload: { message: error.message },
        });
        this.sendStatus(session, 'error', error.message);
      },
      onClose: () => {
        session.connectedAt = null;
        this.sendStatus(session, 'disconnected');
      },
      onKeyboardInteractive: (prompt) => {
        this.send(session.ws, {
          type: 'keyboard-interactive',
          sessionId: session.sessionId,
          payload: prompt,
        });
      },
      onReady: () => {
        session.connectedAt = Date.now();
        this.sendStatus(session, 'connected');
      },
    });

    session.ssh = ssh;
    this.sendStatus(session, 'connecting');
    ssh.connect(payload.terminal.cols, payload.terminal.rows);
  }

  private handleDisconnect(session: SessionData): void {
    if (session.ssh) {
      session.ssh.disconnect();
      session.ssh = null;
    }
    this.sendStatus(session, 'disconnected');
  }

  private handleData(session: SessionData, payload: DataPayload): void {
    if (session.ssh) {
      session.bytesSent += payload.data.length;
      session.ssh.write(payload.data);
    }
  }

  private handleResize(session: SessionData, payload: ResizePayload): void {
    if (session.ssh) {
      session.ssh.resize(payload.cols, payload.rows);
    }
  }

  private handleKeyboardInteractive(session: SessionData, payload: KeyboardInteractiveResponse): void {
    if (session.ssh) {
      session.ssh.respondToKeyboardInteractive(payload.responses);
    }
  }

  // SFTP Handlers
  private async handleSFTPList(session: SessionData, payload: SFTPListPayload): Promise<void> {
    if (!session.ssh) {
      this.sendError(session.ws, session.sessionId, 'Not connected');
      return;
    }

    try {
      const files = await session.ssh.listDirectory(payload.path);
      this.send(session.ws, {
        type: 'sftp:list',
        sessionId: session.sessionId,
        payload: { path: payload.path, files },
      });
    } catch (err) {
      this.sendError(session.ws, session.sessionId, `SFTP list failed: ${(err as Error).message}`);
    }
  }

  private async handleSFTPStat(session: SessionData, payload: SFTPOperationPayload): Promise<void> {
    if (!session.ssh) {
      this.sendError(session.ws, session.sessionId, 'Not connected');
      return;
    }

    try {
      const stat = await session.ssh.stat(payload.path);
      this.send(session.ws, {
        type: 'sftp:stat',
        sessionId: session.sessionId,
        payload: { path: payload.path, stat },
      });
    } catch (err) {
      this.sendError(session.ws, session.sessionId, `SFTP stat failed: ${(err as Error).message}`);
    }
  }

  private async handleSFTPDownload(session: SessionData, payload: SFTPTransferPayload): Promise<void> {
    if (!session.ssh) {
      this.sendError(session.ws, session.sessionId, 'Not connected');
      return;
    }

    try {
      const data = await session.ssh.downloadFile(payload.remotePath);
      this.send(session.ws, {
        type: 'sftp:download',
        sessionId: session.sessionId,
        payload: { 
          remotePath: payload.remotePath, 
          data: data.toString('base64'),
          size: data.length,
        },
      });
    } catch (err) {
      this.sendError(session.ws, session.sessionId, `SFTP download failed: ${(err as Error).message}`);
    }
  }

  private async handleSFTPUpload(
    session: SessionData, 
    payload: SFTPTransferPayload & { data: string }
  ): Promise<void> {
    if (!session.ssh) {
      this.sendError(session.ws, session.sessionId, 'Not connected');
      return;
    }

    try {
      const data = Buffer.from(payload.data, 'base64');
      await session.ssh.uploadFile(payload.remotePath, data);
      this.send(session.ws, {
        type: 'sftp:upload',
        sessionId: session.sessionId,
        payload: { remotePath: payload.remotePath, success: true },
      });
    } catch (err) {
      this.sendError(session.ws, session.sessionId, `SFTP upload failed: ${(err as Error).message}`);
    }
  }

  private async handleSFTPDelete(session: SessionData, payload: SFTPOperationPayload): Promise<void> {
    if (!session.ssh) {
      this.sendError(session.ws, session.sessionId, 'Not connected');
      return;
    }

    try {
      // Try to delete as file first, then as directory
      try {
        await session.ssh.deleteFile(payload.path);
      } catch {
        await session.ssh.deleteDirectory(payload.path);
      }
      this.send(session.ws, {
        type: 'sftp:delete',
        sessionId: session.sessionId,
        payload: { path: payload.path, success: true },
      });
    } catch (err) {
      this.sendError(session.ws, session.sessionId, `SFTP delete failed: ${(err as Error).message}`);
    }
  }

  private async handleSFTPMkdir(session: SessionData, payload: SFTPOperationPayload): Promise<void> {
    if (!session.ssh) {
      this.sendError(session.ws, session.sessionId, 'Not connected');
      return;
    }

    try {
      await session.ssh.mkdir(payload.path);
      this.send(session.ws, {
        type: 'sftp:mkdir',
        sessionId: session.sessionId,
        payload: { path: payload.path, success: true },
      });
    } catch (err) {
      this.sendError(session.ws, session.sessionId, `SFTP mkdir failed: ${(err as Error).message}`);
    }
  }

  private async handleSFTPRename(session: SessionData, payload: SFTPOperationPayload): Promise<void> {
    if (!session.ssh) {
      this.sendError(session.ws, session.sessionId, 'Not connected');
      return;
    }

    if (!payload.newPath) {
      this.sendError(session.ws, session.sessionId, 'SFTP rename failed: newPath required');
      return;
    }

    try {
      await session.ssh.rename(payload.path, payload.newPath);
      this.send(session.ws, {
        type: 'sftp:rename',
        sessionId: session.sessionId,
        payload: { path: payload.path, newPath: payload.newPath, success: true },
      });
    } catch (err) {
      this.sendError(session.ws, session.sessionId, `SFTP rename failed: ${(err as Error).message}`);
    }
  }

  // Port Forward Handlers
  private async handlePortForwardStart(session: SessionData, payload: PortForwardStartPayload): Promise<void> {
    if (!session.ssh) {
      this.sendError(session.ws, session.sessionId, 'Not connected');
      return;
    }

    try {
      if (payload.config.type === 'local') {
        await session.ssh.startLocalForward(payload.config);
      } else if (payload.config.type === 'remote') {
        await session.ssh.startRemoteForward(payload.config);
      }
      this.send(session.ws, {
        type: 'portforward:start',
        sessionId: session.sessionId,
        payload: { config: payload.config, success: true },
      });
    } catch (err) {
      this.sendError(session.ws, session.sessionId, `Port forward failed: ${(err as Error).message}`);
    }
  }

  private handlePortForwardStop(session: SessionData, payload: { id: string }): void {
    if (!session.ssh) {
      this.sendError(session.ws, session.sessionId, 'Not connected');
      return;
    }

    session.ssh.stopPortForward(payload.id);
    this.send(session.ws, {
      type: 'portforward:stop',
      sessionId: session.sessionId,
      payload: { id: payload.id, success: true },
    });
  }

  // Utility methods
  private send(ws: WebSocket, message: WSMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, sessionId: string, message: string): void {
    this.send(ws, {
      type: 'error',
      sessionId,
      payload: { message },
    });
  }

  private sendStatus(session: SessionData, status: ConnectionStatus['status'], message?: string): void {
    const latency = session.connectedAt ? Date.now() - session.connectedAt : undefined;
    
    this.send(session.ws, {
      type: 'status',
      sessionId: session.sessionId,
      payload: {
        sessionId: session.sessionId,
        status,
        message,
        latency,
        bytesReceived: session.bytesReceived,
        bytesSent: session.bytesSent,
      } as ConnectionStatus,
    });
  }

  private cleanup(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (session.ssh) {
        session.ssh.disconnect();
      }
      this.sessions.delete(sessionId);
    }
  }

  private generateSessionId(): string {
    return `ssh_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  close(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    // Cleanup all sessions
    for (const [sessionId] of this.sessions) {
      this.cleanup(sessionId);
    }
    
    this.wss.close();
  }
}

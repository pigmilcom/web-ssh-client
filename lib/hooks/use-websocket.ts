'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import type { 
  WSMessage, 
  SSHConnectionConfig, 
  ConnectionStatus,
  KeyboardInteractivePrompt,
  SFTPFileInfo,
  PortForwardConfig
} from '@/types/ssh';

interface UseWebSocketOptions {
  url: string;
  onData?: (data: string) => void;
  onStatus?: (status: ConnectionStatus) => void;
  onError?: (error: string) => void;
  onKeyboardInteractive?: (prompt: KeyboardInteractivePrompt) => void;
  onSFTPList?: (path: string, files: SFTPFileInfo[]) => void;
  onSFTPDownload?: (remotePath: string, data: string, size: number) => void;
  onSFTPUpload?: (remotePath: string, success: boolean) => void;
  onSFTPOperation?: (type: string, success: boolean, path: string) => void;
  onPortForward?: (config: PortForwardConfig, success: boolean) => void;
}

export function useWebSocket(options: UseWebSocketOptions) {
  const { url } = options;

  // Store callbacks in refs so connect() never needs to be recreated when
  // the parent passes new inline function references on each render.
  const onDataRef = useRef(options.onData);
  const onStatusRef = useRef(options.onStatus);
  const onErrorRef = useRef(options.onError);
  const onKeyboardInteractiveRef = useRef(options.onKeyboardInteractive);
  const onSFTPListRef = useRef(options.onSFTPList);
  const onSFTPDownloadRef = useRef(options.onSFTPDownload);
  const onSFTPUploadRef = useRef(options.onSFTPUpload);
  const onSFTPOperationRef = useRef(options.onSFTPOperation);
  const onPortForwardRef = useRef(options.onPortForward);

  useEffect(() => { onDataRef.current = options.onData; });
  useEffect(() => { onStatusRef.current = options.onStatus; });
  useEffect(() => { onErrorRef.current = options.onError; });
  useEffect(() => { onKeyboardInteractiveRef.current = options.onKeyboardInteractive; });
  useEffect(() => { onSFTPListRef.current = options.onSFTPList; });
  useEffect(() => { onSFTPDownloadRef.current = options.onSFTPDownload; });
  useEffect(() => { onSFTPUploadRef.current = options.onSFTPUpload; });
  useEffect(() => { onSFTPOperationRef.current = options.onSFTPOperation; });
  useEffect(() => { onPortForwardRef.current = options.onPortForward; });

  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSSHConnected, setIsSSHConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        
        switch (message.type) {
          case 'data': {
            const payload = message.payload as { data: string };
            onDataRef.current?.(payload.data);
            break;
          }
          
          case 'status': {
            const status = message.payload as ConnectionStatus;
            sessionIdRef.current = status.sessionId;
            setIsSSHConnected(status.status === 'connected');
            onStatusRef.current?.(status);
            break;
          }
          
          case 'error': {
            const payload = message.payload as { message: string };
            onErrorRef.current?.(payload.message);
            break;
          }
          
          case 'keyboard-interactive': {
            const prompt = message.payload as KeyboardInteractivePrompt;
            onKeyboardInteractiveRef.current?.(prompt);
            break;
          }
          
          case 'sftp:list': {
            const payload = message.payload as { path: string; files: SFTPFileInfo[] };
            onSFTPListRef.current?.(payload.path, payload.files);
            break;
          }
          
          case 'sftp:download': {
            const payload = message.payload as { remotePath: string; data: string; size: number };
            onSFTPDownloadRef.current?.(payload.remotePath, payload.data, payload.size);
            break;
          }
          
          case 'sftp:upload': {
            const payload = message.payload as { remotePath: string; success: boolean };
            onSFTPUploadRef.current?.(payload.remotePath, payload.success);
            break;
          }
          
          case 'sftp:delete':
          case 'sftp:mkdir':
          case 'sftp:rename': {
            const payload = message.payload as { path: string; success: boolean };
            onSFTPOperationRef.current?.(message.type, payload.success, payload.path);
            break;
          }
          
          case 'portforward:start':
          case 'portforward:stop': {
            const payload = message.payload as { config?: PortForwardConfig; id?: string; success: boolean };
            if (payload.config) {
              onPortForwardRef.current?.(payload.config, payload.success);
            }
            break;
          }
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsSSHConnected(false);
      
      // Attempt reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = () => {
      onErrorRef.current?.('WebSocket connection error');
    };
  }, [url]); // url is the only true dependency — callbacks are accessed via stable refs

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const send = useCallback((message: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        ...message,
        sessionId: sessionIdRef.current,
      }));
    }
  }, []);

  const connectSSH = useCallback((config: SSHConnectionConfig, cols: number, rows: number) => {
    send({
      type: 'connect',
      payload: {
        config,
        terminal: { cols, rows },
      },
    });
  }, [send]);

  const disconnectSSH = useCallback(() => {
    send({ type: 'disconnect' });
  }, [send]);

  const sendData = useCallback((data: string) => {
    send({
      type: 'data',
      payload: { data },
    });
  }, [send]);

  const resize = useCallback((cols: number, rows: number) => {
    send({
      type: 'resize',
      payload: { cols, rows },
    });
  }, [send]);

  const respondKeyboardInteractive = useCallback((responses: string[]) => {
    send({
      type: 'keyboard-interactive',
      payload: { responses },
    });
  }, [send]);

  // SFTP operations
  const sftpList = useCallback((path: string) => {
    send({
      type: 'sftp:list',
      payload: { path },
    });
  }, [send]);

  const sftpDownload = useCallback((remotePath: string) => {
    send({
      type: 'sftp:download',
      payload: { remotePath },
    });
  }, [send]);

  const sftpUpload = useCallback((remotePath: string, data: string) => {
    send({
      type: 'sftp:upload',
      payload: { remotePath, data },
    });
  }, [send]);

  const sftpDelete = useCallback((path: string) => {
    send({
      type: 'sftp:delete',
      payload: { path },
    });
  }, [send]);

  const sftpMkdir = useCallback((path: string) => {
    send({
      type: 'sftp:mkdir',
      payload: { path },
    });
  }, [send]);

  const sftpRename = useCallback((path: string, newPath: string) => {
    send({
      type: 'sftp:rename',
      payload: { path, newPath },
    });
  }, [send]);

  // Port forwarding
  const startPortForward = useCallback((config: PortForwardConfig) => {
    send({
      type: 'portforward:start',
      payload: { config },
    });
  }, [send]);

  const stopPortForward = useCallback((id: string) => {
    send({
      type: 'portforward:stop',
      payload: { id },
    });
  }, [send]);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    isSSHConnected,
    sessionId: sessionIdRef.current,
    connectSSH,
    disconnectSSH,
    sendData,
    resize,
    respondKeyboardInteractive,
    sftpList,
    sftpDownload,
    sftpUpload,
    sftpDelete,
    sftpMkdir,
    sftpRename,
    startPortForward,
    stopPortForward,
  };
}

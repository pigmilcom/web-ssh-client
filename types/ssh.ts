// SSH Connection Types

export type AuthMethod = 'password' | 'privateKey' | 'keyboardInteractive' | 'agent';

export interface SSHConnectionConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: AuthMethod;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  // Advanced options
  keepaliveInterval?: number;
  keepaliveCountMax?: number;
  readyTimeout?: number;
  terminalType?: string;
  environmentVariables?: Record<string, string>;
  startupCommand?: string;
  // Host key verification
  hostKeyVerification?: 'strict' | 'warn' | 'none';
  knownHostKey?: string;
}

export interface ConnectionProfile extends Omit<SSHConnectionConfig, 'password' | 'privateKey' | 'passphrase'> {
  folderId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProfileFolder {
  id: string;
  name: string;
  parentId?: string;
}

// Session Types
export interface SSHSession {
  id: string;
  connectionId: string;
  name: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  errorMessage?: string;
  createdAt: number;
  terminal?: {
    cols: number;
    rows: number;
  };
}

// WebSocket Message Types
export type WSMessageType = 
  | 'connect'
  | 'disconnect'
  | 'data'
  | 'resize'
  | 'sftp:list'
  | 'sftp:download'
  | 'sftp:upload'
  | 'sftp:delete'
  | 'sftp:mkdir'
  | 'sftp:rename'
  | 'sftp:stat'
  | 'portforward:start'
  | 'portforward:stop'
  | 'keyboard-interactive'
  | 'error'
  | 'status';

export interface WSMessage {
  type: WSMessageType;
  sessionId?: string;
  payload?: unknown;
}

export interface ConnectPayload {
  config: SSHConnectionConfig;
  terminal: {
    cols: number;
    rows: number;
  };
}

export interface DataPayload {
  data: string;
}

export interface ResizePayload {
  cols: number;
  rows: number;
}

// SFTP Types
export interface SFTPFileInfo {
  filename: string;
  longname: string;
  attrs: {
    mode: number;
    uid: number;
    gid: number;
    size: number;
    atime: number;
    mtime: number;
  };
  isDirectory: boolean;
  isFile: boolean;
  isSymlink: boolean;
}

export interface SFTPListPayload {
  path: string;
}

export interface SFTPTransferPayload {
  remotePath: string;
  localPath?: string;
}

export interface SFTPOperationPayload {
  path: string;
  newPath?: string;
}

// Port Forwarding Types
export type PortForwardType = 'local' | 'remote' | 'dynamic';

export interface PortForwardConfig {
  id: string;
  type: PortForwardType;
  localHost: string;
  localPort: number;
  remoteHost?: string;
  remotePort?: number;
  enabled: boolean;
}

export interface PortForwardStartPayload {
  config: PortForwardConfig;
}

// Status Types
export interface ConnectionStatus {
  sessionId: string;
  status: SSHSession['status'];
  message?: string;
  latency?: number;
  bytesReceived?: number;
  bytesSent?: number;
}

// Keyboard Interactive Types
export interface KeyboardInteractivePrompt {
  name: string;
  instructions: string;
  prompts: Array<{
    prompt: string;
    echo: boolean;
  }>;
}

export interface KeyboardInteractiveResponse {
  responses: string[];
}

import { Client, ClientChannel, SFTPWrapper, ConnectConfig } from 'ssh2';
import type { 
  SSHConnectionConfig, 
  SFTPFileInfo, 
  PortForwardConfig,
  KeyboardInteractivePrompt 
} from '../types/ssh';

export interface SSHSessionHandler {
  onData: (data: string) => void;
  onError: (error: Error) => void;
  onClose: () => void;
  onKeyboardInteractive: (prompt: KeyboardInteractivePrompt) => void;
  onReady: () => void;
}

export class SSHConnection {
  private client: Client;
  private stream: ClientChannel | null = null;
  private sftp: SFTPWrapper | null = null;
  private handler: SSHSessionHandler;
  private config: SSHConnectionConfig;
  private connected = false;
  private portForwards: Map<string, { close: () => void }> = new Map();

  constructor(config: SSHConnectionConfig, handler: SSHSessionHandler) {
    this.client = new Client();
    this.config = config;
    this.handler = handler;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('ready', () => {
      this.connected = true;
      this.handler.onReady();
    });

    this.client.on('error', (err) => {
      this.handler.onError(err);
    });

    this.client.on('close', () => {
      this.connected = false;
      this.handler.onClose();
    });

    this.client.on('keyboard-interactive', (name, instructions, _lang, prompts, finish) => {
      // Store finish callback for later response
      (this as unknown as { _kbFinish: typeof finish })._kbFinish = finish;
      
      this.handler.onKeyboardInteractive({
        name,
        instructions,
        prompts: prompts.map(p => ({
          prompt: p.prompt,
          echo: p.echo
        }))
      });
    });
  }

  connect(cols: number, rows: number): void {
    const connectConfig: ConnectConfig = {
      host: this.config.host,
      port: this.config.port || 22,
      username: this.config.username,
      keepaliveInterval: this.config.keepaliveInterval || 10000,
      keepaliveCountMax: this.config.keepaliveCountMax || 3,
      readyTimeout: this.config.readyTimeout || 20000,
      tryKeyboard: this.config.authMethod === 'keyboardInteractive',
    };

    // Set authentication method
    switch (this.config.authMethod) {
      case 'password':
        connectConfig.password = this.config.password;
        break;
      case 'privateKey':
        connectConfig.privateKey = this.config.privateKey;
        if (this.config.passphrase) {
          connectConfig.passphrase = this.config.passphrase;
        }
        break;
      case 'keyboardInteractive':
        // Handled via event
        break;
      case 'agent':
        connectConfig.agent = process.env.SSH_AUTH_SOCK;
        break;
    }

    // Host key verification
    if (this.config.hostKeyVerification === 'none') {
      connectConfig.hostVerifier = () => true;
    } else if (this.config.knownHostKey) {
      connectConfig.hostVerifier = (key) => {
        const keyStr = key.toString('base64');
        return keyStr === this.config.knownHostKey;
      };
    }

    // For maximum compatibility with different server types
    connectConfig.algorithms = {
      kex: [
        'curve25519-sha256',
        'curve25519-sha256@libssh.org',
        'ecdh-sha2-nistp256',
        'ecdh-sha2-nistp384',
        'ecdh-sha2-nistp521',
        'diffie-hellman-group-exchange-sha256',
        'diffie-hellman-group14-sha256',
        'diffie-hellman-group16-sha512',
        'diffie-hellman-group18-sha512',
        'diffie-hellman-group14-sha1',
        'diffie-hellman-group1-sha1',
      ],
      cipher: [
        'chacha20-poly1305@openssh.com',
        'aes128-gcm',
        'aes128-gcm@openssh.com',
        'aes256-gcm',
        'aes256-gcm@openssh.com',
        'aes128-ctr',
        'aes192-ctr',
        'aes256-ctr',
        'aes128-cbc',
        'aes192-cbc',
        'aes256-cbc',
        '3des-cbc',
      ],
      serverHostKey: [
        'ssh-ed25519',
        'ecdsa-sha2-nistp256',
        'ecdsa-sha2-nistp384',
        'ecdsa-sha2-nistp521',
        'rsa-sha2-512',
        'rsa-sha2-256',
        'ssh-rsa',
        'ssh-dss',
      ],
      hmac: [
        'hmac-sha2-256-etm@openssh.com',
        'hmac-sha2-512-etm@openssh.com',
        'hmac-sha2-256',
        'hmac-sha2-512',
        'hmac-sha1',
        'hmac-md5',
      ],
    };

    this.client.connect(connectConfig);

    // After connection is ready, open shell
    this.client.once('ready', () => {
      const ptyOptions = {
        term: this.config.terminalType || 'xterm-256color',
        cols,
        rows,
        env: this.config.environmentVariables || {},
      };

      this.client.shell(ptyOptions, (err, stream) => {
        if (err) {
          this.handler.onError(err);
          return;
        }

        this.stream = stream;

        stream.on('data', (data: Buffer) => {
          this.handler.onData(data.toString('utf8'));
        });

        stream.on('close', () => {
          this.handler.onClose();
        });

        stream.stderr.on('data', (data: Buffer) => {
          this.handler.onData(data.toString('utf8'));
        });

        // Execute startup command if specified
        if (this.config.startupCommand) {
          stream.write(this.config.startupCommand + '\n');
        }
      });
    });
  }

  write(data: string): void {
    if (this.stream) {
      this.stream.write(data);
    }
  }

  resize(cols: number, rows: number): void {
    if (this.stream) {
      this.stream.setWindow(rows, cols, 0, 0);
    }
  }

  respondToKeyboardInteractive(responses: string[]): void {
    const finish = (this as unknown as { _kbFinish?: (responses: string[]) => void })._kbFinish;
    if (finish) {
      finish(responses);
      delete (this as unknown as { _kbFinish?: unknown })._kbFinish;
    }
  }

  // SFTP Operations
  async getSFTP(): Promise<SFTPWrapper> {
    if (this.sftp) {
      return this.sftp;
    }

    return new Promise((resolve, reject) => {
      this.client.sftp((err, sftp) => {
        if (err) {
          reject(err);
          return;
        }
        this.sftp = sftp;
        resolve(sftp);
      });
    });
  }

  async listDirectory(path: string): Promise<SFTPFileInfo[]> {
    const sftp = await this.getSFTP();
    
    return new Promise((resolve, reject) => {
      sftp.readdir(path, (err, list) => {
        if (err) {
          reject(err);
          return;
        }
        
        const files: SFTPFileInfo[] = list.map(item => ({
          filename: item.filename,
          longname: item.longname,
          attrs: {
            mode: item.attrs.mode || 0,
            uid: item.attrs.uid || 0,
            gid: item.attrs.gid || 0,
            size: item.attrs.size || 0,
            atime: item.attrs.atime || 0,
            mtime: item.attrs.mtime || 0,
          },
          isDirectory: (item.attrs.mode! & 0o40000) === 0o40000,
          isFile: (item.attrs.mode! & 0o100000) === 0o100000,
          isSymlink: (item.attrs.mode! & 0o120000) === 0o120000,
        }));
        
        resolve(files);
      });
    });
  }

  async stat(path: string): Promise<SFTPFileInfo> {
    const sftp = await this.getSFTP();
    
    return new Promise((resolve, reject) => {
      sftp.stat(path, (err, stats) => {
        if (err) {
          reject(err);
          return;
        }
        
        const filename = path.split('/').pop() || path;
        resolve({
          filename,
          longname: filename,
          attrs: {
            mode: stats.mode || 0,
            uid: stats.uid || 0,
            gid: stats.gid || 0,
            size: stats.size || 0,
            atime: stats.atime || 0,
            mtime: stats.mtime || 0,
          },
          isDirectory: (stats.mode! & 0o40000) === 0o40000,
          isFile: (stats.mode! & 0o100000) === 0o100000,
          isSymlink: (stats.mode! & 0o120000) === 0o120000,
        });
      });
    });
  }

  async mkdir(path: string): Promise<void> {
    const sftp = await this.getSFTP();
    
    return new Promise((resolve, reject) => {
      sftp.mkdir(path, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async deleteFile(path: string): Promise<void> {
    const sftp = await this.getSFTP();
    
    return new Promise((resolve, reject) => {
      sftp.unlink(path, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async deleteDirectory(path: string): Promise<void> {
    const sftp = await this.getSFTP();
    
    return new Promise((resolve, reject) => {
      sftp.rmdir(path, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const sftp = await this.getSFTP();
    
    return new Promise((resolve, reject) => {
      sftp.rename(oldPath, newPath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async downloadFile(remotePath: string): Promise<Buffer> {
    const sftp = await this.getSFTP();
    
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const readStream = sftp.createReadStream(remotePath);
      
      readStream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      
      readStream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      
      readStream.on('error', (err) => {
        reject(err);
      });
    });
  }

  async uploadFile(remotePath: string, data: Buffer): Promise<void> {
    const sftp = await this.getSFTP();
    
    return new Promise((resolve, reject) => {
      const writeStream = sftp.createWriteStream(remotePath);
      
      writeStream.on('finish', () => {
        resolve();
      });
      
      writeStream.on('error', (err) => {
        reject(err);
      });
      
      writeStream.write(data);
      writeStream.end();
    });
  }

  // Port Forwarding
  async startLocalForward(config: PortForwardConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      const { default: net } = require('net') as typeof import('net');
      
      const server = net.createServer((socket) => {
        this.client.forwardOut(
          config.localHost,
          config.localPort,
          config.remoteHost || 'localhost',
          config.remotePort || 22,
          (err, stream) => {
            if (err) {
              socket.end();
              return;
            }
            
            socket.pipe(stream);
            stream.pipe(socket);
          }
        );
      });
      
      server.listen(config.localPort, config.localHost, () => {
        this.portForwards.set(config.id, {
          close: () => server.close(),
        });
        resolve();
      });
      
      server.on('error', reject);
    });
  }

  async startRemoteForward(config: PortForwardConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.forwardIn(
        config.remoteHost || '127.0.0.1',
        config.remotePort || 0,
        (err) => {
          if (err) {
            reject(err);
            return;
          }
          
          this.portForwards.set(config.id, {
            close: () => {
              this.client.unforwardIn(
                config.remoteHost || '127.0.0.1',
                config.remotePort || 0
              );
            },
          });
          
          resolve();
        }
      );
    });
  }

  stopPortForward(id: string): void {
    const forward = this.portForwards.get(id);
    if (forward) {
      forward.close();
      this.portForwards.delete(id);
    }
  }

  disconnect(): void {
    // Close all port forwards
    for (const [id] of this.portForwards) {
      this.stopPortForward(id);
    }
    
    if (this.stream) {
      this.stream.close();
      this.stream = null;
    }
    
    if (this.sftp) {
      this.sftp.end();
      this.sftp = null;
    }
    
    this.client.end();
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }
}

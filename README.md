# Web SSH Client

A browser-based SSH client built with Next.js 16, xterm.js, and a Node.js WebSocket proxy server. Provides a VS Code-inspired interface for managing multiple SSH sessions, SFTP file browsing, and port forwarding — all from the browser.

---

## Features

- **Multi-session terminal** — open, duplicate, rename, and close SSH sessions in a tabbed interface
- **xterm.js terminal** — full-featured terminal with WebGL rendering, 10,000-line scrollback, search, copy/paste, and auto-resize
- **Multiple auth methods** — Password, Private Key (with passphrase), Keyboard Interactive, SSH Agent
- **Connection profiles** — save, edit, duplicate, delete, and folder-organize connection profiles (persisted via `localStorage`)
- **SFTP panel** — browse, upload, download, create directories, rename, and delete remote files
- **Port forwarding** — configure local and remote port forwards per session
- **Terminal themes** — live theme switching (VS Code dark by default)
- **Host key verification** — strict, warn, or none modes
- **Startup commands** — run a command automatically on shell open
- **Responsive layout** — collapsible sidebar, resizable panels

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS v4, Radix UI, shadcn/ui |
| Terminal | xterm.js v5 + FitAddon, WebGL, Search, WebLinks |
| SSH | ssh2 (Node.js) |
| Transport | WebSocket (ws v8) |
| State | Zustand v4 |
| Forms | React Hook Form + Zod |
| Icons | Lucide React |
| Runtime | tsx (TypeScript execution) |

---

## Project Structure

```
web-ssh-client/
├── app/
│   ├── layout.tsx          # Root layout, metadata, fonts
│   └── page.tsx            # Entry page (dynamically imports SSHClient)
├── components/
│   ├── ssh/
│   │   ├── ssh-client.tsx          # Root app component (VS Code-style layout)
│   │   ├── connection-dialog.tsx   # New/edit connection modal
│   │   ├── connection-profiles.tsx # Sidebar profile list
│   │   ├── terminal-view.tsx       # xterm.js wrapper with search bar
│   │   ├── terminal-tabs.tsx       # Tab bar for sessions
│   │   ├── sftp-panel.tsx          # SFTP file browser
│   │   ├── port-forward-dialog.tsx # Port forwarding config
│   │   └── status-bar.tsx          # Bottom status bar
│   └── ui/                         # shadcn/ui component library
├── lib/
│   ├── hooks/
│   │   ├── use-websocket.ts        # Browser WebSocket lifecycle + SSH methods
│   │   └── use-terminal.ts         # xterm.js lifecycle + addons
│   ├── stores/
│   │   ├── connection-store.ts     # Zustand store for profiles (persisted)
│   │   └── session-store.ts        # Zustand store for active sessions
│   └── utils/
│       └── terminal-themes.ts      # Terminal color theme definitions
├── server/
│   ├── index.ts            # Standalone WS server entry point
│   ├── next-server.ts      # Next.js + WS server combined entry
│   ├── websocket-server.ts # WebSocket server (session management, message routing)
│   └── ssh-manager.ts      # SSHConnection class (ssh2 wrapper, SFTP, port forwards)
├── types/
│   └── ssh.ts              # Shared TypeScript types
└── public/                 # Static assets (favicons)
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

```bash
git clone <repository-url>
cd web-ssh-client
npm install
```

### Development

Run the Next.js dev server and the WebSocket SSH server concurrently:

```bash
npm run dev:all
```

Or run them separately:

```bash
# Terminal 1 — Next.js frontend
npm run dev

# Terminal 2 — WebSocket SSH server (default port 8080)
npm run server
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production

```bash
npm run build
npm run start
```

`npm start` uses `server/next-server.ts`, which attaches the WebSocket server to the same HTTP server as Next.js — no separate process required in production.

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SSH_WS_PORT` | `8080` | Port for the standalone WebSocket server (`npm run server`) |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:8080` | WebSocket URL used by the browser client |

Create a `.env.local` file to override defaults:

```env
NEXT_PUBLIC_WS_URL=ws://your-server:8080
```

---

## Architecture

```
Browser                          Node.js Server
┌─────────────────────────┐      ┌──────────────────────────────┐
│  Next.js App (React)    │      │  WebSocket Server            │
│                         │      │                              │
│  SSHClient component    │      │  SSHWebSocketServer          │
│   └─ useWebSocket hook  │◄────►│   └─ SessionMap              │
│       (ws messages)     │      │       └─ SSHConnection       │
│                         │      │           └─ ssh2 Client     │
│  useTerminal hook       │      │               ├─ Shell PTY   │
│   └─ xterm.js           │      │               ├─ SFTP        │
│       ├─ WebGL renderer │      │               └─ Port Fwds   │
│       └─ FitAddon       │      └──────────────────────────────┘
└─────────────────────────┘           │
                                       ▼
                               Remote SSH Server
```

**Message flow:**
1. Browser `useWebSocket` opens a WebSocket connection to the server
2. Server assigns a `sessionId` and sends `status: ready`
3. User fills out `ConnectionDialog` → browser sends `connect` message with `SSHConnectionConfig`
4. Server creates an `SSHConnection`, establishes an SSH session, opens a PTY shell
5. Terminal I/O is streamed bidirectionally as `data` messages
6. SFTP and port-forward operations use their own typed message types

---

## WebSocket Message Types

| Type | Direction | Description |
|---|---|---|
| `connect` | → Server | Initiate SSH connection |
| `disconnect` | → Server | Close SSH session |
| `data` | ↔ Both | Terminal keystroke / PTY output |
| `resize` | → Server | Terminal resize event |
| `keyboard-interactive` | ↔ Both | Challenge/response auth |
| `status` | ← Server | Connection status update |
| `sftp:list` | ↔ Both | List remote directory |
| `sftp:stat` | ↔ Both | File/directory stat |
| `sftp:download` | ↔ Both | Download file |
| `sftp:upload` | → Server | Upload file |
| `sftp:delete` | → Server | Delete file or directory |
| `sftp:mkdir` | → Server | Create directory |
| `sftp:rename` | → Server | Rename/move file |
| `portforward:start` | ↔ Both | Start port forward |
| `portforward:stop` | → Server | Stop port forward |

---

## SSH Authentication Methods

| Method | Notes |
|---|---|
| **Password** | Standard username + password |
| **Private Key** | PEM/OpenSSH key file with optional passphrase. Upload via browser file picker. |
| **Keyboard Interactive** | Challenge-response (e.g., 2FA, OTP). Browser renders prompts inline. |
| **SSH Agent** | Delegates to a local SSH agent socket (`SSH_AUTH_SOCK`) |

---

## Connection Profiles

Profiles are saved in `localStorage` via Zustand persist. Each profile stores:

- Connection details (host, port, username, auth method)
- Advanced options (keepalive, timeout, terminal type, startup command, host key verification)
- Folder assignment for organization

**Profiles do not store passwords or private keys** — only the auth method is persisted.

Export/import profiles as JSON via the connection profiles panel for backup or sharing (without credentials).

---

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Next.js dev server with webpack |
| `npm run dev:all` | Next.js + WebSocket server concurrently |
| `npm run server` | Standalone WebSocket SSH server only |
| `npm run build` | Production Next.js build |
| `npm start` | Production server (Next.js + WS combined) |
| `npm run lint` | ESLint |

---

## Security Considerations

- The WebSocket server executes real SSH connections from the server host. **Do not expose port 8080 publicly** without authentication/authorization middleware.
- Private keys are transmitted over the WebSocket connection — **use TLS (wss://)** in production.
- Host key verification is configurable. Use `strict` mode in production environments.
- No credentials are persisted to `localStorage` — only connection metadata.

---

## License

MIT

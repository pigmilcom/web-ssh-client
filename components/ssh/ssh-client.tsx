'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Terminal,
  FolderTree,
  Settings,
  Plug,
  PlugZap,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useWebSocket } from '@/lib/hooks/use-websocket';
import { useSessionStore } from '@/lib/stores/session-store';
import { useConnectionStore, createConnectionConfig } from '@/lib/stores/connection-store';
import { TerminalView } from './terminal-view';
import { TerminalTabs } from './terminal-tabs';
import { ConnectionDialog } from './connection-dialog';
import { ConnectionProfiles } from './connection-profiles';
import { SFTPPanel } from './sftp-panel';
import { PortForwardDialog } from './port-forward-dialog';
import { StatusBar } from './status-bar';
import type { 
  SSHConnectionConfig, 
  ConnectionProfile, 
  ConnectionStatus,
  KeyboardInteractivePrompt,
  SFTPFileInfo,
  PortForwardConfig,
} from '@/types/ssh';
import { cn } from '@/lib/utils';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080';

export function SSHClient() {
  // UI State
  const [showSidebar, setShowSidebar] = useState(true);
  const [showSFTP, setShowSFTP] = useState(false);
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [showPortForwardDialog, setShowPortForwardDialog] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ConnectionProfile | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | undefined>();
  
  // Keyboard interactive dialog
  const [kbPrompt, setKbPrompt] = useState<KeyboardInteractivePrompt | null>(null);
  const [kbResponses, setKbResponses] = useState<string[]>([]);
  
  // SFTP state
  const [sftpFiles, setSftpFiles] = useState<SFTPFileInfo[]>([]);
  const [sftpPath, setSftpPath] = useState('/');
  const [sftpLoading, setSftpLoading] = useState(false);

  // Terminal state
  const [terminalSize, setTerminalSize] = useState({ cols: 80, rows: 24 });
  const terminalWriteRef = useRef<((data: string) => void) | null>(null);
  const pendingConnectionRef = useRef<SSHConnectionConfig | null>(null);

  // Stores
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const addSession = useSessionStore((s) => s.addSession);
  const updateSession = useSessionStore((s) => s.updateSession);
  const removeSession = useSessionStore((s) => s.removeSession);
  const portForwards = useSessionStore((s) => s.portForwards);
  const addRecentConnection = useConnectionStore((s) => s.addRecentConnection);
  const getProfile = useConnectionStore((s) => s.getProfile);

  // WebSocket connection
  const {
    isConnected: wsConnected,
    isSSHConnected,
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
  } = useWebSocket({
    url: WS_URL,
    onData: (data) => {
      // Write to terminal
      const write = (window as unknown as { terminalWrite?: (data: string) => void }).terminalWrite;
      if (write) {
        write(data);
      }
    },
    onStatus: (status) => {
      setConnectionStatus(status);
      if (status.status === 'connected') {
        setIsConnecting(false);
        if (activeSessionId) {
          updateSession(activeSessionId, { status: 'connected' });
        }
      } else if (status.status === 'disconnected') {
        setIsConnecting(false);
        if (activeSessionId) {
          updateSession(activeSessionId, { status: 'disconnected' });
        }
      } else if (status.status === 'error') {
        setIsConnecting(false);
        if (activeSessionId) {
          updateSession(activeSessionId, { 
            status: 'error',
            errorMessage: status.message,
          });
        }
      }
    },
    onError: (error) => { 
      setIsConnecting(false);
    },
    onKeyboardInteractive: (prompt) => {
      setKbPrompt(prompt);
      setKbResponses(new Array(prompt.prompts.length).fill(''));
    },
    onSFTPList: (path, files) => {
      setSftpPath(path);
      setSftpFiles(files);
      setSftpLoading(false);
    },
    onSFTPDownload: (remotePath, data) => {
      // Trigger download in browser
      const filename = remotePath.split('/').pop() || 'download';
      const blob = new Blob([Buffer.from(data, 'base64')]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSFTPUpload: (remotePath, success) => {
      if (success) {
        sftpList(sftpPath); // Refresh
      }
    },
    onSFTPOperation: (type, success, path) => {
      if (success) {
        sftpList(sftpPath); // Refresh
      }
    },
    onPortForward: (config, success) => {
      // Port forward started/stopped
    },
  });

  // Handle connection from dialog
  const handleConnect = useCallback((config: SSHConnectionConfig) => {
    setShowConnectionDialog(false);
    setEditingProfile(null);
    setIsConnecting(true);

    // Create a new session
    const session = {
      id: `session_${Date.now()}`,
      connectionId: config.id,
      name: config.name,
      status: 'connecting' as const,
      createdAt: Date.now(),
      terminal: terminalSize,
    };
    
    addSession(session);
    addRecentConnection(config.id);
    pendingConnectionRef.current = config;
    
    // Connect after terminal is ready
    setTimeout(() => {
      connectSSH(config, terminalSize.cols, terminalSize.rows);
    }, 100);
  }, [terminalSize, addSession, addRecentConnection, connectSSH]);

  // Handle profile selection
  const handleSelectProfile = useCallback((profile: ConnectionProfile) => {
    setEditingProfile(null);
    setShowConnectionDialog(true);
    // Pre-fill dialog with profile data
    pendingConnectionRef.current = createConnectionConfig(profile, {});
  }, []);

  // Handle editing profile
  const handleEditProfile = useCallback((profile: ConnectionProfile) => {
    setEditingProfile(profile);
    setShowConnectionDialog(true);
  }, []);

  // Handle new connection button
  const handleNewConnection = useCallback(() => {
    setEditingProfile(null);
    setShowConnectionDialog(true);
  }, []);

  // Handle terminal ready
  const handleTerminalReady = useCallback((cols: number, rows: number) => {
    setTerminalSize({ cols, rows });
    
    // If we have a pending connection, connect now
    if (pendingConnectionRef.current && isConnecting) {
      connectSSH(pendingConnectionRef.current, cols, rows);
      pendingConnectionRef.current = null;
    }
  }, [isConnecting, connectSSH]);

  // Handle terminal data input
  const handleTerminalData = useCallback((data: string) => {
    sendData(data);
  }, [sendData]);

  // Handle terminal resize
  const handleTerminalResize = useCallback((cols: number, rows: number) => {
    setTerminalSize({ cols, rows });
    resize(cols, rows);
  }, [resize]);

  // Handle tab operations
  const handleCloseTab = useCallback((sessionId: string) => {
    if (sessionId === activeSessionId && isSSHConnected) {
      disconnectSSH();
    }
    removeSession(sessionId);
  }, [activeSessionId, isSSHConnected, disconnectSSH, removeSession]);

  const handleDuplicateTab = useCallback((sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      const profile = getProfile(session.connectionId);
      if (profile) {
        handleSelectProfile(profile);
      }
    }
  }, [sessions, getProfile, handleSelectProfile]);

  const handleReconnect = useCallback((sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      const profile = getProfile(session.connectionId);
      if (profile) {
        handleSelectProfile(profile);
      }
    }
  }, [sessions, getProfile, handleSelectProfile]);

  // Handle keyboard interactive response
  const handleKbSubmit = useCallback(() => {
    if (kbPrompt) {
      respondKeyboardInteractive(kbResponses);
      setKbPrompt(null);
      setKbResponses([]);
    }
  }, [kbPrompt, kbResponses, respondKeyboardInteractive]);

  // SFTP handlers
  const handleSFTPList = useCallback((path: string) => {
    setSftpLoading(true);
    sftpList(path);
  }, [sftpList]);

  // Active port forwards count
  const activePortForwards = portForwards.filter((pf) => pf.enabled).length;

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen bg-[#1e1e1e]">
        {/* Activity bar */}
        <div className="flex h-full">
          {/* Side activity bar */}
          <div className="flex flex-col w-12 bg-[#333333] border-r border-[#252526]">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'w-12 h-12 rounded-none',
                    showSidebar && !showSFTP
                      ? 'text-white border-l-2 border-l-white bg-[#252526]'
                      : 'text-gray-500 hover:text-white'
                  )}
                  onClick={() => {
                    setShowSFTP(false);
                    setShowSidebar(!showSidebar || showSFTP);
                  }}
                >
                  <Plug className="h-6 w-6" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Connections</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'w-12 h-12 rounded-none',
                    showSidebar && showSFTP
                      ? 'text-white border-l-2 border-l-white bg-[#252526]'
                      : 'text-gray-500 hover:text-white'
                  )}
                  onClick={() => {
                    setShowSFTP(true);
                    setShowSidebar(!showSidebar || !showSFTP);
                  }}
                  disabled={!isSSHConnected}
                >
                  <FolderTree className="h-6 w-6" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">File Explorer (SFTP)</TooltipContent>
            </Tooltip>

            <div className="flex-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-12 h-12 rounded-none text-gray-500 hover:text-white"
                  onClick={() => setShowPortForwardDialog(true)}
                >
                  <div className="relative">
                    <PlugZap className="h-6 w-6" />
                    {activePortForwards > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#0e639c] rounded-full text-[10px] flex items-center justify-center text-white">
                        {activePortForwards}
                      </span>
                    )}
                  </div>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Port Forwarding</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-12 h-12 rounded-none text-gray-500 hover:text-white"
                >
                  <Settings className="h-6 w-6" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Settings</TooltipContent>
            </Tooltip>
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Tab bar */}
            <TerminalTabs
              onNewTab={handleNewConnection}
              onCloseTab={handleCloseTab}
              onDuplicateTab={handleDuplicateTab}
              onReconnect={handleReconnect}
            />

            {/* Main area with sidebar and terminal */}
            <div className="flex-1 flex min-h-0">
              {/* Sidebar */}
              {showSidebar && (
                <div className="w-64 shrink-0 border-r border-[#252526]">
                  {showSFTP ? (
                    <SFTPPanel
                      isConnected={isSSHConnected}
                      onListDirectory={handleSFTPList}
                      onDownload={sftpDownload}
                      onUpload={sftpUpload}
                      onDelete={sftpDelete}
                      onMkdir={sftpMkdir}
                      onRename={sftpRename}
                      files={sftpFiles}
                      currentPath={sftpPath}
                      isLoading={sftpLoading}
                    />
                  ) : (
                    <ConnectionProfiles
                      onSelectProfile={handleSelectProfile}
                      onEditProfile={handleEditProfile}
                      onNewConnection={handleNewConnection}
                    />
                  )}
                </div>
              )}

              {/* Terminal area */}
              <div className="flex-1 min-w-0">
                {sessions.length === 0 ? (
                  <div className="flex items-center justify-center h-full bg-[#1e1e1e] text-gray-500">
                    <div className="text-center">
                      <Terminal className="h-16 w-16 mx-auto mb-4 opacity-30" />
                      <h2 className="text-xl font-semibold text-white mb-2">Web SSH Client</h2>
                      <p className="text-sm mb-4">Connect to your servers via SSH in the browser</p>
                      <Button
                        onClick={handleNewConnection}
                        className="bg-[#0e639c] hover:bg-[#1177bb] text-white"
                      >
                        <Plug className="h-4 w-4 mr-2" />
                        New Connection
                      </Button>
                    </div>
                  </div>
                ) : (
                  <TerminalView
                    theme="vscode"
                    onData={handleTerminalData}
                    onResize={handleTerminalResize}
                    onReady={handleTerminalReady}
                    className="h-full"
                  />
                )}
              </div>
            </div>

            {/* Status bar */}
            <StatusBar
              status={connectionStatus}
              terminalSize={terminalSize}
              onPortForwardClick={() => setShowPortForwardDialog(true)}
              portForwardCount={activePortForwards}
            />
          </div>
        </div>

        {/* Connection Dialog */}
        <ConnectionDialog
          open={showConnectionDialog}
          onOpenChange={setShowConnectionDialog}
          onConnect={handleConnect}
          editProfile={editingProfile || undefined}
          isConnecting={isConnecting}
        />

        {/* Port Forwarding Dialog */}
        <PortForwardDialog
          open={showPortForwardDialog}
          onOpenChange={setShowPortForwardDialog}
          isConnected={isSSHConnected}
          onStartForward={startPortForward}
          onStopForward={stopPortForward}
        />

        {/* Keyboard Interactive Dialog */}
        <Dialog open={!!kbPrompt} onOpenChange={() => setKbPrompt(null)}>
          <DialogContent className="sm:max-w-112.5 bg-[#1e1e1e] border-[#3c3c3c] text-white">
            <DialogHeader>
              <DialogTitle className="text-white">
                {kbPrompt?.name || 'Authentication Required'}
              </DialogTitle>
            </DialogHeader>
            {kbPrompt?.instructions && (
              <p className="text-sm text-gray-400">{kbPrompt.instructions}</p>
            )}
            <div className="space-y-4 py-4">
              {kbPrompt?.prompts.map((prompt, index) => (
                <div key={index} className="space-y-2">
                  <Label className="text-gray-300">{prompt.prompt}</Label>
                  <Input
                    type={prompt.echo ? 'text' : 'password'}
                    value={kbResponses[index] || ''}
                    onChange={(e) => {
                      const newResponses = [...kbResponses];
                      newResponses[index] = e.target.value;
                      setKbResponses(newResponses);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && index === (kbPrompt?.prompts.length || 0) - 1) {
                        handleKbSubmit();
                      }
                    }}
                    className="bg-[#3c3c3c] border-[#3c3c3c] text-white"
                  />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setKbPrompt(null)}
                className="bg-transparent border-[#3c3c3c] text-gray-300 hover:bg-[#3c3c3c] hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleKbSubmit}
                className="bg-[#0e639c] hover:bg-[#1177bb] text-white"
              >
                Submit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

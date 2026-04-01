'use client';

import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Key, Lock, Keyboard, User, Upload, Save, Loader2 } from 'lucide-react';
import { useConnectionStore } from '@/lib/stores/connection-store';
import type { SSHConnectionConfig, AuthMethod, ConnectionProfile } from '@/types/ssh';

interface ConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (config: SSHConnectionConfig) => void;
  editProfile?: ConnectionProfile;
  isConnecting?: boolean;
}

export function ConnectionDialog({
  open,
  onOpenChange,
  onConnect,
  editProfile,
  isConnecting = false,
}: ConnectionDialogProps) {
  const addProfile = useConnectionStore((s) => s.addProfile);
  const updateProfile = useConnectionStore((s) => s.updateProfile);

  // Basic connection settings
  const [name, setName] = useState(editProfile?.name || '');
  const [host, setHost] = useState(editProfile?.host || '');
  const [port, setPort] = useState(editProfile?.port?.toString() || '22');
  const [username, setUsername] = useState(editProfile?.username || '');
  const [authMethod, setAuthMethod] = useState<AuthMethod>(editProfile?.authMethod || 'password');
  
  // Auth credentials
  const [password, setPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [passphrase, setPassphrase] = useState('');

  // Advanced settings
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [keepaliveInterval, setKeepaliveInterval] = useState(
    editProfile?.keepaliveInterval?.toString() || '10000'
  );
  const [readyTimeout, setReadyTimeout] = useState(
    editProfile?.readyTimeout?.toString() || '20000'
  );
  const [terminalType, setTerminalType] = useState(editProfile?.terminalType || 'xterm-256color');
  const [startupCommand, setStartupCommand] = useState(editProfile?.startupCommand || '');
  const [hostKeyVerification, setHostKeyVerification] = useState<'strict' | 'warn' | 'none'>(
    editProfile?.hostKeyVerification || 'warn'
  );

  const [saveAsProfile, setSaveAsProfile] = useState(false);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPrivateKey(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  }, []);

  const handleConnect = useCallback(() => {
    const config: SSHConnectionConfig = {
      id: editProfile?.id || `conn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name: name || `${username}@${host}`,
      host,
      port: parseInt(port, 10) || 22,
      username,
      authMethod,
      password: authMethod === 'password' ? password : undefined,
      privateKey: authMethod === 'privateKey' ? privateKey : undefined,
      passphrase: authMethod === 'privateKey' ? passphrase : undefined,
      keepaliveInterval: parseInt(keepaliveInterval, 10) || 10000,
      readyTimeout: parseInt(readyTimeout, 10) || 20000,
      terminalType,
      startupCommand: startupCommand || undefined,
      hostKeyVerification,
    };

    // Save as profile if requested
    if (saveAsProfile && !editProfile) {
      const profile: ConnectionProfile = {
        id: config.id,
        name: config.name,
        host: config.host,
        port: config.port,
        username: config.username,
        authMethod: config.authMethod,
        keepaliveInterval: config.keepaliveInterval,
        readyTimeout: config.readyTimeout,
        terminalType: config.terminalType,
        startupCommand: config.startupCommand,
        hostKeyVerification: config.hostKeyVerification,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      addProfile(profile);
    } else if (editProfile) {
      updateProfile(editProfile.id, {
        name: config.name,
        host: config.host,
        port: config.port,
        username: config.username,
        authMethod: config.authMethod,
        keepaliveInterval: config.keepaliveInterval,
        readyTimeout: config.readyTimeout,
        terminalType: config.terminalType,
        startupCommand: config.startupCommand,
        hostKeyVerification: config.hostKeyVerification,
      });
    }

    onConnect(config);
  }, [
    name, host, port, username, authMethod, password, privateKey, passphrase,
    keepaliveInterval, readyTimeout, terminalType, startupCommand, hostKeyVerification,
    saveAsProfile, editProfile, addProfile, updateProfile, onConnect
  ]);

  const isValid = host && username && (
    (authMethod === 'password' && password) ||
    (authMethod === 'privateKey' && privateKey) ||
    authMethod === 'keyboardInteractive' ||
    authMethod === 'agent'
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-130 bg-[#1e1e1e] border-[#3c3c3c] text-white">
        <DialogHeader>
          <DialogTitle className="text-white">
            {editProfile ? 'Edit Connection' : 'New SSH Connection'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Connection name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-gray-300">Connection Name (optional)</Label>
            <Input
              id="name"
              placeholder="My Server"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-[#3c3c3c] border-[#3c3c3c] text-white placeholder:text-gray-500"
            />
          </div>

          {/* Host and Port */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-2">
              <Label htmlFor="host" className="text-gray-300">Host</Label>
              <Input
                id="host"
                placeholder="example.com or 192.168.1.1"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                className="bg-[#3c3c3c] border-[#3c3c3c] text-white placeholder:text-gray-500"
              />
            </div>
            <div className="w-24 space-y-2">
              <Label htmlFor="port" className="text-gray-300">Port</Label>
              <Input
                id="port"
                type="number"
                placeholder="22"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="bg-[#3c3c3c] border-[#3c3c3c] text-white placeholder:text-gray-500"
              />
            </div>
          </div>

          {/* Username */}
          <div className="space-y-2">
            <Label htmlFor="username" className="text-gray-300">Username</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                id="username"
                placeholder="root"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="pl-9 bg-[#3c3c3c] border-[#3c3c3c] text-white placeholder:text-gray-500"
              />
            </div>
          </div>

          {/* Authentication Method */}
          <div className="space-y-2">
            <Label className="text-gray-300">Authentication Method</Label>
            <Tabs value={authMethod} onValueChange={(v) => setAuthMethod(v as AuthMethod)}>
              <TabsList className="grid grid-cols-4 bg-[#2d2d2d]">
                <TabsTrigger value="password" className="data-[state=active]:bg-[#3c3c3c] text-gray-300">
                  <Lock className="h-4 w-4 mr-1" />
                  Password
                </TabsTrigger>
                <TabsTrigger value="privateKey" className="data-[state=active]:bg-[#3c3c3c] text-gray-300">
                  <Key className="h-4 w-4 mr-1" />
                  Key
                </TabsTrigger>
                <TabsTrigger value="keyboardInteractive" className="data-[state=active]:bg-[#3c3c3c] text-gray-300">
                  <Keyboard className="h-4 w-4 mr-1" />
                  2FA
                </TabsTrigger>
                <TabsTrigger value="agent" className="data-[state=active]:bg-[#3c3c3c] text-gray-300">
                  Agent
                </TabsTrigger>
              </TabsList>

              <TabsContent value="password" className="space-y-2 mt-3">
                <Label htmlFor="password" className="text-gray-300">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-[#3c3c3c] border-[#3c3c3c] text-white placeholder:text-gray-500"
                />
              </TabsContent>

              <TabsContent value="privateKey" className="space-y-3 mt-3">
                <div className="space-y-2">
                  <Label className="text-gray-300">Private Key</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('keyfile')?.click()}
                      className="bg-[#3c3c3c] border-[#3c3c3c] text-gray-300 hover:bg-[#4c4c4c] hover:text-white"
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      Upload Key File
                    </Button>
                    <input
                      id="keyfile"
                      type="file"
                      className="hidden"
                      onChange={handleFileUpload}
                      accept=".pem,.key,.ppk,*"
                    />
                  </div>
                  <Textarea
                    placeholder="Or paste your private key here..."
                    value={privateKey}
                    onChange={(e) => setPrivateKey(e.target.value)}
                    rows={4}
                    className="font-mono text-xs bg-[#3c3c3c] border-[#3c3c3c] text-white placeholder:text-gray-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passphrase" className="text-gray-300">Passphrase (if encrypted)</Label>
                  <Input
                    id="passphrase"
                    type="password"
                    placeholder="Key passphrase"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    className="bg-[#3c3c3c] border-[#3c3c3c] text-white placeholder:text-gray-500"
                  />
                </div>
              </TabsContent>

              <TabsContent value="keyboardInteractive" className="mt-3">
                <p className="text-sm text-gray-400">
                  Keyboard-interactive authentication will prompt for credentials during connection.
                  This is commonly used for 2FA or custom authentication prompts.
                </p>
              </TabsContent>

              <TabsContent value="agent" className="mt-3">
                <p className="text-sm text-gray-400">
                  Uses SSH agent for authentication. Make sure your SSH agent is running and has the required keys loaded.
                </p>
              </TabsContent>
            </Tabs>
          </div>

          {/* Advanced Settings */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between text-gray-400 hover:text-white hover:bg-[#3c3c3c]"
              >
                Advanced Settings
                <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="keepalive" className="text-gray-300">Keepalive (ms)</Label>
                  <Input
                    id="keepalive"
                    type="number"
                    value={keepaliveInterval}
                    onChange={(e) => setKeepaliveInterval(e.target.value)}
                    className="bg-[#3c3c3c] border-[#3c3c3c] text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeout" className="text-gray-300">Timeout (ms)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    value={readyTimeout}
                    onChange={(e) => setReadyTimeout(e.target.value)}
                    className="bg-[#3c3c3c] border-[#3c3c3c] text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="termtype" className="text-gray-300">Terminal Type</Label>
                <Select value={terminalType} onValueChange={setTerminalType}>
                  <SelectTrigger className="bg-[#3c3c3c] border-[#3c3c3c] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2d2d2d] border-[#3c3c3c]">
                    <SelectItem value="xterm-256color" className="text-white">xterm-256color</SelectItem>
                    <SelectItem value="xterm" className="text-white">xterm</SelectItem>
                    <SelectItem value="vt100" className="text-white">vt100</SelectItem>
                    <SelectItem value="vt102" className="text-white">vt102</SelectItem>
                    <SelectItem value="vt220" className="text-white">vt220</SelectItem>
                    <SelectItem value="ansi" className="text-white">ansi</SelectItem>
                    <SelectItem value="linux" className="text-white">linux</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hostkey" className="text-gray-300">Host Key Verification</Label>
                <Select value={hostKeyVerification} onValueChange={(v) => setHostKeyVerification(v as typeof hostKeyVerification)}>
                  <SelectTrigger className="bg-[#3c3c3c] border-[#3c3c3c] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2d2d2d] border-[#3c3c3c]">
                    <SelectItem value="strict" className="text-white">Strict (reject unknown hosts)</SelectItem>
                    <SelectItem value="warn" className="text-white">Warn (show warning for unknown)</SelectItem>
                    <SelectItem value="none" className="text-white">None (trust all hosts)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="startup" className="text-gray-300">Startup Command</Label>
                <Input
                  id="startup"
                  placeholder="e.g., cd /var/www && bash"
                  value={startupCommand}
                  onChange={(e) => setStartupCommand(e.target.value)}
                  className="bg-[#3c3c3c] border-[#3c3c3c] text-white placeholder:text-gray-500"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Save as profile option */}
          {!editProfile && (
            <div className="flex items-center gap-2">
              <Switch
                checked={saveAsProfile}
                onCheckedChange={setSaveAsProfile}
                id="save-profile"
              />
              <Label htmlFor="save-profile" className="text-gray-300 cursor-pointer">
                <Save className="h-4 w-4 inline mr-1" />
                Save as connection profile
              </Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="bg-transparent border-[#3c3c3c] text-gray-300 hover:bg-[#3c3c3c] hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConnect}
            disabled={!isValid || isConnecting}
            className="bg-[#0e639c] hover:bg-[#1177bb] text-white"
          >
            {isConnecting ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Connecting...
              </>
            ) : (
              'Connect'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

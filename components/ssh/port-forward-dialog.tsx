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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowRightLeft,
  ArrowRight,
  ArrowLeft,
  Globe,
  Plus,
  Trash2,
  Play,
  Square,
} from 'lucide-react';
import { useSessionStore } from '@/lib/stores/session-store';
import type { PortForwardConfig, PortForwardType } from '@/types/ssh';
import { cn } from '@/lib/utils';

interface PortForwardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isConnected: boolean;
  onStartForward: (config: PortForwardConfig) => void;
  onStopForward: (id: string) => void;
}

export function PortForwardDialog({
  open,
  onOpenChange,
  isConnected,
  onStartForward,
  onStopForward,
}: PortForwardDialogProps) {
  const portForwards = useSessionStore((s) => s.portForwards);
  const addPortForward = useSessionStore((s) => s.addPortForward);
  const removePortForward = useSessionStore((s) => s.removePortForward);
  const updatePortForward = useSessionStore((s) => s.updatePortForward);

  const [type, setType] = useState<PortForwardType>('local');
  const [localHost, setLocalHost] = useState('127.0.0.1');
  const [localPort, setLocalPort] = useState('');
  const [remoteHost, setRemoteHost] = useState('localhost');
  const [remotePort, setRemotePort] = useState('');

  const handleAdd = useCallback(() => {
    if (!localPort) return;

    const config: PortForwardConfig = {
      id: `pf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type,
      localHost,
      localPort: parseInt(localPort, 10),
      remoteHost: type !== 'dynamic' ? remoteHost : undefined,
      remotePort: type !== 'dynamic' ? parseInt(remotePort, 10) || undefined : undefined,
      enabled: false,
    };

    addPortForward(config);
    setLocalPort('');
    setRemotePort('');
  }, [type, localHost, localPort, remoteHost, remotePort, addPortForward]);

  const handleToggle = useCallback((config: PortForwardConfig) => {
    if (config.enabled) {
      onStopForward(config.id);
      updatePortForward(config.id, { enabled: false });
    } else {
      onStartForward(config);
      updatePortForward(config.id, { enabled: true });
    }
  }, [onStartForward, onStopForward, updatePortForward]);

  const handleRemove = useCallback((id: string) => {
    const config = portForwards.find((pf) => pf.id === id);
    if (config?.enabled) {
      onStopForward(id);
    }
    removePortForward(id);
  }, [portForwards, onStopForward, removePortForward]);

  const getTypeIcon = (t: PortForwardType) => {
    switch (t) {
      case 'local':
        return <ArrowRight className="h-4 w-4" />;
      case 'remote':
        return <ArrowLeft className="h-4 w-4" />;
      case 'dynamic':
        return <Globe className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (t: PortForwardType) => {
    switch (t) {
      case 'local':
        return 'Local';
      case 'remote':
        return 'Remote';
      case 'dynamic':
        return 'SOCKS';
    }
  };

  const formatForward = (config: PortForwardConfig) => {
    if (config.type === 'dynamic') {
      return `${config.localHost}:${config.localPort} (SOCKS5)`;
    }
    if (config.type === 'local') {
      return `${config.localHost}:${config.localPort} → ${config.remoteHost}:${config.remotePort}`;
    }
    return `${config.remoteHost}:${config.remotePort} → ${config.localHost}:${config.localPort}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-137.5 bg-[#1e1e1e] border-[#3c3c3c] text-white">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Port Forwarding
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Add new forward */}
          <div className="space-y-4">
            <Tabs value={type} onValueChange={(v) => setType(v as PortForwardType)}>
              <TabsList className="grid grid-cols-3 bg-[#2d2d2d]">
                <TabsTrigger value="local" className="data-[state=active]:bg-[#3c3c3c] text-gray-300">
                  <ArrowRight className="h-4 w-4 mr-1" />
                  Local
                </TabsTrigger>
                <TabsTrigger value="remote" className="data-[state=active]:bg-[#3c3c3c] text-gray-300">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Remote
                </TabsTrigger>
                <TabsTrigger value="dynamic" className="data-[state=active]:bg-[#3c3c3c] text-gray-300">
                  <Globe className="h-4 w-4 mr-1" />
                  SOCKS
                </TabsTrigger>
              </TabsList>

              <TabsContent value="local" className="space-y-3 mt-3">
                <p className="text-xs text-gray-400">
                  Forward connections from your local machine to a remote host through the SSH server.
                </p>
                <div className="grid grid-cols-5 gap-2 items-end">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-gray-300 text-xs">Local</Label>
                    <div className="flex gap-1">
                      <Input
                        placeholder="127.0.0.1"
                        value={localHost}
                        onChange={(e) => setLocalHost(e.target.value)}
                        className="h-8 text-sm bg-[#3c3c3c] border-[#3c3c3c] text-white placeholder:text-gray-500"
                      />
                      <Input
                        type="number"
                        placeholder="Port"
                        value={localPort}
                        onChange={(e) => setLocalPort(e.target.value)}
                        className="h-8 w-20 text-sm bg-[#3c3c3c] border-[#3c3c3c] text-white placeholder:text-gray-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <ArrowRight className="h-4 w-4 text-gray-500" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-gray-300 text-xs">Remote</Label>
                    <div className="flex gap-1">
                      <Input
                        placeholder="localhost"
                        value={remoteHost}
                        onChange={(e) => setRemoteHost(e.target.value)}
                        className="h-8 text-sm bg-[#3c3c3c] border-[#3c3c3c] text-white placeholder:text-gray-500"
                      />
                      <Input
                        type="number"
                        placeholder="Port"
                        value={remotePort}
                        onChange={(e) => setRemotePort(e.target.value)}
                        className="h-8 w-20 text-sm bg-[#3c3c3c] border-[#3c3c3c] text-white placeholder:text-gray-500"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="remote" className="space-y-3 mt-3">
                <p className="text-xs text-gray-400">
                  Forward connections from the remote server to your local machine.
                </p>
                <div className="grid grid-cols-5 gap-2 items-end">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-gray-300 text-xs">Remote</Label>
                    <div className="flex gap-1">
                      <Input
                        placeholder="0.0.0.0"
                        value={remoteHost}
                        onChange={(e) => setRemoteHost(e.target.value)}
                        className="h-8 text-sm bg-[#3c3c3c] border-[#3c3c3c] text-white placeholder:text-gray-500"
                      />
                      <Input
                        type="number"
                        placeholder="Port"
                        value={remotePort}
                        onChange={(e) => setRemotePort(e.target.value)}
                        className="h-8 w-20 text-sm bg-[#3c3c3c] border-[#3c3c3c] text-white placeholder:text-gray-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <ArrowLeft className="h-4 w-4 text-gray-500" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-gray-300 text-xs">Local</Label>
                    <div className="flex gap-1">
                      <Input
                        placeholder="127.0.0.1"
                        value={localHost}
                        onChange={(e) => setLocalHost(e.target.value)}
                        className="h-8 text-sm bg-[#3c3c3c] border-[#3c3c3c] text-white placeholder:text-gray-500"
                      />
                      <Input
                        type="number"
                        placeholder="Port"
                        value={localPort}
                        onChange={(e) => setLocalPort(e.target.value)}
                        className="h-8 w-20 text-sm bg-[#3c3c3c] border-[#3c3c3c] text-white placeholder:text-gray-500"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="dynamic" className="space-y-3 mt-3">
                <p className="text-xs text-gray-400">
                  Create a SOCKS5 proxy server on your local machine. Configure your browser or apps to use this proxy.
                </p>
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <Label className="text-gray-300 text-xs">Local Bind Address</Label>
                    <Input
                      placeholder="127.0.0.1"
                      value={localHost}
                      onChange={(e) => setLocalHost(e.target.value)}
                      className="h-8 text-sm bg-[#3c3c3c] border-[#3c3c3c] text-white placeholder:text-gray-500"
                    />
                  </div>
                  <div className="w-24 space-y-1">
                    <Label className="text-gray-300 text-xs">Port</Label>
                    <Input
                      type="number"
                      placeholder="1080"
                      value={localPort}
                      onChange={(e) => setLocalPort(e.target.value)}
                      className="h-8 text-sm bg-[#3c3c3c] border-[#3c3c3c] text-white placeholder:text-gray-500"
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <Button
              onClick={handleAdd}
              disabled={!localPort || !isConnected}
              className="w-full bg-[#0e639c] hover:bg-[#1177bb] text-white"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Port Forward
            </Button>
          </div>

          {/* Existing forwards */}
          <div className="space-y-2">
            <Label className="text-gray-300">Active Forwards</Label>
            {portForwards.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-sm">
                No port forwards configured
              </div>
            ) : (
              <ScrollArea className="h-50">
                <div className="space-y-2">
                  {portForwards.map((config) => (
                    <div
                      key={config.id}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded bg-[#2d2d2d] border',
                        config.enabled ? 'border-green-500/30' : 'border-[#3c3c3c]'
                      )}
                    >
                      <div className={cn(
                        'p-1.5 rounded',
                        config.enabled ? 'bg-green-500/20 text-green-400' : 'bg-[#3c3c3c] text-gray-500'
                      )}>
                        {getTypeIcon(config.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-400 uppercase">
                            {getTypeLabel(config.type)}
                          </span>
                          {config.enabled && (
                            <span className="text-xs text-green-400">Active</span>
                          )}
                        </div>
                        <div className="text-sm text-white truncate font-mono">
                          {formatForward(config)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            'h-7 w-7',
                            config.enabled 
                              ? 'text-green-400 hover:text-green-300 hover:bg-green-500/20'
                              : 'text-gray-400 hover:text-white hover:bg-[#3c3c3c]'
                          )}
                          onClick={() => handleToggle(config)}
                          disabled={!isConnected}
                          title={config.enabled ? 'Stop' : 'Start'}
                        >
                          {config.enabled ? (
                            <Square className="h-3.5 w-3.5" />
                          ) : (
                            <Play className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-400 hover:text-red-400 hover:bg-red-500/20"
                          onClick={() => handleRemove(config.id)}
                          title="Remove"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="bg-transparent border-[#3c3c3c] text-gray-300 hover:bg-[#3c3c3c] hover:text-white"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

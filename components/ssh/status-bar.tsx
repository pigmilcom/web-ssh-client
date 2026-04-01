'use client';

import { Button } from '@/components/ui/button';
import {
  Wifi,
  WifiOff,
  ArrowDown,
  ArrowUp,
  Clock,
  Terminal,
  ArrowRightLeft,
} from 'lucide-react';
import type { ConnectionStatus } from '@/types/ssh';
import { cn } from '@/lib/utils';

interface StatusBarProps {
  status?: ConnectionStatus;
  terminalSize?: { cols: number; rows: number };
  onPortForwardClick?: () => void;
  portForwardCount?: number;
}

export function StatusBar({
  status,
  terminalSize,
  onPortForwardClick,
  portForwardCount = 0,
}: StatusBarProps) {
  const formatBytes = (bytes?: number) => {
    if (bytes === undefined || bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getStatusColor = () => {
    switch (status?.status) {
      case 'connected':
        return 'text-green-400';
      case 'connecting':
        return 'text-yellow-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusText = () => {
    switch (status?.status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'error':
        return status.message || 'Error';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Not connected';
    }
  };

  return (
    <div className="flex items-center justify-between h-6 px-2 bg-[#007acc] text-white text-xs">
      <div className="flex items-center gap-4">
        {/* Connection status */}
        <div className={cn('flex items-center gap-1.5', getStatusColor())}>
          {status?.status === 'connected' ? (
            <Wifi className="h-3.5 w-3.5" />
          ) : (
            <WifiOff className="h-3.5 w-3.5" />
          )}
          <span>{getStatusText()}</span>
        </div>

        {/* Latency */}
        {status?.status === 'connected' && status.latency !== undefined && (
          <div className="flex items-center gap-1 text-white/80">
            <Clock className="h-3 w-3" />
            <span>{status.latency}ms</span>
          </div>
        )}

        {/* Data transfer */}
        {status?.status === 'connected' && (
          <div className="flex items-center gap-3 text-white/80">
            <div className="flex items-center gap-1">
              <ArrowDown className="h-3 w-3" />
              <span>{formatBytes(status.bytesReceived)}</span>
            </div>
            <div className="flex items-center gap-1">
              <ArrowUp className="h-3 w-3" />
              <span>{formatBytes(status.bytesSent)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Port forwarding button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-2 text-xs text-white/80 hover:text-white hover:bg-white/10"
          onClick={onPortForwardClick}
        >
          <ArrowRightLeft className="h-3 w-3 mr-1" />
          Tunnels
          {portForwardCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded bg-white/20 text-[10px]">
              {portForwardCount}
            </span>
          )}
        </Button>

        {/* Terminal size */}
        {terminalSize && (
          <div className="flex items-center gap-1 text-white/80">
            <Terminal className="h-3 w-3" />
            <span>
              {terminalSize.cols}x{terminalSize.rows}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

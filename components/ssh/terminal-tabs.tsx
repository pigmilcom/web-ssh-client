'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Plus, X, Terminal, Pencil, Copy, RotateCcw } from 'lucide-react';
import { useSessionStore } from '@/lib/stores/session-store';
import type { SSHSession } from '@/types/ssh';
import { cn } from '@/lib/utils';

interface TerminalTabsProps {
  onNewTab: () => void;
  onCloseTab: (sessionId: string) => void;
  onDuplicateTab: (sessionId: string) => void;
  onReconnect: (sessionId: string) => void;
}

export function TerminalTabs({
  onNewTab,
  onCloseTab,
  onDuplicateTab,
  onReconnect,
}: TerminalTabsProps) {
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const updateSession = useSessionStore((s) => s.updateSession);

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const handleTabClick = useCallback((sessionId: string) => {
    setActiveSession(sessionId);
  }, [setActiveSession]);

  const handleDoubleClick = useCallback((session: SSHSession) => {
    setEditingTabId(session.id);
    setEditName(session.name);
  }, []);

  const handleRename = useCallback(() => {
    if (editingTabId && editName.trim()) {
      updateSession(editingTabId, { name: editName.trim() });
    }
    setEditingTabId(null);
  }, [editingTabId, editName, updateSession]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setEditingTabId(null);
    }
  }, [handleRename]);

  useEffect(() => {
    if (editingTabId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingTabId]);

  // Handle keyboard shortcuts for tab navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+T: New tab
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        onNewTab();
      }
      // Ctrl+W: Close tab
      if (e.ctrlKey && e.key === 'w' && activeSessionId) {
        e.preventDefault();
        onCloseTab(activeSessionId);
      }
      // Ctrl+Tab: Next tab
      if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        const currentIndex = sessions.findIndex((s) => s.id === activeSessionId);
        const nextIndex = (currentIndex + 1) % sessions.length;
        if (sessions[nextIndex]) {
          setActiveSession(sessions[nextIndex].id);
        }
      }
      // Ctrl+Shift+Tab: Previous tab
      if (e.ctrlKey && e.shiftKey && e.key === 'Tab') {
        e.preventDefault();
        const currentIndex = sessions.findIndex((s) => s.id === activeSessionId);
        const prevIndex = currentIndex === 0 ? sessions.length - 1 : currentIndex - 1;
        if (sessions[prevIndex]) {
          setActiveSession(sessions[prevIndex].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sessions, activeSessionId, setActiveSession, onNewTab, onCloseTab]);

  const getStatusColor = (status: SSHSession['status']) => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500 animate-pulse';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="flex items-center h-9 bg-[#252526] border-b border-[#1e1e1e]">
      <div className="flex-1 flex items-center overflow-x-auto scrollbar-none">
        {sessions.map((session) => (
          <ContextMenu key={session.id}>
            <ContextMenuTrigger>
              <div
                className={cn(
                  'group relative flex items-center gap-2 px-3 h-9 border-r border-[#1e1e1e] cursor-pointer transition-colors min-w-[120px] max-w-[200px]',
                  activeSessionId === session.id
                    ? 'bg-[#1e1e1e] text-white'
                    : 'bg-[#2d2d2d] text-gray-400 hover:bg-[#2a2d2e]'
                )}
                onClick={() => handleTabClick(session.id)}
                onDoubleClick={() => handleDoubleClick(session)}
              >
                {/* Status indicator */}
                <span className={cn('w-2 h-2 rounded-full shrink-0', getStatusColor(session.status))} />
                
                {/* Tab icon */}
                <Terminal className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                
                {/* Tab name */}
                {editingTabId === session.id ? (
                  <Input
                    ref={editInputRef}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={handleRename}
                    onKeyDown={handleKeyDown}
                    className="h-5 px-1 text-xs bg-[#3c3c3c] border-[#3c3c3c] text-white"
                  />
                ) : (
                  <span className="flex-1 truncate text-sm">{session.name}</span>
                )}
                
                {/* Close button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-5 w-5 shrink-0 text-gray-500 hover:text-white hover:bg-[#3c3c3c] opacity-0 group-hover:opacity-100 transition-opacity',
                    activeSessionId === session.id && 'opacity-100'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(session.id);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>

                {/* Active indicator line */}
                {activeSessionId === session.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0e639c]" />
                )}
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="bg-[#2d2d2d] border-[#3c3c3c]">
              <ContextMenuItem
                onClick={() => handleDoubleClick(session)}
                className="text-gray-300 focus:bg-[#3c3c3c] focus:text-white"
              >
                <Pencil className="h-4 w-4 mr-2" />
                Rename
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => onDuplicateTab(session.id)}
                className="text-gray-300 focus:bg-[#3c3c3c] focus:text-white"
              >
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </ContextMenuItem>
              {session.status !== 'connected' && (
                <ContextMenuItem
                  onClick={() => onReconnect(session.id)}
                  className="text-gray-300 focus:bg-[#3c3c3c] focus:text-white"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reconnect
                </ContextMenuItem>
              )}
              <ContextMenuSeparator className="bg-[#3c3c3c]" />
              <ContextMenuItem
                onClick={() => onCloseTab(session.id)}
                className="text-red-400 focus:bg-[#3c3c3c] focus:text-red-300"
              >
                <X className="h-4 w-4 mr-2" />
                Close
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ))}
      </div>

      {/* New tab button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 text-gray-400 hover:text-white hover:bg-[#3c3c3c] rounded-none"
        onClick={onNewTab}
        title="New Connection (Ctrl+Shift+T)"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}

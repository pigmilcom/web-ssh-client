'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTerminal } from '@/lib/hooks/use-terminal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X, ChevronUp, ChevronDown, Copy, ClipboardPaste } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ThemeName } from '@/lib/utils/terminal-themes';
import '@xterm/xterm/css/xterm.css';

interface TerminalViewProps {
  theme?: ThemeName;
  fontSize?: number;
  onData?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
  onReady?: (cols: number, rows: number) => void;
  className?: string;
}

export function TerminalView({
  theme = 'vscode',
  fontSize = 14,
  onData,
  onResize,
  onReady,
  className,
}: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const {
    initTerminal,
    write,
    focus,
    fit,
    search,
    searchPrevious,
    clearSearch,
    getSize,
    copy,
    paste,
  } = useTerminal({
    theme,
    fontSize,
    onData,
    onResize,
  });

  useEffect(() => {
    if (containerRef.current) {
      initTerminal(containerRef.current);
      
      // Wait for terminal renderer to be fully ready before fitting/reporting size
      const timeout = setTimeout(() => {
        try { fit(); } catch { /* ignore if renderer not ready */ }
        const size = getSize();
        onReady?.(size.cols, size.rows);
        focus();
      }, 200);

      return () => clearTimeout(timeout);
    }
  }, [initTerminal, fit, getSize, onReady, focus]);

  // Expose write method to parent via ref callback or direct call
  useEffect(() => {
    (window as unknown as { terminalWrite?: (data: string) => void }).terminalWrite = write;
    return () => {
      delete (window as unknown as { terminalWrite?: (data: string) => void }).terminalWrite;
    };
  }, [write]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+F: Toggle search
      if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        setShowSearch(prev => !prev);
        if (!showSearch) {
          setTimeout(() => searchInputRef.current?.focus(), 0);
        }
      }
      // Ctrl+Shift+C: Copy
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        copy();
      }
      // Ctrl+Shift+V: Paste
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        paste();
      }
      // Escape: Close search
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
        clearSearch();
        focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch, copy, paste, clearSearch, focus]);

  const handleSearch = useCallback((direction: 'next' | 'prev') => {
    if (!searchTerm) return;
    
    if (direction === 'next') {
      search(searchTerm);
    } else {
      searchPrevious(searchTerm);
    }
  }, [searchTerm, search, searchPrevious]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch(e.shiftKey ? 'prev' : 'next');
    }
  };

  return (
    <div className={cn('relative flex flex-col h-full bg-[#1e1e1e]', className)}>
      {/* Search bar */}
      {showSearch && (
        <div className="absolute top-2 right-4 z-10 flex items-center gap-2 bg-[#252526] border border-[#3c3c3c] rounded-md p-1 shadow-lg">
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="h-7 w-48 bg-[#3c3c3c] border-none text-sm text-white placeholder:text-gray-400"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-400 hover:text-white hover:bg-[#3c3c3c]"
            onClick={() => handleSearch('prev')}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-400 hover:text-white hover:bg-[#3c3c3c]"
            onClick={() => handleSearch('next')}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-400 hover:text-white hover:bg-[#3c3c3c]"
            onClick={() => {
              setShowSearch(false);
              clearSearch();
              focus();
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Terminal actions bar */}
      <div className="absolute bottom-2 right-4 z-10 flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-gray-500 hover:text-white hover:bg-[#3c3c3c]/50 opacity-0 hover:opacity-100 transition-opacity"
          onClick={() => setShowSearch(true)}
          title="Search (Ctrl+Shift+F)"
        >
          <Search className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-gray-500 hover:text-white hover:bg-[#3c3c3c]/50 opacity-0 hover:opacity-100 transition-opacity"
          onClick={copy}
          title="Copy (Ctrl+Shift+C)"
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-gray-500 hover:text-white hover:bg-[#3c3c3c]/50 opacity-0 hover:opacity-100 transition-opacity"
          onClick={paste}
          title="Paste (Ctrl+Shift+V)"
        >
          <ClipboardPaste className="h-4 w-4" />
        </Button>
      </div>

      {/* Terminal container */}
      <div 
        ref={containerRef} 
        className="flex-1 p-2"
        onClick={focus}
      />
    </div>
  );
}

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { WebglAddon } from '@xterm/addon-webgl';
import { themes, type ThemeName } from '@/lib/utils/terminal-themes';

interface UseTerminalOptions {
  theme?: ThemeName;
  fontSize?: number;
  fontFamily?: string;
  cursorBlink?: boolean;
  onData?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
}

export function useTerminal(options: UseTerminalOptions = {}) {
  const {
    theme = 'vscode',
    fontSize = 14,
    fontFamily = "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
    cursorBlink = true,
    onData,
    onResize,
  } = options;

  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const webglAddonRef = useRef<WebglAddon | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const initTerminal = useCallback((container: HTMLDivElement) => {
    if (terminalRef.current) {
      return;
    }

    containerRef.current = container;

    const terminal = new Terminal({
      theme: themes[theme],
      fontSize,
      fontFamily,
      cursorBlink,
      allowTransparency: true,
      scrollback: 10000,
      convertEol: true,
      cursorStyle: 'block',
      allowProposedApi: true,
    });

    terminalRef.current = terminal;

    // Initialize addons
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    terminal.loadAddon(fitAddon);

    const webLinksAddon = new WebLinksAddon();
    terminal.loadAddon(webLinksAddon);

    const searchAddon = new SearchAddon();
    searchAddonRef.current = searchAddon;
    terminal.loadAddon(searchAddon);

    // Open terminal in container
    terminal.open(container);

    // Try to load WebGL addon for better performance
    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        webglAddon.dispose();
      });
      terminal.loadAddon(webglAddon);
      webglAddonRef.current = webglAddon;
    } catch {
      console.warn('WebGL addon could not be loaded, falling back to canvas renderer');
    }

    // Fit to container — defer so the renderer is fully initialised
    requestAnimationFrame(() => {
      try { fitAddon.fit(); } catch { /* renderer not ready yet */ }
    });

    // Handle data input
    terminal.onData((data) => {
      onData?.(data);
    });

    // Handle resize
    terminal.onResize(({ cols, rows }) => {
      onResize?.(cols, rows);
    });

    // Setup resize observer
    resizeObserverRef.current = new ResizeObserver(() => {
      if (fitAddonRef.current) {
        try { fitAddonRef.current.fit(); } catch { /* renderer not ready yet */ }
      }
    });
    resizeObserverRef.current.observe(container);

    return terminal;
  }, [theme, fontSize, fontFamily, cursorBlink, onData, onResize]);

  const write = useCallback((data: string) => {
    terminalRef.current?.write(data);
  }, []);

  const writeln = useCallback((data: string) => {
    terminalRef.current?.writeln(data);
  }, []);

  const clear = useCallback(() => {
    terminalRef.current?.clear();
  }, []);

  const focus = useCallback(() => {
    terminalRef.current?.focus();
  }, []);

  const fit = useCallback(() => {
    if (fitAddonRef.current) {
      try { fitAddonRef.current.fit(); } catch { /* renderer not ready yet */ }
    }
  }, []);

  const search = useCallback((term: string, options?: { regex?: boolean; wholeWord?: boolean; caseSensitive?: boolean }) => {
    return searchAddonRef.current?.findNext(term, options) ?? false;
  }, []);

  const searchPrevious = useCallback((term: string, options?: { regex?: boolean; wholeWord?: boolean; caseSensitive?: boolean }) => {
    return searchAddonRef.current?.findPrevious(term, options) ?? false;
  }, []);

  const clearSearch = useCallback(() => {
    searchAddonRef.current?.clearDecorations();
  }, []);

  const setTheme = useCallback((themeName: ThemeName) => {
    if (terminalRef.current) {
      terminalRef.current.options.theme = themes[themeName];
    }
  }, []);

  const getSize = useCallback(() => {
    if (terminalRef.current) {
      return {
        cols: terminalRef.current.cols,
        rows: terminalRef.current.rows,
      };
    }
    return { cols: 80, rows: 24 };
  }, []);

  const dispose = useCallback(() => {
    resizeObserverRef.current?.disconnect();
    webglAddonRef.current?.dispose();
    terminalRef.current?.dispose();
    terminalRef.current = null;
    fitAddonRef.current = null;
    searchAddonRef.current = null;
    webglAddonRef.current = null;
  }, []);

  // Copy selection to clipboard
  const copy = useCallback(async () => {
    const selection = terminalRef.current?.getSelection();
    if (selection) {
      await navigator.clipboard.writeText(selection);
      return true;
    }
    return false;
  }, []);

  // Paste from clipboard
  const paste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && onData) {
        onData(text);
      }
      return true;
    } catch {
      return false;
    }
  }, [onData]);

  useEffect(() => {
    return () => {
      dispose();
    };
  }, [dispose]);

  return {
    initTerminal,
    write,
    writeln,
    clear,
    focus,
    fit,
    search,
    searchPrevious,
    clearSearch,
    setTheme,
    getSize,
    dispose,
    copy,
    paste,
    terminal: terminalRef.current,
  };
}

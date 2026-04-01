'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Folder,
  File,
  FileText,
  FileCode,
  FileImage,
  FileArchive,
  ChevronUp,
  RefreshCw,
  Upload,
  Download,
  FolderPlus,
  Trash2,
  Pencil,
  Home,
  Loader2,
} from 'lucide-react';
import type { SFTPFileInfo } from '@/types/ssh';
import { cn } from '@/lib/utils';

interface SFTPPanelProps {
  isConnected: boolean;
  onListDirectory: (path: string) => void;
  onDownload: (remotePath: string) => void;
  onUpload: (remotePath: string, data: string) => void;
  onDelete: (path: string) => void;
  onMkdir: (path: string) => void;
  onRename: (path: string, newPath: string) => void;
  files: SFTPFileInfo[];
  currentPath: string;
  isLoading?: boolean;
}

export function SFTPPanel({
  isConnected,
  onListDirectory,
  onDownload,
  onUpload,
  onDelete,
  onMkdir,
  onRename,
  files,
  currentPath,
  isLoading = false,
}: SFTPPanelProps) {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [pathInput, setPathInput] = useState(currentPath);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameTarget, setRenameTarget] = useState<SFTPFileInfo | null>(null);
  const [newName, setNewName] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPathInput(currentPath);
  }, [currentPath]);

  useEffect(() => {
    if (isConnected && currentPath) {
      onListDirectory(currentPath);
    }
  }, [isConnected, currentPath, onListDirectory]);

  const navigateTo = useCallback((path: string) => {
    setSelectedFiles(new Set());
    onListDirectory(path);
  }, [onListDirectory]);

  const navigateUp = useCallback(() => {
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const newPath = '/' + parts.join('/');
    navigateTo(newPath || '/');
  }, [currentPath, navigateTo]);

  const handlePathSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    navigateTo(pathInput || '/');
  }, [pathInput, navigateTo]);

  const handleFileDoubleClick = useCallback((file: SFTPFileInfo) => {
    if (file.isDirectory) {
      const newPath = currentPath === '/' 
        ? `/${file.filename}` 
        : `${currentPath}/${file.filename}`;
      navigateTo(newPath);
    } else {
      // Download file
      const remotePath = currentPath === '/' 
        ? `/${file.filename}` 
        : `${currentPath}/${file.filename}`;
      onDownload(remotePath);
    }
  }, [currentPath, navigateTo, onDownload]);

  const handleFileSelect = useCallback((file: SFTPFileInfo, ctrlKey: boolean) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (ctrlKey) {
        if (next.has(file.filename)) {
          next.delete(file.filename);
        } else {
          next.add(file.filename);
        }
      } else {
        next.clear();
        next.add(file.filename);
      }
      return next;
    });
  }, []);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const reader = new FileReader();
      
      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          setUploadProgress((event.loaded / event.total) * 100);
        }
      };
      
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1] || '';
        const remotePath = currentPath === '/' 
          ? `/${file.name}` 
          : `${currentPath}/${file.name}`;
        onUpload(remotePath, base64);
        setUploadProgress(null);
      };
      
      reader.readAsDataURL(file);
    }
    
    e.target.value = '';
  }, [currentPath, onUpload]);

  const handleDownloadSelected = useCallback(() => {
    selectedFiles.forEach((filename) => {
      const remotePath = currentPath === '/' 
        ? `/${filename}` 
        : `${currentPath}/${filename}`;
      onDownload(remotePath);
    });
  }, [selectedFiles, currentPath, onDownload]);

  const handleDeleteSelected = useCallback(() => {
    selectedFiles.forEach((filename) => {
      const path = currentPath === '/' 
        ? `/${filename}` 
        : `${currentPath}/${filename}`;
      onDelete(path);
    });
    setSelectedFiles(new Set());
  }, [selectedFiles, currentPath, onDelete]);

  const handleCreateFolder = useCallback(() => {
    if (newFolderName.trim()) {
      const path = currentPath === '/' 
        ? `/${newFolderName.trim()}` 
        : `${currentPath}/${newFolderName.trim()}`;
      onMkdir(path);
      setNewFolderName('');
      setShowNewFolderDialog(false);
    }
  }, [newFolderName, currentPath, onMkdir]);

  const handleRename = useCallback(() => {
    if (renameTarget && newName.trim()) {
      const oldPath = currentPath === '/' 
        ? `/${renameTarget.filename}` 
        : `${currentPath}/${renameTarget.filename}`;
      const newPath = currentPath === '/' 
        ? `/${newName.trim()}` 
        : `${currentPath}/${newName.trim()}`;
      onRename(oldPath, newPath);
      setShowRenameDialog(false);
      setRenameTarget(null);
      setNewName('');
    }
  }, [renameTarget, newName, currentPath, onRename]);

  const openRenameDialog = useCallback((file: SFTPFileInfo) => {
    setRenameTarget(file);
    setNewName(file.filename);
    setShowRenameDialog(true);
  }, []);

  const getFileIcon = (file: SFTPFileInfo) => {
    if (file.isDirectory) {
      return <Folder className="h-4 w-4 text-[#dcb67a]" />;
    }
    
    const ext = file.filename.split('.').pop()?.toLowerCase() || '';
    
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'ico'].includes(ext)) {
      return <FileImage className="h-4 w-4 text-[#a074c4]" />;
    }
    if (['js', 'ts', 'jsx', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'php', 'sh', 'bash'].includes(ext)) {
      return <FileCode className="h-4 w-4 text-[#519aba]" />;
    }
    if (['zip', 'tar', 'gz', 'rar', '7z', 'bz2'].includes(ext)) {
      return <FileArchive className="h-4 w-4 text-[#e37933]" />;
    }
    if (['txt', 'md', 'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf'].includes(ext)) {
      return <FileText className="h-4 w-4 text-[#6d8086]" />;
    }
    
    return <File className="h-4 w-4 text-[#6d8086]" />;
  };

  const formatSize = (size: number) => {
    if (size === 0) return '-';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return '-';
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatPermissions = (mode: number) => {
    const perms = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];
    const owner = perms[(mode >> 6) & 7];
    const group = perms[(mode >> 3) & 7];
    const other = perms[mode & 7];
    return `${owner}${group}${other}`;
  };

  const sortedFiles = [...files].sort((a, b) => {
    // Directories first
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    // Then alphabetically
    return a.filename.localeCompare(b.filename);
  });

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center h-full bg-[#1e1e1e] text-gray-500">
        <div className="text-center">
          <Folder className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Connect to a server to browse files</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-gray-300">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-[#3c3c3c]">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-gray-400 hover:text-white hover:bg-[#3c3c3c]"
          onClick={() => navigateTo('/')}
          title="Home"
        >
          <Home className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-gray-400 hover:text-white hover:bg-[#3c3c3c]"
          onClick={navigateUp}
          disabled={currentPath === '/'}
          title="Up"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-gray-400 hover:text-white hover:bg-[#3c3c3c]"
          onClick={() => onListDirectory(currentPath)}
          title="Refresh"
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
        </Button>
        
        <div className="h-4 w-px bg-[#3c3c3c]" />
        
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-gray-400 hover:text-white hover:bg-[#3c3c3c]"
          onClick={handleUploadClick}
          title="Upload"
        >
          <Upload className="h-4 w-4" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileUpload}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-gray-400 hover:text-white hover:bg-[#3c3c3c]"
          onClick={handleDownloadSelected}
          disabled={selectedFiles.size === 0}
          title="Download"
        >
          <Download className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-gray-400 hover:text-white hover:bg-[#3c3c3c]"
          onClick={() => setShowNewFolderDialog(true)}
          title="New Folder"
        >
          <FolderPlus className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-gray-400 hover:text-white hover:bg-[#3c3c3c]"
          onClick={handleDeleteSelected}
          disabled={selectedFiles.size === 0}
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Path bar */}
      <form onSubmit={handlePathSubmit} className="flex items-center gap-2 p-2 border-b border-[#3c3c3c]">
        <Input
          value={pathInput}
          onChange={(e) => setPathInput(e.target.value)}
          className="h-7 text-sm bg-[#3c3c3c] border-[#3c3c3c] text-white font-mono"
          placeholder="/"
        />
      </form>

      {/* Progress bars */}
      {uploadProgress !== null && (
        <div className="px-2 py-1 border-b border-[#3c3c3c]">
          <div className="text-xs text-gray-400 mb-1">Uploading...</div>
          <Progress value={uploadProgress} className="h-1" />
        </div>
      )}
      {downloadProgress !== null && (
        <div className="px-2 py-1 border-b border-[#3c3c3c]">
          <div className="text-xs text-gray-400 mb-1">Downloading...</div>
          <Progress value={downloadProgress} className="h-1" />
        </div>
      )}

      {/* File list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
          </div>
        ) : (
          <div className="p-1">
            {sortedFiles.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                Empty directory
              </div>
            ) : (
              sortedFiles.map((file) => (
                <ContextMenu key={file.filename}>
                  <ContextMenuTrigger>
                    <div
                      className={cn(
                        'flex items-center gap-3 px-2 py-1 rounded cursor-pointer hover:bg-[#2a2d2e]',
                        selectedFiles.has(file.filename) && 'bg-[#094771] hover:bg-[#094771]'
                      )}
                      onClick={(e) => handleFileSelect(file, e.ctrlKey || e.metaKey)}
                      onDoubleClick={() => handleFileDoubleClick(file)}
                    >
                      {getFileIcon(file)}
                      <span className="flex-1 truncate text-sm">{file.filename}</span>
                      <span className="text-xs text-gray-500 w-20 text-right">
                        {file.isDirectory ? '' : formatSize(file.attrs.size)}
                      </span>
                      <span className="text-xs text-gray-500 w-20 font-mono">
                        {formatPermissions(file.attrs.mode)}
                      </span>
                      <span className="text-xs text-gray-500 w-36 text-right">
                        {formatDate(file.attrs.mtime)}
                      </span>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="bg-[#2d2d2d] border-[#3c3c3c]">
                    {file.isDirectory ? (
                      <ContextMenuItem
                        onClick={() => handleFileDoubleClick(file)}
                        className="text-gray-300 focus:bg-[#3c3c3c] focus:text-white"
                      >
                        <Folder className="h-4 w-4 mr-2" />
                        Open
                      </ContextMenuItem>
                    ) : (
                      <ContextMenuItem
                        onClick={() => handleFileDoubleClick(file)}
                        className="text-gray-300 focus:bg-[#3c3c3c] focus:text-white"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </ContextMenuItem>
                    )}
                    <ContextMenuItem
                      onClick={() => openRenameDialog(file)}
                      className="text-gray-300 focus:bg-[#3c3c3c] focus:text-white"
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Rename
                    </ContextMenuItem>
                    <ContextMenuSeparator className="bg-[#3c3c3c]" />
                    <ContextMenuItem
                      onClick={() => {
                        const path = currentPath === '/' 
                          ? `/${file.filename}` 
                          : `${currentPath}/${file.filename}`;
                        onDelete(path);
                      }}
                      className="text-red-400 focus:bg-[#3c3c3c] focus:text-red-300"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))
            )}
          </div>
        )}
      </ScrollArea>

      {/* Status bar */}
      <div className="flex items-center justify-between px-2 py-1 border-t border-[#3c3c3c] text-xs text-gray-500">
        <span>{files.length} items</span>
        {selectedFiles.size > 0 && (
          <span>{selectedFiles.size} selected</span>
        )}
      </div>

      {/* New Folder Dialog */}
      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent className="sm:max-w-100 bg-[#1e1e1e] border-[#3c3c3c] text-white">
          <DialogHeader>
            <DialogTitle className="text-white">New Folder</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              className="bg-[#3c3c3c] border-[#3c3c3c] text-white placeholder:text-gray-500"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewFolderDialog(false)}
              className="bg-transparent border-[#3c3c3c] text-gray-300 hover:bg-[#3c3c3c] hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim()}
              className="bg-[#0e639c] hover:bg-[#1177bb] text-white"
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="sm:max-w-100 bg-[#1e1e1e] border-[#3c3c3c] text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Rename</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="New name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              className="bg-[#3c3c3c] border-[#3c3c3c] text-white placeholder:text-gray-500"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRenameDialog(false)}
              className="bg-transparent border-[#3c3c3c] text-gray-300 hover:bg-[#3c3c3c] hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={!newName.trim()}
              className="bg-[#0e639c] hover:bg-[#1177bb] text-white"
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Server,
  Folder,
  FolderOpen,
  Plus,
  MoreVertical,
  Pencil,
  Copy,
  Trash2,
  Download,
  Upload,
  Clock,
  Search,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { useConnectionStore } from '@/lib/stores/connection-store';
import type { ConnectionProfile, ProfileFolder } from '@/types/ssh';
import { cn } from '@/lib/utils';

interface ConnectionProfilesProps {
  onSelectProfile: (profile: ConnectionProfile) => void;
  onEditProfile: (profile: ConnectionProfile) => void;
  onNewConnection: () => void;
}

export function ConnectionProfiles({
  onSelectProfile,
  onEditProfile,
  onNewConnection,
}: ConnectionProfilesProps) {
  const profiles = useConnectionStore((s) => s.profiles);
  const folders = useConnectionStore((s) => s.folders);
  const recentConnections = useConnectionStore((s) => s.recentConnections);
  const deleteProfile = useConnectionStore((s) => s.deleteProfile);
  const duplicateProfile = useConnectionStore((s) => s.duplicateProfile);
  const addFolder = useConnectionStore((s) => s.addFolder);
  const deleteFolder = useConnectionStore((s) => s.deleteFolder);
  const exportProfiles = useConnectionStore((s) => s.exportProfiles);
  const importProfiles = useConnectionStore((s) => s.importProfiles);

  const [searchTerm, setSearchTerm] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  const handleExport = useCallback(() => {
    const json = exportProfiles();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ssh-profiles.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [exportProfiles]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          importProfiles(event.target?.result as string);
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }, [importProfiles]);

  const handleCreateFolder = useCallback(() => {
    if (newFolderName.trim()) {
      addFolder({
        id: `folder_${Date.now()}`,
        name: newFolderName.trim(),
      });
      setNewFolderName('');
      setShowFolderDialog(false);
    }
  }, [newFolderName, addFolder]);

  const filteredProfiles = profiles.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.host.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const recentProfiles = recentConnections
    .map((id) => profiles.find((p) => p.id === id))
    .filter(Boolean) as ConnectionProfile[];

  const rootProfiles = filteredProfiles.filter((p) => !p.folderId);
  const getProfilesInFolder = (folderId: string) =>
    filteredProfiles.filter((p) => p.folderId === folderId);

  return (
    <div className="flex flex-col h-full bg-[#252526] text-gray-300">
      {/* Header */}
      <div className="p-3 border-b border-[#3c3c3c]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Connections</h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-400 hover:text-white hover:bg-[#3c3c3c]"
              onClick={onNewConnection}
              title="New Connection"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-gray-400 hover:text-white hover:bg-[#3c3c3c]"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-[#2d2d2d] border-[#3c3c3c]">
                <DropdownMenuItem
                  onClick={() => setShowFolderDialog(true)}
                  className="text-gray-300 focus:bg-[#3c3c3c] focus:text-white"
                >
                  <Folder className="h-4 w-4 mr-2" />
                  New Folder
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[#3c3c3c]" />
                <DropdownMenuItem
                  onClick={handleExport}
                  className="text-gray-300 focus:bg-[#3c3c3c] focus:text-white"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Profiles
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleImport}
                  className="text-gray-300 focus:bg-[#3c3c3c] focus:text-white"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import Profiles
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search connections..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-8 bg-[#3c3c3c] border-[#3c3c3c] text-white placeholder:text-gray-500 text-sm"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {/* Recent Connections */}
          {recentProfiles.length > 0 && !searchTerm && (
            <div className="mb-4">
              <div className="flex items-center gap-2 px-2 py-1 text-xs text-gray-500 uppercase tracking-wider">
                <Clock className="h-3 w-3" />
                Recent
              </div>
              {recentProfiles.slice(0, 5).map((profile) => (
                <ProfileItem
                  key={`recent-${profile.id}`}
                  profile={profile}
                  onSelect={onSelectProfile}
                  onEdit={onEditProfile}
                  onDelete={deleteProfile}
                  onDuplicate={duplicateProfile}
                />
              ))}
            </div>
          )}

          {/* Folders */}
          {folders.map((folder) => (
            <FolderItem
              key={folder.id}
              folder={folder}
              profiles={getProfilesInFolder(folder.id)}
              expanded={expandedFolders.has(folder.id)}
              onToggle={() => toggleFolder(folder.id)}
              onSelectProfile={onSelectProfile}
              onEditProfile={onEditProfile}
              onDeleteProfile={deleteProfile}
              onDuplicateProfile={duplicateProfile}
              onDeleteFolder={deleteFolder}
            />
          ))}

          {/* Root profiles */}
          {rootProfiles.map((profile) => (
            <ProfileItem
              key={profile.id}
              profile={profile}
              onSelect={onSelectProfile}
              onEdit={onEditProfile}
              onDelete={deleteProfile}
              onDuplicate={duplicateProfile}
            />
          ))}

          {/* Empty state */}
          {profiles.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Server className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No saved connections</p>
              <Button
                variant="link"
                onClick={onNewConnection}
                className="text-[#3794ff] hover:text-[#4da3ff] mt-2"
              >
                Create your first connection
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* New Folder Dialog */}
      <Dialog open={showFolderDialog} onOpenChange={setShowFolderDialog}>
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
              onClick={() => setShowFolderDialog(false)}
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
    </div>
  );
}

// Profile item component
interface ProfileItemProps {
  profile: ConnectionProfile;
  onSelect: (profile: ConnectionProfile) => void;
  onEdit: (profile: ConnectionProfile) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

function ProfileItem({ profile, onSelect, onEdit, onDelete, onDuplicate }: ProfileItemProps) {
  return (
    <div
      className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#2a2d2e] cursor-pointer"
      onClick={() => onSelect(profile)}
    >
      <Server className="h-4 w-4 text-gray-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white truncate">{profile.name}</div>
        <div className="text-xs text-gray-500 truncate">
          {profile.username}@{profile.host}:{profile.port}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white hover:bg-[#3c3c3c]"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-[#2d2d2d] border-[#3c3c3c]">
          <DropdownMenuItem
            onClick={(e) => { e.stopPropagation(); onEdit(profile); }}
            className="text-gray-300 focus:bg-[#3c3c3c] focus:text-white"
          >
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => { e.stopPropagation(); onDuplicate(profile.id); }}
            className="text-gray-300 focus:bg-[#3c3c3c] focus:text-white"
          >
            <Copy className="h-4 w-4 mr-2" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[#3c3c3c]" />
          <DropdownMenuItem
            onClick={(e) => { e.stopPropagation(); onDelete(profile.id); }}
            className="text-red-400 focus:bg-[#3c3c3c] focus:text-red-300"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// Folder item component
interface FolderItemProps {
  folder: ProfileFolder;
  profiles: ConnectionProfile[];
  expanded: boolean;
  onToggle: () => void;
  onSelectProfile: (profile: ConnectionProfile) => void;
  onEditProfile: (profile: ConnectionProfile) => void;
  onDeleteProfile: (id: string) => void;
  onDuplicateProfile: (id: string) => void;
  onDeleteFolder: (id: string) => void;
}

function FolderItem({
  folder,
  profiles,
  expanded,
  onToggle,
  onSelectProfile,
  onEditProfile,
  onDeleteProfile,
  onDuplicateProfile,
  onDeleteFolder,
}: FolderItemProps) {
  return (
    <div className="mb-1">
      <div
        className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#2a2d2e] cursor-pointer"
        onClick={onToggle}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" />
        )}
        {expanded ? (
          <FolderOpen className="h-4 w-4 text-[#dcb67a] shrink-0" />
        ) : (
          <Folder className="h-4 w-4 text-[#dcb67a] shrink-0" />
        )}
        <span className="flex-1 text-sm text-white truncate">{folder.name}</span>
        <span className="text-xs text-gray-500 mr-1">{profiles.length}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white hover:bg-[#3c3c3c]"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-[#2d2d2d] border-[#3c3c3c]">
            <DropdownMenuItem
              onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }}
              className="text-red-400 focus:bg-[#3c3c3c] focus:text-red-300"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Folder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {expanded && (
        <div className="ml-4 pl-2 border-l border-[#3c3c3c]">
          {profiles.map((profile) => (
            <ProfileItem
              key={profile.id}
              profile={profile}
              onSelect={onSelectProfile}
              onEdit={onEditProfile}
              onDelete={onDeleteProfile}
              onDuplicate={onDuplicateProfile}
            />
          ))}
          {profiles.length === 0 && (
            <div className="text-xs text-gray-500 px-2 py-1">Empty folder</div>
          )}
        </div>
      )}
    </div>
  );
}

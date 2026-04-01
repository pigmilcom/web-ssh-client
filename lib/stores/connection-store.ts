'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ConnectionProfile, ProfileFolder, SSHConnectionConfig } from '@/types/ssh';

interface ConnectionState {
  profiles: ConnectionProfile[];
  folders: ProfileFolder[];
  recentConnections: string[]; // Profile IDs
  
  // Actions
  addProfile: (profile: ConnectionProfile) => void;
  updateProfile: (id: string, updates: Partial<ConnectionProfile>) => void;
  deleteProfile: (id: string) => void;
  duplicateProfile: (id: string) => void;
  
  addFolder: (folder: ProfileFolder) => void;
  updateFolder: (id: string, updates: Partial<ProfileFolder>) => void;
  deleteFolder: (id: string) => void;
  
  addRecentConnection: (profileId: string) => void;
  clearRecentConnections: () => void;
  
  exportProfiles: () => string;
  importProfiles: (json: string) => void;
  
  getProfile: (id: string) => ConnectionProfile | undefined;
  getProfilesInFolder: (folderId?: string) => ConnectionProfile[];
}

export const useConnectionStore = create<ConnectionState>()(
  persist(
    (set, get) => ({
      profiles: [],
      folders: [],
      recentConnections: [],

      addProfile: (profile) => {
        set((state) => ({
          profiles: [...state.profiles, profile],
        }));
      },

      updateProfile: (id, updates) => {
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
          ),
        }));
      },

      deleteProfile: (id) => {
        set((state) => ({
          profiles: state.profiles.filter((p) => p.id !== id),
          recentConnections: state.recentConnections.filter((rId) => rId !== id),
        }));
      },

      duplicateProfile: (id) => {
        const profile = get().profiles.find((p) => p.id === id);
        if (profile) {
          const newProfile: ConnectionProfile = {
            ...profile,
            id: `profile_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            name: `${profile.name} (Copy)`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          set((state) => ({
            profiles: [...state.profiles, newProfile],
          }));
        }
      },

      addFolder: (folder) => {
        set((state) => ({
          folders: [...state.folders, folder],
        }));
      },

      updateFolder: (id, updates) => {
        set((state) => ({
          folders: state.folders.map((f) =>
            f.id === id ? { ...f, ...updates } : f
          ),
        }));
      },

      deleteFolder: (id) => {
        set((state) => ({
          folders: state.folders.filter((f) => f.id !== id),
          profiles: state.profiles.map((p) =>
            p.folderId === id ? { ...p, folderId: undefined } : p
          ),
        }));
      },

      addRecentConnection: (profileId) => {
        set((state) => {
          const filtered = state.recentConnections.filter((id) => id !== profileId);
          return {
            recentConnections: [profileId, ...filtered].slice(0, 10),
          };
        });
      },

      clearRecentConnections: () => {
        set({ recentConnections: [] });
      },

      exportProfiles: () => {
        const state = get();
        return JSON.stringify({
          profiles: state.profiles,
          folders: state.folders,
        }, null, 2);
      },

      importProfiles: (json) => {
        try {
          const data = JSON.parse(json);
          if (data.profiles && Array.isArray(data.profiles)) {
            set((state) => ({
              profiles: [...state.profiles, ...data.profiles],
              folders: data.folders ? [...state.folders, ...data.folders] : state.folders,
            }));
          }
        } catch (err) {
          console.error('Failed to import profiles:', err);
        }
      },

      getProfile: (id) => {
        return get().profiles.find((p) => p.id === id);
      },

      getProfilesInFolder: (folderId) => {
        return get().profiles.filter((p) => p.folderId === folderId);
      },
    }),
    {
      name: 'ssh-connections',
      partialize: (state) => ({
        profiles: state.profiles,
        folders: state.folders,
        recentConnections: state.recentConnections,
      }),
    }
  )
);

// Helper to create a new connection config from a profile
export function createConnectionConfig(
  profile: ConnectionProfile,
  credentials: { password?: string; privateKey?: string; passphrase?: string }
): SSHConnectionConfig {
  return {
    id: profile.id,
    name: profile.name,
    host: profile.host,
    port: profile.port,
    username: profile.username,
    authMethod: profile.authMethod,
    password: credentials.password,
    privateKey: credentials.privateKey,
    passphrase: credentials.passphrase,
    keepaliveInterval: profile.keepaliveInterval,
    keepaliveCountMax: profile.keepaliveCountMax,
    readyTimeout: profile.readyTimeout,
    terminalType: profile.terminalType,
    environmentVariables: profile.environmentVariables,
    startupCommand: profile.startupCommand,
    hostKeyVerification: profile.hostKeyVerification,
    knownHostKey: profile.knownHostKey,
  };
}

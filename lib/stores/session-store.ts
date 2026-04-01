'use client';

import { create } from 'zustand';
import type { SSHSession, PortForwardConfig } from '@/types/ssh';

interface SessionState {
  sessions: SSHSession[];
  activeSessionId: string | null;
  portForwards: PortForwardConfig[];
  
  // Actions
  addSession: (session: SSHSession) => void;
  updateSession: (id: string, updates: Partial<SSHSession>) => void;
  removeSession: (id: string) => void;
  setActiveSession: (id: string | null) => void;
  
  addPortForward: (config: PortForwardConfig) => void;
  updatePortForward: (id: string, updates: Partial<PortForwardConfig>) => void;
  removePortForward: (id: string) => void;
  
  getSession: (id: string) => SSHSession | undefined;
  getActiveSession: () => SSHSession | undefined;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  portForwards: [],

  addSession: (session) => {
    set((state) => ({
      sessions: [...state.sessions, session],
      activeSessionId: session.id,
    }));
  },

  updateSession: (id, updates) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    }));
  },

  removeSession: (id) => {
    set((state) => {
      const newSessions = state.sessions.filter((s) => s.id !== id);
      let newActiveId = state.activeSessionId;
      
      if (state.activeSessionId === id) {
        newActiveId = newSessions.length > 0 ? newSessions[newSessions.length - 1].id : null;
      }
      
      return {
        sessions: newSessions,
        activeSessionId: newActiveId,
      };
    });
  },

  setActiveSession: (id) => {
    set({ activeSessionId: id });
  },

  addPortForward: (config) => {
    set((state) => ({
      portForwards: [...state.portForwards, config],
    }));
  },

  updatePortForward: (id, updates) => {
    set((state) => ({
      portForwards: state.portForwards.map((pf) =>
        pf.id === id ? { ...pf, ...updates } : pf
      ),
    }));
  },

  removePortForward: (id) => {
    set((state) => ({
      portForwards: state.portForwards.filter((pf) => pf.id !== id),
    }));
  },

  getSession: (id) => {
    return get().sessions.find((s) => s.id === id);
  },

  getActiveSession: () => {
    const { sessions, activeSessionId } = get();
    return sessions.find((s) => s.id === activeSessionId);
  },
}));

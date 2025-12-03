import { create } from 'zustand';
import type { FullIdentity } from '../types';

interface AppState {
    user: {
        username: string;
        id: string;
        friend_code?: string;
    } | null;
    identity: FullIdentity | null; // SENSITIVE: In-memory only
    isAuthenticated: boolean;

    login: (username: string, id: string, identity: FullIdentity, friend_code?: string) => void;
    setAuth: (id: string, username: string, identity: FullIdentity, friend_code?: string) => void;
    logout: () => void;
}

export const useStore = create<AppState>((set) => ({
    user: null,
    identity: null,
    isAuthenticated: false,

    login: (username, id, identity, friend_code) => set({
        user: { username, id, friend_code },
        identity,
        isAuthenticated: true
    }),

    setAuth: (id, username, identity, friend_code) => set({
        user: { username, id, friend_code },
        identity,
        isAuthenticated: true
    }),

    logout: () => set({
        user: null,
        identity: null,
        isAuthenticated: false
    }),
}));

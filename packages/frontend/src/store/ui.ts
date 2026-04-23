// Kept as the canonical Zustand example for this template. Wire your own UI state here.
import { create } from 'zustand';

interface UIState {
  composerOpen: boolean;
  toggleComposer: () => void;
  setComposerOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  composerOpen: false,
  toggleComposer: () => set((s) => ({ composerOpen: !s.composerOpen })),
  setComposerOpen: (open) => set({ composerOpen: open }),
}));

import { create } from 'zustand';

interface WebsiteState {
  // Console state
  isConsoleRunning: boolean;
  currentDemo: string | null;

  // UI state
  showControls: boolean;
  audioEnabled: boolean;

  // Actions
  setConsoleRunning: (running: boolean) => void;
  loadDemo: (demoId: string) => void;
  toggleControls: () => void;
  setAudioEnabled: (enabled: boolean) => void;
}

export const useWebsiteStore = create<WebsiteState>((set) => ({
  // Initial state
  isConsoleRunning: false,
  currentDemo: null,
  showControls: true,
  audioEnabled: false,

  // Actions
  setConsoleRunning: (running: boolean) =>
    set({ isConsoleRunning: running }),

  loadDemo: (demoId: string) =>
    set({ currentDemo: demoId, isConsoleRunning: true }),

  toggleControls: () =>
    set((state) => ({ showControls: !state.showControls })),

  setAudioEnabled: (enabled: boolean) =>
    set({ audioEnabled: enabled })
}));

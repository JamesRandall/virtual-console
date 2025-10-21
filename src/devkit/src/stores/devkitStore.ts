import { create } from 'zustand';

interface DevkitState {
  // Console state
  isConsoleRunning: boolean;
  currentCartridge: string | null;

  // Editor state
  activeFile: string | null;
  openFiles: string[];

  // Actions
  setConsoleRunning: (running: boolean) => void;
  loadCartridge: (cartridgePath: string) => void;
  openFile: (filePath: string) => void;
  closeFile: (filePath: string) => void;
  setActiveFile: (filePath: string | null) => void;
}

export const useDevkitStore = create<DevkitState>((set) => ({
  // Initial state
  isConsoleRunning: false,
  currentCartridge: null,
  activeFile: null,
  openFiles: [],

  // Actions
  setConsoleRunning: (running: boolean) =>
    set({ isConsoleRunning: running }),

  loadCartridge: (cartridgePath: string) =>
    set({ currentCartridge: cartridgePath, isConsoleRunning: true }),

  openFile: (filePath: string) =>
    set((state) => ({
      openFiles: state.openFiles.includes(filePath)
        ? state.openFiles
        : [...state.openFiles, filePath],
      activeFile: filePath
    })),

  closeFile: (filePath: string) =>
    set((state) => ({
      openFiles: state.openFiles.filter(f => f !== filePath),
      activeFile: state.activeFile === filePath ? null : state.activeFile
    })),

  setActiveFile: (filePath: string | null) =>
    set({ activeFile: filePath })
}));

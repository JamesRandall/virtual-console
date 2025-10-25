import { create } from 'zustand';

interface DevkitState {
  // Console state
    isConsoleRunning: false
}

export const useDevkitStore = create<DevkitState>(() => ({
    // Initial state
    isConsoleRunning: false,
}));

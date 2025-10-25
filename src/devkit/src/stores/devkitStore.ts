import { create } from 'zustand';

interface DevkitState {
  // Console state
  isConsoleRunning: boolean;

  // Memory view state
  firstRowAddress: number;
  viewSize: number;
  memorySnapshot: Uint8Array;

  // Actions
  setFirstRowAddress: (address: number) => void;
  setViewSize: (size: number) => void;
  updateMemorySnapshot: (snapshot: Uint8Array) => void;
}

export const useDevkitStore = create<DevkitState>((set) => ({
  // Initial state
  isConsoleRunning: false,
  firstRowAddress: 0x0000,
  viewSize: 0x0214,
  memorySnapshot: new Uint8Array(65536), // 64KB memory

  // Actions
  setFirstRowAddress: (address: number) => set({ firstRowAddress: address }),
  setViewSize: (size: number) => set({ viewSize: size }),
  updateMemorySnapshot: (snapshot: Uint8Array) => set({ memorySnapshot: snapshot }),
}));

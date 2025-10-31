import { create } from 'zustand';
import type { SourceMapEntry, SymbolTable } from '../../../console/src/assembler.ts';

export interface CpuSnapshot {
  registers: Uint8Array;  // R0-R5 (6 registers)
  stackPointer: number;   // SP (16-bit)
  programCounter: number; // PC (16-bit)
  statusRegister: number; // Status flags (8-bit)
  cycleCount: number;     // Cycle counter
}

interface DevkitState {
  // Console state
  isConsoleRunning: boolean;

  // Memory view state
  firstRowAddress: number;
  viewSize: number;
  memorySnapshot: Uint8Array;

  // CPU snapshot state
  cpuSnapshot: CpuSnapshot;

  // Debug state
  sourceMap: SourceMapEntry[];
  symbolTable: SymbolTable;

  // Actions
  setIsConsoleRunning: (isRunning: boolean) => void;
  setFirstRowAddress: (address: number) => void;
  setViewSize: (size: number) => void;
  updateMemorySnapshot: (snapshot: Uint8Array) => void;
  updateCpuSnapshot: (snapshot: CpuSnapshot) => void;
  setSourceMap: (sourceMap: SourceMapEntry[]) => void;
  setSymbolTable: (symbolTable: SymbolTable) => void;
}

export const useDevkitStore = create<DevkitState>((set) => ({
  // Initial state
  isConsoleRunning: false,
  firstRowAddress: 0x0000,
  viewSize: 0x0214,
  memorySnapshot: new Uint8Array(65536), // 64KB memory
  cpuSnapshot: {
    registers: new Uint8Array(6),
    stackPointer: 0x7FFF,
    programCounter: 0x0000,
    statusRegister: 0,
    cycleCount: 0,
  },
  sourceMap: [],
  symbolTable: {},

  // Actions
  setIsConsoleRunning: (isRunning: boolean) => set({ isConsoleRunning: isRunning }),
  setFirstRowAddress: (address: number) => set({ firstRowAddress: address }),
  setViewSize: (size: number) => set({ viewSize: size }),
  updateMemorySnapshot: (snapshot: Uint8Array) => set({ memorySnapshot: snapshot }),
  updateCpuSnapshot: (snapshot: CpuSnapshot) => set({ cpuSnapshot: snapshot }),
  setSourceMap: (sourceMap: SourceMapEntry[]) => set({ sourceMap }),
  setSymbolTable: (symbolTable: SymbolTable) => set({ symbolTable }),
}));

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

  // Breakpoint state
  breakpointLines: Set<number>;      // Line numbers where breakpoints are set
  breakpointAddresses: Set<number>;  // Memory addresses where breakpoints are set
  codeChangedSinceAssembly: boolean; // Track if code changed since last assembly

  // Actions
  setIsConsoleRunning: (isRunning: boolean) => void;
  setFirstRowAddress: (address: number) => void;
  setViewSize: (size: number) => void;
  updateMemorySnapshot: (snapshot: Uint8Array) => void;
  updateCpuSnapshot: (snapshot: CpuSnapshot) => void;
  setSourceMap: (sourceMap: SourceMapEntry[]) => void;
  setSymbolTable: (symbolTable: SymbolTable) => void;
  toggleBreakpoint: (line: number) => void;
  updateBreakpointAddresses: (sourceMap: SourceMapEntry[]) => void;
  clearAllBreakpoints: () => void;
  setCodeChangedSinceAssembly: (changed: boolean) => void;
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
  breakpointLines: new Set<number>(),
  breakpointAddresses: new Set<number>(),
  codeChangedSinceAssembly: false,

  // Actions
  setIsConsoleRunning: (isRunning: boolean) => set({ isConsoleRunning: isRunning }),
  setFirstRowAddress: (address: number) => set({ firstRowAddress: address }),
  setViewSize: (size: number) => set({ viewSize: size }),
  updateMemorySnapshot: (snapshot: Uint8Array) => set({ memorySnapshot: snapshot }),
  updateCpuSnapshot: (snapshot: CpuSnapshot) => set({ cpuSnapshot: snapshot }),
  setSourceMap: (sourceMap: SourceMapEntry[]) => set({ sourceMap }),
  setSymbolTable: (symbolTable: SymbolTable) => set({ symbolTable }),

  toggleBreakpoint: (line: number) => set((state) => {
    const newBreakpointLines = new Set(state.breakpointLines);
    if (newBreakpointLines.has(line)) {
      newBreakpointLines.delete(line);
    } else {
      newBreakpointLines.add(line);
    }

    // If we have a source map, immediately update breakpoint addresses
    const newBreakpointAddresses = new Set<number>();
    if (state.sourceMap.length > 0) {
      newBreakpointLines.forEach((line) => {
        const entry = state.sourceMap.find(entry => entry.line === line);
        if (entry) {
          newBreakpointAddresses.add(entry.address);
        }
      });
    }

    return {
      breakpointLines: newBreakpointLines,
      breakpointAddresses: newBreakpointAddresses
    };
  }),

  updateBreakpointAddresses: (sourceMap: SourceMapEntry[]) => set((state) => {
    const newBreakpointAddresses = new Set<number>();

    // For each breakpoint line, find the corresponding address in the source map
    state.breakpointLines.forEach((line) => {
      const entry = sourceMap.find(entry => entry.line === line);
      if (entry) {
        newBreakpointAddresses.add(entry.address);
      }
    });

    return { breakpointAddresses: newBreakpointAddresses };
  }),

  clearAllBreakpoints: () => set({
    breakpointLines: new Set<number>(),
    breakpointAddresses: new Set<number>()
  }),

  setCodeChangedSinceAssembly: (changed: boolean) => set({ codeChangedSinceAssembly: changed }),
}));

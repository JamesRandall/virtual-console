/**
 * CPU Worker
 *
 * Runs the CPU in a separate thread at 3MHz, using a SharedArrayBuffer for memory access.
 */

import { CPU } from '../../../console/src/cpu';
import { MemoryBus } from '../../../console/src/memoryBus';

const TARGET_FREQUENCY = 3_000_000; // 3MHz
const CYCLES_PER_MS = TARGET_FREQUENCY / 1000;

interface CpuSnapshot {
  registers: Uint8Array;
  stackPointer: number;
  programCounter: number;
  statusRegister: number;
  cycleCount: number;
}

let cpu: CPU;
let isRunning = false;
let lastTimestamp = 0;
let accumulatedCycles = 0;
let breakpointAddresses: Set<number> = new Set();

/**
 * Free-wheeling execution loop that maintains 3MHz clock rate
 */
function executionLoop(): void {
  if (!isRunning) {
    return;
  }

  const now = performance.now();
  const elapsed = now - lastTimestamp;
  lastTimestamp = now;

  // Calculate how many cycles should have elapsed
  const targetCycles = elapsed * CYCLES_PER_MS;
  accumulatedCycles += targetCycles;

  // Execute cycles to catch up
  while (accumulatedCycles >= 1 && isRunning) {
    try {
      // Check if PC is at a breakpoint before executing
      const pc = cpu.getProgramCounter();
      if (breakpointAddresses.has(pc)) {
        // Breakpoint hit - pause execution and notify UI
        isRunning = false;
        const snapshot = createSnapshot();
        self.postMessage({
          type: 'breakpointHit',
          snapshot,
          address: pc,
        });
        self.postMessage({ type: 'paused' });
        return;
      }

      cpu.step();
      accumulatedCycles -= 1;
    } catch (error) {
      // CPU error - pause execution and report
      isRunning = false;
      self.postMessage({
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }
  }

  // Continue loop
  if (isRunning) {
    // Use setTimeout with 0 to yield to other tasks and message handling
    setTimeout(executionLoop, 0);
  }
}

/**
 * Create a CPU snapshot for UI updates
 */
function createSnapshot(): CpuSnapshot {
  const registers = new Uint8Array(6);
  for (let i = 0; i < 6; i++) {
    registers[i] = cpu.getRegister(i);
  }

  return {
    registers,
    stackPointer: cpu.getStackPointer(),
    programCounter: cpu.getProgramCounter(),
    statusRegister: cpu.getStatus(),
    cycleCount: cpu.getCycles(),
  };
}

/**
 * Message handler for worker commands
 */
self.onmessage = (event: MessageEvent) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'init': {
      // Initialize CPU with shared memory
      const { sharedMemory } = payload;
      const memoryArray = new Uint8Array(sharedMemory);
      const memory = new MemoryBus(memoryArray);
      cpu = new CPU(memory);

      self.postMessage({ type: 'initialized' });
      break;
    }

    case 'run': {
      if (!isRunning) {
        isRunning = true;
        lastTimestamp = performance.now();
        accumulatedCycles = 0;
        executionLoop();
        self.postMessage({ type: 'running' });
      }
      break;
    }

    case 'pause': {
      isRunning = false;
      self.postMessage({ type: 'paused' });
      break;
    }

    case 'step': {
      if (!isRunning && cpu) {
        try {
          cpu.step();
          const snapshot = createSnapshot();
          self.postMessage({
            type: 'stepped',
            snapshot,
          });
        } catch (error) {
          self.postMessage({
            type: 'error',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      break;
    }

    case 'getSnapshot': {
      if (cpu) {
        const snapshot = createSnapshot();
        self.postMessage({
          type: 'snapshot',
          snapshot,
        });
      }
      break;
    }

    case 'reset': {
      if (cpu) {
        const wasRunning = isRunning;
        isRunning = false;
        cpu.reset();
        self.postMessage({ type: 'reset' });

        if (wasRunning) {
          isRunning = true;
          lastTimestamp = performance.now();
          accumulatedCycles = 0;
          executionLoop();
        }
      }
      break;
    }

    case 'setProgramCounter': {
      if (cpu) {
        const { address } = payload;
        cpu.setProgramCounter(address);
        self.postMessage({ type: 'programCounterSet' });
      }
      break;
    }

    case 'setBreakpoints': {
      const { addresses } = payload;
      breakpointAddresses = new Set(addresses);
      self.postMessage({ type: 'breakpointsSet' });
      break;
    }

    default:
      console.warn(`Unknown worker message type: ${type}`);
  }
};

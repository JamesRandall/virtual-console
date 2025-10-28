import React, {
  createContext,
  useContext,
  useMemo,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { MemoryBus } from '../../../console/src/memoryBus';
import type { CpuSnapshot } from '../stores/devkitStore';

const MEMORY_SIZE = 65536; // 64KB

/**
 * Virtual Console Controller Interface
 *
 * Provides access to the virtual console's memory and CPU control methods.
 * The CPU runs in a web worker at 3MHz, while the main thread has direct
 * access to memory for peripheral devices and rendering.
 */
export interface VirtualConsoleController {
  /** Memory bus for main thread access (peripherals, rendering) */
  memory: MemoryBus;

  /** Shared memory buffer accessible by both threads */
  sharedMemory: SharedArrayBuffer;

  /** Promise that resolves when the CPU worker is initialized */
  ready: Promise<void>;

  /** Start CPU execution in the worker */
  run(): void;

  /** Pause CPU execution */
  pause(): void;

  /** Execute a single CPU instruction */
  step(): void;

  /** Reset the CPU to initial state */
  reset(): void;

  /** Set the CPU program counter */
  setProgramCounter(address: number): void;

  /** Request current CPU state snapshot */
  getSnapshot(): Promise<CpuSnapshot>;
}

interface VirtualConsoleContextValue {
  controller: VirtualConsoleController;
}

const VirtualConsoleContext = createContext<VirtualConsoleContextValue | undefined>(
  undefined
);

interface VirtualConsoleProviderProps {
  children: ReactNode;
}

export const VirtualConsoleProvider: React.FC<VirtualConsoleProviderProps> = ({
  children,
}) => {
  const workerRef = useRef<Worker | null>(null);
  const snapshotResolversRef = useRef<Map<number, (snapshot: CpuSnapshot) => void>>(
    new Map()
  );
  const snapshotIdRef = useRef(0);

  // Store the ready promise and resolver in refs so they persist across re-renders
  const readyPromiseRef = useRef<Promise<void> | null>(null);
  const initResolverRef = useRef<(() => void) | null>(null);

  const controller = useMemo<VirtualConsoleController>(() => {
    // Check if SharedArrayBuffer is available
    if (typeof SharedArrayBuffer === 'undefined') {
      throw new Error(
        'SharedArrayBuffer is not available. The server must send these headers:\n' +
        'Cross-Origin-Opener-Policy: same-origin\n' +
        'Cross-Origin-Embedder-Policy: require-corp\n\n' +
        'If running dev server, restart it to pick up vite.config.ts changes.'
      );
    }

    // Create SharedArrayBuffer for memory
    const sharedMemory = new SharedArrayBuffer(MEMORY_SIZE);
    const memoryArray = new Uint8Array(sharedMemory);
    const memory = new MemoryBus(memoryArray);

    // Create initialization promise only once and store in ref
    if (!readyPromiseRef.current) {
      readyPromiseRef.current = new Promise<void>((resolve) => {
        initResolverRef.current = resolve;
      });
    }

    // Create worker
    const worker = new Worker(
      new URL('./cpuWorker.ts', import.meta.url),
      { type: 'module' }
    );

    workerRef.current = worker;

    // Handle worker messages
    worker.onmessage = (event: MessageEvent) => {
      const { type, snapshot, error } = event.data;

      if (type === 'initialized') {
        // Resolve initialization promise
        if (initResolverRef.current) {
          initResolverRef.current();
          initResolverRef.current = null;
        }
      } else if (type === 'snapshot' || type === 'stepped') {
        // Resolve pending snapshot promise
        const resolvers = snapshotResolversRef.current;
        const resolve = resolvers.values().next().value;
        if (resolve) {
          resolve(snapshot);
          resolvers.clear();
        }
      } else if (type === 'error') {
        console.error('CPU Worker error:', error);
      }
    };

    worker.onerror = (error) => {
      console.error('Worker error:', error);
    };

    // Initialize worker with shared memory
    worker.postMessage({
      type: 'init',
      payload: { sharedMemory },
    });

    return {
      memory,
      sharedMemory,
      ready: readyPromiseRef.current,

      run() {
        worker.postMessage({ type: 'run' });
      },

      pause() {
        worker.postMessage({ type: 'pause' });
      },

      step() {
        worker.postMessage({ type: 'step' });
      },

      reset() {
        worker.postMessage({ type: 'reset' });
      },

      setProgramCounter(address: number) {
        worker.postMessage({
          type: 'setProgramCounter',
          payload: { address },
        });
      },

      getSnapshot(): Promise<CpuSnapshot> {
        return new Promise((resolve) => {
          const id = snapshotIdRef.current++;
          snapshotResolversRef.current.set(id, resolve);
          worker.postMessage({ type: 'getSnapshot' });
        });
      },
    };
  }, []);

  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const value = useMemo(() => ({ controller }), [controller]);

  return (
    <VirtualConsoleContext.Provider value={value}>
      {children}
    </VirtualConsoleContext.Provider>
  );
};

export const useVirtualConsole = (): VirtualConsoleController => {
  const context = useContext(VirtualConsoleContext);

  if (context === undefined) {
    throw new Error('useVirtualConsole must be used within a VirtualConsoleProvider');
  }

  return context.controller;
};

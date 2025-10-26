import type { VirtualConsoleController } from "../consoleIntegration/virtualConsole";

export interface CpuSnapshot {
    registers: Uint8Array;
    stackPointer: number;
    programCounter: number;
    statusRegister: number;
    cycleCount: number;
}

/**
 * Updates the store with snapshots of the current virtual console state.
 * Creates and saves both memory and CPU state snapshots.
 *
 * @param controller - The virtual console controller instance to snapshot
 * @param updateMemorySnapshot - Store function to update memory snapshot
 * @param updateCpuSnapshot - Store function to update CPU snapshot
 */
export async function updateVirtualConsoleSnapshot(
    controller: VirtualConsoleController,
    updateMemorySnapshot: (snapshot: Uint8Array) => void,
    updateCpuSnapshot: (snapshot: CpuSnapshot) => void
): Promise<void> {
    // Create a snapshot of the current memory
    const memorySnapshot = new Uint8Array(65536);
    for (let i = 0; i < 65536; i++) {
        memorySnapshot[i] = controller.memory.read8(i);
    }
    updateMemorySnapshot(memorySnapshot);

    // Get CPU state snapshot from worker
    const cpuSnapshot = await controller.getSnapshot();
    updateCpuSnapshot(cpuSnapshot);
}

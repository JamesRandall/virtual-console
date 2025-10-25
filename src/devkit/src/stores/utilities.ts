import type {VirtualConsole} from "../../../console/src/virtualConsole.ts";

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
 * @param virtualConsole - The virtual console instance to snapshot
 * @param updateMemorySnapshot - Store function to update memory snapshot
 * @param updateCpuSnapshot - Store function to update CPU snapshot
 */
export function updateVirtualConsoleSnapshot(
    virtualConsole: VirtualConsole,
    updateMemorySnapshot: (snapshot: Uint8Array) => void,
    updateCpuSnapshot: (snapshot: CpuSnapshot) => void
): void {
    // Create a snapshot of the current memory
    const memorySnapshot = new Uint8Array(65536);
    for (let i = 0; i < 65536; i++) {
        memorySnapshot[i] = virtualConsole.memory.read8(i);
    }
    updateMemorySnapshot(memorySnapshot);

    // Create a snapshot of the CPU state
    const registers = new Uint8Array(6);
    for (let i = 0; i < 6; i++) {
        registers[i] = virtualConsole.cpu.getRegister(i);
    }
    updateCpuSnapshot({
        registers,
        stackPointer: virtualConsole.cpu.getStackPointer(),
        programCounter: virtualConsole.cpu.getProgramCounter(),
        statusRegister: virtualConsole.cpu.getStatus(),
        cycleCount: virtualConsole.cpu.getCycles(),
    });
}

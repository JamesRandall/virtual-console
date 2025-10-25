import {useVirtualConsole} from "../consoleIntegration/virtualConsole.tsx";
import {useDevkitStore} from "../stores/devkitStore.ts";

export function DebugToolbar() {
    const virtualConsole = useVirtualConsole();
    const updateMemorySnapshot = useDevkitStore((state) => state.updateMemorySnapshot);
    const updateCpuSnapshot = useDevkitStore((state) => state.updateCpuSnapshot);

    const handleStep = () => {
        try {
            // Execute one instruction
            virtualConsole.cpu.step();

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
        } catch (error) {
            console.error("Error stepping through program:", error);
        }
    };

    return <div className="p-4 border-t border-gray-300">
        <div className="flex gap-4 items-center">
            <button
                onClick={handleStep}
                className="px-4 py-1 bg-green-600 hover:bg-green-700 text-white rounded"
            >
                Step
            </button>
        </div>
    </div>
}

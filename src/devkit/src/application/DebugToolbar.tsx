import {useCallback} from "react";

import {useDevkitStore} from "../stores/devkitStore.ts";
import {updateVirtualConsoleSnapshot} from "../stores/utilities.ts";

import {useVirtualConsole} from "../consoleIntegration/virtualConsole.tsx";

export function DebugToolbar() {
    // Zustand store hooks
    const updateMemorySnapshot = useDevkitStore((state) => state.updateMemorySnapshot);
    const updateCpuSnapshot = useDevkitStore((state) => state.updateCpuSnapshot);

    // Virtual console hook
    const virtualConsole = useVirtualConsole();

    // Event handlers
    const handleStep = useCallback(() => {
        try {
            // Execute one instruction
            virtualConsole.cpu.step();
            // Update snapshots
            updateVirtualConsoleSnapshot(virtualConsole, updateMemorySnapshot, updateCpuSnapshot);
        } catch (error) {
            console.error("Error stepping through program:", error);
        }
    }, [virtualConsole, updateMemorySnapshot, updateCpuSnapshot]);

    // Render
    return <div className="p-4 border-t border-zinc-300">
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

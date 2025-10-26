import {useCallback} from "react";

import {useDevkitStore} from "../stores/devkitStore.ts";
import {updateVirtualConsoleSnapshot} from "../stores/utilities.ts";

import {useVirtualConsole} from "../consoleIntegration/virtualConsole.tsx";

export function DebugToolbar() {
    // Zustand store hooks
    const isConsoleRunning = useDevkitStore((state) => state.isConsoleRunning);
    const setIsConsoleRunning = useDevkitStore((state) => state.setIsConsoleRunning);
    const updateMemorySnapshot = useDevkitStore((state) => state.updateMemorySnapshot);
    const updateCpuSnapshot = useDevkitStore((state) => state.updateCpuSnapshot);

    // Virtual console hook
    const virtualConsole = useVirtualConsole();

    // Event handlers
    const handleRun = useCallback(() => {
        try {
            virtualConsole.run();
            setIsConsoleRunning(true);
        } catch (error) {
            console.error("Error running CPU:", error);
        }
    }, [virtualConsole, setIsConsoleRunning]);

    const handlePause = useCallback(() => {
        try {
            virtualConsole.pause();
            setIsConsoleRunning(false);
            // Update snapshots after pausing
            updateVirtualConsoleSnapshot(virtualConsole, updateMemorySnapshot, updateCpuSnapshot).catch((error) => {
                console.error("Error updating snapshots:", error);
            });
        } catch (error) {
            console.error("Error pausing CPU:", error);
        }
    }, [virtualConsole, setIsConsoleRunning, updateMemorySnapshot, updateCpuSnapshot]);

    const handleStep = useCallback(() => {
        try {
            // Execute one instruction
            virtualConsole.step();
            // Update snapshots (async but we don't need to wait)
            updateVirtualConsoleSnapshot(virtualConsole, updateMemorySnapshot, updateCpuSnapshot).catch((error) => {
                console.error("Error updating snapshots:", error);
            });
        } catch (error) {
            console.error("Error stepping through program:", error);
        }
    }, [virtualConsole, updateMemorySnapshot, updateCpuSnapshot]);

    // Render
    return <div className="p-4 border-t border-zinc-300">
        <div className="flex gap-4 items-center">
            {!isConsoleRunning ? (
                <button
                    onClick={handleRun}
                    className="px-4 py-1 bg-green-600 hover:bg-green-700 text-white rounded"
                >
                    Run
                </button>
            ) : (
                <button
                    onClick={handlePause}
                    className="px-4 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded"
                >
                    Pause
                </button>
            )}
            <button
                onClick={handleStep}
                disabled={isConsoleRunning}
                className="px-4 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:bg-zinc-600 disabled:cursor-not-allowed"
            >
                Step
            </button>
        </div>
    </div>
}

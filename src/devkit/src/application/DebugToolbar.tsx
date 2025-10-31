import {useCallback, useEffect} from "react";

import {useDevkitStore} from "../stores/devkitStore.ts";
import {updateVirtualConsoleSnapshot} from "../stores/utilities.ts";

import {useVirtualConsole} from "../consoleIntegration/virtualConsole.tsx";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faPlay, faPause, faForward} from "@fortawesome/free-solid-svg-icons";

export function DebugToolbar() {
    // Zustand store hooks
    const isConsoleRunning = useDevkitStore((state) => state.isConsoleRunning);
    const setIsConsoleRunning = useDevkitStore((state) => state.setIsConsoleRunning);
    const updateMemorySnapshot = useDevkitStore((state) => state.updateMemorySnapshot);
    const updateCpuSnapshot = useDevkitStore((state) => state.updateCpuSnapshot);
    const breakpointAddresses = useDevkitStore((state) => state.breakpointAddresses);

    // Virtual console hook
    const virtualConsole = useVirtualConsole();

    // Sync breakpoint addresses to worker whenever they change
    useEffect(() => {
        virtualConsole.setBreakpoints(Array.from(breakpointAddresses));
    }, [breakpointAddresses, virtualConsole]);

    // Listen for CPU state changes (from breakpoints, pauses, etc.)
    useEffect(() => {
        const handleCpuPaused = () => {
            setIsConsoleRunning(false);
            // Update snapshots when paused
            updateVirtualConsoleSnapshot(virtualConsole, updateMemorySnapshot, updateCpuSnapshot).catch((error) => {
                console.error("Error updating snapshots:", error);
            });
        };

        const handleBreakpointHit = (event: Event) => {
            const customEvent = event as CustomEvent;
            setIsConsoleRunning(false);
            // Update CPU snapshot with the snapshot from the breakpoint hit
            if (customEvent.detail?.snapshot) {
                updateCpuSnapshot(customEvent.detail.snapshot);
            }
            // Update memory snapshot
            updateVirtualConsoleSnapshot(virtualConsole, updateMemorySnapshot, updateCpuSnapshot).catch((error) => {
                console.error("Error updating snapshots:", error);
            });
        };

        window.addEventListener('cpuPaused', handleCpuPaused);
        window.addEventListener('cpuBreakpointHit', handleBreakpointHit);

        return () => {
            window.removeEventListener('cpuPaused', handleCpuPaused);
            window.removeEventListener('cpuBreakpointHit', handleBreakpointHit);
        };
    }, [setIsConsoleRunning, virtualConsole, updateMemorySnapshot, updateCpuSnapshot]);

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
                    className="px-4 py-2 bg-zinc-600 hover:bg-zinc-700 text-white rounded"
                >
                    <FontAwesomeIcon icon={faPlay} />
                </button>
            ) : (
                <button
                    onClick={handlePause}
                    className="px-4 py-2 bg-zinc-600 hover:bg-zinc-700 text-white rounded"
                >
                    <FontAwesomeIcon icon={faPause} />
                </button>
            )}
            <button
                onClick={handleStep}
                disabled={isConsoleRunning}
                className="px-4 py-2 bg-zinc-600 hover:bg-zinc-700 text-white rounded disabled:bg-zinc-400 disabled:cursor-not-allowed"
            >
                <FontAwesomeIcon icon={faForward} />
            </button>
        </div>
    </div>
}

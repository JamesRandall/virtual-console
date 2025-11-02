import {useCallback, useEffect} from "react";

import {useDevkitStore} from "../stores/devkitStore.ts";
import {updateVirtualConsoleSnapshot} from "../stores/utilities.ts";

import {useVirtualConsole} from "../consoleIntegration/virtualConsole.tsx";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faPlay, faPause, faForward, faCrosshairs, faPowerOff} from "@fortawesome/free-solid-svg-icons";

export function DebugToolbar() {
    // Zustand store hooks
    const isConsoleRunning = useDevkitStore((state) => state.isConsoleRunning);
    const setIsConsoleRunning = useDevkitStore((state) => state.setIsConsoleRunning);
    const updateMemorySnapshot = useDevkitStore((state) => state.updateMemorySnapshot);
    const updateCpuSnapshot = useDevkitStore((state) => state.updateCpuSnapshot);
    const breakpointAddresses = useDevkitStore((state) => state.breakpointAddresses);
    const cpuSnapshot = useDevkitStore((state) => state.cpuSnapshot);
    const viewSize = useDevkitStore((state) => state.viewSize);
    const setFirstRowAddress = useDevkitStore((state) => state.setFirstRowAddress);
    const setShouldScrollToPC = useDevkitStore((state) => state.setShouldScrollToPC);

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

    const handleReset = useCallback(() => {
        try {
            // First pause the CPU
            virtualConsole.pause();
            setIsConsoleRunning(false);

            // Zero the memory
            const memoryArray = new Uint8Array(virtualConsole.sharedMemory);
            memoryArray.fill(0);

            // Reset the CPU
            virtualConsole.reset();

            // Update snapshots after reset
            updateVirtualConsoleSnapshot(virtualConsole, updateMemorySnapshot, updateCpuSnapshot).catch((error) => {
                console.error("Error updating snapshots:", error);
            });
        } catch (error) {
            console.error("Error resetting console:", error);
        }
    }, [virtualConsole, setIsConsoleRunning, updateMemorySnapshot, updateCpuSnapshot]);

    const handleCenterOnPC = useCallback(() => {
        const pc = cpuSnapshot.programCounter;

        // Calculate center position (PC in the middle of the view)
        let centerAddress = pc - Math.floor(viewSize / 2);

        // Align to 8-byte boundary
        centerAddress = Math.floor(centerAddress / 8) * 8;

        // Ensure we stay within memory bounds
        const MEMORY_SIZE = 0x10000; // 64KB

        // Don't go below 0
        if (centerAddress < 0) {
            centerAddress = 0;
        }

        // Don't go beyond memory bounds
        if (centerAddress + viewSize > MEMORY_SIZE) {
            centerAddress = MEMORY_SIZE - viewSize;
            // Align again after boundary adjustment
            centerAddress = Math.floor(centerAddress / 8) * 8;
        }

        setFirstRowAddress(centerAddress);
        // Set flag to trigger scroll in MemoryView
        setShouldScrollToPC(true);
    }, [cpuSnapshot.programCounter, viewSize, setFirstRowAddress, setShouldScrollToPC]);

    // Render
    return <div className="p-4 border-t border-zinc-300">
        <div className="flex justify-between items-center">
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
                <button
                    onClick={handleReset}
                    className="px-4 py-2 bg-zinc-600 hover:bg-zinc-700 text-white rounded"
                    title="Reset CPU and memory"
                >
                    <FontAwesomeIcon icon={faPowerOff} />
                </button>
            </div>
            <button
                onClick={handleCenterOnPC}
                className="px-4 py-2 bg-zinc-600 hover:bg-zinc-700 text-white rounded disabled:bg-zinc-400 disabled:cursor-not-allowed"
                title="Center memory view on program counter"
            >
                <FontAwesomeIcon icon={faCrosshairs} />
            </button>
        </div>
    </div>
}

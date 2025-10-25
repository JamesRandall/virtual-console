import {useMemo} from "react";

import {useDevkitStore} from "../stores/devkitStore.ts";

/**
 * Format a number as an 8-bit hex value
 */
const toHex8 = (value: number): string => value.toString(16).padStart(2, '0').toUpperCase();

/**
 * Format a number as a 16-bit hex value
 */
const toHex16 = (value: number): string => value.toString(16).padStart(4, '0').toUpperCase();

interface CpuFlags {
    C: boolean; // Carry
    Z: boolean; // Zero
    V: boolean; // Overflow
    N: boolean; // Negative
}

/**
 * Extract individual flags from status register
 */
const extractFlags = (statusRegister: number): CpuFlags => {
    return {
        C: (statusRegister & (1 << 0)) !== 0,
        Z: (statusRegister & (1 << 1)) !== 0,
        V: (statusRegister & (1 << 6)) !== 0,
        N: (statusRegister & (1 << 7)) !== 0,
    };
};

export function RegisterView() {
    // Zustand store hooks
    const cpuSnapshot = useDevkitStore((state) => state.cpuSnapshot);

    // Computed values
    const flags = useMemo(() => extractFlags(cpuSnapshot.statusRegister), [cpuSnapshot.statusRegister]);

    // Render
    return <div className="p-4 border-t border-zinc-300 text-zinc-200">
        <div className="font-mono text-sm">
            {/* Registers Row */}
            <div className="flex gap-6 mb-3">
                <div className="flex gap-4">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="flex gap-1">
                            <span className="text-gray-500">R{i}:</span>
                            <span className="text-gray-300">{toHex8(cpuSnapshot.registers[i])}</span>
                        </div>
                    ))}
                </div>
                <div className="flex gap-4">
                    {[3, 4, 5].map((i) => (
                        <div key={i} className="flex gap-1">
                            <span className="text-gray-500">R{i}:</span>
                            <span className="text-gray-300">{toHex8(cpuSnapshot.registers[i])}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Special Registers Row */}
            <div className="flex gap-6 mb-3">
                <div className="flex gap-1">
                    <span className="text-gray-500">PC:</span>
                    <span className="text-gray-300">{toHex16(cpuSnapshot.programCounter)}</span>
                </div>
                <div className="flex gap-1">
                    <span className="text-gray-500">SP:</span>
                    <span className="text-gray-300">{toHex16(cpuSnapshot.stackPointer)}</span>
                </div>
                <div className="flex gap-1">
                    <span className="text-gray-500">Status:</span>
                    <span className="text-gray-300">{toHex8(cpuSnapshot.statusRegister)}</span>
                </div>
                <div className="flex gap-1">
                    <span className="text-gray-500">Cycles:</span>
                    <span className="text-gray-300">{cpuSnapshot.cycleCount}</span>
                </div>
            </div>

            {/* Flags Row */}
            <div className="flex gap-4">
                <span className="text-gray-500">Flags:</span>
                <div className="flex gap-3">
                    <span className={flags.C ? 'text-green-400' : 'text-gray-600'}>C</span>
                    <span className={flags.Z ? 'text-green-400' : 'text-gray-600'}>Z</span>
                    <span className={flags.V ? 'text-green-400' : 'text-gray-600'}>V</span>
                    <span className={flags.N ? 'text-green-400' : 'text-gray-600'}>N</span>
                </div>
            </div>
        </div>
    </div>
}

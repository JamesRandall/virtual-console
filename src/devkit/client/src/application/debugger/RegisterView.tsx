import {useMemo} from "react";

import {useDevkitStore} from "../../stores/devkitStore.ts";

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
    I: boolean; // Interrupt Enable
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
        I: (statusRegister & (1 << 2)) !== 0,
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
    return <div className="dk-panel-bordered-t">
        <div className="dk-mono">
            {/* Registers Row */}
            <div className="dk-info-container mb-3">
                <div className="flex dk-gap-standard">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="dk-info-item">
                            <span className="dk-info-label">R{i}:</span>
                            <span className="dk-info-value">{toHex8(cpuSnapshot.registers[i])}</span>
                        </div>
                    ))}
                </div>
                <div className="flex dk-gap-standard">
                    {[3, 4, 5].map((i) => (
                        <div key={i} className="dk-info-item">
                            <span className="dk-info-label">R{i}:</span>
                            <span className="dk-info-value">{toHex8(cpuSnapshot.registers[i])}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Special Registers Row */}
            <div className="dk-info-container mb-3">
                <div className="dk-info-item">
                    <span className="dk-info-label">PC:</span>
                    <span className="dk-info-value">{toHex16(cpuSnapshot.programCounter)}</span>
                </div>
                <div className="dk-info-item">
                    <span className="dk-info-label">SP:</span>
                    <span className="dk-info-value">{toHex16(cpuSnapshot.stackPointer)}</span>
                </div>
                <div className="dk-info-item">
                    <span className="dk-info-label">Status:</span>
                    <span className="dk-info-value">{toHex8(cpuSnapshot.statusRegister)}</span>
                </div>
                <div className="dk-info-item">
                    <span className="dk-info-label">Cycles:</span>
                    <span className="dk-info-value">{cpuSnapshot.cycleCount}</span>
                </div>
            </div>

            {/* Flags Row */}
            <div className="flex dk-gap-standard">
                <span className="dk-info-label">Flags:</span>
                <div className="flex dk-gap-compact">
                    <span className={flags.C ? 'dk-text-success' : 'dk-text-muted'}>C</span>
                    <span className={flags.Z ? 'dk-text-success' : 'dk-text-muted'}>Z</span>
                    <span className={flags.I ? 'dk-text-success' : 'dk-text-muted'}>I</span>
                    <span className={flags.V ? 'dk-text-success' : 'dk-text-muted'}>V</span>
                    <span className={flags.N ? 'dk-text-success' : 'dk-text-muted'}>N</span>
                </div>
            </div>
        </div>
    </div>
}

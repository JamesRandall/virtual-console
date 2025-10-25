import {useDevkitStore} from "../stores/devkitStore.ts";

export function RegisterView() {
    const cpuSnapshot = useDevkitStore((state) => state.cpuSnapshot);

    // Helper function to format hex values
    const toHex8 = (value: number) => value.toString(16).padStart(2, '0').toUpperCase();
    const toHex16 = (value: number) => value.toString(16).padStart(4, '0').toUpperCase();

    // Helper function to extract individual flags from status register
    const getFlags = () => {
        const status = cpuSnapshot.statusRegister;
        return {
            C: (status & (1 << 0)) !== 0, // Carry
            Z: (status & (1 << 1)) !== 0, // Zero
            V: (status & (1 << 6)) !== 0, // Overflow
            N: (status & (1 << 7)) !== 0, // Negative
        };
    };

    const flags = getFlags();

    return <div className="p-4 border-t border-gray-300 text-zinc-200">
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

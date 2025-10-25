import {useCallback, useMemo} from "react";

import {useDevkitStore} from "../stores/devkitStore.ts";

import {Panel} from "../components/Panel.tsx";
import {HexAddressInput} from "../components/HexAddressInput.tsx";

const BYTES_PER_ROW = 8;

/**
 * Helper function to check if a character is printable ASCII
 */
const isPrintable = (byte: number): boolean => {
    return byte >= 0x20 && byte <= 0x7E;
};

export function MemoryView() {
    // Zustand store hooks
    const firstRowAddress = useDevkitStore((state) => state.firstRowAddress);
    const viewSize = useDevkitStore((state) => state.viewSize);
    const memorySnapshot = useDevkitStore((state) => state.memorySnapshot);
    const cpuSnapshot = useDevkitStore((state) => state.cpuSnapshot);
    const setFirstRowAddress = useDevkitStore((state) => state.setFirstRowAddress);
    const setViewSize = useDevkitStore((state) => state.setViewSize);

    // Computed values
    const programCounter = cpuSnapshot.programCounter;

    // Render helpers
    const generateHexDump = useCallback(() => {
        if (!memorySnapshot) return [];

        const rows = [];
        const numRows = Math.ceil(viewSize / BYTES_PER_ROW);

        for (let row = 0; row < numRows; row++) {
            const rowAddress = firstRowAddress + (row * BYTES_PER_ROW);
            const bytes = [];
            const ascii = [];

            for (let col = 0; col < BYTES_PER_ROW; col++) {
                const address = rowAddress + col;
                if (address < memorySnapshot.length && (row * BYTES_PER_ROW + col) < viewSize) {
                    const byte = memorySnapshot[address];
                    bytes.push({
                        hex: byte.toString(16).padStart(2, '0').toUpperCase(),
                        address: address,
                        isPC: address === programCounter
                    });
                    ascii.push({
                        char: isPrintable(byte) ? String.fromCharCode(byte) : '.',
                        isPrintable: isPrintable(byte)
                    });
                } else {
                    bytes.push({ hex: '  ', address: address, isPC: false });
                    ascii.push({ char: ' ', isPrintable: true });
                }
            }

            rows.push({
                address: rowAddress.toString(16).padStart(4, '0').toUpperCase(),
                bytes: bytes,
                ascii: ascii
            });
        }

        return rows;
    }, [memorySnapshot, viewSize, firstRowAddress, programCounter]);

    const rows = useMemo(() => generateHexDump(), [generateHexDump]);

    // Render
    return <div className="flex flex-col min-h-0 overflow-hidden">
        <Panel padding="p-2" border="bottom" className="flex gap-4 items-center">
            <HexAddressInput
                label="Start Address:"
                value={firstRowAddress}
                onChange={setFirstRowAddress}
                alignment={BYTES_PER_ROW}
            />
            <HexAddressInput
                label="View Size:"
                value={viewSize}
                onChange={setViewSize}
                alignment={BYTES_PER_ROW}
                minValue={1}
            />
        </Panel>
        <Panel className="font-mono flex-1 overflow-y-auto text-gray-500">
            {rows.map((row, idx) => (
                <div key={idx} className="flex gap-8 mb-1">
                    <span>{row.address}</span>
                    <span className="text-gray-300 flex gap-1">
                        {row.bytes.map((byte, byteIdx) => (
                            <span
                                key={byteIdx}
                                className={byte.isPC ? 'text-red-600' : ''}
                            >
                                {byte.hex}
                            </span>
                        ))}
                    </span>
                    <span>
                        {row.ascii.map((char, charIdx) => (
                            <span
                                key={charIdx}
                                className={char.isPrintable ? '' : 'text-gray-600'}
                            >
                                {char.char}
                            </span>
                        ))}
                    </span>
                </div>
            ))}
        </Panel>
    </div>
}
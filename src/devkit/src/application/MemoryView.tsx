import {useCallback, useMemo, useRef, useEffect} from "react";

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
    const shouldScrollToPC = useDevkitStore((state) => state.shouldScrollToPC);
    const setShouldScrollToPC = useDevkitStore((state) => state.setShouldScrollToPC);

    // Refs
    const scrollContainerRef = useRef<HTMLDivElement>(null);

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
                // Always show all 8 bytes per row, just check memory bounds
                if (address < memorySnapshot.length) {
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

    // Effect to scroll to PC when crosshairs button is clicked
    useEffect(() => {
        // Only scroll if the flag is set
        if (!shouldScrollToPC) return;
        if (!scrollContainerRef.current) return;

        // Check if PC is within the visible range
        if (programCounter < firstRowAddress || programCounter >= firstRowAddress + viewSize) {
            setShouldScrollToPC(false);
            return;
        }

        // Calculate which row the PC is on (0-indexed)
        const pcRowIndex = Math.floor((programCounter - firstRowAddress) / BYTES_PER_ROW);

        // Get the row elements
        const rowElements = scrollContainerRef.current.children;
        if (pcRowIndex >= 0 && pcRowIndex < rowElements.length) {
            const pcRowElement = rowElements[pcRowIndex] as HTMLElement;

            // Scroll the row into view (centered if possible)
            pcRowElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }

        // Reset the flag after scrolling
        setShouldScrollToPC(false);
    }, [shouldScrollToPC, firstRowAddress, programCounter, viewSize, setShouldScrollToPC]);

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
        <Panel className="font-mono flex-1 overflow-y-auto text-gray-500" innerRef={scrollContainerRef}>
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
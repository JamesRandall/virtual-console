import {useCallback, useMemo, useRef, useEffect} from "react";

import {useDevkitStore} from "../../stores/devkitStore.ts";

import {HexAddressInput} from "../../components/HexAddressInput.tsx";

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
    const scrollToAddress = useDevkitStore((state) => state.scrollToAddress);
    const setScrollToAddress = useDevkitStore((state) => state.setScrollToAddress);

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
                        isPC: address === programCounter,
                        isHighlighted: address === scrollToAddress
                    });
                    ascii.push({
                        char: isPrintable(byte) ? String.fromCharCode(byte) : '.',
                        isPrintable: isPrintable(byte)
                    });
                } else {
                    bytes.push({ hex: '  ', address: address, isPC: false, isHighlighted: false });
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
    }, [memorySnapshot, viewSize, firstRowAddress, programCounter, scrollToAddress]);

    const rows = useMemo(() => generateHexDump(), [generateHexDump]);

    // Helper to scroll to a specific address within the view
    const scrollToAddressInView = useCallback((targetAddress: number) => {
        if (!scrollContainerRef.current) return;

        // Check if address is within the visible range
        if (targetAddress < firstRowAddress || targetAddress >= firstRowAddress + viewSize) {
            return;
        }

        // Calculate which row the address is on (0-indexed)
        const rowIndex = Math.floor((targetAddress - firstRowAddress) / BYTES_PER_ROW);

        // Get the row elements
        const rowElements = scrollContainerRef.current.children;
        if (rowIndex >= 0 && rowIndex < rowElements.length) {
            const rowElement = rowElements[rowIndex] as HTMLElement;

            // Scroll the row into view (centered if possible)
            rowElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }, [firstRowAddress, viewSize]);

    // Effect to scroll to PC when crosshairs button is clicked
    useEffect(() => {
        // Only scroll if the flag is set
        if (!shouldScrollToPC) return;

        scrollToAddressInView(programCounter);

        // Reset the flag after scrolling
        setShouldScrollToPC(false);
    }, [shouldScrollToPC, programCounter, scrollToAddressInView, setShouldScrollToPC]);

    // Effect to scroll to a specific address when set
    useEffect(() => {
        if (scrollToAddress === null) return;

        // Use requestAnimationFrame to ensure the DOM has updated after firstRowAddress change
        requestAnimationFrame(() => {
            scrollToAddressInView(scrollToAddress);
        });
    }, [scrollToAddress, scrollToAddressInView, firstRowAddress]);

    // Render
    return <div className="flex flex-col min-h-0 overflow-hidden">
        <div className="dk-padding-tight dk-border-b flex dk-gap-standard items-center">
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
        </div>
        <div className="dk-mono flex-1 overflow-y-auto dk-text-mono-secondary dk-padding-standard" ref={scrollContainerRef}>
            {rows.map((row, idx) => (
                <div key={idx} className="flex gap-8 mb-1">
                    <span>{row.address}</span>
                    <span className="dk-text-mono-primary flex dk-gap-tight">
                        {row.bytes.map((byte, byteIdx) => (
                            <span
                                key={byteIdx}
                                className={
                                    byte.isHighlighted ? 'dk-text-success-strong' :
                                    byte.isPC ? 'dk-text-danger-strong' : ''
                                }
                            >
                                {byte.hex}
                            </span>
                        ))}
                    </span>
                    <span>
                        {row.ascii.map((char, charIdx) => (
                            <span
                                key={charIdx}
                                className={char.isPrintable ? '' : 'dk-text-mono-muted'}
                            >
                                {char.char}
                            </span>
                        ))}
                    </span>
                </div>
            ))}
        </div>
    </div>
}

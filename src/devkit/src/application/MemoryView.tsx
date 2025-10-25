import {useVirtualConsole} from "../consoleIntegration/virtualConsole.tsx";
import {useState} from "react";

export function MemoryView() {
    const [firstRowAddress, setFirstRowAddress] = useState(0x0000);
    const [viewSize, setViewSize] = useState(0x0214); // 1024 bytes default
    const [addressInput, setAddressInput] = useState('0000');
    const [sizeInput, setSizeInput] = useState('0214');

    const virtualConsole = useVirtualConsole();

    const BYTES_PER_ROW = 8;

    // Helper function to check if a character is printable ASCII
    const isPrintable = (byte: number): boolean => {
        return byte >= 0x20 && byte <= 0x7E;
    };

    // Generate hex dump rows
    const generateHexDump = () => {
        if (!virtualConsole?.memory) return [];

        const rows = [];
        const numRows = Math.ceil(viewSize / BYTES_PER_ROW);

        for (let row = 0; row < numRows; row++) {
            const rowAddress = firstRowAddress + (row * BYTES_PER_ROW);
            const bytes = [];
            const ascii = [];

            for (let col = 0; col < BYTES_PER_ROW; col++) {
                const address = rowAddress + col;
                if (address < virtualConsole.memory.size && (row * BYTES_PER_ROW + col) < viewSize) {
                    const byte = virtualConsole.memory.read8(address);
                    bytes.push(byte.toString(16).padStart(2, '0').toUpperCase());
                    ascii.push({
                        char: isPrintable(byte) ? String.fromCharCode(byte) : '.',
                        isPrintable: isPrintable(byte)
                    });
                } else {
                    bytes.push('  ');
                    ascii.push({ char: ' ', isPrintable: true });
                }
            }

            rows.push({
                address: rowAddress.toString(16).padStart(4, '0').toUpperCase(),
                hex: bytes.join(' '),
                ascii: ascii
            });
        }

        return rows;
    };

    const rows = generateHexDump();

    const handleAddressBlur = () => {
        const parsed = parseInt(addressInput, 16);
        if (!isNaN(parsed) && parsed >= 0) {
            // Align to 8 bytes
            const aligned = Math.floor(parsed / 8) * 8;
            setFirstRowAddress(aligned);
            setAddressInput(aligned.toString(16).padStart(4, '0').toUpperCase());
        } else {
            setAddressInput(firstRowAddress.toString(16).padStart(4, '0').toUpperCase());
        }
    };

    const handleViewSizeBlur = () => {
        const parsed = parseInt(sizeInput, 16);
        if (!isNaN(parsed) && parsed > 0) {
            // Align to 8 bytes
            const aligned = Math.ceil(parsed / 8) * 8;
            setViewSize(aligned);
            setSizeInput(aligned.toString(16).padStart(4, '0').toUpperCase());
        } else {
            setSizeInput(viewSize.toString(16).padStart(4, '0').toUpperCase());
        }
    };

    return <div className="flex flex-col h-full">
        <div className="flex gap-4 p-2 border-b border-gray-300 items-center text-zinc-200">
            <label className="flex items-center gap-2">
                <span>Start Address:</span>
                <input
                    type="text"
                    value={addressInput}
                    onChange={(e) => setAddressInput(e.target.value.toUpperCase())}
                    onBlur={handleAddressBlur}
                    className="font-mono w-20 px-2 py-1 border border-gray-300 rounded"
                />
            </label>
            <label className="flex items-center gap-2">
                <span>View Size:</span>
                <input
                    type="text"
                    value={sizeInput}
                    onChange={(e) => setSizeInput(e.target.value.toUpperCase())}
                    onBlur={handleViewSizeBlur}
                    className="font-mono w-20 px-2 py-1 border border-gray-300 rounded"
                />
            </label>
        </div>
        <div className="font-mono p-4 flex-1 overflow-y-auto">
            {rows.map((row, idx) => (
                <div key={idx} className="flex gap-8 mb-1">
                    <span className="text-gray-500">{row.address}</span>
                    <span>{row.hex}</span>
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
        </div>
    </div>
}
import { useMemo, useState, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCode, faMemory } from "@fortawesome/free-solid-svg-icons";
import { useDevkitStore } from "../../stores/devkitStore.ts";
import { readFile } from "../../services/fileSystemService.ts";
import type { SourceMapEntry } from "../../../../console/src/assembler.ts";

type SortField = 'name' | 'address';
type SortDirection = 'asc' | 'desc';

interface SymbolTableViewProps {
    onNavigateToDebug?: () => void;
}

export function SymbolTableView({ onNavigateToDebug }: SymbolTableViewProps) {
    const symbolTable = useDevkitStore((state) => state.symbolTable);
    const sourceMap = useDevkitStore((state) => state.sourceMap);
    const currentProjectHandle = useDevkitStore((state) => state.currentProjectHandle);
    const openFile = useDevkitStore((state) => state.openFile);
    const setActiveFile = useDevkitStore((state) => state.setActiveFile);
    const openFiles = useDevkitStore((state) => state.openFiles);
    const setFirstRowAddress = useDevkitStore((state) => state.setFirstRowAddress);
    const setScrollToAddress = useDevkitStore((state) => state.setScrollToAddress);
    const setNavigateToLine = useDevkitStore((state) => state.setNavigateToLine);
    const viewSize = useDevkitStore((state) => state.viewSize);

    const [sortField, setSortField] = useState<SortField>('name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [filter, setFilter] = useState('');

    const symbols = useMemo(() => {
        const entries = Object.entries(symbolTable).map(([name, address]) => ({
            name,
            address,
        }));

        // Filter
        const filtered = filter
            ? entries.filter(s => s.name.toLowerCase().includes(filter.toLowerCase()))
            : entries;

        // Sort
        filtered.sort((a, b) => {
            const aVal = sortField === 'name' ? a.name.toLowerCase() : a.address;
            const bVal = sortField === 'name' ? b.name.toLowerCase() : b.address;

            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [symbolTable, sortField, sortDirection, filter]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const getSortIndicator = (field: SortField) => {
        if (sortField !== field) return '';
        return sortDirection === 'asc' ? ' ▲' : ' ▼';
    };

    // Find source map entry for a given address
    const findSourceEntry = useCallback((address: number): SourceMapEntry | undefined => {
        return sourceMap.find(e => e.address === address);
    }, [sourceMap]);

    const handleGoToSource = useCallback(async (address: number) => {
        // Find the source map entry for this address
        const entry = findSourceEntry(address);
        if (!entry || !entry.file) {
            return;
        }

        const filePath = entry.file;
        const line = entry.line;

        // Check if file is already open
        const existingFile = openFiles.find(f => f.path === filePath);
        if (existingFile) {
            setActiveFile(filePath);
        } else if (currentProjectHandle) {
            // Open the file
            try {
                const content = await readFile(currentProjectHandle, filePath);
                openFile(filePath, content);
            } catch (error) {
                console.error('Error opening file:', error);
                return;
            }
        }

        // Navigate to the specific line after a short delay to ensure the editor is ready
        setTimeout(() => {
            setNavigateToLine({ file: filePath, line });
        }, 50);
    }, [findSourceEntry, openFiles, currentProjectHandle, setActiveFile, openFile, setNavigateToLine]);

    const handleGoToMemory = useCallback((address: number) => {
        // Calculate center position (address in the middle of the view)
        let centerAddress = address - Math.floor(viewSize / 2);

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
            centerAddress = Math.floor(centerAddress / 8) * 8;
        }

        setFirstRowAddress(centerAddress);
        setScrollToAddress(address);
        onNavigateToDebug?.();
    }, [viewSize, setFirstRowAddress, setScrollToAddress, onNavigateToDebug]);

    // Check if a symbol has source info
    const hasSourceInfo = useCallback((address: number) => {
        const entry = findSourceEntry(address);
        return entry && entry.file;
    }, [findSourceEntry]);

    const symbolCount = Object.keys(symbolTable).length;

    return (
        <div className="flex flex-col min-h-0 overflow-hidden h-full">
            <div className="dk-padding-tight dk-border-b flex dk-gap-standard items-center">
                <input
                    type="text"
                    placeholder="Filter symbols..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="dk-input flex-1"
                />
                <span className="dk-text-secondary text-sm">
                    {symbols.length} of {symbolCount} symbols
                </span>
            </div>
            <div className="flex-1 overflow-y-auto">
                <table className="w-full dk-mono">
                    <thead className="dk-bg-secondary sticky top-0">
                        <tr>
                            <th
                                className="text-left dk-padding-tight cursor-pointer hover:dk-bg-tertiary"
                                onClick={() => handleSort('name')}
                            >
                                Symbol{getSortIndicator('name')}
                            </th>
                            <th
                                className="text-left dk-padding-tight cursor-pointer hover:dk-bg-tertiary w-24"
                                onClick={() => handleSort('address')}
                            >
                                Address{getSortIndicator('address')}
                            </th>
                            <th className="w-16"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {symbols.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="dk-padding-standard dk-text-secondary text-center">
                                    {symbolCount === 0
                                        ? "No symbols available. Assemble your code to populate the symbol table."
                                        : "No symbols match the filter."
                                    }
                                </td>
                            </tr>
                        ) : (
                            symbols.map((symbol) => (
                                <tr key={symbol.name} className="hover:dk-bg-tertiary group">
                                    <td className="dk-padding-tight dk-text-mono-primary">
                                        {symbol.name}
                                    </td>
                                    <td className="dk-padding-tight dk-text-mono-secondary">
                                        ${symbol.address.toString(16).padStart(4, '0').toUpperCase()}
                                    </td>
                                    <td className="dk-padding-tight text-right">
                                        <span className="inline-flex dk-gap-tight opacity-0 group-hover:opacity-100 transition-opacity">
                                            {hasSourceInfo(symbol.address) && (
                                                <span
                                                    onClick={() => handleGoToSource(symbol.address)}
                                                    className="cursor-pointer dk-text-secondary hover:dk-text-primary p-1"
                                                    title="Go to source"
                                                >
                                                    <FontAwesomeIcon icon={faCode} size="sm" />
                                                </span>
                                            )}
                                            <span
                                                onClick={() => handleGoToMemory(symbol.address)}
                                                className="cursor-pointer dk-text-secondary hover:dk-text-primary p-1"
                                                title="View in memory"
                                            >
                                                <FontAwesomeIcon icon={faMemory} size="sm" />
                                            </span>
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

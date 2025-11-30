import { useState, useEffect } from 'react';
import { useDevkitStore } from '../../../stores/devkitStore';

// Extend FileSystemDirectoryHandle to include async iterator methods
interface ExtendedFileSystemDirectoryHandle extends FileSystemDirectoryHandle {
  values(): AsyncIterableIterator<FileSystemHandle>;
}

interface PaletteSelectorProps {
  selectedPath: string;
  selectedBlockIndex: number;
  onPathChange: (path: string) => void;
  onBlockIndexChange: (index: number) => void;
}

const BLOCKS_4BPP = 64;

export function PaletteSelector({
  selectedPath,
  selectedBlockIndex,
  onPathChange,
  onBlockIndexChange,
}: PaletteSelectorProps) {
  const currentProjectHandle = useDevkitStore((state) => state.currentProjectHandle);
  const [paletteFiles, setPaletteFiles] = useState<string[]>([]);

  // Load available palette files from the palettes folder
  useEffect(() => {
    async function loadPaletteFiles() {
      if (!currentProjectHandle) {
        setPaletteFiles(['palettes/default.pbin']);
        return;
      }

      try {
        const palettesHandle = await currentProjectHandle.getDirectoryHandle('palettes', { create: false }) as ExtendedFileSystemDirectoryHandle;
        const files: string[] = [];

        for await (const entry of palettesHandle.values()) {
          if (entry.kind === 'file' && entry.name.endsWith('.pbin')) {
            files.push(`palettes/${entry.name}`);
          }
        }

        // Sort files alphabetically, but keep default.pbin first
        files.sort((a, b) => {
          if (a.includes('default.pbin')) return -1;
          if (b.includes('default.pbin')) return 1;
          return a.localeCompare(b);
        });

        setPaletteFiles(files.length > 0 ? files : ['palettes/default.pbin']);
      } catch (err) {
        console.error('Error loading palette files:', err);
        setPaletteFiles(['palettes/default.pbin']);
      }
    }

    loadPaletteFiles();
  }, [currentProjectHandle]);

  return (
    <div className="flex items-center dk-gap-compact flex-wrap">
      {/* Palette file selector */}
      <div className="flex items-center dk-gap-tight">
        <span className="dk-label">Palette:</span>
        <select
          value={selectedPath}
          onChange={(e) => onPathChange(e.target.value)}
          className="dk-input w-40"
        >
          {paletteFiles.map((file) => (
            <option key={file} value={file}>
              {file.split('/').pop()}
            </option>
          ))}
        </select>
      </div>

      {/* Block index selector */}
      <div className="flex items-center dk-gap-tight">
        <span className="dk-label">Block:</span>
        <select
          value={selectedBlockIndex}
          onChange={(e) => onBlockIndexChange(Number(e.target.value))}
          className="dk-input w-20"
        >
          {Array.from({ length: BLOCKS_4BPP }, (_, i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
      </div>

      <span className="dk-tertiary-text text-xs">
        (4bpp mode: 64 blocks × 16 colors)
      </span>
    </div>
  );
}

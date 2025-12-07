import { useCallback, useMemo } from 'react';
import { Allotment } from 'allotment';
import { useDevkitStore } from '../../../stores/devkitStore';
import { PaletteBlocksView } from './PaletteBlocksView';
import { SystemPaletteView } from './SystemPaletteView';

interface PaletteEditorProps {
  filePath: string;
  content: string; // Base64-encoded binary data
  onShowIndexesChange?: (showIndexes: boolean) => void;
  showIndexes?: boolean;
}

export function PaletteEditor({ filePath, content, showIndexes = true }: PaletteEditorProps) {
  // Component is controlled - showIndexes comes from parent
  const shouldShowIndexes = showIndexes;

  // Zustand store hooks
  const projectConfig = useDevkitStore((state) => state.projectConfig);
  const updateFileContent = useDevkitStore((state) => state.updateFileContent);
  const markFileDirty = useDevkitStore((state) => state.markFileDirty);

  // Decode base64 content to Uint8Array
  const paletteData = useMemo(() => {
    try {
      const binaryString = atob(content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Ensure we have exactly 1024 bytes
      if (bytes.length !== 1024) {
        console.error(`Invalid palette file: expected 1024 bytes, got ${bytes.length}`);
        return new Uint8Array(1024);
      }

      return bytes;
    } catch (err) {
      console.error('Error decoding palette data:', err);
      return new Uint8Array(1024);
    }
  }, [content]);

  // Calculate mode-specific values (with fallback if config not loaded)
  const mode = projectConfig?.mode ?? 0;
  const is4bpp = mode === 0 || mode === 3;
  const blockSize = is4bpp ? 16 : 256;
  const blockCount = is4bpp ? 64 : 4;

  // Handle color change in palette
  const handleColorChange = useCallback((paletteIndex: number, colorIndex: number, systemPaletteIndex: number) => {
    // Create new palette data with the change
    const newData = new Uint8Array(paletteData);
    const offset = paletteIndex * blockSize + colorIndex;
    newData[offset] = systemPaletteIndex;

    // Encode back to base64
    let binary = '';
    for (let i = 0; i < newData.length; i++) {
      binary += String.fromCharCode(newData[i]);
    }
    const base64 = btoa(binary);

    // Update file content in store
    updateFileContent(filePath, base64);

    // Mark file as dirty
    markFileDirty(filePath, true);
  }, [paletteData, blockSize, filePath, updateFileContent, markFileDirty]);

  // Handle block reorder (swap blocks)
  const handleBlockReorder = useCallback((fromIndex: number, toIndex: number) => {
    const newData = new Uint8Array(paletteData);

    // Extract both blocks
    const fromOffset = fromIndex * blockSize;
    const toOffset = toIndex * blockSize;
    const fromBlock = paletteData.slice(fromOffset, fromOffset + blockSize);
    const toBlock = paletteData.slice(toOffset, toOffset + blockSize);

    // Swap the blocks
    newData.set(toBlock, fromOffset);
    newData.set(fromBlock, toOffset);

    // Encode back to base64
    let binary = '';
    for (let i = 0; i < newData.length; i++) {
      binary += String.fromCharCode(newData[i]);
    }
    const base64 = btoa(binary);

    // Update file content in store
    updateFileContent(filePath, base64);

    // Mark file as dirty
    markFileDirty(filePath, true);
  }, [paletteData, blockSize, filePath, updateFileContent, markFileDirty]);

  // projectConfig should always be available (config.json is mandatory)
  if (!projectConfig) {
    return (
      <div className="flex items-center justify-center h-full dk-bg-primary dk-text-secondary">
        <p className="text-red-400">Error: Project configuration not loaded</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full dk-bg-primary">
      <Allotment vertical className="drag-drop-enabled">
        {/* Top pane: Edited palette blocks */}
        <Allotment.Pane>
          <div className="flex flex-col h-full pointer-events-auto">
            <div className="dk-layout-header">
              <h2 className="dk-subsection-header">Palette Blocks</h2>
              <span className="dk-tertiary-text">
                {blockCount} blocks × {blockSize} colors ({is4bpp ? '4bpp' : '8bpp'})
              </span>
            </div>
            <div className="flex-1 min-h-0 overflow-auto dk-padding-standard">
              <PaletteBlocksView
                paletteData={paletteData}
                blockSize={blockSize}
                blockCount={blockCount}
                onColorChange={handleColorChange}
                onBlockReorder={handleBlockReorder}
                showIndexes={shouldShowIndexes}
              />
            </div>
          </div>
        </Allotment.Pane>

        {/* Bottom pane: System palette */}
        <Allotment.Pane>
          <div className="flex flex-col h-full pointer-events-auto">
            <div className="dk-layout-header">
              <h2 className="dk-subsection-header">System Palette</h2>
              <span className="dk-tertiary-text">256 colors</span>
            </div>
            <div className="flex-1 min-h-0 overflow-auto dk-padding-standard">
              <SystemPaletteView showIndexes={shouldShowIndexes} />
            </div>
          </div>
        </Allotment.Pane>
      </Allotment>
    </div>
  );
}

import { useCallback, useMemo, useState, useEffect } from 'react';
import { useDevkitStore, type SpritePaletteConfig } from '../../../stores/devkitStore';
import { ToolPalette, type Tool, type Action } from './ToolPalette';
import { SpriteCanvas } from './SpriteCanvas';
import { ColorPicker } from './ColorPicker';
import { SpriteSelector } from './SpriteSelector';
import { PaletteSelector } from './PaletteSelector';

interface SpriteEditorProps {
  filePath: string;
  content: string; // Base64-encoded binary data (32KB gbin file)
}

// Extract gbin name from path (e.g., "sprites/player.gbin" -> "player")
function getGbinName(filePath: string): string {
  const fileName = filePath.split('/').pop() || filePath;
  return fileName.replace('.gbin', '');
}

// Sprite dimensions
const SPRITE_WIDTH = 16;
const SPRITE_HEIGHT = 16;
const BYTES_PER_SPRITE_4BPP = 128; // 16x16 pixels at 4bpp = 128 bytes
const SPRITES_PER_GBIN = 256;

export function SpriteEditor({ filePath, content }: SpriteEditorProps) {
  // Zustand store hooks
  const currentProjectHandle = useDevkitStore((state) => state.currentProjectHandle);
  const projectConfig = useDevkitStore((state) => state.projectConfig);
  const updateFileContent = useDevkitStore((state) => state.updateFileContent);
  const markFileDirty = useDevkitStore((state) => state.markFileDirty);

  // Local state
  const [selectedTool, setSelectedTool] = useState<Tool>('pen');
  const [selectedColorIndex, setSelectedColorIndex] = useState(1); // Default to color 1 (0 is transparent)
  const [selectedSpriteIndex, setSelectedSpriteIndex] = useState(0);
  const [zoom, setZoom] = useState(16);
  const [showTransparency, setShowTransparency] = useState(true);
  const [selectedPalettePath, setSelectedPalettePath] = useState('palettes/default.pbin');
  const [selectedPaletteBlockIndex, setSelectedPaletteBlockIndex] = useState(0);
  const [paletteData, setPaletteData] = useState<Uint8Array | null>(null);

  // Selection and clipboard state
  const [selection, setSelection] = useState<{ startRow: number; startCol: number; endRow: number; endCol: number } | null>(null);
  const [clipboard, setClipboard] = useState<number[][] | null>(null);
  const [pastePreview, setPastePreview] = useState<{ row: number; col: number; data: number[][] } | null>(null);

  // Track palette configs per sprite (local state that will be saved to config.json)
  const [spritePaletteConfigs, setSpritePaletteConfigs] = useState<SpritePaletteConfig[]>([]);
  const [configLoaded, setConfigLoaded] = useState(false);
  const gbinName = getGbinName(filePath);

  // Load palette configs from project config on mount
  useEffect(() => {
    if (configLoaded) return;

    const spriteEditorConfig = projectConfig?.['sprite-editor'];
    if (spriteEditorConfig && spriteEditorConfig[gbinName]) {
      const configs = spriteEditorConfig[gbinName];
      setSpritePaletteConfigs(configs);

      // Load the first sprite's palette settings
      if (configs[0]) {
        const paletteName = configs[0].palette || 'default';
        setSelectedPalettePath(`palettes/${paletteName}.pbin`);
        setSelectedPaletteBlockIndex(configs[0].block || 0);
      }
    }
    // Mark config as loaded (even if no config exists, we use defaults)
    setConfigLoaded(true);
  }, [projectConfig, gbinName, configLoaded]);

  // Update palette config when sprite selection changes (only after initial config load)
  useEffect(() => {
    if (!configLoaded) return;

    const config = spritePaletteConfigs[selectedSpriteIndex];
    if (config) {
      const paletteName = config.palette || 'default';
      setSelectedPalettePath(`palettes/${paletteName}.pbin`);
      setSelectedPaletteBlockIndex(config.block || 0);
    } else {
      // Default for sprites without config
      setSelectedPalettePath('palettes/default.pbin');
      setSelectedPaletteBlockIndex(0);
    }
  }, [selectedSpriteIndex, spritePaletteConfigs, configLoaded]);

  // Handle palette path change - update local config and mark dirty
  const handlePalettePathChange = useCallback((path: string) => {
    setSelectedPalettePath(path);

    // Extract palette name from path
    const paletteName = path.split('/').pop()?.replace('.pbin', '') || 'default';

    // Update the config for the current sprite
    setSpritePaletteConfigs(prev => {
      const newConfigs = [...prev];
      // Ensure array is long enough
      while (newConfigs.length <= selectedSpriteIndex) {
        newConfigs.push({ palette: 'default', block: 0 });
      }
      newConfigs[selectedSpriteIndex] = {
        ...newConfigs[selectedSpriteIndex],
        palette: paletteName,
      };
      return newConfigs;
    });

    // Mark file as dirty since palette config changed
    markFileDirty(filePath, true);
  }, [selectedSpriteIndex, filePath, markFileDirty]);

  // Handle palette block change - update local config and mark dirty
  const handlePaletteBlockChange = useCallback((block: number) => {
    setSelectedPaletteBlockIndex(block);

    // Update the config for the current sprite
    setSpritePaletteConfigs(prev => {
      const newConfigs = [...prev];
      // Ensure array is long enough
      while (newConfigs.length <= selectedSpriteIndex) {
        newConfigs.push({ palette: 'default', block: 0 });
      }
      newConfigs[selectedSpriteIndex] = {
        ...newConfigs[selectedSpriteIndex],
        block,
      };
      return newConfigs;
    });

    // Mark file as dirty since palette config changed
    markFileDirty(filePath, true);
  }, [selectedSpriteIndex, filePath, markFileDirty]);

  // Expose the palette configs for saving (will be used by EditorContainer)
  // Store it on the window object so EditorContainer can access it
  useEffect(() => {
    // Store the current palette configs for this gbin so EditorContainer can save them
    (window as unknown as Record<string, unknown>)[`__spritePaletteConfigs_${gbinName}`] = spritePaletteConfigs;

    return () => {
      delete (window as unknown as Record<string, unknown>)[`__spritePaletteConfigs_${gbinName}`];
    };
  }, [spritePaletteConfigs, gbinName]);

  // Decode base64 content to Uint8Array (32KB gbin file)
  const gbinData = useMemo(() => {
    try {
      const binaryString = atob(content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // gbin files should be 32KB (32768 bytes)
      if (bytes.length !== 32768) {
        console.error(`Invalid gbin file: expected 32768 bytes, got ${bytes.length}`);
        return new Uint8Array(32768);
      }

      return bytes;
    } catch (err) {
      console.error('Error decoding gbin data:', err);
      return new Uint8Array(32768);
    }
  }, [content]);

  // Load palette data when palette path changes
  useEffect(() => {
    async function loadPalette() {
      if (!currentProjectHandle) return;

      try {
        const pathParts = selectedPalettePath.split('/');
        let currentHandle: FileSystemDirectoryHandle = currentProjectHandle;

        // Navigate through directories
        for (let i = 0; i < pathParts.length - 1; i++) {
          currentHandle = await currentHandle.getDirectoryHandle(pathParts[i], { create: false });
        }

        // Get the file
        const fileName = pathParts[pathParts.length - 1];
        const fileHandle = await currentHandle.getFileHandle(fileName, { create: false });
        const file = await fileHandle.getFile();
        const arrayBuffer = await file.arrayBuffer();
        setPaletteData(new Uint8Array(arrayBuffer));
      } catch (err) {
        console.error('Error loading palette:', err);
        // Fall back to default palette (all zeros)
        setPaletteData(new Uint8Array(1024));
      }
    }

    loadPalette();
  }, [currentProjectHandle, selectedPalettePath]);

  // Extract the current sprite's pixel data (16x16 grid of color indices)
  const spritePixels = useMemo(() => {
    const pixels: number[][] = Array(SPRITE_HEIGHT).fill(null).map(() => Array(SPRITE_WIDTH).fill(0));
    const spriteOffset = selectedSpriteIndex * BYTES_PER_SPRITE_4BPP;

    for (let row = 0; row < SPRITE_HEIGHT; row++) {
      for (let col = 0; col < SPRITE_WIDTH; col++) {
        // 4bpp format: high nibble = even pixels, low nibble = odd pixels
        const byteOffset = spriteOffset + row * 8 + Math.floor(col / 2);
        const byteValue = gbinData[byteOffset];

        if (col % 2 === 0) {
          // Even pixel - high nibble
          pixels[row][col] = (byteValue >> 4) & 0x0F;
        } else {
          // Odd pixel - low nibble
          pixels[row][col] = byteValue & 0x0F;
        }
      }
    }

    return pixels;
  }, [gbinData, selectedSpriteIndex]);

  // Handle pixel changes from the canvas
  const handlePixelChange = useCallback((row: number, col: number, colorIndex: number) => {
    const spriteOffset = selectedSpriteIndex * BYTES_PER_SPRITE_4BPP;
    const byteOffset = spriteOffset + row * 8 + Math.floor(col / 2);

    // Create new gbin data with the change
    const newData = new Uint8Array(gbinData);
    const currentByte = newData[byteOffset];

    if (col % 2 === 0) {
      // Even pixel - high nibble
      newData[byteOffset] = (currentByte & 0x0F) | ((colorIndex & 0x0F) << 4);
    } else {
      // Odd pixel - low nibble
      newData[byteOffset] = (currentByte & 0xF0) | (colorIndex & 0x0F);
    }

    // Encode back to base64
    let binary = '';
    for (let i = 0; i < newData.length; i++) {
      binary += String.fromCharCode(newData[i]);
    }
    const base64 = btoa(binary);

    // Update file content in store
    updateFileContent(filePath, base64);
    markFileDirty(filePath, true);
  }, [gbinData, selectedSpriteIndex, filePath, updateFileContent, markFileDirty]);

  // Handle bulk pixel changes (for rectangles, circles, lines)
  const handlePixelsChange = useCallback((changes: Array<{ row: number; col: number; colorIndex: number }>) => {
    const newData = new Uint8Array(gbinData);

    for (const { row, col, colorIndex } of changes) {
      const spriteOffset = selectedSpriteIndex * BYTES_PER_SPRITE_4BPP;
      const byteOffset = spriteOffset + row * 8 + Math.floor(col / 2);
      const currentByte = newData[byteOffset];

      if (col % 2 === 0) {
        newData[byteOffset] = (currentByte & 0x0F) | ((colorIndex & 0x0F) << 4);
      } else {
        newData[byteOffset] = (currentByte & 0xF0) | (colorIndex & 0x0F);
      }
    }

    // Encode back to base64
    let binary = '';
    for (let i = 0; i < newData.length; i++) {
      binary += String.fromCharCode(newData[i]);
    }
    const base64 = btoa(binary);

    updateFileContent(filePath, base64);
    markFileDirty(filePath, true);
  }, [gbinData, selectedSpriteIndex, filePath, updateFileContent, markFileDirty]);

  // Get the effective color index for the current tool
  const effectiveColorIndex = selectedTool === 'eraser' ? 0 : selectedColorIndex;

  // Handle tool selection - commit any pending paste when switching tools
  const handleToolSelect = useCallback((tool: Tool) => {
    if (pastePreview) {
      // Commit the paste before switching tools
      const changes: Array<{ row: number; col: number; colorIndex: number }> = [];
      for (let r = 0; r < pastePreview.data.length; r++) {
        for (let c = 0; c < pastePreview.data[r].length; c++) {
          const targetRow = pastePreview.row + r;
          const targetCol = pastePreview.col + c;
          if (targetRow >= 0 && targetRow < SPRITE_HEIGHT && targetCol >= 0 && targetCol < SPRITE_WIDTH) {
            changes.push({ row: targetRow, col: targetCol, colorIndex: pastePreview.data[r][c] });
          }
        }
      }
      if (changes.length > 0) {
        handlePixelsChange(changes);
      }
      setPastePreview(null);
    }
    setSelectedTool(tool);
  }, [pastePreview, handlePixelsChange]);

  // Handle actions (cut, copy, paste)
  const handleAction = useCallback((action: Action) => {
    if (action === 'cut' && selection) {
      // Cut: copy to clipboard and clear selection
      const minRow = Math.min(selection.startRow, selection.endRow);
      const maxRow = Math.max(selection.startRow, selection.endRow);
      const minCol = Math.min(selection.startCol, selection.endCol);
      const maxCol = Math.max(selection.startCol, selection.endCol);

      const clipboardData: number[][] = [];
      const changes: Array<{ row: number; col: number; colorIndex: number }> = [];

      for (let r = minRow; r <= maxRow; r++) {
        const rowData: number[] = [];
        for (let c = minCol; c <= maxCol; c++) {
          rowData.push(spritePixels[r][c]);
          changes.push({ row: r, col: c, colorIndex: 0 });
        }
        clipboardData.push(rowData);
      }

      setClipboard(clipboardData);
      handlePixelsChange(changes);
      setSelection(null);
    } else if (action === 'copy' && selection) {
      // Copy: copy to clipboard
      const minRow = Math.min(selection.startRow, selection.endRow);
      const maxRow = Math.max(selection.startRow, selection.endRow);
      const minCol = Math.min(selection.startCol, selection.endCol);
      const maxCol = Math.max(selection.startCol, selection.endCol);

      const clipboardData: number[][] = [];
      for (let r = minRow; r <= maxRow; r++) {
        const rowData: number[] = [];
        for (let c = minCol; c <= maxCol; c++) {
          rowData.push(spritePixels[r][c]);
        }
        clipboardData.push(rowData);
      }

      setClipboard(clipboardData);
    } else if (action === 'paste' && clipboard) {
      // If already pasting, commit the current paste first
      if (pastePreview) {
        const changes: Array<{ row: number; col: number; colorIndex: number }> = [];
        for (let r = 0; r < pastePreview.data.length; r++) {
          for (let c = 0; c < pastePreview.data[r].length; c++) {
            const targetRow = pastePreview.row + r;
            const targetCol = pastePreview.col + c;
            if (targetRow >= 0 && targetRow < SPRITE_HEIGHT && targetCol >= 0 && targetCol < SPRITE_WIDTH) {
              changes.push({ row: targetRow, col: targetCol, colorIndex: pastePreview.data[r][c] });
            }
          }
        }
        if (changes.length > 0) {
          handlePixelsChange(changes);
        }
      }

      // Start new paste preview centered in the sprite
      const pasteHeight = clipboard.length;
      const pasteWidth = clipboard[0].length;
      const centerRow = Math.floor((SPRITE_HEIGHT - pasteHeight) / 2);
      const centerCol = Math.floor((SPRITE_WIDTH - pasteWidth) / 2);

      setPastePreview({
        row: centerRow,
        col: centerCol,
        data: clipboard,
      });
      setSelection(null);
    }
  }, [selection, clipboard, pastePreview, spritePixels, handlePixelsChange]);

  // Commit paste preview to actual pixels
  const handleCommitPaste = useCallback(() => {
    if (!pastePreview) return;

    const changes: Array<{ row: number; col: number; colorIndex: number }> = [];
    for (let r = 0; r < pastePreview.data.length; r++) {
      for (let c = 0; c < pastePreview.data[r].length; c++) {
        const targetRow = pastePreview.row + r;
        const targetCol = pastePreview.col + c;
        if (targetRow >= 0 && targetRow < SPRITE_HEIGHT && targetCol >= 0 && targetCol < SPRITE_WIDTH) {
          changes.push({ row: targetRow, col: targetCol, colorIndex: pastePreview.data[r][c] });
        }
      }
    }
    if (changes.length > 0) {
      handlePixelsChange(changes);
    }
    setPastePreview(null);
  }, [pastePreview, handlePixelsChange]);

  // Start moving the selection (cut + paste in place)
  const handleStartMove = useCallback(() => {
    if (!selection) return;

    const minRow = Math.min(selection.startRow, selection.endRow);
    const maxRow = Math.max(selection.startRow, selection.endRow);
    const minCol = Math.min(selection.startCol, selection.endCol);
    const maxCol = Math.max(selection.startCol, selection.endCol);

    // Copy the selected pixels
    const moveData: number[][] = [];
    const clearChanges: Array<{ row: number; col: number; colorIndex: number }> = [];

    for (let r = minRow; r <= maxRow; r++) {
      const rowData: number[] = [];
      for (let c = minCol; c <= maxCol; c++) {
        rowData.push(spritePixels[r][c]);
        clearChanges.push({ row: r, col: c, colorIndex: 0 });
      }
      moveData.push(rowData);
    }

    // Clear the original location
    handlePixelsChange(clearChanges);

    // Create paste preview at the same location
    setPastePreview({
      row: minRow,
      col: minCol,
      data: moveData,
    });

    // Clear selection since we're now in paste/move mode
    setSelection(null);
  }, [selection, spritePixels, handlePixelsChange]);

  return (
    <div className="flex flex-col h-full dk-bg-primary">
      {/* Main content area */}
      <div className="flex flex-1 min-h-0">
        {/* Tool palette - left side */}
        <div className="flex-shrink-0 dk-border-r">
          <ToolPalette
            selectedTool={selectedTool}
            onToolSelect={handleToolSelect}
            onAction={handleAction}
            hasSelection={selection !== null}
            hasClipboard={clipboard !== null}
            isPasting={pastePreview !== null}
          />
        </div>

        {/* Canvas and controls - center */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top toolbar */}
          <div className="flex items-center justify-between dk-padding-compact dk-border-b">
            {/* Sprite selector */}
            <div className="flex items-center dk-gap-compact">
              <span className="dk-label">Sprite:</span>
              <SpriteSelector
                selectedIndex={selectedSpriteIndex}
                onSelectIndex={setSelectedSpriteIndex}
                maxSprites={SPRITES_PER_GBIN}
              />
            </div>

            {/* Zoom controls */}
            <div className="flex items-center dk-gap-compact">
              <span className="dk-label">Zoom:</span>
              <select
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="dk-input w-20"
              >
                <option value={1}>1x</option>
                <option value={4}>4x</option>
                <option value={8}>8x</option>
                <option value={16}>16x</option>
                <option value={24}>24x</option>
                <option value={32}>32x</option>
              </select>
            </div>

            {/* Transparency toggle */}
            <label className="flex items-center dk-gap-tight cursor-pointer dk-text-secondary">
              <input
                type="checkbox"
                checked={showTransparency}
                onChange={(e) => setShowTransparency(e.target.checked)}
                className="cursor-pointer"
              />
              <span className="text-sm">Show transparency</span>
            </label>
          </div>

          {/* Canvas area */}
          <div className="flex-1 min-h-0 overflow-auto flex items-center justify-center dk-padding-standard">
            <SpriteCanvas
              pixels={spritePixels}
              paletteData={paletteData}
              paletteBlockIndex={selectedPaletteBlockIndex}
              zoom={zoom}
              showTransparency={showTransparency}
              selectedTool={selectedTool}
              selectedColorIndex={effectiveColorIndex}
              onPixelChange={handlePixelChange}
              onPixelsChange={handlePixelsChange}
              selection={selection}
              onSelectionChange={setSelection}
              clipboard={clipboard}
              onClipboardChange={setClipboard}
              pastePreview={pastePreview}
              onPastePreviewChange={setPastePreview}
              onCommitPaste={handleCommitPaste}
              onStartMove={handleStartMove}
            />
          </div>
        </div>
      </div>

      {/* Bottom bar - Color picker and palette selector */}
      <div className="dk-border-t">
        {/* Palette selector row */}
        <div className="flex items-center dk-gap-compact dk-padding-compact dk-border-b">
          <PaletteSelector
            selectedPath={selectedPalettePath}
            selectedBlockIndex={selectedPaletteBlockIndex}
            onPathChange={handlePalettePathChange}
            onBlockIndexChange={handlePaletteBlockChange}
          />
        </div>

        {/* Color picker row */}
        <div className="dk-padding-compact">
          <ColorPicker
            paletteData={paletteData}
            paletteBlockIndex={selectedPaletteBlockIndex}
            selectedColorIndex={selectedColorIndex}
            onColorSelect={setSelectedColorIndex}
            showTransparency={showTransparency}
          />
        </div>
      </div>
    </div>
  );
}

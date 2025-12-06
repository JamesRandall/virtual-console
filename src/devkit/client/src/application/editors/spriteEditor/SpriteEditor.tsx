import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { useDevkitStore, type SpritePaletteConfig } from '../../../stores/devkitStore';
import { ToolPalette, type Tool, type Action } from './ToolPalette';
import { SpriteCanvas } from './SpriteCanvas';
import { ColorPicker } from './ColorPicker';
import { SpriteSelector } from './SpriteSelector';
import { PaletteSelector } from './PaletteSelector';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUndo, faRedo } from '@fortawesome/free-solid-svg-icons';
import { readBinaryFile } from '../../../services/fileSystemService';

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
const MAX_UNDO_HISTORY = 50; // Maximum number of undo states per sprite

// Helper: Set a pixel in gbin data (4bpp format - 2 pixels per byte)
function setPixelInGbin(data: Uint8Array, spriteIndex: number, row: number, col: number, colorIndex: number): void {
  const spriteOffset = spriteIndex * BYTES_PER_SPRITE_4BPP;
  const byteOffset = spriteOffset + row * 8 + Math.floor(col / 2);
  const currentByte = data[byteOffset];

  if (col % 2 === 0) {
    // Even pixel - high nibble
    data[byteOffset] = (currentByte & 0x0F) | ((colorIndex & 0x0F) << 4);
  } else {
    // Odd pixel - low nibble
    data[byteOffset] = (currentByte & 0xF0) | (colorIndex & 0x0F);
  }
}

// Helper: Encode Uint8Array to base64
function encodeToBase64(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}

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

  // Undo/redo state - stores pixel data snapshots per sprite
  // Using refs to avoid unnecessary re-renders, only the stack lengths trigger UI updates
  // Each sprite maps to a stack (array) of pixel snapshots, where each snapshot is a 16x16 2D array
  const undoStackRef = useRef<Map<number, number[][][]>>(new Map());
  const redoStackRef = useRef<Map<number, number[][][]>>(new Map());
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);
  // Track if we've saved undo state for the current drawing operation
  const hasUndoForCurrentStrokeRef = useRef(false);

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
        const data = await readBinaryFile(currentProjectHandle, selectedPalettePath);
        setPaletteData(data);
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

  // Update undo/redo counts when switching sprites
  useEffect(() => {
    const undoStack = undoStackRef.current.get(selectedSpriteIndex) || [];
    const redoStack = redoStackRef.current.get(selectedSpriteIndex) || [];
    setUndoCount(undoStack.length);
    setRedoCount(redoStack.length);
  }, [selectedSpriteIndex]);

  // Push current sprite state to undo stack
  const pushUndoState = useCallback(() => {
    const currentState = spritePixels.map(row => [...row]);
    const undoStack = undoStackRef.current.get(selectedSpriteIndex) || [];
    undoStack.push(currentState);

    // Limit stack size
    if (undoStack.length > MAX_UNDO_HISTORY) {
      undoStack.shift();
    }

    undoStackRef.current.set(selectedSpriteIndex, undoStack);
    setUndoCount(undoStack.length);

    // Clear redo stack when new change is made
    redoStackRef.current.set(selectedSpriteIndex, []);
    setRedoCount(0);
  }, [spritePixels, selectedSpriteIndex]);

  // Apply pixel state to the sprite
  const applyPixelState = useCallback((pixels: number[][]) => {
    const newData = new Uint8Array(gbinData);

    for (let row = 0; row < SPRITE_HEIGHT; row++) {
      for (let col = 0; col < SPRITE_WIDTH; col++) {
        setPixelInGbin(newData, selectedSpriteIndex, row, col, pixels[row][col]);
      }
    }

    updateFileContent(filePath, encodeToBase64(newData));
    markFileDirty(filePath, true);
  }, [gbinData, selectedSpriteIndex, filePath, updateFileContent, markFileDirty]);

  // Undo handler
  const handleUndo = useCallback(() => {
    const undoStack = undoStackRef.current.get(selectedSpriteIndex) || [];
    if (undoStack.length === 0) return;

    // Push current state to redo stack
    const currentState = spritePixels.map(row => [...row]);
    const redoStack = redoStackRef.current.get(selectedSpriteIndex) || [];
    redoStack.push(currentState);
    redoStackRef.current.set(selectedSpriteIndex, redoStack);
    setRedoCount(redoStack.length);

    // Pop and apply undo state
    const previousState = undoStack.pop()!;
    undoStackRef.current.set(selectedSpriteIndex, undoStack);
    setUndoCount(undoStack.length);

    applyPixelState(previousState);
  }, [selectedSpriteIndex, spritePixels, applyPixelState]);

  // Redo handler
  const handleRedo = useCallback(() => {
    const redoStack = redoStackRef.current.get(selectedSpriteIndex) || [];
    if (redoStack.length === 0) return;

    // Push current state to undo stack
    const currentState = spritePixels.map(row => [...row]);
    const undoStack = undoStackRef.current.get(selectedSpriteIndex) || [];
    undoStack.push(currentState);
    undoStackRef.current.set(selectedSpriteIndex, undoStack);
    setUndoCount(undoStack.length);

    // Pop and apply redo state
    const nextState = redoStack.pop()!;
    redoStackRef.current.set(selectedSpriteIndex, redoStack);
    setRedoCount(redoStack.length);

    applyPixelState(nextState);
  }, [selectedSpriteIndex, spritePixels, applyPixelState]);

  // Handle pixel changes from the canvas
  const handlePixelChange = useCallback((row: number, col: number, colorIndex: number) => {
    // Save undo state at the start of each stroke
    if (!hasUndoForCurrentStrokeRef.current) {
      pushUndoState();
      hasUndoForCurrentStrokeRef.current = true;
    }

    const newData = new Uint8Array(gbinData);
    setPixelInGbin(newData, selectedSpriteIndex, row, col, colorIndex);

    updateFileContent(filePath, encodeToBase64(newData));
    markFileDirty(filePath, true);
  }, [gbinData, selectedSpriteIndex, filePath, updateFileContent, markFileDirty, pushUndoState]);

  // Handle bulk pixel changes (for rectangles, circles, lines)
  const handlePixelsChange = useCallback((changes: Array<{ row: number; col: number; colorIndex: number }>) => {
    // Save undo state before bulk changes
    if (!hasUndoForCurrentStrokeRef.current) {
      pushUndoState();
      hasUndoForCurrentStrokeRef.current = true;
    }

    const newData = new Uint8Array(gbinData);

    for (const { row, col, colorIndex } of changes) {
      setPixelInGbin(newData, selectedSpriteIndex, row, col, colorIndex);
    }

    updateFileContent(filePath, encodeToBase64(newData));
    markFileDirty(filePath, true);
  }, [gbinData, selectedSpriteIndex, filePath, updateFileContent, markFileDirty, pushUndoState]);

  // Called when a drawing operation ends (mouse up)
  const handleOperationEnd = useCallback(() => {
    hasUndoForCurrentStrokeRef.current = false;
  }, []);

  // Helper: Get normalized selection bounds (min/max)
  const getSelectionBounds = useCallback((sel: { startRow: number; startCol: number; endRow: number; endCol: number }) => {
    return {
      minRow: Math.min(sel.startRow, sel.endRow),
      maxRow: Math.max(sel.startRow, sel.endRow),
      minCol: Math.min(sel.startCol, sel.endCol),
      maxCol: Math.max(sel.startCol, sel.endCol),
    };
  }, []);

  // Helper: Extract pixel data from a selection region
  const extractSelectionPixels = useCallback((sel: { startRow: number; startCol: number; endRow: number; endCol: number }) => {
    const { minRow, maxRow, minCol, maxCol } = getSelectionBounds(sel);
    const pixelData: number[][] = [];
    for (let r = minRow; r <= maxRow; r++) {
      const rowData: number[] = [];
      for (let c = minCol; c <= maxCol; c++) {
        rowData.push(spritePixels[r][c]);
      }
      pixelData.push(rowData);
    }
    return { pixelData, minRow, maxRow, minCol, maxCol };
  }, [getSelectionBounds, spritePixels]);

  // Helper: Convert paste preview to pixel changes array
  const getPasteChanges = useCallback((preview: { row: number; col: number; data: number[][] }) => {
    const changes: Array<{ row: number; col: number; colorIndex: number }> = [];
    for (let r = 0; r < preview.data.length; r++) {
      for (let c = 0; c < preview.data[r].length; c++) {
        const targetRow = preview.row + r;
        const targetCol = preview.col + c;
        if (targetRow >= 0 && targetRow < SPRITE_HEIGHT && targetCol >= 0 && targetCol < SPRITE_WIDTH) {
          changes.push({ row: targetRow, col: targetCol, colorIndex: preview.data[r][c] });
        }
      }
    }
    return changes;
  }, []);

  // Get the effective color index for the current tool
  const effectiveColorIndex = selectedTool === 'eraser' ? 0 : selectedColorIndex;

  // Handle tool selection - commit any pending paste when switching tools
  const handleToolSelect = useCallback((tool: Tool) => {
    if (pastePreview) {
      // Commit the paste before switching tools
      const changes = getPasteChanges(pastePreview);
      if (changes.length > 0) {
        handlePixelsChange(changes);
      }
      setPastePreview(null);
    }
    setSelectedTool(tool);
  }, [pastePreview, handlePixelsChange, getPasteChanges]);

  // Handle actions (cut, copy, paste)
  const handleAction = useCallback((action: Action) => {
    if (action === 'cut' && selection) {
      // Cut: copy to clipboard and clear selection
      const { pixelData, minRow, maxRow, minCol, maxCol } = extractSelectionPixels(selection);
      const changes: Array<{ row: number; col: number; colorIndex: number }> = [];
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          changes.push({ row: r, col: c, colorIndex: 0 });
        }
      }

      setClipboard(pixelData);
      handlePixelsChange(changes);
      setSelection(null);
    } else if (action === 'copy' && selection) {
      // Copy: copy to clipboard
      const { pixelData } = extractSelectionPixels(selection);
      setClipboard(pixelData);
    } else if (action === 'paste' && clipboard) {
      // If already pasting, commit the current paste first
      if (pastePreview) {
        const changes = getPasteChanges(pastePreview);
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
  }, [selection, clipboard, pastePreview, handlePixelsChange, extractSelectionPixels, getPasteChanges]);

  // Commit paste preview to actual pixels
  const handleCommitPaste = useCallback(() => {
    if (!pastePreview) return;

    const changes = getPasteChanges(pastePreview);
    if (changes.length > 0) {
      handlePixelsChange(changes);
    }
    setPastePreview(null);
  }, [pastePreview, handlePixelsChange, getPasteChanges]);

  // Start moving the selection (cut + paste in place)
  const handleStartMove = useCallback(() => {
    if (!selection) return;

    const { pixelData, minRow, maxRow, minCol, maxCol } = extractSelectionPixels(selection);
    const clearChanges: Array<{ row: number; col: number; colorIndex: number }> = [];
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        clearChanges.push({ row: r, col: c, colorIndex: 0 });
      }
    }

    // Clear the original location
    handlePixelsChange(clearChanges);

    // Create paste preview at the same location
    setPastePreview({
      row: minRow,
      col: minCol,
      data: pixelData,
    });

    // Clear selection since we're now in paste/move mode
    setSelection(null);
  }, [selection, handlePixelsChange, extractSelectionPixels]);

  return (
    <div className="flex flex-col h-full dk-bg-primary">
      {/* Top toolbar - full width */}
      <div className="flex items-center gap-6 px-3 py-2 dk-border-b">
        {/* Sprite selector */}
        <div className="flex items-center gap-2">
          <span className="dk-label">Sprite:</span>
          <SpriteSelector
            selectedIndex={selectedSpriteIndex}
            onSelectIndex={setSelectedSpriteIndex}
            maxSprites={SPRITES_PER_GBIN}
            gbinData={gbinData}
            paletteData={paletteData}
            paletteBlockIndex={selectedPaletteBlockIndex}
            spritePaletteConfigs={spritePaletteConfigs}
          />
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <span className="dk-label">Zoom:</span>
          <select
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-7 w-16 px-2 bg-zinc-700 border border-zinc-600 rounded text-zinc-200 text-sm focus:outline-none focus:border-zinc-500"
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
        <label className="flex items-center gap-2 cursor-pointer dk-text-secondary">
          <input
            type="checkbox"
            checked={showTransparency}
            onChange={(e) => setShowTransparency(e.target.checked)}
            className="cursor-pointer"
          />
          <span className="text-sm">Show transparency</span>
        </label>

        {/* Undo/Redo buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleUndo}
            disabled={undoCount === 0}
            className="h-7 w-7 flex items-center justify-center bg-zinc-700 hover:bg-zinc-600 text-zinc-400 hover:text-zinc-200 rounded transition-colors disabled:bg-zinc-800 disabled:cursor-not-allowed disabled:text-zinc-600"
            title={`Undo (${undoCount})`}
          >
            <FontAwesomeIcon icon={faUndo} className="text-xs" />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoCount === 0}
            className="h-7 w-7 flex items-center justify-center bg-zinc-700 hover:bg-zinc-600 text-zinc-400 hover:text-zinc-200 rounded transition-colors disabled:bg-zinc-800 disabled:cursor-not-allowed disabled:text-zinc-600"
            title={`Redo (${redoCount})`}
          >
            <FontAwesomeIcon icon={faRedo} className="text-xs" />
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 min-h-0">
        {/* Tool palette - left side */}
        <div className="flex-shrink-0 overflow-visible">
          <ToolPalette
            selectedTool={selectedTool}
            onToolSelect={handleToolSelect}
            onAction={handleAction}
            hasSelection={selection !== null}
            hasClipboard={clipboard !== null}
            isPasting={pastePreview !== null}
          />
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
              onOperationEnd={handleOperationEnd}
            />
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

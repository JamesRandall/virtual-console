import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Allotment } from 'allotment';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUndo, faRedo } from '@fortawesome/free-solid-svg-icons';
import { TilemapCanvas } from './TilemapCanvas';
import { TilePicker } from './TilePicker';
import { SpritePicker } from './SpritePicker';
import { TilemapToolPalette, type TilemapTool } from './TilemapToolPalette';
import { SpriteToolPalette } from './SpriteToolPalette';
import { AttributeEditor } from './AttributeEditor';
import { SpriteAttributeEditor } from './SpriteAttributeEditor';
import { ResizeDropdown } from './ResizeDropdown';
import { EditorModeToggle } from './EditorModeToggle';
import { useDevkitStore, type SpritePaletteConfig, type TilemapEditorFileConfig } from '../../../stores/devkitStore';
import { readBinaryFile, writeBinaryFile } from '../../../services/fileSystemService';
import {
  type LevelSprite,
  type EditorMode,
  type SpriteTool,
  parseSbin,
  serializeSbin,
  createEmptySbin,
  getSbinPath,
  generateSpriteId,
  createSprite,
  findSpriteAt,
  findSpritesInRect,
  cloneSpritesForClipboard,
  pasteSprites,
  type SpriteClipboard,
} from './spriteUtils';

// Extract tbin name from path (e.g., "tilemaps/level1.tbin" -> "level1")
function getTbinName(filePath: string): string {
  const fileName = filePath.split('/').pop() || filePath;
  return fileName.replace('.tbin', '');
}

// Constants
const HEADER_SIZE = 8;
const MAX_FILE_SIZE = 32768;

// Tile data structure
export interface TileEntry {
  index: number;        // 0-255, 0 = empty/transparent
  flipH: boolean;       // Horizontal flip
  flipV: boolean;       // Vertical flip
  priority: boolean;    // Priority over sprites
  palette: number;      // 0-3
  bankOffset: number;   // 0-3
}

// Selection rectangle
export interface TileSelection {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

// Clipboard data
export interface TileClipboard {
  width: number;
  height: number;
  tiles: TileEntry[][];
}

// Paste preview
export interface PastePreview {
  row: number;
  col: number;
  data: TileEntry[][];
}

// Undo state (includes dimensions for resize support and sprites)
interface UndoState {
  width: number;
  height: number;
  tiles: TileEntry[][];
  sprites: LevelSprite[];
}

interface TilemapEditorProps {
  filePath: string;
  content: string; // base64-encoded tbin data
}

// Parse attribute byte into components
function parseAttributes(attr: number): Omit<TileEntry, 'index'> {
  return {
    flipH: (attr & 0x80) !== 0,
    flipV: (attr & 0x40) !== 0,
    priority: (attr & 0x20) !== 0,
    palette: (attr >> 3) & 0x03,
    bankOffset: attr & 0x03,
  };
}

// Encode attributes to byte
function encodeAttributes(tile: TileEntry): number {
  let attr = 0;
  if (tile.flipH) attr |= 0x80;
  if (tile.flipV) attr |= 0x40;
  if (tile.priority) attr |= 0x20;
  attr |= (tile.palette & 0x03) << 3;
  attr |= tile.bankOffset & 0x03;
  return attr;
}

// Create empty tile
function createEmptyTile(): TileEntry {
  return {
    index: 0,
    flipH: false,
    flipV: false,
    priority: false,
    palette: 0,
    bankOffset: 0,
  };
}

// Clone tile
function cloneTile(tile: TileEntry): TileEntry {
  return { ...tile };
}

export function TilemapEditor({ filePath, content }: TilemapEditorProps) {
  // Zustand store
  const currentProjectHandle = useDevkitStore((state) => state.currentProjectHandle);
  const projectConfig = useDevkitStore((state) => state.projectConfig);
  const updateFileContent = useDevkitStore((state) => state.updateFileContent);
  const markFileDirty = useDevkitStore((state) => state.markFileDirty);
  const refreshProjectTree = useDevkitStore((state) => state.refreshProjectTree);

  // Track whether we've initialized from content to avoid re-parsing on our own saves
  const initialContentRef = useRef<string | null>(null);

  // Tilemap dimensions
  const [width, setWidth] = useState(128);
  const [height, setHeight] = useState(128);

  // Tile data (2D array)
  const [tiles, setTiles] = useState<TileEntry[][]>(() => {
    const rows: TileEntry[][] = [];
    for (let r = 0; r < 128; r++) {
      const row: TileEntry[] = [];
      for (let c = 0; c < 128; c++) {
        row.push(createEmptyTile());
      }
      rows.push(row);
    }
    return rows;
  });

  // Graphics and palette selection (for tiles)
  const [selectedGbin, setSelectedGbin] = useState<string | null>(null);
  const [selectedPbin, setSelectedPbin] = useState<string | null>(null);
  const [gbinData, setGbinData] = useState<Uint8Array | null>(null);
  const [pbinData, setPbinData] = useState<Uint8Array | null>(null);
  const [availableGbins, setAvailableGbins] = useState<string[]>([]);
  const [availablePbins, setAvailablePbins] = useState<string[]>([]);

  // Graphics and palette selection (for sprites - separate from tiles)
  const [selectedSpriteGbin, setSelectedSpriteGbin] = useState<string | null>(null);
  const [selectedSpritePbin, setSelectedSpritePbin] = useState<string | null>(null);
  const [spriteGbinData, setSpriteGbinData] = useState<Uint8Array | null>(null);
  const [spritePbinData, setSpritePbinData] = useState<Uint8Array | null>(null);
  const [selectedSpritePaletteBlock, setSelectedSpritePaletteBlock] = useState(0);

  // Track file config (gbin/pbin selections that will be saved to config.json)
  const [fileConfig, setFileConfig] = useState<TilemapEditorFileConfig | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const tbinName = getTbinName(filePath);

  // Tool state
  const [selectedTool, setSelectedToolInternal] = useState<TilemapTool>('pen');
  const [selectedTileIndex, setSelectedTileIndex] = useState(1); // Start at 1 (0 is empty)
  const [selectedPaletteBlock, setSelectedPaletteBlock] = useState(0);
  const [zoom, setZoom] = useState(2);

  // Selection state
  const [selection, setSelection] = useState<TileSelection | null>(null);

  // Wrap setSelectedTool to clear selection when switching to non-selection tools
  const setSelectedTool = useCallback((tool: TilemapTool) => {
    setSelectedToolInternal(tool);
    // Clear selection when switching away from selection-related tools
    if (tool !== 'select' && tool !== 'move' && tool !== 'pointer') {
      setSelection(null);
    }
  }, []);
  const [clipboard, setClipboard] = useState<TileClipboard | null>(null);
  const [pastePreview, setPastePreview] = useState<PastePreview | null>(null);

  // Undo/redo state (includes dimensions for resize support)
  const [undoStack, setUndoStack] = useState<UndoState[]>([]);
  const [redoStack, setRedoStack] = useState<UndoState[]>([]);
  const MAX_UNDO = 50;

  // Display options
  const [showOnlyNonEmpty, setShowOnlyNonEmpty] = useState(false);
  const [showOnlyInPaletteRange, setShowOnlyInPaletteRange] = useState(false);

  // Cursor position (reported from canvas)
  const [cursorPos, setCursorPos] = useState<{ row: number; col: number } | null>(null);

  // ===== SPRITE PLACEMENT STATE =====
  const [editorMode, setEditorMode] = useState<EditorMode>('tile');
  const [sprites, setSprites] = useState<LevelSprite[]>([]);
  const [selectedSpriteIds, setSelectedSpriteIds] = useState<Set<number>>(new Set());
  const [spriteTool, setSpriteTool] = useState<SpriteTool>('select');
  const [spriteToPlace, setSpriteToPlace] = useState<number>(0);
  const [spriteClipboard, setSpriteClipboard] = useState<SpriteClipboard | null>(null);
  const [nextSpriteId, setNextSpriteId] = useState<number>(1);
  const initialSbinContentRef = useRef<string | null>(null);
  const [sbinLoaded, setSbinLoaded] = useState(false);

  // Default attributes for new sprites
  const [defaultSpriteAttrs, setDefaultSpriteAttrs] = useState({
    flipH: false,
    flipV: false,
    priority: false,
    paletteOffset: 0,
    bankOffset: 0,
    typeId: 0,
  });

  // Snap sprites to tile grid (16px alignment)
  const [snapToGrid, setSnapToGrid] = useState(true);

  // Get selected sprites as array
  const selectedSprites = useMemo(() => {
    return sprites.filter(s => selectedSpriteIds.has(s.id));
  }, [sprites, selectedSpriteIds]);

  // Get sprite palette configs from project config (for tile graphics)
  const spritePaletteConfigs = useMemo((): SpritePaletteConfig[] | undefined => {
    if (!projectConfig || !selectedGbin) return undefined;
    const gbinName = selectedGbin.split('/').pop()?.replace('.gbin', '') || '';
    return projectConfig['sprite-editor']?.[gbinName];
  }, [projectConfig, selectedGbin]);

  // Get sprite palette configs for sprite graphics (separate from tiles)
  const spriteGbinPaletteConfigs = useMemo((): SpritePaletteConfig[] | undefined => {
    if (!projectConfig || !selectedSpriteGbin) return undefined;
    const gbinName = selectedSpriteGbin.split('/').pop()?.replace('.gbin', '') || '';
    return projectConfig['sprite-editor']?.[gbinName];
  }, [projectConfig, selectedSpriteGbin]);

  // Get the default palette for a tile index (from config, clamped to 0-3)
  const getDefaultPaletteForTile = useCallback((tileIndex: number): number => {
    if (spritePaletteConfigs && spritePaletteConfigs[tileIndex]) {
      const configPalette = spritePaletteConfigs[tileIndex].block;
      // Clamp to 0-3 range, default to 0 if out of range
      if (configPalette >= 0 && configPalette <= 3) {
        return configPalette;
      }
      return 0;
    }
    return 0;
  }, [spritePaletteConfigs]);

  // Load file config from project config on mount
  useEffect(() => {
    if (configLoaded) return;

    const tilemapEditorConfig = projectConfig?.['tilemap-editor'];
    if (tilemapEditorConfig && tilemapEditorConfig[tbinName]) {
      const config = tilemapEditorConfig[tbinName];
      setFileConfig(config);
      setSelectedGbin(config.gbin || null);
      setSelectedPbin(config.pbin || null);
      // Load sprite gbin/pbin if configured, otherwise default to same as tiles
      setSelectedSpriteGbin((config as { spriteGbin?: string }).spriteGbin || config.gbin || null);
      setSelectedSpritePbin((config as { spritePbin?: string }).spritePbin || config.pbin || null);
    }
    setConfigLoaded(true);
  }, [projectConfig, tbinName, configLoaded]);

  // Load available gbin and pbin files
  useEffect(() => {
    async function loadAvailableFiles() {
      if (!currentProjectHandle) return;

      const gbins: string[] = [];
      const pbins: string[] = [];

      async function scanDirectory(handle: FileSystemDirectoryHandle, basePath: string) {
        // @ts-expect-error - values() is supported but not in all type definitions
        for await (const entry of handle.values()) {
          const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;
          if (entry.kind === 'directory') {
            const subDir = await handle.getDirectoryHandle(entry.name);
            await scanDirectory(subDir, entryPath);
          } else if (entry.kind === 'file') {
            if (entry.name.endsWith('.gbin')) {
              gbins.push(entryPath);
            } else if (entry.name.endsWith('.pbin')) {
              pbins.push(entryPath);
            }
          }
        }
      }

      try {
        for (const dir of ['sprites', 'tiles', 'palettes']) {
          try {
            const dirHandle = await currentProjectHandle.getDirectoryHandle(dir, { create: false });
            await scanDirectory(dirHandle, dir);
          } catch {
            // Directory doesn't exist
          }
        }
      } catch (error) {
        console.error('Error scanning directories:', error);
      }

      setAvailableGbins(gbins.sort());
      setAvailablePbins(pbins.sort());

      // Set defaults if available (only if no config was loaded)
      if (gbins.length > 0 && !selectedGbin && configLoaded) {
        setSelectedGbin(gbins[0]);
      }
      if (pbins.length > 0 && !selectedPbin && configLoaded) {
        setSelectedPbin(pbins[0]);
      }
      // Set sprite defaults too
      if (gbins.length > 0 && !selectedSpriteGbin && configLoaded) {
        setSelectedSpriteGbin(gbins[0]);
      }
      if (pbins.length > 0 && !selectedSpritePbin && configLoaded) {
        setSelectedSpritePbin(pbins[0]);
      }
    }

    loadAvailableFiles();
  }, [currentProjectHandle, selectedGbin, selectedPbin, selectedSpriteGbin, selectedSpritePbin, configLoaded]);

  // Load gbin data when selection changes
  useEffect(() => {
    async function loadGbin() {
      if (!currentProjectHandle || !selectedGbin) {
        setGbinData(null);
        return;
      }

      try {
        const data = await readBinaryFile(currentProjectHandle, selectedGbin);
        setGbinData(data);
      } catch (error) {
        console.error('Error loading gbin:', error);
        setGbinData(null);
      }
    }

    loadGbin();
  }, [currentProjectHandle, selectedGbin]);

  // Load pbin data when selection changes
  useEffect(() => {
    async function loadPbin() {
      if (!currentProjectHandle || !selectedPbin) {
        setPbinData(null);
        return;
      }

      try {
        const data = await readBinaryFile(currentProjectHandle, selectedPbin);
        setPbinData(data);
      } catch (error) {
        console.error('Error loading pbin:', error);
        setPbinData(null);
      }
    }

    loadPbin();
  }, [currentProjectHandle, selectedPbin]);

  // Load sprite gbin data when selection changes
  useEffect(() => {
    async function loadSpriteGbin() {
      if (!currentProjectHandle || !selectedSpriteGbin) {
        setSpriteGbinData(null);
        return;
      }

      try {
        const data = await readBinaryFile(currentProjectHandle, selectedSpriteGbin);
        setSpriteGbinData(data);
      } catch (error) {
        console.error('Error loading sprite gbin:', error);
        setSpriteGbinData(null);
      }
    }

    loadSpriteGbin();
  }, [currentProjectHandle, selectedSpriteGbin]);

  // Load sprite pbin data when selection changes
  useEffect(() => {
    async function loadSpritePbin() {
      if (!currentProjectHandle || !selectedSpritePbin) {
        setSpritePbinData(null);
        return;
      }

      try {
        const data = await readBinaryFile(currentProjectHandle, selectedSpritePbin);
        setSpritePbinData(data);
      } catch (error) {
        console.error('Error loading sprite pbin:', error);
        setSpritePbinData(null);
      }
    }

    loadSpritePbin();
  }, [currentProjectHandle, selectedSpritePbin]);

  // Load sbin (sprite placement) data
  useEffect(() => {
    async function loadSbin() {
      if (!currentProjectHandle || sbinLoaded) return;

      const sbinPath = getSbinPath(filePath);

      try {
        const data = await readBinaryFile(currentProjectHandle, sbinPath);
        const loadedSprites = parseSbin(data);
        setSprites(loadedSprites);

        // Update nextSpriteId based on loaded sprites
        if (loadedSprites.length > 0) {
          setNextSpriteId(Math.max(...loadedSprites.map(s => s.id)) + 1);
        }

        // Store initial content for dirty tracking
        let binary = '';
        for (let i = 0; i < data.length; i++) {
          binary += String.fromCharCode(data[i]);
        }
        initialSbinContentRef.current = btoa(binary);
        setSbinLoaded(true);
      } catch (error) {
        // sbin doesn't exist yet - create an empty one
        const emptySbin = createEmptySbin();
        try {
          await writeBinaryFile(currentProjectHandle, sbinPath, emptySbin);
          console.log('Created empty sbin file:', sbinPath);
          refreshProjectTree(); // Refresh to show the new file
        } catch (writeError) {
          console.error('Failed to create sbin file:', writeError);
        }
        setSprites([]);

        // Store initial content for dirty tracking
        let binary = '';
        for (let i = 0; i < emptySbin.length; i++) {
          binary += String.fromCharCode(emptySbin[i]);
        }
        initialSbinContentRef.current = btoa(binary);
        setSbinLoaded(true);
      }
    }

    loadSbin();
  }, [currentProjectHandle, filePath, sbinLoaded, refreshProjectTree]);

  // Parse content on initial mount only
  // We track the initial content and only re-parse if the content changes externally
  // (not from our own saves)
  useEffect(() => {
    if (!content) return;

    // If this is the same content we already initialized from, skip
    // This prevents our own saveToStore() from triggering a re-parse
    if (initialContentRef.current === content) {
      return;
    }

    // Only parse on first load or if content changed externally
    // After first parse, we track it so subsequent updates from our saves are ignored
    initialContentRef.current = content;

    try {
      // Decode base64
      const binaryString = atob(content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Parse header
      const w = bytes[0] | (bytes[1] << 8);
      const h = bytes[2] | (bytes[3] << 8);

      if (w > 0 && h > 0 && w * h * 2 + HEADER_SIZE <= MAX_FILE_SIZE) {
        setWidth(w);
        setHeight(h);

        // Parse tile data
        const newTiles: TileEntry[][] = [];
        for (let r = 0; r < h; r++) {
          const row: TileEntry[] = [];
          for (let c = 0; c < w; c++) {
            const offset = HEADER_SIZE + (r * w + c) * 2;
            const index = bytes[offset] || 0;
            const attr = bytes[offset + 1] || 0;
            row.push({
              index,
              ...parseAttributes(attr),
            });
          }
          newTiles.push(row);
        }
        setTiles(newTiles);
      }
    } catch (error) {
      console.error('Error parsing tbin:', error);
    }
  }, [content]);

  // Convert tiles back to binary and update content
  const serializeTilemap = useCallback((): Uint8Array => {
    const totalSize = HEADER_SIZE + width * height * 2;
    const bytes = new Uint8Array(totalSize);

    // Write header
    bytes[0] = width & 0xFF;
    bytes[1] = (width >> 8) & 0xFF;
    bytes[2] = height & 0xFF;
    bytes[3] = (height >> 8) & 0xFF;
    // bytes[4-7] are reserved (already 0)

    // Write tile data
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const offset = HEADER_SIZE + (r * width + c) * 2;
        const tile = tiles[r]?.[c] || createEmptyTile();
        bytes[offset] = tile.index;
        bytes[offset + 1] = encodeAttributes(tile);
      }
    }

    return bytes;
  }, [width, height, tiles]);

  // Serialize sprites to binary
  const serializeSprites = useCallback((): Uint8Array => {
    return serializeSbin(sprites);
  }, [sprites]);

  // Save tilemap and sprites to store
  const saveToStore = useCallback(() => {
    // Save tbin
    const tbinBytes = serializeTilemap();
    let tbinBinaryString = '';
    for (let i = 0; i < tbinBytes.length; i++) {
      tbinBinaryString += String.fromCharCode(tbinBytes[i]);
    }
    const tbinBase64 = btoa(tbinBinaryString);
    initialContentRef.current = tbinBase64;
    updateFileContent(filePath, tbinBase64);

    // Save sbin (sprite placements)
    const sbinPath = getSbinPath(filePath);
    const sbinBytes = serializeSprites();
    let sbinBinaryString = '';
    for (let i = 0; i < sbinBytes.length; i++) {
      sbinBinaryString += String.fromCharCode(sbinBytes[i]);
    }
    const sbinBase64 = btoa(sbinBinaryString);
    initialSbinContentRef.current = sbinBase64;
    updateFileContent(sbinPath, sbinBase64);

    // Mark both files as dirty
    markFileDirty(filePath, true);
    markFileDirty(sbinPath, true);
  }, [serializeTilemap, serializeSprites, updateFileContent, markFileDirty, filePath]);

  // Auto-sync sprites to store when they change
  // This ensures the sbin content is always up-to-date in the store
  useEffect(() => {
    if (!sbinLoaded) return; // Don't save until initial load is complete

    const sbinPath = getSbinPath(filePath);
    const sbinBytes = serializeSbin(sprites);
    let sbinBinaryString = '';
    for (let i = 0; i < sbinBytes.length; i++) {
      sbinBinaryString += String.fromCharCode(sbinBytes[i]);
    }
    const sbinBase64 = btoa(sbinBinaryString);

    // Only update if content actually changed
    if (sbinBase64 !== initialSbinContentRef.current) {
      updateFileContent(sbinPath, sbinBase64);
      markFileDirty(sbinPath, true);
    }
  }, [sprites, sbinLoaded, filePath, updateFileContent, markFileDirty]);

  // Push current state to undo stack
  const pushUndoState = useCallback(() => {
    const clonedTiles = tiles.map(row => row.map(tile => cloneTile(tile)));
    const clonedSprites = sprites.map(s => ({ ...s }));
    const state: UndoState = { width, height, tiles: clonedTiles, sprites: clonedSprites };
    setUndoStack(prev => {
      const newStack = [...prev, state];
      if (newStack.length > MAX_UNDO) {
        return newStack.slice(1);
      }
      return newStack;
    });
    setRedoStack([]);
  }, [tiles, sprites, width, height]);

  // Undo
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;

    const previousState = undoStack[undoStack.length - 1];
    const currentState: UndoState = {
      width,
      height,
      tiles: tiles.map(row => row.map(tile => cloneTile(tile))),
      sprites: sprites.map(s => ({ ...s })),
    };

    setRedoStack(prev => [...prev, currentState]);
    setUndoStack(prev => prev.slice(0, -1));
    setWidth(previousState.width);
    setHeight(previousState.height);
    setTiles(previousState.tiles);
    setSprites(previousState.sprites);
    setSelectedSpriteIds(new Set()); // Clear sprite selection on undo
    saveToStore();
  }, [undoStack, tiles, sprites, width, height, saveToStore]);

  // Redo
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;

    const nextState = redoStack[redoStack.length - 1];
    const currentState: UndoState = {
      width,
      height,
      tiles: tiles.map(row => row.map(tile => cloneTile(tile))),
      sprites: sprites.map(s => ({ ...s })),
    };

    setUndoStack(prev => [...prev, currentState]);
    setRedoStack(prev => prev.slice(0, -1));
    setWidth(nextState.width);
    setHeight(nextState.height);
    setTiles(nextState.tiles);
    setSprites(nextState.sprites);
    setSelectedSpriteIds(new Set()); // Clear sprite selection on redo
    saveToStore();
  }, [redoStack, tiles, sprites, width, height, saveToStore]);

  // Handle single tile change
  const handleTileChange = useCallback((row: number, col: number, tileIndex: number) => {
    if (row < 0 || row >= height || col < 0 || col >= width) return;

    setTiles(prev => {
      const newTiles = prev.map(r => r.map(t => cloneTile(t)));
      newTiles[row][col] = {
        index: tileIndex,
        flipH: false,
        flipV: false,
        priority: false,
        palette: getDefaultPaletteForTile(tileIndex),
        bankOffset: 0,
      };
      return newTiles;
    });
  }, [width, height, getDefaultPaletteForTile]);

  // Handle multiple tile changes
  const handleTilesChange = useCallback((changes: Array<{ row: number; col: number; tileIndex: number }>) => {
    setTiles(prev => {
      const newTiles = prev.map(r => r.map(t => cloneTile(t)));
      for (const { row, col, tileIndex } of changes) {
        if (row >= 0 && row < height && col >= 0 && col < width) {
          newTiles[row][col] = {
            index: tileIndex,
            flipH: false,
            flipV: false,
            priority: false,
            palette: getDefaultPaletteForTile(tileIndex),
            bankOffset: 0,
          };
        }
      }
      return newTiles;
    });
  }, [width, height, getDefaultPaletteForTile]);

  // Handle operation end (save undo state)
  const handleOperationEnd = useCallback(() => {
    pushUndoState();
    saveToStore();
  }, [pushUndoState, saveToStore]);

  // Handle resize
  const handleResize = useCallback((newWidth: number, newHeight: number) => {
    // Push current state to undo stack before resizing
    pushUndoState();

    // Create new tiles array with new dimensions
    const newTiles: TileEntry[][] = [];
    for (let r = 0; r < newHeight; r++) {
      const row: TileEntry[] = [];
      for (let c = 0; c < newWidth; c++) {
        // Copy existing tile if within old bounds, otherwise create empty
        if (r < height && c < width && tiles[r] && tiles[r][c]) {
          row.push(cloneTile(tiles[r][c]));
        } else {
          row.push(createEmptyTile());
        }
      }
      newTiles.push(row);
    }

    // Update dimensions and tiles
    setWidth(newWidth);
    setHeight(newHeight);
    setTiles(newTiles);

    // Clear selection if it's now out of bounds
    if (selection) {
      const selMinRow = Math.min(selection.startRow, selection.endRow);
      const selMinCol = Math.min(selection.startCol, selection.endCol);
      if (selMinRow >= newHeight || selMinCol >= newWidth) {
        setSelection(null);
      }
    }

    // Save to store
    saveToStore();
  }, [pushUndoState, height, width, tiles, selection, saveToStore]);

  // Handle attribute changes for selected tiles
  const handleAttributeChange = useCallback((attr: keyof Omit<TileEntry, 'index'>, value: boolean | number) => {
    if (!selection) return;

    pushUndoState();

    const minRow = Math.min(selection.startRow, selection.endRow);
    const maxRow = Math.max(selection.startRow, selection.endRow);
    const minCol = Math.min(selection.startCol, selection.endCol);
    const maxCol = Math.max(selection.startCol, selection.endCol);

    setTiles(prev => {
      const newTiles = prev.map(r => r.map(t => cloneTile(t)));
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          if (r < height && c < width && newTiles[r][c].index !== 0) {
            const tile = newTiles[r][c];
            switch (attr) {
              case 'flipH':
                tile.flipH = value as boolean;
                break;
              case 'flipV':
                tile.flipV = value as boolean;
                break;
              case 'priority':
                tile.priority = value as boolean;
                break;
              case 'palette':
                tile.palette = value as number;
                break;
              case 'bankOffset':
                tile.bankOffset = value as number;
                break;
            }
          }
        }
      }
      return newTiles;
    });

    saveToStore();
  }, [selection, height, width, pushUndoState, saveToStore]);

  // Copy selection to clipboard
  const handleCopy = useCallback(() => {
    if (!selection) return;

    const minRow = Math.min(selection.startRow, selection.endRow);
    const maxRow = Math.max(selection.startRow, selection.endRow);
    const minCol = Math.min(selection.startCol, selection.endCol);
    const maxCol = Math.max(selection.startCol, selection.endCol);

    const clipboardTiles: TileEntry[][] = [];
    for (let r = minRow; r <= maxRow; r++) {
      const row: TileEntry[] = [];
      for (let c = minCol; c <= maxCol; c++) {
        row.push(cloneTile(tiles[r]?.[c] || createEmptyTile()));
      }
      clipboardTiles.push(row);
    }

    setClipboard({
      width: maxCol - minCol + 1,
      height: maxRow - minRow + 1,
      tiles: clipboardTiles,
    });
  }, [selection, tiles]);

  // Cut selection
  const handleCut = useCallback(() => {
    if (!selection) return;

    handleCopy();
    pushUndoState();

    const minRow = Math.min(selection.startRow, selection.endRow);
    const maxRow = Math.max(selection.startRow, selection.endRow);
    const minCol = Math.min(selection.startCol, selection.endCol);
    const maxCol = Math.max(selection.startCol, selection.endCol);

    setTiles(prev => {
      const newTiles = prev.map(r => r.map(t => cloneTile(t)));
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          if (r < height && c < width) {
            newTiles[r][c] = createEmptyTile();
          }
        }
      }
      return newTiles;
    });

    setSelection(null);
    saveToStore();
  }, [selection, height, width, handleCopy, pushUndoState, saveToStore]);

  // Start paste (show preview)
  const handlePaste = useCallback(() => {
    if (!clipboard) return;

    setPastePreview({
      row: 0,
      col: 0,
      data: clipboard.tiles,
    });
    setSelectedTool('select');
  }, [clipboard]);

  // Commit paste preview
  const handleCommitPaste = useCallback(() => {
    if (!pastePreview) return;

    pushUndoState();

    setTiles(prev => {
      const newTiles = prev.map(r => r.map(t => cloneTile(t)));
      for (let r = 0; r < pastePreview.data.length; r++) {
        for (let c = 0; c < pastePreview.data[r].length; c++) {
          const targetRow = pastePreview.row + r;
          const targetCol = pastePreview.col + c;
          if (targetRow >= 0 && targetRow < height && targetCol >= 0 && targetCol < width) {
            newTiles[targetRow][targetCol] = cloneTile(pastePreview.data[r][c]);
          }
        }
      }
      return newTiles;
    });

    setPastePreview(null);
    saveToStore();
  }, [pastePreview, height, width, pushUndoState, saveToStore]);

  // Handle move tool start
  const handleStartMove = useCallback(() => {
    if (!selection) return;

    // Copy selection to clipboard and clear
    handleCut();

    // Then start paste mode
    if (clipboard) {
      const minRow = Math.min(selection.startRow, selection.endRow);
      const minCol = Math.min(selection.startCol, selection.endCol);
      setPastePreview({
        row: minRow,
        col: minCol,
        data: clipboard.tiles,
      });
    }
  }, [selection, handleCut, clipboard]);

  // Get the selected tiles' common attributes for the attribute editor
  const selectedTilesAttributes = useMemo(() => {
    if (!selection) return null;

    const minRow = Math.min(selection.startRow, selection.endRow);
    const maxRow = Math.max(selection.startRow, selection.endRow);
    const minCol = Math.min(selection.startCol, selection.endCol);
    const maxCol = Math.max(selection.startCol, selection.endCol);

    let flipH: boolean | 'mixed' | undefined;
    let flipV: boolean | 'mixed' | undefined;
    let priority: boolean | 'mixed' | undefined;
    let palette: number | 'mixed' | undefined;
    let bankOffset: number | 'mixed' | undefined;
    let hasNonEmptyTile = false;

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const tile = tiles[r]?.[c];
        if (tile && tile.index !== 0) {
          hasNonEmptyTile = true;
          if (flipH === undefined) flipH = tile.flipH;
          else if (flipH !== tile.flipH) flipH = 'mixed';

          if (flipV === undefined) flipV = tile.flipV;
          else if (flipV !== tile.flipV) flipV = 'mixed';

          if (priority === undefined) priority = tile.priority;
          else if (priority !== tile.priority) priority = 'mixed';

          if (palette === undefined) palette = tile.palette;
          else if (palette !== tile.palette) palette = 'mixed';

          if (bankOffset === undefined) bankOffset = tile.bankOffset;
          else if (bankOffset !== tile.bankOffset) bankOffset = 'mixed';
        }
      }
    }

    if (!hasNonEmptyTile) return null;

    return { flipH, flipV, priority, palette, bankOffset };
  }, [selection, tiles]);

  // Handle gbin selection change - update config and mark dirty
  const handleGbinChange = useCallback((gbin: string | null) => {
    setSelectedGbin(gbin);
    setFileConfig(prev => ({
      ...prev,
      gbin: gbin || '',
      pbin: prev?.pbin || selectedPbin || '',
    }));
    markFileDirty(filePath, true);
  }, [selectedPbin, filePath, markFileDirty]);

  // Handle pbin selection change - update config and mark dirty
  const handlePbinChange = useCallback((pbin: string | null) => {
    setSelectedPbin(pbin);
    setFileConfig(prev => ({
      ...prev,
      gbin: prev?.gbin || selectedGbin || '',
      pbin: pbin || '',
    }));
    markFileDirty(filePath, true);
  }, [selectedGbin, filePath, markFileDirty]);

  // Handle sprite gbin selection change - update config and mark dirty
  const handleSpriteGbinChange = useCallback((gbin: string | null) => {
    setSelectedSpriteGbin(gbin);
    setFileConfig(prev => ({
      ...prev,
      gbin: prev?.gbin || selectedGbin || '',
      pbin: prev?.pbin || selectedPbin || '',
      spriteGbin: gbin || '',
    } as TilemapEditorFileConfig));
    markFileDirty(filePath, true);
  }, [selectedGbin, selectedPbin, filePath, markFileDirty]);

  // Handle sprite pbin selection change - update config and mark dirty
  const handleSpritePbinChange = useCallback((pbin: string | null) => {
    setSelectedSpritePbin(pbin);
    setFileConfig(prev => ({
      ...prev,
      gbin: prev?.gbin || selectedGbin || '',
      pbin: prev?.pbin || selectedPbin || '',
      spritePbin: pbin || '',
    } as TilemapEditorFileConfig));
    markFileDirty(filePath, true);
  }, [selectedGbin, selectedPbin, filePath, markFileDirty]);

  // ===== SPRITE MANIPULATION HANDLERS =====

  // Place a sprite at given position
  const handlePlaceSprite = useCallback((x: number, y: number) => {
    pushUndoState();
    const newSprite = createSprite(nextSpriteId, x, y, spriteToPlace, defaultSpriteAttrs);
    setSprites(prev => [...prev, newSprite]);
    setSelectedSpriteIds(new Set([nextSpriteId])); // Select the newly placed sprite
    setNextSpriteId(prev => prev + 1);
    saveToStore();
  }, [nextSpriteId, spriteToPlace, defaultSpriteAttrs, pushUndoState, saveToStore]);

  // Select a sprite by clicking
  const handleSelectSprite = useCallback((spriteId: number, addToSelection: boolean) => {
    if (addToSelection) {
      setSelectedSpriteIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(spriteId)) {
          newSet.delete(spriteId);
        } else {
          newSet.add(spriteId);
        }
        return newSet;
      });
    } else {
      setSelectedSpriteIds(new Set([spriteId]));
    }
  }, []);

  // Clear sprite selection
  const handleClearSpriteSelection = useCallback(() => {
    setSelectedSpriteIds(new Set());
  }, []);

  // Delete selected sprites
  const handleDeleteSprites = useCallback(() => {
    if (selectedSpriteIds.size === 0) return;
    pushUndoState();
    setSprites(prev => prev.filter(s => !selectedSpriteIds.has(s.id)));
    setSelectedSpriteIds(new Set());
    saveToStore();
  }, [selectedSpriteIds, pushUndoState, saveToStore]);

  // Move selected sprites
  const handleMoveSprites = useCallback((dx: number, dy: number) => {
    if (selectedSpriteIds.size === 0) return;
    setSprites(prev => prev.map(s => {
      if (selectedSpriteIds.has(s.id)) {
        return { ...s, x: Math.max(0, s.x + dx), y: Math.max(0, s.y + dy) };
      }
      return s;
    }));
  }, [selectedSpriteIds]);

  // Commit sprite move (for undo)
  const handleCommitSpriteMove = useCallback(() => {
    pushUndoState();
    saveToStore();
  }, [pushUndoState, saveToStore]);

  // Update sprite attributes
  const handleSpriteAttributeChange = useCallback((updates: Partial<LevelSprite>) => {
    if (selectedSpriteIds.size === 0) return;
    pushUndoState();
    setSprites(prev => prev.map(s => {
      if (selectedSpriteIds.has(s.id)) {
        return { ...s, ...updates };
      }
      return s;
    }));
    saveToStore();
  }, [selectedSpriteIds, pushUndoState, saveToStore]);

  // Update single sprite position
  const handleSpritePositionChange = useCallback((id: number, x: number, y: number) => {
    pushUndoState();
    setSprites(prev => prev.map(s => {
      if (s.id === id) {
        return { ...s, x, y };
      }
      return s;
    }));
    saveToStore();
  }, [pushUndoState, saveToStore]);

  // Copy selected sprites
  const handleCopySprites = useCallback(() => {
    const clip = cloneSpritesForClipboard(selectedSprites);
    if (clip) {
      setSpriteClipboard(clip);
    }
  }, [selectedSprites]);

  // Paste sprites
  const handlePasteSprites = useCallback((x: number, y: number) => {
    if (!spriteClipboard) return;
    pushUndoState();
    const newSprites = pasteSprites(spriteClipboard, x, y, sprites);
    setSprites(prev => [...prev, ...newSprites]);
    setNextSpriteId(prev => prev + newSprites.length);
    setSelectedSpriteIds(new Set(newSprites.map(s => s.id)));
    saveToStore();
  }, [spriteClipboard, sprites, pushUndoState, saveToStore]);

  // Handle mode change
  const handleModeChange = useCallback((mode: EditorMode) => {
    setEditorMode(mode);
    // Clear selections when switching modes
    if (mode === 'tile') {
      setSelectedSpriteIds(new Set());
    } else {
      setSelection(null);
      setPastePreview(null);
      setSpriteTool('place'); // Default to placement mode when entering sprite mode
    }
  }, []);

  // Expose the file config for saving (will be used by EditorContainer)
  // Store it on the window object so EditorContainer can access it
  useEffect(() => {
    (window as unknown as Record<string, unknown>)[`__tilemapFileConfig_${tbinName}`] = fileConfig;

    return () => {
      delete (window as unknown as Record<string, unknown>)[`__tilemapFileConfig_${tbinName}`];
    };
  }, [fileConfig, tbinName]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Global shortcuts
      if (modKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      } else if (modKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Mode switching
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        handleModeChange('tile');
        return;
      } else if (e.key === 's' && !modKey) {
        e.preventDefault();
        handleModeChange('sprite');
        return;
      }

      // Mode-specific shortcuts
      if (editorMode === 'tile') {
        // Tile mode shortcuts
        if (modKey && e.key === 'c') {
          e.preventDefault();
          handleCopy();
        } else if (modKey && e.key === 'x') {
          e.preventDefault();
          handleCut();
        } else if (modKey && e.key === 'v') {
          e.preventDefault();
          handlePaste();
        } else if (e.key === 'Escape') {
          setPastePreview(null);
          setSelection(null);
        }
      } else {
        // Sprite mode shortcuts
        if (modKey && e.key === 'c') {
          e.preventDefault();
          handleCopySprites();
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          handleDeleteSprites();
        } else if (e.key === 'Escape') {
          handleClearSpriteSelection();
        } else if (e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          setSpriteTool('place');
        } else if (e.key === 'm' || e.key === 'M') {
          e.preventDefault();
          setSpriteTool('select');
        } else if (e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          setSpriteTool('delete');
        } else if (e.key === 'h' || e.key === 'H') {
          // Flip selected sprites horizontal
          e.preventDefault();
          handleSpriteAttributeChange({ flipH: !selectedSprites[0]?.flipH });
        } else if (e.key === 'v' && !modKey) {
          // Flip selected sprites vertical (v without ctrl)
          e.preventDefault();
          handleSpriteAttributeChange({ flipV: !selectedSprites[0]?.flipV });
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          handleMoveSprites(0, e.shiftKey ? -8 : -1);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          handleMoveSprites(0, e.shiftKey ? 8 : 1);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          handleMoveSprites(e.shiftKey ? -8 : -1, 0);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          handleMoveSprites(e.shiftKey ? 8 : 1, 0);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleUndo, handleRedo, handleCopy, handleCut, handlePaste,
    handleCopySprites, handleDeleteSprites, handleClearSpriteSelection,
    handleSpriteAttributeChange, handleMoveSprites, handleModeChange,
    editorMode, selectedSprites
  ]);

  return (
    <div className="flex flex-col h-full bg-zinc-800">
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700 flex-shrink-0">
        <div className="flex items-center gap-4">
          {/* Mode-specific gbin/pbin selectors */}
          {editorMode === 'tile' ? (
            <>
              {/* Tile Gbin selector */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-zinc-400">Tile Graphics:</label>
                <select
                  value={selectedGbin || ''}
                  onChange={(e) => handleGbinChange(e.target.value || null)}
                  className="dk-input text-xs py-1 px-2 min-w-32"
                >
                  <option value="">Select gbin...</option>
                  {availableGbins.map(gbin => (
                    <option key={gbin} value={gbin}>{gbin}</option>
                  ))}
                </select>
              </div>

              {/* Tile Pbin selector */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-zinc-400">Palette:</label>
                <select
                  value={selectedPbin || ''}
                  onChange={(e) => handlePbinChange(e.target.value || null)}
                  className="dk-input text-xs py-1 px-2 min-w-32"
                >
                  <option value="">Select pbin...</option>
                  {availablePbins.map(pbin => (
                    <option key={pbin} value={pbin}>{pbin}</option>
                  ))}
                </select>
              </div>

              {/* Tile Palette block selector */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-zinc-400">Block:</label>
                <select
                  value={selectedPaletteBlock}
                  onChange={(e) => setSelectedPaletteBlock(Number(e.target.value))}
                  className="dk-input text-xs py-1 px-2"
                >
                  {[...Array(64)].map((_, i) => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              {/* Sprite Gbin selector */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-green-400">Sprite Graphics:</label>
                <select
                  value={selectedSpriteGbin || ''}
                  onChange={(e) => handleSpriteGbinChange(e.target.value || null)}
                  className="dk-input text-xs py-1 px-2 min-w-32"
                >
                  <option value="">Select gbin...</option>
                  {availableGbins.map(gbin => (
                    <option key={gbin} value={gbin}>{gbin}</option>
                  ))}
                </select>
              </div>

              {/* Sprite Pbin selector */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-green-400">Palette:</label>
                <select
                  value={selectedSpritePbin || ''}
                  onChange={(e) => handleSpritePbinChange(e.target.value || null)}
                  className="dk-input text-xs py-1 px-2 min-w-32"
                >
                  <option value="">Select pbin...</option>
                  {availablePbins.map(pbin => (
                    <option key={pbin} value={pbin}>{pbin}</option>
                  ))}
                </select>
              </div>

              {/* Sprite Palette block selector */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-green-400">Block:</label>
                <select
                  value={selectedSpritePaletteBlock}
                  onChange={(e) => setSelectedSpritePaletteBlock(Number(e.target.value))}
                  className="dk-input text-xs py-1 px-2"
                >
                  {[...Array(64)].map((_, i) => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </div>

              {/* Snap to grid toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={snapToGrid}
                  onChange={(e) => setSnapToGrid(e.target.checked)}
                  className="cursor-pointer"
                />
                <span className="text-xs text-green-400">Snap to grid</span>
              </label>
            </>
          )}

          {/* Dimensions / Resize dropdown */}
          <ResizeDropdown
            currentWidth={width}
            currentHeight={height}
            onResize={handleResize}
          />

          {/* Zoom */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-400">Zoom:</label>
            <select
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="dk-input text-xs py-1 px-2"
            >
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={4}>4x</option>
              <option value={8}>8x</option>
            </select>
          </div>

          {/* Cursor position */}
          <span className="text-xs text-zinc-500">
            Cursor: {cursorPos ? `${cursorPos.col}, ${cursorPos.row}` : '-, -'}
          </span>
        </div>

        {/* Right side: mode toggle, sprite count, undo/redo */}
        <div className="flex items-center gap-4">
          {/* Mode toggle */}
          <EditorModeToggle mode={editorMode} onChange={handleModeChange} />

          {/* Sprite count indicator */}
          <span className="text-xs text-zinc-500">
            Sprites: {sprites.length}
            {selectedSpriteIds.size > 0 && ` (${selectedSpriteIds.size} selected)`}
          </span>

          {/* Undo/redo */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="dk-btn-icon dk-btn-disabled"
              title="Undo (Ctrl+Z)"
            >
              <FontAwesomeIcon icon={faUndo} />
            </button>
            <button
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="dk-btn-icon dk-btn-disabled"
              title="Redo (Ctrl+Y)"
            >
              <FontAwesomeIcon icon={faRedo} />
            </button>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 min-h-0">
        <Allotment>
          {/* Left: Tool palette - switches based on mode */}
          <Allotment.Pane minSize={48} maxSize={48}>
            {editorMode === 'tile' ? (
              <TilemapToolPalette
                selectedTool={selectedTool}
                onToolChange={setSelectedTool}
                hasSelection={selection !== null}
                hasClipboard={clipboard !== null}
                onCopy={handleCopy}
                onCut={handleCut}
                onPaste={handlePaste}
              />
            ) : (
              <SpriteToolPalette
                selectedTool={spriteTool}
                onToolChange={setSpriteTool}
                hasSelection={selectedSpriteIds.size > 0}
                onDelete={handleDeleteSprites}
              />
            )}
          </Allotment.Pane>

          {/* Center: Canvas */}
          <Allotment.Pane>
            <div className="h-full overflow-auto bg-zinc-900">
              <TilemapCanvas
                tiles={tiles}
                width={width}
                height={height}
                zoom={zoom}
                gbinData={gbinData}
                pbinData={pbinData}
                selectedPaletteBlock={selectedPaletteBlock}
                spritePaletteConfigs={spritePaletteConfigs}
                selectedTool={selectedTool}
                selectedTileIndex={selectedTileIndex}
                selection={selection}
                onSelectionChange={setSelection}
                pastePreview={pastePreview}
                onPastePreviewChange={setPastePreview}
                onCommitPaste={handleCommitPaste}
                onTileChange={handleTileChange}
                onTilesChange={handleTilesChange}
                onOperationEnd={handleOperationEnd}
                onStartMove={handleStartMove}
                onCursorChange={setCursorPos}
                // Sprite props
                editorMode={editorMode}
                sprites={sprites}
                selectedSpriteIds={selectedSpriteIds}
                spriteTool={spriteTool}
                spriteToPlace={spriteToPlace}
                // Sprite graphics (separate from tile graphics)
                spriteGbinData={spriteGbinData}
                spritePbinData={spritePbinData}
                selectedSpritePaletteBlock={selectedSpritePaletteBlock}
                spriteGbinPaletteConfigs={spriteGbinPaletteConfigs}
                snapToGrid={snapToGrid}
                onPlaceSprite={handlePlaceSprite}
                onSelectSprite={handleSelectSprite}
                onClearSpriteSelection={handleClearSpriteSelection}
                onMoveSprites={handleMoveSprites}
                onCommitSpriteMove={handleCommitSpriteMove}
              />
            </div>
          </Allotment.Pane>

          {/* Right: Attribute editor and tile/sprite picker */}
          <Allotment.Pane minSize={200} preferredSize={280}>
            <div className="h-full border-l border-zinc-700 bg-zinc-800">
              <Allotment vertical>
                {/* Attribute editor - switches based on mode */}
                <Allotment.Pane minSize={120} preferredSize={200}>
                  <div className="h-full overflow-auto">
                    {editorMode === 'tile' ? (
                      <AttributeEditor
                        attributes={selectedTilesAttributes}
                        onAttributeChange={handleAttributeChange}
                      />
                    ) : (
                      <SpriteAttributeEditor
                        sprites={selectedSprites}
                        onChange={handleSpriteAttributeChange}
                        onPositionChange={handleSpritePositionChange}
                        onDelete={handleDeleteSprites}
                      />
                    )}
                  </div>
                </Allotment.Pane>

                {/* Tile/Sprite picker - switches based on mode */}
                <Allotment.Pane minSize={150}>
                  <div className="h-full border-t border-zinc-700 p-3 overflow-auto">
                    {editorMode === 'tile' ? (
                      <TilePicker
                        gbinData={gbinData}
                        pbinData={pbinData}
                        paletteBlockIndex={selectedPaletteBlock}
                        spritePaletteConfigs={spritePaletteConfigs}
                        selectedIndex={selectedTileIndex}
                        onSelect={setSelectedTileIndex}
                        showOnlyNonEmpty={showOnlyNonEmpty}
                        onShowOnlyNonEmptyChange={setShowOnlyNonEmpty}
                        showOnlyInPaletteRange={showOnlyInPaletteRange}
                        onShowOnlyInPaletteRangeChange={setShowOnlyInPaletteRange}
                      />
                    ) : (
                      <SpritePicker
                        gbinData={spriteGbinData}
                        pbinData={spritePbinData}
                        paletteBlockIndex={selectedSpritePaletteBlock}
                        spritePaletteConfigs={spriteGbinPaletteConfigs}
                        selectedIndex={spriteToPlace}
                        onSelect={setSpriteToPlace}
                      />
                    )}
                  </div>
                </Allotment.Pane>
              </Allotment>
            </div>
          </Allotment.Pane>
        </Allotment>
      </div>
    </div>
  );
}

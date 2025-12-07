import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { SYSTEM_PALETTE, rgbToString } from '../../../../../../console/src/systemPalette';
import type { TileEntry, TileSelection, PastePreview } from './TilemapEditor';
import type { TilemapTool } from './TilemapToolPalette';
import type { SpritePaletteConfig } from '../../../stores/devkitStore';

interface TilemapCanvasProps {
  tiles: TileEntry[][];
  width: number;
  height: number;
  zoom: number;
  gbinData: Uint8Array | null;
  pbinData: Uint8Array | null;
  selectedPaletteBlock: number;
  spritePaletteConfigs?: SpritePaletteConfig[];
  selectedTool: TilemapTool;
  selectedTileIndex: number;
  selection: TileSelection | null;
  onSelectionChange: (selection: TileSelection | null) => void;
  pastePreview: PastePreview | null;
  onPastePreviewChange: (preview: PastePreview | null) => void;
  onCommitPaste: () => void;
  onTileChange: (row: number, col: number, tileIndex: number) => void;
  onTilesChange: (changes: Array<{ row: number; col: number; tileIndex: number }>) => void;
  onOperationEnd: () => void;
  onStartMove: () => void;
  onCursorChange: (pos: { row: number; col: number } | null) => void;
}

const TILE_SIZE = 16; // 16x16 pixels per tile
const BYTES_PER_TILE_4BPP = 128;

// Checkerboard pattern colors for empty tiles
const CHECKER_LIGHT = '#2a2a2a';
const CHECKER_DARK = '#222222';

// Maximum canvas size to prevent browser issues
const MAX_CANVAS_SIZE = 2048;

export function TilemapCanvas({
  tiles,
  width,
  height,
  zoom,
  gbinData,
  pbinData,
  selectedPaletteBlock,
  spritePaletteConfigs,
  selectedTool,
  selectedTileIndex,
  selection,
  onSelectionChange,
  pastePreview,
  onPastePreviewChange,
  onCommitPaste,
  onTileChange,
  onTilesChange,
  onOperationEnd,
  onStartMove,
  onCursorChange,
}: TilemapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const tileAtlasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ row: number; col: number } | null>(null);
  const [hoverPos, setHoverPos] = useState<{ row: number; col: number } | null>(null);
  const [previewTiles, setPreviewTiles] = useState<Array<{ row: number; col: number }>>([]);
  const [isDraggingPaste, setIsDraggingPaste] = useState(false);
  const [pasteDragOffset, setPasteDragOffset] = useState<{ row: number; col: number } | null>(null);

  // Scroll state for virtualization
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(800);
  const [viewportHeight, setViewportHeight] = useState(600);

  const tilePixelSize = TILE_SIZE * zoom;

  // Full tilemap dimensions in pixels
  const fullWidth = width * tilePixelSize;
  const fullHeight = height * tilePixelSize;

  // Canvas dimensions - size of visible area, clamped to tilemap bounds and max canvas size
  // The canvas should never be larger than what's visible from the current scroll position
  const visibleWidth = Math.min(fullWidth - scrollLeft, viewportWidth);
  const visibleHeight = Math.min(fullHeight - scrollTop, viewportHeight);
  const canvasWidth = Math.min(Math.max(visibleWidth, 0), MAX_CANVAS_SIZE);
  const canvasHeight = Math.min(Math.max(visibleHeight, 0), MAX_CANVAS_SIZE);

  // Calculate visible tile range
  const visibleTiles = useMemo(() => {
    const startCol = Math.floor(scrollLeft / tilePixelSize);
    const startRow = Math.floor(scrollTop / tilePixelSize);
    const endCol = Math.min(width, Math.ceil((scrollLeft + canvasWidth) / tilePixelSize));
    const endRow = Math.min(height, Math.ceil((scrollTop + canvasHeight) / tilePixelSize));
    return { startCol, startRow, endCol, endRow };
  }, [scrollLeft, scrollTop, tilePixelSize, width, height, canvasWidth, canvasHeight]);

  // Handle scroll events
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setScrollLeft(target.scrollLeft);
    setScrollTop(target.scrollTop);
  }, []);

  // Track viewport size
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      setViewportWidth(container.clientWidth);
      setViewportHeight(container.clientHeight);
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Get the palette block for rendering a placed tile (uses the tile's stored palette attribute)
  const getPaletteBlockForPlacedTile = useCallback((tilePalette: number): number => {
    return selectedPaletteBlock + tilePalette;
  }, [selectedPaletteBlock]);

  // Get the palette block for rendering a tile in preview (from config, for tile picker preview)
  const getPaletteBlockForPreview = useCallback((tileIndex: number): number => {
    if (spritePaletteConfigs && spritePaletteConfigs[tileIndex]) {
      return spritePaletteConfigs[tileIndex].block;
    }
    return selectedPaletteBlock;
  }, [spritePaletteConfigs, selectedPaletteBlock]);

  // Build a tile atlas - pre-render all tiles at 1x to an offscreen canvas
  const tileAtlas = useMemo(() => {
    if (!gbinData) return null;

    // Create atlas canvas: 16 tiles per row, 16 rows = 256 tiles
    // Plus 4 palette variations (0-3) = 4 rows of 256 tiles each
    // Total: 16 tiles wide, 64 tiles tall (16 * 4 palette variations)
    const atlasCanvas = document.createElement('canvas');
    const atlasWidth = 16 * TILE_SIZE;
    const atlasHeight = 64 * TILE_SIZE; // 16 rows per palette block * 4 palette blocks
    atlasCanvas.width = atlasWidth;
    atlasCanvas.height = atlasHeight;

    const ctx = atlasCanvas.getContext('2d');
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = false;

    // Pre-render each tile for each palette (0-3)
    for (let paletteOffset = 0; paletteOffset < 4; paletteOffset++) {
      for (let tileIndex = 0; tileIndex < 256; tileIndex++) {
        const atlasRow = paletteOffset * 16 + Math.floor(tileIndex / 16);
        const atlasCol = tileIndex % 16;
        const x = atlasCol * TILE_SIZE;
        const y = atlasRow * TILE_SIZE;

        if (tileIndex === 0) {
          // Draw checkerboard for empty tile
          const checkerSize = 4;
          for (let cy = 0; cy < TILE_SIZE; cy += checkerSize) {
            for (let cx = 0; cx < TILE_SIZE; cx += checkerSize) {
              const isLight = ((cx / checkerSize) + (cy / checkerSize)) % 2 === 0;
              ctx.fillStyle = isLight ? CHECKER_LIGHT : CHECKER_DARK;
              ctx.fillRect(x + cx, y + cy, checkerSize, checkerSize);
            }
          }
        } else {
          // Fill background
          ctx.fillStyle = CHECKER_DARK;
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

          // Draw tile pixels
          const tileOffset = tileIndex * BYTES_PER_TILE_4BPP;
          const paletteBlock = selectedPaletteBlock + paletteOffset;

          for (let row = 0; row < TILE_SIZE; row++) {
            for (let col = 0; col < TILE_SIZE; col++) {
              const byteOffset = tileOffset + row * 8 + Math.floor(col / 2);
              const byteValue = gbinData[byteOffset] || 0;
              const colorIndex = col % 2 === 0 ? (byteValue >> 4) & 0x0F : byteValue & 0x0F;

              if (colorIndex === 0) continue;

              let color: string;
              if (pbinData) {
                const blockOffset = paletteBlock * 16;
                const systemPaletteIndex = pbinData[blockOffset + colorIndex] || 0;
                color = rgbToString(SYSTEM_PALETTE[systemPaletteIndex] || SYSTEM_PALETTE[0]);
              } else {
                color = rgbToString(SYSTEM_PALETTE[colorIndex] || SYSTEM_PALETTE[0]);
              }

              ctx.fillStyle = color;
              ctx.fillRect(x + col, y + row, 1, 1);
            }
          }
        }
      }
    }

    return atlasCanvas;
  }, [gbinData, pbinData, selectedPaletteBlock]);

  // Store atlas ref for use in callbacks
  useEffect(() => {
    tileAtlasRef.current = tileAtlas;
  }, [tileAtlas]);

  // Draw a tile from the atlas to the destination canvas
  const drawTileFromAtlas = useCallback((
    ctx: CanvasRenderingContext2D,
    tileIndex: number,
    palette: number,
    flipH: boolean,
    flipV: boolean,
    destX: number,
    destY: number,
    destSize: number,
    alpha: number = 1.0
  ) => {
    const atlas = tileAtlasRef.current;
    if (!atlas) return;

    // Calculate atlas position
    const atlasRow = palette * 16 + Math.floor(tileIndex / 16);
    const atlasCol = tileIndex % 16;
    const srcX = atlasCol * TILE_SIZE;
    const srcY = atlasRow * TILE_SIZE;

    ctx.globalAlpha = alpha;

    if (flipH || flipV) {
      ctx.save();
      ctx.translate(destX + destSize / 2, destY + destSize / 2);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.drawImage(
        atlas,
        srcX, srcY, TILE_SIZE, TILE_SIZE,
        -destSize / 2, -destSize / 2, destSize, destSize
      );
      ctx.restore();
    } else {
      ctx.drawImage(
        atlas,
        srcX, srcY, TILE_SIZE, TILE_SIZE,
        destX, destY, destSize, destSize
      );
    }

    ctx.globalAlpha = 1.0;
  }, []);

  // Draw the main tilemap canvas (only visible tiles)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !tileAtlas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    ctx.imageSmoothingEnabled = false;

    // Clear canvas
    ctx.fillStyle = CHECKER_DARK;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const { startCol, startRow, endCol, endRow } = visibleTiles;

    // Draw visible tiles from atlas
    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        const tile = tiles[row]?.[col];
        if (tile) {
          // Calculate position relative to canvas (accounting for scroll)
          const destX = col * tilePixelSize - scrollLeft;
          const destY = row * tilePixelSize - scrollTop;

          drawTileFromAtlas(
            ctx,
            tile.index,
            tile.palette,
            tile.flipH,
            tile.flipV,
            destX,
            destY,
            tilePixelSize
          );
        }
      }
    }

    // Draw grid (only for visible area)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;

    // Vertical lines
    for (let col = startCol; col <= endCol; col++) {
      const x = col * tilePixelSize - scrollLeft + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight);
      ctx.stroke();
    }

    // Horizontal lines
    for (let row = startRow; row <= endRow; row++) {
      const y = row * tilePixelSize - scrollTop + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
    }
  }, [tiles, width, height, tilePixelSize, tileAtlas, drawTileFromAtlas, visibleTiles, scrollLeft, scrollTop, canvasWidth, canvasHeight]);

  // Draw overlay (preview, selection, paste preview) - separate from main tilemap
  useEffect(() => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas) return;

    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) return;

    overlayCanvas.width = canvasWidth;
    overlayCanvas.height = canvasHeight;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Helper to convert tile coords to canvas coords
    const tileToCanvas = (row: number, col: number) => ({
      x: col * tilePixelSize - scrollLeft,
      y: row * tilePixelSize - scrollTop,
    });

    // Draw hover preview for pen/eraser
    if (hoverPos && !isDrawing && (selectedTool === 'pen' || selectedTool === 'eraser')) {
      const { row, col } = hoverPos;
      if (row >= 0 && row < height && col >= 0 && col < width) {
        const { x, y } = tileToCanvas(row, col);
        if (selectedTool === 'pen' && tileAtlasRef.current) {
          const previewPalette = spritePaletteConfigs?.[selectedTileIndex]?.block ?? 0;
          // Clamp preview palette to 0-3
          const clampedPalette = Math.min(3, Math.max(0, previewPalette));
          drawTileFromAtlas(
            ctx,
            selectedTileIndex,
            clampedPalette,
            false,
            false,
            x,
            y,
            tilePixelSize,
            0.6
          );
        } else if (selectedTool === 'eraser') {
          ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
          ctx.fillRect(x, y, tilePixelSize, tilePixelSize);
        }
      }
    }

    // Draw preview tiles (for line, rectangle tools while drawing)
    if (previewTiles.length > 0 && isDrawing) {
      if (selectedTool === 'line' || selectedTool === 'rectangle') {
        for (const { row, col } of previewTiles) {
          if (row >= 0 && row < height && col >= 0 && col < width && tileAtlasRef.current) {
            const { x, y } = tileToCanvas(row, col);
            const previewPalette = spritePaletteConfigs?.[selectedTileIndex]?.block ?? 0;
            const clampedPalette = Math.min(3, Math.max(0, previewPalette));
            drawTileFromAtlas(
              ctx,
              selectedTileIndex,
              clampedPalette,
              false,
              false,
              x,
              y,
              tilePixelSize,
              0.6
            );
          }
        }
      }
    }

    // Draw paste preview
    if (pastePreview && tileAtlasRef.current) {
      for (let r = 0; r < pastePreview.data.length; r++) {
        for (let c = 0; c < pastePreview.data[r].length; c++) {
          const targetRow = pastePreview.row + r;
          const targetCol = pastePreview.col + c;
          if (targetRow >= 0 && targetRow < height && targetCol >= 0 && targetCol < width) {
            const tile = pastePreview.data[r][c];
            const { x, y } = tileToCanvas(targetRow, targetCol);
            drawTileFromAtlas(
              ctx,
              tile.index,
              tile.palette,
              tile.flipH,
              tile.flipV,
              x,
              y,
              tilePixelSize,
              0.7
            );
          }
        }
      }

      // Draw paste preview border
      const { x, y } = tileToCanvas(pastePreview.row, pastePreview.col);
      ctx.strokeStyle = 'rgba(100, 255, 100, 0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(
        x,
        y,
        pastePreview.data[0].length * tilePixelSize,
        pastePreview.data.length * tilePixelSize
      );
      ctx.setLineDash([]);
    }

    // Draw selection rectangle
    if (selection) {
      const minRow = Math.min(selection.startRow, selection.endRow);
      const maxRow = Math.max(selection.startRow, selection.endRow);
      const minCol = Math.min(selection.startCol, selection.endCol);
      const maxCol = Math.max(selection.startCol, selection.endCol);

      const { x, y } = tileToCanvas(minRow, minCol);
      const selWidth = (maxCol - minCol + 1) * tilePixelSize;
      const selHeight = (maxRow - minRow + 1) * tilePixelSize;

      ctx.strokeStyle = 'rgba(100, 200, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x, y, selWidth, selHeight);
      ctx.setLineDash([]);

      // Fill selection with semi-transparent overlay
      ctx.fillStyle = 'rgba(100, 200, 255, 0.1)';
      ctx.fillRect(x, y, selWidth, selHeight);
    }
  }, [width, height, tilePixelSize, hoverPos, isDrawing, selectedTool, selectedTileIndex, previewTiles, pastePreview, selection, spritePaletteConfigs, drawTileFromAtlas, scrollLeft, scrollTop, canvasWidth, canvasHeight]);

  // Get tile position from mouse event (accounting for scroll)
  const getTilePos = useCallback((e: React.MouseEvent<HTMLCanvasElement>): { row: number; col: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { row: -1, col: -1 };

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollLeft;
    const y = e.clientY - rect.top + scrollTop;

    const col = Math.floor(x / tilePixelSize);
    const row = Math.floor(y / tilePixelSize);

    return { row, col };
  }, [tilePixelSize, scrollLeft, scrollTop]);

  // Check if point is inside paste preview
  const isInsidePastePreview = useCallback((row: number, col: number): boolean => {
    if (!pastePreview) return false;
    return (
      row >= pastePreview.row &&
      row < pastePreview.row + pastePreview.data.length &&
      col >= pastePreview.col &&
      col < pastePreview.col + pastePreview.data[0].length
    );
  }, [pastePreview]);

  // Check if point is inside selection
  const isInsideSelection = useCallback((row: number, col: number): boolean => {
    if (!selection) return false;
    const minRow = Math.min(selection.startRow, selection.endRow);
    const maxRow = Math.max(selection.startRow, selection.endRow);
    const minCol = Math.min(selection.startCol, selection.endCol);
    const maxCol = Math.max(selection.startCol, selection.endCol);
    return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
  }, [selection]);

  // Generate line tiles using Bresenham's algorithm
  const getLineTiles = useCallback((startRow: number, startCol: number, endRow: number, endCol: number): Array<{ row: number; col: number }> => {
    const result: Array<{ row: number; col: number }> = [];

    const dx = Math.abs(endCol - startCol);
    const dy = Math.abs(endRow - startRow);
    const sx = startCol < endCol ? 1 : -1;
    const sy = startRow < endRow ? 1 : -1;
    let err = dx - dy;

    let col = startCol;
    let row = startRow;

    while (true) {
      result.push({ row, col });

      if (col === endCol && row === endRow) break;

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        col += sx;
      }
      if (e2 < dx) {
        err += dx;
        row += sy;
      }
    }

    return result;
  }, []);

  // Generate rectangle tiles (outline)
  const getRectangleTiles = useCallback((startRow: number, startCol: number, endRow: number, endCol: number): Array<{ row: number; col: number }> => {
    const result: Array<{ row: number; col: number }> = [];
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);

    // Top and bottom edges
    for (let col = minCol; col <= maxCol; col++) {
      result.push({ row: minRow, col });
      if (minRow !== maxRow) {
        result.push({ row: maxRow, col });
      }
    }

    // Left and right edges (excluding corners)
    for (let row = minRow + 1; row < maxRow; row++) {
      result.push({ row, col: minCol });
      if (minCol !== maxCol) {
        result.push({ row, col: maxCol });
      }
    }

    return result;
  }, []);

  // Flood fill algorithm
  const getFloodFillTiles = useCallback((startRow: number, startCol: number, targetIndex: number, fillIndex: number): Array<{ row: number; col: number }> => {
    if (targetIndex === fillIndex) return [];

    const filled: Array<{ row: number; col: number }> = [];
    const visited = new Set<string>();
    const queue: Array<{ row: number; col: number }> = [{ row: startRow, col: startCol }];

    while (queue.length > 0) {
      const { row, col } = queue.shift()!;
      const key = `${row},${col}`;

      if (
        row < 0 || row >= height ||
        col < 0 || col >= width ||
        visited.has(key) ||
        tiles[row]?.[col]?.index !== targetIndex
      ) {
        continue;
      }

      visited.add(key);
      filled.push({ row, col });

      queue.push({ row: row - 1, col });
      queue.push({ row: row + 1, col });
      queue.push({ row, col: col - 1 });
      queue.push({ row, col: col + 1 });
    }

    return filled;
  }, [tiles, width, height]);

  // Handle mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { row, col } = getTilePos(e);
    if (row < 0 || row >= height || col < 0 || col >= width) return;

    // Check if clicking inside paste preview to start dragging
    if (pastePreview && isInsidePastePreview(row, col)) {
      setIsDraggingPaste(true);
      setPasteDragOffset({
        row: row - pastePreview.row,
        col: col - pastePreview.col,
      });
      return;
    }

    // If paste preview and clicking outside, commit it
    if (pastePreview && !isInsidePastePreview(row, col)) {
      onCommitPaste();
      return;
    }

    setIsDrawing(true);
    setStartPos({ row, col });

    if (selectedTool === 'pen') {
      onTileChange(row, col, selectedTileIndex);
    } else if (selectedTool === 'eraser') {
      onTileChange(row, col, 0);
    } else if (selectedTool === 'fill') {
      const targetIndex = tiles[row]?.[col]?.index ?? 0;
      const fillTiles = getFloodFillTiles(row, col, targetIndex, selectedTileIndex);
      if (fillTiles.length > 0) {
        const changes = fillTiles.map(({ row, col }) => ({
          row,
          col,
          tileIndex: selectedTileIndex,
        }));
        onTilesChange(changes);
        onOperationEnd();
      }
    } else if (selectedTool === 'select' || selectedTool === 'pointer') {
      onSelectionChange({ startRow: row, startCol: col, endRow: row, endCol: col });
    } else if (selectedTool === 'move' && selection && isInsideSelection(row, col)) {
      onStartMove();
      const minRow = Math.min(selection.startRow, selection.endRow);
      const minCol = Math.min(selection.startCol, selection.endCol);
      setIsDraggingPaste(true);
      setPasteDragOffset({
        row: row - minRow,
        col: col - minCol,
      });
    }
  }, [getTilePos, height, width, pastePreview, isInsidePastePreview, onCommitPaste, selectedTool, selectedTileIndex, onTileChange, tiles, getFloodFillTiles, onTilesChange, onOperationEnd, onSelectionChange, selection, isInsideSelection, onStartMove]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { row, col } = getTilePos(e);

    // Always update hover position for preview
    if (row >= 0 && row < height && col >= 0 && col < width) {
      setHoverPos({ row, col });
      onCursorChange({ row, col });
    } else {
      setHoverPos(null);
      onCursorChange(null);
    }

    if (row < 0 || row >= height || col < 0 || col >= width) {
      setPreviewTiles([]);
      return;
    }

    // Handle paste preview dragging
    if (isDraggingPaste && pastePreview && pasteDragOffset) {
      const newRow = row - pasteDragOffset.row;
      const newCol = col - pasteDragOffset.col;
      onPastePreviewChange({
        ...pastePreview,
        row: newRow,
        col: newCol,
      });
      return;
    }

    if (!isDrawing) {
      return;
    }

    if (selectedTool === 'pen') {
      onTileChange(row, col, selectedTileIndex);
    } else if (selectedTool === 'eraser') {
      onTileChange(row, col, 0);
    } else if (selectedTool === 'line' && startPos) {
      setPreviewTiles(getLineTiles(startPos.row, startPos.col, row, col));
    } else if (selectedTool === 'rectangle' && startPos) {
      setPreviewTiles(getRectangleTiles(startPos.row, startPos.col, row, col));
    } else if ((selectedTool === 'select' || selectedTool === 'pointer') && startPos) {
      onSelectionChange({ startRow: startPos.row, startCol: startPos.col, endRow: row, endCol: col });
    }
  }, [getTilePos, height, width, isDraggingPaste, pastePreview, pasteDragOffset, onPastePreviewChange, isDrawing, selectedTool, selectedTileIndex, onTileChange, startPos, getLineTiles, getRectangleTiles, onSelectionChange, onCursorChange]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (isDraggingPaste) {
      setIsDraggingPaste(false);
      setPasteDragOffset(null);
      return;
    }

    if (isDrawing && startPos && previewTiles.length > 0) {
      if (selectedTool === 'line' || selectedTool === 'rectangle') {
        const changes = previewTiles.map(({ row, col }) => ({
          row,
          col,
          tileIndex: selectedTileIndex,
        }));
        onTilesChange(changes);
      }
    }

    if (isDrawing) {
      onOperationEnd();
    }

    setIsDrawing(false);
    setStartPos(null);
    setPreviewTiles([]);
  }, [isDraggingPaste, isDrawing, startPos, previewTiles, selectedTool, selectedTileIndex, onTilesChange, onOperationEnd]);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    setHoverPos(null);
    setPreviewTiles([]);
    onCursorChange(null);
  }, [onCursorChange]);

  // Global mouse listeners for dragging outside canvas
  useEffect(() => {
    if (!isDrawing && !isDraggingPaste) return;

    const handleGlobalMouseUp = () => {
      handleMouseUp();
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDrawing, isDraggingPaste, handleMouseUp]);

  // Determine if we need to center (tilemap smaller than viewport)
  const needsCenteringH = fullWidth < viewportWidth;
  const needsCenteringV = fullHeight < viewportHeight;

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-auto"
      onScroll={handleScroll}
    >
      {/* Spacer div at full size for scroll bars, centered when smaller than viewport */}
      <div
        style={{
          width: needsCenteringH ? '100%' : fullWidth,
          height: needsCenteringV ? '100%' : fullHeight,
          minWidth: fullWidth,
          minHeight: fullHeight,
          position: 'relative',
          display: 'flex',
          justifyContent: needsCenteringH ? 'center' : 'flex-start',
          alignItems: needsCenteringV ? 'center' : 'flex-start',
        }}
      >
        {/* Canvas positioned at scroll offset, or centered when smaller */}
        <div
          style={{
            position: needsCenteringH || needsCenteringV ? 'relative' : 'sticky',
            left: needsCenteringH || needsCenteringV ? undefined : 0,
            top: needsCenteringH || needsCenteringV ? undefined : 0,
            width: needsCenteringH ? fullWidth : canvasWidth,
            height: needsCenteringV ? fullHeight : canvasHeight,
          }}
        >
          <canvas
            ref={canvasRef}
            className="border border-zinc-600"
            style={{ imageRendering: 'pixelated', position: 'absolute', left: 0, top: 0 }}
          />
          <canvas
            ref={overlayCanvasRef}
            className={`absolute top-0 left-0 border border-transparent ${pastePreview ? 'cursor-move' : 'cursor-crosshair'}`}
            style={{ imageRendering: 'pixelated' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          />
        </div>
      </div>
    </div>
  );
}

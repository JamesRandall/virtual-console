import { useRef, useState, useCallback, useEffect } from 'react';
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
}

const TILE_SIZE = 16; // 16x16 pixels per tile
const BYTES_PER_TILE_4BPP = 128;

// Checkerboard pattern colors for empty tiles
const CHECKER_LIGHT = '#2a2a2a';
const CHECKER_DARK = '#222222';

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
}: TilemapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ row: number; col: number } | null>(null);
  const [previewTiles, setPreviewTiles] = useState<Array<{ row: number; col: number }>>([]);
  const [isDraggingPaste, setIsDraggingPaste] = useState(false);
  const [pasteDragOffset, setPasteDragOffset] = useState<{ row: number; col: number } | null>(null);

  // Get the palette block for rendering a placed tile (uses the tile's stored palette attribute)
  const getPaletteBlockForPlacedTile = useCallback((tilePalette: number): number => {
    // Use the tile's stored palette attribute (0-3) directly
    // This is combined with selectedPaletteBlock as a base offset
    return selectedPaletteBlock + tilePalette;
  }, [selectedPaletteBlock]);

  // Get the palette block for rendering a tile in preview (from config, for tile picker preview)
  const getPaletteBlockForPreview = useCallback((tileIndex: number): number => {
    if (spritePaletteConfigs && spritePaletteConfigs[tileIndex]) {
      return spritePaletteConfigs[tileIndex].block;
    }
    return selectedPaletteBlock;
  }, [spritePaletteConfigs, selectedPaletteBlock]);

  // Get the actual RGB color for a palette index
  const getColor = useCallback((paletteIndex: number, paletteBlock: number): string => {
    if (!pbinData) {
      return rgbToString(SYSTEM_PALETTE[paletteIndex] || SYSTEM_PALETTE[0]);
    }
    const blockOffset = paletteBlock * 16;
    const systemPaletteIndex = pbinData[blockOffset + paletteIndex] || 0;
    return rgbToString(SYSTEM_PALETTE[systemPaletteIndex] || SYSTEM_PALETTE[0]);
  }, [pbinData]);

  // Get pixel color index from sprite/tile data
  const getPixelColorIndex = useCallback((tileIndex: number, row: number, col: number): number => {
    if (!gbinData || tileIndex === 0) return 0;

    const tileOffset = tileIndex * BYTES_PER_TILE_4BPP;
    const byteOffset = tileOffset + row * 8 + Math.floor(col / 2);
    const byteValue = gbinData[byteOffset] || 0;

    if (col % 2 === 0) {
      return (byteValue >> 4) & 0x0F;
    } else {
      return byteValue & 0x0F;
    }
  }, [gbinData]);

  // Draw a single tile to the canvas at a given position
  const drawTile = useCallback((
    ctx: CanvasRenderingContext2D,
    tile: TileEntry,
    x: number,
    y: number,
    tileZoom: number,
    alpha: number = 1.0,
    usePreviewPalette: boolean = false
  ) => {
    const pixelSize = tileZoom;
    const tilePixelSize = TILE_SIZE * pixelSize;

    ctx.globalAlpha = alpha;

    if (tile.index === 0) {
      // Draw checkerboard for empty tiles
      const checkerSize = Math.max(4, pixelSize * 2);
      for (let cy = 0; cy < tilePixelSize; cy += checkerSize) {
        for (let cx = 0; cx < tilePixelSize; cx += checkerSize) {
          const isLight = ((cx / checkerSize) + (cy / checkerSize)) % 2 === 0;
          ctx.fillStyle = isLight ? CHECKER_LIGHT : CHECKER_DARK;
          ctx.fillRect(x + cx, y + cy, checkerSize, checkerSize);
        }
      }
    } else {
      // Draw solid background first
      ctx.fillStyle = CHECKER_DARK;
      ctx.fillRect(x, y, tilePixelSize, tilePixelSize);

      // Draw tile pixels
      // For preview tiles (not yet placed), use config palette; for placed tiles, use stored palette
      const paletteBlock = usePreviewPalette
        ? getPaletteBlockForPreview(tile.index)
        : getPaletteBlockForPlacedTile(tile.palette);

      for (let row = 0; row < TILE_SIZE; row++) {
        for (let col = 0; col < TILE_SIZE; col++) {
          // Apply flip transformations
          const srcRow = tile.flipV ? (TILE_SIZE - 1 - row) : row;
          const srcCol = tile.flipH ? (TILE_SIZE - 1 - col) : col;

          const colorIndex = getPixelColorIndex(tile.index, srcRow, srcCol);
          if (colorIndex === 0) continue; // Skip transparent pixels

          ctx.fillStyle = getColor(colorIndex, paletteBlock);
          ctx.fillRect(x + col * pixelSize, y + row * pixelSize, pixelSize, pixelSize);
        }
      }
    }

    ctx.globalAlpha = 1.0;
  }, [getPixelColorIndex, getColor, getPaletteBlockForPlacedTile, getPaletteBlockForPreview]);

  // Draw the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const tilePixelSize = TILE_SIZE * zoom;
    const canvasWidth = width * tilePixelSize;
    const canvasHeight = height * tilePixelSize;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    ctx.imageSmoothingEnabled = false;

    // Draw all tiles
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const tile = tiles[row]?.[col];
        if (tile) {
          drawTile(ctx, tile, col * tilePixelSize, row * tilePixelSize, zoom);
        }
      }
    }

    // Draw preview tiles (for drawing tools)
    if (previewTiles.length > 0 && selectedTool !== 'eraser') {
      for (const { row, col } of previewTiles) {
        if (row >= 0 && row < height && col >= 0 && col < width) {
          const previewTile: TileEntry = {
            index: selectedTileIndex,
            flipH: false,
            flipV: false,
            priority: false,
            palette: 0,
            bankOffset: 0,
          };
          // Use preview palette (from config) for tiles being placed
          drawTile(ctx, previewTile, col * tilePixelSize, row * tilePixelSize, zoom, 0.6, true);
        }
      }
    }

    // Draw eraser preview
    if (previewTiles.length > 0 && selectedTool === 'eraser') {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
      for (const { row, col } of previewTiles) {
        if (row >= 0 && row < height && col >= 0 && col < width) {
          ctx.fillRect(col * tilePixelSize, row * tilePixelSize, tilePixelSize, tilePixelSize);
        }
      }
    }

    // Draw paste preview
    if (pastePreview) {
      for (let r = 0; r < pastePreview.data.length; r++) {
        for (let c = 0; c < pastePreview.data[r].length; c++) {
          const targetRow = pastePreview.row + r;
          const targetCol = pastePreview.col + c;
          if (targetRow >= 0 && targetRow < height && targetCol >= 0 && targetCol < width) {
            drawTile(
              ctx,
              pastePreview.data[r][c],
              targetCol * tilePixelSize,
              targetRow * tilePixelSize,
              zoom,
              0.7
            );
          }
        }
      }

      // Draw paste preview border
      ctx.strokeStyle = 'rgba(100, 255, 100, 0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(
        pastePreview.col * tilePixelSize,
        pastePreview.row * tilePixelSize,
        pastePreview.data[0].length * tilePixelSize,
        pastePreview.data.length * tilePixelSize
      );
      ctx.setLineDash([]);
    }

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= width; i++) {
      ctx.beginPath();
      ctx.moveTo(i * tilePixelSize + 0.5, 0);
      ctx.lineTo(i * tilePixelSize + 0.5, canvasHeight);
      ctx.stroke();
    }
    for (let i = 0; i <= height; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * tilePixelSize + 0.5);
      ctx.lineTo(canvasWidth, i * tilePixelSize + 0.5);
      ctx.stroke();
    }

    // Draw selection rectangle
    if (selection) {
      const minRow = Math.min(selection.startRow, selection.endRow);
      const maxRow = Math.max(selection.startRow, selection.endRow);
      const minCol = Math.min(selection.startCol, selection.endCol);
      const maxCol = Math.max(selection.startCol, selection.endCol);

      ctx.strokeStyle = 'rgba(100, 200, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(
        minCol * tilePixelSize,
        minRow * tilePixelSize,
        (maxCol - minCol + 1) * tilePixelSize,
        (maxRow - minRow + 1) * tilePixelSize
      );
      ctx.setLineDash([]);

      // Fill selection with semi-transparent overlay
      ctx.fillStyle = 'rgba(100, 200, 255, 0.1)';
      ctx.fillRect(
        minCol * tilePixelSize,
        minRow * tilePixelSize,
        (maxCol - minCol + 1) * tilePixelSize,
        (maxRow - minRow + 1) * tilePixelSize
      );
    }
  }, [tiles, width, height, zoom, previewTiles, selectedTool, selectedTileIndex, selection, pastePreview, drawTile]);

  // Get tile position from mouse event
  const getTilePos = useCallback((e: React.MouseEvent<HTMLCanvasElement>): { row: number; col: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { row: -1, col: -1 };

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const tilePixelSize = TILE_SIZE * zoom;
    const col = Math.floor(x / tilePixelSize);
    const row = Math.floor(y / tilePixelSize);

    return { row, col };
  }, [zoom]);

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
      // Show hover preview
      if (selectedTool === 'pen' || selectedTool === 'eraser') {
        setPreviewTiles([{ row, col }]);
      } else {
        setPreviewTiles([]);
      }
      return;
    }

    if (selectedTool === 'pen') {
      onTileChange(row, col, selectedTileIndex);
      setPreviewTiles([{ row, col }]);
    } else if (selectedTool === 'eraser') {
      onTileChange(row, col, 0);
      setPreviewTiles([{ row, col }]);
    } else if (selectedTool === 'line' && startPos) {
      setPreviewTiles(getLineTiles(startPos.row, startPos.col, row, col));
    } else if (selectedTool === 'rectangle' && startPos) {
      setPreviewTiles(getRectangleTiles(startPos.row, startPos.col, row, col));
    } else if ((selectedTool === 'select' || selectedTool === 'pointer') && startPos) {
      onSelectionChange({ startRow: startPos.row, startCol: startPos.col, endRow: row, endCol: col });
    }
  }, [getTilePos, height, width, isDraggingPaste, pastePreview, pasteDragOffset, onPastePreviewChange, isDrawing, selectedTool, selectedTileIndex, onTileChange, startPos, getLineTiles, getRectangleTiles, onSelectionChange]);

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
    setPreviewTiles([]);
  }, []);

  // Global mouse listeners for dragging outside canvas
  useEffect(() => {
    if (!isDrawing && !isDraggingPaste) return;

    const handleGlobalMouseUp = () => {
      handleMouseUp();
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDrawing, isDraggingPaste, handleMouseUp]);

  return (
    <div className="relative inline-block">
      <canvas
        ref={canvasRef}
        className={`border border-zinc-600 ${pastePreview ? 'cursor-move' : 'cursor-crosshair'}`}
        style={{ imageRendering: 'pixelated' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
}

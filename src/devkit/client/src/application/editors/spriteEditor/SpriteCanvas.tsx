import React, { useRef, useState, useCallback, useEffect } from 'react';
import { SYSTEM_PALETTE, rgbToString } from '../../../../../../console/src/systemPalette';
import { type Tool } from './ToolPalette';

interface SpriteCanvasProps {
  pixels: number[][];
  paletteData: Uint8Array | null;
  paletteBlockIndex: number;
  zoom: number;
  showTransparency: boolean;
  selectedTool: Tool;
  selectedColorIndex: number;
  onPixelChange: (row: number, col: number, colorIndex: number) => void;
  onPixelsChange: (changes: Array<{ row: number; col: number; colorIndex: number }>) => void;
  // Selection and clipboard props
  selection: { startRow: number; startCol: number; endRow: number; endCol: number } | null;
  onSelectionChange: (selection: { startRow: number; startCol: number; endRow: number; endCol: number } | null) => void;
  clipboard: number[][] | null;
  onClipboardChange: (clipboard: number[][] | null) => void;
  // Paste preview state
  pastePreview: { row: number; col: number; data: number[][] } | null;
  onPastePreviewChange: (preview: { row: number; col: number; data: number[][] } | null) => void;
  onCommitPaste: () => void;
  // Move selection callback
  onStartMove: () => void;
  // Called when a drawing operation ends (for undo tracking)
  onOperationEnd: () => void;
}

const SPRITE_WIDTH = 16;
const SPRITE_HEIGHT = 16;

// Checkerboard pattern colors for transparency
const CHECKER_LIGHT = '#404040';
const CHECKER_DARK = '#303030';
const CHECKER_SIZE = 8; // pixels per checker square

export function SpriteCanvas({
  pixels,
  paletteData,
  paletteBlockIndex,
  zoom,
  showTransparency,
  selectedTool,
  selectedColorIndex,
  onPixelChange,
  onPixelsChange,
  selection,
  onSelectionChange,
  pastePreview,
  onPastePreviewChange,
  onCommitPaste,
  onStartMove,
  onOperationEnd,
}: SpriteCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ row: number; col: number } | null>(null);
  const [previewPixels, setPreviewPixels] = useState<Array<{ row: number; col: number }>>([]);
  const [isDraggingPaste, setIsDraggingPaste] = useState(false);
  const [pasteDragOffset, setPasteDragOffset] = useState<{ row: number; col: number } | null>(null);

  // Get the actual RGB color for a palette index
  const getColor = useCallback((paletteIndex: number): string => {
    if (!paletteData) {
      // Fall back to system palette directly if no palette data
      return rgbToString(SYSTEM_PALETTE[paletteIndex] || SYSTEM_PALETTE[0]);
    }

    // Get the system palette index from the palette block
    const blockOffset = paletteBlockIndex * 16; // 16 colors per block in 4bpp
    const systemPaletteIndex = paletteData[blockOffset + paletteIndex] || 0;
    return rgbToString(SYSTEM_PALETTE[systemPaletteIndex] || SYSTEM_PALETTE[0]);
  }, [paletteData, paletteBlockIndex]);

  // Draw the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = SPRITE_WIDTH * zoom;
    const height = SPRITE_HEIGHT * zoom;

    canvas.width = width;
    canvas.height = height;

    // Disable image smoothing for crisp pixels
    ctx.imageSmoothingEnabled = false;

    // Draw checkerboard background if showing transparency
    if (showTransparency) {
      for (let y = 0; y < height; y += CHECKER_SIZE) {
        for (let x = 0; x < width; x += CHECKER_SIZE) {
          const isLight = ((x / CHECKER_SIZE) + (y / CHECKER_SIZE)) % 2 === 0;
          ctx.fillStyle = isLight ? CHECKER_LIGHT : CHECKER_DARK;
          ctx.fillRect(x, y, CHECKER_SIZE, CHECKER_SIZE);
        }
      }
    }

    // Draw pixels
    for (let row = 0; row < SPRITE_HEIGHT; row++) {
      for (let col = 0; col < SPRITE_WIDTH; col++) {
        const colorIndex = pixels[row][col];

        // Skip color 0 if showing transparency
        if (showTransparency && colorIndex === 0) continue;

        ctx.fillStyle = getColor(colorIndex);
        ctx.fillRect(col * zoom, row * zoom, zoom, zoom);
      }
    }

    // Draw preview pixels (for drawing tools)
    if (previewPixels.length > 0) {
      ctx.fillStyle = getColor(selectedColorIndex);
      ctx.globalAlpha = 0.5;
      for (const { row, col } of previewPixels) {
        if (row >= 0 && row < SPRITE_HEIGHT && col >= 0 && col < SPRITE_WIDTH) {
          ctx.fillRect(col * zoom, row * zoom, zoom, zoom);
        }
      }
      ctx.globalAlpha = 1.0;
    }

    // Draw paste preview
    if (pastePreview) {
      ctx.globalAlpha = 0.7;
      for (let r = 0; r < pastePreview.data.length; r++) {
        for (let c = 0; c < pastePreview.data[r].length; c++) {
          const targetRow = pastePreview.row + r;
          const targetCol = pastePreview.col + c;
          if (targetRow >= 0 && targetRow < SPRITE_HEIGHT && targetCol >= 0 && targetCol < SPRITE_WIDTH) {
            const colorIndex = pastePreview.data[r][c];
            if (!showTransparency || colorIndex !== 0) {
              ctx.fillStyle = getColor(colorIndex);
              ctx.fillRect(targetCol * zoom, targetRow * zoom, zoom, zoom);
            }
          }
        }
      }
      ctx.globalAlpha = 1.0;

      // Draw paste preview selection box
      ctx.strokeStyle = 'rgba(100, 255, 100, 0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(
        pastePreview.col * zoom,
        pastePreview.row * zoom,
        pastePreview.data[0].length * zoom,
        pastePreview.data.length * zoom
      );
      ctx.setLineDash([]);
    }

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= SPRITE_WIDTH; i++) {
      ctx.beginPath();
      ctx.moveTo(i * zoom + 0.5, 0);
      ctx.lineTo(i * zoom + 0.5, height);
      ctx.stroke();
    }
    for (let i = 0; i <= SPRITE_HEIGHT; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * zoom + 0.5);
      ctx.lineTo(width, i * zoom + 0.5);
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
        minCol * zoom,
        minRow * zoom,
        (maxCol - minCol + 1) * zoom,
        (maxRow - minRow + 1) * zoom
      );
      ctx.setLineDash([]);
    }
  }, [pixels, zoom, showTransparency, getColor, previewPixels, selectedColorIndex, selection, pastePreview]);

  // Get pixel position from mouse event
  const getPixelPos = useCallback((e: React.MouseEvent<HTMLCanvasElement>): { row: number; col: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { row: -1, col: -1 };

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const col = Math.floor(x / zoom);
    const row = Math.floor(y / zoom);

    return { row, col };
  }, [zoom]);

  // Check if a point is inside the paste preview
  const isInsidePastePreview = useCallback((row: number, col: number): boolean => {
    if (!pastePreview) return false;
    return (
      row >= pastePreview.row &&
      row < pastePreview.row + pastePreview.data.length &&
      col >= pastePreview.col &&
      col < pastePreview.col + pastePreview.data[0].length
    );
  }, [pastePreview]);

  // Check if a point is inside the selection
  const isInsideSelection = useCallback((row: number, col: number): boolean => {
    if (!selection) return false;
    const minRow = Math.min(selection.startRow, selection.endRow);
    const maxRow = Math.max(selection.startRow, selection.endRow);
    const minCol = Math.min(selection.startCol, selection.endCol);
    const maxCol = Math.max(selection.startCol, selection.endCol);
    return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
  }, [selection]);

  // Generate line pixels using Bresenham's algorithm
  const getLinePixels = useCallback((startRow: number, startCol: number, endRow: number, endCol: number): Array<{ row: number; col: number }> => {
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

  // Generate rectangle pixels (outline)
  const getRectanglePixels = useCallback((startRow: number, startCol: number, endRow: number, endCol: number): Array<{ row: number; col: number }> => {
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

    // Left and right edges (excluding corners already drawn)
    for (let row = minRow + 1; row < maxRow; row++) {
      result.push({ row, col: minCol });
      if (minCol !== maxCol) {
        result.push({ row, col: maxCol });
      }
    }

    return result;
  }, []);

  // Generate ellipse pixels from bounding box
  const getEllipsePixels = useCallback((startRow: number, startCol: number, endRow: number, endCol: number): Array<{ row: number; col: number }> => {
    const result: Array<{ row: number; col: number }> = [];
    const added = new Set<string>();

    // Calculate bounding box
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);

    const width = maxCol - minCol + 1;
    const height = maxRow - minRow + 1;

    // Handle degenerate cases (single point or lines)
    if (width === 1 && height === 1) {
      result.push({ row: minRow, col: minCol });
      return result;
    }

    if (width === 1) {
      // Vertical line
      for (let row = minRow; row <= maxRow; row++) {
        result.push({ row, col: minCol });
      }
      return result;
    }

    if (height === 1) {
      // Horizontal line
      for (let col = minCol; col <= maxCol; col++) {
        result.push({ row: minRow, col });
      }
      return result;
    }

    const addPixel = (row: number, col: number) => {
      if (row >= 0 && row < SPRITE_HEIGHT && col >= 0 && col < SPRITE_WIDTH) {
        const key = `${row},${col}`;
        if (!added.has(key)) {
          added.add(key);
          result.push({ row, col });
        }
      }
    };

    // Use parametric approach: sample the ellipse and plot outline pixels
    // Semi-axes (the ellipse touches the edges of the bounding box at center of edge pixels)
    const a = (width - 1) / 2;  // horizontal semi-axis
    const b = (height - 1) / 2; // vertical semi-axis
    const centerX = minCol + a;
    const centerY = minRow + b;

    // For each column in the bounding box, find the ellipse boundary rows
    for (let col = minCol; col <= maxCol; col++) {
      const x = col - centerX;
      // Ellipse equation: (x/a)^2 + (y/b)^2 = 1
      // Solve for y: y = b * sqrt(1 - (x/a)^2)
      const xNorm = x / a;
      if (Math.abs(xNorm) <= 1) {
        const yOffset = b * Math.sqrt(1 - xNorm * xNorm);
        const topRow = Math.round(centerY - yOffset);
        const bottomRow = Math.round(centerY + yOffset);
        addPixel(topRow, col);
        addPixel(bottomRow, col);
      }
    }

    // For each row in the bounding box, find the ellipse boundary columns
    for (let row = minRow; row <= maxRow; row++) {
      const y = row - centerY;
      // Solve for x: x = a * sqrt(1 - (y/b)^2)
      const yNorm = y / b;
      if (Math.abs(yNorm) <= 1) {
        const xOffset = a * Math.sqrt(1 - yNorm * yNorm);
        const leftCol = Math.round(centerX - xOffset);
        const rightCol = Math.round(centerX + xOffset);
        addPixel(row, leftCol);
        addPixel(row, rightCol);
      }
    }

    return result;
  }, []);

  // Flood fill algorithm using a queue-based approach
  const getFloodFillPixels = useCallback((startRow: number, startCol: number, targetColor: number, fillColor: number): Array<{ row: number; col: number }> => {
    // Don't fill if clicking on the same color
    if (targetColor === fillColor) {
      return [];
    }

    const filledPixels: Array<{ row: number; col: number }> = [];
    const visited = new Set<string>();
    const queue: Array<{ row: number; col: number }> = [{ row: startRow, col: startCol }];

    while (queue.length > 0) {
      const { row, col } = queue.shift()!;
      const key = `${row},${col}`;

      // Skip if out of bounds, already visited, or not the target color
      if (
        row < 0 || row >= SPRITE_HEIGHT ||
        col < 0 || col >= SPRITE_WIDTH ||
        visited.has(key) ||
        pixels[row][col] !== targetColor
      ) {
        continue;
      }

      visited.add(key);
      filledPixels.push({ row, col });

      // Add adjacent pixels to queue (4-connected)
      queue.push({ row: row - 1, col });
      queue.push({ row: row + 1, col });
      queue.push({ row, col: col - 1 });
      queue.push({ row, col: col + 1 });
    }

    return filledPixels;
  }, [pixels]);

  // Handle mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { row, col } = getPixelPos(e);
    if (row < 0 || row >= SPRITE_HEIGHT || col < 0 || col >= SPRITE_WIDTH) return;

    // Check if clicking inside paste preview to start dragging
    if (pastePreview && isInsidePastePreview(row, col)) {
      setIsDraggingPaste(true);
      setPasteDragOffset({
        row: row - pastePreview.row,
        col: col - pastePreview.col,
      });
      return;
    }

    // If there's a paste preview and we click outside it, commit the paste
    if (pastePreview && !isInsidePastePreview(row, col)) {
      onCommitPaste();
      return;
    }

    setIsDrawing(true);
    setStartPos({ row, col });

    if (selectedTool === 'pen' || selectedTool === 'eraser') {
      onPixelChange(row, col, selectedColorIndex);
    } else if (selectedTool === 'fill') {
      // Flood fill from clicked pixel
      const targetColor = pixels[row][col];
      const fillPixels = getFloodFillPixels(row, col, targetColor, selectedColorIndex);
      if (fillPixels.length > 0) {
        const changes = fillPixels.map(({ row, col }) => ({
          row,
          col,
          colorIndex: selectedColorIndex,
        }));
        onPixelsChange(changes);
      }
    } else if (selectedTool === 'select') {
      onSelectionChange({ startRow: row, startCol: col, endRow: row, endCol: col });
    } else if (selectedTool === 'move' && selection && isInsideSelection(row, col)) {
      // Start moving the selection - this will cut and create a paste preview
      onStartMove();
      // The parent will create a paste preview, then we start dragging it
      // We need to wait for the paste preview to be created, so we set the drag offset now
      const minRow = Math.min(selection.startRow, selection.endRow);
      const minCol = Math.min(selection.startCol, selection.endCol);
      setIsDraggingPaste(true);
      setPasteDragOffset({
        row: row - minRow,
        col: col - minCol,
      });
    }
  }, [getPixelPos, selectedTool, selectedColorIndex, onPixelChange, onPixelsChange, pixels, getFloodFillPixels, pastePreview, isInsidePastePreview, onCommitPaste, onSelectionChange, selection, isInsideSelection, onStartMove]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { row, col } = getPixelPos(e);
    if (row < 0 || row >= SPRITE_HEIGHT || col < 0 || col >= SPRITE_WIDTH) {
      setPreviewPixels([]);
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
      // Show hover preview for single pixel tools
      if (selectedTool === 'pen' || selectedTool === 'eraser') {
        setPreviewPixels([{ row, col }]);
      } else {
        setPreviewPixels([]);
      }
      return;
    }

    if (selectedTool === 'pen' || selectedTool === 'eraser') {
      // Draw continuously
      onPixelChange(row, col, selectedColorIndex);
      setPreviewPixels([{ row, col }]);
    } else if (selectedTool === 'line' && startPos) {
      setPreviewPixels(getLinePixels(startPos.row, startPos.col, row, col));
    } else if (selectedTool === 'rectangle' && startPos) {
      setPreviewPixels(getRectanglePixels(startPos.row, startPos.col, row, col));
    } else if (selectedTool === 'ellipse' && startPos) {
      setPreviewPixels(getEllipsePixels(startPos.row, startPos.col, row, col));
    } else if (selectedTool === 'select' && startPos) {
      onSelectionChange({ startRow: startPos.row, startCol: startPos.col, endRow: row, endCol: col });
    }
  }, [getPixelPos, isDrawing, selectedTool, selectedColorIndex, onPixelChange, startPos, getLinePixels, getRectanglePixels, getEllipsePixels, isDraggingPaste, pastePreview, pasteDragOffset, onPastePreviewChange, onSelectionChange]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (isDraggingPaste) {
      setIsDraggingPaste(false);
      setPasteDragOffset(null);
      return;
    }

    if (isDrawing && startPos && previewPixels.length > 0) {
      if (selectedTool === 'line' || selectedTool === 'rectangle' || selectedTool === 'ellipse') {
        const changes = previewPixels.map(({ row, col }) => ({
          row,
          col,
          colorIndex: selectedColorIndex,
        }));
        onPixelsChange(changes);
      }
    }

    // Signal end of operation for undo tracking
    if (isDrawing) {
      onOperationEnd();
    }

    setIsDrawing(false);
    setStartPos(null);
    setPreviewPixels([]);
  }, [isDrawing, startPos, previewPixels, selectedTool, selectedColorIndex, onPixelsChange, isDraggingPaste, onOperationEnd]);

  // Handle mouse leave - just clear preview, don't release the tool
  const handleMouseLeave = useCallback(() => {
    setPreviewPixels([]);
  }, []);

  // Add global mouse listeners when drawing to track mouse outside canvas
  useEffect(() => {
    if (!isDrawing && !isDraggingPaste) return;

    const handleGlobalMouseUp = () => {
      handleMouseUp();
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      // Create a synthetic event-like object with clientX/clientY
      const syntheticEvent = {
        clientX: e.clientX,
        clientY: e.clientY,
        currentTarget: canvas,
      } as React.MouseEvent<HTMLCanvasElement>;

      // Check if mouse is within canvas bounds for actual pixel operations
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const pixelSize = zoom;
      const col = Math.floor(x / pixelSize);
      const row = Math.floor(y / pixelSize);

      // Only process if within bounds or for preview updates
      if (row >= 0 && row < SPRITE_HEIGHT && col >= 0 && col < SPRITE_WIDTH) {
        handleMouseMove(syntheticEvent);
      } else {
        // Outside bounds - update preview for shape tools to show clamped preview
        if (startPos && (selectedTool === 'line' || selectedTool === 'rectangle' || selectedTool === 'ellipse')) {
          // Clamp to canvas bounds for preview
          const clampedRow = Math.max(0, Math.min(SPRITE_HEIGHT - 1, row));
          const clampedCol = Math.max(0, Math.min(SPRITE_WIDTH - 1, col));

          if (selectedTool === 'line') {
            setPreviewPixels(getLinePixels(startPos.row, startPos.col, clampedRow, clampedCol));
          } else if (selectedTool === 'rectangle') {
            setPreviewPixels(getRectanglePixels(startPos.row, startPos.col, clampedRow, clampedCol));
          } else if (selectedTool === 'ellipse') {
            setPreviewPixels(getEllipsePixels(startPos.row, startPos.col, clampedRow, clampedCol));
          }
        } else if (isDraggingPaste && pastePreview && pasteDragOffset) {
          // Handle paste dragging outside canvas
          const newRow = row - pasteDragOffset.row;
          const newCol = col - pasteDragOffset.col;
          onPastePreviewChange({
            ...pastePreview,
            row: newRow,
            col: newCol,
          });
        }
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('mousemove', handleGlobalMouseMove);

    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, [isDrawing, isDraggingPaste, handleMouseUp, handleMouseMove, zoom, startPos, selectedTool, getLinePixels, getRectanglePixels, getEllipsePixels, pastePreview, pasteDragOffset, onPastePreviewChange]);

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

import { useRef, useEffect, useCallback, useState } from 'react';
import { SYSTEM_PALETTE, rgbToString } from '../../../../console/src/systemPalette';
import type { SpritePaletteConfig } from '../stores/devkitStore';

interface SpritePickerProps {
  // The raw gbin data (32KB Uint8Array) or base64 encoded string
  gbinData: Uint8Array | string;
  // Palette data for rendering colors
  paletteData: Uint8Array | null;
  // Default palette block to use (0-63 for 4bpp) when no config exists for a sprite
  paletteBlockIndex: number;
  // Per-sprite palette configurations from config.json
  spritePaletteConfigs?: SpritePaletteConfig[];
  // Currently selected sprite index
  selectedIndex: number;
  // Callback when a sprite is selected
  onSelect: (index: number) => void;
  // Number of sprites to show (default 256)
  spriteCount?: number;
  // Initial zoom level (default 2)
  initialZoom?: number;
  // Whether to show transparency as checkerboard
  showTransparency?: boolean;
  // Optional max height for the container
  maxHeight?: number;
}

const SPRITE_WIDTH = 16;
const SPRITE_HEIGHT = 16;
const BYTES_PER_SPRITE_4BPP = 128;
const SPRITES_PER_ROW_OPTIONS = [4, 8, 16];

// Checkerboard pattern colors for transparency
const CHECKER_LIGHT = '#404040';
const CHECKER_DARK = '#303030';

export function SpritePicker({
  gbinData,
  paletteData,
  paletteBlockIndex,
  spritePaletteConfigs,
  selectedIndex,
  onSelect,
  spriteCount = 256,
  initialZoom = 2,
  showTransparency = true,
  maxHeight = 300,
}: SpritePickerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(initialZoom);
  const [spritesPerRow, setSpritesPerRow] = useState(8);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Convert base64 to Uint8Array if needed
  const data = typeof gbinData === 'string'
    ? (() => {
        try {
          const binaryString = atob(gbinData);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          return bytes;
        } catch {
          return new Uint8Array(32768);
        }
      })()
    : gbinData;

  // Get the palette block index for a specific sprite
  const getPaletteBlockForSprite = useCallback((spriteIndex: number): number => {
    if (spritePaletteConfigs && spritePaletteConfigs[spriteIndex]) {
      return spritePaletteConfigs[spriteIndex].block;
    }
    return paletteBlockIndex;
  }, [spritePaletteConfigs, paletteBlockIndex]);

  // Get the actual RGB color for a palette index, using the correct block for the sprite
  const getColor = useCallback((paletteIndex: number, spriteIndex: number): string => {
    if (!paletteData) {
      return rgbToString(SYSTEM_PALETTE[paletteIndex] || SYSTEM_PALETTE[0]);
    }
    const blockIndex = getPaletteBlockForSprite(spriteIndex);
    const blockOffset = blockIndex * 16;
    const systemPaletteIndex = paletteData[blockOffset + paletteIndex] || 0;
    return rgbToString(SYSTEM_PALETTE[systemPaletteIndex] || SYSTEM_PALETTE[0]);
  }, [paletteData, getPaletteBlockForSprite]);

  // Get pixel color index from sprite data
  const getPixelColorIndex = useCallback((spriteIndex: number, row: number, col: number): number => {
    const spriteOffset = spriteIndex * BYTES_PER_SPRITE_4BPP;
    const byteOffset = spriteOffset + row * 8 + Math.floor(col / 2);
    const byteValue = data[byteOffset] || 0;

    if (col % 2 === 0) {
      return (byteValue >> 4) & 0x0F;
    } else {
      return byteValue & 0x0F;
    }
  }, [data]);

  // Draw the sprite grid
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const spriteSize = SPRITE_WIDTH * zoom;
    const numRows = Math.ceil(spriteCount / spritesPerRow);
    const totalWidth = spritesPerRow * spriteSize;
    const totalHeight = numRows * spriteSize;

    canvas.width = totalWidth;
    canvas.height = totalHeight;

    ctx.imageSmoothingEnabled = false;

    // Draw each sprite
    for (let i = 0; i < spriteCount; i++) {
      const gridRow = Math.floor(i / spritesPerRow);
      const gridCol = i % spritesPerRow;
      const startX = gridCol * spriteSize;
      const startY = gridRow * spriteSize;

      // Draw checkerboard background if showing transparency
      if (showTransparency) {
        const checkerSize = Math.max(2, zoom);
        for (let cy = 0; cy < spriteSize; cy += checkerSize) {
          for (let cx = 0; cx < spriteSize; cx += checkerSize) {
            const isLight = ((cx / checkerSize) + (cy / checkerSize)) % 2 === 0;
            ctx.fillStyle = isLight ? CHECKER_LIGHT : CHECKER_DARK;
            ctx.fillRect(startX + cx, startY + cy, checkerSize, checkerSize);
          }
        }
      } else {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(startX, startY, spriteSize, spriteSize);
      }

      // Draw sprite pixels
      for (let row = 0; row < SPRITE_HEIGHT; row++) {
        for (let col = 0; col < SPRITE_WIDTH; col++) {
          const colorIndex = getPixelColorIndex(i, row, col);
          if (showTransparency && colorIndex === 0) continue;

          ctx.fillStyle = getColor(colorIndex, i);
          ctx.fillRect(
            startX + col * zoom,
            startY + row * zoom,
            zoom,
            zoom
          );
        }
      }

      // Draw selection/hover highlight
      if (i === selectedIndex) {
        ctx.strokeStyle = 'rgba(100, 200, 255, 0.9)';
        ctx.lineWidth = 2;
        ctx.strokeRect(startX + 1, startY + 1, spriteSize - 2, spriteSize - 2);
      } else if (i === hoveredIndex) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(startX + 0.5, startY + 0.5, spriteSize - 1, spriteSize - 1);
      }

      // Draw grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.strokeRect(startX + 0.5, startY + 0.5, spriteSize - 1, spriteSize - 1);
    }
  }, [data, paletteData, paletteBlockIndex, spritePaletteConfigs, zoom, spritesPerRow, spriteCount, selectedIndex, hoveredIndex, showTransparency, getColor, getPixelColorIndex]);

  // Handle canvas click
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const spriteSize = SPRITE_WIDTH * zoom;
    const col = Math.floor(x / spriteSize);
    const row = Math.floor(y / spriteSize);
    const index = row * spritesPerRow + col;

    if (index >= 0 && index < spriteCount) {
      onSelect(index);
    }
  }, [zoom, spritesPerRow, spriteCount, onSelect]);

  // Handle mouse move for hover effect
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const spriteSize = SPRITE_WIDTH * zoom;
    const col = Math.floor(x / spriteSize);
    const row = Math.floor(y / spriteSize);
    const index = row * spritesPerRow + col;

    if (index >= 0 && index < spriteCount) {
      setHoveredIndex(index);
    } else {
      setHoveredIndex(null);
    }
  }, [zoom, spritesPerRow, spriteCount]);

  const handleMouseLeave = useCallback(() => {
    setHoveredIndex(null);
  }, []);

  return (
    <div className="flex flex-col dk-gap-compact">
      {/* Controls */}
      <div className="flex items-center dk-gap-compact flex-wrap">
        <div className="flex items-center dk-gap-tight">
          <span className="dk-label text-xs">Zoom:</span>
          <select
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="dk-input text-xs py-0.5 px-1"
          >
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={3}>3x</option>
            <option value={4}>4x</option>
          </select>
        </div>

        <div className="flex items-center dk-gap-tight">
          <span className="dk-label text-xs">Columns:</span>
          <select
            value={spritesPerRow}
            onChange={(e) => setSpritesPerRow(Number(e.target.value))}
            className="dk-input text-xs py-0.5 px-1"
          >
            {SPRITES_PER_ROW_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Sprite grid */}
      <div
        ref={containerRef}
        className="overflow-auto border border-zinc-600 rounded"
        style={{ maxHeight }}
      >
        <canvas
          ref={canvasRef}
          className="cursor-pointer"
          style={{ imageRendering: 'pixelated' }}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
      </div>

      {/* Selected sprite info */}
      <div className="flex justify-between dk-tertiary-text text-xs">
        <span>Selected: Sprite {selectedIndex}</span>
        {hoveredIndex !== null && (
          <span>Hover: Sprite {hoveredIndex}</span>
        )}
      </div>
    </div>
  );
}

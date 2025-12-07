import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { SYSTEM_PALETTE, rgbToString } from '../../../../../../console/src/systemPalette';
import type { SpritePaletteConfig } from '../../../stores/devkitStore';

interface TilePickerProps {
  gbinData: Uint8Array | null;
  pbinData: Uint8Array | null;
  paletteBlockIndex: number;
  spritePaletteConfigs?: SpritePaletteConfig[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  showOnlyNonEmpty: boolean;
  onShowOnlyNonEmptyChange: (show: boolean) => void;
  showOnlyInPaletteRange: boolean;
  onShowOnlyInPaletteRangeChange: (show: boolean) => void;
}

const TILE_SIZE = 16;
const BYTES_PER_TILE_4BPP = 128;

// Checkerboard pattern colors for transparency
const CHECKER_LIGHT = '#404040';
const CHECKER_DARK = '#303030';

// Individual tile component that renders to a small canvas
function TileCanvas({
  tileIndex,
  gbinData,
  pbinData,
  paletteBlockIndex,
  spritePaletteConfigs,
  isSelected,
  isHovered,
  zoom,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: {
  tileIndex: number;
  gbinData: Uint8Array;
  pbinData: Uint8Array | null;
  paletteBlockIndex: number;
  spritePaletteConfigs?: SpritePaletteConfig[];
  isSelected: boolean;
  isHovered: boolean;
  zoom: number;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Get palette block for this tile
  const paletteBlock = useMemo(() => {
    if (spritePaletteConfigs && spritePaletteConfigs[tileIndex]) {
      return spritePaletteConfigs[tileIndex].block;
    }
    return paletteBlockIndex;
  }, [spritePaletteConfigs, tileIndex, paletteBlockIndex]);

  // Draw the tile
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = TILE_SIZE * zoom;
    canvas.width = size;
    canvas.height = size;

    ctx.imageSmoothingEnabled = false;

    // Draw checkerboard background
    const checkerSize = Math.max(2, zoom);
    for (let cy = 0; cy < size; cy += checkerSize) {
      for (let cx = 0; cx < size; cx += checkerSize) {
        const isLight = ((cx / checkerSize) + (cy / checkerSize)) % 2 === 0;
        ctx.fillStyle = isLight ? CHECKER_LIGHT : CHECKER_DARK;
        ctx.fillRect(cx, cy, checkerSize, checkerSize);
      }
    }

    // Draw tile pixels
    const tileOffset = tileIndex * BYTES_PER_TILE_4BPP;
    for (let row = 0; row < TILE_SIZE; row++) {
      for (let col = 0; col < TILE_SIZE; col++) {
        const byteOffset = tileOffset + row * 8 + Math.floor(col / 2);
        const byteValue = gbinData[byteOffset] || 0;
        const colorIndex = col % 2 === 0 ? (byteValue >> 4) & 0x0F : byteValue & 0x0F;

        if (colorIndex === 0) continue; // Skip transparent

        // Get color from palette
        let color: string;
        if (pbinData) {
          const blockOffset = paletteBlock * 16;
          const systemPaletteIndex = pbinData[blockOffset + colorIndex] || 0;
          color = rgbToString(SYSTEM_PALETTE[systemPaletteIndex] || SYSTEM_PALETTE[0]);
        } else {
          color = rgbToString(SYSTEM_PALETTE[colorIndex] || SYSTEM_PALETTE[0]);
        }

        ctx.fillStyle = color;
        ctx.fillRect(col * zoom, row * zoom, zoom, zoom);
      }
    }
  }, [tileIndex, gbinData, pbinData, paletteBlock, zoom]);

  const size = TILE_SIZE * zoom;

  return (
    <div
      className={`
        relative cursor-pointer flex-shrink-0
        ${isSelected ? 'ring-2 ring-blue-400' : isHovered ? 'ring-1 ring-white/50' : ''}
      `}
      style={{ width: size, height: size }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      <canvas
        ref={canvasRef}
        style={{ imageRendering: 'pixelated', width: size, height: size }}
      />
    </div>
  );
}

export function TilePicker({
  gbinData,
  pbinData,
  paletteBlockIndex,
  spritePaletteConfigs,
  selectedIndex,
  onSelect,
  showOnlyNonEmpty,
  onShowOnlyNonEmptyChange,
  showOnlyInPaletteRange,
  onShowOnlyInPaletteRangeChange,
}: TilePickerProps) {
  const [zoom, setZoom] = useState(2);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Convert base64 to Uint8Array if needed
  const data = useMemo(() => {
    if (!gbinData) return new Uint8Array(32768);
    if (typeof gbinData === 'string') {
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
    }
    return gbinData;
  }, [gbinData]);

  // Determine which tiles are non-empty
  const nonEmptyTiles = useMemo(() => {
    const nonEmpty: number[] = [];
    for (let i = 0; i < 256; i++) {
      const tileOffset = i * BYTES_PER_TILE_4BPP;
      let hasPixels = false;
      for (let j = 0; j < BYTES_PER_TILE_4BPP; j++) {
        if (data[tileOffset + j] !== 0) {
          hasPixels = true;
          break;
        }
      }
      if (hasPixels || i === 0) {
        nonEmpty.push(i);
      }
    }
    return nonEmpty;
  }, [data]);

  // Determine which tiles are in palette range 0-3
  const tilesInPaletteRange = useMemo(() => {
    const inRange: number[] = [];
    for (let i = 0; i < 256; i++) {
      const paletteBlock = spritePaletteConfigs?.[i]?.block ?? 0;
      if (paletteBlock >= 0 && paletteBlock <= 3) {
        inRange.push(i);
      }
    }
    return inRange;
  }, [spritePaletteConfigs]);

  // Get tiles to display based on filters
  const tilesToDisplay = useMemo(() => {
    let tiles = [...Array(256)].map((_, i) => i);

    if (showOnlyNonEmpty) {
      tiles = tiles.filter(i => nonEmptyTiles.includes(i));
    }

    if (showOnlyInPaletteRange) {
      tiles = tiles.filter(i => tilesInPaletteRange.includes(i));
    }

    return tiles;
  }, [showOnlyNonEmpty, nonEmptyTiles, showOnlyInPaletteRange, tilesInPaletteRange]);

  const handleMouseEnter = useCallback((index: number) => {
    setHoveredIndex(index);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredIndex(null);
  }, []);

  if (!gbinData) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
          Select a graphics file (.gbin) to see tiles
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Controls */}
      <div className="flex items-center gap-4 flex-wrap flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">Zoom:</span>
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

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showOnlyNonEmpty}
            onChange={(e) => onShowOnlyNonEmptyChange(e.target.checked)}
            className="cursor-pointer"
          />
          <span className="text-xs text-zinc-400">Non-empty only</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showOnlyInPaletteRange}
            onChange={(e) => onShowOnlyInPaletteRangeChange(e.target.checked)}
            className="cursor-pointer"
          />
          <span className="text-xs text-zinc-400">Palette 0-3 only</span>
        </label>

        <div className="flex-1" />

        <span className="text-xs text-zinc-500">
          Selected: {selectedIndex} | Hover: {hoveredIndex ?? '-'}
          {showOnlyNonEmpty && ` | ${nonEmptyTiles.length} tiles`}
        </span>
      </div>

      {/* Tile grid - flows and wraps naturally, scrolls within parent */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="flex flex-wrap gap-0.5 content-start">
          {tilesToDisplay.map((tileIndex) => (
            <TileCanvas
              key={tileIndex}
              tileIndex={tileIndex}
              gbinData={data}
              pbinData={pbinData}
              paletteBlockIndex={paletteBlockIndex}
              spritePaletteConfigs={spritePaletteConfigs}
              isSelected={tileIndex === selectedIndex}
              isHovered={tileIndex === hoveredIndex}
              zoom={zoom}
              onMouseEnter={() => handleMouseEnter(tileIndex)}
              onMouseLeave={handleMouseLeave}
              onClick={() => onSelect(tileIndex)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

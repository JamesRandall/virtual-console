/**
 * TilemapEngine handles tilemap rendering
 *
 * Implements scanline-based rendering matching the hardware specification:
 * - 16x16 pixel tiles at 4bpp
 * - 16-bit scroll registers for large maps
 * - Per-tile attributes (flip, palette, priority, bank offset)
 * - Tile animation support
 * - Horizontal/vertical wrapping modes
 */

import { BankedMemory } from './bankedMemory';

// Hardware register addresses (matching tilemap.md spec)
export const TILEMAP_ENABLE = 0x013d;
export const TILEMAP_GRAPHICS_BANK = 0x013e;
export const TILEMAP_X_SCROLL_LO = 0x013f;
export const TILEMAP_X_SCROLL_HI = 0x0140;
export const TILEMAP_Y_SCROLL_LO = 0x0141;
export const TILEMAP_Y_SCROLL_HI = 0x0142;
export const TILEMAP_WIDTH = 0x0143;
export const TILEMAP_HEIGHT = 0x0144;
export const TILEMAP_DATA_BANK = 0x0145;
export const TILEMAP_ADDR_HI = 0x0146;
export const TILEMAP_ADDR_LO = 0x0147;
export const TILE_ANIM_FRAME = 0x0148;

// Tile properties table
export const TILE_PROPERTIES_START = 0x0a80;
export const TILE_PROPERTIES_END = 0x0aff;

// Palette RAM
export const PALETTE_RAM_START = 0x0200;

// Tile constants
export const TILE_SIZE = 16; // 16x16 pixels
export const TILE_BYTES_4BPP = 128; // 16x16 / 2

// Tile property flags
export const TILE_SOLID = 0x80;
export const TILE_HAZARD = 0x40;
export const TILE_ANIMATED = 0x10;
export const TILE_ANIM_SPEED_MASK = 0x0c;
export const TILE_ANIM_SPEED_SHIFT = 2;
export const TILE_ANIM_FRAMES_MASK = 0x03;

// TILEMAP_ENABLE flags
export const TILEMAP_FLAG_ENABLE = 0x01;
export const TILEMAP_FLAG_WRAP_H = 0x02;
export const TILEMAP_FLAG_WRAP_V = 0x04;
export const TILEMAP_FLAG_PRIORITY_MODE = 0x08;

// Tile attribute flags
export const TILE_ATTR_FLIP_H = 0x80;
export const TILE_ATTR_FLIP_V = 0x40;
export const TILE_ATTR_PRIORITY = 0x20;
export const TILE_ATTR_PALETTE_MASK = 0x18;
export const TILE_ATTR_PALETTE_SHIFT = 3;
export const TILE_ATTR_BANK_MASK = 0x03;

// Empty tile index (transparent)
export const EMPTY_TILE_INDEX = 0;

/**
 * Tile entry data structure
 */
export interface TileEntry {
  tileIndex: number;
  attributes: number;
  flipH: boolean;
  flipV: boolean;
  priority: boolean;
  paletteOffset: number;
  bankOffset: number;
}

export class TilemapEngine {
  private readonly lowerMemory: Uint8Array;
  private readonly bankedMemory: BankedMemory;
  private readonly scanlineBuffer: Uint8Array;
  private readonly priorityBuffer: Uint8Array;

  constructor(lowerMemory: Uint8Array, bankedMemory: BankedMemory, maxScreenWidth: number = 256) {
    this.lowerMemory = lowerMemory;
    this.bankedMemory = bankedMemory;
    this.scanlineBuffer = new Uint8Array(maxScreenWidth);
    this.priorityBuffer = new Uint8Array(maxScreenWidth);
  }

  /**
   * Check if tilemap is enabled
   */
  isEnabled(): boolean {
    return (this.lowerMemory[TILEMAP_ENABLE] & TILEMAP_FLAG_ENABLE) !== 0;
  }

  /**
   * Get enable flags
   */
  getEnableFlags(): number {
    return this.lowerMemory[TILEMAP_ENABLE];
  }

  /**
   * Get 16-bit X scroll value
   */
  getScrollX(): number {
    const lo = this.lowerMemory[TILEMAP_X_SCROLL_LO];
    const hi = this.lowerMemory[TILEMAP_X_SCROLL_HI];
    return (hi << 8) | lo;
  }

  /**
   * Get 16-bit Y scroll value
   */
  getScrollY(): number {
    const lo = this.lowerMemory[TILEMAP_Y_SCROLL_LO];
    const hi = this.lowerMemory[TILEMAP_Y_SCROLL_HI];
    return (hi << 8) | lo;
  }

  /**
   * Get tilemap width in tiles
   */
  getWidth(): number {
    return this.lowerMemory[TILEMAP_WIDTH];
  }

  /**
   * Get tilemap height in tiles
   */
  getHeight(): number {
    return this.lowerMemory[TILEMAP_HEIGHT];
  }

  /**
   * Get the graphics bank number
   */
  getGraphicsBank(): number {
    return this.lowerMemory[TILEMAP_GRAPHICS_BANK];
  }

  /**
   * Get the data bank number
   */
  getDataBank(): number {
    return this.lowerMemory[TILEMAP_DATA_BANK];
  }

  /**
   * Get 16-bit tilemap data address
   */
  getDataAddress(): number {
    const hi = this.lowerMemory[TILEMAP_ADDR_HI];
    const lo = this.lowerMemory[TILEMAP_ADDR_LO];
    return (hi << 8) | lo;
  }

  /**
   * Get animation frame counter
   */
  getAnimFrame(): number {
    return this.lowerMemory[TILE_ANIM_FRAME];
  }

  /**
   * Get tile properties from the properties table
   */
  getTileProperties(tileIndex: number): number {
    return this.lowerMemory[TILE_PROPERTIES_START + (tileIndex & 0x7f)];
  }

  /**
   * Read a tile entry from the tilemap
   *
   * @param tileX - Tile X coordinate
   * @param tileY - Tile Y coordinate
   * @returns TileEntry or null if out of bounds
   */
  readTileEntry(tileX: number, tileY: number): TileEntry | null {
    const width = this.getWidth();
    const height = this.getHeight();
    const flags = this.getEnableFlags();

    // Apply wrapping if enabled
    if (flags & TILEMAP_FLAG_WRAP_H) {
      tileX = ((tileX % width) + width) % width;
    } else if (tileX < 0 || tileX >= width) {
      return null; // Out of bounds
    }

    if (flags & TILEMAP_FLAG_WRAP_V) {
      tileY = ((tileY % height) + height) % height;
    } else if (tileY < 0 || tileY >= height) {
      return null;
    }

    // Calculate offset: (y * width + x) * 2
    const tileOffset = (tileY * width + tileX) * 2;
    const baseAddr = this.getDataAddress();
    const bank = this.getDataBank();

    const tileIndex = this.bankedMemory.readBank(bank, baseAddr + tileOffset);
    const attributes = this.bankedMemory.readBank(bank, baseAddr + tileOffset + 1);

    return {
      tileIndex,
      attributes,
      flipH: (attributes & TILE_ATTR_FLIP_H) !== 0,
      flipV: (attributes & TILE_ATTR_FLIP_V) !== 0,
      priority: (attributes & TILE_ATTR_PRIORITY) !== 0,
      paletteOffset: (attributes & TILE_ATTR_PALETTE_MASK) >> TILE_ATTR_PALETTE_SHIFT,
      bankOffset: attributes & TILE_ATTR_BANK_MASK,
    };
  }

  /**
   * Get animated tile index based on animation frame
   */
  getAnimatedTileIndex(baseTile: number, properties: number): number {
    const animFrame = this.getAnimFrame();

    // Get frame count (0=2, 1=4, 2=8, 3=16)
    const frameCountCode = properties & TILE_ANIM_FRAMES_MASK;
    const frameCount = 2 << frameCountCode; // 2, 4, 8, or 16

    // Get animation speed (0-3)
    const speed = (properties & TILE_ANIM_SPEED_MASK) >> TILE_ANIM_SPEED_SHIFT;

    // Calculate current frame based on global animation counter and speed
    // Higher speed value = slower animation (more frames to skip)
    const frameIndex = (animFrame >> speed) % frameCount;

    // Animation frames are sequential tiles starting from baseTile
    return baseTile + frameIndex;
  }

  /**
   * Fetch a pixel from tile graphics
   */
  fetchTilePixel(
    bank: number,
    tileIndex: number,
    x: number,
    y: number,
    flipH: boolean,
    flipV: boolean
  ): number {
    // Apply flipping
    const pixelX = flipH ? TILE_SIZE - 1 - x : x;
    const pixelY = flipV ? TILE_SIZE - 1 - y : y;

    // Calculate offset within tile graphics
    // Row-major, 8 bytes per row (16 pixels at 4bpp)
    const tileOffset = tileIndex * TILE_BYTES_4BPP;
    const rowOffset = pixelY * (TILE_SIZE / 2);
    const byteOffset = Math.floor(pixelX / 2);

    const byte = this.bankedMemory.readBank(bank, tileOffset + rowOffset + byteOffset);

    // Extract nibble (high nibble = even pixel, low nibble = odd pixel)
    if (pixelX % 2 === 0) {
      return (byte >> 4) & 0x0f;
    } else {
      return byte & 0x0f;
    }
  }

  /**
   * Render a single scanline to the internal buffer
   *
   * @param scanline - Current scanline (0-159 for Mode 0)
   * @param screenWidth - Screen width in pixels
   * @returns Scanline buffer with master palette indices (0 = transparent)
   */
  renderScanline(scanline: number, screenWidth: number): Uint8Array {
    this.scanlineBuffer.fill(0);
    this.priorityBuffer.fill(0);

    if (!this.isEnabled()) {
      return this.scanlineBuffer.subarray(0, screenWidth);
    }

    const scrollX = this.getScrollX();
    const scrollY = this.getScrollY();
    const graphicsBank = this.getGraphicsBank();

    // Calculate world Y coordinate
    const worldY = scanline + scrollY;
    const tileY = Math.floor(worldY / TILE_SIZE);
    const pixelY = worldY % TILE_SIZE;

    for (let screenX = 0; screenX < screenWidth; screenX++) {
      // Calculate world X coordinate
      const worldX = screenX + scrollX;
      const tileX = Math.floor(worldX / TILE_SIZE);
      const pixelX = worldX % TILE_SIZE;

      // Get tile entry
      const tile = this.readTileEntry(tileX, tileY);
      if (tile === null) {
        continue; // Out of bounds, leave transparent
      }

      // Tile index 0 = empty/transparent
      if (tile.tileIndex === EMPTY_TILE_INDEX) {
        continue;
      }

      // Apply animation if tile is animated
      let finalTileIndex = tile.tileIndex;
      const props = this.getTileProperties(tile.tileIndex);
      if (props & TILE_ANIMATED) {
        finalTileIndex = this.getAnimatedTileIndex(tile.tileIndex, props);
      }

      // Calculate graphics bank with per-tile offset
      const bank = graphicsBank + tile.bankOffset;

      // Fetch pixel from tile graphics
      const pixel = this.fetchTilePixel(bank, finalTileIndex, pixelX, pixelY, tile.flipH, tile.flipV);

      // Transparency check
      if (pixel === 0) {
        continue;
      }

      // Apply palette offset and resolve to master palette index
      const paletteBaseIndex = tile.paletteOffset * 16 + pixel;
      const masterPaletteIndex = this.lowerMemory[PALETTE_RAM_START + paletteBaseIndex];

      this.scanlineBuffer[screenX] = masterPaletteIndex;
      this.priorityBuffer[screenX] = tile.priority ? 1 : 0;
    }

    return this.scanlineBuffer.subarray(0, screenWidth);
  }

  /**
   * Get the priority buffer for the last rendered scanline
   * 0 = behind sprites, 1 = in front of sprites
   */
  getPriorityBuffer(): Uint8Array {
    return this.priorityBuffer;
  }

  /**
   * Get tile at world coordinates (for collision detection)
   *
   * @param worldX - World X coordinate in pixels
   * @param worldY - World Y coordinate in pixels
   * @returns TileEntry or null if out of bounds
   */
  getTileAt(worldX: number, worldY: number): TileEntry | null {
    const tileX = Math.floor(worldX / TILE_SIZE);
    const tileY = Math.floor(worldY / TILE_SIZE);
    return this.readTileEntry(tileX, tileY);
  }

  /**
   * Get tile at tile coordinates (for collision detection)
   */
  getTileAtTileCoord(tileX: number, tileY: number): TileEntry | null {
    return this.readTileEntry(tileX, tileY);
  }

  /**
   * Decode a tile to RGBA for visualization
   */
  decodeTileToRGBA(
    tileIndex: number,
    bank: number,
    palette: readonly [number, number, number][]
  ): Uint8ClampedArray {
    const rgba = new Uint8ClampedArray(TILE_SIZE * TILE_SIZE * 4);

    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        const pixel = this.fetchTilePixel(bank, tileIndex, x, y, false, false);
        const [r, g, b] = palette[pixel] || [0, 0, 0];

        const offset = (y * TILE_SIZE + x) * 4;
        rgba[offset] = r;
        rgba[offset + 1] = g;
        rgba[offset + 2] = b;
        rgba[offset + 3] = pixel === 0 ? 0 : 255; // Transparent if color 0
      }
    }

    return rgba;
  }
}

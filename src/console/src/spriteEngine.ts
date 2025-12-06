/**
 * SpriteEngine handles sprite rendering and collision detection
 *
 * Implements scanline-based rendering matching the hardware specification:
 * - 128 total sprites
 * - 8 sprites per scanline (configurable up to 16)
 * - 16x16 pixels at 4bpp or 8bpp
 * - Per-sprite banking
 * - Hardware collision detection
 */

import { BankedMemory } from './bankedMemory';

// Hardware register addresses
export const SPRITE_ENABLE = 0x0104;
export const SPRITE_COUNT = 0x0105;
export const SPRITE_GRAPHICS_BANK = 0x0106;
export const SPRITE_OVERFLOW = 0x0107;
export const COLLISION_FLAGS = 0x0108;
export const COLLISION_COUNT = 0x0109;
export const COLLISION_MODE = 0x010a;
export const SPRITE_SCANLINE_LIMIT = 0x010b;

// Memory layout
export const SPRITE_TABLE_START = 0x0700;
export const SPRITE_TABLE_END = 0x097f;
export const COLLISION_BUFFER_START = 0x0980;
export const COLLISION_BUFFER_END = 0x0a7f;

// Sprite constants
export const MAX_SPRITES = 128;
export const SPRITE_SIZE = 16; // 16x16 pixels
export const SPRITE_BYTES_4BPP = 128; // 16x16 / 2
export const SPRITE_BYTES_8BPP = 256; // 16x16 x 1
export const DEFAULT_SCANLINE_LIMIT = 8;
export const MAX_SCANLINE_LIMIT = 16;
export const MAX_COLLISIONS = 85;

// Sprite attribute offsets
export const SPRITE_ATTR_X = 0;
export const SPRITE_ATTR_Y = 1;
export const SPRITE_ATTR_IDX = 2;
export const SPRITE_ATTR_FLAGS = 3;
export const SPRITE_ATTR_BANK = 4;
export const SPRITE_ATTR_SIZE = 5;

// Sprite flags bit masks
export const FLAG_FLIP_H = 0x80;
export const FLAG_FLIP_V = 0x40;
export const FLAG_PRIORITY_BEHIND = 0x20;
export const FLAG_PALETTE_MASK = 0x18;
export const FLAG_PALETTE_SHIFT = 3;

// Collision mode bits
export const COLLISION_SPRITE_SPRITE = 0x01;
export const COLLISION_SPRITE_TILE = 0x02;
export const COLLISION_PIXEL_PERFECT = 0x04;

// Collision type flags
export const COLLISION_TYPE_SPRITE = 0x00;
export const COLLISION_TYPE_TILE = 0x80;

// Collision side bits
export const COLLISION_SIDE_TOP = 0x08;
export const COLLISION_SIDE_BOTTOM = 0x04;
export const COLLISION_SIDE_LEFT = 0x02;
export const COLLISION_SIDE_RIGHT = 0x01;

/**
 * Sprite attribute data structure
 */
export interface SpriteAttribute {
  x: number;
  y: number;
  spriteIndex: number;
  flags: number;
  bank: number;

  // Derived properties
  flipH: boolean;
  flipV: boolean;
  priorityBehind: boolean;
  paletteOffset: number;
}

/**
 * Collision entry data structure
 */
export interface CollisionEntry {
  spriteId: number;
  data: number; // Other sprite ID or tile type
  typeFlags: number; // Bit 7: type, bits 3-0: sides
}

/**
 * Sprite visible on a scanline
 */
export interface ActiveSprite {
  id: number;
  sprite: SpriteAttribute;
  row: number; // Which row of sprite to render (0-15)
  lineData: Uint8Array; // Pre-fetched row pixel data
}

export class SpriteEngine {
  private readonly lowerMemory: Uint8Array;
  private readonly bankedMemory: BankedMemory;

  // Per-frame state
  private frameCollisions: CollisionEntry[] = [];
  private overflowOccurred: boolean = false;

  // Pre-allocated buffers for performance
  private readonly scanlineBuffer: Uint8Array;
  private readonly spriteIdBuffer: Int16Array;

  constructor(lowerMemory: Uint8Array, bankedMemory: BankedMemory, maxScreenWidth: number = 256) {
    this.lowerMemory = lowerMemory;
    this.bankedMemory = bankedMemory;
    this.scanlineBuffer = new Uint8Array(maxScreenWidth);
    this.spriteIdBuffer = new Int16Array(maxScreenWidth);
  }

  /**
   * Check if sprites are enabled
   */
  isEnabled(): boolean {
    return (this.lowerMemory[SPRITE_ENABLE] & 0x01) !== 0;
  }

  /**
   * Get the number of active sprites
   */
  getSpriteCount(): number {
    return Math.min(this.lowerMemory[SPRITE_COUNT], MAX_SPRITES);
  }

  /**
   * Get the per-scanline sprite limit
   */
  getScanlineLimit(): number {
    const limit = this.lowerMemory[SPRITE_SCANLINE_LIMIT];
    if (limit === 0) return DEFAULT_SCANLINE_LIMIT;
    return Math.min(limit, MAX_SCANLINE_LIMIT);
  }

  /**
   * Get collision detection mode
   */
  getCollisionMode(): number {
    return this.lowerMemory[COLLISION_MODE];
  }

  /**
   * Read sprite attributes from memory
   */
  readSpriteAttribute(spriteId: number): SpriteAttribute {
    const baseAddr = SPRITE_TABLE_START + spriteId * SPRITE_ATTR_SIZE;

    const x = this.lowerMemory[baseAddr + SPRITE_ATTR_X];
    const y = this.lowerMemory[baseAddr + SPRITE_ATTR_Y];
    const spriteIndex = this.lowerMemory[baseAddr + SPRITE_ATTR_IDX];
    const flags = this.lowerMemory[baseAddr + SPRITE_ATTR_FLAGS];
    const bank = this.lowerMemory[baseAddr + SPRITE_ATTR_BANK];

    return {
      x,
      y,
      spriteIndex,
      flags,
      bank,
      flipH: (flags & FLAG_FLIP_H) !== 0,
      flipV: (flags & FLAG_FLIP_V) !== 0,
      priorityBehind: (flags & FLAG_PRIORITY_BEHIND) !== 0,
      paletteOffset: (flags & FLAG_PALETTE_MASK) >> FLAG_PALETTE_SHIFT,
    };
  }

  /**
   * Reset frame state - called at start of each frame
   */
  resetFrame(): void {
    this.frameCollisions = [];
    this.overflowOccurred = false;

    // Clear collision flags and count
    this.lowerMemory[COLLISION_FLAGS] = 0;
    this.lowerMemory[COLLISION_COUNT] = 0;
    this.lowerMemory[SPRITE_OVERFLOW] = 0;
  }

  /**
   * Finalize frame - write collision data to buffer
   */
  finalizeFrame(): void {
    // Write overflow flag
    if (this.overflowOccurred) {
      this.lowerMemory[SPRITE_OVERFLOW] = 0x01;
    }

    // Write collision data to buffer
    const collisionCount = Math.min(this.frameCollisions.length, MAX_COLLISIONS);
    this.lowerMemory[COLLISION_COUNT] = collisionCount;

    for (let i = 0; i < collisionCount; i++) {
      const entry = this.frameCollisions[i];
      const addr = COLLISION_BUFFER_START + i * 3;
      this.lowerMemory[addr] = entry.spriteId;
      this.lowerMemory[addr + 1] = entry.data;
      this.lowerMemory[addr + 2] = entry.typeFlags;
    }

    // Update collision flags
    if (this.frameCollisions.length > 0) {
      let flags = 0;
      for (const entry of this.frameCollisions) {
        if ((entry.typeFlags & COLLISION_TYPE_TILE) !== 0) {
          flags |= 0x02; // Sprite-tile collision
        } else {
          flags |= 0x01; // Sprite-sprite collision
        }
      }
      this.lowerMemory[COLLISION_FLAGS] = flags;
    }
  }

  /**
   * Evaluate which sprites intersect a scanline
   *
   * @param scanline - Current scanline (0-159 for Mode 0)
   * @returns Array of active sprites, limited by scanline limit
   */
  evaluateSprites(scanline: number): ActiveSprite[] {
    if (!this.isEnabled()) {
      return [];
    }

    const spriteCount = this.getSpriteCount();
    const scanlineLimit = this.getScanlineLimit();
    const activeSprites: ActiveSprite[] = [];

    for (let id = 0; id < spriteCount; id++) {
      const sprite = this.readSpriteAttribute(id);

      // Check if sprite intersects this scanline
      // Y position is top of sprite, sprite extends 16 pixels down
      if (scanline >= sprite.y && scanline < sprite.y + SPRITE_SIZE) {
        // Calculate which row of sprite to render
        let row = scanline - sprite.y;

        // Apply vertical flip
        if (sprite.flipV) {
          row = SPRITE_SIZE - 1 - row;
        }

        // Fetch row data from sprite's bank
        const lineData = this.fetchSpriteRow(sprite, row);

        activeSprites.push({
          id,
          sprite,
          row,
          lineData,
        });

        // Check scanline limit
        if (activeSprites.length >= scanlineLimit) {
          this.overflowOccurred = true;
          break; // Stop evaluation (authentic behavior)
        }
      }
    }

    return activeSprites;
  }

  /**
   * Fetch a single row of sprite pixel data from memory
   *
   * @param sprite - Sprite attributes
   * @param row - Row within sprite (0-15)
   * @returns 8 bytes of pixel data (16 pixels at 4bpp)
   */
  fetchSpriteRow(sprite: SpriteAttribute, row: number): Uint8Array {
    const bytesPerRow = SPRITE_SIZE / 2; // 8 bytes for 16 pixels at 4bpp
    const spriteOffset = sprite.spriteIndex * SPRITE_BYTES_4BPP;
    const rowOffset = row * bytesPerRow;

    const lineData = new Uint8Array(bytesPerRow);

    for (let i = 0; i < bytesPerRow; i++) {
      const offset = spriteOffset + rowOffset + i;
      lineData[i] = this.bankedMemory.readBank(sprite.bank, offset);
    }

    return lineData;
  }

  /**
   * Get pixel from pre-fetched line data
   *
   * @param lineData - Row pixel data (8 bytes)
   * @param x - X position within sprite (0-15)
   * @param flipH - Apply horizontal flip
   * @returns Palette index (0-15 for 4bpp)
   */
  getPixelFromLineData(lineData: Uint8Array, x: number, flipH: boolean): number {
    // Apply horizontal flip
    let pixelX = x;
    if (flipH) {
      pixelX = SPRITE_SIZE - 1 - x;
    }

    // 4bpp: 2 pixels per byte
    const byteIndex = Math.floor(pixelX / 2);
    const byte = lineData[byteIndex];

    // High nibble = even pixel, low nibble = odd pixel
    if (pixelX % 2 === 0) {
      return (byte >> 4) & 0x0f;
    } else {
      return byte & 0x0f;
    }
  }

  /**
   * Render sprites for a scanline to a line buffer
   *
   * @param scanline - Current scanline
   * @param screenWidth - Screen width in pixels (256 for Mode 0)
   * @param backgroundBuffer - Background pixel buffer for priority checking
   * @returns Sprite pixel buffer with palette indices (0 = transparent)
   */
  renderScanline(
    scanline: number,
    screenWidth: number,
    backgroundBuffer?: Uint8Array
  ): Uint8Array {
    // Clear buffers
    this.scanlineBuffer.fill(0);
    this.spriteIdBuffer.fill(-1);

    const activeSprites = this.evaluateSprites(scanline);

    // Process sprites in REVERSE order (high ID first)
    // This allows low ID sprites to overwrite high ID sprites
    for (let i = activeSprites.length - 1; i >= 0; i--) {
      const active = activeSprites[i];
      const sprite = active.sprite;

      for (let spriteX = 0; spriteX < SPRITE_SIZE; spriteX++) {
        const screenX = sprite.x + spriteX;

        // Check screen bounds
        if (screenX < 0 || screenX >= screenWidth) {
          continue;
        }

        // Get pixel value
        const pixel = this.getPixelFromLineData(active.lineData, spriteX, sprite.flipH);

        // Check transparency (color 0)
        if (pixel === 0) {
          continue;
        }

        // Apply palette offset
        const finalColor = pixel + sprite.paletteOffset * 16;

        // Check priority
        if (sprite.priorityBehind && backgroundBuffer) {
          // Only draw if background is transparent
          if (backgroundBuffer[screenX] !== 0) {
            continue;
          }
        }

        // Check for sprite-sprite collision before writing
        const existingSpriteId = this.spriteIdBuffer[screenX];
        if (existingSpriteId >= 0 && existingSpriteId !== active.id) {
          this.recordSpriteCollision(active.id, existingSpriteId);
        }

        this.scanlineBuffer[screenX] = finalColor;
        this.spriteIdBuffer[screenX] = active.id;
      }
    }

    // Return a copy of the buffer
    return this.scanlineBuffer.slice(0, screenWidth);
  }

  /**
   * Record a sprite-sprite collision
   */
  private recordSpriteCollision(spriteA: number, spriteB: number): void {
    const mode = this.getCollisionMode();
    if ((mode & COLLISION_SPRITE_SPRITE) === 0) {
      return; // Sprite-sprite collision disabled
    }

    // Record collision for the lower-numbered sprite
    const primary = Math.min(spriteA, spriteB);
    const secondary = Math.max(spriteA, spriteB);

    // Check if this collision already recorded
    const exists = this.frameCollisions.some(
      (c) =>
        c.spriteId === primary &&
        c.data === secondary &&
        (c.typeFlags & COLLISION_TYPE_TILE) === 0
    );

    if (!exists && this.frameCollisions.length < MAX_COLLISIONS) {
      this.frameCollisions.push({
        spriteId: primary,
        data: secondary,
        typeFlags: COLLISION_TYPE_SPRITE,
      });
    }
  }

  /**
   * Record a sprite-tile collision
   */
  recordTileCollision(spriteId: number, tileType: number, collisionSides: number): void {
    const mode = this.getCollisionMode();
    if ((mode & COLLISION_SPRITE_TILE) === 0) {
      return; // Sprite-tile collision disabled
    }

    if (this.frameCollisions.length < MAX_COLLISIONS) {
      this.frameCollisions.push({
        spriteId,
        data: tileType,
        typeFlags: COLLISION_TYPE_TILE | (collisionSides & 0x0f),
      });
    }
  }

  /**
   * Perform bounding box collision detection for all active sprites
   * Called once per frame after sprite positions are updated
   */
  detectBoundingBoxCollisions(): void {
    const mode = this.getCollisionMode();
    if ((mode & COLLISION_SPRITE_SPRITE) === 0) {
      return;
    }
    if ((mode & COLLISION_PIXEL_PERFECT) !== 0) {
      return; // Use pixel-perfect mode instead
    }

    const spriteCount = this.getSpriteCount();

    // Check all sprite pairs
    for (let a = 0; a < spriteCount; a++) {
      const spriteA = this.readSpriteAttribute(a);

      for (let b = a + 1; b < spriteCount; b++) {
        const spriteB = this.readSpriteAttribute(b);

        // Check bounding box overlap
        if (this.boundingBoxOverlap(spriteA, spriteB)) {
          this.recordSpriteCollision(a, b);
        }
      }
    }
  }

  /**
   * Check if two sprites' bounding boxes overlap
   */
  private boundingBoxOverlap(a: SpriteAttribute, b: SpriteAttribute): boolean {
    const aRight = a.x + SPRITE_SIZE;
    const aBottom = a.y + SPRITE_SIZE;
    const bRight = b.x + SPRITE_SIZE;
    const bBottom = b.y + SPRITE_SIZE;

    return a.x < bRight && aRight > b.x && a.y < bBottom && aBottom > b.y;
  }

  /**
   * Get all collision entries for the current frame
   */
  getCollisions(): readonly CollisionEntry[] {
    return this.frameCollisions;
  }

  /**
   * Check if overflow occurred this frame
   */
  hasOverflow(): boolean {
    return this.overflowOccurred;
  }

  /**
   * Get sprite graphics data for debugging/visualization
   */
  getSpriteGraphics(spriteId: number): Uint8Array {
    const sprite = this.readSpriteAttribute(spriteId);
    const data = new Uint8Array(SPRITE_BYTES_4BPP);

    for (let i = 0; i < SPRITE_BYTES_4BPP; i++) {
      const offset = sprite.spriteIndex * SPRITE_BYTES_4BPP + i;
      data[i] = this.bankedMemory.readBank(sprite.bank, offset);
    }

    return data;
  }

  /**
   * Decode sprite graphics to RGBA for visualization
   */
  decodeSpriteToRGBA(
    spriteId: number,
    palette: readonly [number, number, number][]
  ): Uint8ClampedArray {
    const sprite = this.readSpriteAttribute(spriteId);
    const rgba = new Uint8ClampedArray(SPRITE_SIZE * SPRITE_SIZE * 4);

    for (let y = 0; y < SPRITE_SIZE; y++) {
      const lineData = this.fetchSpriteRow(sprite, y);

      for (let x = 0; x < SPRITE_SIZE; x++) {
        const pixel = this.getPixelFromLineData(lineData, x, false);
        const colorIndex = pixel + sprite.paletteOffset * 16;
        const [r, g, b] = palette[colorIndex] || [0, 0, 0];

        const offset = (y * SPRITE_SIZE + x) * 4;
        rgba[offset] = r;
        rgba[offset + 1] = g;
        rgba[offset + 2] = b;
        rgba[offset + 3] = pixel === 0 ? 0 : 255; // Transparent if color 0
      }
    }

    return rgba;
  }
}

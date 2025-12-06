# Sprite System Implementation Specification

## Overview

This document specifies how to implement the sprite rendering system in the Virtual Console emulator. The sprite system provides hardware-accelerated sprite rendering with per-sprite banking, collision detection, and scanline-based rendering following the hardware specification in `specs/hardware/sprites.md`.

## Core Architecture

**The implementation uses a scanline-based rendering pipeline with three distinct phases:**

1. **Sprite Evaluation** - Determines which sprites intersect the current scanline
2. **Sprite Data Fetch** - Fetches pixel data for visible sprites from their respective banks
3. **Pixel Rendering** - Composites sprites with priority resolution and transparency

The sprite system operates independently from the CPU, reading sprite attributes and graphics from shared memory. This enables the renderer to run in the main thread while the CPU runs in a worker.

```
Memory Layout (Sprite-Related):

Lower Memory (always visible):
┌─────────────────────────────────────────────────────────────────┐
│ 0x0104  SPRITE_ENABLE         - Enable/disable sprite system    │
│ 0x0105  SPRITE_COUNT          - Number of active sprites (0-128)│
│ 0x0106  SPRITE_GRAPHICS_BANK  - Default sprite graphics bank    │
│ 0x0107  SPRITE_OVERFLOW       - Scanline overflow flag (R/O)    │
│ 0x0108  COLLISION_FLAGS       - Collision status (R/W1C)        │
│ 0x0109  COLLISION_COUNT       - Number of collisions (R/O)      │
│ 0x010A  COLLISION_MODE        - Collision detection mode        │
│ 0x010B  SPRITE_SCANLINE_LIMIT - Max sprites per scanline (1-16) │
├─────────────────────────────────────────────────────────────────┤
│ 0x0700-0x097F  Sprite Attribute Table (128 × 5 bytes = 640B)    │
│ 0x0980-0x0A7F  Collision Buffer (85 × 3 bytes = 256B)           │
└─────────────────────────────────────────────────────────────────┘

Banked Memory (sprite graphics):
┌─────────────────────────────────────────────────────────────────┐
│ Banks 0-3:    RAM banks (dynamically generated sprites)         │
│ Banks 18-31:  Cartridge ROM (static sprite graphics)            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Overview

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `SpriteEngine` | console/src/spriteEngine.ts | Core sprite rendering and collision |
| `SpriteRenderer` | devkit/client/src/consoleIntegration/spriteRenderer.ts | WebGPU/Canvas sprite rendering |
| `CollisionDetector` | console/src/collisionDetector.ts | Sprite-sprite and sprite-tile collision |
| Memory registers | memoryBus.ts | Hardware register read/write handling |

---

## Implementation Details

### 1. SpriteEngine Class

Create the core sprite engine that handles sprite evaluation, data fetching, and collision detection.

**File:** `src/console/src/spriteEngine.ts`

```typescript
/**
 * SpriteEngine handles sprite rendering and collision detection
 *
 * Implements scanline-based rendering matching the hardware specification:
 * - 128 total sprites
 * - 8 sprites per scanline (configurable up to 16)
 * - 16×16 pixels at 4bpp or 8bpp
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
export const SPRITE_SIZE = 16; // 16×16 pixels
export const SPRITE_BYTES_4BPP = 128; // 16×16 / 2
export const SPRITE_BYTES_8BPP = 256; // 16×16 × 1
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
interface ActiveSprite {
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

  constructor(lowerMemory: Uint8Array, bankedMemory: BankedMemory) {
    this.lowerMemory = lowerMemory;
    this.bankedMemory = bankedMemory;
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
  private fetchSpriteRow(sprite: SpriteAttribute, row: number): Uint8Array {
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
    if (flipH) {
      x = SPRITE_SIZE - 1 - x;
    }

    // 4bpp: 2 pixels per byte
    const byteIndex = Math.floor(x / 2);
    const byte = lineData[byteIndex];

    // High nibble = even pixel, low nibble = odd pixel
    if (x % 2 === 0) {
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
    const spriteBuffer = new Uint8Array(screenWidth);
    const spriteIdBuffer = new Int16Array(screenWidth).fill(-1);

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
        const existingSpriteId = spriteIdBuffer[screenX];
        if (existingSpriteId >= 0 && existingSpriteId !== active.id) {
          this.recordSpriteCollision(active.id, existingSpriteId);
        }

        spriteBuffer[screenX] = finalColor;
        spriteIdBuffer[screenX] = active.id;
      }
    }

    return spriteBuffer;
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
  recordTileCollision(
    spriteId: number,
    tileType: number,
    collisionSides: number
  ): void {
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
}
```

### 2. SpriteRenderer Class (WebGPU/Canvas Integration)

Create the renderer that integrates with the existing WebGPU rendering pipeline.

**File:** `src/devkit/client/src/consoleIntegration/spriteRenderer.ts`

```typescript
/**
 * SpriteRenderer handles WebGPU-accelerated sprite rendering
 *
 * Integrates with the main rendering pipeline to composite sprites
 * with the background/tilemap layer.
 */

import { BankedMemory, LOWER_MEMORY_OFFSET } from '../../../../console/src/bankedMemory';
import {
  SpriteEngine,
  SPRITE_ENABLE,
  SPRITE_SIZE,
  MAX_SPRITES,
} from '../../../../console/src/spriteEngine';

export interface ScreenMode {
  width: number;
  height: number;
  bpp: number;
}

export const SCREEN_MODES: ScreenMode[] = [
  { width: 256, height: 160, bpp: 4 }, // Mode 0
  { width: 160, height: 96, bpp: 8 },  // Mode 1
  { width: 128, height: 128, bpp: 8 }, // Mode 2
  { width: 176, height: 176, bpp: 4 }, // Mode 3
];

export class SpriteRenderer {
  private readonly memoryView: Uint8Array;
  private readonly bankedMemory: BankedMemory;
  private readonly spriteEngine: SpriteEngine;

  constructor(sharedBuffer: SharedArrayBuffer, bankedMemory: BankedMemory) {
    this.memoryView = new Uint8Array(sharedBuffer);
    this.bankedMemory = bankedMemory;

    // Create sprite engine with lower memory view
    const lowerMemory = new Uint8Array(
      sharedBuffer,
      LOWER_MEMORY_OFFSET,
      0x8000
    );
    this.spriteEngine = new SpriteEngine(lowerMemory, bankedMemory);
  }

  /**
   * Get the current video mode
   */
  getVideoMode(): ScreenMode {
    const modeIndex = this.memoryView[LOWER_MEMORY_OFFSET + 0x0101]; // VIDEO_MODE
    return SCREEN_MODES[modeIndex & 0x03];
  }

  /**
   * Check if sprites are enabled
   */
  isEnabled(): boolean {
    return (this.memoryView[LOWER_MEMORY_OFFSET + SPRITE_ENABLE] & 0x01) !== 0;
  }

  /**
   * Render all visible sprites to a framebuffer
   *
   * @param framebuffer - Target RGBA framebuffer
   * @param palette - 256-color palette as RGB tuples
   * @param backgroundBuffer - Optional background for priority checking
   */
  renderToFramebuffer(
    framebuffer: Uint8ClampedArray,
    palette: readonly [number, number, number][],
    backgroundBuffer?: Uint8Array
  ): void {
    if (!this.isEnabled()) {
      return;
    }

    const mode = this.getVideoMode();

    // Reset frame state
    this.spriteEngine.resetFrame();

    // Render each scanline
    for (let y = 0; y < mode.height; y++) {
      const scanlineBuffer = this.spriteEngine.renderScanline(
        y,
        mode.width,
        backgroundBuffer
          ? backgroundBuffer.subarray(y * mode.width, (y + 1) * mode.width)
          : undefined
      );

      // Write to framebuffer
      for (let x = 0; x < mode.width; x++) {
        const colorIndex = scanlineBuffer[x];

        // Skip transparent pixels
        if (colorIndex === 0) {
          continue;
        }

        // Apply palette
        const [r, g, b] = palette[colorIndex];
        const fbOffset = (y * mode.width + x) * 4;

        framebuffer[fbOffset] = r;
        framebuffer[fbOffset + 1] = g;
        framebuffer[fbOffset + 2] = b;
        framebuffer[fbOffset + 3] = 255; // Alpha
      }
    }

    // Finalize frame (write collision data)
    this.spriteEngine.finalizeFrame();
  }

  /**
   * Get sprite engine for direct access
   */
  getEngine(): SpriteEngine {
    return this.spriteEngine;
  }

  /**
   * Get all sprite attributes for debugging
   */
  getAllSpriteAttributes(): {
    id: number;
    x: number;
    y: number;
    index: number;
    bank: number;
    flags: number;
  }[] {
    const sprites = [];
    const count = this.spriteEngine.getSpriteCount();

    for (let i = 0; i < count; i++) {
      const attr = this.spriteEngine.readSpriteAttribute(i);
      sprites.push({
        id: i,
        x: attr.x,
        y: attr.y,
        index: attr.spriteIndex,
        bank: attr.bank,
        flags: attr.flags,
      });
    }

    return sprites;
  }
}
```

### 3. Collision Detector Integration

Create a collision detector that integrates with the tilemap system.

**File:** `src/console/src/collisionDetector.ts`

```typescript
/**
 * CollisionDetector handles sprite-tile collision detection
 *
 * Integrates with both SpriteEngine and TilemapEngine to detect
 * when sprites overlap solid tiles.
 */

import {
  SpriteEngine,
  SpriteAttribute,
  SPRITE_SIZE,
  COLLISION_SIDE_TOP,
  COLLISION_SIDE_BOTTOM,
  COLLISION_SIDE_LEFT,
  COLLISION_SIDE_RIGHT,
} from './spriteEngine';

// Tile property flags (from tile properties table at 0x0A80)
export const TILE_SOLID = 0x80;
export const TILE_HAZARD = 0x40;

// Tile properties table location
export const TILE_PROPERTIES_START = 0x0a80;

// Tilemap registers
export const TILEMAP_ENABLE = 0x013d;
export const TILEMAP_WIDTH = 0x0141;
export const TILEMAP_HEIGHT = 0x0142;
export const TILEMAP_DATA_BANK = 0x0143;
export const TILEMAP_ADDR_HI = 0x0144;
export const TILEMAP_ADDR_LO = 0x0145;
export const TILEMAP_X_SCROLL = 0x013f;
export const TILEMAP_Y_SCROLL = 0x0140;

const TILE_SIZE = 16;

export class CollisionDetector {
  private readonly lowerMemory: Uint8Array;
  private readonly spriteEngine: SpriteEngine;

  constructor(lowerMemory: Uint8Array, spriteEngine: SpriteEngine) {
    this.lowerMemory = lowerMemory;
    this.spriteEngine = spriteEngine;
  }

  /**
   * Check if tilemap is enabled
   */
  isTilemapEnabled(): boolean {
    return (this.lowerMemory[TILEMAP_ENABLE] & 0x01) !== 0;
  }

  /**
   * Get tile properties for a tile type
   */
  getTileProperties(tileType: number): number {
    return this.lowerMemory[TILE_PROPERTIES_START + (tileType & 0x7f)];
  }

  /**
   * Check if a tile type is solid
   */
  isTileSolid(tileType: number): boolean {
    return (this.getTileProperties(tileType) & TILE_SOLID) !== 0;
  }

  /**
   * Detect sprite-tile collisions for all active sprites
   *
   * Should be called once per frame after sprites and tilemap are updated.
   */
  detectSpriteTileCollisions(
    getTileAt: (tileX: number, tileY: number) => number | null
  ): void {
    if (!this.isTilemapEnabled()) {
      return;
    }

    const spriteCount = this.spriteEngine.getSpriteCount();

    for (let id = 0; id < spriteCount; id++) {
      const sprite = this.spriteEngine.readSpriteAttribute(id);
      this.checkSpriteCollision(id, sprite, getTileAt);
    }
  }

  /**
   * Check collision for a single sprite
   */
  private checkSpriteCollision(
    spriteId: number,
    sprite: SpriteAttribute,
    getTileAt: (tileX: number, tileY: number) => number | null
  ): void {
    // Calculate tile range covered by sprite
    const scrollX = this.lowerMemory[TILEMAP_X_SCROLL];
    const scrollY = this.lowerMemory[TILEMAP_Y_SCROLL];

    // Sprite bounds in world coordinates
    const worldX = sprite.x + scrollX;
    const worldY = sprite.y + scrollY;

    // Tile range
    const startTileX = Math.floor(worldX / TILE_SIZE);
    const endTileX = Math.floor((worldX + SPRITE_SIZE - 1) / TILE_SIZE);
    const startTileY = Math.floor(worldY / TILE_SIZE);
    const endTileY = Math.floor((worldY + SPRITE_SIZE - 1) / TILE_SIZE);

    for (let tileY = startTileY; tileY <= endTileY; tileY++) {
      for (let tileX = startTileX; tileX <= endTileX; tileX++) {
        const tileType = getTileAt(tileX, tileY);

        if (tileType === null) {
          continue;
        }

        if (!this.isTileSolid(tileType)) {
          continue;
        }

        // Calculate collision side
        const sides = this.calculateCollisionSide(sprite, tileX, tileY, scrollX, scrollY);

        if (sides !== 0) {
          this.spriteEngine.recordTileCollision(spriteId, tileType, sides);
        }
      }
    }
  }

  /**
   * Calculate which side(s) of the sprite are colliding
   */
  private calculateCollisionSide(
    sprite: SpriteAttribute,
    tileX: number,
    tileY: number,
    scrollX: number,
    scrollY: number
  ): number {
    const worldX = sprite.x + scrollX;
    const worldY = sprite.y + scrollY;

    const tileLeft = tileX * TILE_SIZE;
    const tileRight = tileLeft + TILE_SIZE;
    const tileTop = tileY * TILE_SIZE;
    const tileBottom = tileTop + TILE_SIZE;

    const spriteRight = worldX + SPRITE_SIZE;
    const spriteBottom = worldY + SPRITE_SIZE;

    let sides = 0;

    // Determine overlap amounts
    const overlapLeft = spriteRight - tileLeft;
    const overlapRight = tileRight - worldX;
    const overlapTop = spriteBottom - tileTop;
    const overlapBottom = tileBottom - worldY;

    // Determine primary collision sides based on smallest overlap
    const minHorizontal = Math.min(overlapLeft, overlapRight);
    const minVertical = Math.min(overlapTop, overlapBottom);

    if (minHorizontal < minVertical) {
      // Horizontal collision is primary
      if (overlapLeft < overlapRight) {
        sides |= COLLISION_SIDE_RIGHT;
      } else {
        sides |= COLLISION_SIDE_LEFT;
      }
    } else {
      // Vertical collision is primary
      if (overlapTop < overlapBottom) {
        sides |= COLLISION_SIDE_BOTTOM;
      } else {
        sides |= COLLISION_SIDE_TOP;
      }
    }

    return sides;
  }
}
```

### 4. Integration with Rendering Pipeline

Update the WebGPU renderer to include sprites.

**File:** `src/devkit/client/src/consoleIntegration/webgpuRendering.ts` (additions)

```typescript
// Add to existing webgpuRendering.ts

import { SpriteRenderer } from './spriteRenderer';

// In the renderer class, add:

private spriteRenderer: SpriteRenderer | null = null;

// In initialization:
initializeSpriteRenderer(sharedBuffer: SharedArrayBuffer, bankedMemory: BankedMemory): void {
  this.spriteRenderer = new SpriteRenderer(sharedBuffer, bankedMemory);
}

// In the render frame method:
renderFrame(): void {
  // ... existing background/tilemap rendering ...

  // Get background buffer for priority checking
  const backgroundBuffer = this.getBackgroundBuffer();

  // Render sprites
  if (this.spriteRenderer) {
    this.spriteRenderer.renderToFramebuffer(
      this.framebufferData,
      this.palette,
      backgroundBuffer
    );
  }

  // ... upload to GPU and display ...
}
```

---

## Memory Register Handling

### Hardware Register Updates in MemoryBus

Add special handling for sprite-related registers:

**File:** `src/console/src/memoryBus.ts` (additions)

```typescript
// Add to write8 method:

case SPRITE_OVERFLOW: // 0x0107
  // Read-only register, ignore writes
  return;

case COLLISION_FLAGS: // 0x0108
  // Write-1-to-clear semantics
  const current = this.lowerMemory[address];
  this.lowerMemory[address] = current & ~value;
  return;

case COLLISION_COUNT: // 0x0109
  // Read-only register, ignore writes
  return;
```

---

## Rendering Pipeline Integration

### Frame Rendering Sequence

```
Each Frame (60 Hz):

1. VBlank Start
   ├── Clear collision buffer
   ├── Reset overflow flag
   └── CPU can update sprite attributes

2. Active Rendering (per scanline)
   ├── Sprite Evaluation
   │   ├── Read SPRITE_COUNT (0x0105)
   │   ├── For each sprite 0 to SPRITE_COUNT-1:
   │   │   ├── Read sprite attributes from 0x0700+
   │   │   ├── Check if sprite intersects scanline
   │   │   └── Add to active list (up to SCANLINE_LIMIT)
   │   └── Set SPRITE_OVERFLOW if limit exceeded
   │
   ├── Sprite Data Fetch
   │   └── For each active sprite:
   │       ├── Calculate row within sprite
   │       ├── Apply vertical flip
   │       └── Fetch 8 bytes from sprite.bank
   │
   ├── Pixel Rendering
   │   └── For each screen X:
   │       ├── Check sprites in reverse priority order
   │       ├── Apply horizontal flip
   │       ├── Get pixel value (0 = transparent)
   │       ├── Apply palette offset
   │       ├── Check priority vs background
   │       ├── Detect sprite-sprite collisions
   │       └── Write to scanline buffer
   │
   └── Collision Detection
       └── Record collisions to buffer (0x0980+)

3. VBlank End
   ├── Write COLLISION_COUNT (0x0109)
   ├── Write COLLISION_FLAGS (0x0108)
   └── Trigger VBlank interrupt
```

### Priority Compositing

```
Layer Order (bottom to top):

1. Background color (palette index 0)
2. Tilemap tiles with priority=0
3. Sprites with PRIORITY_BEHIND flag (behind background)
4. Sprites with front priority (lowest sprite ID wins)
5. Tilemap tiles with priority=1 (if per-tile priority enabled)

For each pixel:
┌─────────────────────────────────────────────────────────────────┐
│ pixel_color = background_color                                  │
│                                                                 │
│ if tilemap_enabled && !tile_priority:                           │
│   pixel_color = tilemap_pixel                                   │
│                                                                 │
│ for sprite in reverse(active_sprites):  // High ID first       │
│   sprite_pixel = get_sprite_pixel(sprite)                       │
│   if sprite_pixel != 0:  // Not transparent                     │
│     if sprite.priority_behind:                                  │
│       if pixel_color == 0:                                      │
│         pixel_color = sprite_pixel                              │
│     else:                                                       │
│       pixel_color = sprite_pixel                                │
│       break  // First opaque sprite wins                        │
│                                                                 │
│ if tilemap_enabled && tile_priority:                            │
│   if tilemap_pixel != 0:                                        │
│     pixel_color = tilemap_pixel                                 │
│                                                                 │
│ output(pixel_color)                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Testing Requirements

### Unit Tests

1. **SpriteEngine**
   - Read sprite attributes from memory
   - Sprite evaluation (correct sprites selected for scanline)
   - Scanline limit enforcement
   - Overflow flag set correctly
   - Horizontal/vertical flip
   - Transparency (color 0 not drawn)
   - Palette offset application
   - Priority ordering (low ID wins)

2. **Collision Detection**
   - Bounding box collision detection
   - Pixel-perfect collision detection
   - Collision buffer write
   - Collision flags update
   - Sprite-tile collision sides

3. **Memory Registers**
   - SPRITE_OVERFLOW read-only
   - COLLISION_COUNT read-only
   - COLLISION_FLAGS write-1-to-clear

### Integration Tests

1. **Sprite Rendering**
   - Single sprite renders correctly
   - Multiple sprites with overlapping priority
   - Sprites using different banks
   - Sprite at screen edges
   - Sprite partially off-screen

2. **Collision Detection**
   - Two sprites overlapping trigger collision
   - Sprite overlapping solid tile triggers collision
   - Collision data readable from buffer

---

## Performance Considerations

### Optimization Strategies

1. **Sprite Evaluation Caching**
   ```typescript
   // Cache sprite positions per frame
   private spritePositionCache: Map<number, SpriteAttribute> = new Map();
   ```

2. **Pre-allocated Buffers**
   ```typescript
   // Reuse scanline buffers
   private scanlineBuffer = new Uint8Array(256);
   private spriteIdBuffer = new Int16Array(256);
   ```

3. **Early Exit Conditions**
   - Skip disabled sprites (Y > screen height)
   - Skip sprites entirely off-screen
   - Skip transparent pixel checks when possible

4. **WebGPU Compute Shader (Future)**
   - Move sprite evaluation to GPU
   - Parallel pixel rendering
   - GPU collision detection

### Performance Targets

| Operation | Target | Notes |
|-----------|--------|-------|
| Sprite evaluation | <1ms per frame | 128 sprites, 160 scanlines |
| Sprite rendering | <2ms per frame | Full screen coverage |
| Collision detection | <1ms per frame | Bounding box mode |
| Total sprite system | <4ms per frame | Leaves 12ms for other work |

---

## Constants Reference

```typescript
// Hardware registers
export const SPRITE_ENABLE = 0x0104;
export const SPRITE_COUNT = 0x0105;
export const SPRITE_GRAPHICS_BANK = 0x0106;
export const SPRITE_OVERFLOW = 0x0107;
export const COLLISION_FLAGS = 0x0108;
export const COLLISION_COUNT = 0x0109;
export const COLLISION_MODE = 0x010a;
export const SPRITE_SCANLINE_LIMIT = 0x010b;

// Memory ranges
export const SPRITE_TABLE_START = 0x0700;
export const SPRITE_TABLE_END = 0x097f;
export const COLLISION_BUFFER_START = 0x0980;
export const COLLISION_BUFFER_END = 0x0a7f;

// Sprite configuration
export const MAX_SPRITES = 128;
export const SPRITE_SIZE = 16;
export const SPRITE_ATTR_SIZE = 5;
export const SPRITE_BYTES_4BPP = 128;
export const SPRITE_BYTES_8BPP = 256;
export const DEFAULT_SCANLINE_LIMIT = 8;
export const MAX_SCANLINE_LIMIT = 16;
export const MAX_COLLISIONS = 85;

// Flags
export const FLAG_FLIP_H = 0x80;
export const FLAG_FLIP_V = 0x40;
export const FLAG_PRIORITY_BEHIND = 0x20;
export const FLAG_PALETTE_MASK = 0x18;
export const FLAG_PALETTE_SHIFT = 3;

// Collision
export const COLLISION_SPRITE_SPRITE = 0x01;
export const COLLISION_SPRITE_TILE = 0x02;
export const COLLISION_PIXEL_PERFECT = 0x04;
export const COLLISION_TYPE_SPRITE = 0x00;
export const COLLISION_TYPE_TILE = 0x80;
export const COLLISION_SIDE_TOP = 0x08;
export const COLLISION_SIDE_BOTTOM = 0x04;
export const COLLISION_SIDE_LEFT = 0x02;
export const COLLISION_SIDE_RIGHT = 0x01;
```

---

## Migration Path

### Phase 1: Core SpriteEngine
1. Create `SpriteEngine` class
2. Implement sprite attribute reading
3. Implement scanline evaluation
4. Implement pixel fetching from banked memory
5. Add unit tests

### Phase 2: Rendering Integration
1. Create `SpriteRenderer` class
2. Integrate with WebGPU rendering pipeline
3. Implement priority compositing
4. Add integration tests

### Phase 3: Collision Detection
1. Implement sprite-sprite collision (bounding box)
2. Implement sprite-tile collision
3. Implement collision buffer writing
4. Add collision tests

### Phase 4: Advanced Features
1. Implement pixel-perfect collision mode
2. Add sprite overflow handling
3. Add debug visualization tools
4. Performance optimization

---

## Revision History

- v1.0 (2024): Initial specification

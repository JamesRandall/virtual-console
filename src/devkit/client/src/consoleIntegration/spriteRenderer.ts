/**
 * SpriteRenderer handles sprite rendering for the devkit
 *
 * Integrates with the main rendering pipeline to composite sprites
 * with the background/tilemap layer.
 */

import {
  BankedMemory,
  LOWER_MEMORY_OFFSET,
  LOWER_MEMORY_SIZE,
} from '../../../../console/src/bankedMemory';
import {
  SpriteEngine,
  SPRITE_ENABLE,
  SPRITE_SIZE,
  MAX_SPRITES,
  SPRITE_COUNT,
} from '../../../../console/src/spriteEngine';
import { CollisionDetector } from '../../../../console/src/collisionDetector';

/**
 * Function type for getting a tile at a given tile coordinate
 */
type GetTileAtFunction = (tileX: number, tileY: number) => number | null;

export interface ScreenMode {
  width: number;
  height: number;
  bpp: number;
}

export const SCREEN_MODES: ScreenMode[] = [
  { width: 256, height: 160, bpp: 4 }, // Mode 0
  { width: 160, height: 96, bpp: 8 }, // Mode 1
  { width: 128, height: 128, bpp: 8 }, // Mode 2
  { width: 176, height: 176, bpp: 4 }, // Mode 3
];

const VIDEO_MODE_REGISTER = 0x0101;

export class SpriteRenderer {
  private readonly memoryView: Uint8Array;
  private readonly bankedMemory: BankedMemory;
  private readonly spriteEngine: SpriteEngine;
  private readonly collisionDetector: CollisionDetector;
  private readonly lowerMemory: Uint8Array;

  constructor(sharedBuffer: SharedArrayBuffer, bankedMemory: BankedMemory) {
    this.memoryView = new Uint8Array(sharedBuffer);
    this.bankedMemory = bankedMemory;

    // Create a view of lower memory
    this.lowerMemory = new Uint8Array(sharedBuffer, LOWER_MEMORY_OFFSET, LOWER_MEMORY_SIZE);

    // Create sprite engine with lower memory view
    this.spriteEngine = new SpriteEngine(this.lowerMemory, bankedMemory);

    // Create collision detector
    this.collisionDetector = new CollisionDetector(this.lowerMemory, this.spriteEngine);
  }

  /**
   * Get the current video mode
   */
  getVideoMode(): ScreenMode {
    const modeIndex = this.memoryView[LOWER_MEMORY_OFFSET + VIDEO_MODE_REGISTER];
    return SCREEN_MODES[modeIndex & 0x03];
  }

  /**
   * Check if sprites are enabled
   */
  isEnabled(): boolean {
    return (this.memoryView[LOWER_MEMORY_OFFSET + SPRITE_ENABLE] & 0x01) !== 0;
  }

  /**
   * Get the number of active sprites
   */
  getSpriteCount(): number {
    return Math.min(this.memoryView[LOWER_MEMORY_OFFSET + SPRITE_COUNT], MAX_SPRITES);
  }

  /**
   * Reset frame state - call at start of each frame
   */
  resetFrame(): void {
    this.spriteEngine.resetFrame();
  }

  /**
   * Finalize frame - call at end of each frame to write collision data
   */
  finalizeFrame(): void {
    this.spriteEngine.finalizeFrame();
  }

  /**
   * Render sprites for a single scanline
   *
   * @param scanline - Current scanline
   * @param screenWidth - Screen width in pixels
   * @param backgroundBuffer - Optional background for priority checking
   * @returns Sprite pixel buffer with palette indices (0 = transparent)
   */
  renderScanline(
    scanline: number,
    screenWidth: number,
    backgroundBuffer?: Uint8Array
  ): Uint8Array {
    return this.spriteEngine.renderScanline(scanline, screenWidth, backgroundBuffer);
  }

  /**
   * Render all visible sprites to a framebuffer
   *
   * @param framebuffer - Target RGBA framebuffer
   * @param palette - 256-color palette as RGB tuples
   * @param backgroundBuffer - Optional background for priority checking (full frame)
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
      // Get background buffer slice for this scanline if provided
      const bgSlice = backgroundBuffer
        ? backgroundBuffer.subarray(y * mode.width, (y + 1) * mode.width)
        : undefined;

      const scanlineBuffer = this.spriteEngine.renderScanline(y, mode.width, bgSlice);

      // Write to framebuffer
      for (let x = 0; x < mode.width; x++) {
        const colorIndex = scanlineBuffer[x];

        // Skip transparent pixels
        if (colorIndex === 0) {
          continue;
        }

        // Apply palette
        const color = palette[colorIndex];
        if (!color) {
          continue;
        }

        const [r, g, b] = color;
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
   * Detect sprite-tile collisions
   *
   * @param getTileAt - Function to get tile type at coordinates
   */
  detectTileCollisions(getTileAt: GetTileAtFunction): void {
    this.collisionDetector.detectSpriteTileCollisions(getTileAt);
  }

  /**
   * Perform bounding box collision detection between sprites
   */
  detectBoundingBoxCollisions(): void {
    this.spriteEngine.detectBoundingBoxCollisions();
  }

  /**
   * Get sprite engine for direct access
   */
  getEngine(): SpriteEngine {
    return this.spriteEngine;
  }

  /**
   * Get collision detector for direct access
   */
  getCollisionDetector(): CollisionDetector {
    return this.collisionDetector;
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
    flipH: boolean;
    flipV: boolean;
    priorityBehind: boolean;
    paletteOffset: number;
  }[] {
    const sprites = [];
    const count = this.getSpriteCount();

    for (let i = 0; i < count; i++) {
      const attr = this.spriteEngine.readSpriteAttribute(i);
      sprites.push({
        id: i,
        x: attr.x,
        y: attr.y,
        index: attr.spriteIndex,
        bank: attr.bank,
        flags: attr.flags,
        flipH: attr.flipH,
        flipV: attr.flipV,
        priorityBehind: attr.priorityBehind,
        paletteOffset: attr.paletteOffset,
      });
    }

    return sprites;
  }

  /**
   * Get sprite graphics as RGBA data for visualization
   */
  getSpriteAsRGBA(
    spriteId: number,
    palette: readonly [number, number, number][]
  ): Uint8ClampedArray {
    return this.spriteEngine.decodeSpriteToRGBA(spriteId, palette);
  }

  /**
   * Check if a sprite is visible on screen
   */
  isSpriteVisible(spriteId: number): boolean {
    const sprite = this.spriteEngine.readSpriteAttribute(spriteId);
    const mode = this.getVideoMode();

    // Check if sprite is at least partially on screen
    return (
      sprite.x < mode.width &&
      sprite.x + SPRITE_SIZE > 0 &&
      sprite.y < mode.height &&
      sprite.y + SPRITE_SIZE > 0
    );
  }

  /**
   * Get sprites that are visible on screen
   */
  getVisibleSprites(): number[] {
    const visible: number[] = [];
    const count = this.getSpriteCount();

    for (let i = 0; i < count; i++) {
      if (this.isSpriteVisible(i)) {
        visible.push(i);
      }
    }

    return visible;
  }
}

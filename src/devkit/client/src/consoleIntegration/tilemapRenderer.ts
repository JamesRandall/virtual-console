/**
 * TilemapRenderer handles tilemap rendering for the devkit
 *
 * Integrates with the main rendering pipeline to render tilemaps
 * and composite them with sprites and background.
 */

import {
  BankedMemory,
  LOWER_MEMORY_OFFSET,
  LOWER_MEMORY_SIZE,
} from '../../../../console/src/bankedMemory';
import {
  TilemapEngine,
  TILEMAP_ENABLE,
  TILE_SIZE,
} from '../../../../console/src/tilemapEngine';
import type { TileEntry } from '../../../../console/src/tilemapEngine';

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

export class TilemapRenderer {
  private readonly memoryView: Uint8Array;
  private readonly tilemapEngine: TilemapEngine;
  private readonly lowerMemory: Uint8Array;

  constructor(sharedBuffer: SharedArrayBuffer, bankedMemory: BankedMemory) {
    this.memoryView = new Uint8Array(sharedBuffer);

    // Create a view of lower memory
    this.lowerMemory = new Uint8Array(sharedBuffer, LOWER_MEMORY_OFFSET, LOWER_MEMORY_SIZE);

    // Create tilemap engine with lower memory view
    this.tilemapEngine = new TilemapEngine(this.lowerMemory, bankedMemory);
  }

  /**
   * Get the current video mode
   */
  getVideoMode(): ScreenMode {
    const modeIndex = this.memoryView[LOWER_MEMORY_OFFSET + VIDEO_MODE_REGISTER];
    return SCREEN_MODES[modeIndex & 0x03];
  }

  /**
   * Check if tilemap is enabled
   */
  isEnabled(): boolean {
    return (this.memoryView[LOWER_MEMORY_OFFSET + TILEMAP_ENABLE] & 0x01) !== 0;
  }

  /**
   * Get scroll X position
   */
  getScrollX(): number {
    return this.tilemapEngine.getScrollX();
  }

  /**
   * Get scroll Y position
   */
  getScrollY(): number {
    return this.tilemapEngine.getScrollY();
  }

  /**
   * Get tilemap width in tiles
   */
  getWidth(): number {
    return this.tilemapEngine.getWidth();
  }

  /**
   * Get tilemap height in tiles
   */
  getHeight(): number {
    return this.tilemapEngine.getHeight();
  }

  /**
   * Render tilemap for a single scanline
   *
   * @param scanline - Current scanline
   * @param screenWidth - Screen width in pixels
   * @returns Pixel buffer with master palette indices (0 = transparent)
   */
  renderScanline(scanline: number, screenWidth: number): Uint8Array {
    return this.tilemapEngine.renderScanline(scanline, screenWidth);
  }

  /**
   * Get priority buffer for last rendered scanline
   * 0 = behind sprites, 1 = in front of sprites
   */
  getPriorityBuffer(): Uint8Array {
    return this.tilemapEngine.getPriorityBuffer();
  }

  /**
   * Get tile at specific tile coordinates
   */
  getTileAt(tileX: number, tileY: number): TileEntry | null {
    return this.tilemapEngine.readTileEntry(tileX, tileY);
  }

  /**
   * Get tile at world coordinates
   */
  getTileAtWorld(worldX: number, worldY: number): TileEntry | null {
    return this.tilemapEngine.getTileAt(worldX, worldY);
  }

  /**
   * Get tilemap engine for direct access
   */
  getEngine(): TilemapEngine {
    return this.tilemapEngine;
  }

  /**
   * Render a tile to RGBA for visualization
   */
  getTileAsRGBA(
    tileIndex: number,
    bank: number,
    palette: readonly [number, number, number][]
  ): Uint8ClampedArray {
    return this.tilemapEngine.decodeTileToRGBA(tileIndex, bank, palette);
  }

  /**
   * Get all visible tiles for debugging
   */
  getVisibleTiles(): {
    tileX: number;
    tileY: number;
    screenX: number;
    screenY: number;
    tile: TileEntry;
  }[] {
    const mode = this.getVideoMode();
    const scrollX = this.getScrollX();
    const scrollY = this.getScrollY();
    const result: {
      tileX: number;
      tileY: number;
      screenX: number;
      screenY: number;
      tile: TileEntry;
    }[] = [];

    // Calculate visible tile range
    const startTileX = Math.floor(scrollX / TILE_SIZE);
    const startTileY = Math.floor(scrollY / TILE_SIZE);
    const tilesAcross = Math.ceil(mode.width / TILE_SIZE) + 1;
    const tilesDown = Math.ceil(mode.height / TILE_SIZE) + 1;

    for (let ty = 0; ty < tilesDown; ty++) {
      for (let tx = 0; tx < tilesAcross; tx++) {
        const tileX = startTileX + tx;
        const tileY = startTileY + ty;
        const tile = this.getTileAt(tileX, tileY);

        if (tile) {
          // Calculate screen position
          const screenX = tileX * TILE_SIZE - scrollX;
          const screenY = tileY * TILE_SIZE - scrollY;

          result.push({
            tileX,
            tileY,
            screenX,
            screenY,
            tile,
          });
        }
      }
    }

    return result;
  }

  /**
   * Get tilemap info for debugging
   */
  getTilemapInfo(): {
    enabled: boolean;
    width: number;
    height: number;
    scrollX: number;
    scrollY: number;
    graphicsBank: number;
    dataBank: number;
    dataAddress: number;
    animFrame: number;
    wrapH: boolean;
    wrapV: boolean;
    priorityMode: boolean;
  } {
    const flags = this.tilemapEngine.getEnableFlags();
    return {
      enabled: this.isEnabled(),
      width: this.getWidth(),
      height: this.getHeight(),
      scrollX: this.getScrollX(),
      scrollY: this.getScrollY(),
      graphicsBank: this.tilemapEngine.getGraphicsBank(),
      dataBank: this.tilemapEngine.getDataBank(),
      dataAddress: this.tilemapEngine.getDataAddress(),
      animFrame: this.tilemapEngine.getAnimFrame(),
      wrapH: (flags & 0x02) !== 0,
      wrapV: (flags & 0x04) !== 0,
      priorityMode: (flags & 0x08) !== 0,
    };
  }
}

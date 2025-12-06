/**
 * CollisionDetector handles sprite-tile collision detection
 *
 * Integrates with both SpriteEngine and tilemap system to detect
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
export const TILE_ANIMATED = 0x10;

// Tile properties table location
export const TILE_PROPERTIES_START = 0x0a80;
export const TILE_PROPERTIES_END = 0x0aff;

// Tilemap registers
export const TILEMAP_ENABLE = 0x013d;
export const TILEMAP_GRAPHICS_BANK = 0x013e;
export const TILEMAP_X_SCROLL = 0x013f;
export const TILEMAP_Y_SCROLL = 0x0140;
export const TILEMAP_WIDTH = 0x0141;
export const TILEMAP_HEIGHT = 0x0142;
export const TILEMAP_DATA_BANK = 0x0143;
export const TILEMAP_ADDR_HI = 0x0144;
export const TILEMAP_ADDR_LO = 0x0145;

const TILE_SIZE = 16;

/**
 * Function type for getting a tile at a given tile coordinate
 */
export type GetTileAtFunction = (tileX: number, tileY: number) => number | null;

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
   * Get tilemap scroll X
   */
  getScrollX(): number {
    return this.lowerMemory[TILEMAP_X_SCROLL];
  }

  /**
   * Get tilemap scroll Y
   */
  getScrollY(): number {
    return this.lowerMemory[TILEMAP_Y_SCROLL];
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
   * Check if a tile type is a hazard
   */
  isTileHazard(tileType: number): boolean {
    return (this.getTileProperties(tileType) & TILE_HAZARD) !== 0;
  }

  /**
   * Detect sprite-tile collisions for all active sprites
   *
   * Should be called once per frame after sprites and tilemap are updated.
   *
   * @param getTileAt - Function to get tile type at a given tile coordinate
   */
  detectSpriteTileCollisions(getTileAt: GetTileAtFunction): void {
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
    getTileAt: GetTileAtFunction
  ): void {
    const scrollX = this.getScrollX();
    const scrollY = this.getScrollY();

    // Sprite bounds in world coordinates
    const worldX = sprite.x + scrollX;
    const worldY = sprite.y + scrollY;

    // Tile range covered by sprite
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
   * Calculate which side(s) of the sprite are colliding with a tile
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

  /**
   * Check if a sprite would collide with solid tiles at a given position
   *
   * Useful for movement prediction without recording collisions.
   *
   * @param sprite - Sprite attributes
   * @param newX - Proposed X position
   * @param newY - Proposed Y position
   * @param getTileAt - Function to get tile type
   * @returns Collision sides (0 = no collision)
   */
  checkCollisionAt(
    sprite: SpriteAttribute,
    newX: number,
    newY: number,
    getTileAt: GetTileAtFunction
  ): number {
    if (!this.isTilemapEnabled()) {
      return 0;
    }

    const scrollX = this.getScrollX();
    const scrollY = this.getScrollY();

    // Proposed position in world coordinates
    const worldX = newX + scrollX;
    const worldY = newY + scrollY;

    // Tile range
    const startTileX = Math.floor(worldX / TILE_SIZE);
    const endTileX = Math.floor((worldX + SPRITE_SIZE - 1) / TILE_SIZE);
    const startTileY = Math.floor(worldY / TILE_SIZE);
    const endTileY = Math.floor((worldY + SPRITE_SIZE - 1) / TILE_SIZE);

    let collisionSides = 0;

    for (let tileY = startTileY; tileY <= endTileY; tileY++) {
      for (let tileX = startTileX; tileX <= endTileX; tileX++) {
        const tileType = getTileAt(tileX, tileY);

        if (tileType === null) {
          continue;
        }

        if (!this.isTileSolid(tileType)) {
          continue;
        }

        // Create temporary sprite with proposed position
        const tempSprite = { ...sprite, x: newX, y: newY };
        collisionSides |= this.calculateCollisionSide(tempSprite, tileX, tileY, scrollX, scrollY);
      }
    }

    return collisionSides;
  }

  /**
   * Get all tiles overlapping a sprite
   *
   * @param sprite - Sprite to check
   * @param getTileAt - Function to get tile type
   * @returns Array of { tileX, tileY, tileType, properties }
   */
  getOverlappingTiles(
    sprite: SpriteAttribute,
    getTileAt: GetTileAtFunction
  ): { tileX: number; tileY: number; tileType: number; properties: number }[] {
    const result: { tileX: number; tileY: number; tileType: number; properties: number }[] = [];

    if (!this.isTilemapEnabled()) {
      return result;
    }

    const scrollX = this.getScrollX();
    const scrollY = this.getScrollY();

    const worldX = sprite.x + scrollX;
    const worldY = sprite.y + scrollY;

    const startTileX = Math.floor(worldX / TILE_SIZE);
    const endTileX = Math.floor((worldX + SPRITE_SIZE - 1) / TILE_SIZE);
    const startTileY = Math.floor(worldY / TILE_SIZE);
    const endTileY = Math.floor((worldY + SPRITE_SIZE - 1) / TILE_SIZE);

    for (let tileY = startTileY; tileY <= endTileY; tileY++) {
      for (let tileX = startTileX; tileX <= endTileX; tileX++) {
        const tileType = getTileAt(tileX, tileY);

        if (tileType !== null) {
          result.push({
            tileX,
            tileY,
            tileType,
            properties: this.getTileProperties(tileType),
          });
        }
      }
    }

    return result;
  }
}

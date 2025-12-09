/**
 * Sprite placement utilities for the tilemap editor
 * Handles .sbin file parsing/serialization and sprite manipulation
 */

// Placed sprite in the level
export interface LevelSprite {
  id: number;           // Unique ID within this level (for selection tracking)
  x: number;            // World X coordinate (pixels)
  y: number;            // World Y coordinate (pixels)
  spriteIndex: number;  // Sprite graphics index (0-255)
  flipH: boolean;
  flipV: boolean;
  priority: boolean;    // true = render behind tiles
  paletteOffset: number; // 0-3
  bankOffset: number;   // 0-3
  typeId: number;       // Game-specific type identifier (0-255)
}

// Editor mode
export type EditorMode = 'tile' | 'sprite';

// Sprite-specific tools
export type SpriteTool = 'place' | 'select' | 'delete';

// Sprite clipboard for copy/paste
export interface SpriteClipboard {
  sprites: Omit<LevelSprite, 'id'>[]; // IDs assigned on paste
  anchorX: number; // Reference point for relative positioning
  anchorY: number;
}

// Constants
const SBIN_HEADER_SIZE = 8;
const SBIN_SPRITE_SIZE = 8;
const SBIN_VERSION = 1;

/**
 * Parse flags byte into individual attributes
 */
function parseFlags(flags: number): Pick<LevelSprite, 'flipH' | 'flipV' | 'priority' | 'paletteOffset'> {
  return {
    flipH: (flags & 0x80) !== 0,
    flipV: (flags & 0x40) !== 0,
    priority: (flags & 0x20) !== 0,
    paletteOffset: (flags >> 3) & 0x03,
  };
}

/**
 * Encode sprite attributes to flags byte
 */
function encodeFlags(sprite: LevelSprite): number {
  let flags = 0;
  if (sprite.flipH) flags |= 0x80;
  if (sprite.flipV) flags |= 0x40;
  if (sprite.priority) flags |= 0x20;
  flags |= (sprite.paletteOffset & 0x03) << 3;
  return flags;
}

/**
 * Parse .sbin file data into sprite array
 */
export function parseSbin(data: Uint8Array): LevelSprite[] {
  if (data.length < SBIN_HEADER_SIZE) {
    console.warn('sbin file too small, returning empty sprites');
    return [];
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  // Read header
  const spriteCount = view.getUint16(0, true);
  const version = view.getUint16(2, true);

  if (version !== SBIN_VERSION) {
    console.warn(`Unknown sbin version ${version}, attempting to parse anyway`);
  }

  const expectedSize = SBIN_HEADER_SIZE + spriteCount * SBIN_SPRITE_SIZE;
  if (data.length < expectedSize) {
    console.warn(`sbin file truncated: expected ${expectedSize} bytes, got ${data.length}`);
  }

  const sprites: LevelSprite[] = [];

  for (let i = 0; i < spriteCount; i++) {
    const offset = SBIN_HEADER_SIZE + i * SBIN_SPRITE_SIZE;
    if (offset + SBIN_SPRITE_SIZE > data.length) break;

    const x = view.getUint16(offset + 0, true);
    const y = view.getUint16(offset + 2, true);
    const spriteIndex = data[offset + 4];
    const flags = data[offset + 5];
    const bankOffset = data[offset + 6];
    const typeId = data[offset + 7];

    const parsedFlags = parseFlags(flags);

    sprites.push({
      id: i + 1, // IDs start at 1
      x,
      y,
      spriteIndex,
      ...parsedFlags,
      bankOffset,
      typeId,
    });
  }

  return sprites;
}

/**
 * Serialize sprites to .sbin format
 */
export function serializeSbin(sprites: LevelSprite[]): Uint8Array {
  const buffer = new Uint8Array(SBIN_HEADER_SIZE + sprites.length * SBIN_SPRITE_SIZE);
  const view = new DataView(buffer.buffer);

  // Header
  view.setUint16(0, sprites.length, true);  // sprite count
  view.setUint16(2, SBIN_VERSION, true);    // version
  view.setUint32(4, 0, true);               // reserved

  // Sprites
  sprites.forEach((sprite, i) => {
    const offset = SBIN_HEADER_SIZE + i * SBIN_SPRITE_SIZE;
    view.setUint16(offset + 0, sprite.x, true);
    view.setUint16(offset + 2, sprite.y, true);
    buffer[offset + 4] = sprite.spriteIndex;
    buffer[offset + 5] = encodeFlags(sprite);
    buffer[offset + 6] = sprite.bankOffset;
    buffer[offset + 7] = sprite.typeId;
  });

  return buffer;
}

/**
 * Create an empty .sbin file (just header with sprite_count=0)
 */
export function createEmptySbin(): Uint8Array {
  const buffer = new Uint8Array(SBIN_HEADER_SIZE);
  const view = new DataView(buffer.buffer);
  view.setUint16(0, 0, true);           // sprite count = 0
  view.setUint16(2, SBIN_VERSION, true); // version
  view.setUint32(4, 0, true);           // reserved
  return buffer;
}

/**
 * Generate unique sprite ID
 */
export function generateSpriteId(existing: LevelSprite[]): number {
  if (existing.length === 0) return 1;
  return Math.max(...existing.map(s => s.id)) + 1;
}

/**
 * Create a new sprite with default attributes
 */
export function createSprite(
  id: number,
  x: number,
  y: number,
  spriteIndex: number,
  defaults?: Partial<LevelSprite>
): LevelSprite {
  return {
    id,
    x,
    y,
    spriteIndex,
    flipH: defaults?.flipH ?? false,
    flipV: defaults?.flipV ?? false,
    priority: defaults?.priority ?? false,
    paletteOffset: defaults?.paletteOffset ?? 0,
    bankOffset: defaults?.bankOffset ?? 0,
    typeId: defaults?.typeId ?? 0,
  };
}

/**
 * Hit test: find sprite at given world coordinates
 * Assumes 16x16 sprite size
 */
export function findSpriteAt(
  sprites: LevelSprite[],
  x: number,
  y: number,
  spriteSize: number = 16
): LevelSprite | null {
  // Search in reverse order so topmost (last added) sprites are hit first
  for (let i = sprites.length - 1; i >= 0; i--) {
    const sprite = sprites[i];
    if (
      x >= sprite.x &&
      x < sprite.x + spriteSize &&
      y >= sprite.y &&
      y < sprite.y + spriteSize
    ) {
      return sprite;
    }
  }
  return null;
}

/**
 * Find all sprites within a rectangle (for marquee selection)
 */
export function findSpritesInRect(
  sprites: LevelSprite[],
  rect: { x: number; y: number; width: number; height: number },
  spriteSize: number = 16
): LevelSprite[] {
  const rectRight = rect.x + rect.width;
  const rectBottom = rect.y + rect.height;

  return sprites.filter(sprite => {
    const spriteRight = sprite.x + spriteSize;
    const spriteBottom = sprite.y + spriteSize;

    // Check for intersection
    return (
      sprite.x < rectRight &&
      spriteRight > rect.x &&
      sprite.y < rectBottom &&
      spriteBottom > rect.y
    );
  });
}

/**
 * Get the sbin path for a given tbin path
 */
export function getSbinPath(tbinPath: string): string {
  return tbinPath.replace(/\.tbin$/, '.sbin');
}

/**
 * Clone a sprite with a new ID
 */
export function cloneSprite(sprite: LevelSprite, newId: number, offsetX: number = 0, offsetY: number = 0): LevelSprite {
  return {
    ...sprite,
    id: newId,
    x: sprite.x + offsetX,
    y: sprite.y + offsetY,
  };
}

/**
 * Clone multiple sprites for clipboard/paste operations
 */
export function cloneSpritesForClipboard(sprites: LevelSprite[]): SpriteClipboard | null {
  if (sprites.length === 0) return null;

  // Find the top-left corner as anchor
  const minX = Math.min(...sprites.map(s => s.x));
  const minY = Math.min(...sprites.map(s => s.y));

  return {
    sprites: sprites.map(({ id, ...rest }) => rest),
    anchorX: minX,
    anchorY: minY,
  };
}

/**
 * Paste sprites from clipboard at a new position
 */
export function pasteSprites(
  clipboard: SpriteClipboard,
  targetX: number,
  targetY: number,
  existingSprites: LevelSprite[]
): LevelSprite[] {
  let nextId = generateSpriteId(existingSprites);

  return clipboard.sprites.map(sprite => ({
    ...sprite,
    id: nextId++,
    x: sprite.x - clipboard.anchorX + targetX,
    y: sprite.y - clipboard.anchorY + targetY,
  }));
}

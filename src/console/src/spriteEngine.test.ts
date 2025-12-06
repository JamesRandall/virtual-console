import { describe, it, expect, beforeEach } from 'vitest';
import {
  SpriteEngine,
  SPRITE_ENABLE,
  SPRITE_COUNT,
  SPRITE_GRAPHICS_BANK,
  SPRITE_OVERFLOW,
  COLLISION_FLAGS,
  COLLISION_COUNT,
  COLLISION_MODE,
  SPRITE_SCANLINE_LIMIT,
  SPRITE_TABLE_START,
  COLLISION_BUFFER_START,
  MAX_SPRITES,
  SPRITE_SIZE,
  SPRITE_ATTR_SIZE,
  SPRITE_BYTES_4BPP,
  FLAG_FLIP_H,
  FLAG_FLIP_V,
  FLAG_PRIORITY_BEHIND,
  COLLISION_SPRITE_SPRITE,
  COLLISION_TYPE_SPRITE,
  DEFAULT_SCANLINE_LIMIT,
} from './spriteEngine';
import { BankedMemory, createSharedMemory, LOWER_MEMORY_SIZE, BANK_SIZE } from './bankedMemory';

describe('SpriteEngine', () => {
  let lowerMemory: Uint8Array;
  let bankedMemory: BankedMemory;
  let spriteEngine: SpriteEngine;
  let sharedBuffer: SharedArrayBuffer;

  beforeEach(() => {
    // Create shared memory with some cartridge banks for sprites
    sharedBuffer = createSharedMemory(4);
    bankedMemory = new BankedMemory(sharedBuffer);
    lowerMemory = new Uint8Array(sharedBuffer, 0, LOWER_MEMORY_SIZE);
    lowerMemory.fill(0);
    spriteEngine = new SpriteEngine(lowerMemory, bankedMemory);
  });

  describe('isEnabled', () => {
    it('returns false when sprites are disabled', () => {
      lowerMemory[SPRITE_ENABLE] = 0x00;
      expect(spriteEngine.isEnabled()).toBe(false);
    });

    it('returns true when sprites are enabled', () => {
      lowerMemory[SPRITE_ENABLE] = 0x01;
      expect(spriteEngine.isEnabled()).toBe(true);
    });
  });

  describe('getSpriteCount', () => {
    it('returns sprite count from register', () => {
      lowerMemory[SPRITE_COUNT] = 10;
      expect(spriteEngine.getSpriteCount()).toBe(10);
    });

    it('caps sprite count at MAX_SPRITES', () => {
      lowerMemory[SPRITE_COUNT] = 200;
      expect(spriteEngine.getSpriteCount()).toBe(MAX_SPRITES);
    });
  });

  describe('getScanlineLimit', () => {
    it('returns default limit when register is 0', () => {
      lowerMemory[SPRITE_SCANLINE_LIMIT] = 0;
      expect(spriteEngine.getScanlineLimit()).toBe(DEFAULT_SCANLINE_LIMIT);
    });

    it('returns custom limit', () => {
      lowerMemory[SPRITE_SCANLINE_LIMIT] = 12;
      expect(spriteEngine.getScanlineLimit()).toBe(12);
    });

    it('caps limit at 16', () => {
      lowerMemory[SPRITE_SCANLINE_LIMIT] = 32;
      expect(spriteEngine.getScanlineLimit()).toBe(16);
    });
  });

  describe('readSpriteAttribute', () => {
    it('reads sprite attributes from memory', () => {
      const spriteId = 5;
      const baseAddr = SPRITE_TABLE_START + spriteId * SPRITE_ATTR_SIZE;

      lowerMemory[baseAddr + 0] = 100; // X
      lowerMemory[baseAddr + 1] = 50;  // Y
      lowerMemory[baseAddr + 2] = 10;  // Sprite index
      lowerMemory[baseAddr + 3] = 0x00; // Flags
      lowerMemory[baseAddr + 4] = 18;  // Bank

      const attr = spriteEngine.readSpriteAttribute(spriteId);

      expect(attr.x).toBe(100);
      expect(attr.y).toBe(50);
      expect(attr.spriteIndex).toBe(10);
      expect(attr.flags).toBe(0x00);
      expect(attr.bank).toBe(18);
      expect(attr.flipH).toBe(false);
      expect(attr.flipV).toBe(false);
      expect(attr.priorityBehind).toBe(false);
      expect(attr.paletteOffset).toBe(0);
    });

    it('parses flip flags correctly', () => {
      const spriteId = 0;
      const baseAddr = SPRITE_TABLE_START;

      lowerMemory[baseAddr + 3] = FLAG_FLIP_H | FLAG_FLIP_V;

      const attr = spriteEngine.readSpriteAttribute(spriteId);

      expect(attr.flipH).toBe(true);
      expect(attr.flipV).toBe(true);
    });

    it('parses priority flag correctly', () => {
      const spriteId = 0;
      const baseAddr = SPRITE_TABLE_START;

      lowerMemory[baseAddr + 3] = FLAG_PRIORITY_BEHIND;

      const attr = spriteEngine.readSpriteAttribute(spriteId);

      expect(attr.priorityBehind).toBe(true);
    });

    it('parses palette offset correctly', () => {
      const spriteId = 0;
      const baseAddr = SPRITE_TABLE_START;

      // Palette offset is bits 4-3
      lowerMemory[baseAddr + 3] = 0x18; // Binary: 00011000 = palette 3

      const attr = spriteEngine.readSpriteAttribute(spriteId);

      expect(attr.paletteOffset).toBe(3);
    });
  });

  describe('evaluateSprites', () => {
    beforeEach(() => {
      lowerMemory[SPRITE_ENABLE] = 0x01;
    });

    it('returns empty array when sprites are disabled', () => {
      lowerMemory[SPRITE_ENABLE] = 0x00;
      lowerMemory[SPRITE_COUNT] = 1;

      const sprites = spriteEngine.evaluateSprites(50);

      expect(sprites).toHaveLength(0);
    });

    it('finds sprites intersecting scanline', () => {
      lowerMemory[SPRITE_COUNT] = 3;

      // Sprite 0: Y=40, height=16, so visible on scanlines 40-55
      setSprite(0, 0, 40, 0, 0, 0);
      // Sprite 1: Y=50, visible on scanlines 50-65
      setSprite(1, 0, 50, 0, 0, 0);
      // Sprite 2: Y=100, visible on scanlines 100-115
      setSprite(2, 0, 100, 0, 0, 0);

      // Scanline 52 should intersect sprites 0 and 1
      const sprites = spriteEngine.evaluateSprites(52);

      expect(sprites).toHaveLength(2);
      expect(sprites[0].id).toBe(0);
      expect(sprites[1].id).toBe(1);
    });

    it('respects scanline limit', () => {
      lowerMemory[SPRITE_COUNT] = 12;
      lowerMemory[SPRITE_SCANLINE_LIMIT] = 8;

      // Put all sprites on the same scanline
      for (let i = 0; i < 12; i++) {
        setSprite(i, i * 20, 50, 0, 0, 0);
      }

      const sprites = spriteEngine.evaluateSprites(55);

      expect(sprites).toHaveLength(8);
      expect(spriteEngine.hasOverflow()).toBe(true);
    });

    it('calculates correct sprite row', () => {
      lowerMemory[SPRITE_COUNT] = 1;
      setSprite(0, 0, 40, 0, 0, 0);

      // Scanline 45 is row 5 of the sprite (45 - 40 = 5)
      const sprites = spriteEngine.evaluateSprites(45);

      expect(sprites[0].row).toBe(5);
    });

    it('applies vertical flip to row calculation', () => {
      lowerMemory[SPRITE_COUNT] = 1;
      setSprite(0, 0, 40, 0, FLAG_FLIP_V, 0);

      // Scanline 45 is normally row 5, but flipped it's row 10 (15 - 5)
      const sprites = spriteEngine.evaluateSprites(45);

      expect(sprites[0].row).toBe(10);
    });
  });

  describe('getPixelFromLineData', () => {
    it('extracts pixels from 4bpp line data', () => {
      const lineData = new Uint8Array([0xAB, 0xCD, 0xEF, 0x12, 0x34, 0x56, 0x78, 0x9A]);

      // Even pixels use high nibble
      expect(spriteEngine.getPixelFromLineData(lineData, 0, false)).toBe(0x0A); // High nibble of 0xAB
      expect(spriteEngine.getPixelFromLineData(lineData, 2, false)).toBe(0x0C); // High nibble of 0xCD

      // Odd pixels use low nibble
      expect(spriteEngine.getPixelFromLineData(lineData, 1, false)).toBe(0x0B); // Low nibble of 0xAB
      expect(spriteEngine.getPixelFromLineData(lineData, 3, false)).toBe(0x0D); // Low nibble of 0xCD
    });

    it('applies horizontal flip', () => {
      const lineData = new Uint8Array([0xAB, 0xCD, 0xEF, 0x12, 0x34, 0x56, 0x78, 0x9A]);

      // Pixel 0 flipped becomes pixel 15
      expect(spriteEngine.getPixelFromLineData(lineData, 0, true)).toBe(0x0A); // Low nibble of 0x9A (pixel 15)

      // Pixel 15 flipped becomes pixel 0
      expect(spriteEngine.getPixelFromLineData(lineData, 15, true)).toBe(0x0A); // High nibble of 0xAB (pixel 0)
    });
  });

  describe('renderScanline', () => {
    beforeEach(() => {
      lowerMemory[SPRITE_ENABLE] = 0x01;
    });

    it('returns empty buffer when sprites disabled', () => {
      lowerMemory[SPRITE_ENABLE] = 0x00;
      lowerMemory[SPRITE_COUNT] = 1;
      setSprite(0, 100, 50, 0, 0, 0);

      const buffer = spriteEngine.renderScanline(55, 256);

      expect(buffer.every(v => v === 0)).toBe(true);
    });

    it('renders sprite pixels at correct screen positions', () => {
      lowerMemory[SPRITE_COUNT] = 1;

      // Put sprite at X=100, Y=50
      setSprite(0, 100, 50, 0, 0, 0);

      // Write some sprite graphics data to bank 0
      writeSpriteGraphics(0, 0);

      const buffer = spriteEngine.renderScanline(50, 256);

      // Pixels 100-115 should have sprite data
      // (The actual values depend on what we wrote to sprite graphics)
      expect(buffer[99]).toBe(0);  // Before sprite
      expect(buffer[116]).toBe(0); // After sprite
    });

    it('respects transparency (color 0)', () => {
      lowerMemory[SPRITE_COUNT] = 1;
      setSprite(0, 100, 50, 0, 0, 0);

      // Write sprite with transparent pixels
      const spriteData = bankedMemory.getRamBankView(0);
      spriteData.fill(0); // All transparent

      const buffer = spriteEngine.renderScanline(50, 256);

      // Should all be 0 because sprite is transparent
      expect(buffer[100]).toBe(0);
    });

    it('applies palette offset', () => {
      lowerMemory[SPRITE_COUNT] = 1;

      // Palette offset 2 (bits 4-3 = 0x10)
      setSprite(0, 100, 50, 0, 0x10, 0);

      // Write a non-transparent pixel (value 1) to sprite graphics
      const spriteData = bankedMemory.getRamBankView(0);
      spriteData[0] = 0x10; // Pixel 0 = 1 (high nibble)

      const buffer = spriteEngine.renderScanline(50, 256);

      // Color 1 with palette offset 2 = 1 + 2*16 = 33
      expect(buffer[100]).toBe(33);
    });
  });

  describe('collision detection', () => {
    beforeEach(() => {
      lowerMemory[SPRITE_ENABLE] = 0x01;
      lowerMemory[COLLISION_MODE] = COLLISION_SPRITE_SPRITE;
    });

    it('detects sprite-sprite collisions during rendering', () => {
      lowerMemory[SPRITE_COUNT] = 2;

      // Two overlapping sprites
      setSprite(0, 100, 50, 0, 0, 0);
      setSprite(1, 108, 50, 0, 0, 0); // Overlaps by 8 pixels

      // Write non-transparent pixels
      const spriteData = bankedMemory.getRamBankView(0);
      for (let i = 0; i < SPRITE_BYTES_4BPP; i++) {
        spriteData[i] = 0x11; // Color 1 for all pixels
      }

      spriteEngine.resetFrame();
      spriteEngine.renderScanline(50, 256);
      spriteEngine.finalizeFrame();

      const collisions = spriteEngine.getCollisions();
      expect(collisions.length).toBeGreaterThan(0);

      // Lower sprite ID should be recorded as primary
      expect(collisions[0].spriteId).toBe(0);
      expect(collisions[0].data).toBe(1);
      expect(collisions[0].typeFlags).toBe(COLLISION_TYPE_SPRITE);
    });

    it('does not detect collisions when mode is disabled', () => {
      lowerMemory[COLLISION_MODE] = 0; // Disable all collision detection
      lowerMemory[SPRITE_COUNT] = 2;

      setSprite(0, 100, 50, 0, 0, 0);
      setSprite(1, 108, 50, 0, 0, 0);

      const spriteData = bankedMemory.getRamBankView(0);
      for (let i = 0; i < SPRITE_BYTES_4BPP; i++) {
        spriteData[i] = 0x11;
      }

      spriteEngine.resetFrame();
      spriteEngine.renderScanline(50, 256);
      spriteEngine.finalizeFrame();

      expect(spriteEngine.getCollisions()).toHaveLength(0);
    });

    it('writes collision data to buffer on finalizeFrame', () => {
      lowerMemory[SPRITE_COUNT] = 2;

      setSprite(0, 100, 50, 0, 0, 0);
      setSprite(1, 108, 50, 0, 0, 0);

      const spriteData = bankedMemory.getRamBankView(0);
      for (let i = 0; i < SPRITE_BYTES_4BPP; i++) {
        spriteData[i] = 0x11;
      }

      spriteEngine.resetFrame();
      spriteEngine.renderScanline(50, 256);
      spriteEngine.finalizeFrame();

      // Check collision count register
      expect(lowerMemory[COLLISION_COUNT]).toBeGreaterThan(0);

      // Check collision flags
      expect(lowerMemory[COLLISION_FLAGS] & 0x01).toBe(1); // Sprite-sprite collision flag
    });
  });

  describe('resetFrame', () => {
    it('clears collision data', () => {
      lowerMemory[COLLISION_FLAGS] = 0x03;
      lowerMemory[COLLISION_COUNT] = 10;
      lowerMemory[SPRITE_OVERFLOW] = 0x01;

      spriteEngine.resetFrame();

      expect(lowerMemory[COLLISION_FLAGS]).toBe(0);
      expect(lowerMemory[COLLISION_COUNT]).toBe(0);
      expect(lowerMemory[SPRITE_OVERFLOW]).toBe(0);
    });
  });

  describe('bounding box collision', () => {
    beforeEach(() => {
      lowerMemory[SPRITE_ENABLE] = 0x01;
      lowerMemory[COLLISION_MODE] = COLLISION_SPRITE_SPRITE; // Bounding box mode
    });

    it('detects overlapping sprites', () => {
      lowerMemory[SPRITE_COUNT] = 2;

      setSprite(0, 100, 100, 0, 0, 0);
      setSprite(1, 110, 110, 0, 0, 0); // Overlaps

      spriteEngine.resetFrame();
      spriteEngine.detectBoundingBoxCollisions();

      const collisions = spriteEngine.getCollisions();
      expect(collisions).toHaveLength(1);
      expect(collisions[0].spriteId).toBe(0);
      expect(collisions[0].data).toBe(1);
    });

    it('does not detect non-overlapping sprites', () => {
      lowerMemory[SPRITE_COUNT] = 2;

      setSprite(0, 0, 0, 0, 0, 0);
      setSprite(1, 100, 100, 0, 0, 0); // No overlap

      spriteEngine.resetFrame();
      spriteEngine.detectBoundingBoxCollisions();

      expect(spriteEngine.getCollisions()).toHaveLength(0);
    });
  });

  // Helper functions

  function setSprite(id: number, x: number, y: number, index: number, flags: number, bank: number) {
    const baseAddr = SPRITE_TABLE_START + id * SPRITE_ATTR_SIZE;
    lowerMemory[baseAddr + 0] = x;
    lowerMemory[baseAddr + 1] = y;
    lowerMemory[baseAddr + 2] = index;
    lowerMemory[baseAddr + 3] = flags;
    lowerMemory[baseAddr + 4] = bank;
  }

  function writeSpriteGraphics(bank: number, spriteIndex: number) {
    // Write a simple pattern to sprite graphics
    const bankView = bankedMemory.getRamBankView(bank);
    const offset = spriteIndex * SPRITE_BYTES_4BPP;

    for (let row = 0; row < SPRITE_SIZE; row++) {
      for (let col = 0; col < SPRITE_SIZE / 2; col++) {
        // Alternate colors
        bankView[offset + row * 8 + col] = 0x12; // Pixel values 1 and 2
      }
    }
  }
});

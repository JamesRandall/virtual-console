# Tilemap System Implementation Plan

## Overview

This document outlines the implementation plan for the tilemap rendering system. The implementation follows the established patterns from the sprite system, with a split between:

- **TilemapEngine** (`/src/console/src/tilemapEngine.ts`) - Core rendering logic
- **TilemapRenderer** (`/src/devkit/client/src/consoleIntegration/tilemapRenderer.ts`) - Client-side integration

The tilemap system uses the same SharedArrayBuffer architecture as sprites, with the CPU running in a web worker and rendering on the main thread.

---

## Architecture

### Data Flow

```
CPU Worker (3MHz)
├── Writes tilemap registers (0x013D-0x0148)
├── Writes tile properties (0x0A80-0x0AFF)
└── Tilemap data stored in cartridge ROM (banks 16+) or RAM (banks 0-3)
        │
        ▼
Main Thread - Render Loop (60Hz)
├── TilemapRenderer reads registers from SharedArrayBuffer
├── TilemapEngine renders each scanline:
│   ├── calculateVisibleTiles() - determine tiles for scanline
│   ├── fetchTileData() - read tile index + attributes from tilemap bank
│   ├── fetchTileGraphics() - read pixel data from graphics bank
│   ├── applyTileAttributes() - flip, palette, priority
│   └── renderScanlineToBuffer() - output pixel buffer
├── Composite with sprites based on priority
└── Upload to GPU for final display
```

### Memory Layout

| Address Range | Size | Description |
|---------------|------|-------------|
| 0x013D-0x0148 | 12 B | Tilemap control registers |
| 0x0A80-0x0AFF | 128 B | Tile properties table |
| Banks 16-31 | 512 KB | Tile graphics (convention) |
| Banks 32+ | Variable | Tilemap data storage |

---

## Phase 1: TilemapEngine Core

**File:** `/src/console/src/tilemapEngine.ts`

### Register Constants

```typescript
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

// Tile constants
export const TILE_SIZE = 16; // 16x16 pixels
export const TILE_BYTES_4BPP = 128; // 16x16 / 2
export const TILE_BYTES_8BPP = 256; // 16x16 x 1
export const EMPTY_TILE_INDEX = 0; // Tile index 0 = transparent/empty

// Tile property flags
export const TILE_SOLID = 0x80;
export const TILE_HAZARD = 0x40;
export const TILE_ANIMATED = 0x10;

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
```

### TilemapEngine Class

```typescript
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

  constructor(lowerMemory: Uint8Array, bankedMemory: BankedMemory, maxScreenWidth: number = 256);

  // Register access
  isEnabled(): boolean;
  getScrollX(): number;  // 16-bit combined from LO/HI
  getScrollY(): number;  // 16-bit combined from LO/HI
  getWidth(): number;    // tilemap width in tiles
  getHeight(): number;   // tilemap height in tiles
  getGraphicsBank(): number;
  getDataBank(): number;
  getDataAddress(): number;  // 16-bit combined from HI/LO
  getAnimFrame(): number;
  getEnableFlags(): number;

  // Tile access
  readTileEntry(tileX: number, tileY: number): TileEntry;
  getTileProperties(tileIndex: number): number;

  // Animation
  getAnimatedTileIndex(baseTile: number, properties: number): number;

  // Rendering
  renderScanline(scanline: number, screenWidth: number): Uint8Array;

  // For collision detection
  getTileAt(worldX: number, worldY: number): TileEntry | null;
}
```

### Key Implementation Details

#### 16-bit Scroll Register Access

```typescript
getScrollX(): number {
  const lo = this.lowerMemory[TILEMAP_X_SCROLL_LO];
  const hi = this.lowerMemory[TILEMAP_X_SCROLL_HI];
  return (hi << 8) | lo;
}

getScrollY(): number {
  const lo = this.lowerMemory[TILEMAP_Y_SCROLL_LO];
  const hi = this.lowerMemory[TILEMAP_Y_SCROLL_HI];
  return (hi << 8) | lo;
}
```

#### Reading Tile Entries (2 bytes per tile)

```typescript
readTileEntry(tileX: number, tileY: number): TileEntry {
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
```

#### Scanline Rendering Algorithm

```typescript
renderScanline(scanline: number, screenWidth: number): Uint8Array {
  this.scanlineBuffer.fill(0);

  if (!this.isEnabled()) {
    return this.scanlineBuffer.slice(0, screenWidth);
  }

  const scrollX = this.getScrollX();
  const scrollY = this.getScrollY();
  const graphicsBank = this.getGraphicsBank();
  const enableFlags = this.getEnableFlags();
  const priorityMode = (enableFlags & TILEMAP_FLAG_PRIORITY_MODE) !== 0;

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
    const pixel = this.fetchTilePixel(
      bank,
      finalTileIndex,
      pixelX,
      pixelY,
      tile.flipH,
      tile.flipV
    );

    // Transparency check
    if (pixel === 0) {
      continue;
    }

    // Apply palette offset (per-tile, NOT scanline palette map)
    const finalColor = pixel + tile.paletteOffset * 16;

    this.scanlineBuffer[screenX] = finalColor;
  }

  return this.scanlineBuffer.slice(0, screenWidth);
}
```

#### Fetching Tile Pixels

```typescript
fetchTilePixel(
  bank: number,
  tileIndex: number,
  x: number,
  y: number,
  flipH: boolean,
  flipV: boolean
): number {
  // Apply flipping
  let pixelX = flipH ? (TILE_SIZE - 1 - x) : x;
  let pixelY = flipV ? (TILE_SIZE - 1 - y) : y;

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
```

---

## Phase 2: TilemapRenderer Client Integration

**File:** `/src/devkit/client/src/consoleIntegration/tilemapRenderer.ts`

### TilemapRenderer Class

```typescript
export class TilemapRenderer {
  private readonly memoryView: Uint8Array;
  private readonly tilemapEngine: TilemapEngine;
  private readonly lowerMemory: Uint8Array;

  constructor(sharedBuffer: SharedArrayBuffer, bankedMemory: BankedMemory);

  // Delegate to engine
  isEnabled(): boolean;
  getScrollX(): number;
  getScrollY(): number;

  // Rendering
  renderScanline(scanline: number, screenWidth: number): Uint8Array;

  // For debugging/visualization
  getTileAt(tileX: number, tileY: number): TileEntry | null;
  getTileAsRGBA(tileIndex: number, bank: number, palette: readonly [number, number, number][]): Uint8ClampedArray;

  // Access engine for collision detection
  getEngine(): TilemapEngine;
}
```

---

## Phase 3: WebGPU Integration

**File:** `/src/devkit/client/src/consoleIntegration/webgpuRendering.ts`

### Changes Required

1. **Add TilemapRenderer creation:**
```typescript
let tilemapRenderer: TilemapRenderer | null = null;
if (bankedMemory) {
  tilemapRenderer = new TilemapRenderer(sharedMemory, bankedMemory);
}
```

2. **Add tilemap overlay buffer:**
```typescript
const tilemapOverlayBuffer = device.createBuffer({
  size: FRAMEBUFFER_SIZE,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
});

const tilemapOverlayData = new Uint8Array(FRAMEBUFFER_SIZE);
```

3. **Render tilemap in frame loop:**
```typescript
// In renderFrame():

// Clear tilemap buffer
tilemapOverlayData.fill(0);

// Render tilemap if enabled
const TILEMAP_ENABLE_ADDR = 0x013d;
if (tilemapRenderer && (memory[TILEMAP_ENABLE_ADDR] & 0x01) !== 0) {
  for (let y = 0; y < SCREEN_HEIGHT; y++) {
    const scanlineBuffer = tilemapRenderer.renderScanline(y, SCREEN_WIDTH);

    // Copy to overlay in 4bpp format
    for (let x = 0; x < SCREEN_WIDTH; x++) {
      const colorIndex = scanlineBuffer[x];
      if (colorIndex !== 0) {
        const pixelIndex = y * SCREEN_WIDTH + x;
        const byteIndex = Math.floor(pixelIndex / 2);
        if (pixelIndex % 2 === 0) {
          tilemapOverlayData[byteIndex] = (tilemapOverlayData[byteIndex] & 0x0f) | ((colorIndex & 0x0f) << 4);
        } else {
          tilemapOverlayData[byteIndex] = (tilemapOverlayData[byteIndex] & 0xf0) | (colorIndex & 0x0f);
        }
      }
    }
  }
}
```

4. **Update shader for layer compositing:**

The shader needs to composite layers in this order:
1. Direct framebuffer (background)
2. Tilemap (priority=0 tiles, behind sprites)
3. Sprites (with PRIORITY_BEHIND)
4. Sprites (front priority)
5. Tilemap (priority=1 tiles, in front of sprites - if priority mode enabled)

**Simplified approach for initial implementation:**
- Render tilemap to background framebuffer on CPU before GPU upload
- Sprites composite on top via existing sprite overlay system

**Advanced approach (later):**
- Separate tilemap buffer in GPU
- Shader handles priority compositing

### Recommended Initial Approach

For simplicity, render tilemap directly to the framebuffer region (0xB000-0xEFFF) before sprites:

```typescript
// Render tilemap to framebuffer (replaces/merges with direct framebuffer content)
if (tilemapRenderer && (memory[TILEMAP_ENABLE_ADDR] & 0x01) !== 0) {
  for (let y = 0; y < SCREEN_HEIGHT; y++) {
    const scanlineBuffer = tilemapRenderer.renderScanline(y, SCREEN_WIDTH);

    for (let x = 0; x < SCREEN_WIDTH; x++) {
      const colorIndex = scanlineBuffer[x];
      if (colorIndex !== 0) {
        // Write directly to framebuffer region
        const pixelIndex = y * SCREEN_WIDTH + x;
        const byteIndex = FRAMEBUFFER_START + Math.floor(pixelIndex / 2);
        if (pixelIndex % 2 === 0) {
          memory[byteIndex] = (memory[byteIndex] & 0x0f) | ((colorIndex & 0x0f) << 4);
        } else {
          memory[byteIndex] = (memory[byteIndex] & 0xf0) | (colorIndex & 0x0f);
        }
      }
    }
  }
}
```

This approach:
- Works with existing shader unchanged
- Tilemap pixels use per-tile palette (written as final palette index)
- Sprites still use scanline palette map (via existing overlay system)

**Issue:** This doesn't respect the separate palette systems described in the spec.

### Correct Approach: Separate Tilemap Palette Handling

The tilemap uses per-tile palette selection, NOT the scanline palette map. The shader needs modification:

```wgsl
// Add tilemap overlay buffer
@group(0) @binding(5) var<storage, read> tilemapOverlay: array<u32>;
@group(0) @binding(6) var<storage, read> tilemapMask: array<u32>;

@fragment
fn fragmentMain(@location(0) texCoord: vec2f) -> @location(0) vec4f {
  let x = u32(texCoord.x * 256.0);
  let y = u32(texCoord.y * 160.0);

  if (x >= 256u || y >= 160u) {
    return vec4f(0.0, 0.0, 0.0, 1.0);
  }

  let pixelIndex = y * 256u + x;
  let byteIndex = pixelIndex / 2u;

  // Check tilemap pixel (uses per-tile palette, already resolved to master palette index)
  let hasTilemapPixel = readByte(&tilemapMask, pixelIndex) != 0u;
  let hasSpritePixel = readByte(&spriteMask, pixelIndex) != 0u;

  var masterPaletteIndex: u32;

  if (hasSpritePixel) {
    // Sprite: use scanline palette map
    let spriteByte = readByte(&spriteOverlay, byteIndex);
    var colorIndex: u32;
    if ((pixelIndex & 1u) == 0u) {
      colorIndex = (spriteByte >> 4u) & 0xFu;
    } else {
      colorIndex = spriteByte & 0xFu;
    }
    let paletteSelector = readByte(&scanlineMap, y);
    let paletteIndex = paletteSelector * 16u + colorIndex;
    masterPaletteIndex = readByte(&paletteRam, paletteIndex);
  } else if (hasTilemapPixel) {
    // Tilemap: palette already resolved by TilemapEngine
    // tilemapOverlay contains master palette indices directly
    masterPaletteIndex = readByte(&tilemapOverlay, pixelIndex);
  } else {
    // Background framebuffer: use scanline palette map
    let byte = readByte(&framebuffer, byteIndex);
    var colorIndex: u32;
    if ((pixelIndex & 1u) == 0u) {
      colorIndex = (byte >> 4u) & 0xFu;
    } else {
      colorIndex = byte & 0xFu;
    }
    let paletteSelector = readByte(&scanlineMap, y);
    let paletteIndex = paletteSelector * 16u + colorIndex;
    masterPaletteIndex = readByte(&paletteRam, paletteIndex);
  }

  let rgb = PALETTE[masterPaletteIndex];
  return vec4f(rgb / 255.0, 1.0);
}
```

**Important:** TilemapEngine must output **master palette indices** (0-255), not raw color indices:

```typescript
// In TilemapEngine.renderScanline():
// Apply palette offset and resolve to master palette index
const paletteBaseIndex = tile.paletteOffset * 16 + pixel;
const masterPaletteIndex = this.lowerMemory[PALETTE_RAM_START + paletteBaseIndex];
this.scanlineBuffer[screenX] = masterPaletteIndex;
```

---

## Phase 4: CollisionDetector Updates

**File:** `/src/console/src/collisionDetector.ts`

### Register Address Updates

The current collisionDetector.ts has incorrect register addresses. Update to match spec:

```typescript
// OLD (incorrect)
export const TILEMAP_X_SCROLL = 0x013f;
export const TILEMAP_Y_SCROLL = 0x0140;
export const TILEMAP_WIDTH = 0x0141;
export const TILEMAP_HEIGHT = 0x0142;
export const TILEMAP_DATA_BANK = 0x0143;
export const TILEMAP_ADDR_HI = 0x0144;
export const TILEMAP_ADDR_LO = 0x0145;

// NEW (correct, matching tilemap.md)
export const TILEMAP_X_SCROLL_LO = 0x013f;
export const TILEMAP_X_SCROLL_HI = 0x0140;
export const TILEMAP_Y_SCROLL_LO = 0x0141;
export const TILEMAP_Y_SCROLL_HI = 0x0142;
export const TILEMAP_WIDTH = 0x0143;
export const TILEMAP_HEIGHT = 0x0144;
export const TILEMAP_DATA_BANK = 0x0145;
export const TILEMAP_ADDR_HI = 0x0146;
export const TILEMAP_ADDR_LO = 0x0147;
```

### 16-bit Scroll Support

Update scroll reading to use 16-bit registers:

```typescript
getScrollX(): number {
  const lo = this.lowerMemory[TILEMAP_X_SCROLL_LO];
  const hi = this.lowerMemory[TILEMAP_X_SCROLL_HI];
  return (hi << 8) | lo;
}

getScrollY(): number {
  const lo = this.lowerMemory[TILEMAP_Y_SCROLL_LO];
  const hi = this.lowerMemory[TILEMAP_Y_SCROLL_HI];
  return (hi << 8) | lo;
}
```

### Integration with TilemapEngine

The CollisionDetector should use TilemapEngine for tile lookups:

```typescript
constructor(
  lowerMemory: Uint8Array,
  spriteEngine: SpriteEngine,
  tilemapEngine?: TilemapEngine  // Add optional parameter
) {
  this.tilemapEngine = tilemapEngine;
}

// Use TilemapEngine for tile lookups if available
detectSpriteTileCollisions(): void {
  if (!this.tilemapEngine || !this.tilemapEngine.isEnabled()) {
    return;
  }

  const spriteCount = this.spriteEngine.getSpriteCount();

  for (let id = 0; id < spriteCount; id++) {
    const sprite = this.spriteEngine.readSpriteAttribute(id);
    this.checkSpriteCollisionWithEngine(id, sprite);
  }
}
```

---

## Phase 5: Priority Compositing

### Layer Order (bottom to top)

1. **Background** (direct framebuffer, palette index 0 = transparent)
2. **Tilemap priority=0** (behind sprites)
3. **Sprites with PRIORITY_BEHIND**
4. **Sprites with front priority**
5. **Tilemap priority=1** (in front of sprites, if TILEMAP_FLAG_PRIORITY_MODE set)

### Implementation Options

**Option A: CPU Compositing (Simpler)**

Composite all layers on CPU before GPU upload:
1. Render tilemap to temp buffer
2. Render sprites to temp buffer
3. Composite based on priority
4. Upload single composited framebuffer

**Option B: GPU Compositing (More Flexible)**

Pass all layers to GPU, composite in shader:
- More GPU buffers and bindings
- More complex shader logic
- Better for future effects (transparency, blending)

**Recommendation:** Start with Option A for simplicity. The current sprite system already does CPU-side rendering per scanline.

---

## Implementation Order

1. **Create TilemapEngine** (`/src/console/src/tilemapEngine.ts`)
   - Register reading
   - Tile entry parsing
   - Basic scanline rendering (no animation)

2. **Update CollisionDetector** register addresses
   - Fix register constants
   - Add 16-bit scroll support

3. **Create TilemapRenderer** (`/src/devkit/client/src/consoleIntegration/tilemapRenderer.ts`)
   - Wrapper around TilemapEngine
   - Debug/visualization helpers

4. **Integrate into WebGPU renderer**
   - Add tilemap rendering before sprites
   - Simple framebuffer approach first

5. **Add animation support** to TilemapEngine
   - Read TILE_ANIM_FRAME register
   - Calculate animated tile indices

6. **Add priority compositing**
   - Per-tile priority support
   - Correct layer ordering

7. **Update shader for separate palette handling**
   - Tilemap uses per-tile palette
   - Sprites/framebuffer use scanline palette

---

## Testing Strategy

### Unit Tests

1. **Register reading** - Verify 16-bit scroll, enable flags
2. **Tile entry parsing** - Verify 2-byte format parsing
3. **Coordinate wrapping** - Test wrap modes
4. **Palette application** - Per-tile palette selection
5. **Flip operations** - H/V flip correctness

### Integration Tests

1. **Simple tilemap** - Static 32x32 map
2. **Scrolling** - Large map with scroll
3. **Animation** - Animated water tiles
4. **Sprite interaction** - Sprites over tilemap
5. **Collision** - Sprite-tile collision detection

### Visual Tests

1. **Checkerboard pattern** - Verify tile alignment
2. **Palette variety** - Multiple palettes on same screen
3. **Scroll boundary** - Edge cases at map boundaries
4. **Priority layers** - Sprites behind/in front of tiles

---

## File Summary

| File | Action | Description |
|------|--------|-------------|
| `/src/console/src/tilemapEngine.ts` | Create | Core tilemap rendering engine |
| `/src/devkit/client/src/consoleIntegration/tilemapRenderer.ts` | Create | Client-side tilemap integration |
| `/src/devkit/client/src/consoleIntegration/webgpuRendering.ts` | Modify | Add tilemap rendering |
| `/src/console/src/collisionDetector.ts` | Modify | Fix register addresses, 16-bit scroll |
| `/src/console/src/spriteEngine.ts` | Reference | Pattern to follow |
| `/src/devkit/client/src/consoleIntegration/spriteRenderer.ts` | Reference | Pattern to follow |

---

## Constants Reference

### Registers (0x013D-0x0148)

| Address | Name | Description |
|---------|------|-------------|
| 0x013D | TILEMAP_ENABLE | Enable flags (bit 0=enable, 1=wrap_h, 2=wrap_v, 3=priority_mode) |
| 0x013E | TILEMAP_GRAPHICS_BANK | Bank containing tile graphics |
| 0x013F | TILEMAP_X_SCROLL_LO | X scroll low byte |
| 0x0140 | TILEMAP_X_SCROLL_HI | X scroll high byte |
| 0x0141 | TILEMAP_Y_SCROLL_LO | Y scroll low byte |
| 0x0142 | TILEMAP_Y_SCROLL_HI | Y scroll high byte |
| 0x0143 | TILEMAP_WIDTH | Map width in tiles |
| 0x0144 | TILEMAP_HEIGHT | Map height in tiles |
| 0x0145 | TILEMAP_DATA_BANK | Bank containing tilemap data |
| 0x0146 | TILEMAP_ADDR_HI | Tilemap address high byte |
| 0x0147 | TILEMAP_ADDR_LO | Tilemap address low byte |
| 0x0148 | TILE_ANIM_FRAME | Global animation counter |

### Tile Entry Format (2 bytes)

| Byte | Bits | Description |
|------|------|-------------|
| 0 | 7-0 | Tile index (0-255) |
| 1 | 7 | Flip horizontal |
| 1 | 6 | Flip vertical |
| 1 | 5 | Priority (0=behind, 1=front of sprites) |
| 1 | 4-3 | Palette offset (0-3) |
| 1 | 2 | Reserved |
| 1 | 1-0 | Bank offset (0-3, added to TILEMAP_GRAPHICS_BANK) |

### Tile Properties (0x0A80-0x0AFF)

| Bit | Flag | Description |
|-----|------|-------------|
| 7 | SOLID | Blocks sprites |
| 6 | HAZARD | Damages player |
| 5 | Reserved | - |
| 4 | ANIMATED | Has animation frames |
| 3-2 | Speed | Animation speed (0-3) |
| 1-0 | Frames | Frame count (0=2, 1=4, 2=8, 3=16) |

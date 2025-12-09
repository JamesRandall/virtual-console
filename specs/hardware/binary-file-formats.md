# Binary File Formats Specification

This document describes the binary file formats used by the Virtual Console system for storing graphics, tilemaps, sprite placements, and cartridge ROMs.

## Overview

| Format | Extension | Purpose | Max Size |
|--------|-----------|---------|----------|
| GBIN | `.gbin` | Graphics/sprite data | 32,768 bytes (1 bank) |
| PBIN | `.pbin` | Palette data | 1,024 bytes |
| TBIN | `.tbin` | Tilemap data | 32,768 bytes (1 bank) |
| SBIN | `.sbin` | Sprite placements | 32,768 bytes (1 bank) |
| ROM | `.rom` | Cartridge image | ~7.5 MB (240 banks) |

All multi-byte integers are stored in **little-endian** format unless otherwise noted.

---

## GBIN - Graphics Binary Format

Graphics files contain sprite/tile pixel data in 4bpp (4 bits per pixel) format.

### File Structure

```
Total Size: 32,768 bytes (exactly 1 bank)
Header: None
Data: 256 sprites × 128 bytes each
```

### Constants

```
SPRITES_PER_FILE = 256
SPRITE_WIDTH = 16 pixels
SPRITE_HEIGHT = 16 pixels
BITS_PER_PIXEL = 4
BYTES_PER_ROW = 8 (16 pixels × 4 bits ÷ 8)
BYTES_PER_SPRITE = 128 (16 rows × 8 bytes)
```

### Memory Layout

```
Offset 0x0000 - 0x007F:  Sprite 0   (128 bytes)
Offset 0x0080 - 0x00FF:  Sprite 1   (128 bytes)
Offset 0x0100 - 0x017F:  Sprite 2   (128 bytes)
...
Offset 0x7F80 - 0x7FFF:  Sprite 255 (128 bytes)
```

### Sprite Data Layout

Each sprite is stored in row-major order (left-to-right, top-to-bottom):

```
Row 0: bytes 0-7   (pixels 0-15)
Row 1: bytes 8-15  (pixels 0-15)
...
Row 15: bytes 120-127 (pixels 0-15)
```

### Pixel Encoding

Two pixels are packed per byte:

```
Byte layout: [pixel_even : pixel_odd]
             [bits 7-4   : bits 3-0  ]

Example byte 0xA3:
  - Pixel at even column: (0xA3 >> 4) & 0x0F = 0x0A (10)
  - Pixel at odd column:  0xA3 & 0x0F = 0x03 (3)
```

### Pixel Value Meanings

```
0x00: Transparent (not rendered)
0x01-0x0F: Palette color index 1-15
```

### Address Calculation

To read pixel at (x, y) from sprite index `s`:

```
sprite_offset = s × 128
byte_offset = sprite_offset + (y × 8) + (x ÷ 2)
nibble = (x % 2 == 0) ? HIGH : LOW
pixel_value = (x % 2 == 0) ? (byte >> 4) & 0x0F : byte & 0x0F
```

---

## PBIN - Palette Binary Format

Palette files contain color lookup tables mapping 4-bit pixel values to system palette colors.

### File Structure

```
Total Size: 1,024 bytes
Header: None
Data: 64 palette blocks × 16 bytes each
```

### Memory Layout

```
Offset 0x000 - 0x00F:  Palette block 0  (16 colors)
Offset 0x010 - 0x01F:  Palette block 1  (16 colors)
Offset 0x020 - 0x02F:  Palette block 2  (16 colors)
...
Offset 0x3F0 - 0x3FF:  Palette block 63 (16 colors)
```

### Color Entry Format

Each byte is an index into the system palette (0-255):

```
Byte 0:  Color for pixel value 0 (typically transparent)
Byte 1:  Color for pixel value 1
...
Byte 15: Color for pixel value 15
```

### Palette Block Selection

For sprites and tiles, the palette block is selected via attribute bits:

```
Effective palette block = base_block + palette_offset
Where palette_offset = 0-3 (from sprite/tile attributes)
```

---

## TBIN - Tilemap Binary Format

Tilemap files define 2D grids of tile references with per-tile attributes.

### File Structure

```
Total Size: 8 + (width × height × 2) bytes
Maximum: 32,768 bytes (1 bank)
Header: 8 bytes
Tile Data: 2 bytes per tile
```

### Header (8 bytes)

| Offset | Size | Field | Description |
|--------|------|-------|-------------|
| 0 | 2 | width | Map width in tiles (uint16) |
| 2 | 2 | height | Map height in tiles (uint16) |
| 4 | 4 | reserved | Reserved, set to 0 |

### Tile Entry (2 bytes per tile)

| Offset | Size | Field | Description |
|--------|------|-------|-------------|
| 0 | 1 | index | Tile graphics index (0-255) |
| 1 | 1 | attributes | Tile attribute flags |

### Attribute Byte Layout

```
Bit 7:    flipH      - Horizontal flip (1 = flipped)
Bit 6:    flipV      - Vertical flip (1 = flipped)
Bit 5:    priority   - Render priority (1 = in front of sprites)
Bits 4-3: palette    - Palette offset (0-3)
Bit 2:    reserved   - Must be 0
Bits 1-0: bank       - Graphics bank offset (0-3)
```

### Tile Data Layout

Tiles are stored in row-major order:

```
Offset 8:                    Tile (0, 0)
Offset 10:                   Tile (1, 0)
...
Offset 8 + (width-1) × 2:    Tile (width-1, 0)
Offset 8 + width × 2:        Tile (0, 1)
...
```

### Address Calculation

To access tile at (col, row):

```
tile_offset = HEADER_SIZE + (row × width + col) × 2
tile_index = data[tile_offset]
tile_attrs = data[tile_offset + 1]
```

### Size Limits

| Dimensions | Data Size | Total Size |
|------------|-----------|------------|
| 32 × 32 | 2,048 bytes | 2,056 bytes |
| 64 × 64 | 8,192 bytes | 8,200 bytes |
| 128 × 128 | 32,768 bytes | 32,776 bytes |
| 255 × 255 | 130,050 bytes | 130,058 bytes |

Note: Maps larger than 128×128 require multiple banks.

---

## SBIN - Sprite Binary Format

Sprite placement files define sprite instances in a level with positions and attributes.

### File Structure

```
Total Size: 8 + (sprite_count × 8) bytes
Maximum: 32,768 bytes (1 bank)
Maximum Sprites: 4,095 per file
Header: 8 bytes
Sprite Entries: 8 bytes each
```

### Header (8 bytes)

| Offset | Size | Field | Description |
|--------|------|-------|-------------|
| 0 | 2 | count | Number of sprites (uint16) |
| 2 | 2 | version | Format version (currently 1) |
| 4 | 4 | reserved | Reserved, set to 0 |

### Sprite Entry (8 bytes)

| Offset | Size | Field | Description |
|--------|------|-------|-------------|
| 0 | 2 | x | World X position in pixels (uint16) |
| 2 | 2 | y | World Y position in pixels (uint16) |
| 4 | 1 | spriteIndex | Graphics index (0-255) |
| 5 | 1 | flags | Attribute flags |
| 6 | 1 | bankOffset | Graphics bank offset (0-3) |
| 7 | 1 | typeId | Game-specific type identifier (0-255) |

### Flags Byte Layout

```
Bit 7:    flipH         - Horizontal flip (1 = flipped)
Bit 6:    flipV         - Vertical flip (1 = flipped)
Bit 5:    priority      - Render priority (1 = in front of tiles)
Bits 4-3: paletteOffset - Palette offset (0-3)
Bits 2-0: reserved      - Must be 0
```

### Empty File

An empty SBIN file (no sprites) contains only the header:

```
Hex: 00 00 01 00 00 00 00 00
     ^^^^^ ^^^^^ ^^^^^^^^^^^
     count ver   reserved
```

### File Naming Convention

SBIN files are paired with TBIN files using the same base name:

```
maps/level01.tbin  →  maps/level01.sbin
maps/world1.tbin   →  maps/world1.sbin
```

---

## Cartridge ROM Format

Cartridge ROMs are built by concatenating 32KB banks into a single file.

### File Structure

```
Total Size: bank_count × 32,768 bytes
Maximum Banks: 240 (banks 16-255)
Maximum Size: 7,864,320 bytes (~7.5 MB)
```

### Bank Organization

```
ROM Offset 0x00000 - 0x07FFF:  Bank 16 (metadata.bin)
ROM Offset 0x08000 - 0x0FFFF:  Bank 17 (code.bin)
ROM Offset 0x10000 - 0x17FFF:  Bank 18 (first asset)
ROM Offset 0x18000 - 0x1FFFF:  Bank 19 (second asset)
...
```

### Bank Numbering

```
System Banks:     0-15  (RAM, not in ROM)
Cartridge Start:  16    (first ROM bank)
Cartridge End:    255   (maximum ROM bank)

ROM offset = (bank_number - 16) × 0x8000
Bank number = 16 + (ROM offset ÷ 0x8000)
```

### Bank 0 (Metadata) - Required

The first bank contains cartridge metadata:

| Offset | Size | Field | Description |
|--------|------|-------|-------------|
| 0 | 1 | magic[0] | 0x56 ('V') |
| 1 | 1 | magic[1] | 0x43 ('C') |
| 2 | 1 | version | Format version (0x02) |
| 3 | 1 | segmentCount | Number of code segments |
| 4 | 1 | paletteBank | Bank containing palette (0xFF = none) |
| 5 | 3 | reserved | Reserved, set to 0 |
| 8+ | 6×n | segments | Segment metadata entries |

### Segment Metadata (6 bytes each)

| Offset | Size | Field | Description |
|--------|------|-------|-------------|
| 0 | 2 | startAddr | Load address (big-endian) |
| 2 | 2 | length | Segment length in bytes (big-endian) |
| 4 | 2 | codeOffset | Offset within code.bin (big-endian) |

Note: Segment metadata uses **big-endian** format for historical reasons.

### Bank 1 (Code) - Required

The second bank contains assembled program code:

```
Maximum Size: 32,768 bytes
Format: Raw machine code
Loading: Segments copied to RAM based on metadata
```

### Banks 2+ (Assets) - Optional

Subsequent banks contain asset data:

```
Each bank: Exactly 32,768 bytes (padded if necessary)
Contents: One asset file per bank
Types: .gbin, .pbin, .tbin, .sbin, or custom data
```

### cartridge.json Configuration

The ROM build process is configured via `cartridge.json`:

```json
{
  "banks": [
    "metadata.bin",
    "code.bin",
    "sprites/player.gbin",
    "sprites/enemies.gbin",
    "tiles/world.gbin",
    "palettes/main.pbin",
    "maps/level1.tbin",
    "maps/level1.sbin"
  ]
}
```

### Runtime Bank Switching

To access ROM data at runtime:

```assembly
; Switch to bank containing level data
LD R0, #21            ; Bank 21 (6th cartridge bank)
ST R0, [$0100]        ; BANK_REG

; Data now accessible at $8000-$FFFF
LD R0, [$8000]        ; Read first byte of bank
```

---

## Hardware Register Reference

Key registers for working with these formats:

| Address | Register | Description |
|---------|----------|-------------|
| 0x0100 | BANK_REG | Active bank in upper 32KB window |
| 0x0106 | SPRITE_GRAPHICS_BANK | Bank for sprite graphics |
| 0x013D | TILEMAP_ENABLE | Tilemap enable and mode flags |
| 0x013E | TILEMAP_GRAPHICS_BANK | Bank for tile graphics |
| 0x013F-0x0140 | TILEMAP_X_SCROLL | Horizontal scroll (16-bit) |
| 0x0141-0x0142 | TILEMAP_Y_SCROLL | Vertical scroll (16-bit) |
| 0x0143 | TILEMAP_WIDTH | Tilemap width in tiles |
| 0x0144 | TILEMAP_HEIGHT | Tilemap height in tiles |
| 0x0145 | TILEMAP_DATA_BANK | Bank containing tilemap data |
| 0x0146-0x0147 | TILEMAP_ADDR | Address of tile data in bank |

---

## Implementation Notes

### Devkit File Creation

When creating new files in the devkit:

1. **GBIN**: Initialize with 32,768 zero bytes
2. **PBIN**: Initialize with default palette mapping (0-63 in each block)
3. **TBIN**: Write 8-byte header, then width×height×2 bytes of tile data
4. **SBIN**: Write 8-byte header with count=0, version=1

### File Pairing

The tilemap editor automatically manages TBIN/SBIN pairs:

- Creating `level.tbin` also creates `level.sbin`
- Saving `level.tbin` also saves `level.sbin`
- Opening `level.tbin` loads both files

### Bank Padding

When building ROMs, asset files smaller than 32KB are padded:

```typescript
const paddedData = new Uint8Array(0x8000);
paddedData.set(assetData, 0);
// Remaining bytes are 0x00
```

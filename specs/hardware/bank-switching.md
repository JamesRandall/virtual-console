# Bank Switching Specification

## Overview

The Virtual Console uses a banked memory architecture to support up to 8MB of addressable memory while maintaining a 16-bit address space. The system divides its 256 available banks into two distinct regions: RAM banks for system use and cartridge ROM banks for game content.

**Key Features:**
- 256 total banks (0-255)
- 32KB per bank
- Clean separation between RAM and ROM regions
- Per-sprite/tile bank byte for flexible graphics access
- Future-proof RAM expansion path

---

## Bank Layout

```
Banks 0-15:    RAM Region
               - Banks 0-3: Populated (128KB total)
               - Banks 4-15: Reserved for future RAM expansion (unpopulated)

Banks 16-255:  Cartridge ROM
               - Mapped from .rom file
               - Up to 240 banks (7.5MB) of cartridge space
```

### RAM Region (Banks 0-15)

| Bank | Size | Purpose |
|------|------|---------|
| 0 | 32KB | Primary framebuffer + working data |
| 1 | 32KB | Secondary framebuffer (double buffering) |
| 2 | 32KB | General purpose RAM (decompression buffers) |
| 3 | 32KB | General purpose RAM (dynamic data) |
| 4-15 | - | Reserved for future RAM expansion (unpopulated) |

**Total populated RAM:** 128KB (4 banks × 32KB)

**Note:** Banks 4-15 are reserved but not currently populated. Accessing these banks returns undefined values. Future console revisions may populate additional RAM banks without breaking cartridge compatibility.

### Cartridge ROM Region (Banks 16-255)

| Bank Range | Relative Index | Typical Usage |
|------------|----------------|---------------|
| 16 | 0 | Cartridge metadata + loader |
| 17 | 1 | Game code |
| 18-31 | 2-15 | Sprite graphics |
| 32-47 | 16-31 | Tile graphics |
| 48+ | 32+ | Level data, audio, additional assets |

**Total cartridge space:** 7.5MB (240 banks × 32KB)

---

## Bank Register

**Address:** `0x0100` (BANK_REG)

Writing to this register switches the upper 32KB window (0x8000-0xFFFF) to the specified bank.

```assembly
; Switch to bank 18 (cartridge sprite graphics)
LD R0, #18
ST R0, [$0100]

; Now addresses 0x8000-0xFFFF map to bank 18
LD R0, [$8000]    ; Read first byte of bank 18
```

### Bank Switching Timing

- Bank switch takes effect immediately
- No wait states or delays
- Safe to switch mid-frame (though not recommended during active rendering)
- VBlank is the ideal time for bank switching operations

---

## Cartridge ROM Mapping

### ROM File Format

The `.rom` file is a simple concatenation of 32KB banks:

```
Offset 0x00000 - 0x07FFF:  Bank 16 (cartridge bank 0)
Offset 0x08000 - 0x0FFFF:  Bank 17 (cartridge bank 1)
Offset 0x10000 - 0x17FFF:  Bank 18 (cartridge bank 2)
Offset 0x18000 - 0x1FFFF:  Bank 19 (cartridge bank 3)
...
```

**Address calculation:**
```
rom_offset = (absolute_bank - 16) × 0x8000
absolute_bank = 16 + (rom_offset / 0x8000)
```

### Cartridge Configuration (cartridge.json)

Games specify their bank layout in a `cartridge.json` manifest:

```json
{
  "name": "My Game",
  "banks": [
    "metadata.bin",
    "code.bin",
    "sprites/player.gbin",
    "sprites/enemies.gbin",
    "tiles/world1.gbin",
    "levels/level1.tbin"
  ]
}
```

**Array index to bank mapping:**
- Index 0 → Bank 16 (metadata.bin)
- Index 1 → Bank 17 (code.bin)
- Index 2 → Bank 18 (sprites/player.gbin)
- etc.

### Bundler Implementation

The cartridge bundler creates `.rom` files by concatenating banks:

```typescript
const CARTRIDGE_BANK_OFFSET = 16;

function bundleCartridge(config: CartridgeConfig): Uint8Array {
  const banks: Uint8Array[] = [];

  for (let i = 0; i < config.banks.length; i++) {
    const absoluteBank = CARTRIDGE_BANK_OFFSET + i;
    const bankData = loadBankFile(config.banks[i]);

    // Pad to 32KB if necessary
    banks.push(padTo32KB(bankData));
  }

  return concatenateBanks(banks);
}

function padTo32KB(data: Uint8Array): Uint8Array {
  if (data.length >= 0x8000) {
    return data.slice(0, 0x8000);
  }
  const padded = new Uint8Array(0x8000);
  padded.set(data);
  return padded;
}
```

---

## Per-Sprite/Tile Banking

Sprites and tiles each include a bank byte in their attribute data, allowing direct reference to graphics in any bank (0-255). This includes both RAM banks (for runtime-generated graphics) and cartridge ROM banks (for static assets).

### Sprite Banking

Each sprite attribute entry includes a bank field:

```
Sprite Attribute (5 bytes):
  +0: X position
  +1: Y position
  +2: Sprite index
  +3: Flags
  +4: Bank          ← Graphics bank (0-255, RAM or ROM)
```

**Example - Static sprite from cartridge:**
```assembly
; Set sprite 0 to use graphics from bank 18 (cartridge ROM)
LD R0, #18
ST R0, [$0704]     ; Sprite 0 bank field
```

**Example - Runtime-generated sprite from RAM:**
```assembly
; Set sprite 1 to use graphics from bank 2 (RAM)
LD R0, #2
ST R0, [$0709]     ; Sprite 1 bank field
```

### Tile Banking

Tilemaps reference graphics via the TILEMAP_GRAPHICS_BANK register:

```assembly
; Set tilemap to use tile graphics from bank 32
LD R0, #32
ST R0, [$013E]     ; TILEMAP_GRAPHICS_BANK
```

### Mixed RAM/ROM Graphics

The per-bank architecture enables powerful mixing of static and dynamic graphics. Sprites can freely reference any bank, allowing games to combine pre-made ROM assets with runtime-generated content:

```assembly
; Static enemy sprites from cartridge ROM
LD R0, #18         ; Bank 18 (cartridge)
ST R0, [$0709]     ; Sprite 1 bank

; Dynamically generated particle from RAM
LD R0, #2          ; Bank 2 (RAM)
ST R0, [$070E]     ; Sprite 2 bank

; Player sprite with customizable appearance (generated at load)
LD R0, #3          ; Bank 3 (RAM)
ST R0, [$0704]     ; Sprite 0 bank
```

**Use cases:**
- Static sprites/tiles in ROM (no RAM copy needed)
- Procedurally generated graphics in RAM banks 2-3
- Decompressed assets temporarily in RAM
- Real-time animation modifications
- Character customization (generate sprite at runtime)
- Destructible terrain (modify tile graphics dynamically)
- Visual effects (particles, explosions generated on-the-fly)

---

## System Constants

### TypeScript/JavaScript

```typescript
// Memory architecture
const RAM_BANK_COUNT = 4;           // Banks 0-3 populated
const RAM_BANK_RESERVED = 16;       // Banks 0-15 reserved for RAM
const CARTRIDGE_BANK_OFFSET = 16;   // Cartridge starts at bank 16
const MAX_BANKS = 256;              // Total addressable banks
const BANK_SIZE = 0x8000;           // 32KB per bank

// Derived values
const MAX_CARTRIDGE_BANKS = MAX_BANKS - CARTRIDGE_BANK_OFFSET;  // 240
const MAX_CARTRIDGE_SIZE = MAX_CARTRIDGE_BANKS * BANK_SIZE;     // 7.5MB
```

### Assembly

```assembly
; Memory architecture constants
.define RAM_BANKS           4
.define CARTRIDGE_START     16
.define BANK_SIZE           $8000
.define MAX_BANKS           256

; Hardware registers
.define BANK_REG            $0100
.define SPRITE_GRAPHICS_BANK $0106
.define TILEMAP_GRAPHICS_BANK $013E
```

---

## Design Rationale

### Why Bank 16 for Cartridge Start?

1. **Clean hex boundary:** 0x10 is a round number, easy to remember
2. **Future-proof RAM:** 512KB RAM (16 banks) possible without breaking compatibility
3. **Symmetric split:** 16 RAM banks + 240 cartridge banks = 256 total
4. **Simple math:** `absolute_bank = cartridge_index + 16`

### Why Per-Sprite/Tile Banking?

1. **No copy required:** Graphics read directly from ROM
2. **Massive libraries:** 61,440 sprites at 4bpp (240 banks × 256 per bank)
3. **Flexibility:** Mix RAM (dynamic) and ROM (static) sprites freely
4. **Future compatibility:** Games work unchanged if RAM expands

### Comparison with Classic Systems

| System | Bank Size | Max Banks | Switching |
|--------|-----------|-----------|-----------|
| NES | 8KB/16KB | 4-256 | Mapper-dependent |
| Game Boy | 16KB | 2-512 | MBC chips |
| SNES | 32KB | 128 | Hardware mappers |
| **Virtual Console** | 32KB | 256 | Single register |

The Virtual Console uses a simplified banking model compared to classic systems, avoiding the complexity of multiple memory controllers or mapper chips.

---

## Migration Notes

### Updating Existing Code

Code referencing "bank 2 for sprites" should update to "bank 18" (or the appropriate cartridge bank):

**Before:**
```assembly
LD R0, #2          ; Bank 2 for sprites (OLD)
ST R0, [$0100]
```

**After:**
```assembly
LD R0, #18         ; Bank 18 (cartridge bank 2)
ST R0, [$0100]
```

### Register Behavior

The following registers work unchanged with the new banking scheme:
- `BANK_REG` (0x0100): Accepts any bank 0-255
- `SPRITE_GRAPHICS_BANK` (0x0106): Accepts any bank 0-255
- `TILEMAP_GRAPHICS_BANK` (0x013E): Accepts any bank 0-255
- Per-sprite bank byte: Accepts any bank 0-255

The only change is the convention for which bank numbers to use.

---

## Emulator Implementation Notes

### Bank Access

```typescript
class Memory {
  private ram: Uint8Array[];      // Banks 0-3 (4 × 32KB)
  private rom: Uint8Array | null; // Cartridge ROM (variable size)

  readBank(bank: number, offset: number): number {
    if (bank < 4) {
      // RAM banks 0-3
      return this.ram[bank][offset];
    } else if (bank < 16) {
      // Unpopulated RAM banks
      return 0xFF; // Or undefined behavior
    } else {
      // Cartridge ROM
      const romOffset = (bank - 16) * 0x8000 + offset;
      if (this.rom && romOffset < this.rom.length) {
        return this.rom[romOffset];
      }
      return 0xFF;
    }
  }

  writeBank(bank: number, offset: number, value: number): void {
    if (bank < 4) {
      // RAM banks 0-3 are writable
      this.ram[bank][offset] = value;
    }
    // ROM banks 16+ are read-only (writes ignored)
  }
}
```

### Loading Cartridges

```typescript
function loadCartridge(romData: Uint8Array): void {
  // Validate size (must be multiple of 32KB)
  if (romData.length % 0x8000 !== 0) {
    throw new Error('Invalid ROM size');
  }

  const bankCount = romData.length / 0x8000;
  console.log(`Loaded cartridge: ${bankCount} banks (${romData.length / 1024}KB)`);

  // ROM is accessible starting at bank 16
  memory.rom = romData;
}
```

---

## Revision History

- v1.0 (2024): Initial specification

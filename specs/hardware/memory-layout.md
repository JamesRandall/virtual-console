# Virtual Console Memory Map

## Overview
- **Total Address Space:** 64KB (0x0000-0xFFFF)
- **Lower 32KB:** Always visible, system RAM and hardware registers
- **Upper 32KB:** Bankable memory (256 banks available via banking register)

### Memory Map Summary

| Range | Size | Description |
|-------|------|-------------|
| 0x0000-0x00FF | 256 B | Zero Page |
| 0x0100-0x01FF | 256 B | Hardware Registers |
| 0x0200-0x05FF | 1 KB | Palette RAM |
| 0x0600-0x06FF | 256 B | Scanline Palette Map |
| 0x0700-0x0AFF | 896 B | Sprite Attribute Table |
| 0x0A00-0x0AFF | 256 B | Collision Buffer |
| 0x0B00-0x0B7F | 128 B | Tile Type Properties |
| 0x0B80-0x7FFF | ~29 KB | General RAM |
| 0x8000-0xFFFF | 32 KB | Bankable Memory (256 banks) |

**Total Addressable Memory:** 64 KB + (256 banks × 32 KB) = **8,256 KB (~8 MB)**

---

## Lower 32KB (0x0000-0x7FFF) - Fixed Memory

### Zero Page (0x0000-0x00FF)
Fast access memory for pointers, frequently accessed variables, and temporary storage.

**256 bytes**

---

### Hardware Registers (0x0100-0x01FF)

| Address | Register | Description |
|---------|----------|-------------|
| 0x0100 | BANK_REG | Banking register (write bank number 0-255 to switch upper 32K) |
| 0x0101 | VIDEO_MODE | Video mode select (0-3) |
| 0x0102 | SCANLINE_INT | Scanline interrupt trigger line |
| 0x0103 | SCANLINE_CURRENT | Current scanline (read-only) |
| 0x0104 | SPRITE_ENABLE | Sprite system enable/disable |
| 0x0105 | SPRITE_COUNT | Number of active sprites |
| 0x0106 | Reserved | Reserved (legacy controller register) |
| 0x0107 | Reserved | Reserved (legacy controller register) |
| 0x0108 | COLLISION_FLAGS | Collision status flags (read-only) |
| 0x0109 | COLLISION_COUNT | Number of collision entries (read-only) |
| 0x010A | COLLISION_MODE | Collision detection mode control |
| 0x010B | TILEMAP_ENABLE | Enable tilemap rendering |
| 0x010C | TILEMAP_BANK | Bank containing tile graphics |
| 0x010D | TILEMAP_X_SCROLL | X scroll offset (0-255) |
| 0x010E | TILEMAP_Y_SCROLL | Y scroll offset (0-255) |
| 0x010F | TILEMAP_WIDTH | Tilemap width in tiles |
| 0x0110 | TILEMAP_HEIGHT | Tilemap height in tiles |
| 0x0111 | TILEMAP_ADDR_LO | Tilemap data address low byte |
| 0x0112 | TILEMAP_ADDR_HI | Tilemap data address high byte |
| 0x0113 | TILE_ANIM_FRAME | Global tile animation frame counter |
| 0x0114 | INT_STATUS | Interrupt status flags (read/write to clear) |
| 0x0115 | INT_ENABLE | Interrupt enable control |
| 0x0116-0x0128 | Audio Registers | 4-channel audio system (see Audio Registers) |
| 0x0129-0x0131 | Text Registers | Hardware text rendering system (see Text Registers) |
| 0x0132 | VBLANK_VEC_LO | VBlank interrupt handler address (low byte) |
| 0x0133 | VBLANK_VEC_HI | VBlank interrupt handler address (high byte) |
| 0x0134 | SCANLINE_VEC_LO | Scanline interrupt handler address (low byte) |
| 0x0135 | SCANLINE_VEC_HI | Scanline interrupt handler address (high byte) |
| 0x0136 | CONTROLLER_1_BUTTONS | Controller 1 main buttons (read-only) |
| 0x0137 | CONTROLLER_1_EXTENDED | Controller 1 extended buttons (read-only) |
| 0x0138 | CONTROLLER_2_BUTTONS | Controller 2 main buttons (read-only) |
| 0x0139 | CONTROLLER_2_EXTENDED | Controller 2 extended buttons (read-only) |
| 0x013A-0x01FF | Reserved | Additional hardware registers |

**256 bytes**

#### Collision Detection Registers

**COLLISION_FLAGS (0x0108)**
- Bit 0: Any sprite-sprite collision this frame
- Bit 1: Any sprite-tile collision this frame
- Bits 2-7: Reserved

**COLLISION_COUNT (0x0109)**
- Number of collision entries in buffer (0-85)
- Read-only, cleared automatically each frame

**COLLISION_MODE (0x010A)**
- Bit 0: Enable sprite-sprite detection
- Bit 1: Enable sprite-tile detection
- Bit 2: Pixel-perfect mode (0=bounding box, 1=pixel-perfect)
- Bits 3-7: Reserved

**Collision Detection Modes:**

*Bounding box mode (bit 2 = 0):*
- Checks if sprite rectangles overlap
- Fast but less accurate
- May report collisions when sprites are visually close but not touching

*Pixel-perfect mode (bit 2 = 1, recommended):*
- Checks actual non-transparent pixels for overlap
- Accurate and fair collision detection
- Essential for low-resolution displays where pixels are large
- Palette index 0 is treated as transparent for sprites
- Slightly more expensive but negligible with typical sprite counts (10-30 active)

**Transparent Pixels:**
- Sprite palette index 0 is always treated as transparent
- Only non-transparent pixels (indices 1-15 for 4bpp, 1-255 for 8bpp) participate in collision detection

#### Tilemap Registers

**TILEMAP_ENABLE (0x010B)**
- 0 = Disabled, 1 = Enabled

**TILEMAP_BANK (0x010C)**
- Bank number containing tile graphics (0-255)

**TILEMAP_X_SCROLL / TILEMAP_Y_SCROLL (0x010D-0x010E)**
- Scroll offset in pixels (0-255)

**TILEMAP_WIDTH / TILEMAP_HEIGHT (0x010F-0x0110)**
- Dimensions of tilemap in tiles (e.g., 128×128)

**TILEMAP_ADDR (0x0111-0x0112)**
- 16-bit pointer to tilemap data
- Can point to bankable memory or lower 32K

**TILE_ANIM_FRAME (0x0113)**
- Global animation frame counter (0-255)
- Auto-increments each frame or every N frames
- Used by hardware to select animated tile frames

**INT_STATUS (0x0114)**
- Bit 0: VBlank interrupt pending
- Bit 1: Scanline interrupt pending
- Bits 2-7: Reserved

**Write-1-to-clear (W1C):** Writing 1 to a bit clears it (sets to 0). This allows selective clearing of specific interrupt flags without affecting others.

**Interrupt Triggering**: When the I flag in the CPU status register is set (via SEI instruction) and the corresponding bit in INT_ENABLE is set, the CPU will automatically call the interrupt handler when a flag is set in this register. Alternatively, games can poll these flags manually for simpler (but less efficient) operation.

Example:
```assembly
; Check if VBlank occurred
LD R0, [$0114]      ; Read INT_STATUS (e.g., 0b00000011)
AND R0, #$01        ; Test VBlank bit
BRZ no_vblank

; Clear only VBlank flag
LD R0, #$01         ; Write 1 to bit 0
ST R0, [$0114]      ; INT_STATUS becomes 0b00000010
                    ; (VBlank cleared, scanline still pending)
```

**INT_ENABLE (0x0115)**
- Bit 0: Enable VBlank interrupt (0=polling only, 1=trigger CPU interrupt)
- Bit 1: Enable scanline interrupt (0=polling only, 1=trigger CPU interrupt)
- Bits 2-7: Reserved

When a bit is set, the corresponding interrupt will trigger CPU interrupt handling (via interrupt vectors at 0x0132-0x0135) if the I flag in the CPU status register is also set. When clear, games must poll INT_STATUS manually.

#### Audio Registers

The system provides 4 audio channels for NES-inspired chiptune sound generation.

**Channel 0 - Pulse Wave (0x0116-0x011A)**

| Address | Register | Description |
|---------|----------|-------------|
| 0x0116 | CH0_FREQ_LO | Frequency low byte (0-255) |
| 0x0117 | CH0_FREQ_HI | Frequency high byte (bits 2-0 used, 11-bit frequency total) |
| 0x0118 | CH0_VOLUME | Volume (bits 3-0: 0-15), bit 4: enable channel |
| 0x0119 | CH0_DUTY | Duty cycle (bits 1-0: 0=12.5%, 1=25%, 2=50%, 3=75%) |
| 0x011A | CH0_SWEEP | Pitch sweep/bend (optional, 0=disabled) |

**Channel 1 - Pulse Wave (0x011B-0x011F)**

| Address | Register | Description |
|---------|----------|-------------|
| 0x011B | CH1_FREQ_LO | Frequency low byte |
| 0x011C | CH1_FREQ_HI | Frequency high byte |
| 0x011D | CH1_VOLUME | Volume (0-15) + enable |
| 0x011E | CH1_DUTY | Duty cycle (0-3) |
| 0x011F | CH1_SWEEP | Pitch sweep/bend |

**Channel 2 - Wave/Triangle (0x0120-0x0123)**

| Address | Register | Description |
|---------|----------|-------------|
| 0x0120 | CH2_FREQ_LO | Frequency low byte |
| 0x0121 | CH2_FREQ_HI | Frequency high byte |
| 0x0122 | CH2_VOLUME | Volume (0-15) + enable |
| 0x0123 | CH2_WAVEFORM | Waveform select (0=triangle, 1=sine, 2=sawtooth) |

**Channel 3 - Noise (0x0124-0x0127)**

| Address | Register | Description |
|---------|----------|-------------|
| 0x0124 | CH3_FREQ_LO | Frequency/pitch low byte |
| 0x0125 | CH3_FREQ_HI | Frequency/pitch high byte |
| 0x0126 | CH3_VOLUME | Volume (0-15) + enable |
| 0x0127 | CH3_MODE | Noise mode (0=white noise, 1=periodic/metallic) |

**Global Audio Control (0x0128)**

| Address | Register | Description |
|---------|----------|-------------|
| 0x0128 | AUDIO_MASTER | Bit 7: Master enable, bits 3-0: Master volume (0-15) |

#### Audio Usage Examples

**Play a C note (262 Hz) on Channel 0:**
```assembly
; C note = 262 Hz
; 11-bit frequency value ≈ 262

LD R0, #$06        ; Frequency low byte
ST R0, [$0116]     ; CH0_FREQ_LO

LD R0, #$01        ; Frequency high byte
ST R0, [$0117]     ; CH0_FREQ_HI

LD R0, #$1F        ; Volume 15 + enable (bit 4 set)
ST R0, [$0118]     ; CH0_VOLUME

LD R0, #$01        ; 25% duty cycle (classic sound)
ST R0, [$0119]     ; CH0_DUTY
```

**Play a drum hit on noise channel:**
```assembly
LD R0, #$80        ; High frequency for snare-like sound
ST R0, [$0124]     ; CH3_FREQ_LO

LD R0, #$00
ST R0, [$0125]     ; CH3_FREQ_HI

LD R0, #$1F        ; Full volume + enable
ST R0, [$0126]     ; CH3_VOLUME

LD R0, #$00        ; White noise mode
ST R0, [$0127]     ; CH3_MODE
```

**Stop a channel:**
```assembly
LD R0, #$00        ; Volume 0, disable channel
ST R0, [$0118]     ; CH0_VOLUME (or any channel's volume register)
```

#### Frequency Calculation

The 11-bit frequency value maps to Hz using the formula:
```
frequency_hz = (frequency_value * sample_rate) / 2048
```

Common notes (approximate 11-bit values):
- C4 (262 Hz): 0x106
- E4 (330 Hz): 0x14A
- G4 (392 Hz): 0x18E
- A4 (440 Hz): 0x1B8
- C5 (523 Hz): 0x20C

#### Collision Detection Timing

Collision detection occurs **during frame rendering**:

1. At start of frame: COLLISION_FLAGS and COLLISION_COUNT are cleared, collision buffer reset
2. During rendering: Hardware detects sprite-sprite and sprite-tile overlaps
3. Collisions are written to collision buffer (0x0A00+) as they are detected
4. At end of rendering: VBlank interrupt fires (if enabled)
5. CPU reads collision data from buffer during VBlank or next frame

**Collision Detection Algorithm:**

*Sprite-Sprite:*
1. For each pair of active sprites, check bounding box overlap
2. If bounding boxes overlap:
   - In bounding box mode: Record collision immediately
   - In pixel-perfect mode: Check intersection rectangle for overlapping non-transparent pixels
3. Add collision entry to buffer if detected

*Sprite-Tile:*
1. For each active sprite, determine which tiles it overlaps
2. Check tile properties (bit 7: solid) from tile properties table at 0x0B00+
3. If tile is solid:
   - In bounding box mode: Record collision with tile type
   - In pixel-perfect mode: Check if sprite has non-transparent pixels over tile pixels
4. Determine collision side (top/bottom/left/right) based on sprite movement
5. Add collision entry to buffer

**Performance Characteristics:**
- Bounding box: ~10 operations per sprite pair, suitable for 100+ sprites
- Pixel-perfect: ~100-1000 pixel comparisons per overlapping pair, suitable for 30-50 sprites
- Typical frame with 20 active sprites: ~190 checks, negligible overhead (<1ms)

#### Interrupt Vectors

Interrupt handler addresses are stored in hardware registers in the hardware register area:

| Register | Address | Description |
|----------|---------|-------------|
| VBLANK_VEC_LO | 0x0132 | VBlank interrupt handler address (low byte) |
| VBLANK_VEC_HI | 0x0133 | VBlank interrupt handler address (high byte) |
| SCANLINE_VEC_LO | 0x0134 | Scanline interrupt handler address (low byte) |
| SCANLINE_VEC_HI | 0x0135 | Scanline interrupt handler address (high byte) |

**Vector format**: 16-bit address stored little-endian (low byte first, then high byte)

**Typical game loop (polling approach - simple but inefficient):**
```assembly
main_loop:
  ; Wait for VBlank
  wait_vblank:
    LD R0, [$0114]      ; Read INT_STATUS
    AND R0, #$01        ; Check VBlank bit
    BRZ wait_vblank

  ; Clear VBlank flag
  LD R0, #$01
  ST R0, [$0114]        ; Write 1 to clear

  ; Process collisions
  CALL check_collisions

  ; Update game state
  CALL update_player

  JMP main_loop
```

**Typical game loop (interrupt approach - efficient, recommended):**
```assembly
; Setup (run once at startup)
setup:
  ; Install VBlank interrupt handler
  LD R0, #<vblank_handler
  ST R0, [$0132]           ; VBLANK_VEC_LO
  LD R0, #>vblank_handler
  ST R0, [$0133]           ; VBLANK_VEC_HI

  ; Enable VBlank interrupts
  LD R0, #$01
  ST R0, [$0115]           ; INT_ENABLE
  SEI                      ; Enable interrupts in CPU

; Main game loop - runs continuously (no waiting!)
main_loop:
  CALL run_ai
  CALL update_physics
  CALL process_input
  JMP main_loop

; VBlank handler - called automatically at 60Hz
vblank_handler:
  PUSH R0
  PUSH R1

  ; Clear VBlank flag
  LD R0, #$01
  ST R0, [$0114]           ; INT_STATUS

  ; Update display during safe VBlank period
  CALL check_collisions
  CALL update_player

  POP R1
  POP R0
  RTI                      ; Return and re-enable interrupts
```

**Comparison:**
- Polling wastes ~40,000 CPU cycles per frame in the wait loop
- Interrupts allow game logic to use all available CPU time
- Interrupts match real console hardware (NES, SNES, Game Boy, Genesis)
- Polling is simpler for beginners or simple applications

#### Controller Button Layout

Each controller has two registers for button states (1 = pressed, 0 = released):

**CONTROLLER_X_BUTTONS (0x0136 for P1, 0x0138 for P2) - Main Buttons:**
```
Bit 7: Up
Bit 6: Down
Bit 5: Left
Bit 4: Right
Bit 3: Button A
Bit 2: Button B
Bit 1: Button C
Bit 0: Button D
```

**CONTROLLER_X_EXTENDED (0x0137 for P1, 0x0139 for P2) - Extended Buttons:**
```
Bit 7-4: Reserved
Bit 3: Left Shoulder (L)
Bit 2: Right Shoulder (R)
Bit 1: Start
Bit 0: Options
```

**Example usage:**
```assembly
; Check D-pad and face buttons
LD R0, [$0136]   ; Read controller 1 main buttons
AND R0, #$80     ; Mask bit 7 (Up)
BRNZ player_up   ; Branch if Up is pressed

LD R0, [$0136]   ; Read controller 1 main buttons
AND R0, #$08     ; Mask bit 3 (Button A)
BRNZ fire_weapon ; Branch if A is pressed

; Check extended buttons
LD R0, [$0137]   ; Read controller 1 extended buttons
AND R0, #$02     ; Mask bit 1 (Start)
BRNZ pause_game  ; Branch if Start is pressed

LD R0, [$0137]   ; Read controller 1 extended buttons
AND R0, #$08     ; Mask bit 3 (Left Shoulder)
BRNZ shield_up   ; Branch if L button is pressed
```

**Convenience constants:**
```
; Main buttons (0x0136/0x0138)
CTRL_UP     = $80  ; 0b10000000
CTRL_DOWN   = $40  ; 0b01000000
CTRL_LEFT   = $20  ; 0b00100000
CTRL_RIGHT  = $10  ; 0b00010000
CTRL_A      = $08  ; 0b00001000
CTRL_B      = $04  ; 0b00000100
CTRL_C      = $02  ; 0b00000010
CTRL_D      = $01  ; 0b00000001

; Extended buttons (0x0137/0x0139)
CTRL_L      = $08  ; 0b00001000
CTRL_R      = $04  ; 0b00000100
CTRL_START  = $02  ; 0b00000010
CTRL_OPT    = $01  ; 0b00000001
```

**Legacy Note:** Registers 0x0106-0x0107 are reserved for backward compatibility with older code. New code should use the registers at 0x0136-0x0139.

---

### Palette RAM (0x0200-0x05FF)

Indexed palette storage. Each byte is an index (0-255) into the master Tailwind color palette.

#### Mode 0 & 3 (4bpp modes)
- **0x0200-0x020F:** Palette 0 (16 colors)
- **0x0210-0x021F:** Palette 1 (16 colors)
- **0x0220-0x022F:** Palette 2 (16 colors)
- **0x0230-0x023F:** Palette 3 (16 colors)
- ... (up to 64 palettes of 16 colors)

#### Mode 1 & 2 (8bpp modes)
- **0x0200-0x02FF:** Palette 0 (256 colors)
- **0x0300-0x03FF:** Palette 1 (256 colors)
- **0x0400-0x04FF:** Palette 2 (256 colors)
- **0x0500-0x05FF:** Palette 3 (256 colors)

**1024 bytes (0x400)**

---

### Scanline Palette Map (0x0600-0x06FF)

Per-scanline palette selection. Each byte selects which palette (0-3 or higher) to use for that scanline.

- **0x0600:** Scanline 0 palette selector
- **0x0601:** Scanline 1 palette selector
- ... 
- **0x06B0:** Scanline 176 palette selector (Mode 3, tallest mode)

**256 bytes**

---

### Sprite Attribute Table (0x0700-0x0AFF)

Each sprite entry is 5 bytes:

```
struct Sprite {
    u8 x;           // X position (0-255)
    u8 y;           // Y position (0-255)
    u8 sprite_idx;  // Sprite graphics index
    u8 flags;       // Bits: [flip_h|flip_v|priority|palette_offset|reserved]
    u8 bank;        // Bank containing sprite graphics data
}
```

**Support for up to 128 sprites × 5 bytes = 640 bytes (0x280)**

- **0x0700-0x097F:** Sprite attributes (128 sprites)
- **0x0980-0x0AFF:** Reserved for sprite expansion

**896 bytes (0x380)**

---

### Collision Buffer (0x0A00-0x0AFF)

Collision detection results written by hardware each frame.

Each collision entry is 3 bytes:

```
struct CollisionEntry {
    u8 sprite_id;      // Which sprite (0-127)
    u8 data;           // Sprite ID (sprite-sprite) OR tile type (sprite-tile)
    u8 type_flags;     // Bit 7: 1=sprite-tile, 0=sprite-sprite
                       // Bits 3-0: Collision side (for sprite-tile)
}
```

**Collision side encoding (sprite-tile collisions):**
- Bit 3: Top
- Bit 2: Bottom
- Bit 1: Left
- Bit 0: Right

Multiple bits can be set for corner collisions.

**Buffer capacity:** 256 bytes / 3 = 85 collision entries maximum

**0x0A00-0x0AFF:** Collision buffer (256 bytes)

**Usage pattern:**
```assembly
; Check for any collisions
LD R0, [$0108]      ; Read COLLISION_FLAGS
AND R0, #$02        ; Check sprite-tile bit
BRZ no_collisions

; Get collision count
LD R1, [$0109]      ; Read COLLISION_COUNT
CMP R1, #0
BRZ no_collisions

; Process first collision
LD R2, [$0A00]      ; sprite_id
LD R3, [$0A01]      ; tile_type
LD R4, [$0A02]      ; type_flags

; Check if tile type is spike (example)
CMP R3, #42
BRZ hit_spike
```

**256 bytes**

---

### Tile Type Properties (0x0B00-0x0B7F)

Properties table for 128 tile types. Each byte defines behavior for one tile type:

```
Bit 7: Solid (blocks sprites)
Bit 6: Hazard (damages player)
Bit 5: Reserved
Bit 4: Animated (has animation frames)
Bits 3-2: Animation speed (0=slow, 1=med, 2=fast, 3=very fast)
Bits 1-0: Frame count (0=2 frames, 1=4 frames, 2=8 frames, 3=16 frames)
```

**0x0B00-0x0B7F:** Tile properties (128 bytes, one per tile type)

**Example:**
```assembly
; Define tile type 10 (water) as animated, not solid
LD R0, #%00010110   ; Animated, medium speed, 4 frames
ST R0, [$0B0A]      ; Store at properties[10]

; Define tile type 42 (spike) as hazard
LD R0, #%01000000   ; Hazard flag set
ST R0, [$0B2A]      ; Store at properties[42]
```

**128 bytes**

---

### General RAM (0x0B80-0x7FFF)

Available for:
- User program code
- Stack (typically grows down from 0x7FFF)
- Variables and data structures
- Decompression buffers
- Sound data
- General purpose storage

**~29 KB (0x7480 bytes)**

---

## Upper 32KB (0x8000-0xFFFF) - Bankable Memory

256 banks available (selected via BANK_REG at 0x0100). Each bank is 32KB.

### Framebuffer Layout (Top-aligned)

The framebuffer is positioned at the end of memory space ending at **0xFFFF** with its start in memory based on video mode:

#### Mode 0: 256×160 @ 4bpp
- **Framebuffer:** 0xB000 → 0xFFFF (20,480 bytes / 0x5000)
- X: 0, Y: 0 (top-left corner) → 0xB000
- X: 255, Y: 159 (bottom-right corner) → 0xFFFF

#### Mode 1: 160×96 @ 8bpp
- **Framebuffer:** 0xC400 → 0xFFFF (15,360 bytes / 0x3C00)
- X: 0, Y: 0 (top-left corner) → 0xC400
- X: 159, Y: 95 (bottom-right corner) → 0xFFFF

#### Mode 2: 128×128 @ 8bpp
- **Framebuffer:** 0xC000 → 0xFFFF (16,384 bytes / 0x4000)
- X: 0, Y: 0 (top-left corner) → 0xC000
- X: 127, Y: 127 (bottom-right corner) → 0xFFFF

#### Mode 3: 176×176 @ 4bpp
- **Framebuffer:** 0xC380 → 0xFFF (15,488 bytes / 0x3C80)
- X: 0, Y: 0 (top-left corner) → 0xC000
- X: 175, Y: 175 (bottom-right corner) → 0xFFFF

### Bank Usage Conventions

**Bank 0:** Primary framebuffer + working data  
**Bank 1:** Secondary framebuffer (for double buffering)  
**Bank 2-15:** Sprite graphics data  
**Bank 16-31:** Tile graphics data (128 tile types)  
**Bank 32+:** Level data, additional assets, code overlays

#### Tile Graphics Storage

**16×16 tiles at 4bpp:**
- 16×16 pixels = 256 pixels
- 256 pixels ÷ 2 (4bpp) = 128 bytes per tile
- 128 tile types × 128 bytes = **16,384 bytes (16KB)**
- Fits easily in one 32KB bank with room for other data

**16×16 tiles at 8bpp:**
- 16×16 pixels = 256 pixels
- 256 pixels × 1 byte = 256 bytes per tile
- 128 tile types × 256 bytes = **32,768 bytes (32KB)**
- Requires one full bank

**Animation frames:** Store sequentially (e.g., tiles 10-13 for a 4-frame animation)

#### Level Data Format

**Tilemap data** (in level bank, e.g., Bank 32+):

Each tile = 1 byte:
- **Bit 7:** Flip horizontal
- **Bits 6-0:** Tile type (0-127)

**Example 128×128 tilemap:**
- 16,384 bytes (128 × 128)
- Leaves ~16KB free in bank for:
  - Multiple maps/levels
  - Enemy spawn data
  - Trigger zones
  - Level-specific assets

**Tilemap layout in memory:**
```
Row-major order: [y][x]
Address = TILEMAP_ADDR + (y * TILEMAP_WIDTH) + x

Example for 128-wide map:
Tile at (10, 5) = TILEMAP_ADDR + (5 * 128) + 10
```

---

## Master Palette (Not in Address Space)

The master palette of 256 RGB colors (Tailwind CSS colors) is built into the system and not directly accessible via memory. User palettes at 0x0200+ are indices into this master palette.
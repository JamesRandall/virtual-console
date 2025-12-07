# Tilemap System Specification

## Overview

The Virtual Console Tilemap System provides hardware-accelerated tile-based background rendering with scrolling, animation, and sprite integration. The design draws inspiration from classic 8-bit and 16-bit tile systems (NES, Game Boy, Sega Master System, SNES) while leveraging the banked memory architecture for massive tile libraries.

**Key Features:**
- 16×16 pixel tiles (matching sprite size)
- Hardware scrolling (256×256 pixel range per register)
- Per-tile attributes (flip, palette, priority, banking)
- Hardware animation system
- Up to 512 unique tile graphics via banking
- Flexible tilemap sizes (up to 255×255 tiles)
- Priority compositing with sprites
- Tile-based collision detection

---

## Tile Graphics Organization

### Tile Size and Format

**Fixed 16×16 pixel tiles:**
- Matches sprite size for consistency
- Simplifies hardware rendering pipeline
- Reduces number of tiles needed vs 8×8

**Reserved tile index:**
- **Tile index 0 is reserved as transparent/empty**
- When a tile entry has index 0, the tile is not rendered (fully transparent)
- No graphics fetch occurs for tile index 0, improving performance
- Usable tile indices are 1-255 (255 unique tile graphics)

**4bpp mode (Modes 0 & 3):**
- 16×16 pixels = 256 pixels
- 256 pixels ÷ 2 (4 bits per pixel) = **128 bytes per tile**
- 32KB bank ÷ 128 bytes = **256 tiles per bank**

**8bpp mode (Modes 1 & 2):**
- 16×16 pixels = 256 pixels
- 256 pixels × 1 byte = **256 bytes per tile**
- 32KB bank ÷ 256 bytes = **128 tiles per bank**

### Pixel Data Format

Tiles use **row-major order** (consistent with sprite system):

```
4bpp format:
Offset  Content
------  -------
0x00    Row 0, pixels 0-1 (high nibble = pixel 0, low nibble = pixel 1)
0x01    Row 0, pixels 2-3
0x02    Row 0, pixels 4-5
...
0x07    Row 0, pixels 14-15
0x08    Row 1, pixels 0-1
...
0x78    Row 15, pixels 0-1
...
0x7F    Row 15, pixels 14-15

Total: 128 bytes (0x80)
```

**Address calculation:**
```
address_in_bank = (tile_index × 128) + (row × 8) + (pixel_x ÷ 2)

Example: Get pixel (5, 3) from tile 10:
  offset = (10 × 128) + (3 × 8) + (5 ÷ 2)
         = 1280 + 24 + 2
         = 1306 (0x51A)
```

### Memory Organization

**Bank allocation (convention):**
- **Banks 16-19**: Primary tile graphics (1024 tiles at 4bpp)
- **Banks 20-23**: Additional tile graphics
- **Banks 24-31**: Reserved for tile expansion

**Per-bank capacity:**
```
4bpp: 256 tiles per bank × 14 banks = 3,584 total tiles
8bpp: 128 tiles per bank × 14 banks = 1,792 total tiles
```

**Tile banking:**
- Base tile graphics bank set via TILEMAP_GRAPHICS_BANK register
- Per-tile bank offset (2 bits) allows access to 4 consecutive banks
- Total: 256 tiles × 4 banks = **1024 addressable tiles**

---

## Tilemap Data Format

### Tile Entry Structure

Each tile in the tilemap is defined by **2 bytes**:

```
Byte 0: Tile Index (0-255)
  Which tile graphic to display

Byte 1: Tile Attributes
  Bit 7:   Flip horizontal (0=normal, 1=flipped)
  Bit 6:   Flip vertical (0=normal, 1=flipped)
  Bit 5:   Priority (0=behind sprites, 1=in front of sprites)
  Bits 4-3: Palette selection (4bpp modes only)
            00 = Palette 0 (colors 0-15)
            01 = Palette 1 (colors 16-31)
            10 = Palette 2 (colors 32-47)
            11 = Palette 3 (colors 48-63)
            Note: This is independent of the scanline palette map.
            Adjacent tiles can use different palettes freely.
  Bit 2:   Reserved (must be 0)
  Bits 1-0: Bank offset (0-3)
            Added to TILEMAP_GRAPHICS_BANK for this tile
```

**Example attribute values:**
```
0x00 = Normal, behind sprites, palette 0, bank+0
0x80 = Horizontal flip, behind sprites, palette 0, bank+0
0xC0 = H+V flip, behind sprites, palette 0, bank+0
0x20 = Normal, in front of sprites, palette 0, bank+0
0x10 = Normal, behind sprites, palette 1, bank+0
0x01 = Normal, behind sprites, palette 0, bank+1
0x23 = Normal, in front of sprites, palette 0, bank+3
```

### Tilemap Memory Layout

At runtime, tilemaps are stored in **row-major order** in banked memory:

```
Address = TILEMAP_ADDR + ((y × TILEMAP_WIDTH) + x) × 2

Example - 128×128 tilemap:
  Tile at (0, 0):   TILEMAP_ADDR + 0
  Tile at (1, 0):   TILEMAP_ADDR + 2
  Tile at (0, 1):   TILEMAP_ADDR + 256 (128 tiles × 2 bytes)
  Tile at (10, 5):  TILEMAP_ADDR + ((5 × 128) + 10) × 2 = TILEMAP_ADDR + 1300
```

**Memory requirements:**
```
32×32 tilemap:   32 × 32 × 2 = 2,048 bytes (2KB)
64×64 tilemap:   64 × 64 × 2 = 8,192 bytes (8KB)
128×128 tilemap: 128 × 128 × 2 = 32,768 bytes (32KB, fills one bank)
255×255 tilemap: 255 × 255 × 2 = 130,050 bytes (127KB, needs 4 banks)
```

### Devkit File Format (.tbin)

The devkit stores tilemaps in `.tbin` files with an 8-byte header. The entire file (header + tile data) is loaded into the cartridge bank. The header remains in memory so runtime code can read the dimensions.

**Header (8 bytes):**
```
Bytes 0-1: Width in tiles (little-endian uint16)
Bytes 2-3: Height in tiles (little-endian uint16)
Bytes 4-7: Reserved (set to 0)
```

**Tile Data (remaining bytes):**
- Follows immediately after header at offset 8
- Same 2-byte tile entry format as runtime
- Row-major order

**Size Constraints:**
```
Maximum file size: 32KB
Header: 8 bytes
Maximum tile data: 32,760 bytes (16,380 tiles)
Validation: width × height × 2 + 8 ≤ 32,768
```

**Runtime Loading:**
When using a `.tbin` tilemap at runtime:
1. Set `TILEMAP_DATA_BANK` to the bank containing the tilemap
2. Read width from bytes 0-1 of the bank, store in `TILEMAP_WIDTH`
3. Read height from bytes 2-3 of the bank, store in `TILEMAP_HEIGHT`
4. Set `TILEMAP_ADDR` to point past the header (e.g., bank base + 8)

**Example assembly for loading a tilemap from bank 32:**
```assembly
; Load tilemap from bank 32
LD R0, #32
ST R0, [$0145]        ; TILEMAP_DATA_BANK

; Switch to bank to read header
ST R0, [$0100]        ; BANK_REG

; Read width (little-endian)
LD R0, [$8000]        ; Width low byte
ST R0, [$0143]        ; TILEMAP_WIDTH (assumes width < 256)

; Read height (little-endian)
LD R0, [$8002]        ; Height low byte
ST R0, [$0144]        ; TILEMAP_HEIGHT (assumes height < 256)

; Set tilemap address to skip header (base + 8)
LD R0, #$80
ST R0, [$0146]        ; TILEMAP_ADDR_HI
LD R0, #$08
ST R0, [$0147]        ; TILEMAP_ADDR_LO (0x8008 = 0x8000 + 8)

; Enable tilemap
LD R0, #$01
ST R0, [$013D]        ; TILEMAP_ENABLE
```

---

## Palette System

### Per-Tile Palette Selection

The tilemap uses **per-tile palette selection**, independent of the scanline palette map. Each tile's attribute byte (bits 4-3) selects one of 4 palettes:

| Bits 4-3 | Palette | Color Range |
|----------|---------|-------------|
| 00 | Palette 0 | Colors 0-15 |
| 01 | Palette 1 | Colors 16-31 |
| 10 | Palette 2 | Colors 32-47 |
| 11 | Palette 3 | Colors 48-63 |

This allows adjacent tiles to use completely different color sets. A grass tile (palette 0 = greens) can sit next to a brick tile (palette 1 = browns) and a water tile (palette 2 = blues) on the same scanline.

### Scanline Palette Map Does Not Apply

The scanline palette map (0x0600-0x06FF) affects **sprites and direct framebuffer rendering only**. The tilemap ignores it entirely.

This separation matches classic console hardware (NES, SNES, Game Boy) where:
- Background tiles had fixed per-tile palette assignments
- Scanline-based palette effects required manual CPU intervention via raster interrupts

### Combined Effects

This architecture enables powerful visual combinations:

| Layer | Palette Source | Use Case |
|-------|---------------|----------|
| Tilemap | Per-tile attribute (bits 4-3) | Varied terrain, mixed environment tiles |
| Sprites | Scanline palette map | Gradient skies, underwater tints, flash effects |
| Framebuffer | Scanline palette map | Raster bars, color cycling, split-screen tints |

**Example:** A platformer level with:
- Tilemap: Green grass tiles (palette 0), brown platforms (palette 1), blue water (palette 2)
- Sprites: Gradient sunset sky effect (scanline 0-40 use warm palette, 40-80 use cooler palette)
- Both render simultaneously with independent color control

---

## Hardware Registers

### Register Map (0x013D - 0x0148)

| Address | Register | Access | Description |
|---------|----------|--------|-------------|
| 0x013D | TILEMAP_ENABLE | R/W | Tilemap control flags |
| 0x013E | TILEMAP_GRAPHICS_BANK | R/W | Bank containing tile graphics |
| 0x013F | TILEMAP_X_SCROLL_LO | R/W | X scroll offset (low byte) |
| 0x0140 | TILEMAP_X_SCROLL_HI | R/W | X scroll offset (high byte) |
| 0x0141 | TILEMAP_Y_SCROLL_LO | R/W | Y scroll offset (low byte) |
| 0x0142 | TILEMAP_Y_SCROLL_HI | R/W | Y scroll offset (high byte) |
| 0x0143 | TILEMAP_WIDTH | R/W | Tilemap width in tiles |
| 0x0144 | TILEMAP_HEIGHT | R/W | Tilemap height in tiles |
| 0x0145 | TILEMAP_DATA_BANK | R/W | Bank containing tilemap data |
| 0x0146 | TILEMAP_ADDR_HI | R/W | Tilemap address (high byte) |
| 0x0147 | TILEMAP_ADDR_LO | R/W | Tilemap address (low byte) |
| 0x0148 | TILE_ANIM_FRAME | R/W | Global animation counter |

### TILEMAP_ENABLE (0x013D)

Controls tilemap rendering and scrolling behavior.

```
Bit 0: Enable tilemap
  0 = Tilemap disabled (not rendered)
  1 = Tilemap enabled

Bit 1: Horizontal wrap
  0 = Clamp at edges (show border/blank)
  1 = Wrap around (X coordinate wraps at width)

Bit 2: Vertical wrap
  0 = Clamp at edges
  1 = Wrap around (Y coordinate wraps at height)

Bit 3: Priority mode
  0 = All tiles render behind sprites
  1 = Per-tile priority (use attribute bit 5)

Bits 7-4: Reserved
  Must be 0
```

**Usage:**
```assembly
; Enable tilemap with wrapping
LD R0, #$07           ; Enable + H wrap + V wrap
ST R0, [$013D]

; Disable tilemap
LD R0, #$00
ST R0, [$013D]

; Enable with per-tile priority
LD R0, #$09           ; Enable + priority mode
ST R0, [$013D]
```

### TILEMAP_GRAPHICS_BANK (0x013E)

Specifies which bank contains tile graphics (pixel data).

```
Value: 0-255
  Bank number containing tile graphics
  Convention: Banks 16-31

Note: Per-tile bank offset (attribute bits 1-0) is added to this value
      to support up to 4 banks (1024 tiles total at 4bpp)
```

**Usage:**
```assembly
; Use bank 16 for tile graphics
LD R0, #16
ST R0, [$013E]
```

### TILEMAP_X_SCROLL (0x013F-0x0140)

16-bit X scroll offset in pixels.

```
0x013F: TILEMAP_X_SCROLL_LO (low byte, 0-255)
0x0140: TILEMAP_X_SCROLL_HI (high byte, 0-255)

Full scroll range: 0-65535 pixels (0-4095 tiles at 16px)

16-bit scroll calculation:
  scroll_pixels = (SCROLL_HI << 8) | SCROLL_LO
```

**Simple scrolling (maps ≤256 pixels):**
```assembly
; Scroll right at 2 pixels per frame
LD R0, [$013F]        ; Read current X scroll low byte
ADD R0, #2            ; Add 2 pixels
ST R0, [$013F]        ; Update
```

**Large map scrolling:**
```assembly
; Set scroll to pixel position 1000 (0x03E8)
LD R0, #$E8
ST R0, [$013F]        ; TILEMAP_X_SCROLL_LO
LD R0, #$03
ST R0, [$0140]        ; TILEMAP_X_SCROLL_HI
```

### TILEMAP_Y_SCROLL (0x0141-0x0142)

16-bit Y scroll offset in pixels.

```
0x0141: TILEMAP_Y_SCROLL_LO (low byte, 0-255)
0x0142: TILEMAP_Y_SCROLL_HI (high byte, 0-255)

Same format as X scroll.
```

### TILEMAP_WIDTH / TILEMAP_HEIGHT (0x0143-0x0144)

Dimensions of tilemap in tiles.

```
Value: 1-255
  Width/height in tiles (not pixels)

Pixel dimensions = tiles × 16

Examples:
  32 tiles = 512 pixels
  64 tiles = 1024 pixels
  128 tiles = 2048 pixels
```

**Usage:**
```assembly
; Setup 128×128 tile map (2048×2048 pixels)
LD R0, #128
ST R0, [$0143]        ; TILEMAP_WIDTH
ST R0, [$0144]        ; TILEMAP_HEIGHT
```

### TILEMAP_DATA_BANK (0x0145)

Specifies which bank contains tilemap data (2-byte tile entries).

```
Value: 0-255
  Bank number containing tilemap array

Address calculation:
  1. Switch to TILEMAP_DATA_BANK
  2. Read from (TILEMAP_ADDR_HI:LO + tile_offset)
```

**Usage:**
```assembly
; Tilemap data in bank 32
LD R0, #32
ST R0, [$0145]
```

### TILEMAP_ADDR (0x0146-0x0147)

16-bit address where tilemap data starts within the tilemap data bank.

```
Format: Big-endian (high byte first)
  0x0146: High byte
  0x0147: Low byte

Typical values:
  0x8000: Start of bankable region
  0xB000: Mid-bank storage

Tile lookup:
  tile_offset = ((y * TILEMAP_WIDTH) + x) * 2
  tile_address = TILEMAP_ADDR + tile_offset
```

**Usage:**
```assembly
; Tilemap data starts at 0x8000 in the data bank
LD R0, #$80
ST R0, [$0146]        ; TILEMAP_ADDR_HI
LD R0, #$00
ST R0, [$0147]        ; TILEMAP_ADDR_LO
```

### TILE_ANIM_FRAME (0x0148)

Global animation frame counter for hardware tile animation.

```
Value: 0-255
  Increments each frame (or every N frames)
  Used by hardware to calculate animated tile offsets

Animation algorithm:
  If tile_properties[tile_idx] & 0x10:  // Animated bit
    speed = (properties >> 2) & 0x03
    frame_count = 2 << (properties & 0x03)

    anim_offset = (TILE_ANIM_FRAME >> speed) % frame_count
    final_tile = tile_idx + anim_offset
```

**Usage:**
```assembly
; Auto-increment each frame in VBlank handler
vblank:
  LD R0, [$0148]
  INC R0
  ST R0, [$0148]      ; TILE_ANIM_FRAME++
  RTI
```

---

## Tile Properties and Animation

### Tile Properties Table (0x0A80-0x0AFF)

Each tile type (0-127) has a properties byte defining behavior:

```
Bit 7: Solid (collision)
  0 = Non-solid (sprites pass through)
  1 = Solid (sprites collide)

Bit 6: Hazard
  0 = Safe
  1 = Damages player (spike, lava, etc.)

Bit 5: Reserved
  Must be 0

Bit 4: Animated
  0 = Static tile
  1 = Animated (uses TILE_ANIM_FRAME)

Bits 3-2: Animation speed
  00 = Every 4 frames (15 fps)
  01 = Every 8 frames (7.5 fps)
  10 = Every 15 frames (4 fps)
  11 = Every 30 frames (2 fps)

Bits 1-0: Frame count
  00 = 2 frames
  01 = 4 frames
  10 = 8 frames
  11 = 16 frames
```

**Example properties:**
```assembly
; Tile 10: Water (animated, 4 frames, medium speed)
LD R0, #%00010110     ; Animated, speed=01, frames=10 (4 frames)
ST R0, [$0A8A]        ; properties[10]

; Tile 42: Spike (hazard, solid)
LD R0, #%11000000     ; Solid + hazard
ST R0, [$0AAA]        ; properties[42]

; Tile 5: Brick (solid, static)
LD R0, #%10000000     ; Solid only
ST R0, [$0A85]        ; properties[5]
```

### Hardware Animation System

**Animation frames are stored sequentially:**
```
Water animation (4 frames):
  Tile 10: Frame 0 (calm)
  Tile 11: Frame 1 (ripple)
  Tile 12: Frame 2 (wave)
  Tile 13: Frame 3 (ripple)

Torch animation (2 frames):
  Tile 20: Frame 0
  Tile 21: Frame 1
```

**Hardware calculates frame automatically:**
```
speed_divisor = 1 << ((properties >> 2) & 0x03)  // 1, 2, 4, or 8
frame_count = 2 << (properties & 0x03)           // 2, 4, 8, or 16

current_frame = (TILE_ANIM_FRAME / speed_divisor) % frame_count
final_tile_index = base_tile_index + current_frame
```

**Example:** Water tile (properties = 0x16 = 0b00010110)
```
Frame 0:  TILE_ANIM_FRAME=0  → (0/2)%4 = 0 → Tile 10
Frame 1:  TILE_ANIM_FRAME=1  → (1/2)%4 = 0 → Tile 10
Frame 2:  TILE_ANIM_FRAME=2  → (2/2)%4 = 1 → Tile 11
Frame 3:  TILE_ANIM_FRAME=3  → (3/2)%4 = 1 → Tile 11
Frame 4:  TILE_ANIM_FRAME=4  → (4/2)%4 = 2 → Tile 12
...
```

---

## Rendering Pipeline

### Scanline-Based Rendering

The tilemap uses **scanline rendering** matching the sprite system:

```
For each scanline Y (0 to screen_height-1):
  1. Calculate visible tile rows (considering scroll)
  2. For each visible tile column X:
     - Fetch tile index and attributes from tilemap
     - Apply animation (if tile is animated)
     - Fetch tile pixel data from graphics bank
     - Apply horizontal/vertical flip
     - Apply palette offset
     - Render 16 pixels to line buffer
  3. Composite with sprites based on priority
  4. Output final scanline to framebuffer
```

### Tile Lookup Algorithm

```
// Calculate which tile to display
tile_x = (TILEMAP_X_SCROLL + screen_x) / 16
tile_y = (TILEMAP_Y_SCROLL + screen_y) / 16

// Apply wrapping if enabled
if (TILEMAP_ENABLE & 0x02):  // H wrap
  tile_x = tile_x % TILEMAP_WIDTH
if (TILEMAP_ENABLE & 0x04):  // V wrap
  tile_y = tile_y % TILEMAP_HEIGHT

// Fetch tile entry
tile_offset = (tile_y * TILEMAP_WIDTH + tile_x) * 2
switch_bank(TILEMAP_DATA_BANK)
tile_index = read(TILEMAP_ADDR + tile_offset)
tile_attr = read(TILEMAP_ADDR + tile_offset + 1)

// Apply animation
if (tile_properties[tile_index] & 0x10):
  tile_index = calculate_anim_frame(tile_index)

// Fetch pixel data
graphics_bank = TILEMAP_GRAPHICS_BANK + (tile_attr & 0x03)
switch_bank(graphics_bank)
pixel_data = read(0x8000 + tile_index * 128)
```

### Priority Compositing

**Priority layers (bottom to top):**
```
1. Background color (palette index 0)
2. Tilemap tiles with priority=0
3. Sprites with PRIORITY_BEHIND flag
4. Sprites with front priority (lowest ID wins)
5. Tilemap tiles with priority=1 (if enabled)
```

**Per-pixel composition:**
```
For each pixel (x, y):
  pixel_color = 0  // Background

  // Render tilemap (priority=0 tiles)
  if tilemap_enabled && !tile_priority:
    pixel_color = tilemap_pixel

  // Render sprites
  for each sprite at (x, y):
    if sprite_pixel != 0:  // Not transparent
      if sprite.priority == BEHIND:
        if pixel_color == 0:
          pixel_color = sprite_pixel
      else:  // FRONT
        pixel_color = sprite_pixel
        break

  // Render tilemap (priority=1 tiles)
  if tilemap_enabled && tile_priority:
    if tilemap_pixel != 0:
      pixel_color = tilemap_pixel

  output(pixel_color)
```

---

## Scrolling System

### Basic Scrolling

**Single-screen scrolling (0-255 pixels):**
```assembly
game_loop:
  LD R0, [$013F]      ; Read TILEMAP_X_SCROLL
  ADD R0, #1          ; Move right 1 pixel
  ST R0, [$013F]      ; Update (wraps at 256)

  ; Wait for VBlank
  JMP game_loop
```

### Large Map Scrolling

**For maps larger than 256 pixels, use full 16-bit scroll registers:**

The hardware provides 16-bit scroll capability with paired lo/hi registers:
- X scroll: `TILEMAP_X_SCROLL_LO` (0x013F) + `TILEMAP_X_SCROLL_HI` (0x0140)
- Y scroll: `TILEMAP_Y_SCROLL_LO` (0x0141) + `TILEMAP_Y_SCROLL_HI` (0x0142)

```assembly
; 16-bit scroll position tracking
.define scroll_x_hi $0B00
.define scroll_x_lo $0B01

scroll_right:
  ; Increment 16-bit position
  LD R0, [scroll_x_lo]
  ADD R0, #1
  ST R0, [scroll_x_lo]
  BRC .carry
  JMP .no_carry

.carry:
  LD R0, [scroll_x_hi]
  INC R0
  ST R0, [scroll_x_hi]

.no_carry:
  ; Update hardware registers (full 16-bit)
  LD R0, [scroll_x_lo]
  ST R0, [$013F]      ; TILEMAP_X_SCROLL_LO
  LD R0, [scroll_x_hi]
  ST R0, [$0140]      ; TILEMAP_X_SCROLL_HI

  RET
```

### Parallax Scrolling

**Multiple layers scrolling at different speeds:**
```assembly
; Background scrolls at 0.5× speed
; Foreground scrolls at 1.0× speed

update_scroll:
  ; Update camera position
  LD R0, [camera_x]
  INC R0
  ST R0, [camera_x]

  ; Foreground = camera_x (1:1)
  ST R0, [$013F]      ; TILEMAP_X_SCROLL

  ; Background = camera_x / 2 (requires second layer)
  SHR R0              ; Divide by 2
  ; (Would write to TILEMAP_2_X_SCROLL if second layer existed)

  RET
```

---

## Collision Detection

### Sprite-Tile Collision

Hardware collision detection (from sprite system) automatically detects when sprites overlap solid tiles.

**Tile solidity defined in properties:**
```assembly
; Make tile 5 (brick) solid
LD R0, #%10000000     ; Bit 7 = solid
ST R0, [$0B05]        ; properties[5]
```

**Reading collision buffer:**
```assembly
check_collisions:
  ; Check if sprite-tile collisions occurred
  LD R0, [$0108]      ; COLLISION_FLAGS
  AND R0, #$02        ; Bit 1 = sprite-tile
  BRZ no_collisions

  ; Get collision count
  LD R1, [$0109]      ; COLLISION_COUNT
  CMP R1, #0
  BRZ no_collisions

  ; Read first collision (3 bytes per entry)
  LD R2, [$0A00]      ; sprite_id
  LD R3, [$0A01]      ; tile type (0-127)
  LD R4, [$0A02]      ; type_flags + sides

  ; Check if tile type is hazard
  LD R5, R3
  ADD R5, #<(0x0B00)  ; Add to properties base
  LD R0, [R4:R5]      ; Read properties
  AND R0, #$40        ; Test hazard bit
  BRNZ player_hit

no_collisions:
  RET
```

### Software Tile Queries

**Check tile at specific position:**
```assembly
; Get tile at pixel position (R0, R1)
get_tile_at:
  ; Convert pixel to tile coords
  MOV R2, R0
  SHR R2              ; x / 2
  SHR R2              ; x / 4
  SHR R2              ; x / 8
  SHR R2              ; x / 16

  MOV R3, R1
  SHR R3
  SHR R3
  SHR R3
  SHR R3              ; y / 16

  ; Calculate tile offset = (y * width + x) * 2
  LD R4, [$0143]      ; TILEMAP_WIDTH
  ; ... multiply R3 × R4 ...
  ; ... add R2 ...
  ; ... multiply by 2 ...
  ; ... read from tilemap ...

  RET
```

---

## Performance Characteristics

### Rendering Cost

**Per scanline (Mode 0: 256×160):**
```
Tiles per scanline: 16 tiles (256px ÷ 16)
Tilemap fetches: 16 × 2 bytes = 32 bytes
Tile graphics: 16 × 8 bytes = 128 bytes
Total bandwidth: 160 bytes/scanline

Frame total: 160 scanlines × 160 bytes = 25.6 KB/frame
```

**Memory access pattern:**
```
Per scanline:
  - Read 32 bytes from tilemap data bank
  - Switch to graphics bank
  - Read 128 bytes of tile pixel data
  - Composite with sprite line buffer
  - Write 256 bytes to framebuffer (4bpp = 128 bytes)
```

### Optimization Strategies

**Tile caching:**
```
- Cache decoded tile pointers (bank + offset)
- Reuse tiles across multiple scanlines
- Pre-fetch next scanline during HBlank
```

**Animation:**
```
- Hardware animation costs no CPU cycles
- TILE_ANIM_FRAME auto-increments
- Frame calculation done during tile fetch
```

**Scrolling:**
```
- Pixel-level scroll = free (hardware)
- Tile-aligned scroll = most efficient
- Wrapping = no additional cost
```

---

## Programming Examples

### Example 1: Simple Static Map

```assembly
; Display a 32×32 tile map in Mode 0

setup_map:
  ; Load tile graphics into bank 16
  LD R0, #16
  ST R0, [$0100]         ; BANK_REG
  ; ... copy tile graphics to $8000+ ...

  ; Create tilemap in bank 32
  LD R0, #32
  ST R0, [$0100]         ; BANK_REG

  ; Fill with tile 5 (brick)
  LD R2, #$80            ; Start at $8000
  LD R3, #$00
  LD R4, #5              ; Tile index = 5
  LD R5, #0              ; Attributes = 0

.fill_loop:
  ST R4, [R2:R3]         ; Write tile index
  INC R3
  ST R5, [R2:R3]         ; Write attributes
  INC R3
  BRZ .done              ; Wrapped to 0?
  JMP .fill_loop

.done:
  ; Configure tilemap hardware
  LD R0, #16
  ST R0, [$013E]         ; TILEMAP_GRAPHICS_BANK

  LD R0, #32
  ST R0, [$0143]         ; TILEMAP_WIDTH
  ST R0, [$0144]         ; TILEMAP_HEIGHT

  LD R0, #32
  ST R0, [$0145]         ; TILEMAP_DATA_BANK

  LD R0, #$80
  ST R0, [$0146]         ; TILEMAP_ADDR_HI
  LD R0, #$00
  ST R0, [$0147]         ; TILEMAP_ADDR_LO

  LD R0, #$01            ; Enable only
  ST R0, [$013D]         ; TILEMAP_ENABLE

  RET
```

### Example 2: Animated Water Tiles

```assembly
; Setup animated water tiles

setup_water:
  ; Define tile 10 as animated water (4 frames, medium speed)
  LD R0, #%00010110      ; Animated, speed=01, frames=01 (4 frames)
  ST R0, [$0A8A]         ; properties[10]

  ; Tiles 10-13 contain the 4 animation frames
  ; (Graphics already loaded to bank 16)

  ; Place water tiles in map
  LD R0, #32
  ST R0, [$0100]         ; Switch to tilemap bank

  ; Write water tile at position (5, 5)
  ; Offset = (5 * 32 + 5) * 2 = 330
  LD R2, #$80
  LD R3, #$4A            ; $8000 + 330 = $814A

  LD R4, #10             ; Tile 10 (water)
  ST R4, [R2:R3]
  INC R3
  LD R4, #0              ; Default attributes
  ST R4, [R2:R3]

  RET

; VBlank handler increments animation
vblank:
  PUSH R0

  LD R0, [$0148]         ; TILE_ANIM_FRAME
  INC R0
  ST R0, [$0148]         ; Hardware uses this for animation

  POP R0
  RTI
```

### Example 3: Scrolling Camera Following Sprite

```assembly
; Follow player sprite (sprite 0) with camera

.define player_x $0700
.define player_y $0701
.define camera_x $0B10
.define camera_y $0B11

update_camera:
  ; Get player position
  LD R0, [player_x]
  LD R1, [player_y]

  ; Center camera on player (subtract half screen width)
  ; Screen = 256×160, center = 128×80
  SUB R0, #128           ; Center X
  ST R0, [camera_x]

  SUB R1, #80            ; Center Y
  ST R1, [camera_y]

  ; Update hardware scroll registers (low bytes only for simple case)
  LD R0, [camera_x]
  ST R0, [$013F]         ; TILEMAP_X_SCROLL_LO

  LD R0, [camera_y]
  ST R0, [$0141]         ; TILEMAP_Y_SCROLL_LO

  RET
```

### Example 4: Per-Tile Palette Selection

```assembly
; Create a checkerboard with alternating palettes

create_checkerboard:
  LD R0, #32
  ST R0, [$0100]         ; Switch to tilemap bank

  LD R2, #$80            ; Start at $8000
  LD R3, #$00

  LD R4, #0              ; Y counter
.row_loop:
  LD R5, #0              ; X counter

.col_loop:
  ; Tile index = 1 (solid color tile)
  LD R0, #1
  ST R0, [R2:R3]
  INC R3

  ; Attributes: Alternate palette based on (x+y) & 1
  MOV R0, R4
  ADD R0, R5
  AND R0, #1
  SHL R0
  SHL R0
  SHL R0
  SHL R0                 ; Shift to palette bits (4-3)
  ST R0, [R2:R3]
  INC R3

  INC R5
  CMP R5, #32
  BRNZ .col_loop

  INC R4
  CMP R4, #32
  BRNZ .row_loop

  RET
```

---

## Comparison with Classic Systems

| Feature | Virtual Console | NES | Game Boy | SNES |
|---------|----------------|-----|----------|------|
| Tile size | 16×16 | 8×8 | 8×8 | 8×8, 16×16 |
| Layers | 1 | 1 | 1 | 2-4 |
| Tiles per layer | 512 (w/ banking) | 256 | 256 | 1024 |
| Per-tile flip | Yes (H+V) | No | No | Yes (H+V) |
| Per-tile palette | Yes (4 palettes) | No | No | Yes (8 palettes) |
| Per-tile priority | Yes | No | No | Yes |
| Scrolling | Full pixel, wrapping | Full pixel | Full pixel | Full + Mode 7 |
| Hardware animation | Yes | No | No | No |
| Max map size | 255×255 tiles | 32×30 | 32×32 | 64×64 |

**Advantages over classic systems:**
- Larger tiles reduce tile count (one 16×16 = four 8×8)
- Banking system allows massive tile libraries
- Hardware animation saves CPU cycles
- Per-tile attributes (flip, palette, priority) increase variety
- Flexible map sizes up to 255×255

**Authentic constraints:**
- Single layer (matches NES/GB)
- Scanline rendering (authentic to all systems)
- Priority system (SNES-inspired)

---

## Register Summary

| Address | Name | Access | Description |
|---------|------|--------|-------------|
| 0x013D | TILEMAP_ENABLE | R/W | Enable, wrap modes, priority |
| 0x013E | TILEMAP_GRAPHICS_BANK | R/W | Bank with tile graphics |
| 0x013F | TILEMAP_X_SCROLL_LO | R/W | X scroll offset (low byte) |
| 0x0140 | TILEMAP_X_SCROLL_HI | R/W | X scroll offset (high byte) |
| 0x0141 | TILEMAP_Y_SCROLL_LO | R/W | Y scroll offset (low byte) |
| 0x0142 | TILEMAP_Y_SCROLL_HI | R/W | Y scroll offset (high byte) |
| 0x0143 | TILEMAP_WIDTH | R/W | Map width in tiles |
| 0x0144 | TILEMAP_HEIGHT | R/W | Map height in tiles |
| 0x0145 | TILEMAP_DATA_BANK | R/W | Bank with tilemap data |
| 0x0146 | TILEMAP_ADDR_HI | R/W | Tilemap address (high) |
| 0x0147 | TILEMAP_ADDR_LO | R/W | Tilemap address (low) |
| 0x0148 | TILE_ANIM_FRAME | R/W | Animation counter |

---

## Memory Map Summary

| Address Range | Size | Description |
|---------------|------|-------------|
| 0x013D-0x0148 | 12 B | Tilemap control registers |
| 0x0A80-0x0AFF | 128 B | Tile properties (128 tile types) |
| Banks 16-31 | 512 KB | Tile graphics storage |
| Banks 32+ | Variable | Tilemap data storage |

---

## Revision History

- v1.0 (2025): Initial specification

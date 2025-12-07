# Sprite Chip Specification

## Overview

The Virtual Console Video Chip is a custom graphics processor providing hardware-accelerated sprite rendering, collision detection, and display composition. The design is inspired by classic 8-bit sprite systems (NES PPU, Sega Master System VDP, Commodore 64 VIC-II) while incorporating modern conveniences.

**Key Features:**
- 128 hardware sprites with per-sprite banking
- 16×16 pixel sprites at 4bpp or 8bpp
- 8 sprites per scanline limit (authentic constraint)
- Hardware collision detection (sprite-sprite and sprite-tile)
- Per-sprite priority, palette, and flipping
- Scanline-based rendering pipeline
- Transparent pixel support (color 0)

---

## Sprite System Architecture

### Sprite Capacity

| Parameter | Value | Notes |
|-----------|-------|-------|
| Total sprites | 128 | Global sprite limit |
| Per-scanline limit | 8 | Hardware constraint (configurable) |
| Sprite size | 16×16 pixels | Fixed size |
| Color depth | 4bpp or 8bpp | Matches video mode |
| Transparency | Color 0 | Always transparent |
| Sprite graphics banks | 0-255 | Any bank (RAM or cartridge ROM) |

### Sprite Attribute Table

**Location:** `0x0700-0x097F` (640 bytes)

Each sprite is defined by 5 bytes:

```
Offset  Name          Description
------  ------------  --------------------------------------------------
+0      X             X position (0-255)
+1      Y             Y position (0-255)
+2      SPRITE_IDX    Sprite graphics index (0-255)
+3      FLAGS         Attribute flags (see below)
+4      BANK          Bank containing sprite graphics (0-255)
```

**Total capacity:** 128 sprites × 5 bytes = **640 bytes**

**Sprite address calculation:**
```
sprite_address = 0x0700 + (sprite_id × 5)

Example: Sprite 0 = 0x0700-0x0704
         Sprite 1 = 0x0705-0x0709
         Sprite 10 = 0x0732-0x0736
```

### Sprite Flags Byte

```
Bit 7: Flip Horizontal
  0 = Normal
  1 = Flipped horizontally

Bit 6: Flip Vertical
  0 = Normal
  1 = Flipped vertically

Bit 5: Priority
  0 = Render in front of background
  1 = Render behind background (color 0 of background shows through)

Bits 4-3: Palette Offset (4bpp modes)
  00 = Palette 0 (colors 0-15)
  01 = Palette 1 (colors 16-31)
  10 = Palette 2 (colors 32-47)
  11 = Palette 3 (colors 48-63)

Bits 2-0: Reserved
  Must be 0 for future compatibility
```

**Example flag values:**
```
0x00 = Normal, front priority, palette 0
0x80 = Horizontal flip, front priority, palette 0
0xC0 = Horizontal + vertical flip, front priority, palette 0
0x20 = Normal, behind background, palette 0
0x10 = Normal, front priority, palette 1
```

---

## Control Registers

### SPRITE_ENABLE (0x0104)

Controls sprite system operation.

```
Bit 0: Enable sprites
  0 = Sprites disabled (not rendered)
  1 = Sprites enabled

Bits 7-1: Reserved
  Must be 0
```

**Usage:**
```assembly
; Enable sprites
LD R0, #$01
ST R0, [$0104]

; Disable sprites
LD R0, #$00
ST R0, [$0104]
```

### SPRITE_COUNT (0x0105)

Number of active sprites to process (0-128).

```
Value: 0-128
  Number of sprites to evaluate each frame
  Sprites 0 to (SPRITE_COUNT-1) are processed
  Higher indices are ignored
```

**Performance optimization:**
```assembly
; Only 10 sprites active in this level
LD R0, #10
ST R0, [$0105]      ; Hardware only checks sprites 0-9

; Reduces evaluation time from 128 to 10 sprite checks
```

### SPRITE_GRAPHICS_BANK (0x0106)

Memory bank containing sprite graphics..

```
Value: 0-255
  Bank to pull sprite graphics from
```

**Performance optimization:**
```assembly
; Bank 2 for sprite graphics
LD R0, #2
ST R0, [$0106]
```

### SPRITE_OVERFLOW (0x0107) - Read Only

Indicates sprite overflow conditions.

```
Bit 0: Scanline overflow occurred this frame
  1 = More than 8 sprites on at least one scanline
  0 = No overflow
  Cleared automatically at start of each frame

Bits 7-1: Reserved
  Always 0
```

**Usage:**
```assembly
; Check for sprite overflow (flickering likely)
LD R0, [$0107]
AND R0, #$01
BRZ no_overflow

; Too many sprites on a scanline - some didn't render
; Consider spacing sprites vertically or reducing count
```

### SPRITE_SCANLINE_LIMIT (0x010B)

Configurable per-scanline sprite limit (default: 8).

```
Value: 1-16
  Maximum sprites rendered per scanline
  Default: 8 (authentic to NES/SMS)
  Higher values use more hardware resources
```

**Usage:**
```assembly
; Use NES-style limit
LD R0, #8
ST R0, [$010B]

; More permissive (less authentic but smoother)
LD R0, #16
ST R0, [$010B]
```

---

## Sprite Graphics Storage

### Memory Organization

Sprite graphics are typically stored in cartridge ROM banks (16-255). Each sprite attribute includes a bank byte, allowing sprites to reference graphics in any bank. This enables:

- Direct ROM access (no copy to RAM required)
- Massive sprite libraries (up to 240 banks × 256 sprites = 61,440 sprite graphics at 4bpp)
- Mixed RAM/ROM usage (dynamically generated sprites in banks 0-3, static sprites in ROM)

**16×16 sprite at 4bpp:**
- 16×16 = 256 pixels
- 256 pixels ÷ 2 pixels/byte = 128 bytes per sprite
- 32768 bytes/bank ÷ 128 bytes/sprite = **256 sprites per bank**

**16×16 sprite at 8bpp:**
- 16×16 = 256 pixels
- 256 pixels × 1 byte/pixel = 256 bytes per sprite
- 32768 bytes/bank ÷ 256 bytes/sprite = **128 sprites per bank**

### Graphics Data Format

Sprite graphics are stored in **row-major order** (big-endian friendly):

**4bpp format:**
```
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

**Sprite graphics address calculation:**
```
bank_offset = sprite_index × 128 (for 4bpp)
row_offset = row × 8
pixel_byte_offset = pixel_x ÷ 2

address_in_bank = (sprite_index × 128) + (row × 8) + (pixel_x ÷ 2)
```

**Example: Get pixel (5, 3) from sprite 10:**
```
bank_offset = 10 × 128 = 1280 (0x500)
row_offset = 3 × 8 = 24
pixel_byte = 5 ÷ 2 = 2

final_offset = 1280 + 24 + 2 = 1306 (0x51A)
pixel_value = nibble at offset 0x51A (high nibble since x=5 is odd)
```

### Creating Sprite Graphics

**Assembly example - Setting up sprite graphics:**
```assembly
; Switch to sprite graphics bank (cartridge bank 2 = absolute bank 18)
LD R0, #18             ; Bank 18 for sprite graphics
ST R0, [$0100]         ; BANK_REG

; Write sprite 0 - simple 2×2 pixel test pattern
; Assuming starting at bank offset 0x8000

; Row 0
LD R0, #$12            ; Pixels 0-1: color 1, color 2
ST R0, [$8000]
LD R0, #$34            ; Pixels 2-3: color 3, color 4
ST R0, [$8001]
; ... continue for full row ...

; Row 1
LD R0, #$56
ST R0, [$8008]
; ... etc ...
```

---

## Rendering Pipeline

The video chip uses a **scanline-based rendering pipeline** matching authentic hardware operation.

### Frame Timing

```
Frame rate: 60 Hz (NTSC-style)
Frame time: 16.67 ms
Scanlines per frame: 160 (Mode 0: 256×160)

Per scanline:
  Visible time: ~82% (rendering pixels)
  HBlank time: ~18% (sprite evaluation and fetch)
```

### Scanline Rendering Phases

For each scanline (Y = 0 to 159):

#### Phase 1: Sprite Evaluation (HBlank Start)

```
For sprite_id = 0 to (SPRITE_COUNT - 1):
  sprite = read_sprite(sprite_id)

  // Check if sprite intersects this scanline
  if sprite.y <= current_scanline < sprite.y + 16:
    // Add to active list
    active_sprites.push(sprite)

    // Check per-scanline limit
    if active_sprites.length >= SPRITE_SCANLINE_LIMIT:
      SPRITE_OVERFLOW = 1
      break  // Stop evaluation (authentic behavior)
```

**Sprite priority order:**
- Lower sprite IDs have higher priority
- Sprite 0 always wins over sprite 1, etc.
- This is enforced during rendering, not evaluation

#### Phase 2: Sprite Data Fetch (HBlank)

```
For each sprite in active_sprites:
  row = current_scanline - sprite.y

  // Apply vertical flip
  if sprite.flags & FLIP_VERTICAL:
    row = 15 - row

  // Fetch row data from sprite's bank
  bank_address = 0x8000 + (sprite.sprite_idx × 128) + (row × 8)
  line_buffer[sprite] = read_from_bank(sprite.bank, bank_address, 8 bytes)
```

**Line buffer:**
- Stores 8 sprites × 8 bytes = 64 bytes
- Pre-fetched during HBlank
- Used during visible pixel rendering

#### Phase 3: Pixel Rendering (Visible Scanline)

```
For x = 0 to 255:
  // Start with background pixel
  pixel_color = framebuffer[y][x]
  sprite_drawn = false

  // Check sprites in REVERSE priority order (high ID to low ID)
  // This allows low ID sprites to overwrite high ID sprites
  for sprite in reverse(active_sprites):
    sprite_x = x - sprite.x

    // Check if pixel is within sprite bounds
    if sprite_x >= 0 AND sprite_x < 16:
      // Apply horizontal flip
      if sprite.flags & FLIP_HORIZONTAL:
        sprite_x = 15 - sprite_x

      // Get pixel from line buffer
      pixel_value = get_pixel(line_buffer[sprite], sprite_x)

      // Check transparency
      if pixel_value != 0:
        // Apply palette offset
        final_color = pixel_value + (sprite.palette_offset × 16)

        // Check priority
        if sprite.flags & PRIORITY_BEHIND:
          // Only draw if background is transparent
          if pixel_color == 0:
            pixel_color = final_color
            sprite_drawn = true
        else:
          // Draw in front
          pixel_color = final_color
          sprite_drawn = true
          break  // First opaque sprite wins

  // Output final pixel
  output_pixel(x, y, pixel_color)
```

### Sprite Composition Rules

**Priority resolution:**
1. Background layer (color 0 = transparent)
2. Sprites with PRIORITY_BEHIND flag (only visible through transparent background)
3. Sprites with front priority (lowest ID wins on overlap)

**Transparency:**
- Color 0 is always transparent for sprites
- Allows sprite edges to blend naturally
- Background shows through color 0 pixels

**Overlapping sprites:**
```
Sprite 0: Priority front, at (10, 10)
Sprite 1: Priority front, at (12, 10)
Sprite 2: Priority behind, at (14, 10)

At pixel (11, 10):
  - Sprite 1 overlaps sprite 0
  - Sprite 0 has lower ID (higher priority)
  - Sprite 0's pixel is drawn

At pixel (15, 10) where background is color 5:
  - Sprite 2 has priority behind
  - Background color 5 (opaque) is drawn
  - Sprite 2 is not visible

At pixel (15, 10) where background is color 0:
  - Sprite 2 has priority behind
  - Background color 0 (transparent)
  - Sprite 2's pixel is drawn
```

---

## Collision Detection

The video chip provides **hardware collision detection** during rendering.

### Collision Types

**Sprite-Sprite Collision:**
- Detected when two sprites have overlapping non-transparent pixels
- Written to collision buffer at 0x0A00+

**Sprite-Tile Collision:**
- Detected when sprite overlaps a solid tile (bit 7 set in tile properties)
- Includes collision side information (top/bottom/left/right)
- Written to collision buffer

### Collision Modes

**COLLISION_MODE register (0x010A):**
```
Bit 0: Enable sprite-sprite detection
  0 = Disabled
  1 = Enabled

Bit 1: Enable sprite-tile detection
  0 = Disabled
  1 = Enabled

Bit 2: Pixel-perfect mode
  0 = Bounding box collision (fast, less accurate)
  1 = Pixel-perfect collision (slower, accurate)

Bits 7-3: Reserved
```

**Bounding box mode:**
- Checks if sprite rectangles overlap
- Fast (single comparison per sprite pair)
- May report false positives (sprites close but not touching)

**Pixel-perfect mode (recommended):**
- Checks actual non-transparent pixels
- Accurate and fair collision detection
- Essential for low-resolution displays where pixels are large
- Only slightly slower (~100-1000 pixel comparisons per overlapping pair)

### Collision Buffer

**Location:** 0x0980-0x0A7F (256 bytes)

Each collision entry is 3 bytes:

```
Offset  Name          Description
------  ------------  --------------------------------------------------
+0      SPRITE_ID     Which sprite collided (0-127)
+1      DATA          Collision partner (sprite ID or tile type)
+2      TYPE_FLAGS    Bit 7: 1=sprite-tile, 0=sprite-sprite
                      Bits 3-0: Collision side (sprite-tile only)
```

**Collision side encoding (bits 3-0):**
```
Bit 3: Top collision
Bit 2: Bottom collision
Bit 1: Left collision
Bit 0: Right collision

Examples:
0b0001 = Right side collision
0b1000 = Top side collision
0b0101 = Right + left (squished horizontally)
0b1001 = Top + right (corner collision)
```

**Buffer capacity:** 256 bytes ÷ 3 bytes = **85 collision entries** per frame

### Collision Detection Timing

```
Start of frame:
  - COLLISION_FLAGS cleared (0x0108)
  - COLLISION_COUNT cleared (0x0109)
  - Collision buffer reset

During rendering (per scanline):
  - Sprite overlaps detected
  - Pixel-perfect checks performed if enabled
  - Collisions written to buffer
  - COLLISION_COUNT incremented
  - COLLISION_FLAGS bits set

End of frame (VBlank):
  - All collisions for frame are in buffer
  - CPU can read during VBlank or next frame
  - Buffer remains valid until next frame start
```

### Reading Collision Data

```assembly
; Check if any collisions occurred
LD R0, [$0108]         ; Read COLLISION_FLAGS
AND R0, #$01           ; Check sprite-sprite bit
BRZ no_sprite_collision

; Get number of collisions
LD R1, [$0109]         ; Read COLLISION_COUNT
CMP R1, #0
BRZ no_sprite_collision

; Process first collision
LD R2, [$0980]         ; sprite_id
LD R3, [$0981]         ; other sprite ID or tile type
LD R4, [$0982]         ; type_flags

; Check collision type
AND R4, #$80           ; Test bit 7
BRNZ sprite_tile_collision

; Sprite-sprite collision
; R2 = first sprite, R3 = second sprite
CALL handle_sprite_collision
JMP done

sprite_tile_collision:
; Sprite-tile collision
; R2 = sprite ID, R3 = tile type, R4 bits 3-0 = sides
AND R4, #$0F           ; Mask side bits
AND R4, #$08           ; Check top collision
BRNZ hit_from_top

done:
```

---

## Performance Characteristics

### Sprite Evaluation Cost

```
Per frame (60 fps):
  Worst case: 128 sprites × 160 scanlines = 20,480 checks
  With SPRITE_COUNT=20: 20 sprites × 160 = 3,200 checks

Per scanline:
  Worst case: 128 sprite checks
  Early exit on limit: ~8-16 checks average
  Typical (20 active): 20 checks, 2-4 on scanline
```

### Collision Detection Cost

**Bounding box mode:**
```
Sprite-sprite: N×(N-1)/2 comparisons
  10 sprites: 45 checks
  20 sprites: 190 checks
  50 sprites: 1,225 checks
Cost: ~10 operations per check
Total: negligible (<0.1ms)
```

**Pixel-perfect mode:**
```
Only for overlapping bounding boxes:
  Typical: 2-5 overlapping pairs per frame
  Per overlap: 100-256 pixel comparisons
  Cost: ~1000 operations per overlap
Total: ~0.5-1ms for typical games
```

### Optimization Tips

```assembly
; 1. Set SPRITE_COUNT to actual active sprites
LD R0, #15             ; Only 15 sprites this level
ST R0, [$0105]         ; Reduces checks from 128 to 15

; 2. Sort sprites by Y position
;    More cache-friendly, better early exit behavior

; 3. Disable unused collision types
LD R0, #%00000010      ; Only sprite-tile, bounding box
ST R0, [$010A]         ; COLLISION_MODE

; 4. Use sprite IDs strategically
;    Important sprites (player) = low IDs
;    Visual effects = high IDs (ok if culled)
```

---

## Hardware Constraints and Limitations

### Per-Scanline Sprite Limit

**Limit: 8 sprites (configurable up to 16)**

When more than 8 sprites intersect a scanline:
- First 8 sprites (by ID) are rendered
- Remaining sprites are **not rendered** on that scanline
- SPRITE_OVERFLOW flag is set
- This is authentic hardware behavior (NES, SMS, etc.)

**Visual result:**
- Sprite "flickering" when moving vertically
- Lower-ID sprites stable, higher-ID sprites flicker
- Classic 8-bit game artifact

**Developer strategies:**
```assembly
; Strategy 1: Sprite multiplexing
; Alternate which sprites use which IDs each frame
; Creates 30Hz flicker (barely visible)

; Strategy 2: Vertical spacing
; Ensure no more than 8 sprites on same scanline
; Careful enemy/object placement

; Strategy 3: Priority management
; Player = sprite 0 (always visible)
; Enemies = sprites 1-7
; Effects/pickups = sprites 8+ (ok if flicker)
```

### Memory Bandwidth

**Sprite fetches per scanline:**
- 8 sprites × 8 bytes = 64 bytes
- Fetched during HBlank (~18% of scanline time)
- Bandwidth: 64 bytes ÷ 30µs ≈ 2 MB/s
- Well within typical FPGA BRAM bandwidth

### Sprite Size

**Fixed at 16×16 pixels:**
- No 8×8 mode (unlike NES)
- No size variation (unlike C64)
- Simplifies hardware, reduces complexity

**For smaller sprites:**
```
Use 16×16 with transparent padding:
8×8 sprite: pad with 8 pixels of color 0 on right/bottom
4×4 sprite: center in 16×16 with color 0 border
```

### Color 0 Always Transparent

**Color 0 = transparency for sprites**
- Cannot be changed
- Palette index 0 never draws for sprites
- Background layer can use color 0 (shows as palette color)

---

## Programming Examples

### Example 1: Single Sprite Setup

```assembly
; Display a player sprite at center screen

.org $0B80

main:
  ; Enable sprites
  LD R0, #1
  ST R0, [$0104]         ; SPRITE_ENABLE = 1
  LD R0, #1
  ST R0, [$0105]         ; SPRITE_COUNT = 1

  ; Setup sprite 0 (player)
  ; Position
  LD R0, #120            ; X = 120
  ST R0, [$0700]
  LD R0, #72             ; Y = 72
  ST R0, [$0701]

  ; Graphics
  LD R0, #5              ; Sprite index 5
  ST R0, [$0702]

  ; Flags
  LD R0, #$00            ; Normal, front, palette 0
  ST R0, [$0703]

  ; Bank
  LD R0, #18             ; Bank 18 (cartridge bank 2)
  ST R0, [$0704]

done:
  JMP done
```

### Example 2: Moving Sprite with Controller

```assembly
; Move sprite 0 with D-pad

.define SPRITE_0_X $0700
.define SPRITE_0_Y $0701
.define CONTROLLER_1 $0136

game_loop:
  ; Read controller
  LD R0, [CONTROLLER_1]

  ; Check UP
  AND R0, #$80           ; Bit 7
  BRZ .check_down
  LD R1, [SPRITE_0_Y]
  DEC R1
  ST R1, [SPRITE_0_Y]

.check_down:
  LD R0, [CONTROLLER_1]
  AND R0, #$40           ; Bit 6
  BRZ .check_left
  LD R1, [SPRITE_0_Y]
  INC R1
  ST R1, [SPRITE_0_Y]

.check_left:
  LD R0, [CONTROLLER_1]
  AND R0, #$20           ; Bit 5
  BRZ .check_right
  LD R1, [SPRITE_0_X]
  DEC R1
  ST R1, [SPRITE_0_X]

.check_right:
  LD R0, [CONTROLLER_1]
  AND R0, #$10           ; Bit 4
  BRZ .done
  LD R1, [SPRITE_0_X]
  INC R1
  ST R1, [SPRITE_0_X]

.done:
  JMP game_loop
```

### Example 3: Sprite Animation

```assembly
; Animate sprite by cycling through 4 frames

.define SPRITE_0_IDX $0702
.define ANIM_FRAME $0B00
.define ANIM_COUNTER $0B01

; VBlank handler
vblank_handler:
  ; Increment animation counter
  LD R0, [ANIM_COUNTER]
  INC R0
  ST R0, [ANIM_COUNTER]

  ; Every 15 frames, advance animation
  AND R0, #$0F
  BRNZ .done

  ; Advance frame (0-3)
  LD R0, [ANIM_FRAME]
  INC R0
  AND R0, #$03           ; Wrap to 0-3
  ST R0, [ANIM_FRAME]

  ; Update sprite index
  ; Frames are sprites 10, 11, 12, 13
  ADD R0, #10
  ST R0, [SPRITE_0_IDX]

.done:
  RTI
```

### Example 4: Collision Detection

```assembly
; Check player collision with enemies

.define PLAYER_SPRITE 0
.define COLLISION_FLAGS $0108
.define COLLISION_COUNT $0109
.define COLLISION_BUFFER $0980

check_collisions:
  ; Check if any collisions occurred
  LD R0, [COLLISION_FLAGS]
  AND R0, #$01           ; Sprite-sprite bit
  BRZ .no_collisions

  ; Get collision count
  LD R1, [COLLISION_COUNT]
  CMP R1, #0
  BRZ .no_collisions

  ; Check each collision
  LD R2, #0              ; Index counter

.collision_loop:
  CMP R2, R1             ; Done with all?
  BRC .done

  ; Calculate buffer offset (3 bytes per entry)
  MOV R3, R2
  SHL R3                 ; × 2
  ADD R3, R2             ; × 3

  ; Read collision entry
  LD R4, #>(COLLISION_BUFFER)
  LD R5, #<(COLLISION_BUFFER)
  ADD R5, R3
  BRC .carry
  JMP .no_carry
.carry:
  INC R4
.no_carry:

  ; Get sprite ID
  LD R0, [R4:R5]

  ; Check if it's the player
  CMP R0, #PLAYER_SPRITE
  BRNZ .next

  ; Player collided!
  INC R5
  LD R0, [R4:R5]         ; Get other sprite ID
  CALL handle_hit

.next:
  INC R2
  JMP .collision_loop

.no_collisions:
.done:
  RET
```

### Example 5: Sprite Flipping

```assembly
; Flip player sprite based on movement direction

.define SPRITE_0_FLAGS $0703
.define PLAYER_FACING $0B02    ; 0=right, 1=left

move_player_left:
  ; Set facing left
  LD R0, #1
  ST R0, [PLAYER_FACING]

  ; Set horizontal flip
  LD R0, [SPRITE_0_FLAGS]
  OR R0, #$80            ; Set bit 7
  ST R0, [SPRITE_0_FLAGS]

  ; ... move sprite ...
  RET

move_player_right:
  ; Set facing right
  LD R0, #0
  ST R0, [PLAYER_FACING]

  ; Clear horizontal flip
  LD R0, [SPRITE_0_FLAGS]
  AND R0, #$7F           ; Clear bit 7
  ST R0, [SPRITE_0_FLAGS]

  ; ... move sprite ...
  RET
```

---

## Register Summary

| Address | Name                  | Access | Description                      |
|---------|-----------------------|--------|----------------------------------|
| 0x0104  | SPRITE_ENABLE         | R/W    | Bit 0: Enable sprite rendering   |
| 0x0105  | SPRITE_COUNT          | R/W    | Number of active sprites (0-128) |
| 0x0106  | SPRITE_GRAPHICS_BANK  | R/W    | Memory bank containing graphics  |
| 0x0107  | SPRITE_OVERFLOW       | R      | Scanline overflow flag           |
| 0x0108  | COLLISION_FLAGS       | R/W1C  | Collision status flags           |
| 0x0109  | COLLISION_COUNT       | R      | Number of collision entries      |
| 0x010A  | COLLISION_MODE        | R/W    | Collision detection mode control |
| 0x010B  | SPRITE_SCANLINE_LIMIT | R/W    | Max sprites per scanline (1-16)  |

---

## Memory Map Summary

| Address Range | Size | Description |
|---------------|------|-------------|
| 0x0700-0x097F | 640 B | Sprite Attribute Table (128 sprites × 5 bytes) |
| 0x0980-0x0A7F | 256 B | Collision Buffer (85 entries × 3 bytes) |
| Banks 0-255 | 8 MB | Sprite graphics (any bank: RAM or ROM) |

---

## Comparison with Classic Systems

| Feature | Virtual Console | NES PPU | SMS VDP | C64 VIC-II |
|---------|----------------|---------|---------|------------|
| Total sprites | 128 | 64 | 64 | 8 |
| Per scanline | 8 (cfg to 16) | 8 | 8 | 8 |
| Sprite size | 16×16 | 8×8 or 8×16 | 8×8 or 8×16 | 24×21 (exp) |
| Per-sprite bank | Yes | No | No | No |
| Collision detect | Hardware | Sprite 0 only | Hardware | Hardware |
| Priority | Per-sprite | Per-sprite | Per-sprite | Fixed |
| Flipping | H+V | H+V | H+V | H+V (expand) |

**Advantages over classic systems:**
- More total sprites (128 vs 64/8)
- Per-sprite banking (massive graphics library)
- Better collision detection (pixel-perfect mode)
- Configurable scanline limit

**Authentic constraints retained:**
- 8 sprites per scanline default
- Scanline overflow behavior
- Fixed sprite size
- Color 0 transparency

---

## Implementation Notes

### For Emulator Developers

The sprite system should be implemented as a separate module from the CPU:

```typescript
class SpriteEngine {
  // Called every scanline
  renderScanline(y: number): void;

  // Called at frame start
  resetFrame(): void;

  // Sprite evaluation
  evaluateSprites(scanline: number): Sprite[];

  // Collision detection
  detectCollisions(): void;
}
```

**Key principles:**
1. **Scanline-based rendering** - Process one scanline at a time
2. **Per-scanline limits** - Enforce 8-sprite limit authentically
3. **Independent from CPU** - Runs in parallel with CPU execution
4. **Memory-mapped interface** - CPU only writes to sprite table and registers

### For Game Developers

**Best practices:**
1. Keep active sprite count low (set SPRITE_COUNT appropriately)
2. Use lower sprite IDs for important objects (player, enemies)
3. Space sprites vertically to avoid scanline limit
4. Test with sprite overflow visualization
5. Use collision buffer efficiently (check count before processing)

---

## Revision History

- v1.0 (2024): Initial specification
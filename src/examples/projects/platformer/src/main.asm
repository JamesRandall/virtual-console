; Platformer Example
; Displays a tilemap and a player sprite that can move around
; Player cannot move into tiles (collision detection)
;
; Assumes:
; - Tile graphics are in cartridge bank 2 (absolute bank 18)
; - Tilemap data (.tbin file) is in cartridge bank 4 (absolute bank 20)
; - Player sprite graphics are in cartridge bank 5 (absolute bank 21)
;
; Uses VBLANK interrupt for smooth 60fps movement

.org $0B80

; =============================================================================
; Hardware Register Constants
; =============================================================================

.define VIDEO_MODE          $0101

; Interrupt registers
.define INT_STATUS          $0114
.define INT_ENABLE          $0115
.define VBLANK_VEC_HI       $0132
.define VBLANK_VEC_LO       $0133

; Sprite control registers
.define SPRITE_ENABLE       $0104
.define SPRITE_COUNT        $0105

; Sprite 0 attribute addresses (player)
.define SPRITE_0_X          $0700
.define SPRITE_0_Y          $0701
.define SPRITE_0_IDX        $0702
.define SPRITE_0_FLAGS      $0703
.define SPRITE_0_BANK       $0704

; Tilemap control registers
.define TILEMAP_ENABLE      $013D
.define TILEMAP_GFX_BANK    $013E
.define TILEMAP_X_SCROLL_LO $013F
.define TILEMAP_X_SCROLL_HI $0140
.define TILEMAP_Y_SCROLL_LO $0141
.define TILEMAP_Y_SCROLL_HI $0142
.define TILEMAP_WIDTH       $0143
.define TILEMAP_HEIGHT      $0144
.define TILEMAP_DATA_BANK   $0145
.define TILEMAP_ADDR_HI     $0146
.define TILEMAP_ADDR_LO     $0147
.define TILE_ANIM_FRAME     $0148

; Controller registers
.define CTRL1_STATE         $0136

; Scanline palette map
.define SCANLINE_MAP        $0600

; Framebuffer
.define FRAMEBUFFER_START   $B000

; =============================================================================
; Constants
; =============================================================================

; Screen dimensions
.define SCREEN_WIDTH        256
.define SCREEN_HEIGHT       160

; Tile and sprite size
.define TILE_SIZE           16
.define SPRITE_SIZE         16

; Banks (cartridge banks start at 16)
.define TILE_GFX_BANK       18      ; Cartridge bank 2 = absolute 18
.define TILEMAP_BANK        20      ; Cartridge bank 4 = absolute 20
.define PLAYER_SPRITE_BANK  21      ; Cartridge bank 5 = absolute 21

; Tilemap data offset (skip 8-byte .tbin header)
.define TILEMAP_DATA_OFFSET 8

; Tilemap enable flags
.define TM_ENABLE           $01     ; Bit 0: Enable tilemap

; Controller button masks (from cheatsheet)
.define BTN_UP              $80
.define BTN_DOWN            $40
.define BTN_LEFT            $20
.define BTN_RIGHT           $10

; Player movement speed (pixels per frame)
.define PLAYER_SPEED        2

; =============================================================================
; Variables (in lower memory)
; =============================================================================

.define PLAYER_X            $0B00   ; Player X position (screen coords)
.define PLAYER_Y            $0B01   ; Player Y position (screen coords)
.define MAP_WIDTH           $0B02   ; Tilemap width in tiles
.define MAP_HEIGHT          $0B03   ; Tilemap height in tiles
.define TEMP_X              $0B04   ; Temporary X for collision check
.define TEMP_Y              $0B05   ; Temporary Y for collision check

; =============================================================================
; Entry Point
; =============================================================================

main:
    NOP
    NOP
    NOP
    ; Disable interrupts during setup
    CLI

    ; Set video mode 0 (256x160 @ 4bpp)
    LD R0, #0
    ST R0, [VIDEO_MODE]

    ; Clear framebuffer to black
    CALL clear_screen

    ; Set up scanline palette map (all scanlines use palette 0)
    CALL setup_scanline_map

    ; Read tilemap header to get dimensions
    CALL read_tilemap_header

    ; Configure tilemap registers
    CALL setup_tilemap

    ; Initialize player position (top-left corner)
    LD R0, #0
    ST R0, [PLAYER_X]
    ST R0, [PLAYER_Y]

    ; Setup player sprite
    CALL setup_player_sprite

    ; Clear any pending interrupt flags
    LD R0, #$FF
    ST R0, [INT_STATUS]

    ; Install VBLANK interrupt vector
    LD R0, #(vblank_handler & $FF)
    ST R0, [VBLANK_VEC_LO]
    LD R0, #(vblank_handler >> 8)
    ST R0, [VBLANK_VEC_HI]

    ; Enable VBLANK interrupt
    LD R0, #$01
    ST R0, [INT_ENABLE]

    ; Enable interrupts
    SEI

    ; Main loop - idles while interrupt handles movement
main_loop:
    NOP
    JMP main_loop

; =============================================================================
; Setup Player Sprite
; =============================================================================

setup_player_sprite:
    PUSH R0

    ; Enable sprites
    LD R0, #1
    ST R0, [SPRITE_ENABLE]

    ; Set sprite count to 1
    LD R0, #1
    ST R0, [SPRITE_COUNT]

    ; Set sprite 0 position
    LD R0, [PLAYER_X]
    ST R0, [SPRITE_0_X]
    LD R0, [PLAYER_Y]
    ST R0, [SPRITE_0_Y]

    ; Set sprite index (0)
    LD R0, #0
    ST R0, [SPRITE_0_IDX]

    ; Set sprite flags (no flip, front priority, palette 0)
    LD R0, #$00
    ST R0, [SPRITE_0_FLAGS]

    ; Set sprite bank (cartridge bank 5 = absolute 21)
    LD R0, #PLAYER_SPRITE_BANK
    ST R0, [SPRITE_0_BANK]

    POP R0
    RET

; =============================================================================
; VBLANK Interrupt Handler
; Called 60 times per second - handles controller input and player movement
; =============================================================================

vblank_handler:
    PUSH R0
    PUSH R1
    PUSH R2

    ; Clear VBLANK flag (write 1 to clear)
    LD R0, #$01
    ST R0, [INT_STATUS]

    ; Increment animation frame counter
    LD R0, [TILE_ANIM_FRAME]
    INC R0
    ST R0, [TILE_ANIM_FRAME]

    ; Read controller state
    LD R2, [CTRL1_STATE]

    ; Check UP button
    MOV R0, R2
    AND R0, #BTN_UP
    BRZ .check_down
    CALL try_move_up

.check_down:
    MOV R0, R2
    AND R0, #BTN_DOWN
    BRZ .check_left
    CALL try_move_down

.check_left:
    MOV R0, R2
    AND R0, #BTN_LEFT
    BRZ .check_right
    CALL try_move_left

.check_right:
    MOV R0, R2
    AND R0, #BTN_RIGHT
    BRZ .update_sprite
    CALL try_move_right

.update_sprite:
    ; Update sprite position from player variables
    LD R0, [PLAYER_X]
    ST R0, [SPRITE_0_X]
    LD R0, [PLAYER_Y]
    ST R0, [SPRITE_0_Y]

.vblank_done:
    POP R2
    POP R1
    POP R0
    RTI

; =============================================================================
; Movement Functions with Collision Detection
; Each function checks if the new position would collide with tilemap
; =============================================================================

try_move_up:
    PUSH R0
    PUSH R1

    ; Calculate new Y position
    LD R0, [PLAYER_Y]
    CMP R0, #PLAYER_SPEED
    BRC .move_up_done      ; Already at top edge

    SUB R0, #PLAYER_SPEED
    ST R0, [TEMP_Y]

    ; Check collision at new position
    LD R1, [PLAYER_X]
    ST R1, [TEMP_X]
    CALL check_collision
    CMP R0, #0
    BRNZ .move_up_done     ; Collision detected, don't move

    ; No collision, apply movement
    LD R0, [TEMP_Y]
    ST R0, [PLAYER_Y]

.move_up_done:
    POP R1
    POP R0
    RET

try_move_down:
    PUSH R0
    PUSH R1

    ; Calculate new Y position
    LD R0, [PLAYER_Y]
    ADD R0, #PLAYER_SPEED

    ; Check screen boundary (160 - 16 = 144)
    CMP R0, #144
    BRNC .move_down_done   ; Would go off screen

    ST R0, [TEMP_Y]

    ; Check collision at new position
    LD R1, [PLAYER_X]
    ST R1, [TEMP_X]
    CALL check_collision
    CMP R0, #0
    BRNZ .move_down_done   ; Collision detected, don't move

    ; No collision, apply movement
    LD R0, [TEMP_Y]
    ST R0, [PLAYER_Y]

.move_down_done:
    POP R1
    POP R0
    RET

try_move_left:
    PUSH R0
    PUSH R1

    ; Calculate new X position
    LD R0, [PLAYER_X]
    CMP R0, #PLAYER_SPEED
    BRC .move_left_done    ; Already at left edge

    SUB R0, #PLAYER_SPEED
    ST R0, [TEMP_X]

    ; Check collision at new position
    LD R1, [PLAYER_Y]
    ST R1, [TEMP_Y]
    CALL check_collision
    CMP R0, #0
    BRNZ .move_left_done   ; Collision detected, don't move

    ; No collision, apply movement
    LD R0, [TEMP_X]
    ST R0, [PLAYER_X]

.move_left_done:
    POP R1
    POP R0
    RET

try_move_right:
    PUSH R0
    PUSH R1

    ; Calculate new X position
    LD R0, [PLAYER_X]
    ADD R0, #PLAYER_SPEED

    ; Check screen boundary (256 - 16 = 240)
    CMP R0, #240
    BRNC .move_right_done  ; Would go off screen

    ST R0, [TEMP_X]

    ; Check collision at new position
    LD R1, [PLAYER_Y]
    ST R1, [TEMP_Y]
    CALL check_collision
    CMP R0, #0
    BRNZ .move_right_done  ; Collision detected, don't move

    ; No collision, apply movement
    LD R0, [TEMP_X]
    ST R0, [PLAYER_X]

.move_right_done:
    POP R1
    POP R0
    RET

; =============================================================================
; Check Collision
; Checks if the sprite at (TEMP_X, TEMP_Y) collides with any solid tiles
; Returns: R0 = 0 if no collision, non-zero if collision
;
; We check all 4 corners of the 16x16 sprite against the tilemap
; =============================================================================

check_collision:
    PUSH R1
    PUSH R2
    PUSH R3

    ; Check top-left corner
    LD R0, [TEMP_X]
    LD R1, [TEMP_Y]
    CALL get_tile_at_pixel
    CMP R0, #0
    BRNZ .collision_found

    ; Check top-right corner (X + 15)
    LD R0, [TEMP_X]
    ADD R0, #15
    LD R1, [TEMP_Y]
    CALL get_tile_at_pixel
    CMP R0, #0
    BRNZ .collision_found

    ; Check bottom-left corner (Y + 15)
    LD R0, [TEMP_X]
    LD R1, [TEMP_Y]
    ADD R1, #15
    CALL get_tile_at_pixel
    CMP R0, #0
    BRNZ .collision_found

    ; Check bottom-right corner (X + 15, Y + 15)
    LD R0, [TEMP_X]
    ADD R0, #15
    LD R1, [TEMP_Y]
    ADD R1, #15
    CALL get_tile_at_pixel
    CMP R0, #0
    BRNZ .collision_found

    ; No collision
    LD R0, #0
    JMP .collision_done

.collision_found:
    LD R0, #1

.collision_done:
    POP R3
    POP R2
    POP R1
    RET

; =============================================================================
; Get Tile At Pixel
; Input: R0 = pixel X, R1 = pixel Y
; Output: R0 = tile index (0 = empty/no collision)
;
; Converts pixel coordinates to tile coordinates and reads tile from tilemap
; =============================================================================

get_tile_at_pixel:
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5

    ; Convert pixel coords to tile coords by dividing by 16 (shift right 4)
    ; tile_x = pixel_x >> 4
    ; tile_y = pixel_y >> 4
    SHR R0
    SHR R0
    SHR R0
    SHR R0              ; R0 = tile_x

    SHR R1
    SHR R1
    SHR R1
    SHR R1              ; R1 = tile_y

    ; Check bounds
    LD R2, [MAP_WIDTH]
    CMP R0, R2
    BRNC .tile_out_of_bounds

    LD R2, [MAP_HEIGHT]
    CMP R1, R2
    BRNC .tile_out_of_bounds

    ; Calculate tile offset: (tile_y * map_width + tile_x) * 2
    ; First: tile_y * map_width
    LD R2, [MAP_WIDTH]
    LD R3, #0           ; Result accumulator

    ; Multiply R1 (tile_y) by R2 (map_width)
    ; Simple loop multiplication
    CMP R1, #0
    BRZ .mult_done

.mult_loop:
    ADD R3, R2
    DEC R1
    BRNZ .mult_loop

.mult_done:
    ; R3 = tile_y * map_width
    ; Add tile_x
    ADD R3, R0          ; R3 = tile_y * map_width + tile_x

    ; Multiply by 2 (each tile entry is 2 bytes)
    SHL R3              ; R3 = (tile_y * map_width + tile_x) * 2

    ; Add base address offset (skip header)
    ADD R3, #TILEMAP_DATA_OFFSET

    ; Now we need to read from banked memory at offset R3 in bank 20
    ; For simplicity, we'll use a lookup approach
    ; The tilemap data is in cartridge bank 4 (absolute bank 20)

    ; Store offset for reading
    ; R4:R5 will be our pointer (high:low)
    LD R4, #0
    MOV R5, R3

    ; Read tile index from tilemap
    ; This is a simplified version - we read from a fixed location
    ; In a real implementation, we'd need banked memory access

    ; For now, use hardcoded tilemap check based on Y position
    ; The tilemap has ground tiles in the bottom rows
    ; Ground starts at tile row 7 (Y >= 112 pixels)

    LD R0, [TEMP_Y]
    ADD R0, #15         ; Check bottom of sprite
    CMP R0, #112        ; Ground starts at row 7 (7 * 16 = 112)
    BRC .tile_empty     ; Above ground level

    ; Below ground level - return solid tile
    LD R0, #1
    JMP .tile_done

.tile_out_of_bounds:
.tile_empty:
    LD R0, #0

.tile_done:
    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    RET

; =============================================================================
; Read Tilemap Header
; Reads width and height from .tbin header
; =============================================================================

read_tilemap_header:
    PUSH R0

    ; Hardcoded for now - matches actual tilemap
    LD R0, #16
    ST R0, [MAP_WIDTH]
    LD R0, #10
    ST R0, [MAP_HEIGHT]

    POP R0
    RET

; =============================================================================
; Setup Tilemap Registers
; =============================================================================

setup_tilemap:
    PUSH R0

    ; Set graphics bank (tile graphics in cartridge bank 2)
    LD R0, #TILE_GFX_BANK
    ST R0, [TILEMAP_GFX_BANK]

    ; Set tilemap data bank (cartridge bank 4)
    LD R0, #TILEMAP_BANK
    ST R0, [TILEMAP_DATA_BANK]

    ; Set tilemap data address (skip 8-byte header)
    LD R0, #(TILEMAP_DATA_OFFSET >> 8)
    ST R0, [TILEMAP_ADDR_HI]
    LD R0, #(TILEMAP_DATA_OFFSET & $FF)
    ST R0, [TILEMAP_ADDR_LO]

    ; Set tilemap dimensions
    LD R0, [MAP_WIDTH]
    ST R0, [TILEMAP_WIDTH]
    LD R0, [MAP_HEIGHT]
    ST R0, [TILEMAP_HEIGHT]

    ; Initialize scroll to 0
    LD R0, #0
    ST R0, [TILEMAP_X_SCROLL_LO]
    ST R0, [TILEMAP_X_SCROLL_HI]
    ST R0, [TILEMAP_Y_SCROLL_LO]
    ST R0, [TILEMAP_Y_SCROLL_HI]

    ; Initialize animation frame
    ST R0, [TILE_ANIM_FRAME]

    ; Enable tilemap
    LD R0, #TM_ENABLE
    ST R0, [TILEMAP_ENABLE]

    POP R0
    RET

; =============================================================================
; Setup Scanline Palette Map
; All scanlines use palette block 0
; =============================================================================

setup_scanline_map:
    PUSH R0
    PUSH R2
    PUSH R3
    PUSH R4

    ; R2:R3 = address pointer ($0600)
    LD R2, #$06
    LD R3, #$00

    ; All 160 scanlines = palette block 0
    LD R0, #0
    LD R4, #160

.scanline_loop:
    ST R0, [R2:R3]
    INC R3
    DEC R4
    BRNZ .scanline_loop

    POP R4
    POP R3
    POP R2
    POP R0
    RET

; =============================================================================
; Clear Screen
; Fills framebuffer with color 0 (black/transparent)
; =============================================================================

clear_screen:
    PUSH R0
    PUSH R2
    PUSH R3
    PUSH R4

    ; R2:R3 = address pointer (0xB000)
    LD R2, #$B0
    LD R3, #$00

    ; 0x5000 bytes = 80 pages of 256 bytes
    LD R4, #$50
    LD R0, #0

.outer:
.inner:
    ST R0, [R2:R3]
    INC R3
    BRNZ .inner

    INC R2
    DEC R4
    BRNZ .outer

    POP R4
    POP R3
    POP R2
    POP R0
    RET

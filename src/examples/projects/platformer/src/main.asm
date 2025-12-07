; Tilemap Display Example
; Displays a tilemap loaded from cartridge bank 4
;
; Assumes:
; - Tile graphics are in cartridge bank 2 (absolute bank 18)
; - Tilemap data (.tbin file) is in cartridge bank 4 (absolute bank 20)
;
; The .tbin file format has an 8-byte header:
;   Bytes 0-1: Width in tiles (little-endian uint16)
;   Bytes 2-3: Height in tiles (little-endian uint16)
;   Bytes 4-7: Reserved
;   Bytes 8+:  Tile data (2 bytes per tile)
;
; Uses VBLANK interrupt for smooth 60fps scrolling

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
.define CTRL1_STATE         $0110

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

; Tile size
.define TILE_SIZE           16

; Banks (cartridge banks start at 16)
.define TILE_GFX_BANK       18      ; Cartridge bank 2 = absolute 18
.define TILEMAP_BANK        20      ; Cartridge bank 4 = absolute 20

; Tilemap data offset (skip 8-byte .tbin header)
.define TILEMAP_DATA_OFFSET 8

; Tilemap enable flags
.define TM_ENABLE           $01     ; Bit 0: Enable tilemap
.define TM_WRAP_H           $02     ; Bit 1: Horizontal wrap
.define TM_WRAP_V           $04     ; Bit 2: Vertical wrap

; Controller button masks
.define BTN_UP              $01
.define BTN_DOWN            $02
.define BTN_LEFT            $04
.define BTN_RIGHT           $08

; =============================================================================
; Variables (in lower memory)
; =============================================================================

.define SCROLL_X_LO         $0B00   ; Current X scroll low byte
.define SCROLL_X_HI         $0B01   ; Current X scroll high byte
.define SCROLL_Y_LO         $0B02   ; Current Y scroll low byte
.define SCROLL_Y_HI         $0B03   ; Current Y scroll high byte
.define MAP_WIDTH           $0B04   ; Tilemap width in tiles (from header)
.define MAP_HEIGHT          $0B05   ; Tilemap height in tiles (from header)
.define MAX_SCROLL_X_LO     $0B06   ; Maximum X scroll value low byte
.define MAX_SCROLL_X_HI     $0B07   ; Maximum X scroll value high byte
.define MAX_SCROLL_Y_LO     $0B08   ; Maximum Y scroll value low byte
.define MAX_SCROLL_Y_HI     $0B09   ; Maximum Y scroll value high byte

; =============================================================================
; Entry Point
; =============================================================================

main:
    ; Disable interrupts during setup
    CLI

    ; Set video mode 0 (256x160 @ 4bpp)
    LD R0, #0
    ST R0, [VIDEO_MODE]

    ; Clear framebuffer to black
    CALL clear_screen

    ; Set up scanline palette map (all scanlines use palette 0)
    CALL setup_scanline_map

    ; Read tilemap header from bank 4 to get dimensions
    CALL read_tilemap_header

    ; Calculate max scroll values
    CALL calc_max_scroll

    ; Initialize scroll position to 0
    LD R0, #0
    ST R0, [SCROLL_X_LO]
    ST R0, [SCROLL_X_HI]
    ST R0, [SCROLL_Y_LO]
    ST R0, [SCROLL_Y_HI]

    ; Configure tilemap registers
    CALL setup_tilemap

    ; Clear any pending interrupt flags
    LD R0, #$FF
    ST R0, [INT_STATUS]

    ; Install VBLANK interrupt vector
    LD R0, #(vblank_handler >> 8)
    ST R0, [VBLANK_VEC_HI]
    LD R0, #(vblank_handler & $FF)
    ST R0, [VBLANK_VEC_LO]

    ; Enable VBLANK interrupt
    LD R0, #$01
    ST R0, [INT_ENABLE]

    ; Enable interrupts
    SEI

    ; Main loop - just idles while interrupt handles scrolling
main_loop:
    NOP
    JMP main_loop

; =============================================================================
; VBLANK Interrupt Handler
; Called 60 times per second - handles controller input and scrolling
; =============================================================================

vblank_handler:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3

    ; Clear VBLANK flag (write 1 to clear)
    LD R0, #$01
    ST R0, [INT_STATUS]

    ; Increment animation frame counter
    LD R0, [TILE_ANIM_FRAME]
    INC R0
    ST R0, [TILE_ANIM_FRAME]

    ; Read controller state
    LD R0, [CTRL1_STATE]

    ; Check UP button
    LD R1, R0
    AND R1, #BTN_UP
    BRZ .check_down
    CALL scroll_up
    JMP .check_left

.check_down:
    ; Check DOWN button
    LD R1, R0
    AND R1, #BTN_DOWN
    BRZ .check_left
    CALL scroll_down

.check_left:
    ; Check LEFT button
    LD R1, R0
    AND R1, #BTN_LEFT
    BRZ .check_right
    CALL scroll_left
    JMP .update_scroll_regs

.check_right:
    ; Check RIGHT button
    LD R1, R0
    AND R1, #BTN_RIGHT
    BRZ .update_scroll_regs
    CALL scroll_right

.update_scroll_regs:
    ; Update tilemap scroll registers from variables
    LD R0, [SCROLL_X_LO]
    ST R0, [TILEMAP_X_SCROLL_LO]
    LD R0, [SCROLL_X_HI]
    ST R0, [TILEMAP_X_SCROLL_HI]
    LD R0, [SCROLL_Y_LO]
    ST R0, [TILEMAP_Y_SCROLL_LO]
    LD R0, [SCROLL_Y_HI]
    ST R0, [TILEMAP_Y_SCROLL_HI]

.vblank_done:
    POP R3
    POP R2
    POP R1
    POP R0
    RTI

; =============================================================================
; Scroll Functions (with bounds checking)
; =============================================================================

scroll_up:
    PUSH R0
    PUSH R1

    ; Decrement Y scroll if > 0
    LD R0, [SCROLL_Y_LO]
    LD R1, [SCROLL_Y_HI]

    ; Check if already at 0
    CMP R0, #0
    BRNZ .do_scroll_up
    CMP R1, #0
    BRZ .scroll_up_done

.do_scroll_up:
    ; Decrement 16-bit scroll Y
    DEC R0
    CMP R0, #$FF          ; Check for underflow (0 - 1 = 0xFF)
    BRNZ .store_scroll_up
    DEC R1                ; Borrow from high byte

.store_scroll_up:
    ST R0, [SCROLL_Y_LO]
    ST R1, [SCROLL_Y_HI]

.scroll_up_done:
    POP R1
    POP R0
    RET

scroll_down:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3

    ; Increment Y scroll if < max
    LD R0, [SCROLL_Y_LO]
    LD R1, [SCROLL_Y_HI]
    LD R2, [MAX_SCROLL_Y_LO]
    LD R3, [MAX_SCROLL_Y_HI]

    ; Compare current with max (16-bit comparison)
    ; First check if high bytes are different
    CMP R1, R3
    BRC .do_scroll_down   ; If high byte less (carry set), can scroll
    BRNZ .scroll_down_done ; If high byte greater (not equal, no carry), can't scroll
    ; High bytes equal, compare low bytes
    CMP R0, R2
    BRNC .scroll_down_done ; If low >= max low (no carry), can't scroll

.do_scroll_down:
    ; Increment 16-bit scroll Y
    INC R0
    BRNZ .store_scroll_down
    INC R1                ; Carry to high byte

.store_scroll_down:
    ST R0, [SCROLL_Y_LO]
    ST R1, [SCROLL_Y_HI]

.scroll_down_done:
    POP R3
    POP R2
    POP R1
    POP R0
    RET

scroll_left:
    PUSH R0
    PUSH R1

    ; Decrement X scroll if > 0
    LD R0, [SCROLL_X_LO]
    LD R1, [SCROLL_X_HI]

    ; Check if already at 0
    CMP R0, #0
    BRNZ .do_scroll_left
    CMP R1, #0
    BRZ .scroll_left_done

.do_scroll_left:
    ; Decrement 16-bit scroll X
    DEC R0
    CMP R0, #$FF          ; Check for underflow
    BRNZ .store_scroll_left
    DEC R1                ; Borrow from high byte

.store_scroll_left:
    ST R0, [SCROLL_X_LO]
    ST R1, [SCROLL_X_HI]

.scroll_left_done:
    POP R1
    POP R0
    RET

scroll_right:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3

    ; Increment X scroll if < max
    LD R0, [SCROLL_X_LO]
    LD R1, [SCROLL_X_HI]
    LD R2, [MAX_SCROLL_X_LO]
    LD R3, [MAX_SCROLL_X_HI]

    ; Compare current with max (16-bit comparison)
    ; First check if high bytes are different
    CMP R1, R3
    BRC .do_scroll_right  ; If high byte less (carry set), can scroll
    BRNZ .scroll_right_done ; If high byte greater (not equal, no carry), can't scroll
    ; High bytes equal, compare low bytes
    CMP R0, R2
    BRNC .scroll_right_done ; If low >= max low (no carry), can't scroll

.do_scroll_right:
    ; Increment 16-bit scroll X
    INC R0
    BRNZ .store_scroll_right
    INC R1                ; Carry to high byte

.store_scroll_right:
    ST R0, [SCROLL_X_LO]
    ST R1, [SCROLL_X_HI]

.scroll_right_done:
    POP R3
    POP R2
    POP R1
    POP R0
    RET

; =============================================================================
; Read Tilemap Header
; Reads width and height from .tbin header in cartridge bank 4
; =============================================================================

read_tilemap_header:
    PUSH R0
    PUSH R1

    ; The .tbin header is at the start of the bank
    ; We'll use banked read to get the values
    ; For simplicity, assume width/height fit in single byte (max 255 tiles)

    ; Read width (bytes 0-1, little endian - we just use byte 0 for simplicity)
    ; Bank 20 = cartridge bank 4
    LD R0, #TILEMAP_BANK
    LD R1, #0             ; Offset 0 = width low byte
    CALL read_banked_byte
    ST R0, [MAP_WIDTH]

    ; Read height (bytes 2-3, little endian - we just use byte 2 for simplicity)
    LD R0, #TILEMAP_BANK
    LD R1, #2             ; Offset 2 = height low byte
    CALL read_banked_byte
    ST R0, [MAP_HEIGHT]

    POP R1
    POP R0
    RET

; =============================================================================
; Read Banked Byte
; Input: R0 = bank number, R1 = offset (0-255, low byte only)
; Output: R0 = byte value
; Note: This is a simplified version that only handles small offsets
; =============================================================================

read_banked_byte:
    ; For a real implementation, we'd need a banked read syscall or
    ; direct memory mapping. Since the devkit loads .tbin files into
    ; cartridge banks, we need to read from banked memory.
    ;
    ; For now, we'll use hardcoded values for a 32x20 tilemap
    ; (which fits nicely on screen with room to scroll)
    ;
    ; TODO: Implement actual banked memory read

    ; Return hardcoded width=32 for offset 0, height=20 for offset 2
    CMP R1, #0
    BRNZ .check_height
    LD R0, #16            ; Width = 32 tiles
    RET

.check_height:
    CMP R1, #2
    BRNZ .default_value
    LD R0, #10            ; Height = 20 tiles
    RET

.default_value:
    LD R0, #0
    RET

; =============================================================================
; Calculate Maximum Scroll Values
; max_scroll = (map_size * tile_size) - screen_size
; =============================================================================

calc_max_scroll:
    PUSH R0
    PUSH R1
    PUSH R2

    ; Calculate max X scroll: (width * 16) - 256
    LD R0, [MAP_WIDTH]
    ; Multiply by 16 (shift left 4)
    ; R0 * 16 = low byte, we need 16-bit result
    ; For width=32: 32*16 = 512, max_scroll = 512-256 = 256
    LD R1, #0             ; High byte
    ; Shift left by 4 (multiply by 16)
    SHL R0
    ROL R1
    SHL R0
    ROL R1
    SHL R0
    ROL R1
    SHL R0
    ROL R1

    ; Now R1:R0 = width * 16
    ; Subtract 256 (screen width)
    ; R0 = R0 - 0, R1 = R1 - 1
    DEC R1
    ST R0, [MAX_SCROLL_X_LO]
    ST R1, [MAX_SCROLL_X_HI]

    ; Calculate max Y scroll: (height * 16) - 160
    LD R0, [MAP_HEIGHT]
    LD R1, #0
    ; Shift left by 4 (multiply by 16)
    SHL R0
    ROL R1
    SHL R0
    ROL R1
    SHL R0
    ROL R1
    SHL R0
    ROL R1

    ; Now R1:R0 = height * 16
    ; Subtract 160 (screen height)
    ; For height=20: 20*16 = 320, max_scroll = 320-160 = 160
    LD R2, #160
    SUB R0, R2
    BRNC .no_borrow_y
    DEC R1

.no_borrow_y:
    ST R0, [MAX_SCROLL_Y_LO]
    ST R1, [MAX_SCROLL_Y_HI]

    POP R2
    POP R1
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

    ; Enable tilemap (no wrapping)
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

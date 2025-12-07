; Simple Sprite Example
; Displays sprite index 0 from cartridge bank 2 bouncing up and down
;
; Assumes sprite graphics are already present in cartridge bank 2
; (absolute bank 18, since cartridge banks start at 16)
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

; Sprite 0 attribute addresses
.define SPRITE_0_X          $0700
.define SPRITE_0_Y          $0701
.define SPRITE_0_IDX        $0702
.define SPRITE_0_FLAGS      $0703
.define SPRITE_0_BANK       $0704

; Scanline palette map
.define SCANLINE_MAP        $0600

; =============================================================================
; Constants
; =============================================================================

; Screen dimensions
.define SCREEN_WIDTH        256
.define SCREEN_HEIGHT       160
.define SPRITE_SIZE         16

; X position (centered horizontally)
.define SPRITE_X            120         ; (256 - 16) / 2

; Y bounds (sprite can move from 0 to 144)
.define MIN_Y               0
.define MAX_Y               144         ; 160 - 16

; Cartridge bank 2 = absolute bank 18
.define SPRITE_BANK         18

; Framebuffer
.define FRAMEBUFFER_START   $B000

; =============================================================================
; Variables (in lower memory)
; =============================================================================

.define SPRITE_Y_POS        $0B00       ; Current Y position
.define SPRITE_DIRECTION    $0B01       ; 0 = moving down, 1 = moving up
.define FRAME_COUNTER       $0B02       ; Frame counter for slowing movement

; =============================================================================
; Entry Point
; =============================================================================

main:
    ; Disable interrupts during setup
    CLI

    ; Set video mode 0
    LD R0, #0
    ST R0, [VIDEO_MODE]

    ; Clear framebuffer to black
    CALL clear_screen

    ; Set up scanline palette map
    CALL setup_scanline_map

    ; Initialize sprite position, direction, and frame counter
    LD R0, #MIN_Y
    ST R0, [SPRITE_Y_POS]
    LD R0, #0                   ; Start moving down
    ST R0, [SPRITE_DIRECTION]
    ST R0, [FRAME_COUNTER]      ; Initialize frame counter to 0

    ; Enable sprites
    LD R0, #1
    ST R0, [SPRITE_ENABLE]

    ; Set sprite count to 1
    LD R0, #1
    ST R0, [SPRITE_COUNT]

    ; Configure sprite 0
    LD R0, #SPRITE_X
    ST R0, [SPRITE_0_X]

    LD R0, #MIN_Y
    ST R0, [SPRITE_0_Y]

    LD R0, #0                   ; Sprite index 0
    ST R0, [SPRITE_0_IDX]

    LD R0, #$00                 ; No flip, front priority, palette 0
    ST R0, [SPRITE_0_FLAGS]

    LD R0, #SPRITE_BANK         ; Cartridge bank 2
    ST R0, [SPRITE_0_BANK]

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

    ; Main loop - just idles while interrupt handles movement
main_loop:
    NOP
    JMP main_loop

; =============================================================================
; VBLANK Interrupt Handler
; Called 60 times per second - handles sprite movement
; =============================================================================

vblank_handler:
    PUSH R0
    PUSH R1

    ; Clear VBLANK flag (write 1 to clear)
    LD R0, #$01
    ST R0, [INT_STATUS]

    ; Only move every 2nd frame (half speed)
    LD R0, [FRAME_COUNTER]
    INC R0
    AND R0, #1              ; Keep only bit 0 (0 or 1)
    ST R0, [FRAME_COUNTER]
    BRNZ .done              ; Skip movement on odd frames

    ; Load current Y position
    LD R0, [SPRITE_Y_POS]

    ; Check direction
    LD R1, [SPRITE_DIRECTION]
    CMP R1, #0
    BRNZ .moving_up

.moving_down:
    ; Moving down - increment Y
    INC R0

    ; Check if we hit bottom
    CMP R0, #MAX_Y
    BRNZ .update_position

    ; Hit bottom - reverse direction
    LD R1, #1
    ST R1, [SPRITE_DIRECTION]
    JMP .update_position

.moving_up:
    ; Moving up - decrement Y
    DEC R0

    ; Check if we hit top
    CMP R0, #MIN_Y
    BRNZ .update_position

    ; Hit top - reverse direction
    LD R1, #0
    ST R1, [SPRITE_DIRECTION]

.update_position:
    ; Store new Y position
    ST R0, [SPRITE_Y_POS]

    ; Update sprite Y attribute
    ST R0, [SPRITE_0_Y]

.done:
    POP R1
    POP R0
    RTI

; =============================================================================
; Subroutine: Setup Scanline Palette Map
; First 80 rows use palette block 0, second 80 rows use palette block 3
; =============================================================================

setup_scanline_map:
    PUSH R0
    PUSH R2
    PUSH R3
    PUSH R4

    ; R2:R3 = address pointer ($0600)
    LD R2, #$06
    LD R3, #$00

    ; First 80 scanlines = palette block 0
    LD R0, #0
    LD R4, #80
.first_half:
    ST R0, [R2:R3]
    INC R3
    DEC R4
    BRNZ .first_half

    ; Second 80 scanlines = palette block 3
    LD R0, #3
    LD R4, #80
.second_half:
    ST R0, [R2:R3]
    INC R3
    DEC R4
    BRNZ .second_half

    POP R4
    POP R3
    POP R2
    POP R0
    RET

; =============================================================================
; Subroutine: Clear Screen
; Fills framebuffer with color 0 (black)
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

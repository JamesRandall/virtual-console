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

; Sprite 1 attribute addresses
.define SPRITE_1_X          $0705
.define SPRITE_1_Y          $0706
.define SPRITE_1_IDX        $0707
.define SPRITE_1_FLAGS      $0708
.define SPRITE_1_BANK       $0709

; Sprite 2 attribute addresses
.define SPRITE_2_X          $070A
.define SPRITE_2_Y          $070B
.define SPRITE_2_IDX        $070C
.define SPRITE_2_FLAGS      $070D
.define SPRITE_2_BANK       $070E

; Sprite 3 attribute addresses
.define SPRITE_3_X          $070F
.define SPRITE_3_Y          $0710
.define SPRITE_3_IDX        $0711
.define SPRITE_3_FLAGS      $0712
.define SPRITE_3_BANK       $0713

; Scanline palette map
.define SCANLINE_MAP        $0600

; =============================================================================
; Constants
; =============================================================================

; Screen dimensions
.define SCREEN_WIDTH        256
.define SCREEN_HEIGHT       160
.define SPRITE_SIZE         16

; Sprite 0: X position (centered horizontally)
.define SPRITE_0_X_POS      120         ; (256 - 16) / 2

; Sprite 0: Y bounds (sprite can move from 0 to 144)
.define MIN_Y               0
.define MAX_Y               144         ; 160 - 16

; Sprite 1: Y position (centered vertically)
.define SPRITE_1_Y_POS      72          ; (160 - 16) / 2

; Sprite 1: X bounds (sprite can move from 0 to 240)
.define MIN_X               0
.define MAX_X               240         ; 256 - 16

; Cartridge bank 2 = absolute bank 18
.define SPRITE_BANK         18

; Framebuffer
.define FRAMEBUFFER_START   $B000

; =============================================================================
; Variables (in lower memory)
; =============================================================================

.define SPRITE0_Y_VAR       $0B00       ; Sprite 0 current Y position
.define SPRITE0_DIR         $0B01       ; Sprite 0 direction: 0 = down, 1 = up
.define SPRITE1_X_VAR       $0B02       ; Sprite 1 current X position
.define SPRITE1_DIR         $0B03       ; Sprite 1 direction: 0 = right, 1 = left
.define SPRITE2_X_VAR       $0B04       ; Sprite 2 current X position
.define SPRITE2_Y_VAR       $0B05       ; Sprite 2 current Y position
.define SPRITE2_DIR         $0B06       ; Sprite 2 direction: 0 = down-right, 1 = up-left
.define SPRITE3_X_VAR       $0B07       ; Sprite 3 current X position
.define SPRITE3_Y_VAR       $0B08       ; Sprite 3 current Y position
.define SPRITE3_DIR         $0B09       ; Sprite 3 direction: 0 = up-right, 1 = down-left

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

    ; Initialize sprite 0 position and direction (vertical movement)
    LD R0, #MIN_Y
    ST R0, [SPRITE0_Y_VAR]
    LD R0, #0                   ; Start moving down
    ST R0, [SPRITE0_DIR]

    ; Initialize sprite 1 position and direction (horizontal movement)
    LD R0, #MIN_X
    ST R0, [SPRITE1_X_VAR]
    LD R0, #0                   ; Start moving right
    ST R0, [SPRITE1_DIR]

    ; Enable sprites
    LD R0, #1
    ST R0, [SPRITE_ENABLE]

    ; Set sprite count to 4
    LD R0, #4
    ST R0, [SPRITE_COUNT]

    ; Configure sprite 0 (moves vertically)
    LD R0, #SPRITE_0_X_POS
    ST R0, [SPRITE_0_X]

    LD R0, #MIN_Y
    ST R0, [SPRITE_0_Y]

    LD R0, #0                   ; Sprite index 0
    ST R0, [SPRITE_0_IDX]

    LD R0, #$00                 ; No flip, front priority, palette 0
    ST R0, [SPRITE_0_FLAGS]

    LD R0, #SPRITE_BANK         ; Cartridge bank 2
    ST R0, [SPRITE_0_BANK]

    ; Configure sprite 1 (moves horizontally)
    LD R0, #MIN_X
    ST R0, [SPRITE_1_X]

    LD R0, #SPRITE_1_Y_POS
    ST R0, [SPRITE_1_Y]

    LD R0, #0                   ; Sprite index 0 (same sprite)
    ST R0, [SPRITE_1_IDX]

    LD R0, #$00                 ; No flip, front priority, palette 0
    ST R0, [SPRITE_1_FLAGS]

    LD R0, #SPRITE_BANK         ; Cartridge bank 2
    ST R0, [SPRITE_1_BANK]

    ; Initialize sprite 2 (diagonal: top-left to bottom-right)
    LD R0, #MIN_X
    ST R0, [SPRITE2_X_VAR]
    LD R0, #MIN_Y
    ST R0, [SPRITE2_Y_VAR]
    LD R0, #0                   ; Start moving down-right
    ST R0, [SPRITE2_DIR]

    ; Configure sprite 2
    LD R0, #MIN_X
    ST R0, [SPRITE_2_X]

    LD R0, #MIN_Y
    ST R0, [SPRITE_2_Y]

    LD R0, #0                   ; Sprite index 0
    ST R0, [SPRITE_2_IDX]

    LD R0, #$00
    ST R0, [SPRITE_2_FLAGS]

    LD R0, #SPRITE_BANK
    ST R0, [SPRITE_2_BANK]

    ; Initialize sprite 3 (diagonal: bottom-left to top-right)
    LD R0, #MIN_X
    ST R0, [SPRITE3_X_VAR]
    LD R0, #MAX_Y
    ST R0, [SPRITE3_Y_VAR]
    LD R0, #0                   ; Start moving up-right
    ST R0, [SPRITE3_DIR]

    ; Configure sprite 3
    LD R0, #MIN_X
    ST R0, [SPRITE_3_X]

    LD R0, #MAX_Y
    ST R0, [SPRITE_3_Y]

    LD R0, #0                   ; Sprite index 0
    ST R0, [SPRITE_3_IDX]

    LD R0, #$00
    ST R0, [SPRITE_3_FLAGS]

    LD R0, #SPRITE_BANK
    ST R0, [SPRITE_3_BANK]

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

    ; === Update Sprite 0 (vertical movement) ===
    LD R0, [SPRITE0_Y_VAR]
    LD R1, [SPRITE0_DIR]
    CMP R1, #0
    BRNZ .sprite0_up

.sprite0_down:
    INC R0
    CMP R0, #MAX_Y
    BRNZ .sprite0_update
    LD R1, #1
    ST R1, [SPRITE0_DIR]
    JMP .sprite0_update

.sprite0_up:
    DEC R0
    CMP R0, #MIN_Y
    BRNZ .sprite0_update
    LD R1, #0
    ST R1, [SPRITE0_DIR]

.sprite0_update:
    ST R0, [SPRITE0_Y_VAR]
    ST R0, [SPRITE_0_Y]

    ; === Update Sprite 1 (horizontal movement) ===
    LD R0, [SPRITE1_X_VAR]
    LD R1, [SPRITE1_DIR]
    CMP R1, #0
    BRNZ .sprite1_left

.sprite1_right:
    INC R0
    CMP R0, #MAX_X
    BRNZ .sprite1_update
    LD R1, #1
    ST R1, [SPRITE1_DIR]
    JMP .sprite1_update

.sprite1_left:
    DEC R0
    CMP R0, #MIN_X
    BRNZ .sprite1_update
    LD R1, #0
    ST R1, [SPRITE1_DIR]

.sprite1_update:
    ST R0, [SPRITE1_X_VAR]
    ST R0, [SPRITE_1_X]

    ; === Update Sprite 2 (diagonal: top-left to bottom-right) ===
    LD R0, [SPRITE2_DIR]
    CMP R0, #0
    BRNZ .sprite2_upleft

.sprite2_downright:
    ; Moving down-right
    LD R0, [SPRITE2_X_VAR]
    INC R0
    ST R0, [SPRITE2_X_VAR]
    ST R0, [SPRITE_2_X]
    CMP R0, #MAX_X
    BRZ .sprite2_reverse

    LD R0, [SPRITE2_Y_VAR]
    INC R0
    ST R0, [SPRITE2_Y_VAR]
    ST R0, [SPRITE_2_Y]
    CMP R0, #MAX_Y
    BRNZ .sprite3_start
    JMP .sprite2_reverse

.sprite2_upleft:
    ; Moving up-left
    LD R0, [SPRITE2_X_VAR]
    DEC R0
    ST R0, [SPRITE2_X_VAR]
    ST R0, [SPRITE_2_X]
    CMP R0, #MIN_X
    BRZ .sprite2_reverse

    LD R0, [SPRITE2_Y_VAR]
    DEC R0
    ST R0, [SPRITE2_Y_VAR]
    ST R0, [SPRITE_2_Y]
    CMP R0, #MIN_Y
    BRNZ .sprite3_start

.sprite2_reverse:
    LD R0, [SPRITE2_DIR]
    XOR R0, #1
    ST R0, [SPRITE2_DIR]

.sprite3_start:
    ; === Update Sprite 3 (diagonal: bottom-left to top-right) ===
    LD R0, [SPRITE3_DIR]
    CMP R0, #0
    BRNZ .sprite3_downleft

.sprite3_upright:
    ; Moving up-right
    LD R0, [SPRITE3_X_VAR]
    INC R0
    ST R0, [SPRITE3_X_VAR]
    ST R0, [SPRITE_3_X]
    CMP R0, #MAX_X
    BRZ .sprite3_reverse

    LD R0, [SPRITE3_Y_VAR]
    DEC R0
    ST R0, [SPRITE3_Y_VAR]
    ST R0, [SPRITE_3_Y]
    CMP R0, #MIN_Y
    BRNZ .vblank_done
    JMP .sprite3_reverse

.sprite3_downleft:
    ; Moving down-left
    LD R0, [SPRITE3_X_VAR]
    DEC R0
    ST R0, [SPRITE3_X_VAR]
    ST R0, [SPRITE_3_X]
    CMP R0, #MIN_X
    BRZ .sprite3_reverse

    LD R0, [SPRITE3_Y_VAR]
    INC R0
    ST R0, [SPRITE3_Y_VAR]
    ST R0, [SPRITE_3_Y]
    CMP R0, #MAX_Y
    BRNZ .vblank_done

.sprite3_reverse:
    LD R0, [SPRITE3_DIR]
    XOR R0, #1
    ST R0, [SPRITE3_DIR]

.vblank_done:
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

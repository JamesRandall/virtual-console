; Simple Sprite Example
; Displays sprite index 0 from cartridge bank 2 at the center of the screen
;
; Assumes sprite graphics are already present in cartridge bank 2
; (absolute bank 18, since cartridge banks start at 16)

.org $0B80

; =============================================================================
; Hardware Register Constants
; =============================================================================

.define VIDEO_MODE          $0101

; Sprite control registers
.define SPRITE_ENABLE       $0104
.define SPRITE_COUNT        $0105

; Sprite 0 attribute addresses
.define SPRITE_0_X          $0700
.define SPRITE_0_Y          $0701
.define SPRITE_0_IDX        $0702
.define SPRITE_0_FLAGS      $0703
.define SPRITE_0_BANK       $0704

; =============================================================================
; Constants
; =============================================================================

; Center position (screen 256x160, sprite 16x16)
.define CENTER_X            120         ; (256 - 16) / 2
.define CENTER_Y            72          ; (160 - 16) / 2

; Cartridge bank 2 = absolute bank 18
.define SPRITE_BANK         18

; Framebuffer
.define FRAMEBUFFER_START   $B000

; =============================================================================
; Entry Point
; =============================================================================

main:
    ; Set video mode 0
    LD R0, #0
    ST R0, [VIDEO_MODE]

    ; Clear framebuffer to black
    CALL clear_screen

    ; Enable sprites
    LD R0, #1
    ST R0, [SPRITE_ENABLE]

    ; Set sprite count to 1
    LD R0, #1
    ST R0, [SPRITE_COUNT]

    ; Configure sprite 0
    LD R0, #CENTER_X
    ST R0, [SPRITE_0_X]

    LD R0, #CENTER_Y
    ST R0, [SPRITE_0_Y]

    LD R0, #0               ; Sprite index 0
    ST R0, [SPRITE_0_IDX]

    LD R0, #$00             ; No flip, front priority, palette 0
    ST R0, [SPRITE_0_FLAGS]

    LD R0, #SPRITE_BANK     ; Cartridge bank 2
    ST R0, [SPRITE_0_BANK]

    ; Done - loop forever
done:
    JMP done

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

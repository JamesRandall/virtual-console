; Animated Starfield (With VBLANK)
; Animates 96 stars moving right to left at different speeds
; Uses VBlank interrupt for smooth 60fps animation
; Video Mode 0: 256x160 @ 4bpp
;
; Star distribution:
;   - 32 white stars (brightest, fastest)
;   - 32 medium gray stars (medium speed)
;   - 32 dark gray stars (dimmest, slowest)

.org $0B80

; Constants
.define VIDEO_MODE $0101
.define PALETTE_RAM $0200
.define FRAMEBUFFER_START $B000
.define INT_STATUS $0114
.define INT_ENABLE $0115
.define VBLANK_VEC_HI $0132
.define VBLANK_VEC_LO $0133

; Color palette indices
.define COLOR_BLACK 0
.define COLOR_WHITE 1
.define COLOR_MED_GRAY 2
.define COLOR_DARK_GRAY 3

; Star speeds (pixels to move per frame)
.define SPEED_WHITE 3
.define SPEED_MED_GRAY 2
.define SPEED_DARK_GRAY 1

; RAM locations for dynamic star X coordinates
.define STAR_X_RAM $0900
.define FRAME_COUNTER $0960

; Entry point
main:
    ; Set up stack pointer
    LD R0, #$FF
    ST R0, [$7F]
    LD R0, #$7F
    ST R0, [$7E]

    ; Disable interrupts during setup
    CLI

    ; Set video mode to 0 (256x160 @ 4bpp)
    LD R0, #0
    ST R0, [VIDEO_MODE]

    ; Setup palette
    CALL setup_palette

    ; Copy initial star X coordinates to RAM
    CALL init_star_positions

    ; Initialize frame counter to 0
    LD R0, #0
    ST R0, [FRAME_COUNTER]

    ; Clear screen to black
    CALL clear_screen

    ; Clear any pending interrupt flags
    LD R0, #$FF
    ST R0, [INT_STATUS]

    ; Install VBlank interrupt vector
    LD R0, #(vblank_handler >> 8)
    ST R0, [VBLANK_VEC_HI]
    LD R0, #(vblank_handler & $FF)
    ST R0, [VBLANK_VEC_LO]

    ; Enable VBlank interrupt in INT_ENABLE
    LD R0, #$01
    ST R0, [INT_ENABLE]

    ; Enable interrupts in CPU
    SEI

    ; Main loop - just wait for interrupts
main_loop:
    NOP
    NOP
    NOP
    JMP main_loop

; VBlank interrupt handler
; Called automatically 60 times per second
vblank_handler:
    ; Save registers we'll use
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5

    ; Clear VBlank flag (write 1 to clear)
    LD R0, #$01
    ST R0, [INT_STATUS]

    ; Toggle frame counter (0->1 or 1->0)
    LD R0, [FRAME_COUNTER]
    XOR R0, #1
    ST R0, [FRAME_COUNTER]

    ; If frame counter is 1, skip erase/update and just draw
    CMP R0, #1
    BRZ .skip_update

    ; Step 1: Erase all stars (draw in black)
    LD R0, #0          ; Start index
    LD R1, #32         ; Count (white stars)
    LD R2, #COLOR_BLACK
    CALL draw_stars

    LD R0, #32         ; Start index
    LD R1, #32         ; Count (medium gray stars)
    LD R2, #COLOR_BLACK
    CALL draw_stars

    LD R0, #64         ; Start index
    LD R1, #32         ; Count (dark gray stars)
    LD R2, #COLOR_BLACK
    CALL draw_stars

    ; Step 2: Update star positions
    ; Update white stars (fastest)
    LD R0, #0          ; Start index
    LD R1, #32         ; Count
    LD R2, #SPEED_WHITE
    CALL update_star_positions

    ; Update medium gray stars
    LD R0, #32         ; Start index
    LD R1, #32         ; Count
    LD R2, #SPEED_MED_GRAY
    CALL update_star_positions

    ; Update dark gray stars (slowest)
    LD R0, #64         ; Start index
    LD R1, #32         ; Count
    LD R2, #SPEED_DARK_GRAY
    CALL update_star_positions

.skip_update:
    ; Step 3: Draw all stars in color
    LD R0, #0          ; Start index
    LD R1, #32         ; Count
    LD R2, #COLOR_WHITE
    CALL draw_stars

    LD R0, #32         ; Start index
    LD R1, #32         ; Count
    LD R2, #COLOR_MED_GRAY
    CALL draw_stars

    LD R0, #64         ; Start index
    LD R1, #32         ; Count
    LD R2, #COLOR_DARK_GRAY
    CALL draw_stars

    ; Restore registers
    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    POP R0

    ; Return from interrupt
    RTI

; Setup palette with grayscale colors
setup_palette:
    PUSH R0

    ; Color 0: Black
    LD R0, #253
    ST R0, [PALETTE_RAM]

    ; Color 1: White
    LD R0, #255
    ST R0, [PALETTE_RAM + 1]

    ; Color 2: Medium Gray
    LD R0, #225
    ST R0, [PALETTE_RAM + 2]

    ; Color 3: Dark Gray
    LD R0, #229
    ST R0, [PALETTE_RAM + 3]

    POP R0
    RET

; Initialize star positions by copying from ROM to RAM
init_star_positions:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4

    ; Source address: star_x_coords_init
    LD R0, #(star_x_coords_init >> 8)
    LD R1, #(star_x_coords_init & $FF)

    ; Destination address: STAR_X_RAM
    LD R2, #(STAR_X_RAM >> 8)
    LD R3, #(STAR_X_RAM & $FF)

    ; Counter: 96 bytes to copy
    LD R4, #96

.copy_loop:
    ; Load byte from source
    LD R5, [R0:R1]

    ; Store to destination
    ST R5, [R2:R3]

    ; Increment source address
    INC R1
    BRNZ .no_carry_src
    INC R0
.no_carry_src:

    ; Increment destination address
    INC R3
    BRNZ .no_carry_dst
    INC R2
.no_carry_dst:

    ; Decrement counter
    DEC R4
    BRNZ .copy_loop

    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RET

; Update star X positions (move left and wrap)
; Inputs: R0 = start index
;         R1 = count
;         R2 = speed (pixels to move)
update_star_positions:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5

    MOV R3, R0         ; R3 = current index
    MOV R4, R1         ; R4 = remaining count
    MOV R5, R2         ; R5 = speed

.loop:
    ; Check if done
    CMP R4, #0
    BRZ .done

    ; Get address of X coordinate in RAM
    LD R0, #(STAR_X_RAM >> 8)
    LD R1, #(STAR_X_RAM & $FF)
    ADD R1, R3         ; Add index
    BRC .carry
    JMP .no_carry
.carry:
    INC R0
.no_carry:

    ; Load current X position
    LD R2, [R0:R1]

    ; Subtract speed (move left)
    SUB R2, R5

    ; Check if wrapped below 0 (carry flag CLEAR means underflow/borrow)
    BRNC .wrap

    ; No wrap, store back
    ST R2, [R0:R1]
    JMP .next

.wrap:
    ; Wrapped below 0, reset to right side (255)
    LD R2, #255
    ST R2, [R0:R1]

.next:
    ; Next star
    INC R3
    DEC R4
    JMP .loop

.done:
    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RET

; Subroutine: Draw a set of stars
; Inputs: R0 = start index in star tables
;         R1 = count (number of stars to draw)
;         R2 = color
draw_stars:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5

    MOV R3, R0         ; R3 = current index
    MOV R4, R1         ; R4 = remaining count
    MOV R5, R2         ; R5 = color (save it)

.loop:
    ; Check if done
    CMP R4, #0
    BRZ .done

    ; Get X coordinate from RAM
    LD R0, #(STAR_X_RAM >> 8)
    LD R1, #(STAR_X_RAM & $FF)
    ADD R1, R3         ; Add index to low byte
    BRC .carry_x
    JMP .no_carry_x
.carry_x:
    INC R0
.no_carry_x:
    LD R0, [R0:R1]     ; Load X coordinate

    ; Get Y coordinate from ROM table
    PUSH R0            ; Save X
    LD R0, #(star_y_coords >> 8)
    LD R1, #(star_y_coords & $FF)
    ADD R1, R3         ; Add index to low byte
    BRC .carry_y
    JMP .no_carry_y
.carry_y:
    INC R0
.no_carry_y:
    LD R1, [R0:R1]     ; Load Y coordinate
    POP R0             ; Restore X

    ; Draw the pixel
    MOV R2, R5         ; Color
    CALL draw_pixel

    ; Next star
    INC R3
    DEC R4
    JMP .loop

.done:
    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RET

; Subroutine: Clear screen to color 0
clear_screen:
    PUSH R0
    PUSH R2
    PUSH R3
    PUSH R4

    LD R2, #$B0        ; High byte of framebuffer start
    LD R3, #$00        ; Low byte
    LD R4, #$50        ; 80 pages
    LD R0, #0          ; Color 0 (black)

.outer:
.inner:
    ST R0, [R2:R3]     ; Write byte at R2:R3
    INC R3             ; Increment low byte
    BRNZ .inner        ; Loop until R3 wraps to 0

    INC R2             ; Increment high byte
    DEC R4             ; Decrement page counter
    BRNZ .outer        ; Loop until all pages done

    POP R4
    POP R3
    POP R2
    POP R0
    RET

; Subroutine: Draw pixel at (X, Y) with color
; Inputs: R0 = X coordinate (0-255)
;         R1 = Y coordinate (0-159)
;         R2 = color (palette index 0-15)
draw_pixel:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5

    ; Bounds check Y
    CMP R1, #160
    BRC .exit          ; Exit if Y >= 160

    ; Calculate address: 0xB000 + (Y * 128) + (X / 2)
    LD R3, #0          ; R3 = high byte of offset
    MOV R4, R1         ; R4 = low byte (Y value)

    ; Shift R3:R4 left by 7 positions (multiply Y by 128)
    SHL R4
    ROL R3
    SHL R4
    ROL R3
    SHL R4
    ROL R3
    SHL R4
    ROL R3
    SHL R4
    ROL R3
    SHL R4
    ROL R3
    SHL R4
    ROL R3

    ; Add X/2 to the low byte
    MOV R5, R0         ; Copy X to R5
    SHR R5             ; R5 = X / 2
    ADD R4, R5         ; Add to low byte
    BRC .carry
    JMP .no_carry

.carry:
    INC R3             ; Propagate carry to high byte

.no_carry:
    ; Add framebuffer base address (0xB000) to high byte
    ADD R3, #$B0

    ; Load the current byte at this address
    LD R5, [R3:R4]

    ; Check if X is even or odd
    AND R0, #1
    BRNZ .odd_pixel

    ; Even pixel: modify high nibble
    AND R5, #$0F       ; Clear high nibble
    SHL R2, #4         ; Shift color to high nibble
    OR R5, R2          ; Combine
    JMP .write_byte

.odd_pixel:
    ; Odd pixel: modify low nibble
    AND R5, #$F0       ; Clear low nibble
    AND R2, #$0F       ; Ensure color is only in low nibble
    OR R5, R2          ; Combine

.write_byte:
    ST R5, [R3:R4]

.exit:
    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RET

; Initial star X coordinates (will be copied to RAM)
star_x_coords_init:
    .byte 23, 156, 89, 200, 45, 178, 12, 234
    .byte 67, 145, 203, 34, 189, 78, 223, 56
    .byte 134, 201, 92, 167, 28, 215, 101, 189
    .byte 43, 198, 125, 76, 231, 103, 172, 39
    .byte 87, 159, 213, 98, 44, 182, 126, 201
    .byte 71, 149, 227, 109, 183, 52, 197, 88
    .byte 164, 38, 207, 119, 185, 64, 142, 223
    .byte 95, 176, 29, 203, 81, 155, 237, 112
    .byte 47, 192, 135, 73, 219, 99, 168, 31
    .byte 206, 124, 59, 187, 146, 84, 229, 107
    .byte 175, 51, 196, 118, 241, 93, 163, 26
    .byte 209, 137, 68, 195, 115, 173, 49, 221

; Star Y coordinates (static, read from ROM)
star_y_coords:
    .byte 45, 123, 78, 12, 156, 89, 134, 23
    .byte 98, 145, 67, 112, 34, 152, 91, 128
    .byte 56, 103, 142, 89, 15, 138, 72, 119
    .byte 149, 28, 95, 136, 61, 108, 143, 82
    .byte 17, 124, 87, 151, 42, 99, 133, 68
    .byte 105, 38, 147, 79, 116, 53, 129, 94
    .byte 31, 118, 85, 139, 64, 111, 146, 26
    .byte 92, 135, 71, 107, 48, 122, 157, 83
    .byte 19, 101, 144, 76, 126, 59, 97, 141
    .byte 24, 114, 88, 131, 52, 109, 148, 73
    .byte 36, 120, 93, 154, 66, 104, 137, 47
    .byte 81, 125, 58, 96, 140, 69, 113, 150

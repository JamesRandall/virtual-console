; Controllable Square Program
; Draws an 8x8 pixel square that can be moved with controller 1 D-pad
; Video Mode 0: 256x160 @ 4bpp
;
; Controls:
;   - D-pad Up/Down/Left/Right: Move the square

.org $0B80

; Hardware registers
.define VIDEO_MODE $0101
.define PALETTE_RAM $0200
.define CONTROLLER_1 $0136
.define INT_STATUS $0114
.define INT_ENABLE $0115
.define VBLANK_VEC_LO $0132
.define VBLANK_VEC_HI $0133

; Controller button masks
.define CTRL_UP $80
.define CTRL_DOWN $40
.define CTRL_LEFT $20
.define CTRL_RIGHT $10

; Colors
.define COLOR_BLACK 0
.define COLOR_WHITE 1
.define COLOR_BLUE 2

; Square parameters
.define SQUARE_SIZE 8

; RAM locations for square position and temp storage
.define SQUARE_X $0B00
.define SQUARE_Y $0B01
.define OLD_X $0B02
.define OLD_Y $0B03

; Entry point
main:
    ; Disable interrupts during setup
    CLI

    ; Set video mode to 0 (256x160 @ 4bpp)
    LD R0, #0
    ST R0, [VIDEO_MODE]

    ; Setup palette
    CALL setup_palette

    ; Initialize square position to center of screen
    ; Center X = (256 / 2) - (SQUARE_SIZE / 2) = 128 - 4 = 124
    ; Center Y = (160 / 2) - (SQUARE_SIZE / 2) = 80 - 4 = 76
    LD R0, #124
    ST R0, [SQUARE_X]
    LD R0, #76
    ST R0, [SQUARE_Y]

    ; Clear screen to black
    CALL clear_screen

    ; Draw initial square
    CALL draw_square

    ; Clear any pending interrupt flags
    LD R0, #$FF
    ST R0, [INT_STATUS]

    ; Install VBlank interrupt vector
    LD R0, #(vblank_handler & $FF)
    ST R0, [VBLANK_VEC_LO]
    LD R0, #(vblank_handler >> 8)
    ST R0, [VBLANK_VEC_HI]

    ; Enable VBlank interrupt
    LD R0, #$01
    ST R0, [INT_ENABLE]

    ; Enable interrupts in CPU
    SEI

    ; Main loop - wait for interrupts
main_loop:
    NOP
    NOP
    JMP main_loop

; VBlank interrupt handler
; Checks controller and updates square position
vblank_handler:
    ; Save registers
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3

    ; Clear VBlank flag
    LD R0, #$01
    ST R0, [INT_STATUS]

    ; Load controller state
    LD R0, [CONTROLLER_1]

    ; Load current position into R1, R2
    LD R1, [SQUARE_X]
    LD R2, [SQUARE_Y]

    ; Store old position for erasing later
    ST R1, [OLD_X]
    ST R2, [OLD_Y]

    ; Check UP button
    LD R3, R0
    AND R3, #CTRL_UP
    BRZ .check_down
    ; Move up (decrease Y)
    CMP R2, #0
    BRZ .check_down
    DEC R2

.check_down:
    ; Check DOWN button
    LD R3, R0
    AND R3, #CTRL_DOWN
    BRZ .check_left
    ; Move down (increase Y)
    CMP R2, #(160 - SQUARE_SIZE)
    BRC .check_left
    INC R2

.check_left:
    ; Check LEFT button
    LD R3, R0
    AND R3, #CTRL_LEFT
    BRZ .check_right
    ; Move left (decrease X)
    CMP R1, #0
    BRZ .check_right
    DEC R1

.check_right:
    ; Check RIGHT button
    LD R3, R0
    AND R3, #CTRL_RIGHT
    BRZ .update_done
    ; Move right (increase X)
    CMP R1, #(256 - SQUARE_SIZE)
    BRC .update_done
    INC R1

.update_done:
    ; Check if position changed
    LD R3, [OLD_X]
    CMP R1, R3
    BRNZ .position_changed
    LD R3, [OLD_Y]
    CMP R2, R3
    BRNZ .position_changed
    JMP .no_change

.position_changed:
    ; Save new position to temp storage (R1, R2 will be clobbered)
    PUSH R1
    PUSH R2

    ; Erase old square at OLD_X, OLD_Y
    LD R0, [OLD_X]
    LD R1, [OLD_Y]
    LD R2, #COLOR_BLACK
    CALL fill_square

    ; Restore new position and save to memory
    POP R2
    POP R1
    ST R1, [SQUARE_X]
    ST R2, [SQUARE_Y]

    ; Draw square at new position
    CALL draw_square

.no_change:
    ; Restore registers
    POP R3
    POP R2
    POP R1
    POP R0

    ; Return from interrupt
    RTI

; Setup palette
setup_palette:
    PUSH R0

    ; Color 0: Black
    LD R0, #253
    ST R0, [PALETTE_RAM]

    ; Color 1: White
    LD R0, #255
    ST R0, [PALETTE_RAM + 1]

    ; Color 2: Blue
    LD R0, #127
    ST R0, [PALETTE_RAM + 2]

    POP R0
    RET

; Draw the square at current position with blue color
draw_square:
    PUSH R0
    PUSH R1
    PUSH R2

    LD R0, [SQUARE_X]
    LD R1, [SQUARE_Y]
    LD R2, #COLOR_BLUE
    CALL fill_square

    POP R2
    POP R1
    POP R0
    RET

; Fill an 8x8 square
; Inputs: R0 = X position
;         R1 = Y position
;         R2 = color
fill_square:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5

    ; Save starting position
    MOV R3, R0         ; Start X
    MOV R4, R1         ; Start Y
    MOV R5, R2         ; Color

    ; Loop through 8 rows
    LD R2, #0          ; Row counter
.row_loop:
    CMP R2, #SQUARE_SIZE
    BRZ .done

    ; Loop through 8 columns
    LD R1, #0          ; Column counter
.col_loop:
    CMP R1, #SQUARE_SIZE
    BRZ .next_row

    ; Calculate pixel position
    MOV R0, R3
    ADD R0, R1         ; X = start_x + column

    PUSH R1
    PUSH R2
    MOV R1, R4
    ADD R1, R2         ; Y = start_y + row
    MOV R2, R5         ; Color
    CALL draw_pixel
    POP R2
    POP R1

    ; Next column
    INC R1
    JMP .col_loop

.next_row:
    ; Next row
    INC R2
    JMP .row_loop

.done:
    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RET

; Clear screen to color 0
clear_screen:
    PUSH R0
    PUSH R2
    PUSH R3
    PUSH R4

    LD R2, #$B0        ; High byte of framebuffer start
    LD R3, #$00        ; Low byte
    LD R4, #$50        ; 80 pages (0x5000 bytes)
    LD R0, #0          ; Color 0 (black)

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

; Draw pixel at (X, Y) with color
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
    BRC .exit

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
    MOV R5, R0
    SHR R5
    ADD R4, R5
    BRC .carry
    JMP .no_carry

.carry:
    INC R3

.no_carry:
    ; Add framebuffer base address
    ADD R3, #$B0

    ; Load current byte
    LD R5, [R3:R4]

    ; Check if X is even or odd
    AND R0, #1
    BRNZ .odd_pixel

    ; Even pixel: high nibble
    AND R5, #$0F
    SHL R2, #4
    OR R5, R2
    JMP .write_byte

.odd_pixel:
    ; Odd pixel: low nibble
    AND R5, #$F0
    AND R2, #$0F
    OR R5, R2

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

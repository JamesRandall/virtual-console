; Display "HELLO" using linear framebuffer - 2X SCALE
; Video Mode 0: 256×160 @ 4bpp
; Uses a simple 10x14 pixel font (2x scaled from 5x7)

.org $0B80

; Constants
.define VIDEO_MODE $0101
.define PALETTE_RAM $0200
.define FRAMEBUFFER_START $B000

; Color indices
.define COLOR_BLACK 0
.define COLOR_WHITE 1

; Text position (adjusted for larger text)
.define TEXT_X 50
.define TEXT_Y 73

main:
    ; Set video mode to 0 (256x160 @ 4bpp)
    LD R0, #0
    ST R0, [VIDEO_MODE]

    ; Setup palette
    CALL setup_palette

    ; Clear screen to black
    CALL clear_screen

    ; Draw "HELLO" at 2x scale
    ; Each letter is 10 pixels wide, with 2 pixel spacing = 12 pixels per letter

    ; Draw 'H' at position (TEXT_X, TEXT_Y)
    LD R0, #TEXT_X
    LD R1, #TEXT_Y
    CALL draw_h

    ; Draw 'E' at position (TEXT_X + 12, TEXT_Y)
    LD R0, #(TEXT_X + 12)
    LD R1, #TEXT_Y
    CALL draw_e

    ; Draw 'L' at position (TEXT_X + 24, TEXT_Y)
    LD R0, #(TEXT_X + 24)
    LD R1, #TEXT_Y
    CALL draw_l

    ; Draw 'L' at position (TEXT_X + 36, TEXT_Y)
    LD R0, #(TEXT_X + 36)
    LD R1, #TEXT_Y
    CALL draw_l

    ; Draw 'O' at position (TEXT_X + 48, TEXT_Y)
    LD R0, #(TEXT_X + 48)
    LD R1, #TEXT_Y
    CALL draw_o

done:
    JMP done

; Setup palette
setup_palette:
    PUSH R0

    ; Color 0: Black
    LD R0, #253
    ST R0, [PALETTE_RAM]

    ; Color 1: White
    LD R0, #255
    ST R0, [PALETTE_RAM + 1]

    POP R0
    RET

; Clear screen to color 0 (black)
clear_screen:
    PUSH R0
    PUSH R2
    PUSH R3
    PUSH R4

    LD R2, #$B0        ; High byte of framebuffer start
    LD R3, #$00        ; Low byte
    LD R4, #$50        ; 80 pages (0x5000 bytes = 20480 bytes)
    LD R0, #0          ; Color 0

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

; Draw letter 'H' (10x14 pixels - 2x scale)
; Inputs: R0 = X position, R1 = Y position
draw_h:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4

    ST R0, [temp_x]
    ST R1, [temp_y]

    ; H pattern: vertical lines on left and right, horizontal in middle
    ; Columns 0-1: pixels 0-13 (left bar, 2 pixels wide)
    LD R4, #14
    LD R0, [temp_x]
    LD R1, [temp_y]
.col0:
    MOV R2, R1
    CALL draw_pixel_white
    INC R0
    CALL draw_pixel_white
    DEC R0
    INC R1
    DEC R4
    BRNZ .col0

    ; Columns 8-9: pixels 0-13 (right bar, 2 pixels wide)
    LD R4, #14
    LD R0, [temp_x]
    ADD R0, #8
    LD R1, [temp_y]
.col8:
    MOV R2, R1
    CALL draw_pixel_white
    INC R0
    CALL draw_pixel_white
    DEC R0
    INC R1
    DEC R4
    BRNZ .col8

    ; Middle horizontal bars at rows 6-7, columns 2-7 (2 rows)
    LD R0, [temp_x]
    ADD R0, #2
    LD R1, [temp_y]
    ADD R1, #6
    LD R4, #6
.mid_row1:
    CALL draw_pixel_white
    INC R0
    DEC R4
    BRNZ .mid_row1

    LD R0, [temp_x]
    ADD R0, #2
    LD R1, [temp_y]
    ADD R1, #7
    LD R4, #6
.mid_row2:
    CALL draw_pixel_white
    INC R0
    DEC R4
    BRNZ .mid_row2

    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RET

; Draw letter 'E' (10x14 pixels - 2x scale)
; Inputs: R0 = X position, R1 = Y position
draw_e:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4

    ST R0, [temp_x]
    ST R1, [temp_y]

    ; E pattern: vertical line on left, three horizontal lines
    ; Columns 0-1: pixels 0-13 (left bar, 2 pixels wide)
    LD R4, #14
    LD R0, [temp_x]
    LD R1, [temp_y]
.col0:
    MOV R2, R1
    CALL draw_pixel_white
    INC R0
    CALL draw_pixel_white
    DEC R0
    INC R1
    DEC R4
    BRNZ .col0

    ; Top horizontal lines (rows 0-1, columns 2-9)
    LD R0, [temp_x]
    ADD R0, #2
    LD R1, [temp_y]
    LD R4, #8
.top_row1:
    CALL draw_pixel_white
    INC R0
    DEC R4
    BRNZ .top_row1

    LD R0, [temp_x]
    ADD R0, #2
    LD R1, [temp_y]
    INC R1
    LD R4, #8
.top_row2:
    CALL draw_pixel_white
    INC R0
    DEC R4
    BRNZ .top_row2

    ; Middle horizontal lines (rows 6-7, columns 2-7)
    LD R0, [temp_x]
    ADD R0, #2
    LD R1, [temp_y]
    ADD R1, #6
    LD R4, #6
.mid_row1:
    CALL draw_pixel_white
    INC R0
    DEC R4
    BRNZ .mid_row1

    LD R0, [temp_x]
    ADD R0, #2
    LD R1, [temp_y]
    ADD R1, #7
    LD R4, #6
.mid_row2:
    CALL draw_pixel_white
    INC R0
    DEC R4
    BRNZ .mid_row2

    ; Bottom horizontal lines (rows 12-13, columns 2-9)
    LD R0, [temp_x]
    ADD R0, #2
    LD R1, [temp_y]
    ADD R1, #12
    LD R4, #8
.bot_row1:
    CALL draw_pixel_white
    INC R0
    DEC R4
    BRNZ .bot_row1

    LD R0, [temp_x]
    ADD R0, #2
    LD R1, [temp_y]
    ADD R1, #13
    LD R4, #8
.bot_row2:
    CALL draw_pixel_white
    INC R0
    DEC R4
    BRNZ .bot_row2

    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RET

; Draw letter 'L' (10x14 pixels - 2x scale)
; Inputs: R0 = X position, R1 = Y position
draw_l:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4

    ST R0, [temp_x]
    ST R1, [temp_y]

    ; L pattern: vertical line on left, horizontal line at bottom
    ; Columns 0-1: pixels 0-13 (left bar, 2 pixels wide)
    LD R4, #14
    LD R0, [temp_x]
    LD R1, [temp_y]
.col0:
    MOV R2, R1
    CALL draw_pixel_white
    INC R0
    CALL draw_pixel_white
    DEC R0
    INC R1
    DEC R4
    BRNZ .col0

    ; Bottom horizontal lines (rows 12-13, columns 2-9)
    LD R0, [temp_x]
    ADD R0, #2
    LD R1, [temp_y]
    ADD R1, #12
    LD R4, #8
.bot_row1:
    CALL draw_pixel_white
    INC R0
    DEC R4
    BRNZ .bot_row1

    LD R0, [temp_x]
    ADD R0, #2
    LD R1, [temp_y]
    ADD R1, #13
    LD R4, #8
.bot_row2:
    CALL draw_pixel_white
    INC R0
    DEC R4
    BRNZ .bot_row2

    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RET

; Draw letter 'O' (10x14 pixels - 2x scale)
; Inputs: R0 = X position, R1 = Y position
draw_o:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4

    ST R0, [temp_x]
    ST R1, [temp_y]

    ; O pattern: rectangle outline (2 pixels thick)
    ; Top horizontal lines (rows 0-1, columns 2-7)
    LD R0, [temp_x]
    ADD R0, #2
    LD R1, [temp_y]
    LD R4, #6
.top_row1:
    CALL draw_pixel_white
    INC R0
    DEC R4
    BRNZ .top_row1

    LD R0, [temp_x]
    ADD R0, #2
    LD R1, [temp_y]
    INC R1
    LD R4, #6
.top_row2:
    CALL draw_pixel_white
    INC R0
    DEC R4
    BRNZ .top_row2

    ; Left vertical lines (columns 0-1, rows 2-11)
    LD R4, #10
    LD R0, [temp_x]
    LD R1, [temp_y]
    ADD R1, #2
.left:
    MOV R2, R1
    CALL draw_pixel_white
    INC R0
    CALL draw_pixel_white
    DEC R0
    INC R1
    DEC R4
    BRNZ .left

    ; Right vertical lines (columns 8-9, rows 2-11)
    LD R4, #10
    LD R0, [temp_x]
    ADD R0, #8
    LD R1, [temp_y]
    ADD R1, #2
.right:
    MOV R2, R1
    CALL draw_pixel_white
    INC R0
    CALL draw_pixel_white
    DEC R0
    INC R1
    DEC R4
    BRNZ .right

    ; Bottom horizontal lines (rows 12-13, columns 2-7)
    LD R0, [temp_x]
    ADD R0, #2
    LD R1, [temp_y]
    ADD R1, #12
    LD R4, #6
.bot_row1:
    CALL draw_pixel_white
    INC R0
    DEC R4
    BRNZ .bot_row1

    LD R0, [temp_x]
    ADD R0, #2
    LD R1, [temp_y]
    ADD R1, #13
    LD R4, #6
.bot_row2:
    CALL draw_pixel_white
    INC R0
    DEC R4
    BRNZ .bot_row2

    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RET

; Helper: Draw white pixel (calls draw_pixel with color 1)
; Inputs: R0 = X, R1 = Y
draw_pixel_white:
    PUSH R2
    LD R2, #COLOR_WHITE
    CALL draw_pixel
    POP R2
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

; Temporary storage
temp_x: .byte 0
temp_y: .byte 0

; Filled Circle Drawing Program
; Demonstrates filled circle rendering in Video Mode 0 (256x160 @ 4bpp)
; Uses optimized scan-line algorithm with direct calculation
;
; Main subroutine: fill_circle
;   Inputs: R0 = center X, R1 = center Y, R2 = radius, R3 = color

.org $0B80

; Constants
.define VIDEO_MODE $0101
.define PALETTE_RAM $0200

; Color palette indices
.define COLOR_BLACK 0
.define COLOR_WHITE 1
.define COLOR_RED 2
.define COLOR_GREEN 3
.define COLOR_BLUE 4
.define COLOR_YELLOW 5
.define COLOR_CYAN 6
.define COLOR_MAGENTA 7

; Entry point
main:
    ; Set video mode to 0 (256x160 @ 4bpp)
    LD R0, #0
    ST R0, [VIDEO_MODE]

    ; Setup palette
    CALL setup_palette

    ; Clear screen to black
    CALL clear_screen

    ; Draw multiple filled circles at different positions

    ; Large cyan circle (background)
    LD R0, #128        ; cx
    LD R1, #80         ; cy
    LD R2, #70         ; radius
    LD R3, #COLOR_CYAN
    CALL fill_circle

    ; Medium blue circle
    LD R0, #80
    LD R1, #60
    LD R2, #35
    LD R3, #COLOR_BLUE
    CALL fill_circle

    ; Medium green circle
    LD R0, #180
    LD R1, #100
    LD R2, #40
    LD R3, #COLOR_GREEN
    CALL fill_circle

    ; Small red circle
    LD R0, #128
    LD R1, #80
    LD R2, #25
    LD R3, #COLOR_RED
    CALL fill_circle

    ; Small yellow circle (top)
    LD R0, #100
    LD R1, #40
    LD R2, #15
    LD R3, #COLOR_YELLOW
    CALL fill_circle

    ; Small magenta circle
    LD R0, #160
    LD R1, #120
    LD R2, #18
    LD R3, #COLOR_MAGENTA
    CALL fill_circle

    ; Tiny white circle (center)
    LD R0, #128
    LD R1, #80
    LD R2, #8
    LD R3, #COLOR_WHITE
    CALL fill_circle

done:
    JMP done

; Setup palette with basic colors
setup_palette:
    PUSH R0

    ; Color 0: Black
    LD R0, #253
    ST R0, [PALETTE_RAM]

    ; Color 1: White
    LD R0, #255
    ST R0, [PALETTE_RAM + 1]

    ; Color 2: Red
    LD R0, #6
    ST R0, [PALETTE_RAM + 2]

    ; Color 3: Green
    LD R0, #61
    ST R0, [PALETTE_RAM + 3]

    ; Color 4: Blue
    LD R0, #127
    ST R0, [PALETTE_RAM + 4]

    ; Color 5: Yellow
    LD R0, #37
    ST R0, [PALETTE_RAM + 5]

    ; Color 6: Cyan
    LD R0, #60
    ST R0, [PALETTE_RAM + 6]

    ; Color 7: Magenta
    LD R0, #170
    ST R0, [PALETTE_RAM + 7]

    POP R0
    RET

; Subroutine: Fill a circle using Bresenham-style algorithm
; Inputs: R0 = center X (cx)
;         R1 = center Y (cy)
;         R2 = radius
;         R3 = color
;
; Uses midpoint circle algorithm to find span widths
fill_circle:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5

    ; Save parameters
    ST R0, [cx]
    ST R1, [cy]
    ST R2, [radius]
    ST R3, [color]

    ; Initialize x=0, y=radius
    LD R0, #0
    ST R0, [x]
    LD R0, [radius]
    ST R0, [y]

    ; d = 1 - radius
    LD R0, #1
    LD R1, [radius]
    SUB R0, R1
    ST R0, [d]

.circle_loop:
    ; Draw horizontal spans at 8 symmetric positions
    CALL draw_circle_spans

    ; Check if x >= y (done)
    LD R0, [x]
    LD R1, [y]
    CMP R0, R1
    BRC .done_circle

    ; Update decision parameter
    LD R0, [d]
    AND R0, #$80        ; Check if negative
    BRNZ .d_negative

    ; d >= 0: y--, d += 2*(x-y) + 1
    LD R0, [y]
    DEC R0
    ST R0, [y]

    ; Calculate 2*(x-y)
    LD R0, [x]
    LD R1, [y]
    SUB R0, R1
    SHL R0              ; *2
    INC R0              ; +1

    LD R1, [d]
    ADD R1, R0
    ST R1, [d]
    JMP .increment_x

.d_negative:
    ; d < 0: d += 2*x + 1
    LD R0, [x]
    SHL R0              ; *2
    INC R0              ; +1

    LD R1, [d]
    ADD R1, R0
    ST R1, [d]

.increment_x:
    LD R0, [x]
    INC R0
    ST R0, [x]
    JMP .circle_loop

.done_circle:
    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RET

; Draw 4 horizontal spans at the current x,y octant positions
; This fills the circle by drawing horizontal lines
draw_circle_spans:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5

    LD R4, [x]
    LD R5, [y]

    ; Span 1: from cx-y to cx+y at cy+x
    LD R0, [cy]
    ADD R0, R4          ; cy + x
    ST R0, [scan_y]
    CMP R0, #160        ; Check bounds
    BRC .span2

    LD R0, [cx]
    SUB R0, R5          ; cx - y
    ST R0, [x1]
    LD R0, [cx]
    ADD R0, R5          ; cx + y
    ST R0, [x2]

    LD R0, [x1]
    LD R1, [x2]
    LD R2, [scan_y]
    LD R3, [color]
    CALL draw_h_line

.span2:
    ; Span 2: from cx-y to cx+y at cy-x
    LD R0, [cy]
    SUB R0, R4          ; cy - x
    BRNC .span3         ; Skip if underflow
    ST R0, [scan_y]
    CMP R0, #160
    BRC .span3

    LD R0, [cx]
    SUB R0, R5          ; cx - y
    ST R0, [x1]
    LD R0, [cx]
    ADD R0, R5          ; cx + y
    ST R0, [x2]

    LD R0, [x1]
    LD R1, [x2]
    LD R2, [scan_y]
    LD R3, [color]
    CALL draw_h_line

.span3:
    ; Span 3: from cx-x to cx+x at cy+y
    LD R0, [cy]
    ADD R0, R5          ; cy + y
    ST R0, [scan_y]
    CMP R0, #160
    BRC .span4

    LD R0, [cx]
    SUB R0, R4          ; cx - x
    ST R0, [x1]
    LD R0, [cx]
    ADD R0, R4          ; cx + x
    ST R0, [x2]

    LD R0, [x1]
    LD R1, [x2]
    LD R2, [scan_y]
    LD R3, [color]
    CALL draw_h_line

.span4:
    ; Span 4: from cx-x to cx+x at cy-y
    LD R0, [cy]
    SUB R0, R5          ; cy - y
    BRNC .spans_done    ; Skip if underflow
    ST R0, [scan_y]
    CMP R0, #160
    BRC .spans_done

    LD R0, [cx]
    SUB R0, R4          ; cx - x
    ST R0, [x1]
    LD R0, [cx]
    ADD R0, R4          ; cx + x
    ST R0, [x2]

    LD R0, [x1]
    LD R1, [x2]
    LD R2, [scan_y]
    LD R3, [color]
    CALL draw_h_line

.spans_done:
    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RET

; Draw horizontal line from (x1, y) to (x2, y)
; Inputs: R0 = x1, R1 = x2, R2 = y, R3 = color
draw_h_line:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5

    MOV R4, R0
    MOV R5, R1

    ; Ensure x1 <= x2
    CMP R4, R5
    BRNC .loop
    MOV R4, R1
    MOV R5, R0

.loop:
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5

    MOV R0, R4
    MOV R1, R2
    MOV R2, R3
    CALL plot_pixel

    POP R5
    POP R4
    POP R3
    POP R2

    CMP R4, R5
    BRZ .h_done

    INC R4
    JMP .loop

.h_done:
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

    LD R2, #$B0
    LD R3, #$00
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

; Plot pixel at (R0, R1) with color R2
plot_pixel:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5

    ; Bounds check
    CMP R1, #160
    BRC .exit

    ; Calculate address: 0xB000 + (Y * 128) + (X / 2)
    LD R3, #0
    MOV R4, R1

    ; Y * 128 (shift left 7)
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

    ; Add X/2
    MOV R5, R0
    SHR R5
    ADD R4, R5
    BRC .carry
    JMP .no_carry
.carry:
    INC R3
.no_carry:

    ; Add framebuffer base
    ADD R3, #$B0

    ; Load byte
    LD R5, [R3:R4]

    ; Even or odd?
    AND R0, #1
    BRNZ .odd

    ; Even: high nibble
    AND R5, #$0F
    SHL R2, #4
    OR R5, R2
    JMP .write

.odd:
    ; Odd: low nibble
    AND R5, #$F0
    AND R2, #$0F
    OR R5, R2

.write:
    ST R5, [R3:R4]

.exit:
    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RET

; Variables
cx:       .byte 0
cy:       .byte 0
radius:   .byte 0
color:    .byte 0
x:        .byte 0
y:        .byte 0
d:        .byte 0
scan_y:   .byte 0
x1:       .byte 0
x2:       .byte 0

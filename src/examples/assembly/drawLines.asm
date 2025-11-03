; Bresenham Line Drawing Example
; Demonstrates optimized line drawing algorithm for 8-bit CPU
; Video Mode 0: 256x160 @ 4bpp
;
; draw_line subroutine:
;   Inputs: R0 = x0, R1 = y0, R2 = x1, R3 = y1, R4 = color
;   Uses Bresenham's algorithm to draw a line between two points

.org $0B80

; Constants
.define VIDEO_MODE $0101
.define PALETTE_RAM $0200
.define FRAMEBUFFER_START $B000

; Zero page variables for line drawing (fast access)
.define dx_abs $80
.define dy_abs $81
.define sx $82
.define sy $83
.define err_lo $84
.define err_hi $85
.define x_cur $86
.define y_cur $87
.define x_end $88
.define y_end $89
.define color $8A
.define e2_lo $8B
.define e2_hi $8C

; Entry point
main:
    ; Set video mode to 0 (256x160 @ 4bpp)
    LD R0, #0
    ST R0, [VIDEO_MODE]

    ; Setup palette (simple: black, red, white)
    CALL setup_palette

    ; Clear screen to black (color 0)
    CALL clear_screen

    ; Draw line from (32, 32) to (64, 64) with color 2
    LD R0, #32         ; x0
    LD R1, #32         ; y0
    LD R2, #64         ; x1
    LD R3, #64         ; y1
    LD R4, #2          ; color
    CALL draw_line

    ; Draw another line from (100, 20) to (200, 140) with color 2
    LD R0, #100
    LD R1, #20
    LD R2, #200
    LD R3, #140
    LD R4, #3
    CALL draw_line

    ; Draw horizontal line (50, 80) to (150, 80)
    LD R0, #50
    LD R1, #80
    LD R2, #150
    LD R3, #80
    LD R4, #4
    CALL draw_line

    ; Draw vertical line (128, 20) to (128, 140)
    LD R0, #128
    LD R1, #20
    LD R2, #128
    LD R3, #140
    LD R4, #5
    CALL draw_line

    ; Infinite loop - program done
done:
    JMP done

; Setup palette
setup_palette:
    PUSH R0

    ; Color 0: Black
    LD R0, #253
    ST R0, [PALETTE_RAM]

    ; Color 1: Dark gray
    LD R0, #229
    ST R0, [PALETTE_RAM + 1]

    ; Color 2: Red
    LD R0, #6
    ST R0, [PALETTE_RAM + 2]

    ; Color 3: White
    LD R0, #255
    ST R0, [PALETTE_RAM + 3]

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
    LD R4, #$50        ; 80 pages (0x5000 bytes)
    LD R0, #0          ; Color to write (0 = black)

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

; Subroutine: Draw line using Bresenham's algorithm
; Inputs: R0 = x0, R1 = y0, R2 = x1, R3 = y1, R4 = color
; Optimized for 8-bit CPU with proper signed arithmetic
draw_line:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5

    ; Store parameters in zero page for easy access
    ST R0, [x_cur]     ; x = x0
    ST R1, [y_cur]     ; y = y0
    ST R2, [x_end]     ; Store x1 for endpoint check
    ST R3, [y_end]     ; Store y1 for endpoint check
    ST R4, [color]     ; Store color

    ; Calculate dx = x1 - x0 (signed)
    MOV R5, R2         ; R5 = x1
    SUB R5, R0         ; R5 = x1 - x0 (dx, may be negative)

    ; Determine sx (step direction for x)
    ; If dx >= 0, sx = 1; else sx = -1 (255 in unsigned)
    AND R5, #$80       ; Check sign bit
    BRZ .dx_positive   ; Use JMP instead of BRNZ

    ; dx < 0, set sx = -1 (255) and make dx positive
    LD R0, #$FF        ; -1 in 8-bit two's complement
    ST R0, [sx]
    LD R0, [x_cur]     ; dx_abs = x0 - x1
    SUB R0, R2
    MOV R5, R0
    JMP .dx_done

.dx_positive:
    ; dx >= 0
    LD R0, #1
    ST R0, [sx]
    MOV R5, R2         ; Restore dx = x1 - x0
    LD R0, [x_cur]
    SUB R5, R0

.dx_done:
    ST R5, [dx_abs]    ; Store absolute value of dx

    ; Calculate dy = y1 - y0 (signed)
    LD R5, [y_end]     ; R5 = y1
    LD R0, [y_cur]     ; R0 = y0
    SUB R5, R0         ; R5 = y1 - y0 (dy, may be negative)

    ; Determine sy (step direction for y)
    AND R5, #$80       ; Check sign bit
    BRZ .dy_positive   ; Use JMP instead of BRNZ

    ; dy < 0, set sy = -1 (255) and make dy positive
    LD R0, #$FF        ; -1 in 8-bit two's complement
    ST R0, [sy]
    LD R0, [y_cur]     ; dy_abs = y0 - y1
    LD R5, [y_end]
    SUB R0, R5
    MOV R5, R0
    JMP .dy_done

.dy_positive:
    ; dy >= 0
    LD R0, #1
    ST R0, [sy]
    LD R5, [y_end]
    LD R0, [y_cur]
    SUB R5, R0

.dy_done:
    ST R5, [dy_abs]    ; Store absolute value of dy

    ; Calculate initial error: err = dx - dy (16-bit signed)
    LD R0, [dx_abs]    ; R0 = dx
    LD R1, [dy_abs]    ; R1 = dy
    SUB R0, R1         ; R0 = dx - dy
    ST R0, [err_lo]    ; Store low byte

    ; Handle sign extension to 16-bit
    ; If result is negative (bit 7 set), high byte = 0xFF, else 0x00
    AND R0, #$80
    BRZ .err_positive
    LD R0, #$FF
    JMP .err_stored
.err_positive:
    LD R0, #0
.err_stored:
    ST R0, [err_hi]

    ; Main drawing loop
.loop:
    ; Plot pixel at (x_cur, y_cur)
    LD R0, [x_cur]
    LD R1, [y_cur]
    LD R2, [color]
    CALL plot_pixel

    ; Check if we've reached the endpoint (x == x1 && y == y1)
    LD R0, [x_cur]
    LD R1, [x_end]
    CMP R0, R1
    BRNZ .continue_far ; x != x1, continue (use far jump)

    LD R0, [y_cur]
    LD R1, [y_end]
    CMP R0, R1
    BRZ .done          ; x == x1 && y == y1, done!

.continue_far:
    JMP .continue

.done:
    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RET

.continue:
    ; Calculate e2 = err << 1 (multiply by 2)
    ; This is a 16-bit left shift
    LD R0, [err_lo]
    LD R1, [err_hi]

    ; Shift left (R1:R0 as 16-bit value)
    SHL R0             ; Shift low byte left
    ROL R1             ; Rotate high byte left with carry

    ST R0, [e2_lo]
    ST R1, [e2_hi]

    ; Check if e2 > -dy (equivalent to e2 + dy > 0)
    ; Add dy to e2 and check if result is positive
    LD R2, [dy_abs]    ; R2 = dy
    ADD R0, R2         ; R0 = e2_lo + dy (low byte)
    LD R3, R1          ; R3 = e2_hi
    BRC .carry1        ; Handle carry
    JMP .no_carry1
.carry1:
    INC R3             ; Propagate carry to high byte
.no_carry1:

    ; Check if high byte has sign bit clear (positive or zero)
    ; OR if high byte is 0xFF and low byte > 0 (small positive number)
    AND R3, #$80
    BRZ .step_x        ; Positive, step in x direction

    ; Negative, skip x step
    JMP .check_y

.step_x:
    ; err -= dy
    LD R0, [err_lo]
    LD R1, [err_hi]
    LD R2, [dy_abs]

    SUB R0, R2         ; Subtract from low byte
    ST R0, [err_lo]

    BRC .no_borrow_x   ; Carry set means no borrow
    DEC R1             ; Carry clear means borrow, propagate
.no_borrow_x:
    ST R1, [err_hi]

    ; x += sx
    LD R0, [x_cur]
    LD R1, [sx]
    ADD R0, R1
    ST R0, [x_cur]

.check_y:
    ; Check if e2 < dx (compare 16-bit e2 with 8-bit dx)
    ; dx is positive, so treat as 0x00:dx for 16-bit comparison
    LD R0, [e2_hi]

    ; If e2_hi is negative (bit 7 set), then e2 < dx
    AND R0, #$80
    BRZ .check_y_cont
    JMP .step_y

.check_y_cont:
    ; e2_hi >= 0, check if e2_hi > 0 or (e2_hi == 0 && e2_lo < dx)
    LD R0, [e2_hi]
    CMP R0, #0
    BRZ .check_lo
    JMP .loop          ; e2_hi > 0, so e2 > dx, skip y step

.check_lo:
    ; e2_hi == 0, compare e2_lo with dx
    LD R0, [e2_lo]
    LD R1, [dx_abs]
    CMP R0, R1
    BRC .loop_far      ; e2_lo >= dx, skip y step (use JMP due to range)

.step_y:
    ; err += dx
    LD R0, [err_lo]
    LD R1, [err_hi]
    LD R2, [dx_abs]

    ADD R0, R2         ; Add to low byte
    ST R0, [err_lo]

    BRC .carry2        ; Check for carry
    JMP .no_carry2
.carry2:
    INC R1             ; Propagate carry to high byte
.no_carry2:
    ST R1, [err_hi]

    ; y += sy
    LD R0, [y_cur]
    LD R1, [sy]
    ADD R0, R1
    ST R0, [y_cur]

    ; Continue loop
    JMP .loop

.loop_far:
    JMP .loop

; Plot pixel at (R0, R1) with color R2
; 4bpp mode: 2 pixels per byte
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
    ; Y * 128 using shifts
    LD R3, #0          ; R3 = high byte (initially 0)
    MOV R4, R1         ; R4 = low byte (Y)

    ; Shift left 7 times (R3:R4 as 16-bit)
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

    ; Add X/2 to low byte
    MOV R5, R0
    SHR R5
    ADD R4, R5
    BRC .carry
    JMP .no_carry
.carry:
    INC R3
.no_carry:

    ; Add framebuffer base to high byte
    ADD R3, #$B0

    ; R3:R4 = address (R3=high, R4=low)
    ; Load current byte
    LD R5, [R3:R4]

    ; Check if X is even or odd
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

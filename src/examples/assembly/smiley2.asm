; Smiley Face - Simplified Version
; Video Mode 0: 256×160 @ 4bpp

.org $0B80

; Constants
.define VIDEO_MODE $0101

; Color indices
.define COLOR_BLACK 0
.define COLOR_YELLOW 5
.define COLOR_RED 2

main:
    ; Set video mode
    LD R0, #0
    ST R0, [VIDEO_MODE]
    
    ; Setup palette
    CALL setup_palette
    
    ; Clear screen
    CALL clear_screen
    
    ; Draw face circle (yellow)
    LD R0, #128        ; cx
    LD R1, #80         ; cy  
    LD R2, #60         ; radius
    LD R3, #COLOR_YELLOW
    CALL draw_circle
    
    ; Draw left eye (red)
    LD R0, #100
    LD R1, #70
    LD R2, #8
    LD R3, #COLOR_RED
    CALL draw_circle
    
    ; Draw right eye (red)
    LD R0, #156
    LD R1, #70
    LD R2, #8
    LD R3, #COLOR_RED
    CALL draw_circle
    
    ; Draw mouth line (red)
    LD R0, #90         ; x1
    LD R1, #166        ; x2
    LD R2, #105        ; y
    LD R3, #COLOR_RED
    CALL draw_h_line
    
done:
    JMP done

; Setup palette
setup_palette:
    LD R0, #253        ; black
    ST R0, [$0200]
    LD R0, #6          ; red  
    ST R0, [$0202]
    LD R0, #37         ; yellow
    ST R0, [$0205]
    RET

; Clear screen
clear_screen:
    LD R2, #$B0        ; High byte
    LD R3, #$00        ; Low byte
    LD R4, #$50        ; 80 pages
    LD R0, #0
.outer:
    LD R5, #0
.inner:
    ST R0, [R2:R3]     ; R2:R3 = R2(high):R3(low)
    INC R3             ; Increment low byte
    INC R5
    BRNZ .inner
    INC R2             ; Increment high byte
    DEC R4
    BRNZ .outer
    RET

; Draw horizontal line
; R0=x1, R1=x2, R2=y, R3=color
draw_h_line:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5
    
    MOV R4, R0         ; x current
    MOV R5, R1         ; x end
    
.loop:
    ; Plot pixel at (R4, R2) with color R3
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5
    
    MOV R0, R4         ; x
    MOV R1, R2         ; y
    MOV R2, R3         ; color
    CALL plot_pixel
    
    POP R5
    POP R4
    POP R3
    POP R2
    
    ; Check if we've reached the end
    CMP R4, R5
    BRZ .done          ; If R4 == R5, we've drawn the last pixel, exit
    
    ; Not at end yet, continue
    INC R4
    JMP .loop
    
.done:
    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RET

; Draw circle using Bresenham
; R0=cx, R1=cy, R2=radius, R3=color
draw_circle:
    ; Save parameters
    ST R0, [cx]
    ST R1, [cy]
    ST R2, [radius]
    ST R3, [color]
    
    ; x = 0, y = radius
    LD R0, #0
    ST R0, [x]
    LD R0, [radius]
    ST R0, [y]
    
    ; d = 1 - radius
    LD R0, #1
    LD R1, [radius]
    SUB R0, R1
    ST R0, [d]
    
.loop:
    ; Plot 8 points
    CALL plot_8_points
    
    ; if x >= y, done
    LD R0, [x]
    LD R1, [y]
    CMP R0, R1
    BRC .done
    
    ; if d < 0
    LD R0, [d]
    AND R0, #$80
    BRNZ .d_neg
    
    ; d >= 0: decrement y, update d
    LD R0, [y]
    DEC R0
    ST R0, [y]
    
    ; d += 2*(x-y)+1
    LD R0, [x]
    LD R1, [y]
    SUB R0, R1
    SHL R0
    INC R0
    LD R1, [d]
    ADD R1, R0
    ST R1, [d]
    JMP .inc_x
    
.d_neg:
    ; d += 2*x+1
    LD R0, [x]
    SHL R0
    INC R0
    LD R1, [d]
    ADD R1, R0
    ST R1, [d]
    
.inc_x:
    LD R0, [x]
    INC R0
    ST R0, [x]
    JMP .loop
    
.done:
    RET

; Plot 8 symmetric circle points
plot_8_points:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5
    
    LD R4, [x]
    LD R5, [y]
    
    ; (cx+x, cy+y)
    LD R0, [cx]
    LD R1, [cy]
    LD R2, [color]
    ADD R0, R4
    ADD R1, R5
    CALL plot_pixel
    
    ; (cx-x, cy+y)
    LD R0, [cx]
    LD R1, [cy]
    CMP R0, R4
    BRNC .s1
    SUB R0, R4
    ADD R1, R5
    CALL plot_pixel
.s1:
    
    ; (cx+x, cy-y)
    LD R0, [cx]
    LD R1, [cy]
    CMP R1, R5
    BRNC .s2
    ADD R0, R4
    SUB R1, R5
    CALL plot_pixel
.s2:
    
    ; (cx-x, cy-y)
    LD R0, [cx]
    LD R1, [cy]
    CMP R0, R4
    BRNC .s3
    CMP R1, R5
    BRNC .s3
    SUB R0, R4
    SUB R1, R5
    CALL plot_pixel
.s3:
    
    ; (cx+y, cy+x)
    LD R0, [cx]
    LD R1, [cy]
    ADD R0, R5
    ADD R1, R4
    CALL plot_pixel
    
    ; (cx-y, cy+x)
    LD R0, [cx]
    LD R1, [cy]
    CMP R0, R5
    BRNC .s4
    SUB R0, R5
    ADD R1, R4
    CALL plot_pixel
.s4:
    
    ; (cx+y, cy-x)
    LD R0, [cx]
    LD R1, [cy]
    CMP R1, R4
    BRNC .s5
    ADD R0, R5
    SUB R1, R4
    CALL plot_pixel
.s5:
    
    ; (cx-y, cy-x)
    LD R0, [cx]
    LD R1, [cy]
    CMP R0, R5
    BRNC .s6
    CMP R1, R4
    BRNC .s6
    SUB R0, R5
    SUB R1, R4
    CALL plot_pixel
.s6:
    
    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RET

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

; Variables
cx:     .byte 0
cy:     .byte 0
radius: .byte 0
x:      .byte 0
y:      .byte 0
d:      .byte 0
color:  .byte 0

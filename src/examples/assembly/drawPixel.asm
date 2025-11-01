; Draw Pixel Example
; Demonstrates a pixel drawing subroutine in Video Mode 0 (256x160 @ 4bpp)
;
; Subroutine: draw_pixel
;   Inputs: R0 = X coordinate, R1 = Y coordinate, R2 = color (palette index)
;   Draws a single pixel at (X,Y) with the specified color

.org $0B80

; Constants
.define VIDEO_MODE $0101
.define PALETTE_RAM $0200
.define FRAMEBUFFER_START $B000

; Entry point
main:
    ; Set video mode to 0 (256x160 @ 4bpp)
    LD R0, #0
    ST R0, [VIDEO_MODE]

    ; Clear screen to black (color 0)
    CALL clear_screen

    ; Draw pixel at (50, 50) with color 2
    LD R0, #50
    LD R1, #50
    LD R2, #2
    CALL draw_pixel

    ; Draw pixel at (20, 80) with color 3
    LD R0, #20
    LD R1, #80
    LD R2, #3
    CALL draw_pixel

    ; Draw pixel at (128, 100) with color 4
    LD R0, #128
    LD R1, #100
    LD R2, #4
    CALL draw_pixel

    ; Infinite loop - program done
done:
    JMP done

; Subroutine: Clear screen to color 0
; Uses register pairs to iterate through framebuffer
clear_screen:
    PUSH R0
    PUSH R2
    PUSH R3
    PUSH R4

    ; R2:R3 will be the address pointer
    LD R2, #$B0        ; High byte of framebuffer start
    LD R3, #$00        ; Low byte
    LD R4, #$50        ; 80 pages (0x5000 bytes = 20480 bytes for mode 0)
    LD R0, #0          ; Color to write (0 = black)

.outer:
.inner:
    ST R0, [R2:R3]     ; Write byte at R2:R3
    INC R3             ; Increment low byte
    BRNZ .inner        ; Loop until R3 wraps to 0

    INC R2             ; Increment high byte (next page)
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
;
; Mode 0 is 4bpp, so 2 pixels per byte:
;   - Even X: high nibble
;   - Odd X: low nibble
; Address calculation: 0xB000 + (Y * 128) + (X / 2)
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
    ; Y * 128 = Y << 7
    ; We'll use R3:R4 as a 16-bit value for the address offset

    LD R3, #0          ; R3 = high byte of offset (initially 0)
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
    BRC .carry         ; Check for carry
    JMP .no_carry

.carry:
    INC R3             ; Propagate carry to high byte

.no_carry:
    ; Add framebuffer base address (0xB000) to high byte
    ADD R3, #$B0

    ; Now R3:R4 contains the final address
    ; Load the current byte at this address
    LD R5, [R3:R4]

    ; Check if X is even or odd
    AND R0, #1         ; R0 = X & 1 (0 if even, 1 if odd)
    BRNZ .odd_pixel

    ; Even pixel: modify high nibble
    AND R5, #$0F       ; Clear high nibble, keep low nibble
    SHL R2, #4         ; Shift color to high nibble
    OR R5, R2          ; Combine
    JMP .write_byte

.odd_pixel:
    ; Odd pixel: modify low nibble
    AND R5, #$F0       ; Clear low nibble, keep high nibble
    AND R2, #$0F       ; Ensure color is only in low nibble
    OR R5, R2          ; Combine

.write_byte:
    ; Write the modified byte back
    ST R5, [R3:R4]

.exit:
    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RET

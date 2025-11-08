.org $B80
  .define SCRATCH $80
  CALL clear_screen

  LD R0,#64
  LD R1,#64
  LD R2,#2
  ;CALL draw_pixel
  ;INC R1
  ;CALL draw_pixel
  ;INC R1
  ;CALL draw_pixel
  ;INC R1
  ;CALL draw_pixel
  ;INC R1
  ;CALL draw_pixel
  CALL draw_bitmap

infiniteloop:
  JMP infiniteloop

; Inputs: R0 = X coordinate (0-255)
;         R1 = Y coordinate (0-159)
;         R2 = color (palette index 0-15)
draw_bitmap:
.define CURRENT_X SCRATCH
.define STARTING_X SCRATCH+6
.define CURRENT_Y SCRATCH+1
.define END_Y SCRATCH+2
.define BITMAP_LO SCRATCH+4
.define BITMAP_HI SCRATCH+5
.define COLOUR SCRATCH+3

  ST R0,CURRENT_X ; current x
  ST R0,STARTING_X ; starting x
  ST R1,CURRENT_Y ; y
  ADD R1,#7
  ST R1,END_Y ; end y
  ST R2,COLOUR ; colour

  ; bitmap source
  LD R4,#<bitmap_data
  LD R5,#>bitmap_data
  ST R4,BITMAP_LO ; bitmap lo
  ST R5,BITMAP_HI ; bitmap hi

  .row_loop:
  LD R5,[$84]
  .inner_loop:
  ; check see if the first bit is set, if not skip
  MOV R3,R5
  AND R3,#$80
  BRZ .next_column

  ; draw the pixel if the bit is set
  LD R0,CURRENT_X
  LD R1,CURRENT_Y
  LD R2,COLOUR
  CALL draw_pixel
  
  .next_column:
  LD R0,CURRENT_X
  INC R0
  ST R0,CURRENT_X
  SHL R5
  CMP R5,#0
  BRNZ .inner_loop

  .next_row:
  LD R0,STARTING_X ; move back to starting x
  ST R0,CURRENT_X
  LD R0,CURRENT_Y ; move the y / row on 1
  INC R0
  ST R0,CURRENT_Y
  LD R1,END_Y
  CMP R0,R1
  BRZ .done
  ; Add 1 to the 16-bit address at $84:$85
  LD R2, BITMAP_LO      ; Load low byte
  INC R2            ; Increment low byte
  ST R2, BITMAP_LO      ; Store back
  BRNZ .no_carry    ; If not zero, no carry occurred
  LD R3, BITMAP_HI      ; Load high byte
  INC R3            ; Increment high byte (carry propagation)
  ST R3, BITMAP_HI      ; Store back
.no_carry:
  JMP .row_loop

  .done:
  
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
    ; Decrement page counter FIRST
    DEC R4
    ; Check if done (before writing this page)
    ; If R4 was 0, it wraps to 255, and we should stop
    CMP R4, #$FF
    BRZ .done_clear

.inner:
    ST R0, [R2:R3]     ; Write byte at R2:R3
    INC R3             ; Increment low byte
    BRNZ .inner        ; Loop until R3 wraps to 0

    INC R2             ; Increment high byte (next page)
    JMP .outer

.done_clear:
    POP R4
    POP R3
    POP R2
    POP R0
    RET

; Bitmap data
digit_bitmaps:
    .word bitmap_data

bitmap_data:
    ; Space Invader sprite (8x8)
    .byte 0b00011000  ; Row 1:    **
    .byte 0b00111100  ; Row 2:   ****
    .byte 0b01111110  ; Row 3:  ******
    .byte 0b11011011  ; Row 4: ** ** **
    .byte 0b11111111  ; Row 5: ********
    .byte 0b00100100  ; Row 6:   *  *
    .byte 0b01011010  ; Row 7:  * ** *
    .byte 0b10100101  ; Row 8: * *  * *
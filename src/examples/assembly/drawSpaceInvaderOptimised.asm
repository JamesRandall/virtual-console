.org $B80
  .define SCRATCH $80
  CALL clear_screen

  LD R0,#64
  LD R1,#64
  LD R2,#2
  LD R3,#<space_invader
  LD R4,#>space_invader

  CALL draw_bitmap

infiniteloop:
  JMP infiniteloop

; OPTIMIZED draw_bitmap routine
; Key optimization: Inline the pixel drawing to avoid CALL overhead
; Inputs: R0 = X coordinate (0-255)
;         R1 = Y coordinate (0-159)
;         R2 = color (palette index 0-15)
;         R3 = bitmap lo
;         R4 = bitmap hi
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
  ADD R1,#8
  ST R1,END_Y ; end y
  ST R2,COLOUR ; colour

  ; bitmap source
  ST R3,BITMAP_LO ; bitmap lo
  ST R4,BITMAP_HI ; bitmap hi

  .row_loop:
  LD R5,[$84]       ; Load bitmap byte for this row

  .inner_loop:
  ; check see if the first bit is set, if not skip
  MOV R3,R5
  AND R3,#$80
  BRZ .next_column_far
  JMP .draw_it

.next_column_far:
  JMP .next_column

.draw_it:
  ; INLINED PIXEL DRAWING - instead of CALL draw_pixel
  ; Save registers we'll use
  PUSH R5

  ; Load coordinates and color
  LD R0,CURRENT_X
  LD R1,CURRENT_Y
  LD R2,COLOUR

  ; Bounds check Y
  CMP R1, #160
  BRC .skip_draw

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
  PUSH R0            ; Save X
  SHR R0             ; R0 = X / 2
  ADD R4, R0         ; Add to low byte
  POP R0             ; Restore X
  BRC .carry_inline
  JMP .no_carry_inline

.carry_inline:
  INC R3             ; Propagate carry to high byte

.no_carry_inline:
  ; Add framebuffer base address (0xB000) to high byte
  ADD R3, #$B0

  ; Load the current byte at this address
  PUSH R0            ; Save X again
  LD R0, [R3:R4]     ; R0 now has framebuffer byte

  ; Check if X is even or odd (in saved X on stack, need to reload)
  POP R5             ; R5 = X coordinate
  PUSH R5            ; Keep it on stack
  AND R5, #1
  BRNZ .odd_pixel_inline

  ; Even pixel: modify high nibble
  AND R0, #$0F       ; Clear high nibble
  SHL R2, #4         ; Shift color to high nibble
  OR R0, R2          ; Combine
  JMP .write_byte_inline

.odd_pixel_inline:
  ; Odd pixel: modify low nibble
  AND R0, #$F0       ; Clear low nibble
  AND R2, #$0F       ; Ensure color is only in low nibble
  OR R0, R2          ; Combine

.write_byte_inline:
  ST R0, [R3:R4]     ; Write back to framebuffer
  POP R0             ; Clean up stack (discard saved X)

.skip_draw:
  ; Restore bitmap byte
  POP R5
  ; END INLINED PIXEL DRAWING

  ; move on to the next column by incrementing current x and shifting the bit
  ; pattern left - if this value becomes 0 (no bits set) then we know we need
  ; to move to the next row
  .next_column:
  LD R0,CURRENT_X
  INC R0
  ST R0,CURRENT_X
  SHL R5
  CMP R5,#0
  BRZ .next_row
  JMP .inner_loop

  .next_row:
  ; move back to starting x
  LD R0,STARTING_X
  ST R0,CURRENT_X
  ; move the y / row on 1
  LD R0,CURRENT_Y
  INC R0
  ST R0,CURRENT_Y
  ; if the current row has reached the last row we know we're done
  LD R1,END_Y
  CMP R0,R1
  BRZ .done
  ; Add 1 to the 16-bit address at $84:$85 to point at the next
  ; byte - the next row - in the source
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

space_invader:
    ; Space Invader sprite (8x8)
    .byte 0b00011000  ; Row 1:    **
    .byte 0b00111100  ; Row 2:   ****
    .byte 0b01111110  ; Row 3:  ******
    .byte 0b11011011  ; Row 4: ** ** **
    .byte 0b11111111  ; Row 5: ********
    .byte 0b00100100  ; Row 6:   *  *
    .byte 0b01011010  ; Row 7:  * ** *
    .byte 0b10100101  ; Row 8: * *  * *
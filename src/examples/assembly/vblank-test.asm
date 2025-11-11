; VBlank Interrupt Test Program
; Demonstrates interrupt-driven programming with VBlank
;
; This program:
; 1. Sets up a VBlank interrupt handler
; 2. Enables VBlank interrupts
; 3. Main loop runs continuously (no polling)
; 4. VBlank handler increments a counter each frame (60 times per second)
; 5. Counter is displayed by changing screen colors

.org $0B80

; Constants
.define INT_STATUS $0114
.define INT_ENABLE $0115
.define VBLANK_VEC_HI $0132
.define VBLANK_VEC_LO $0133
.define PALETTE_RAM $0200
.define FRAMEBUFFER_START $B000

; Entry point
main:
    ; Set up stack pointer
    LD R0, #$FF
    ST R0, [$7F]
    LD R0, #$7F
    ST R0, [$7E]

    ; Disable interrupts during setup
    CLI

    ; Clear any pending interrupt flags
    LD R0, #$FF
    ST R0, [INT_STATUS]        ; Write all 1s to clear all flags

    ; Install VBlank interrupt vector
    LD R0, #(vblank_handler >> 8)
    ST R0, [VBLANK_VEC_HI]
    LD R0, #(vblank_handler & $FF)
    ST R0, [VBLANK_VEC_LO]

    ; Initialize frame counter at $0B00
    LD R0, #0
    ST R0, [$0B00]

    ; Set up initial palette - black background
    LD R0, #253              ; Black (palette index)
    ST R0, [PALETTE_RAM]

    ; Clear screen to black (palette color 0)
    CALL clear_screen

    ; Enable VBlank interrupt in INT_ENABLE
    LD R0, #$01
    ST R0, [INT_ENABLE]

    ; Enable interrupts in CPU
    SEI

    ; Main loop - just runs continuously
    ; No need to poll for VBlank - interrupt will fire automatically
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

    ; Clear VBlank flag (write 1 to clear)
    LD R0, #$01
    ST R0, [INT_STATUS]

    ; Increment frame counter
    LD R0, [$0B00]
    INC R0
    ST R0, [$0B00]

    ; Change palette color based on frame counter
    ; This creates a color cycling effect
    AND R0, #$FF             ; Keep in range
    ST R0, [PALETTE_RAM]     ; Update palette entry 0

    ; Draw a small indicator in top-left corner
    ; to show interrupt is firing
    LD R1, #1                ; Color 1 (white or bright)
    LD R2, #FRAMEBUFFER_START >> 8
    LD R3, #FRAMEBUFFER_START & $FF
    ST R1, [R2:R3]

    ; Restore registers
    POP R3
    POP R2
    POP R1
    POP R0

    ; Return from interrupt (restores PC and status, re-enables interrupts)
    RTI

; Subroutine: Clear screen to color 0
clear_screen:
      PUSH R0
      PUSH R2
      PUSH R3
      PUSH R4

      LD R2, #$B0        ; High byte
      LD R3, #$00        ; Low byte
      LD R4, #$50        ; 80 pages
      LD R0, #0          ; Color to write
  .outer:
  .inner:
      ST R0, [R2:R3]     ; Write byte
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
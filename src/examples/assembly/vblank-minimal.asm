; Minimal VBlank Interrupt Test
; Simplest possible interrupt test - just increments a memory location

.org $8000

main:
    ; Disable interrupts during setup
    CLI

    ; Clear any pending interrupt flags
    LD R0, #$FF
    ST R0, [$0114]           ; Clear INT_STATUS

    ; Install VBlank interrupt vector pointing to handler
    LD R0, #(vblank_handler >> 8)
    ST R0, [$0132]           ; VBLANK_VEC_HI
    LD R0, #(vblank_handler & $FF)
    ST R0, [$0133]           ; VBLANK_VEC_LO

    ; Initialize counter at $0B00 to zero
    LD R0, #0
    ST R0, [$0B00]

    ; Enable VBlank interrupt bit in INT_ENABLE
    LD R0, #$01
    ST R0, [$0115]

    ; Enable interrupts in CPU
    SEI

    ; Infinite loop - interrupt will fire automatically
loop:
    NOP
    JMP loop

; VBlank interrupt handler - called 60 times per second
vblank_handler:
    PUSH R0

    ; Clear VBlank flag
    LD R0, #$01
    ST R0, [$0114]

    ; Increment counter
    LD R0, [$0B00]
    INC R0
    ST R0, [$0B00]

    POP R0
    RTI

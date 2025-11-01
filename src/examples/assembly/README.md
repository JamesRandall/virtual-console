# Assembly Examples

This directory contains example assembly programs for the Virtual Console.

## VBlank Interrupt Examples

### vblank-minimal.asm
The simplest possible VBlank interrupt test program.

**What it does:**
- Sets up a VBlank interrupt handler
- Increments a counter at memory address 0x0B00 sixty times per second
- Demonstrates basic interrupt-driven programming

**How to use:**
1. Load the program in the devkit
2. Set a memory watch on address 0x0B00
3. Run the program
4. Observe the counter incrementing at 60Hz

**What to expect:**
- Counter at 0x0B00 should increment from 0 to 255, then wrap to 0
- Counter increments exactly 60 times per second (once per frame)
- Main loop runs continuously with no polling

### vblank-test.asm
A more complete VBlank interrupt demonstration.

**What it does:**
- Sets up a VBlank interrupt handler
- Increments a frame counter
- Creates a color cycling effect by changing the palette
- Clears the screen to black on startup
- Demonstrates proper register saving/restoring

**How to use:**
1. Load the program in the devkit
2. Run the program
3. Watch the screen colors cycle automatically

**What to expect:**
- Screen colors will cycle through the Tailwind palette at 60Hz
- Small indicator pixel in top-left corner shows interrupt is firing
- No CPU polling - interrupts drive all updates

## Memory Locations Used

- **0x0B00**: Frame counter (incremented each VBlank)
- **0x0114**: INT_STATUS register (interrupt status flags)
- **0x0115**: INT_ENABLE register (interrupt enable control)
- **0x0132-0x0133**: VBLANK_VEC (VBlank handler address)
- **0x0200+**: Palette RAM
- **0xB000+**: Framebuffer (Mode 0)

## Interrupt Programming Concepts

### Setting Up Interrupts
1. Write handler address to interrupt vector (0x0132-0x0133)
2. Enable interrupt in INT_ENABLE (0x0115)
3. Enable interrupts in CPU with SEI instruction

### Writing an Interrupt Handler
1. Save registers you'll use (PUSH)
2. Clear interrupt flag in INT_STATUS (write 1 to clear)
3. Do time-critical work
4. Restore registers (POP)
5. Return with RTI (not RET!)

### Important Notes
- Always clear the interrupt flag or it will fire again immediately
- Always use RTI (not RET) to return from interrupt handlers
- RTI restores the status register and re-enables interrupts
- Keep handlers short - you have ~16.67ms per frame at 60Hz
- Save/restore any registers you modify

## Comparison: Interrupt vs Polling

### Interrupt-Driven (vblank-test.asm)
```assembly
; Setup interrupt handler
LD R0, #(vblank_handler & $FF)
ST R0, [$0132]
LD R0, #(vblank_handler >> 8)
ST R0, [$0133]

SEI                    ; Enable interrupts
main_loop:
    ; Game logic runs continuously
    CALL update_game
    JMP main_loop

vblank_handler:
    ; Called automatically 60 times/sec
    CALL update_display
    RTI
```

**Advantages:**
- CPU efficient (no waiting)
- Precise 60Hz timing
- Matches real console hardware
- Better code organization

### Polling (older approach)
```assembly
main_loop:
    ; Wait for VBlank
    wait_loop:
        LD R0, [$0114]
        AND R0, #$01
        BRZ wait_loop

    ; Clear flag and update
    LD R0, #$01
    ST R0, [$0114]
    CALL update_game
    JMP main_loop
```

**Disadvantages:**
- Wastes ~40,000 cycles per frame waiting
- Less efficient
- Harder to maintain timing
- Doesn't match real hardware

## Other Examples

### smiley2.asm
A graphical demo that draws a smiley face. Demonstrates:
- Drawing to the framebuffer
- Palette manipulation
- Pixel plotting

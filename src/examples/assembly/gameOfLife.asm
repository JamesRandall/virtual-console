; Conway's Game of Life
; 16x16 grid, each cell is 8x8 pixels
; Video Mode 0: 256x160 @ 4bpp
; White cells = alive, dark gray cells = dead
; Uses VBlank interrupt for smooth animation
; Line 179ish (init_grid) you can change the starting map

.org $0B80

; Constants
.define VIDEO_MODE $0101
.define PALETTE_RAM $0200
.define FRAMEBUFFER_START $B000
.define INT_STATUS $0114
.define INT_ENABLE $0115
.define VBLANK_VEC_HI $0132
.define VBLANK_VEC_LO $0133

; Colors
.define COLOR_BLACK 0
.define COLOR_WHITE 1
.define COLOR_DARK_GRAY 3

; Grid constants
.define GRID_SIZE 16
.define CELL_SIZE 8

; RAM locations
.define GRID_A $0900        ; Current generation (256 bytes)
.define GRID_B $0A00        ; Next generation (256 bytes)
.define FRAME_DELAY $0B00   ; Frame counter for animation speed
.define DELAY_TARGET 10     ; Wait 10 frames between updates (~6 updates/sec)

; Entry point
main:
    ; Disable interrupts during setup
    CLI

    ; Set video mode to 0 (256x160 @ 4bpp)
    LD R0, #0
    ST R0, [VIDEO_MODE]

    ; Setup palette
    CALL setup_palette

    ; Initialize grids
    CALL init_grids

    ; Initialize frame delay counter
    LD R0, #0
    ST R0, [FRAME_DELAY]

    ; Clear screen to black
    CALL clear_screen

    ; Draw initial state
    CALL draw_grid

    ; Clear any pending interrupt flags
    LD R0, #$FF
    ST R0, [INT_STATUS]

    ; Install VBlank interrupt vector
    LD R0, #(vblank_handler >> 8)
    ST R0, [VBLANK_VEC_HI]
    LD R0, #(vblank_handler & $FF)
    ST R0, [VBLANK_VEC_LO]

    ; Enable VBlank interrupt
    LD R0, #$01
    ST R0, [INT_ENABLE]

    ; Enable interrupts in CPU
    SEI

    ; Main loop - just wait for interrupts
main_loop:
    NOP
    NOP
    JMP main_loop

; VBlank interrupt handler - updates game state
vblank_handler:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5

    ; Clear VBlank flag
    LD R0, #$01
    ST R0, [INT_STATUS]

    ; Increment frame delay counter
    LD R0, [FRAME_DELAY]
    INC R0
    ST R0, [FRAME_DELAY]

    ; Check if we should update
    CMP R0, #DELAY_TARGET
    BRC .do_update
    JMP .done

.do_update:
    ; Reset counter
    LD R0, #0
    ST R0, [FRAME_DELAY]

    ; Calculate next generation
    CALL calc_next_generation

    ; Copy GRID_B to GRID_A
    CALL swap_grids

    ; Redraw the grid
    CALL draw_grid

.done:
    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RTI

; Setup palette
setup_palette:
    PUSH R0

    ; Color 0: Black
    LD R0, #253
    ST R0, [PALETTE_RAM]

    ; Color 1: White
    LD R0, #255
    ST R0, [PALETTE_RAM + 1]

    ; Color 3: Dark Gray
    LD R0, #229
    ST R0, [PALETTE_RAM + 3]

    POP R0
    RET

; Initialize grids with a classic pattern (glider)
init_grids:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3

    ; Clear both grids
    LD R0, #(GRID_A >> 8)
    LD R1, #(GRID_A & $FF)
    LD R2, #0
    LD R3, #0          ; Counter (256 bytes to clear)

.clear_loop:
    ST R2, [R0:R1]
    INC R1
    BRNZ .clear_loop   ; Loop until wrapped (256 iterations)

    ; Repeat for GRID_B
    LD R0, #(GRID_B >> 8)
    LD R1, #(GRID_B & $FF)

.clear_loop2:
    ST R2, [R0:R1]
    INC R1
    BRNZ .clear_loop2

    ; Add a glider pattern in the center-ish area
    ; Pattern at position (5,5):
    ;   .X.
    ;   ..X
    ;   XXX

    ; Toggler
    LD R0, #5
    LD R1, #5
    LD R2, #1
    CALL set_cell
    LD R0, #6
    LD R1, #5
    LD R2, #1
    CALL set_cell
    LD R0, #7
    LD R1, #5
    LD R2, #1
    CALL set_cell
    LD R0, #6
    LD R1, #6
    LD R2, #1
    CALL set_cell

    ; Walker
    ; (6, 5) = alive
    ;LD R0, #6
    ;LD R1, #5
    ;LD R2, #1
    ;CALL set_cell
    ; (7, 6) = alive
    ;LD R0, #7
    ;LD R1, #6
    ;LD R2, #1
    ;CALL set_cell
    ; (5, 7) = alive
    ;LD R0, #5
    ;LD R1, #7
    ;LD R2, #1
    ;CALL set_cell
    ; (6, 7) = alive
    ;LD R0, #6
    ;LD R1, #7
    ;LD R2, #1
    ;CALL set_cell
    ; (7, 7) = alive
    ;LD R0, #7
    ;LD R1, #7
    ;LD R2, #1
    ;CALL set_cell

    POP R3
    POP R2
    POP R1
    POP R0
    RET

; Set a cell in GRID_A
; Inputs: R0 = x, R1 = y, R2 = value (0 or 1)
set_cell:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5

    ; Calculate offset: (y * 16) + x
    MOV R3, R1
    SHL R3
    SHL R3
    SHL R3
    SHL R3             ; R3 = y * 16
    ADD R3, R0         ; R3 = (y * 16) + x

    ; Calculate address: GRID_A + offset
    ; Use R4:R5 for address
    LD R4, #(GRID_A >> 8)
    LD R5, #(GRID_A & $FF)
    ADD R5, R3         ; Add offset to low byte
    BRC .carry
    JMP .no_carry
.carry:
    INC R4
.no_carry:

    ; Store value
    ST R2, [R4:R5]

    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RET

; Calculate next generation using Game of Life rules
calc_next_generation:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5

    ; Iterate through all cells
    LD R4, #0          ; y coordinate

.y_loop:
    CMP R4, #GRID_SIZE
    BRZ .done_y

    LD R5, #0          ; x coordinate

.x_loop:
    CMP R5, #GRID_SIZE
    BRZ .done_x

    ; Get current cell state
    MOV R0, R5         ; x
    MOV R1, R4         ; y
    CALL get_cell      ; Returns state in R0

    PUSH R0            ; Save current state

    ; Count neighbors
    MOV R0, R5         ; x
    MOV R1, R4         ; y
    CALL count_neighbors ; Returns count in R0

    POP R1             ; R1 = current state

    ; Apply rules:
    ; - Alive (1) + 2 or 3 neighbors -> stays alive
    ; - Dead (0) + exactly 3 neighbors -> becomes alive
    ; - Otherwise -> dead

    CMP R1, #1
    BRZ .cell_alive

.cell_dead:
    ; Dead cell - becomes alive only with 3 neighbors
    CMP R0, #3
    BRZ .new_alive
    JMP .new_dead

.cell_alive:
    ; Alive cell - stays alive with 2 or 3 neighbors
    CMP R0, #2
    BRZ .new_alive
    CMP R0, #3
    BRZ .new_alive
    JMP .new_dead

.new_alive:
    LD R2, #1
    JMP .store_new

.new_dead:
    LD R2, #0

.store_new:
    ; Store in GRID_B
    MOV R0, R5         ; x
    MOV R1, R4         ; y
    CALL set_cell_b

    ; Next x
    INC R5
    JMP .x_loop

.done_x:
    ; Next y
    INC R4
    JMP .y_loop

.done_y:
    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RET

; Get cell value from GRID_A
; Inputs: R0 = x, R1 = y
; Returns: R0 = value (0 or 1)
get_cell:
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5

    ; Calculate offset: (y * 16) + x
    MOV R2, R1
    SHL R2
    SHL R2
    SHL R2
    SHL R2             ; R2 = y * 16
    ADD R2, R0         ; R2 = (y * 16) + x

    ; Calculate address using R4:R5
    LD R4, #(GRID_A >> 8)
    LD R5, #(GRID_A & $FF)
    ADD R5, R2
    BRC .carry
    JMP .no_carry
.carry:
    INC R4
.no_carry:

    ; Load value
    LD R0, [R4:R5]

    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    RET

; Set cell value in GRID_B
; Inputs: R0 = x, R1 = y, R2 = value
set_cell_b:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5

    ; Calculate offset: (y * 16) + x
    MOV R3, R1
    SHL R3
    SHL R3
    SHL R3
    SHL R3             ; R3 = y * 16
    ADD R3, R0         ; R3 = (y * 16) + x

    ; Calculate address using R4:R5
    LD R4, #(GRID_B >> 8)
    LD R5, #(GRID_B & $FF)
    ADD R5, R3
    BRC .carry
    JMP .no_carry
.carry:
    INC R4
.no_carry:

    ; Store value
    ST R2, [R4:R5]

    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RET

; Count living neighbors for a cell
; Inputs: R0 = x, R1 = y
; Returns: R0 = count (0-8)
count_neighbors:
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5

    MOV R3, R0         ; Save x
    MOV R4, R1         ; Save y
    LD R5, #0          ; Count

    ; Check all 8 neighbors
    ; Top-left (-1, -1)
    MOV R0, R3
    MOV R1, R4
    DEC R0
    DEC R1
    CALL check_neighbor
    ADD R5, R0

    ; Top (0, -1)
    MOV R0, R3
    MOV R1, R4
    DEC R1
    CALL check_neighbor
    ADD R5, R0

    ; Top-right (1, -1)
    MOV R0, R3
    MOV R1, R4
    INC R0
    DEC R1
    CALL check_neighbor
    ADD R5, R0

    ; Left (-1, 0)
    MOV R0, R3
    MOV R1, R4
    DEC R0
    CALL check_neighbor
    ADD R5, R0

    ; Right (1, 0)
    MOV R0, R3
    MOV R1, R4
    INC R0
    CALL check_neighbor
    ADD R5, R0

    ; Bottom-left (-1, 1)
    MOV R0, R3
    MOV R1, R4
    DEC R0
    INC R1
    CALL check_neighbor
    ADD R5, R0

    ; Bottom (0, 1)
    MOV R0, R3
    MOV R1, R4
    INC R1
    CALL check_neighbor
    ADD R5, R0

    ; Bottom-right (1, 1)
    MOV R0, R3
    MOV R1, R4
    INC R0
    INC R1
    CALL check_neighbor
    ADD R5, R0

    MOV R0, R5         ; Return count

    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    RET

; Check if a neighbor is alive (with bounds checking)
; Inputs: R0 = x, R1 = y
; Returns: R0 = 1 if alive, 0 otherwise
check_neighbor:
    PUSH R1
    PUSH R2

    ; Check bounds (0 <= x < 16 and 0 <= y < 16)
    ; Check if x >= 16 (unsigned)
    CMP R0, #GRID_SIZE
    BRC .out_of_bounds

    ; Check if y >= 16 (unsigned)
    CMP R1, #GRID_SIZE
    BRC .out_of_bounds

    ; In bounds, get cell value
    CALL get_cell
    JMP .done

.out_of_bounds:
    LD R0, #0

.done:
    POP R2
    POP R1
    RET

; Copy GRID_B to GRID_A
swap_grids:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4

    LD R0, #(GRID_B >> 8)
    LD R1, #(GRID_B & $FF)
    LD R2, #(GRID_A >> 8)
    LD R3, #(GRID_A & $FF)
    LD R4, #0          ; Counter

.copy_loop:
    LD R5, [R0:R1]     ; Load from GRID_B
    ST R5, [R2:R3]     ; Store to GRID_A

    ; Increment addresses
    INC R1
    BRNZ .no_carry1
    INC R0
.no_carry1:

    INC R3
    BRNZ .no_carry2
    INC R2
.no_carry2:

    INC R4
    BRNZ .copy_loop    ; Loop 256 times

    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RET

; Draw the entire grid
draw_grid:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4

    LD R3, #0          ; y coordinate

.y_loop:
    CMP R3, #GRID_SIZE
    BRZ .done_y

    LD R4, #0          ; x coordinate

.x_loop:
    CMP R4, #GRID_SIZE
    BRZ .done_x

    ; Get cell state
    MOV R0, R4
    MOV R1, R3
    CALL get_cell

    ; Choose color based on state
    CMP R0, #1
    BRZ .alive
    LD R2, #COLOR_DARK_GRAY
    JMP .draw_cell
.alive:
    LD R2, #COLOR_WHITE

.draw_cell:
    ; Draw 8x8 cell
    MOV R0, R4         ; x
    MOV R1, R3         ; y
    CALL draw_cell_8x8

    ; Next x
    INC R4
    JMP .x_loop

.done_x:
    ; Next y
    INC R3
    JMP .y_loop

.done_y:
    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RET

; Draw an 8x8 cell at grid position (x, y)
; Inputs: R0 = grid x, R1 = grid y, R2 = color
draw_cell_8x8:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5

    ; Convert grid coords to pixel coords
    ; pixel_x = grid_x * 8
    MOV R3, R0
    SHL R3
    SHL R3
    SHL R3             ; R3 = pixel x start

    ; pixel_y = grid_y * 8
    MOV R4, R1
    SHL R4
    SHL R4
    SHL R4             ; R4 = pixel y start

    MOV R5, R2         ; Save color

    ; Draw 8x8 pixels
    LD R1, #0          ; dy counter

.y_loop:
    CMP R1, #CELL_SIZE
    BRZ .done_y

    LD R0, #0          ; dx counter

.x_loop:
    CMP R0, #CELL_SIZE
    BRZ .done_x

    ; Calculate actual pixel position
    PUSH R0
    PUSH R1
    MOV R2, R3
    ADD R2, R0         ; pixel_x = start_x + dx
    MOV R0, R2

    MOV R2, R4
    ADD R2, R1         ; pixel_y = start_y + dy
    MOV R1, R2

    MOV R2, R5         ; color
    CALL draw_pixel

    POP R1
    POP R0

    INC R0
    JMP .x_loop

.done_x:
    INC R1
    JMP .y_loop

.done_y:
    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RET

; Clear screen to black
clear_screen:
    PUSH R0
    PUSH R2
    PUSH R3
    PUSH R4

    LD R2, #$B0        ; High byte of framebuffer
    LD R3, #$00        ; Low byte
    LD R4, #$50        ; 80 pages
    LD R0, #0          ; Black

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

; Draw pixel subroutine (from reference example)
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
    LD R3, #0
    MOV R4, R1

    ; Multiply Y by 128 (shift left 7 times)
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

    ; Load current byte
    LD R5, [R3:R4]

    ; Check if X is even or odd
    AND R0, #1
    BRNZ .odd_pixel

    ; Even pixel: high nibble
    AND R5, #$0F
    SHL R2, #4
    OR R5, R2
    JMP .write_byte

.odd_pixel:
    ; Odd pixel: low nibble
    AND R5, #$F0
    AND R2, #$0F
    OR R5, R2

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

; Conway's Game of Life - OPTIMIZED (FIXED)
; Only redraws changed cells!
; I asked the AI Assistant to calculate how many cycles were used for each turn
; and discovered that most of the time was spent in the rendering as it drew every
; cell every time.
; I then asked the AI to optimize the rendering for only changed cells.
; Its first effort had some garbled output. I paused it, asked it to look at the screen
; capture and see if it could fix it
; And it fixed it!

.org $0B80

.define VIDEO_MODE $0101
.define PALETTE_RAM $0200
.define INT_STATUS $0114
.define INT_ENABLE $0115
.define VBLANK_VEC_LO $0132
.define VBLANK_VEC_HI $0133
.define COLOR_WHITE 1
.define COLOR_DARK_GRAY 3
.define GRID_SIZE 16
.define CELL_SIZE 8
.define GRID_A $0900
.define GRID_B $0A00
.define FRAME_DELAY $0B00
.define CHANGED_COUNT $0B02
.define CHANGED_LIST $0B03
.define DELAY_TARGET 10

main:
    CLI
    LD R0, #0
    ST R0, [VIDEO_MODE]
    CALL setup_palette
    CALL init_grids
    LD R0, #0
    ST R0, [FRAME_DELAY]
    CALL clear_screen
    CALL draw_grid_full
    LD R0, #$FF
    ST R0, [INT_STATUS]
    LD R0, #(vblank_handler & $FF)
    ST R0, [VBLANK_VEC_LO]
    LD R0, #(vblank_handler >> 8)
    ST R0, [VBLANK_VEC_HI]
    LD R0, #$01
    ST R0, [INT_ENABLE]
    SEI

main_loop:
    NOP
    NOP
    JMP main_loop

vblank_handler:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5
    LD R0, #$01
    ST R0, [INT_STATUS]
    LD R0, [FRAME_DELAY]
    INC R0
    ST R0, [FRAME_DELAY]
    CMP R0, #DELAY_TARGET
    BRC .do_update
    JMP .done
.do_update:
    LD R0, #0
    ST R0, [FRAME_DELAY]
    CALL calc_next_generation
    CALL swap_track
    CALL draw_changed
.done:
    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RTI

setup_palette:
    PUSH R0
    LD R0, #253
    ST R0, [PALETTE_RAM]
    LD R0, #255
    ST R0, [PALETTE_RAM + 1]
    LD R0, #229
    ST R0, [PALETTE_RAM + 3]
    POP R0
    RET

init_grids:
    PUSH R0
    PUSH R1
    PUSH R2
    LD R0, #(GRID_A >> 8)
    LD R1, #(GRID_A & $FF)
    LD R2, #0
.clear_loop:
    ST R2, [R0:R1]
    INC R1
    BRNZ .clear_loop
    LD R0, #(GRID_B >> 8)
    LD R1, #(GRID_B & $FF)
.clear_loop2:
    ST R2, [R0:R1]
    INC R1
    BRNZ .clear_loop2
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
    POP R2
    POP R1
    POP R0
    RET

set_cell:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5
    MOV R3, R1
    SHL R3
    SHL R3
    SHL R3
    SHL R3
    ADD R3, R0
    LD R4, #(GRID_A >> 8)
    LD R5, #(GRID_A & $FF)
    ADD R5, R3
    BRC .carry
    JMP .no_carry
.carry:
    INC R4
.no_carry:
    ST R2, [R4:R5]
    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RET

calc_next_generation:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5
    LD R4, #0
.y_loop:
    CMP R4, #GRID_SIZE
    BRZ .done_y
    LD R5, #0
.x_loop:
    CMP R5, #GRID_SIZE
    BRZ .done_x
    MOV R0, R5
    MOV R1, R4
    CALL get_cell
    PUSH R0
    MOV R0, R5
    MOV R1, R4
    CALL count_neighbors
    POP R1
    CMP R1, #1
    BRZ .cell_alive
.cell_dead:
    CMP R0, #3
    BRZ .new_alive
    JMP .new_dead
.cell_alive:
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
    MOV R0, R5
    MOV R1, R4
    CALL set_cell_b
    INC R5
    JMP .x_loop
.done_x:
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

get_cell:
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5
    MOV R2, R1
    SHL R2
    SHL R2
    SHL R2
    SHL R2
    ADD R2, R0
    LD R4, #(GRID_A >> 8)
    LD R5, #(GRID_A & $FF)
    ADD R5, R2
    BRC .carry
    JMP .no_carry
.carry:
    INC R4
.no_carry:
    LD R0, [R4:R5]
    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    RET

set_cell_b:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5
    MOV R3, R1
    SHL R3
    SHL R3
    SHL R3
    SHL R3
    ADD R3, R0
    LD R4, #(GRID_B >> 8)
    LD R5, #(GRID_B & $FF)
    ADD R5, R3
    BRC .carry
    JMP .no_carry
.carry:
    INC R4
.no_carry:
    ST R2, [R4:R5]
    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RET

count_neighbors:
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5
    MOV R3, R0
    MOV R4, R1
    LD R5, #0
    MOV R0, R3
    MOV R1, R4
    DEC R0
    DEC R1
    CALL check_neighbor
    ADD R5, R0
    MOV R0, R3
    MOV R1, R4
    DEC R1
    CALL check_neighbor
    ADD R5, R0
    MOV R0, R3
    MOV R1, R4
    INC R0
    DEC R1
    CALL check_neighbor
    ADD R5, R0
    MOV R0, R3
    MOV R1, R4
    DEC R0
    CALL check_neighbor
    ADD R5, R0
    MOV R0, R3
    MOV R1, R4
    INC R0
    CALL check_neighbor
    ADD R5, R0
    MOV R0, R3
    MOV R1, R4
    DEC R0
    INC R1
    CALL check_neighbor
    ADD R5, R0
    MOV R0, R3
    MOV R1, R4
    INC R1
    CALL check_neighbor
    ADD R5, R0
    MOV R0, R3
    MOV R1, R4
    INC R0
    INC R1
    CALL check_neighbor
    ADD R5, R0
    MOV R0, R5
    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    RET

check_neighbor:
    PUSH R1
    PUSH R2
    CMP R0, #GRID_SIZE
    BRC .out_of_bounds
    CMP R1, #GRID_SIZE
    BRC .out_of_bounds
    CALL get_cell
    JMP .done
.out_of_bounds:
    LD R0, #0
.done:
    POP R2
    POP R1
    RET

; Swap grids and track changes - PROPERLY FIXED
swap_track:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5

    ; Init change count to 0
    LD R0, #0
    ST R0, [CHANGED_COUNT]

    ; Setup grid pointers
    LD R0, #(GRID_A >> 8)
    LD R1, #(GRID_A & $FF)
    LD R2, #(GRID_B >> 8)
    LD R3, #(GRID_B & $FF)

    ; Cell counter
    LD R4, #0

.loop:
    ; Load values from both grids
    LD R5, [R0:R1]      ; Load from GRID_A (old value)
    PUSH R5
    LD R5, [R2:R3]      ; Load from GRID_B (new value)
    POP R0              ; Get old value back

    ; Compare old vs new
    CMP R0, R5
    BRZ .same

    ; They're different! Track this change
    ; Save all our state
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5

    ; Calculate x,y from cell index R4
    MOV R0, R4
    AND R0, #15         ; x = R4 & 15
    MOV R1, R4
    SHR R1
    SHR R1
    SHR R1
    SHR R1              ; y = R4 >> 4

    ; Get current change count and calculate list offset
    LD R2, [CHANGED_COUNT]
    MOV R3, R2
    ADD R3, R3          ; offset = count * 2

    ; Calculate list address
    LD R4, #(CHANGED_LIST >> 8)
    LD R5, #(CHANGED_LIST & $FF)
    ADD R5, R3
    BRC .c1
    JMP .nc1
.c1:
    INC R4
.nc1:
    ; Store x coordinate
    ST R0, [R4:R5]

    ; Increment to next position
    INC R5
    BRNZ .nc2
    INC R4
.nc2:
    ; Store y coordinate
    ST R1, [R4:R5]

    ; Increment change count
    INC R2
    ST R2, [CHANGED_COUNT]

    ; Restore all state
    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    POP R0

.same:
    ; Now copy new value (R5) to GRID_A
    ; Need to restore grid pointers first
    LD R0, #(GRID_A >> 8)
    LD R1, #(GRID_A & $FF)
    ADD R1, R4
    BRNZ .nc3
    INC R0
.nc3:

    ; Store new value to GRID_A
    ST R5, [R0:R1]

    ; Restore pointers for next iteration
    LD R0, #(GRID_A >> 8)
    LD R1, #(GRID_A & $FF)
    LD R2, #(GRID_B >> 8)
    LD R3, #(GRID_B & $FF)

    ; Advance to next cell
    INC R4

    ; Add offsets to pointers
    ADD R1, R4
    BRNZ .nc4
    INC R0
.nc4:
    ADD R3, R4
    BRNZ .nc5
    INC R2
.nc5:

    ; Check if done (counter wrapped to 0)
    CMP R4, #0
    BRNZ .continue
    JMP .done
.continue:
    JMP .loop

.done:
    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RET

draw_changed:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5
    LD R5, [CHANGED_COUNT]
    CMP R5, #0
    BRNZ .has
    JMP .exit
.has:
    LD R4, #0
    LD R2, #(CHANGED_LIST >> 8)
    LD R3, #(CHANGED_LIST & $FF)
.loop:
    LD R0, [R2:R3]
    INC R3
    BRNZ .nc1
    INC R2
.nc1:
    LD R1, [R2:R3]
    INC R3
    BRNZ .nc2
    INC R2
.nc2:
    CALL draw_one
    INC R4
    CMP R4, R5
    BRNZ .cont
    JMP .exit
.cont:
    JMP .loop
.exit:
    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RET

draw_one:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5
    MOV R3, R0
    MOV R4, R1
    CALL get_cell
    CMP R0, #1
    BRNZ .dead
    LD R2, #COLOR_WHITE
    JMP .draw
.dead:
    LD R2, #COLOR_DARK_GRAY
.draw:
    MOV R0, R3
    MOV R1, R4
    CALL draw_cell_8x8
    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RET

draw_grid_full:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    LD R3, #0
.y_loop:
    CMP R3, #GRID_SIZE
    BRZ .done_y
    LD R4, #0
.x_loop:
    CMP R4, #GRID_SIZE
    BRZ .done_x
    MOV R0, R4
    MOV R1, R3
    CALL draw_one
    INC R4
    JMP .x_loop
.done_x:
    INC R3
    JMP .y_loop
.done_y:
    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RET

draw_cell_8x8:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5
    MOV R3, R0
    SHL R3
    SHL R3
    SHL R3
    MOV R4, R1
    SHL R4
    SHL R4
    SHL R4
    MOV R5, R2
    LD R1, #0
.y_loop:
    CMP R1, #CELL_SIZE
    BRZ .done_y
    LD R0, #0
.x_loop:
    CMP R0, #CELL_SIZE
    BRZ .done_x
    PUSH R0
    PUSH R1
    MOV R2, R3
    ADD R2, R0
    MOV R0, R2
    MOV R2, R4
    ADD R2, R1
    MOV R1, R2
    MOV R2, R5
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

draw_pixel:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5
    CMP R1, #160
    BRC .exit
    LD R3, #0
    MOV R4, R1
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
    MOV R5, R0
    SHR R5
    ADD R4, R5
    BRC .carry
    JMP .no_carry
.carry:
    INC R3
.no_carry:
    ADD R3, #$B0
    LD R5, [R3:R4]
    AND R0, #1
    BRNZ .odd_pixel
    AND R5, #$0F
    SHL R2, #4
    OR R5, R2
    JMP .write_byte
.odd_pixel:
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

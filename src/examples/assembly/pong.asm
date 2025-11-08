; Pong Game - Player vs AI
; Left paddle (blue) controlled by player
; Right paddle (red) controlled by AI
; Video Mode 0: 256x160 @ 4bpp
;
; Controls:
;   - D-pad Up: Move player paddle up
;   - D-pad Down: Move player paddle down

.org $0B80

; Hardware registers
.define VIDEO_MODE $0101
.define PALETTE_RAM $0200
.define CONTROLLER_1 $0136
.define INT_STATUS $0114
.define INT_ENABLE $0115
.define VBLANK_VEC_LO $0132
.define VBLANK_VEC_HI $0133
.define SCANLINE_CURRENT $0103

; Controller button masks
.define CTRL_UP $80
.define CTRL_DOWN $40

; Colors
.define COLOR_BLACK 0
.define COLOR_WHITE 1
.define COLOR_BLUE 2
.define COLOR_RED 3
.define COLOR_DARK_GREEN 4

; Paddle parameters
.define PADDLE_WIDTH 4
.define PADDLE_HEIGHT 24
.define PADDLE_SPEED 2              ; Pixels per frame
.define PLAYER_PADDLE_X 4          ; Player paddle on left
.define AI_PADDLE_X 248            ; AI paddle on right (256 - 4 - 4)
.define AI_OFFSET 6                 ; AI aims for this many pixels above ball center

; Ball parameters
.define BALL_SIZE 4
.define BALL_SPEED 3                ; Horizontal speed in pixels per frame
.define BALL_START_X_PLAYER 16      ; Start near player paddle
.define BALL_START_X_AI 232         ; Start near AI paddle (256 - 16 - 8)

; Center line parameters
.define CENTER_X 128
.define DASH_LENGTH 6
.define DASH_GAP 4

; RAM locations for player paddle position
.define PLAYER_PADDLE_Y $0B00
.define OLD_PLAYER_PADDLE_Y $0B01

; RAM locations for AI paddle position
.define AI_PADDLE_Y $0B02
.define OLD_AI_PADDLE_Y $0B03

; RAM locations for ball position (8-bit integer parts)
.define BALL_X $0B04
.define BALL_Y $0B05
.define OLD_BALL_X $0B06
.define OLD_BALL_Y $0B07

; RAM locations for ball velocity (signed 8-bit)
.define BALL_VX $0B08       ; X velocity (signed: positive = right, negative = left)
.define BALL_VY $0B09       ; Y velocity (signed: positive = down, negative = up)

; RAM for sub-pixel precision
.define BALL_X_FRAC $0B0A
.define BALL_Y_FRAC $0B0B

; Random seed
.define RAND_SEED $0B0C

; AI lag flag: 0 = can track ball, 1 = waiting for player to hit
.define AI_WAITING $0B0D

; Score tracking
.define PLAYER_SCORE $0B0E
.define AI_SCORE $0B0F

; Scratch memory for draw_bitmap and draw_digit
.define SCRATCH $80

; Entry point
main:
    ; Disable interrupts during setup
    CLI

    ; Set video mode to 0 (256x160 @ 4bpp)
    LD R0, #0
    ST R0, [VIDEO_MODE]

    ; Setup palette
    CALL setup_palette

    ; Initialize player paddle position to center vertically
    LD R0, #68
    ST R0, [PLAYER_PADDLE_Y]

    ; Initialize AI paddle position to center vertically
    LD R0, #68
    ST R0, [AI_PADDLE_Y]

    ; Initialize AI waiting flag to 0 (can track)
    LD R0, #0
    ST R0, [AI_WAITING]

    ; Initialize scores to 0
    LD R0, #0
    ST R0, [PLAYER_SCORE]
    ST R0, [AI_SCORE]

    ; Clear screen to black
    CALL clear_screen

    ; Draw center line (net)
    CALL draw_center_line

    ; Draw initial scores
    CALL draw_scores

    ; Draw initial paddles
    CALL draw_player_paddle
    CALL draw_ai_paddle

    ; Initialize ball at player side
    LD R0, #0           ; 0 = AI serves (left direction)
    CALL reset_ball

    ; Draw initial ball (using XOR)
    ;CALL draw_ball_xor

    ; Clear any pending interrupt flags
    LD R0, #$FF
    ST R0, [INT_STATUS]

    ; Install VBlank interrupt vector
    LD R0, #(vblank_handler & $FF)
    ST R0, [VBLANK_VEC_LO]
    LD R0, #(vblank_handler >> 8)
    ST R0, [VBLANK_VEC_HI]

    ; Enable VBlank interrupt
    LD R0, #$01
    ST R0, [INT_ENABLE]

    ; Enable interrupts in CPU
    SEI

    ; Main loop - wait for interrupts
main_loop:
    NOP
    NOP
    JMP main_loop

; Draw dashed center line (net)
; Draws vertical dashed line down the center of the screen in dark green
draw_center_line:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3

    LD R0, #CENTER_X    ; X position (center of screen)
    LD R1, #0           ; Start Y position
    LD R2, #COLOR_DARK_GREEN

.draw_dash:
    ; Draw a dash (DASH_LENGTH pixels)
    LD R3, #0           ; Counter for this dash
.dash_loop:
    CMP R3, #DASH_LENGTH
    BRZ .skip_gap       ; Finished this dash, skip the gap

    ; Check if we've reached bottom of screen
    CMP R1, #160
    BRC .done           ; Past bottom of screen

    PUSH R3
    CALL draw_pixel
    POP R3

    INC R1              ; Move to next Y
    INC R3              ; Increment dash counter
    JMP .dash_loop

.skip_gap:
    ; Skip gap (DASH_GAP pixels)
    LD R3, #0           ; Counter for gap
.gap_loop:
    CMP R3, #DASH_GAP
    BRZ .draw_dash      ; Finished gap, draw next dash

    INC R1              ; Move to next Y
    INC R3              ; Increment gap counter

    ; Check if we've reached bottom of screen
    CMP R1, #160
    BRC .done

    JMP .gap_loop

.done:
    POP R3
    POP R2
    POP R1
    POP R0
    RET

; Reset ball position and velocity
; Input: R0 = serve direction (1 = serve right/player serves, 0 = serve left/AI serves)
reset_ball:
    PUSH R0
    PUSH R1
    PUSH R2

    MOV R2, R0          ; Save serve direction

    ; Set ball X position based on who serves
    CMP R2, #0
    BRZ .ai_serves

    ; Player serves (from left)
    LD R0, #BALL_START_X_PLAYER
    ST R0, [BALL_X]
    ST R0, [OLD_BALL_X]     ; Initialize old position too
    LD R0, [PLAYER_PADDLE_Y]
    ADD R0, #12         ; Center on paddle
    ST R0, [BALL_Y]
    ST R0, [OLD_BALL_Y]     ; Initialize old position too
    LD R0, #BALL_SPEED  ; X velocity = right
    ST R0, [BALL_VX]
    JMP .set_y_velocity

.ai_serves:
    ; AI serves (from right)
    LD R0, #BALL_START_X_AI
    ST R0, [BALL_X]
    ST R0, [OLD_BALL_X]     ; Initialize old position too
    LD R0, [AI_PADDLE_Y]
    ADD R0, #12         ; Center on paddle
    ST R0, [BALL_Y]
    ST R0, [OLD_BALL_Y]     ; Initialize old position too
    LD R0, #BALL_SPEED
    XOR R0, #$FF        ; Negate for leftward
    ADD R0, #1
    ST R0, [BALL_VX]

.set_y_velocity:
    ; Initialize fractional parts to 0
    LD R0, #0
    ST R0, [BALL_X_FRAC]
    ST R0, [BALL_Y_FRAC]

    ; Generate random Y velocity based on scanline counter
    LD R0, [SCANLINE_CURRENT]
    ST R0, [RAND_SEED]

    AND R0, #$03
    SUB R0, #2          ; Range -2 to +1

    ; If zero, make it 1
    BRNZ .vy_ok
    LD R0, #1
.vy_ok:
    ST R0, [BALL_VY]

    POP R2
    POP R1
    POP R0
    RET

; Calculate new Y velocity based on hit position on paddle
; Input: R0 = ball center Y, R1 = paddle top Y
; Output: R0 = new Y velocity (signed)
calculate_bounce_angle:
    PUSH R1
    PUSH R2

    ADD R1, #12
    SUB R0, R1

    AND R0, #$80
    BRNZ .negative_offset

    LD R0, [BALL_Y]
    ADD R0, #2
    LD R1, [PLAYER_PADDLE_Y]
    LD R1, [AI_PADDLE_Y]
    POP R2
    POP R1
    PUSH R1
    PUSH R2

    ADD R1, #12
    LD R0, [BALL_Y]
    ADD R0, #2
    SUB R0, R1

    SHR R0
    SHR R0

    CMP R0, #3
    BRNC .done_calc
    LD R0, #3
    JMP .done_calc

.negative_offset:
    POP R2
    POP R1
    PUSH R1
    PUSH R2

    ADD R1, #12
    LD R0, [BALL_Y]
    ADD R0, #2
    SUB R0, R1

    XOR R0, #$FF
    ADD R0, #1
    SHR R0
    SHR R0
    XOR R0, #$FF
    ADD R0, #1

    CMP R0, #253
    BRC .done_calc
    LD R0, #253

.done_calc:
    POP R2
    POP R1
    RET

; Draw both scores at the top of the screen
; Clears the old score area with black, then draws the new score
draw_scores:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3

    ; Clear player score area (8x8 black rectangle)
    LD R0, #111        ; X position
    LD R1, #4           ; Y position
    LD R2, #COLOR_BLACK ; Black color
    CALL fill_score_area

    ; Draw player score (left of center)
    LD R0, #111
    LD R1, #4
    LD R2, #COLOR_BLUE      ; Player color
    LD R3, [PLAYER_SCORE]
    CALL draw_digit

    ; Clear AI score area (8x8 black rectangle)
    LD R0, #138         ; X position
    LD R1, #4           ; Y position
    LD R2, #COLOR_BLACK ; Black color
    CALL fill_score_area

    ; Draw AI score (right of center)
    LD R0, #138
    LD R1, #4
    LD R2, #COLOR_RED       ; AI color
    LD R3, [AI_SCORE]
    CALL draw_digit

    POP R3
    POP R2
    POP R1
    POP R0
    RET

; Fill an 8x8 area with a solid color (used to clear score digits)
; Inputs: R0 = X coordinate
;         R1 = Y coordinate
;         R2 = color (palette index 0-15)
fill_score_area:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5

    MOV R3, R0          ; Save starting X
    MOV R4, R1          ; Save starting Y
    MOV R5, R2          ; Save color

    LD R2, #0           ; Row counter
.row_loop:
    CMP R2, #8          ; 8 rows
    BRZ .done

    LD R1, #0           ; Column counter
.col_loop:
    CMP R1, #8          ; 8 columns
    BRZ .next_row

    ; Calculate pixel position
    MOV R0, R3          ; Start X
    ADD R0, R1          ; Add column offset

    PUSH R1
    PUSH R2
    MOV R1, R4          ; Start Y
    ADD R1, R2          ; Add row offset
    MOV R2, R5          ; Color
    CALL draw_pixel
    POP R2
    POP R1

    INC R1
    JMP .col_loop

.next_row:
    INC R2
    JMP .row_loop

.done:
    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RET

; VBlank interrupt handler
vblank_handler:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5

    LD R0, #$01
    ST R0, [INT_STATUS]

    ; === Update Player Paddle ===
    LD R0, [CONTROLLER_1]
    LD R1, [PLAYER_PADDLE_Y]
    ST R1, [OLD_PLAYER_PADDLE_Y]

    LD R2, R0
    AND R2, #CTRL_UP
    BRZ .check_down
    CMP R1, #PADDLE_SPEED
    BRNC .check_down
    SUB R1, #PADDLE_SPEED
    JMP .check_down_boundary

.check_down:
    LD R2, R0
    AND R2, #CTRL_DOWN
    BRZ .player_paddle_update_done
    CMP R1, #(136 - PADDLE_SPEED + 1)
    BRC .player_paddle_update_done
    ADD R1, #PADDLE_SPEED
    JMP .player_paddle_update_done

.check_down_boundary:
    CMP R1, #200
    BRNC .player_paddle_update_done
    LD R1, #0

.player_paddle_update_done:
    LD R2, [OLD_PLAYER_PADDLE_Y]
    CMP R1, R2
    BRZ .player_paddle_no_change

    ST R1, [PLAYER_PADDLE_Y]
    LD R0, #PLAYER_PADDLE_X
    LD R1, [OLD_PLAYER_PADDLE_Y]
    LD R2, #COLOR_BLACK
    CALL fill_paddle
    CALL draw_player_paddle

.player_paddle_no_change:

    ; === Update AI Paddle ===
    ; Check if AI is waiting (lag mode)
    LD R0, [AI_WAITING]
    CMP R0, #0
    BRNZ .ai_paddle_no_change    ; If waiting, skip tracking (DISABLED FOR TESTING)
    ;JMP .ai_paddle_no_change

    ; AI is not waiting, track the ball normally
    LD R0, [BALL_Y]
    ADD R0, #2
    SUB R0, #AI_OFFSET

    LD R1, [AI_PADDLE_Y]
    ST R1, [OLD_AI_PADDLE_Y]

    LD R2, R1
    ADD R2, #12

    CMP R0, R2
    BRZ .ai_paddle_update_done
    BRC .ai_should_move_down

    CMP R1, #PADDLE_SPEED
    BRNC .ai_set_zero
    SUB R1, #PADDLE_SPEED
    JMP .ai_paddle_update_done

.ai_set_zero:
    LD R1, #0
    JMP .ai_paddle_update_done

.ai_should_move_down:
    CMP R1, #(136 - PADDLE_SPEED)
    BRC .ai_set_max
    ADD R1, #PADDLE_SPEED
    JMP .ai_paddle_update_done

.ai_set_max:
    LD R1, #136

.ai_paddle_update_done:
    LD R2, [OLD_AI_PADDLE_Y]
    CMP R1, R2
    BRZ .ai_paddle_no_change

    ST R1, [AI_PADDLE_Y]
    LD R0, #AI_PADDLE_X
    LD R1, [OLD_AI_PADDLE_Y]
    LD R2, #COLOR_BLACK
    CALL fill_paddle
    CALL draw_ai_paddle

.ai_paddle_no_change:

    ; === Update Ball ===
    ; Erase ball at OLD position using XOR
    LD R0, [OLD_BALL_X]     ; Load OLD position
    LD R1, [OLD_BALL_Y]     ; Load OLD position
    CALL xor_ball

    ; Save current position as old (before updating)
    LD R0, [BALL_X]
    ST R0, [OLD_BALL_X]
    LD R0, [BALL_Y]
    ST R0, [OLD_BALL_Y]

    ; Update ball position
    LD R0, [BALL_X]
    LD R1, [BALL_VX]
    ADD R0, R1
    ST R0, [BALL_X]

    LD R0, [BALL_Y]
    LD R1, [BALL_VY]
    ADD R0, R1
    ST R0, [BALL_Y]

    ; Check top/bottom collisions
    CMP R0, #160
    BRC .check_if_wrapped

    CMP R0, #(160 - BALL_SIZE)
    BRC .ball_hit_bottom
    JMP .check_paddle_collision

.check_if_wrapped:
    CMP R0, #200
    BRC .ball_hit_top
    JMP .ball_hit_bottom

.ball_hit_top:
    LD R0, [BALL_VY]
    XOR R0, #$FF
    ADD R0, #1
    ST R0, [BALL_VY]
    LD R0, #0
    ST R0, [BALL_Y]
    JMP .check_paddle_collision

.ball_hit_bottom:
    LD R0, [BALL_VY]
    XOR R0, #$FF
    ADD R0, #1
    ST R0, [BALL_VY]
    LD R0, #(160 - BALL_SIZE)
    ST R0, [BALL_Y]

.check_paddle_collision:
    ; Check player paddle collision
    LD R0, [BALL_X]

    CMP R0, #(PLAYER_PADDLE_X + PADDLE_WIDTH)
    BRC .check_ai_paddle
    CMP R0, #PLAYER_PADDLE_X
    BRNC .check_ai_paddle

    LD R0, [BALL_Y]
    LD R1, [PLAYER_PADDLE_Y]

    ADD R0, #BALL_SIZE
    CMP R0, R1
    BRNC .check_ai_paddle

    LD R0, [BALL_Y]
    LD R1, [PLAYER_PADDLE_Y]
    ADD R1, #PADDLE_HEIGHT
    CMP R0, R1
    BRC .check_ai_paddle

    ; Player hit the ball! Clear AI waiting flag
    LD R0, #0
    ST R0, [AI_WAITING]

    LD R0, [BALL_Y]
    ADD R0, #2
    LD R1, [PLAYER_PADDLE_Y]
    CALL calculate_bounce_angle
    ST R0, [BALL_VY]

    LD R0, [BALL_VX]
    XOR R0, #$FF
    ADD R0, #1
    ST R0, [BALL_VX]

    LD R0, #(PLAYER_PADDLE_X + PADDLE_WIDTH + 1)
    ST R0, [BALL_X]

.check_ai_paddle:
    LD R0, [BALL_X]

    CMP R0, #(AI_PADDLE_X - BALL_SIZE)
    BRNC .check_off_screen
    CMP R0, #(AI_PADDLE_X - BALL_SIZE - PADDLE_WIDTH)
    BRC .check_off_screen

    LD R0, [BALL_Y]
    LD R1, [AI_PADDLE_Y]

    ADD R0, #BALL_SIZE
    CMP R0, R1
    BRNC .check_off_screen

    LD R0, [BALL_Y]
    LD R1, [AI_PADDLE_Y]
    ADD R1, #PADDLE_HEIGHT
    CMP R0, R1
    BRC .check_off_screen

    ; AI hit the ball! Set AI waiting flag
    LD R0, #1
    ST R0, [AI_WAITING]

    LD R0, [BALL_Y]
    ADD R0, #2
    LD R1, [AI_PADDLE_Y]
    CALL calculate_bounce_angle
    ST R0, [BALL_VY]

    LD R0, [BALL_VX]
    XOR R0, #$FF
    ADD R0, #1
    ST R0, [BALL_VX]

    LD R0, #(AI_PADDLE_X - BALL_SIZE - 1)
    ST R0, [BALL_X]

.check_off_screen:
    ; Check if ball is off screen - use VELOCITY to determine which check to apply
    ; If moving RIGHT (positive velocity): X >= 252 (about to overflow) means off right edge
    ; If moving LEFT (negative velocity): X < 4 (wrapped from left) means off left edge

    LD R0, [BALL_X]
    LD R1, [BALL_VX]

    ; Check velocity direction
    AND R1, #$80        ; Check sign bit (bit 7)
    BRZ .check_right_edge  ; Positive velocity = moving right
    JMP .check_left_edge   ; Negative velocity = moving left

.check_right_edge:
    ; Ball moving RIGHT: check if X >= 252 (about to overflow)
    CMP R0, #252
    BRC .ball_off_right  ; About to go off right
    ; X is in valid range, continue playing
    JMP .draw_ball_now

.check_left_edge:
    ; Ball moving LEFT: check if X < 4 (just wrapped from left edge)
    CMP R0, #4
    BRC .draw_ball_now   ; X >= 4, still in valid range
    ; X < 4: wrapped from left edge
    JMP .ball_off_left

.ball_off_right:
    ; Ball went off right side - player scores!
    ; Increment player score
    LD R0, [PLAYER_SCORE]
    INC R0
    ; Wrap at 10
    CMP R0, #10
    BRNC .player_score_ok
    LD R0, #0
.player_score_ok:
    ST R0, [PLAYER_SCORE]

    ; Draw ball at old position - removes it
    LD R0, [OLD_BALL_X]
    LD R1, [OLD_BALL_Y]
    CALL xor_ball

    ; Redraw center line (in case ball erased parts)
    CALL draw_center_line

    ; Redraw scores
    CALL draw_scores

    ; Reset AI waiting flag (new serve)
    LD R0, #0
    ST R0, [AI_WAITING]

    ; Reset ball position (this sets both BALL and OLD positions)
    LD R0, #0           ; AI serves (ball goes left)
    CALL reset_ball

    JMP .done

.ball_off_left:
    ; Ball went off left side - AI scores!
    ; Increment AI score
    LD R0, [AI_SCORE]
    INC R0
    ; Wrap at 10
    CMP R0, #10
    BRNC .ai_score_ok
    LD R0, #0
.ai_score_ok:
    ST R0, [AI_SCORE]

    ; Draw ball at old position - removes it
    LD R0, [OLD_BALL_X]
    LD R1, [OLD_BALL_Y]
    CALL xor_ball

    ; Redraw center line (in case ball erased parts)
    CALL draw_center_line

    ; Redraw scores
    CALL draw_scores

    ; Reset AI waiting flag (new serve)
    LD R0, #0
    ST R0, [AI_WAITING]

    ; Reset ball position (this sets both BALL and OLD positions)
    LD R0, #1           ; Player serves (ball goes right)
    CALL reset_ball

    JMP .done

.draw_ball_now:
    ; Draw ball at new position using XOR
    LD R0, [BALL_X]
    LD R1, [BALL_Y]
    CALL xor_ball

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

    LD R0, #253         ; Black
    ST R0, [PALETTE_RAM]
    LD R0, #255         ; White
    ST R0, [PALETTE_RAM + 1]
    LD R0, #127         ; Blue
    ST R0, [PALETTE_RAM + 2]
    LD R0, #6           ; Red
    ST R0, [PALETTE_RAM + 3]
    LD R0, #65          ; Dark green (from green row)
    ST R0, [PALETTE_RAM + 4]

    POP R0
    RET

draw_player_paddle:
    PUSH R0
    PUSH R1
    PUSH R2

    LD R0, #PLAYER_PADDLE_X
    LD R1, [PLAYER_PADDLE_Y]
    LD R2, #COLOR_BLUE
    CALL fill_paddle

    POP R2
    POP R1
    POP R0
    RET

draw_ai_paddle:
    PUSH R0
    PUSH R1
    PUSH R2

    LD R0, #AI_PADDLE_X
    LD R1, [AI_PADDLE_Y]
    LD R2, #COLOR_RED
    CALL fill_paddle

    POP R2
    POP R1
    POP R0
    RET

; Draw ball using XOR at current position
draw_ball_xor:
    PUSH R0
    PUSH R1

    LD R0, [BALL_X]
    LD R1, [BALL_Y]
    CALL xor_ball

    POP R1
    POP R0
    RET

; XOR ball at given position
; Input: R0 = X position, R1 = Y position
xor_ball:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5

    MOV R3, R0
    MOV R4, R1

    LD R2, #0
.row_loop:
    CMP R2, #BALL_SIZE
    BRZ .done

    LD R1, #0
.col_loop:
    CMP R1, #BALL_SIZE
    BRZ .next_row

    MOV R0, R3
    ADD R0, R1

    PUSH R1
    PUSH R2
    MOV R1, R4
    ADD R1, R2
    CALL draw_pixel_xor
    POP R2
    POP R1

    INC R1
    JMP .col_loop

.next_row:
    INC R2
    JMP .row_loop

.done:
    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RET

fill_paddle:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5

    MOV R3, R0
    MOV R4, R1
    MOV R5, R2

    LD R2, #0
.row_loop:
    CMP R2, #PADDLE_HEIGHT
    BRZ .done

    LD R1, #0
.col_loop:
    CMP R1, #PADDLE_WIDTH
    BRZ .next_row

    MOV R0, R3
    ADD R0, R1

    PUSH R1
    PUSH R2
    MOV R1, R4
    ADD R1, R2
    MOV R2, R5
    CALL draw_pixel
    POP R2
    POP R1

    INC R1
    JMP .col_loop

.next_row:
    INC R2
    JMP .row_loop

.done:
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

; XOR pixel drawing routine
; Input: R0 = X coordinate, R1 = Y coordinate
; XORs white color (0xF) with existing pixel
draw_pixel_xor:
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

    ; Even pixel: XOR high nibble with white (0xF)
    MOV R2, R5
    SHR R2
    SHR R2
    SHR R2
    SHR R2
    XOR R2, #$0F        ; XOR with white
    SHL R2, #4
    AND R5, #$0F        ; Keep low nibble
    OR R5, R2
    JMP .write_byte

.odd_pixel:
    ; Odd pixel: XOR low nibble with white (0xF)
    MOV R2, R5
    AND R2, #$0F
    XOR R2, #$0F        ; XOR with white
    AND R5, #$F0        ; Keep high nibble
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

; Subroutine: draw_digit
; Inputs: R0 = X coordinate (0-255)
;         R1 = Y coordinate (0-159)
;         R2 = color (palette index 0-15)
;         R3 = digit (0-9)
; Outputs: None (calls draw_bitmap with calculated pointer)
; Modifies: R3, R4, and whatever draw_bitmap modifies
draw_digit:
  .define DIGIT_TEMP SCRATCH+7
  .define DIGIT_X SCRATCH+8
  .define DIGIT_Y SCRATCH+9
  .define DIGIT_COLOR SCRATCH+10

  ; Save input parameters
  ST R0, DIGIT_X
  ST R1, DIGIT_Y
  ST R2, DIGIT_COLOR
  ST R3, DIGIT_TEMP

  ; Calculate offset: digit * 8
  ; We'll do this by shifting left 3 times (multiply by 8)
  SHL R3
  SHL R3
  SHL R3
  ; R3 now has the offset (0, 8, 16, 24, ... 72)

  ; Load base address of number_0
  LD R4, #>number_0   ; High byte
  MOV R5, R3          ; Save offset in R5
  LD R3, #<number_0   ; Low byte

  ; Add offset to the 16-bit base address
  ADD R3, R5          ; Add offset to low byte
  BRC .digit_carry
  JMP .digit_no_carry

.digit_carry:
  INC R4              ; Propagate carry to high byte

.digit_no_carry:
  ; Now R3:R4 has the pointer to the correct digit bitmap
  ; Restore X, Y, color and call draw_bitmap
  LD R0, DIGIT_X
  LD R1, DIGIT_Y
  LD R2, DIGIT_COLOR
  ; R3 and R4 are already set with the bitmap pointer

  CALL draw_bitmap
  RET

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

; Number bitmaps (8x8) for digits 0-9
; Each number is designed with a simple, readable font

number_0:
    .byte 0b01111110  ; Row 1:  ******
    .byte 0b11000011  ; Row 2: **    **
    .byte 0b11000111  ; Row 3: **   ***
    .byte 0b11001011  ; Row 4: **  * **
    .byte 0b11110011  ; Row 5: ****  **
    .byte 0b11100011  ; Row 6: ***   **
    .byte 0b11000011  ; Row 7: **    **
    .byte 0b01111110  ; Row 8:  ******

number_1:
    .byte 0b00011000  ; Row 1:    **
    .byte 0b00111000  ; Row 2:   ***
    .byte 0b01111000  ; Row 3:  ****
    .byte 0b00011000  ; Row 4:    **
    .byte 0b00011000  ; Row 5:    **
    .byte 0b00011000  ; Row 6:    **
    .byte 0b00011000  ; Row 7:    **
    .byte 0b01111110  ; Row 8:  ******

number_2:
    .byte 0b01111110  ; Row 1:  ******
    .byte 0b11000011  ; Row 2: **    **
    .byte 0b00000011  ; Row 3:       **
    .byte 0b00001110  ; Row 4:     ***
    .byte 0b00111000  ; Row 5:   ***
    .byte 0b01100000  ; Row 6:  **
    .byte 0b11000000  ; Row 7: **
    .byte 0b11111111  ; Row 8: ********

number_3:
    .byte 0b01111110  ; Row 1:  ******
    .byte 0b11000011  ; Row 2: **    **
    .byte 0b00000011  ; Row 3:       **
    .byte 0b00111110  ; Row 4:   *****
    .byte 0b00000011  ; Row 5:       **
    .byte 0b00000011  ; Row 6:       **
    .byte 0b11000011  ; Row 7: **    **
    .byte 0b01111110  ; Row 8:  ******

number_4:
    .byte 0b00000110  ; Row 1:      **
    .byte 0b00001110  ; Row 2:     ***
    .byte 0b00011110  ; Row 3:    ****
    .byte 0b00110110  ; Row 4:   ** **
    .byte 0b01100110  ; Row 5:  **  **
    .byte 0b11111111  ; Row 6: ********
    .byte 0b00000110  ; Row 7:      **
    .byte 0b00000110  ; Row 8:      **

number_5:
    .byte 0b11111111  ; Row 1: ********
    .byte 0b11000000  ; Row 2: **
    .byte 0b11000000  ; Row 3: **
    .byte 0b11111110  ; Row 4: *******
    .byte 0b00000011  ; Row 5:       **
    .byte 0b00000011  ; Row 6:       **
    .byte 0b11000011  ; Row 7: **    **
    .byte 0b01111110  ; Row 8:  ******

number_6:
    .byte 0b00111110  ; Row 1:   *****
    .byte 0b01100000  ; Row 2:  **
    .byte 0b11000000  ; Row 3: **
    .byte 0b11111110  ; Row 4: *******
    .byte 0b11000011  ; Row 5: **    **
    .byte 0b11000011  ; Row 6: **    **
    .byte 0b11000011  ; Row 7: **    **
    .byte 0b01111110  ; Row 8:  ******

number_7:
    .byte 0b11111111  ; Row 1: ********
    .byte 0b00000011  ; Row 2:       **
    .byte 0b00000110  ; Row 3:      **
    .byte 0b00001100  ; Row 4:     **
    .byte 0b00011000  ; Row 5:    **
    .byte 0b00110000  ; Row 6:   **
    .byte 0b00110000  ; Row 7:   **
    .byte 0b00110000  ; Row 8:   **

number_8:
    .byte 0b01111110  ; Row 1:  ******
    .byte 0b11000011  ; Row 2: **    **
    .byte 0b11000011  ; Row 3: **    **
    .byte 0b01111110  ; Row 4:  ******
    .byte 0b11000011  ; Row 5: **    **
    .byte 0b11000011  ; Row 6: **    **
    .byte 0b11000011  ; Row 7: **    **
    .byte 0b01111110  ; Row 8:  ******

number_9:
    .byte 0b01111110  ; Row 1:  ******
    .byte 0b11000011  ; Row 2: **    **
    .byte 0b11000011  ; Row 3: **    **
    .byte 0b11000011  ; Row 4: **    **
    .byte 0b01111111  ; Row 5:  *******
    .byte 0b00000011  ; Row 6:       **
    .byte 0b00000110  ; Row 7:      **
    .byte 0b01111100  ; Row 8:  *****

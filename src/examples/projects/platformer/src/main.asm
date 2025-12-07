; Platformer Example
; Displays a tilemap and a player sprite that can move around
; Player cannot move into tiles (collision detection)
;
; Assumes:
; - Tile graphics are in cartridge bank 2 (absolute bank 18)
; - Tilemap data (.tbin file) is in cartridge bank 4 (absolute bank 20)
; - Player sprite graphics are in cartridge bank 5 (absolute bank 21)
;
; Uses VBLANK interrupt for smooth 60fps movement

.org $0B80

; =============================================================================
; Hardware Register Constants
; =============================================================================

.define BANK_REG            $0100
.define VIDEO_MODE          $0101

; Interrupt registers
.define INT_STATUS          $0114
.define INT_ENABLE          $0115
.define VBLANK_VEC_HI       $0132
.define VBLANK_VEC_LO       $0133

; Sprite control registers
.define SPRITE_ENABLE       $0104
.define SPRITE_COUNT        $0105

; Sprite 0 attribute addresses (player)
.define SPRITE_0_X          $0700
.define SPRITE_0_Y          $0701
.define SPRITE_0_IDX        $0702
.define SPRITE_0_FLAGS      $0703
.define SPRITE_0_BANK       $0704

; Tilemap control registers
.define TILEMAP_ENABLE      $013D
.define TILEMAP_GFX_BANK    $013E
.define TILEMAP_X_SCROLL_LO $013F
.define TILEMAP_X_SCROLL_HI $0140
.define TILEMAP_Y_SCROLL_LO $0141
.define TILEMAP_Y_SCROLL_HI $0142
.define TILEMAP_WIDTH       $0143
.define TILEMAP_HEIGHT      $0144
.define TILEMAP_DATA_BANK   $0145
.define TILEMAP_ADDR_HI     $0146
.define TILEMAP_ADDR_LO     $0147
.define TILE_ANIM_FRAME     $0148

; Controller registers
.define CTRL1_STATE         $0136

; Scanline palette map
.define SCANLINE_MAP        $0600

; Framebuffer
.define FRAMEBUFFER_START   $B000

; =============================================================================
; Constants
; =============================================================================

; Screen dimensions
.define SCREEN_WIDTH        256
.define SCREEN_HEIGHT       160

; Tile and sprite size
.define TILE_SIZE           16
.define SPRITE_SIZE         16

; Banks (cartridge banks start at 16)
.define TILE_GFX_BANK       18      ; Cartridge bank 2 = absolute 18
.define TILEMAP_BANK        20      ; Cartridge bank 4 = absolute 20
.define PLAYER_SPRITE_BANK  21      ; Cartridge bank 5 = absolute 21

; Tilemap data offset (skip 8-byte .tbin header)
.define TILEMAP_DATA_OFFSET 8

; Tilemap enable flags
.define TM_ENABLE           $01     ; Bit 0: Enable tilemap

; Controller button masks (from cheatsheet)
.define BTN_UP              $80
.define BTN_DOWN            $40
.define BTN_LEFT            $20
.define BTN_RIGHT           $10
.define BTN_C               $02     ; Jump button (B0 on gamepad)

; =============================================================================
; Physics Constants (tweak these for feel)
; =============================================================================

; Gravity applied per frame (in 1/16 pixel units)
; Lower = floatier, Higher = snappier
.define GRAVITY             4

; Maximum fall speed (in 1/16 pixel units per frame)
; Prevents falling through floors at high speeds
.define MAX_FALL_SPEED      64      ; 4 pixels per frame max

; Jump initial velocity (in 1/16 pixel units, negative = up)
; Higher = higher jump
.define JUMP_VELOCITY       84      ; ~5.25 pixels per frame initial upward

; Horizontal movement speed (in 1/16 pixel units per frame)
.define MOVE_SPEED          32      ; 2 pixels per frame

; Horizontal acceleration (added per frame when pressing direction)
.define MOVE_ACCEL          8       ; Takes 4 frames to reach full speed

; Horizontal friction/deceleration (subtracted per frame when not pressing)
.define MOVE_FRICTION       6       ; Takes ~5 frames to stop

; =============================================================================
; Variables (in lower memory)
; =============================================================================

.define PLAYER_X            $0B00   ; Player X position (screen coords, whole pixels)
.define PLAYER_Y            $0B01   ; Player Y position (screen coords, whole pixels)
.define MAP_WIDTH           $0B02   ; Tilemap width in tiles
.define MAP_HEIGHT          $0B03   ; Tilemap height in tiles
.define TEMP_X              $0B04   ; Temporary X for collision check
.define TEMP_Y              $0B05   ; Temporary Y for collision check

; Velocity variables (signed, in 1/16 pixel units for sub-pixel precision)
; Positive vel_y = moving down, Negative vel_y = moving up
.define VEL_X               $0B06   ; Horizontal velocity (signed)
.define VEL_Y               $0B07   ; Vertical velocity (signed)

; Sub-pixel accumulators (fractional part of position)
.define SUB_X               $0B08   ; X sub-pixel accumulator
.define SUB_Y               $0B09   ; Y sub-pixel accumulator

; State flags
.define ON_GROUND           $0B0A   ; 1 if player is standing on ground, 0 if airborne
.define JUMP_HELD           $0B0B   ; Tracks if jump button was held (prevents re-jump)

; =============================================================================
; Entry Point
; =============================================================================

main:
    NOP
    NOP
    NOP
    ; Disable interrupts during setup
    CLI

    ; Set video mode 0 (256x160 @ 4bpp)
    LD R0, #0
    ST R0, [VIDEO_MODE]

    ; Clear framebuffer to black
    CALL clear_screen

    ; Set up scanline palette map (all scanlines use palette 0)
    CALL setup_scanline_map

    ; Read tilemap header to get dimensions
    CALL read_tilemap_header

    ; Configure tilemap registers
    CALL setup_tilemap

    ; Initialize player position (start near top-left, will fall to ground)
    LD R0, #32
    ST R0, [PLAYER_X]
    LD R0, #16
    ST R0, [PLAYER_Y]

    ; Initialize velocity and physics state
    LD R0, #0
    ST R0, [VEL_X]
    ST R0, [VEL_Y]
    ST R0, [SUB_X]
    ST R0, [SUB_Y]
    ST R0, [ON_GROUND]
    ST R0, [JUMP_HELD]

    ; Setup player sprite
    CALL setup_player_sprite

    ; Clear any pending interrupt flags
    LD R0, #$FF
    ST R0, [INT_STATUS]

    ; Install VBLANK interrupt vector
    LD R0, #(vblank_handler & $FF)
    ST R0, [VBLANK_VEC_LO]
    LD R0, #(vblank_handler >> 8)
    ST R0, [VBLANK_VEC_HI]

    ; Enable VBLANK interrupt
    LD R0, #$01
    ST R0, [INT_ENABLE]

    ; Enable interrupts
    SEI

    ; Main loop - idles while interrupt handles movement
main_loop:
    NOP
    JMP main_loop

; =============================================================================
; Setup Player Sprite
; =============================================================================

setup_player_sprite:
    PUSH R0

    ; Enable sprites
    LD R0, #1
    ST R0, [SPRITE_ENABLE]

    ; Set sprite count to 1
    LD R0, #1
    ST R0, [SPRITE_COUNT]

    ; Set sprite 0 position
    LD R0, [PLAYER_X]
    ST R0, [SPRITE_0_X]
    LD R0, [PLAYER_Y]
    ST R0, [SPRITE_0_Y]

    ; Set sprite index (0)
    LD R0, #0
    ST R0, [SPRITE_0_IDX]

    ; Set sprite flags (no flip, front priority, palette 0)
    LD R0, #$00
    ST R0, [SPRITE_0_FLAGS]

    ; Set sprite bank (cartridge bank 5 = absolute 21)
    LD R0, #PLAYER_SPRITE_BANK
    ST R0, [SPRITE_0_BANK]

    POP R0
    RET

; =============================================================================
; VBLANK Interrupt Handler
; Called 60 times per second - handles physics and input
; =============================================================================

vblank_handler:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3

    ; Clear VBLANK flag (write 1 to clear)
    LD R0, #$01
    ST R0, [INT_STATUS]

    ; Increment animation frame counter
    LD R0, [TILE_ANIM_FRAME]
    INC R0
    ST R0, [TILE_ANIM_FRAME]

    ; Read controller state into R2 (used throughout)
    LD R2, [CTRL1_STATE]

    ; ===================
    ; Horizontal Input
    ; ===================
    CALL handle_horizontal_input

    ; ===================
    ; Jump Input
    ; ===================
    CALL handle_jump_input

    ; ===================
    ; Apply Gravity
    ; ===================
    CALL apply_gravity

    ; ===================
    ; Apply Velocities & Collision
    ; ===================
    CALL apply_horizontal_velocity
    CALL apply_vertical_velocity

    ; ===================
    ; Update Sprite
    ; ===================
    LD R0, [PLAYER_X]
    ST R0, [SPRITE_0_X]
    LD R0, [PLAYER_Y]
    ST R0, [SPRITE_0_Y]

    POP R3
    POP R2
    POP R1
    POP R0
    RTI

; =============================================================================
; Physics Functions
; =============================================================================

; -----------------------------------------------------------------------------
; Handle Horizontal Input
; Reads left/right from controller (in R2), updates VEL_X with acceleration
; -----------------------------------------------------------------------------
handle_horizontal_input:
    PUSH R0
    PUSH R1

    ; Check LEFT button
    MOV R0, R2
    AND R0, #BTN_LEFT
    BRZ .check_right_input

    ; Left pressed - accelerate left (decrease VEL_X)
    LD R0, [VEL_X]
    ; Check if already at max left speed (VEL_X <= -MOVE_SPEED)
    ; -MOVE_SPEED = -32 = 0xE0 in two's complement
    ; If VEL_X is negative and <= -32, don't accelerate more
    SUB R0, #MOVE_ACCEL
    ; Clamp to -MOVE_SPEED (0xE0 = -32)
    ; Check if we went below -32 (i.e., value < 0xE0 when interpreted as signed)
    ; Since -32 = 0xE0, values 0x80-0xDF are "more negative" (< -32)
    ; We need: if R0 < 0xE0 (signed), clamp to 0xE0
    ; Approach: if high bit set AND R0 < 0xE0 (unsigned), clamp
    MOV R1, R0
    AND R1, #$80
    BRZ .store_vel_x_left      ; If positive, just store (shouldn't happen when moving left)
    ; R0 is negative - check if too negative
    CMP R0, #$E0
    BRC .store_vel_x_left      ; If R0 >= 0xE0 (unsigned), it's fine (-32 to -1)
    ; R0 < 0xE0 (unsigned), meaning more negative than -32
    LD R0, #$E0               ; Clamp to -32

.store_vel_x_left:
    ST R0, [VEL_X]
    JMP .horiz_done

.check_right_input:
    MOV R0, R2
    AND R0, #BTN_RIGHT
    BRZ .apply_friction

    ; Right pressed - accelerate right (increase VEL_X)
    LD R0, [VEL_X]
    ADD R0, #MOVE_ACCEL
    ; Clamp to +MOVE_SPEED (32 = 0x20)
    ; Check if positive and > 32
    MOV R1, R0
    AND R1, #$80
    BRNZ .store_vel_x_right    ; If negative, just store (shouldn't happen when moving right)
    ; R0 is positive - check if too fast
    CMP R0, #MOVE_SPEED
    BRNC .store_vel_x_right    ; If R0 < MOVE_SPEED, it's fine
    ; R0 >= MOVE_SPEED, clamp
    LD R0, #MOVE_SPEED

.store_vel_x_right:
    ST R0, [VEL_X]
    JMP .horiz_done

.apply_friction:
    ; No left/right pressed - apply friction to slow down
    LD R0, [VEL_X]
    CMP R0, #0
    BRZ .horiz_done           ; Already stopped

    ; Check if positive or negative
    MOV R1, R0
    AND R1, #$80
    BRNZ .friction_negative

    ; Positive velocity - subtract friction
    CMP R0, #MOVE_FRICTION
    BRNC .friction_to_zero_pos  ; If VEL_X < FRICTION, just set to 0
    SUB R0, #MOVE_FRICTION
    ST R0, [VEL_X]
    JMP .horiz_done

.friction_to_zero_pos:
    LD R0, #0
    ST R0, [VEL_X]
    JMP .horiz_done

.friction_negative:
    ; Negative velocity - add friction (towards zero)
    ADD R0, #MOVE_FRICTION
    ; Check if we crossed zero (became positive)
    MOV R1, R0
    AND R1, #$80
    BRZ .friction_to_zero_neg  ; If now positive, we overshot - set to 0
    ST R0, [VEL_X]
    JMP .horiz_done

.friction_to_zero_neg:
    LD R0, #0
    ST R0, [VEL_X]

.horiz_done:
    POP R1
    POP R0
    RET

; -----------------------------------------------------------------------------
; Handle Jump Input
; If on ground and C button pressed (and wasn't held), initiate jump
; -----------------------------------------------------------------------------
handle_jump_input:
    PUSH R0
    PUSH R1

    ; Check if C button (jump) is pressed
    MOV R0, R2
    AND R0, #BTN_C
    BRZ .jump_not_pressed

    ; Jump button is pressed
    ; Check if it was already held (prevent repeated jumps while holding)
    LD R0, [JUMP_HELD]
    CMP R0, #0
    BRNZ .jump_done           ; Already held, don't jump again

    ; Check if on ground
    LD R0, [ON_GROUND]
    CMP R0, #0
    BRZ .jump_done            ; Not on ground, can't jump

    ; Initiate jump! Set upward velocity (negative)
    ; -JUMP_VELOCITY = -84 = 0xAC
    LD R0, #$AC               ; -84 in two's complement (-JUMP_VELOCITY)
    ST R0, [VEL_Y]

    ; Clear on_ground flag
    LD R0, #0
    ST R0, [ON_GROUND]

    ; Mark jump as held
    LD R0, #1
    ST R0, [JUMP_HELD]
    JMP .jump_done

.jump_not_pressed:
    ; Jump button released - clear held flag
    LD R0, #0
    ST R0, [JUMP_HELD]

.jump_done:
    POP R1
    POP R0
    RET

; -----------------------------------------------------------------------------
; Apply Gravity
; Add gravity to VEL_Y, clamp to MAX_FALL_SPEED
; -----------------------------------------------------------------------------
apply_gravity:
    PUSH R0
    PUSH R1

    ; Don't apply gravity if on ground with zero/positive velocity
    LD R0, [ON_GROUND]
    CMP R0, #0
    BRZ .do_gravity

    ; On ground - check if velocity is upward (jumping)
    LD R0, [VEL_Y]
    MOV R1, R0
    AND R1, #$80
    BRNZ .do_gravity          ; Negative velocity = jumping, apply gravity
    ; On ground with non-negative velocity - don't apply gravity
    JMP .gravity_done

.do_gravity:
    LD R0, [VEL_Y]
    ADD R0, #GRAVITY

    ; Check for overflow into "very negative" territory (wrapped around)
    ; This happens if we were at e.g. 120 and added 8 to get 128 (0x80 = -128)
    ; We want to detect if we went from positive to very negative due to overflow

    ; Clamp to MAX_FALL_SPEED (64 = 0x40)
    ; First check if positive
    MOV R1, R0
    AND R1, #$80
    BRNZ .gravity_store       ; Negative = still going up, no clamp needed

    ; Positive - check if > MAX_FALL_SPEED
    CMP R0, #MAX_FALL_SPEED
    BRNC .gravity_store       ; R0 < MAX_FALL_SPEED, fine
    LD R0, #MAX_FALL_SPEED    ; Clamp to max

.gravity_store:
    ST R0, [VEL_Y]

.gravity_done:
    POP R1
    POP R0
    RET

; -----------------------------------------------------------------------------
; Apply Horizontal Velocity
; Converts VEL_X to pixel movement, handles collision
; -----------------------------------------------------------------------------
apply_horizontal_velocity:
    PUSH R0
    PUSH R1
    PUSH R3

    LD R0, [VEL_X]
    CMP R0, #0
    BRNZ .has_horiz_vel       ; Has horizontal velocity
    JMP .horiz_vel_done       ; No horizontal velocity

.has_horiz_vel:
    ; Check direction (sign of VEL_X)
    MOV R1, R0
    AND R1, #$80
    BRNZ .move_left_vel

    ; Moving right (positive velocity)
    ; Add VEL_X to SUB_X
    LD R1, [SUB_X]
    ADD R1, R0
    ; Check if we accumulated a full pixel (>= 16)
    MOV R3, R1
    SHR R3
    SHR R3
    SHR R3
    SHR R3                    ; R3 = pixels to move
    CMP R3, #0
    BRZ .store_sub_x_right

    ; Move R3 pixels right (usually 1 or 2)
.move_right_loop:
    CALL try_move_right_1px
    CMP R0, #0
    BRZ .hit_wall_right       ; Collision - stop
    DEC R3
    BRNZ .move_right_loop
    ; Successful moves - keep fractional part
    AND R1, #$0F              ; Keep only lower 4 bits (0-15)
    JMP .store_sub_x_right

.hit_wall_right:
    ; Hit wall - zero out velocity and sub-pixel
    LD R0, #0
    ST R0, [VEL_X]
    LD R1, #0

.store_sub_x_right:
    ST R1, [SUB_X]
    JMP .horiz_vel_done

.move_left_vel:
    ; Moving left (negative velocity)
    ; Negate VEL_X to get positive magnitude
    XOR R0, #$FF
    INC R0                    ; R0 = |VEL_X| (positive magnitude)

    ; Add magnitude to SUB_X (same as right, we accumulate)
    LD R1, [SUB_X]
    ADD R1, R0
    ; Check if we accumulated a full pixel (>= 16)
    MOV R3, R1
    SHR R3
    SHR R3
    SHR R3
    SHR R3                    ; R3 = pixels to move
    CMP R3, #0
    BRZ .store_sub_x_left

    ; Move R3 pixels left (usually 1 or 2)
.move_left_loop:
    CALL try_move_left_1px
    CMP R0, #0
    BRZ .hit_wall_left        ; Collision - stop
    DEC R3
    BRNZ .move_left_loop
    ; Successful moves - keep fractional part
    AND R1, #$0F              ; Keep only lower 4 bits (0-15)
    JMP .store_sub_x_left

.hit_wall_left:
    ; Hit wall - zero out velocity and sub-pixel
    LD R0, #0
    ST R0, [VEL_X]
    LD R1, #0

.store_sub_x_left:
    ST R1, [SUB_X]

.horiz_vel_done:
    POP R3
    POP R1
    POP R0
    RET

; -----------------------------------------------------------------------------
; Apply Vertical Velocity
; Converts VEL_Y to pixel movement, handles collision, updates ON_GROUND
; -----------------------------------------------------------------------------
apply_vertical_velocity:
    PUSH R0
    PUSH R1
    PUSH R3

    LD R0, [VEL_Y]
    CMP R0, #0
    BRNZ .has_vert_vel        ; Has vertical velocity
    JMP .check_ground_below   ; No velocity, but check if we're still on ground

.has_vert_vel:
    ; Check direction
    MOV R1, R0
    AND R1, #$80
    BRNZ .move_up_vel

    ; Moving down (positive velocity = falling)
    ; Clear on_ground since we're moving down
    LD R1, #0
    ST R1, [ON_GROUND]

    ; Add VEL_Y to SUB_Y
    LD R1, [SUB_Y]
    ADD R1, R0
    ; Calculate pixels to move
    MOV R3, R1
    SHR R3
    SHR R3
    SHR R3
    SHR R3                    ; R3 = pixels to move
    CMP R3, #0
    BRZ .store_sub_y_down

.move_down_loop:
    CALL try_move_down_1px
    CMP R0, #0
    BRZ .hit_ground           ; Collision - landed
    DEC R3
    BRNZ .move_down_loop
    ; Successful moves
    AND R1, #$0F
    JMP .store_sub_y_down

.hit_ground:
    ; Landed on ground
    LD R0, #1
    ST R0, [ON_GROUND]
    LD R0, #0
    ST R0, [VEL_Y]
    LD R1, #0

.store_sub_y_down:
    ST R1, [SUB_Y]
    JMP .vert_vel_done

.move_up_vel:
    ; Moving up (negative velocity = jumping)
    LD R1, #0
    ST R1, [ON_GROUND]        ; Definitely not on ground when moving up

    ; Negate VEL_Y to get magnitude
    XOR R0, #$FF
    INC R0                    ; R0 = |VEL_Y|

    ; Add magnitude to SUB_Y (same accumulation as downward)
    LD R1, [SUB_Y]
    ADD R1, R0
    ; Check if we accumulated a full pixel (>= 16)
    MOV R3, R1
    SHR R3
    SHR R3
    SHR R3
    SHR R3                    ; R3 = pixels to move
    CMP R3, #0
    BRZ .store_sub_y_up

    ; Move R3 pixels up
.move_up_loop:
    CALL try_move_up_1px
    CMP R0, #0
    BRZ .hit_ceiling          ; Collision - stop
    DEC R3
    BRNZ .move_up_loop
    ; Successful moves - keep fractional part
    AND R1, #$0F
    JMP .store_sub_y_up

.hit_ceiling:
    ; Hit ceiling - stop upward movement
    LD R0, #0
    ST R0, [VEL_Y]
    LD R1, #0

.store_sub_y_up:
    ST R1, [SUB_Y]
    JMP .vert_vel_done

.check_ground_below:
    ; No vertical velocity - check if still on ground
    ; Try to move down 1 pixel to see if there's ground
    LD R0, [PLAYER_X]
    ST R0, [TEMP_X]
    LD R0, [PLAYER_Y]
    INC R0                    ; Check 1 pixel below
    ST R0, [TEMP_Y]
    CALL check_collision
    CMP R0, #0
    BRNZ .still_on_ground
    ; No ground below - start falling
    LD R0, #0
    ST R0, [ON_GROUND]
    JMP .vert_vel_done

.still_on_ground:
    LD R0, #1
    ST R0, [ON_GROUND]

.vert_vel_done:
    POP R3
    POP R1
    POP R0
    RET

; -----------------------------------------------------------------------------
; Single Pixel Movement Functions (for physics)
; Return R0 = 1 if moved successfully, 0 if collision
; -----------------------------------------------------------------------------

try_move_right_1px:
    PUSH R1

    LD R0, [PLAYER_X]
    CMP R0, #240              ; Screen boundary (256 - 16)
    BRC .right_1px_blocked    ; At edge

    INC R0
    ST R0, [TEMP_X]
    LD R1, [PLAYER_Y]
    ST R1, [TEMP_Y]
    CALL check_collision
    CMP R0, #0
    BRNZ .right_1px_blocked

    ; Success - apply move
    LD R0, [TEMP_X]
    ST R0, [PLAYER_X]
    LD R0, #1
    JMP .right_1px_done

.right_1px_blocked:
    LD R0, #0

.right_1px_done:
    POP R1
    RET

try_move_left_1px:
    PUSH R1

    LD R0, [PLAYER_X]
    CMP R0, #1
    BRNC .left_1px_blocked    ; At edge (R0 < 1)

    DEC R0
    ST R0, [TEMP_X]
    LD R1, [PLAYER_Y]
    ST R1, [TEMP_Y]
    CALL check_collision
    CMP R0, #0
    BRNZ .left_1px_blocked

    LD R0, [TEMP_X]
    ST R0, [PLAYER_X]
    LD R0, #1
    JMP .left_1px_done

.left_1px_blocked:
    LD R0, #0

.left_1px_done:
    POP R1
    RET

try_move_down_1px:
    PUSH R1

    LD R0, [PLAYER_Y]
    CMP R0, #144              ; Screen boundary (160 - 16)
    BRC .down_1px_blocked     ; At edge

    INC R0
    ST R0, [TEMP_Y]
    LD R1, [PLAYER_X]
    ST R1, [TEMP_X]
    CALL check_collision
    CMP R0, #0
    BRNZ .down_1px_blocked

    LD R0, [TEMP_Y]
    ST R0, [PLAYER_Y]
    LD R0, #1
    JMP .down_1px_done

.down_1px_blocked:
    LD R0, #0

.down_1px_done:
    POP R1
    RET

try_move_up_1px:
    PUSH R1

    LD R0, [PLAYER_Y]
    CMP R0, #1
    BRNC .up_1px_blocked      ; At edge

    DEC R0
    ST R0, [TEMP_Y]
    LD R1, [PLAYER_X]
    ST R1, [TEMP_X]
    CALL check_collision
    CMP R0, #0
    BRNZ .up_1px_blocked

    LD R0, [TEMP_Y]
    ST R0, [PLAYER_Y]
    LD R0, #1
    JMP .up_1px_done

.up_1px_blocked:
    LD R0, #0

.up_1px_done:
    POP R1
    RET

; =============================================================================
; Check Collision
; Checks if the sprite at (TEMP_X, TEMP_Y) collides with any solid tiles
; Returns: R0 = 0 if no collision, non-zero if collision
;
; We check all 4 corners of the 16x16 sprite against the tilemap
; =============================================================================

check_collision:
    PUSH R1
    PUSH R2
    PUSH R3

    ; Check top-left corner
    LD R0, [TEMP_X]
    LD R1, [TEMP_Y]
    CALL get_tile_at_pixel
    CMP R0, #0
    BRNZ .collision_found

    ; Check top-right corner (X + 15)
    LD R0, [TEMP_X]
    ADD R0, #15
    LD R1, [TEMP_Y]
    CALL get_tile_at_pixel
    CMP R0, #0
    BRNZ .collision_found

    ; Check bottom-left corner (Y + 15)
    LD R0, [TEMP_X]
    LD R1, [TEMP_Y]
    ADD R1, #15
    CALL get_tile_at_pixel
    CMP R0, #0
    BRNZ .collision_found

    ; Check bottom-right corner (X + 15, Y + 15)
    LD R0, [TEMP_X]
    ADD R0, #15
    LD R1, [TEMP_Y]
    ADD R1, #15
    CALL get_tile_at_pixel
    CMP R0, #0
    BRNZ .collision_found

    ; No collision
    LD R0, #0
    JMP .collision_done

.collision_found:
    LD R0, #1

.collision_done:
    POP R3
    POP R2
    POP R1
    RET

; =============================================================================
; Get Tile At Pixel
; Input: R0 = pixel X, R1 = pixel Y
; Output: R0 = tile index (0 = empty/no collision)
;
; Converts pixel coordinates to tile coordinates and reads tile from tilemap
; =============================================================================

get_tile_at_pixel:
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5

    ; Convert pixel coords to tile coords by dividing by 16 (shift right 4)
    ; tile_x = pixel_x >> 4
    ; tile_y = pixel_y >> 4
    SHR R0
    SHR R0
    SHR R0
    SHR R0              ; R0 = tile_x

    SHR R1
    SHR R1
    SHR R1
    SHR R1              ; R1 = tile_y

    ; Check bounds - branch if out of bounds (R0 >= MAP_WIDTH or R1 >= MAP_HEIGHT)
    LD R2, [MAP_WIDTH]
    CMP R0, R2
    BRC .tile_out_of_bounds     ; Branch if R0 >= R2 (carry set)

    LD R2, [MAP_HEIGHT]
    CMP R1, R2
    BRC .tile_out_of_bounds     ; Branch if R1 >= R2 (carry set)

    ; Calculate tile offset: (tile_y * map_width + tile_x) * 2 + header
    ; Use R4:R5 as 16-bit accumulator (R4=high, R5=low)
    ; First: tile_y * map_width (8-bit result is fine for small maps)
    LD R2, [MAP_WIDTH]
    LD R3, #0           ; Result accumulator

    ; Multiply R1 (tile_y) by R2 (map_width)
    ; Simple loop multiplication
    CMP R1, #0
    BRZ .mult_done

.mult_loop:
    ADD R3, R2
    DEC R1
    BRNZ .mult_loop

.mult_done:
    ; R3 = tile_y * map_width
    ; Add tile_x
    ADD R3, R0          ; R3 = tile_y * map_width + tile_x

    ; Now build 16-bit address in R4:R5
    ; Start with base address $8000 + TILEMAP_DATA_OFFSET = $8008
    LD R4, #$80
    LD R5, #TILEMAP_DATA_OFFSET

    ; Add (tile_index * 2) to R5, with carry to R4
    ; First add R3 (this is tile_index)
    ADD R5, R3
    BRNC .no_carry1
    INC R4
.no_carry1:
    ; Add R3 again (multiply by 2)
    ADD R5, R3
    BRNC .no_carry2
    INC R4
.no_carry2:

    ; Switch to tilemap data bank
    LD R0, #TILEMAP_BANK
    ST R0, [BANK_REG]

    ; Read tile index from banked memory at R4:R5
    LD R0, [R4:R5]

    ; Tile index 0 = empty/no collision, non-zero = solid
    JMP .tile_done

.tile_out_of_bounds:
    LD R0, #0

.tile_done:
    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    RET

; =============================================================================
; Read Tilemap Header
; Reads width and height from .tbin header
; =============================================================================

read_tilemap_header:
    PUSH R0

    ; Hardcoded for now - matches actual tilemap
    LD R0, #16
    ST R0, [MAP_WIDTH]
    LD R0, #10
    ST R0, [MAP_HEIGHT]

    POP R0
    RET

; =============================================================================
; Setup Tilemap Registers
; =============================================================================

setup_tilemap:
    PUSH R0

    ; Set graphics bank (tile graphics in cartridge bank 2)
    LD R0, #TILE_GFX_BANK
    ST R0, [TILEMAP_GFX_BANK]

    ; Set tilemap data bank (cartridge bank 4)
    LD R0, #TILEMAP_BANK
    ST R0, [TILEMAP_DATA_BANK]

    ; Set tilemap data address (skip 8-byte header)
    LD R0, #(TILEMAP_DATA_OFFSET >> 8)
    ST R0, [TILEMAP_ADDR_HI]
    LD R0, #(TILEMAP_DATA_OFFSET & $FF)
    ST R0, [TILEMAP_ADDR_LO]

    ; Set tilemap dimensions
    LD R0, [MAP_WIDTH]
    ST R0, [TILEMAP_WIDTH]
    LD R0, [MAP_HEIGHT]
    ST R0, [TILEMAP_HEIGHT]

    ; Initialize scroll to 0
    LD R0, #0
    ST R0, [TILEMAP_X_SCROLL_LO]
    ST R0, [TILEMAP_X_SCROLL_HI]
    ST R0, [TILEMAP_Y_SCROLL_LO]
    ST R0, [TILEMAP_Y_SCROLL_HI]

    ; Initialize animation frame
    ST R0, [TILE_ANIM_FRAME]

    ; Enable tilemap
    LD R0, #TM_ENABLE
    ST R0, [TILEMAP_ENABLE]

    POP R0
    RET

; =============================================================================
; Setup Scanline Palette Map
; All scanlines use palette block 0
; =============================================================================

setup_scanline_map:
    PUSH R0
    PUSH R2
    PUSH R3
    PUSH R4

    ; R2:R3 = address pointer ($0600)
    LD R2, #$06
    LD R3, #$00

    ; All 160 scanlines = palette block 1
    LD R0, #1
    LD R4, #160

.scanline_loop:
    ST R0, [R2:R3]
    INC R3
    DEC R4
    BRNZ .scanline_loop

    POP R4
    POP R3
    POP R2
    POP R0
    RET

; =============================================================================
; Clear Screen
; Fills framebuffer with color 0 (black/transparent)
; =============================================================================

clear_screen:
    PUSH R0
    PUSH R2
    PUSH R3
    PUSH R4

    ; R2:R3 = address pointer (0xB000)
    LD R2, #$B0
    LD R3, #$00

    ; 0x5000 bytes = 80 pages of 256 bytes
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

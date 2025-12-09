; Platformer Example
; Displays a tilemap and a player sprite that can move around
; Player cannot move into tiles (collision detection)
;
; Uses the sprite_manager runtime for world-space game objects
;
; Assumes:
; - Tile graphics are in cartridge bank 2 (absolute bank 18)
; - Tilemap data (.tbin file) is in cartridge bank 4 (absolute bank 20)
; - Player sprite graphics are in cartridge bank 5 (absolute bank 21)
; - Level sprites (.sbin file) are in cartridge bank 6 (absolute bank 22)
;
; Architecture:
; - Main loop: handles input, physics, and game logic in world space
; - VBlank handler: renders world sprites to hardware SAT

.org $0B00

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
.define FRAMEBUFFER_BANK    0

; =============================================================================
; Game Constants
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
.define LEVEL_SPRITES_BANK  22      ; Cartridge bank 6 = absolute 22

; Tilemap data offset (skip 8-byte .tbin header)
.define TILEMAP_DATA_OFFSET 8

; Tilemap enable flags
.define TM_ENABLE           $01

; Controller button masks
.define BTN_UP              $80
.define BTN_DOWN            $40
.define BTN_LEFT            $20
.define BTN_RIGHT           $10
.define BTN_C               $02     ; Jump button

; =============================================================================
; Physics Constants
; =============================================================================

.define GRAVITY             4       ; Gravity per frame (1/16 pixel units)
.define MAX_FALL_SPEED      64      ; Max fall speed (1/16 pixel units)
.define JUMP_VELOCITY       84      ; Initial jump velocity
.define MOVE_SPEED          32      ; Max horizontal speed (1/16 pixel units)
.define MOVE_ACCEL          8       ; Horizontal acceleration
.define MOVE_FRICTION       6       ; Horizontal friction

; =============================================================================
; Game Variables (sprite manager uses $2000-$220F)
; =============================================================================

; Player physics state
.define PLAYER_VEL_X        $2210   ; Horizontal velocity (signed)
.define PLAYER_VEL_Y        $2211   ; Vertical velocity (signed)
.define PLAYER_SUB_X        $2212   ; X sub-pixel accumulator
.define PLAYER_SUB_Y        $2213   ; Y sub-pixel accumulator
.define PLAYER_ON_GROUND    $2214   ; 1 if on ground
.define PLAYER_JUMP_HELD    $2215   ; 1 if jump button held

; Player animation state
.define PLAYER_FACING       $2216   ; 0=right, 1=left
.define PLAYER_ANIM_TIMER   $2217   ; Animation frame timer
.define PLAYER_ANIM_FRAME   $2218   ; Current animation frame

; Map data
.define MAP_WIDTH           $221A   ; Tilemap width in tiles
.define MAP_HEIGHT          $221B   ; Tilemap height in tiles
.define MAP_PIXEL_WIDTH_LO  $221C   ; Map width in pixels (low)
.define MAP_PIXEL_WIDTH_HI  $221D   ; Map width in pixels (high)
.define MAX_SCROLL_X_LO     $221E   ; Max scroll X (low)
.define MAX_SCROLL_X_HI     $221F   ; Max scroll X (high)

; Temporary variables for collision
.define TEMP_X_LO           $2220
.define TEMP_X_HI           $2221
.define TEMP_Y_LO           $2222
.define TEMP_Y_HI           $2223

; Controller state (cached for main loop)
.define CTRL_STATE          $2224

; Frame sync flag
.define VBLANK_FLAG         $2225   ; Set by VBlank, cleared by main loop

; Animation constants
.define ANIM_SPEED          8

; Starfield variables
.define STAR_X_RAM          $2230   ; 96 bytes for star X positions
.define STAR_FRAME          $2290   ; Frame counter

; Starfield constants
.define STAR_COUNT          96
.define STARS_PER_LAYER     32
.define SPEED_FAST          3
.define SPEED_MED           2
.define SPEED_SLOW          1
.define STAR_COLOR_BLACK    0
.define STAR_COLOR_CLOSE    14
.define STAR_COLOR_MED      13
.define STAR_COLOR_FAR      12

; =============================================================================
; Entry Point
; =============================================================================

main:
    ; Disable interrupts during setup
    CLI

    ; Set video mode 0 (256x160 @ 4bpp)
    LD R0, #0
    ST R0, [VIDEO_MODE]

    ; Clear framebuffer
    CALL clear_screen

    ; Set up scanline palette map
    CALL setup_scanline_map

    ; Initialize sprite manager
    CALL sprite_table_init

    ; Read tilemap header to get dimensions
    CALL read_tilemap_header

    ; Calculate map bounds
    CALL calc_map_bounds

    ; Configure tilemap registers
    CALL setup_tilemap

    ; Load level sprites from SBIN
    LD R0, #LEVEL_SPRITES_BANK  ; SBIN bank
    LD R1, #PLAYER_SPRITE_BANK  ; Graphics bank base
    CALL load_level_sprites

    ; Initialize player (slot 0 in world sprite table)
    CALL init_player

    ; Initialize starfield
    CALL init_star_positions

    ; Clear frame sync flag
    LD R0, #0
    ST R0, [VBLANK_FLAG]

    ; Clear pending interrupt flags
    LD R0, #$FF
    ST R0, [INT_STATUS]

    ; Install VBlank handler
    LD R0, #(vblank_handler & $FF)
    ST R0, [VBLANK_VEC_LO]
    LD R0, #(vblank_handler >> 8)
    ST R0, [VBLANK_VEC_HI]

    ; Enable VBlank interrupt
    LD R0, #$01
    ST R0, [INT_ENABLE]

    ; Enable interrupts
    SEI

    ; Fall through to main loop

; =============================================================================
; Main Game Loop
; Runs continuously, handles game logic in world space
; =============================================================================

main_loop:
    ; Wait for VBlank (frame sync)
    ; This ensures we only update once per frame
.wait_vblank:
    LD R0, [VBLANK_FLAG]
    CMP R0, #0
    BRZ .wait_vblank

    ; Clear VBlank flag
    LD R0, #0
    ST R0, [VBLANK_FLAG]

    ; Cache controller state for this frame
    LD R0, [CTRL1_STATE]
    ST R0, [CTRL_STATE]

    ; --- Game Logic Updates (world space) ---

    ; Handle horizontal input
    CALL handle_horizontal_input

    ; Handle jump input
    CALL handle_jump_input

    ; Apply gravity
    CALL apply_gravity

    ; Apply velocities and collision detection
    CALL apply_horizontal_velocity
    CALL apply_vertical_velocity

    ; Update player animation (modifies world sprite slot 0)
    CALL update_player_animation

    ; Loop back
    JMP main_loop

; =============================================================================
; VBlank Interrupt Handler
; Runs at 60Hz - renders world to screen
; =============================================================================

vblank_handler:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5

    ; Clear VBlank interrupt flag
    LD R0, #$01
    ST R0, [INT_STATUS]

    ; Set frame sync flag for main loop
    LD R0, #1
    ST R0, [VBLANK_FLAG]

    ; Increment tile animation frame
    LD R0, [TILE_ANIM_FRAME]
    INC R0
    ST R0, [TILE_ANIM_FRAME]

    ; Update starfield (in framebuffer bank)
    CALL update_starfield

    ; Update camera to follow player
    LD R0, [MAP_PIXEL_WIDTH_LO]
    LD R1, [MAP_PIXEL_WIDTH_HI]
    CALL update_camera_follow

    ; Update hardware tilemap scroll registers
    LD R0, [SM_SCROLL_X_LO]
    ST R0, [TILEMAP_X_SCROLL_LO]
    LD R0, [SM_SCROLL_X_HI]
    ST R0, [TILEMAP_X_SCROLL_HI]

    ; Render all world sprites to hardware SAT
    CALL render_world_sprites

    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RTI

; =============================================================================
; Initialize Player
; Sets up player in world sprite table slot 0
; =============================================================================

init_player:
    PUSH R0

    ; Set player world position (start near top-left)
    LD R0, #32
    ST R0, [PLAYER_WORLD_X_LO]
    LD R0, #0
    ST R0, [PLAYER_WORLD_X_HI]
    LD R0, #16
    ST R0, [PLAYER_WORLD_Y_LO]
    LD R0, #0
    ST R0, [PLAYER_WORLD_Y_HI]

    ; Set player sprite (index 2 = rest facing right)
    LD R0, #2
    ST R0, [PLAYER_SPRITE_IDX]

    ; Set player flags (no flip, front priority)
    LD R0, #$00
    ST R0, [PLAYER_FLAGS]

    ; Set player graphics bank
    LD R0, #PLAYER_SPRITE_BANK
    ST R0, [PLAYER_BANK]

    ; Activate player sprite
    LD R0, #1
    ST R0, [PLAYER_ACTIVE]

    ; Initialize physics state
    LD R0, #0
    ST R0, [PLAYER_VEL_X]
    ST R0, [PLAYER_VEL_Y]
    ST R0, [PLAYER_SUB_X]
    ST R0, [PLAYER_SUB_Y]
    ST R0, [PLAYER_ON_GROUND]
    ST R0, [PLAYER_JUMP_HELD]

    ; Initialize animation state
    ST R0, [PLAYER_FACING]
    ST R0, [PLAYER_ANIM_FRAME]
    LD R0, #ANIM_SPEED
    ST R0, [PLAYER_ANIM_TIMER]

    POP R0
    RET

; =============================================================================
; Physics Functions
; =============================================================================

; -----------------------------------------------------------------------------
; Handle Horizontal Input
; -----------------------------------------------------------------------------
handle_horizontal_input:
    PUSH R0
    PUSH R1
    PUSH R2

    LD R2, [CTRL_STATE]

    ; Check LEFT button
    MOV R0, R2
    AND R0, #BTN_LEFT
    BRZ .check_right_input

    ; Left pressed - accelerate left
    LD R0, [PLAYER_VEL_X]
    SUB R0, #MOVE_ACCEL
    ; Clamp to -MOVE_SPEED (0xE0 = -32)
    MOV R1, R0
    AND R1, #$80
    BRZ .store_vel_x_left
    CMP R0, #$E0
    BRC .store_vel_x_left
    LD R0, #$E0

.store_vel_x_left:
    ST R0, [PLAYER_VEL_X]
    LD R0, #1
    ST R0, [PLAYER_FACING]
    JMP .horiz_done

.check_right_input:
    MOV R0, R2
    AND R0, #BTN_RIGHT
    BRZ .apply_friction

    ; Right pressed - accelerate right
    LD R0, [PLAYER_VEL_X]
    ADD R0, #MOVE_ACCEL
    ; Clamp to +MOVE_SPEED
    MOV R1, R0
    AND R1, #$80
    BRNZ .store_vel_x_right
    CMP R0, #MOVE_SPEED
    BRNC .store_vel_x_right
    LD R0, #MOVE_SPEED

.store_vel_x_right:
    ST R0, [PLAYER_VEL_X]
    LD R0, #0
    ST R0, [PLAYER_FACING]
    JMP .horiz_done

.apply_friction:
    LD R0, [PLAYER_VEL_X]
    CMP R0, #0
    BRZ .horiz_done

    MOV R1, R0
    AND R1, #$80
    BRNZ .friction_negative

    ; Positive velocity
    CMP R0, #MOVE_FRICTION
    BRNC .friction_to_zero_pos
    SUB R0, #MOVE_FRICTION
    ST R0, [PLAYER_VEL_X]
    JMP .horiz_done

.friction_to_zero_pos:
    LD R0, #0
    ST R0, [PLAYER_VEL_X]
    JMP .horiz_done

.friction_negative:
    ADD R0, #MOVE_FRICTION
    MOV R1, R0
    AND R1, #$80
    BRZ .friction_to_zero_neg
    ST R0, [PLAYER_VEL_X]
    JMP .horiz_done

.friction_to_zero_neg:
    LD R0, #0
    ST R0, [PLAYER_VEL_X]

.horiz_done:
    POP R2
    POP R1
    POP R0
    RET

; -----------------------------------------------------------------------------
; Handle Jump Input
; -----------------------------------------------------------------------------
handle_jump_input:
    PUSH R0
    PUSH R1
    PUSH R2

    LD R2, [CTRL_STATE]

    MOV R0, R2
    AND R0, #BTN_C
    BRZ .jump_not_pressed

    ; Jump pressed - check if already held
    LD R0, [PLAYER_JUMP_HELD]
    CMP R0, #0
    BRNZ .jump_done

    ; Check if on ground
    LD R0, [PLAYER_ON_GROUND]
    CMP R0, #0
    BRZ .jump_done

    ; Initiate jump
    LD R0, #$AC               ; -84 = -JUMP_VELOCITY
    ST R0, [PLAYER_VEL_Y]

    LD R0, #0
    ST R0, [PLAYER_ON_GROUND]

    LD R0, #1
    ST R0, [PLAYER_JUMP_HELD]
    JMP .jump_done

.jump_not_pressed:
    LD R0, #0
    ST R0, [PLAYER_JUMP_HELD]

.jump_done:
    POP R2
    POP R1
    POP R0
    RET

; -----------------------------------------------------------------------------
; Apply Gravity
; -----------------------------------------------------------------------------
apply_gravity:
    PUSH R0
    PUSH R1

    LD R0, [PLAYER_ON_GROUND]
    CMP R0, #0
    BRZ .do_gravity

    LD R0, [PLAYER_VEL_Y]
    MOV R1, R0
    AND R1, #$80
    BRNZ .do_gravity
    JMP .gravity_done

.do_gravity:
    LD R0, [PLAYER_VEL_Y]
    ADD R0, #GRAVITY

    ; Clamp to MAX_FALL_SPEED
    MOV R1, R0
    AND R1, #$80
    BRNZ .gravity_store
    CMP R0, #MAX_FALL_SPEED
    BRNC .gravity_store
    LD R0, #MAX_FALL_SPEED

.gravity_store:
    ST R0, [PLAYER_VEL_Y]

.gravity_done:
    POP R1
    POP R0
    RET

; -----------------------------------------------------------------------------
; Apply Horizontal Velocity
; -----------------------------------------------------------------------------
apply_horizontal_velocity:
    PUSH R0
    PUSH R1
    PUSH R3

    LD R0, [PLAYER_VEL_X]
    CMP R0, #0
    BRNZ .has_horiz_vel
    JMP .horiz_vel_done

.has_horiz_vel:
    MOV R1, R0
    AND R1, #$80
    BRNZ .move_left_vel

    ; Moving right
    LD R1, [PLAYER_SUB_X]
    ADD R1, R0
    MOV R3, R1
    SHR R3
    SHR R3
    SHR R3
    SHR R3
    CMP R3, #0
    BRZ .store_sub_x_right

.move_right_loop:
    CALL try_move_right_1px
    CMP R0, #0
    BRZ .hit_wall_right
    DEC R3
    BRNZ .move_right_loop
    AND R1, #$0F
    JMP .store_sub_x_right

.hit_wall_right:
    LD R0, #0
    ST R0, [PLAYER_VEL_X]
    LD R1, #0

.store_sub_x_right:
    ST R1, [PLAYER_SUB_X]
    JMP .horiz_vel_done

.move_left_vel:
    XOR R0, #$FF
    INC R0

    LD R1, [PLAYER_SUB_X]
    ADD R1, R0
    MOV R3, R1
    SHR R3
    SHR R3
    SHR R3
    SHR R3
    CMP R3, #0
    BRZ .store_sub_x_left

.move_left_loop:
    CALL try_move_left_1px
    CMP R0, #0
    BRZ .hit_wall_left
    DEC R3
    BRNZ .move_left_loop
    AND R1, #$0F
    JMP .store_sub_x_left

.hit_wall_left:
    LD R0, #0
    ST R0, [PLAYER_VEL_X]
    LD R1, #0

.store_sub_x_left:
    ST R1, [PLAYER_SUB_X]

.horiz_vel_done:
    POP R3
    POP R1
    POP R0
    RET

; -----------------------------------------------------------------------------
; Apply Vertical Velocity
; -----------------------------------------------------------------------------
apply_vertical_velocity:
    PUSH R0
    PUSH R1
    PUSH R3

    LD R0, [PLAYER_VEL_Y]
    CMP R0, #0
    BRNZ .has_vert_vel
    JMP .check_ground_below

.has_vert_vel:
    MOV R1, R0
    AND R1, #$80
    BRNZ .move_up_vel

    ; Moving down (falling)
    LD R1, #0
    ST R1, [PLAYER_ON_GROUND]

    LD R1, [PLAYER_SUB_Y]
    ADD R1, R0
    MOV R3, R1
    SHR R3
    SHR R3
    SHR R3
    SHR R3
    CMP R3, #0
    BRZ .store_sub_y_down

.move_down_loop:
    CALL try_move_down_1px
    CMP R0, #0
    BRZ .hit_ground
    DEC R3
    BRNZ .move_down_loop
    AND R1, #$0F
    JMP .store_sub_y_down

.hit_ground:
    LD R0, #1
    ST R0, [PLAYER_ON_GROUND]
    LD R0, #0
    ST R0, [PLAYER_VEL_Y]
    LD R1, #0

.store_sub_y_down:
    ST R1, [PLAYER_SUB_Y]
    JMP .vert_vel_done

.move_up_vel:
    LD R1, #0
    ST R1, [PLAYER_ON_GROUND]

    XOR R0, #$FF
    INC R0

    LD R1, [PLAYER_SUB_Y]
    ADD R1, R0
    MOV R3, R1
    SHR R3
    SHR R3
    SHR R3
    SHR R3
    CMP R3, #0
    BRZ .store_sub_y_up

.move_up_loop:
    CALL try_move_up_1px
    CMP R0, #0
    BRZ .hit_ceiling
    DEC R3
    BRNZ .move_up_loop
    AND R1, #$0F
    JMP .store_sub_y_up

.hit_ceiling:
    LD R0, #0
    ST R0, [PLAYER_VEL_Y]
    LD R1, #0

.store_sub_y_up:
    ST R1, [PLAYER_SUB_Y]
    JMP .vert_vel_done

.check_ground_below:
    ; Check if still on ground
    LD R0, [PLAYER_WORLD_X_LO]
    ST R0, [TEMP_X_LO]
    LD R0, [PLAYER_WORLD_X_HI]
    ST R0, [TEMP_X_HI]
    LD R0, [PLAYER_WORLD_Y_LO]
    INC R0
    ST R0, [TEMP_Y_LO]
    LD R0, [PLAYER_WORLD_Y_HI]
    ST R0, [TEMP_Y_HI]
    CALL check_collision
    CMP R0, #0
    BRNZ .still_on_ground
    LD R0, #0
    ST R0, [PLAYER_ON_GROUND]
    JMP .vert_vel_done

.still_on_ground:
    LD R0, #1
    ST R0, [PLAYER_ON_GROUND]

.vert_vel_done:
    POP R3
    POP R1
    POP R0
    RET

; =============================================================================
; Movement Helper Functions
; =============================================================================

try_move_right_1px:
    PUSH R1
    PUSH R2

    ; Check map bounds
    LD R0, [PLAYER_WORLD_X_LO]
    LD R1, [PLAYER_WORLD_X_HI]
    ADD R0, #16
    BRNC .tmr_no_carry_check
    INC R1
.tmr_no_carry_check:
    LD R2, [MAP_PIXEL_WIDTH_HI]
    CMP R1, R2
    BRC .tmr_blocked
    BRNZ .tmr_check_lo
    LD R2, [MAP_PIXEL_WIDTH_LO]
    CMP R0, R2
    BRC .tmr_blocked
.tmr_check_lo:

    ; Calculate new position
    LD R0, [PLAYER_WORLD_X_LO]
    LD R1, [PLAYER_WORLD_X_HI]
    INC R0
    BRNZ .tmr_no_inc_hi
    INC R1
.tmr_no_inc_hi:
    ST R0, [TEMP_X_LO]
    ST R1, [TEMP_X_HI]
    LD R0, [PLAYER_WORLD_Y_LO]
    ST R0, [TEMP_Y_LO]
    LD R0, [PLAYER_WORLD_Y_HI]
    ST R0, [TEMP_Y_HI]

    CALL check_collision
    CMP R0, #0
    BRNZ .tmr_blocked

    ; Apply move
    LD R0, [TEMP_X_LO]
    ST R0, [PLAYER_WORLD_X_LO]
    LD R0, [TEMP_X_HI]
    ST R0, [PLAYER_WORLD_X_HI]
    LD R0, #1
    JMP .tmr_done

.tmr_blocked:
    LD R0, #0

.tmr_done:
    POP R2
    POP R1
    RET

try_move_left_1px:
    PUSH R1

    ; Check map bounds
    LD R0, [PLAYER_WORLD_X_LO]
    LD R1, [PLAYER_WORLD_X_HI]
    CMP R1, #0
    BRNZ .tml_not_at_edge
    CMP R0, #0
    BRZ .tml_blocked

.tml_not_at_edge:
    ; Calculate new position
    LD R0, [PLAYER_WORLD_X_LO]
    LD R1, [PLAYER_WORLD_X_HI]
    CMP R0, #0
    BRNZ .tml_no_borrow
    DEC R1
.tml_no_borrow:
    DEC R0
    ST R0, [TEMP_X_LO]
    ST R1, [TEMP_X_HI]
    LD R0, [PLAYER_WORLD_Y_LO]
    ST R0, [TEMP_Y_LO]
    LD R0, [PLAYER_WORLD_Y_HI]
    ST R0, [TEMP_Y_HI]

    CALL check_collision
    CMP R0, #0
    BRNZ .tml_blocked

    LD R0, [TEMP_X_LO]
    ST R0, [PLAYER_WORLD_X_LO]
    LD R0, [TEMP_X_HI]
    ST R0, [PLAYER_WORLD_X_HI]
    LD R0, #1
    JMP .tml_done

.tml_blocked:
    LD R0, #0

.tml_done:
    POP R1
    RET

try_move_down_1px:
    PUSH R1

    ; Check screen bounds (Y is still limited to 160 for this game)
    LD R0, [PLAYER_WORLD_Y_LO]
    CMP R0, #144
    BRC .tmd_blocked

    INC R0
    ST R0, [TEMP_Y_LO]
    LD R0, [PLAYER_WORLD_Y_HI]
    ST R0, [TEMP_Y_HI]
    LD R0, [PLAYER_WORLD_X_LO]
    ST R0, [TEMP_X_LO]
    LD R0, [PLAYER_WORLD_X_HI]
    ST R0, [TEMP_X_HI]

    CALL check_collision
    CMP R0, #0
    BRNZ .tmd_blocked

    LD R0, [TEMP_Y_LO]
    ST R0, [PLAYER_WORLD_Y_LO]
    LD R0, #1
    JMP .tmd_done

.tmd_blocked:
    LD R0, #0

.tmd_done:
    POP R1
    RET

try_move_up_1px:
    PUSH R1

    LD R0, [PLAYER_WORLD_Y_LO]
    CMP R0, #1
    BRNC .tmu_blocked

    DEC R0
    ST R0, [TEMP_Y_LO]
    LD R0, [PLAYER_WORLD_Y_HI]
    ST R0, [TEMP_Y_HI]
    LD R0, [PLAYER_WORLD_X_LO]
    ST R0, [TEMP_X_LO]
    LD R0, [PLAYER_WORLD_X_HI]
    ST R0, [TEMP_X_HI]

    CALL check_collision
    CMP R0, #0
    BRNZ .tmu_blocked

    LD R0, [TEMP_Y_LO]
    ST R0, [PLAYER_WORLD_Y_LO]
    LD R0, #1
    JMP .tmu_done

.tmu_blocked:
    LD R0, #0

.tmu_done:
    POP R1
    RET

; =============================================================================
; Collision Detection
; =============================================================================

check_collision:
    PUSH R1
    PUSH R2
    PUSH R3

    ; Check all 4 corners
    LD R0, [TEMP_X_LO]
    LD R1, [TEMP_X_HI]
    LD R2, [TEMP_Y_LO]
    CALL get_tile_at_pixel
    CMP R0, #0
    BRNZ .collision_found

    ; Top-right
    LD R0, [TEMP_X_LO]
    LD R1, [TEMP_X_HI]
    ADD R0, #15
    BRNC .cc_tr_no_carry
    INC R1
.cc_tr_no_carry:
    LD R2, [TEMP_Y_LO]
    CALL get_tile_at_pixel
    CMP R0, #0
    BRNZ .collision_found

    ; Bottom-left
    LD R0, [TEMP_X_LO]
    LD R1, [TEMP_X_HI]
    LD R2, [TEMP_Y_LO]
    ADD R2, #15
    CALL get_tile_at_pixel
    CMP R0, #0
    BRNZ .collision_found

    ; Bottom-right
    LD R0, [TEMP_X_LO]
    LD R1, [TEMP_X_HI]
    ADD R0, #15
    BRNC .cc_br_no_carry
    INC R1
.cc_br_no_carry:
    LD R2, [TEMP_Y_LO]
    ADD R2, #15
    CALL get_tile_at_pixel
    CMP R0, #0
    BRNZ .collision_found

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
; Input: R0:R1 = pixel X (R0=low, R1=high), R2 = pixel Y
; Output: R0 = tile index (0 = empty)
; =============================================================================

get_tile_at_pixel:
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5

    ; Convert pixel X to tile X (16-bit >> 4)
    SHR R1
    ROR R0
    SHR R1
    ROR R0
    SHR R1
    ROR R0
    SHR R1
    ROR R0              ; R0 = tile_x

    ; Convert pixel Y to tile Y
    SHR R2
    SHR R2
    SHR R2
    SHR R2              ; R2 = tile_y

    ; Bounds check
    LD R3, [MAP_WIDTH]
    CMP R0, R3
    BRC .tile_out_of_bounds

    LD R3, [MAP_HEIGHT]
    CMP R2, R3
    BRC .tile_out_of_bounds

    ; Calculate offset: (tile_y * map_width + tile_x) * 2 + header
    MOV R1, R0          ; Save tile_x

    LD R4, #0
    LD R5, #0

    LD R3, [MAP_WIDTH]
    CMP R2, #0
    BRZ .mult_done

.mult_loop:
    ADD R5, R3
    BRNC .no_carry_mult
    INC R4
.no_carry_mult:
    DEC R2
    BRNZ .mult_loop

.mult_done:
    ADD R5, R1
    BRNC .no_carry_add_x
    INC R4
.no_carry_add_x:

    SHL R5
    ROL R4

    ADD R5, #TILEMAP_DATA_OFFSET
    BRNC .no_carry_base
    INC R4
.no_carry_base:
    ADD R4, #$80

    ; Switch to tilemap bank
    LD R0, #TILEMAP_BANK
    ST R0, [BANK_REG]

    LD R0, [R4:R5]
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
; Update Player Animation
; =============================================================================

update_player_animation:
    PUSH R0
    PUSH R1

    LD R0, [PLAYER_VEL_X]
    CMP R0, #0
    BRZ .player_at_rest

    ; Animate
    LD R0, [PLAYER_ANIM_TIMER]
    DEC R0
    BRNZ .timer_not_zero

    LD R0, #ANIM_SPEED
    ST R0, [PLAYER_ANIM_TIMER]

    LD R0, [PLAYER_ANIM_FRAME]
    XOR R0, #1
    ST R0, [PLAYER_ANIM_FRAME]
    JMP .set_sprite_index

.timer_not_zero:
    ST R0, [PLAYER_ANIM_TIMER]

.set_sprite_index:
    LD R0, [PLAYER_FACING]
    CMP R0, #0
    BRNZ .facing_left_anim

    ; Facing right - sprites 1-2
    LD R0, [PLAYER_ANIM_FRAME]
    INC R0
    JMP .store_sprite_index

.facing_left_anim:
    ; Facing left - sprites 3-4
    LD R0, [PLAYER_ANIM_FRAME]
    ADD R0, #3
    JMP .store_sprite_index

.player_at_rest:
    LD R0, #0
    ST R0, [PLAYER_ANIM_FRAME]
    LD R0, #ANIM_SPEED
    ST R0, [PLAYER_ANIM_TIMER]

    LD R0, [PLAYER_FACING]
    CMP R0, #0
    BRNZ .rest_facing_left

    LD R0, #2
    JMP .store_sprite_index

.rest_facing_left:
    LD R0, #4

.store_sprite_index:
    ST R0, [PLAYER_SPRITE_IDX]

    POP R1
    POP R0
    RET

; =============================================================================
; Tilemap Setup
; =============================================================================

read_tilemap_header:
    PUSH R0

    LD R0, #TILEMAP_BANK
    ST R0, [BANK_REG]

    LD R0, [$8000]
    ST R0, [MAP_WIDTH]

    LD R0, [$8002]
    ST R0, [MAP_HEIGHT]

    POP R0
    RET

calc_map_bounds:
    PUSH R0
    PUSH R1
    PUSH R2

    LD R0, [MAP_WIDTH]
    LD R1, #0

    SHL R0
    ROL R1
    SHL R0
    ROL R1
    SHL R0
    ROL R1
    SHL R0
    ROL R1

    ST R0, [MAP_PIXEL_WIDTH_LO]
    ST R1, [MAP_PIXEL_WIDTH_HI]

    CMP R1, #1
    BRNC .map_too_small
    BRZ .check_exact
    JMP .calc_max_scroll

.check_exact:
    CMP R0, #0
    BRZ .map_too_small
    JMP .calc_max_scroll

.map_too_small:
    LD R0, #0
    ST R0, [MAX_SCROLL_X_LO]
    ST R0, [MAX_SCROLL_X_HI]
    JMP .calc_bounds_done

.calc_max_scroll:
    LD R0, [MAP_PIXEL_WIDTH_LO]
    LD R1, [MAP_PIXEL_WIDTH_HI]
    DEC R1
    ST R0, [MAX_SCROLL_X_LO]
    ST R1, [MAX_SCROLL_X_HI]

.calc_bounds_done:
    POP R2
    POP R1
    POP R0
    RET

setup_tilemap:
    PUSH R0

    LD R0, #TILE_GFX_BANK
    ST R0, [TILEMAP_GFX_BANK]

    LD R0, #TILEMAP_BANK
    ST R0, [TILEMAP_DATA_BANK]

    LD R0, #(TILEMAP_DATA_OFFSET >> 8)
    ST R0, [TILEMAP_ADDR_HI]
    LD R0, #(TILEMAP_DATA_OFFSET & $FF)
    ST R0, [TILEMAP_ADDR_LO]

    LD R0, [MAP_WIDTH]
    ST R0, [TILEMAP_WIDTH]
    LD R0, [MAP_HEIGHT]
    ST R0, [TILEMAP_HEIGHT]

    LD R0, #0
    ST R0, [TILEMAP_X_SCROLL_LO]
    ST R0, [TILEMAP_X_SCROLL_HI]
    ST R0, [TILEMAP_Y_SCROLL_LO]
    ST R0, [TILEMAP_Y_SCROLL_HI]
    ST R0, [TILE_ANIM_FRAME]

    LD R0, #TM_ENABLE
    ST R0, [TILEMAP_ENABLE]

    POP R0
    RET

; =============================================================================
; Scanline and Screen Setup
; =============================================================================

setup_scanline_map:
    PUSH R0
    PUSH R2
    PUSH R3
    PUSH R4

    LD R2, #$06
    LD R3, #$00
    LD R0, #4
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

clear_screen:
    PUSH R0
    PUSH R2
    PUSH R3
    PUSH R4

    LD R0, #FRAMEBUFFER_BANK
    ST R0, [BANK_REG]

    LD R2, #$B0
    LD R3, #$00
    LD R4, #$50
    LD R0, #0

.cs_outer:
.cs_inner:
    ST R0, [R2:R3]
    INC R3
    BRNZ .cs_inner

    INC R2
    DEC R4
    BRNZ .cs_outer

    POP R4
    POP R3
    POP R2
    POP R0
    RET

; =============================================================================
; Starfield Routines
; =============================================================================

init_star_positions:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5

    LD R0, #(star_x_coords_init >> 8)
    LD R1, #(star_x_coords_init & $FF)
    LD R2, #(STAR_X_RAM >> 8)
    LD R3, #(STAR_X_RAM & $FF)
    LD R4, #STAR_COUNT

.isp_copy_loop:
    LD R5, [R0:R1]
    ST R5, [R2:R3]
    INC R1
    BRNZ .isp_no_carry_src
    INC R0
.isp_no_carry_src:
    INC R3
    BRNZ .isp_no_carry_dst
    INC R2
.isp_no_carry_dst:
    DEC R4
    BRNZ .isp_copy_loop

    LD R0, #0
    ST R0, [STAR_FRAME]

    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RET

update_starfield:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5

    LD R0, #FRAMEBUFFER_BANK
    ST R0, [BANK_REG]

    LD R0, [STAR_FRAME]
    XOR R0, #1
    ST R0, [STAR_FRAME]

    CMP R0, #1
    BRZ .usf_skip_update

    ; Erase stars
    LD R0, #0
    LD R1, #STARS_PER_LAYER
    LD R2, #STAR_COLOR_BLACK
    CALL draw_stars

    LD R0, #32
    LD R1, #STARS_PER_LAYER
    LD R2, #STAR_COLOR_BLACK
    CALL draw_stars

    LD R0, #64
    LD R1, #STARS_PER_LAYER
    LD R2, #STAR_COLOR_BLACK
    CALL draw_stars

    ; Update positions
    LD R0, #0
    LD R1, #STARS_PER_LAYER
    LD R2, #SPEED_FAST
    CALL update_star_positions

    LD R0, #32
    LD R1, #STARS_PER_LAYER
    LD R2, #SPEED_MED
    CALL update_star_positions

    LD R0, #64
    LD R1, #STARS_PER_LAYER
    LD R2, #SPEED_SLOW
    CALL update_star_positions

.usf_skip_update:
    ; Draw stars
    LD R0, #0
    LD R1, #STARS_PER_LAYER
    LD R2, #STAR_COLOR_CLOSE
    CALL draw_stars

    LD R0, #32
    LD R1, #STARS_PER_LAYER
    LD R2, #STAR_COLOR_MED
    CALL draw_stars

    LD R0, #64
    LD R1, #STARS_PER_LAYER
    LD R2, #STAR_COLOR_FAR
    CALL draw_stars

    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RET

update_star_positions:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5

    MOV R3, R0
    MOV R4, R1
    MOV R5, R2

.usp_loop:
    CMP R4, #0
    BRZ .usp_done

    LD R0, #(STAR_X_RAM >> 8)
    LD R1, #(STAR_X_RAM & $FF)
    ADD R1, R3
    BRNC .usp_no_carry
    INC R0
.usp_no_carry:

    LD R2, [R0:R1]
    SUB R2, R5

    BRNC .usp_wrap
    ST R2, [R0:R1]
    JMP .usp_next

.usp_wrap:
    LD R2, #255
    ST R2, [R0:R1]

.usp_next:
    INC R3
    DEC R4
    JMP .usp_loop

.usp_done:
    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RET

draw_stars:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5

    MOV R3, R0
    MOV R4, R1
    MOV R5, R2

.ds_loop:
    CMP R4, #0
    BRZ .ds_done

    LD R0, #(STAR_X_RAM >> 8)
    LD R1, #(STAR_X_RAM & $FF)
    ADD R1, R3
    BRNC .ds_no_carry_x
    INC R0
.ds_no_carry_x:
    LD R0, [R0:R1]

    PUSH R0
    LD R0, #(star_y_coords >> 8)
    LD R1, #(star_y_coords & $FF)
    ADD R1, R3
    BRNC .ds_no_carry_y
    INC R0
.ds_no_carry_y:
    LD R1, [R0:R1]
    POP R0

    MOV R2, R5
    CALL draw_pixel

    INC R3
    DEC R4
    JMP .ds_loop

.ds_done:
    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
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
    BRC .dp_exit

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
    BRNC .dp_no_carry
    INC R3
.dp_no_carry:

    ADD R3, #$B0

    LD R5, [R3:R4]

    AND R0, #1
    BRNZ .dp_odd_pixel

    AND R5, #$0F
    SHL R2
    SHL R2
    SHL R2
    SHL R2
    OR R5, R2
    JMP .dp_write

.dp_odd_pixel:
    AND R5, #$F0
    AND R2, #$0F
    OR R5, R2

.dp_write:
    ST R5, [R3:R4]

.dp_exit:
    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RET

; =============================================================================
; Data Tables
; =============================================================================

star_x_coords_init:
    .byte 23, 156, 89, 200, 45, 178, 12, 234
    .byte 67, 145, 203, 34, 189, 78, 223, 56
    .byte 134, 201, 92, 167, 28, 215, 101, 189
    .byte 43, 198, 125, 76, 231, 103, 172, 39
    .byte 87, 159, 213, 98, 44, 182, 126, 201
    .byte 71, 149, 227, 109, 183, 52, 197, 88
    .byte 164, 38, 207, 119, 185, 64, 142, 223
    .byte 95, 176, 29, 203, 81, 155, 237, 112
    .byte 47, 192, 135, 73, 219, 99, 168, 31
    .byte 206, 124, 59, 187, 146, 84, 229, 107
    .byte 175, 51, 196, 118, 241, 93, 163, 26
    .byte 209, 137, 68, 195, 115, 173, 49, 221

star_y_coords:
    .byte 45, 123, 78, 12, 156, 89, 134, 23
    .byte 98, 145, 67, 112, 34, 152, 91, 128
    .byte 56, 103, 142, 89, 15, 138, 72, 119
    .byte 149, 28, 95, 136, 61, 108, 143, 82
    .byte 17, 124, 87, 151, 42, 99, 133, 68
    .byte 105, 38, 147, 79, 116, 53, 129, 94
    .byte 31, 118, 85, 139, 64, 111, 146, 26
    .byte 92, 135, 71, 107, 48, 122, 157, 83
    .byte 19, 101, 144, 76, 126, 59, 97, 141
    .byte 24, 114, 88, 131, 52, 109, 148, 73
    .byte 36, 120, 93, 154, 66, 104, 137, 47
    .byte 81, 125, 58, 96, 140, 69, 113, 150


; =============================================================================
; Include Runtime Libraries
; =============================================================================

.include "sprite_manager.asm"

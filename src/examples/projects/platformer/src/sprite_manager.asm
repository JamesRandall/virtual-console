; =============================================================================
; Sprite Manager Runtime Library
; =============================================================================
;
; A reusable library for managing game objects in world space and rendering
; them to the hardware Sprite Attribute Table (SAT).
;
; Usage:
;   1. Include this file in your game
;   2. Call sprite_table_init at startup
;   3. Call load_level_sprites when loading a level (copies SBIN to RAM)
;   4. Update world sprite positions in your main loop
;   5. Call render_world_sprites in your VBlank handler
;
; =============================================================================

; =============================================================================
; Configuration
; =============================================================================

.ifndef WORLD_SPRITE_TABLE
.define WORLD_SPRITE_TABLE      $2000   ; 512 bytes (64 sprites × 8 bytes)
.endif

.ifndef WORLD_SPRITE_MAX
.define WORLD_SPRITE_MAX        64
.endif

.ifndef SPRITE_MGR_VARS
.define SPRITE_MGR_VARS         $2200   ; 16 bytes for sprite manager variables
.endif

; =============================================================================
; Constants
; =============================================================================

.define WORLD_SPRITE_SIZE       8

.define SM_SCREEN_WIDTH         256
.define SM_SCREEN_HEIGHT        160
.define SM_SPRITE_SIZE          16

.define SM_SAT_BASE             $0700
.define SM_SAT_ENTRY_SIZE       5
.define SM_SPRITE_ENABLE        $0104
.define SM_SPRITE_COUNT         $0105
.define SM_BANK_REG             $0100

; World sprite entry field offsets
.define WSP_X_LO                0
.define WSP_X_HI                1
.define WSP_Y_LO                2
.define WSP_Y_HI                3
.define WSP_SPRITE_IDX          4
.define WSP_FLAGS               5
.define WSP_BANK                6
.define WSP_ACTIVE              7

; =============================================================================
; Sprite Manager Variables
; =============================================================================

.define SM_SCROLL_X_LO          (SPRITE_MGR_VARS + 0)
.define SM_SCROLL_X_HI          (SPRITE_MGR_VARS + 1)
.define SM_SCROLL_Y_LO          (SPRITE_MGR_VARS + 2)
.define SM_SCROLL_Y_HI          (SPRITE_MGR_VARS + 3)
.define SM_VISIBLE_COUNT        (SPRITE_MGR_VARS + 4)
.define SM_SBIN_BANK            (SPRITE_MGR_VARS + 5)
.define SM_SBIN_COUNT_LO        (SPRITE_MGR_VARS + 6)
.define SM_SBIN_COUNT_HI        (SPRITE_MGR_VARS + 7)
.define SM_TEMP_0               (SPRITE_MGR_VARS + 8)
.define SM_TEMP_1               (SPRITE_MGR_VARS + 9)
.define SM_TEMP_2               (SPRITE_MGR_VARS + 10)
.define SM_TEMP_3               (SPRITE_MGR_VARS + 11)
.define SM_SRC_HI               (SPRITE_MGR_VARS + 12)
.define SM_SRC_LO               (SPRITE_MGR_VARS + 13)
.define SM_DST_HI               (SPRITE_MGR_VARS + 14)
.define SM_DST_LO               (SPRITE_MGR_VARS + 15)

; =============================================================================
; Player Convenience Aliases (Slot 0)
; =============================================================================

.define PLAYER_WORLD_X_LO       (WORLD_SPRITE_TABLE + 0)
.define PLAYER_WORLD_X_HI       (WORLD_SPRITE_TABLE + 1)
.define PLAYER_WORLD_Y_LO       (WORLD_SPRITE_TABLE + 2)
.define PLAYER_WORLD_Y_HI       (WORLD_SPRITE_TABLE + 3)
.define PLAYER_SPRITE_IDX       (WORLD_SPRITE_TABLE + 4)
.define PLAYER_FLAGS            (WORLD_SPRITE_TABLE + 5)
.define PLAYER_BANK             (WORLD_SPRITE_TABLE + 6)
.define PLAYER_ACTIVE           (WORLD_SPRITE_TABLE + 7)

; =============================================================================
; sprite_table_init
; =============================================================================
sprite_table_init:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3

    ; Clear all world sprite entries (512 bytes = 2 pages)
    LD R2, #(WORLD_SPRITE_TABLE >> 8)
    LD R3, #(WORLD_SPRITE_TABLE & $FF)
    LD R0, #0
    LD R1, #0

.sti_clear_loop:
    ST R0, [R2:R3]
    INC R3
    BRNZ .sti_clear_loop
    INC R2
    INC R1
    CMP R1, #2
    BRNZ .sti_clear_loop

    ; Initialize scroll to 0
    LD R0, #0
    ST R0, [SM_SCROLL_X_LO]
    ST R0, [SM_SCROLL_X_HI]
    ST R0, [SM_SCROLL_Y_LO]
    ST R0, [SM_SCROLL_Y_HI]
    ST R0, [SM_VISIBLE_COUNT]

    ; Enable sprites
    LD R0, #1
    ST R0, [SM_SPRITE_ENABLE]

    POP R3
    POP R2
    POP R1
    POP R0
    RET

; =============================================================================
; load_level_sprites
; =============================================================================
; Inputs: R0 = SBIN bank, R1 = Graphics bank base
; Output: R0 = sprites loaded
; =============================================================================

load_level_sprites:
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5

    ; Save graphics bank base
    ST R1, [SM_TEMP_0]

    ; Switch to SBIN bank
    ST R0, [SM_BANK_REG]

    ; Read sprite count
    LD R0, [$8000]
    ST R0, [SM_SBIN_COUNT_LO]

    ; Cap to WORLD_SPRITE_MAX - 1
    LD R4, [SM_SBIN_COUNT_LO]
    CMP R4, #(WORLD_SPRITE_MAX - 1)
    BRNC .lls_count_ok
    LD R4, #(WORLD_SPRITE_MAX - 1)
.lls_count_ok:

    CMP R4, #0
    BRNZ .lls_start
    JMP .lls_done

.lls_start:
    LD R5, #0                   ; Sprites loaded counter

.lls_copy_entry:
    ; Calculate source: $8008 + (R5 * 8)
    MOV R0, R5
    SHL R0
    SHL R0
    SHL R0
    ADD R0, #$08
    LD R1, #$80
    BRNC .lls_src_ok
    INC R1
.lls_src_ok:
    ST R1, [SM_SRC_HI]
    ST R0, [SM_SRC_LO]

    ; Calculate dest: WORLD_SPRITE_TABLE + ((R5 + 1) * 8)
    MOV R0, R5
    INC R0
    SHL R0
    SHL R0
    SHL R0
    LD R1, #(WORLD_SPRITE_TABLE & $FF)
    ADD R1, R0
    LD R0, #(WORLD_SPRITE_TABLE >> 8)
    BRNC .lls_dst_ok
    INC R0
.lls_dst_ok:
    ST R0, [SM_DST_HI]
    ST R1, [SM_DST_LO]

    ; Copy 8 bytes using register pairs
    ; Byte 0: x_lo
    LD R2, [SM_SRC_HI]
    LD R3, [SM_SRC_LO]
    LD R0, [R2:R3]
    LD R2, [SM_DST_HI]
    LD R3, [SM_DST_LO]
    ST R0, [R2:R3]

    ; Byte 1: x_hi
    LD R2, [SM_SRC_HI]
    LD R3, [SM_SRC_LO]
    INC R3
    LD R0, [R2:R3]
    LD R2, [SM_DST_HI]
    LD R3, [SM_DST_LO]
    INC R3
    ST R0, [R2:R3]

    ; Byte 2: y_lo
    LD R2, [SM_SRC_HI]
    LD R3, [SM_SRC_LO]
    ADD R3, #2
    LD R0, [R2:R3]
    LD R2, [SM_DST_HI]
    LD R3, [SM_DST_LO]
    ADD R3, #2
    ST R0, [R2:R3]

    ; Byte 3: y_hi
    LD R2, [SM_SRC_HI]
    LD R3, [SM_SRC_LO]
    ADD R3, #3
    LD R0, [R2:R3]
    LD R2, [SM_DST_HI]
    LD R3, [SM_DST_LO]
    ADD R3, #3
    ST R0, [R2:R3]

    ; Byte 4: sprite_idx
    LD R2, [SM_SRC_HI]
    LD R3, [SM_SRC_LO]
    ADD R3, #4
    LD R0, [R2:R3]
    LD R2, [SM_DST_HI]
    LD R3, [SM_DST_LO]
    ADD R3, #4
    ST R0, [R2:R3]

    ; Byte 5: flags
    LD R2, [SM_SRC_HI]
    LD R3, [SM_SRC_LO]
    ADD R3, #5
    LD R0, [R2:R3]
    LD R2, [SM_DST_HI]
    LD R3, [SM_DST_LO]
    ADD R3, #5
    ST R0, [R2:R3]

    ; Byte 6: bank (add graphics bank base)
    LD R2, [SM_SRC_HI]
    LD R3, [SM_SRC_LO]
    ADD R3, #6
    LD R0, [R2:R3]
    LD R1, [SM_TEMP_0]
    ADD R0, R1
    LD R2, [SM_DST_HI]
    LD R3, [SM_DST_LO]
    ADD R3, #6
    ST R0, [R2:R3]

    ; Byte 7: active = 1
    LD R2, [SM_DST_HI]
    LD R3, [SM_DST_LO]
    ADD R3, #7
    LD R0, #1
    ST R0, [R2:R3]

    ; Next sprite
    INC R5
    CMP R5, R4
    BRZ .lls_done
    JMP .lls_copy_entry

.lls_done:
    MOV R0, R5

    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    RET

; =============================================================================
; render_world_sprites
; =============================================================================
render_world_sprites:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3
    PUSH R4
    PUSH R5

    LD R4, #0                   ; World sprite index
    LD R5, #0                   ; SAT slot

.rws_loop:
    CMP R4, #WORLD_SPRITE_MAX
    BRZ .rws_done_jmp
    CMP R5, #128
    BRZ .rws_done_jmp
    JMP .rws_process
.rws_done_jmp:
    JMP .rws_done

.rws_process:
    ; Calculate world sprite address
    MOV R0, R4
    SHL R0
    SHL R0
    SHL R0
    LD R1, #(WORLD_SPRITE_TABLE & $FF)
    ADD R1, R0
    LD R0, #(WORLD_SPRITE_TABLE >> 8)
    BRNC .rws_addr_ok
    INC R0
.rws_addr_ok:
    ; R0:R1 = base address, save it
    ST R0, [SM_SRC_HI]
    ST R1, [SM_SRC_LO]

    ; Check if active (offset 7)
    ADD R1, #WSP_ACTIVE
    BRNC .rws_active_ok
    INC R0
.rws_active_ok:
    LD R2, [R0:R1]
    CMP R2, #0
    BRNZ .rws_is_active
    JMP .rws_next
.rws_is_active:

    ; Read world position from sprite entry
    LD R0, [SM_SRC_HI]
    LD R1, [SM_SRC_LO]

    ; x_lo
    LD R2, [R0:R1]
    ST R2, [SM_TEMP_0]
    INC R1
    ; x_hi
    LD R2, [R0:R1]
    ST R2, [SM_TEMP_1]
    INC R1
    ; y_lo
    LD R2, [R0:R1]
    ST R2, [SM_TEMP_2]
    INC R1
    ; y_hi
    LD R2, [R0:R1]
    ST R2, [SM_TEMP_3]

    ; Calculate screen X = world_x - scroll_x
    LD R0, [SM_TEMP_0]
    LD R1, [SM_SCROLL_X_LO]
    SUB R0, R1
    ST R0, [SM_TEMP_0]
    LD R0, [SM_TEMP_1]
    LD R1, [SM_SCROLL_X_HI]
    SUB R0, R1
    ST R0, [SM_TEMP_1]

    ; Check X bounds - high byte must be 0 or 0xFF
    LD R0, [SM_TEMP_1]
    CMP R0, #0
    BRZ .rws_x_ok
    CMP R0, #$FF
    BRZ .rws_x_neg
    JMP .rws_next
.rws_x_neg:
    ; Negative, check >= -16 (0xF0-0xFF)
    LD R0, [SM_TEMP_0]
    CMP R0, #$F0
    BRC .rws_x_ok
    JMP .rws_next
.rws_x_ok:

    ; Calculate screen Y = world_y - scroll_y
    LD R0, [SM_TEMP_2]
    LD R1, [SM_SCROLL_Y_LO]
    SUB R0, R1
    ST R0, [SM_TEMP_2]
    LD R0, [SM_TEMP_3]
    LD R1, [SM_SCROLL_Y_HI]
    SUB R0, R1
    ST R0, [SM_TEMP_3]

    ; Check Y bounds
    LD R0, [SM_TEMP_3]
    CMP R0, #0
    BRZ .rws_y_zero
    CMP R0, #$FF
    BRZ .rws_y_neg
    JMP .rws_next
.rws_y_neg:
    LD R0, [SM_TEMP_2]
    CMP R0, #$F0
    BRC .rws_y_ok
    JMP .rws_next
.rws_y_zero:
    LD R0, [SM_TEMP_2]
    CMP R0, #SM_SCREEN_HEIGHT
    BRNC .rws_y_ok
    JMP .rws_next
.rws_y_ok:

    ; Sprite is visible - write to SAT
    ; Calculate SAT address: SM_SAT_BASE + (R5 * 5)
    MOV R0, R5
    MOV R1, R0
    SHL R0
    SHL R0
    ADD R0, R1                  ; R0 = R5 * 5
    LD R1, #(SM_SAT_BASE & $FF)
    ADD R1, R0
    LD R0, #(SM_SAT_BASE >> 8)
    BRNC .rws_sat_ok
    INC R0
.rws_sat_ok:
    ; R0:R1 = SAT address
    ST R0, [SM_DST_HI]
    ST R1, [SM_DST_LO]

    ; Write X
    LD R2, [SM_DST_HI]
    LD R3, [SM_DST_LO]
    LD R0, [SM_TEMP_0]
    ST R0, [R2:R3]

    ; Write Y
    INC R3
    LD R0, [SM_TEMP_2]
    ST R0, [R2:R3]

    ; Read sprite_idx, flags, bank from world sprite
    LD R0, [SM_SRC_HI]
    LD R1, [SM_SRC_LO]
    ADD R1, #WSP_SPRITE_IDX
    BRNC .rws_idx_ok
    INC R0
.rws_idx_ok:

    ; Write sprite_idx
    LD R2, [R0:R1]              ; R2 = sprite_idx
    LD R0, [SM_DST_HI]
    LD R1, [SM_DST_LO]
    ADD R1, #2
    BRNC .rws_idx_dst_ok
    INC R0
.rws_idx_dst_ok:
    ST R2, [R0:R1]

    ; Write flags
    LD R0, [SM_SRC_HI]
    LD R1, [SM_SRC_LO]
    ADD R1, #WSP_FLAGS
    BRNC .rws_flags_src_ok
    INC R0
.rws_flags_src_ok:
    LD R2, [R0:R1]              ; R2 = flags
    LD R0, [SM_DST_HI]
    LD R1, [SM_DST_LO]
    ADD R1, #3
    BRNC .rws_flags_dst_ok
    INC R0
.rws_flags_dst_ok:
    ST R2, [R0:R1]

    ; Write bank
    LD R0, [SM_SRC_HI]
    LD R1, [SM_SRC_LO]
    ADD R1, #WSP_BANK
    BRNC .rws_bank_src_ok
    INC R0
.rws_bank_src_ok:
    LD R2, [R0:R1]              ; R2 = bank
    LD R0, [SM_DST_HI]
    LD R1, [SM_DST_LO]
    ADD R1, #4
    BRNC .rws_bank_dst_ok
    INC R0
.rws_bank_dst_ok:
    ST R2, [R0:R1]

    ; Next SAT slot
    INC R5

.rws_next:
    INC R4
    JMP .rws_loop

.rws_done:
    ST R5, [SM_VISIBLE_COUNT]
    ST R5, [SM_SPRITE_COUNT]

    POP R5
    POP R4
    POP R3
    POP R2
    POP R1
    POP R0
    RET

; =============================================================================
; activate_world_sprite
; =============================================================================
activate_world_sprite:
    PUSH R0
    PUSH R1
    PUSH R2

    SHL R0
    SHL R0
    SHL R0
    ADD R0, #WSP_ACTIVE
    LD R1, #(WORLD_SPRITE_TABLE & $FF)
    ADD R1, R0
    LD R0, #(WORLD_SPRITE_TABLE >> 8)
    BRNC .aws_ok
    INC R0
.aws_ok:
    LD R2, #1
    ST R2, [R0:R1]

    POP R2
    POP R1
    POP R0
    RET

; =============================================================================
; deactivate_world_sprite
; =============================================================================
deactivate_world_sprite:
    PUSH R0
    PUSH R1
    PUSH R2

    SHL R0
    SHL R0
    SHL R0
    ADD R0, #WSP_ACTIVE
    LD R1, #(WORLD_SPRITE_TABLE & $FF)
    ADD R1, R0
    LD R0, #(WORLD_SPRITE_TABLE >> 8)
    BRNC .dws_ok
    INC R0
.dws_ok:
    LD R2, #0
    ST R2, [R0:R1]

    POP R2
    POP R1
    POP R0
    RET

; =============================================================================
; update_camera_follow
; =============================================================================
; Inputs: R0 = map width lo, R1 = map width hi
; =============================================================================

.define SM_CENTER_OFFSET_X      120

update_camera_follow:
    PUSH R0
    PUSH R1
    PUSH R2
    PUSH R3

    ; Save map width
    ST R0, [SM_TEMP_0]
    ST R1, [SM_TEMP_1]

    ; Target scroll = player_x - center
    LD R0, [PLAYER_WORLD_X_LO]
    LD R1, [PLAYER_WORLD_X_HI]
    SUB R0, #SM_CENTER_OFFSET_X
    BRC .ucf_no_borrow
    DEC R1
.ucf_no_borrow:

    ; Check if negative
    MOV R2, R1
    AND R2, #$80
    BRNZ .ucf_clamp_zero

    ; Calculate max scroll = map_width - 256
    LD R2, [SM_TEMP_0]
    LD R3, [SM_TEMP_1]
    DEC R3

    ; Compare scroll with max
    CMP R1, R3
    BRC .ucf_clamp_max
    BRNZ .ucf_scroll_ok
    CMP R0, R2
    BRC .ucf_clamp_max

.ucf_scroll_ok:
    ST R0, [SM_SCROLL_X_LO]
    ST R1, [SM_SCROLL_X_HI]
    JMP .ucf_done

.ucf_clamp_zero:
    LD R0, #0
    ST R0, [SM_SCROLL_X_LO]
    ST R0, [SM_SCROLL_X_HI]
    JMP .ucf_done

.ucf_clamp_max:
    ST R2, [SM_SCROLL_X_LO]
    ST R3, [SM_SCROLL_X_HI]

.ucf_done:
    POP R3
    POP R2
    POP R1
    POP R0
    RET

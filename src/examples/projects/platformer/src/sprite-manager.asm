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
.define SPRITE_MGR_VARS         $2280   ; 16 bytes for sprite manager variables
.endif

; =============================================================================
; Constants
; =============================================================================

.define WORLD_SPRITE_SIZE       10      ; Extended to include typeId and direction

.define SM_SCREEN_WIDTH         256
.define SM_SCREEN_HEIGHT        160
.define SM_SPRITE_SIZE          16

.define SM_SAT_BASE             $0700
.define SM_SAT_ENTRY_SIZE       6       ; 6 bytes per SAT entry (9-bit coordinates)
.define SM_SPRITE_ENABLE        $0104
.define SM_SPRITE_COUNT         $0105
.define SM_BANK_REG             $0100

; SAT entry field offsets (hardware format)
.define SAT_X_LO                0       ; X position low byte
.define SAT_Y_LO                1       ; Y position low byte
.define SAT_SPRITE_IDX          2       ; Sprite graphics index
.define SAT_FLAGS               3       ; Attribute flags
.define SAT_BANK                4       ; Graphics bank
.define SAT_XY_HI               5       ; High bits: bit 0 = X bit 8, bit 1 = Y bit 8

; World sprite entry field offsets (game format - 16-bit coordinates)
.define WSP_X_LO                0
.define WSP_X_HI                1
.define WSP_Y_LO                2
.define WSP_Y_HI                3
.define WSP_SPRITE_IDX          4
.define WSP_FLAGS               5
.define WSP_BANK                6
.define WSP_ACTIVE              7
.define WSP_TYPE_ID             8       ; Game-specific type (from SBIN)
.define WSP_DIRECTION           9       ; Movement direction (0=left, 1=right)

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
    PUSH R4

    ; Clear all world sprite entries (640 bytes = 64 sprites × 10 bytes)
    ; 640 = 256 + 256 + 128 = 2 full pages + 128 bytes
    LD R2, #(WORLD_SPRITE_TABLE >> 8)
    LD R3, #(WORLD_SPRITE_TABLE & $FF)
    LD R0, #0
    LD R1, #0                       ; Page counter

    ; Clear 2 full pages (512 bytes)
.sti_clear_loop:
    ST R0, [R2:R3]
    INC R3
    BRNZ .sti_clear_loop
    INC R2
    INC R1
    CMP R1, #2
    BRNZ .sti_clear_loop

    ; Clear remaining 128 bytes
    LD R4, #128
.sti_clear_rest:
    ST R0, [R2:R3]
    INC R3
    DEC R4
    BRNZ .sti_clear_rest

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

    POP R4
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

    ; Calculate dest: WORLD_SPRITE_TABLE + ((R5 + 1) * 10)
    ; x * 10 = (x << 3) + (x << 1)
    MOV R0, R5
    INC R0                          ; R0 = R5 + 1
    MOV R1, R0                      ; R1 = R5 + 1 (save copy)
    SHL R0
    SHL R0
    SHL R0                          ; R0 = (R5 + 1) * 8
    SHL R1                          ; R1 = (R5 + 1) * 2
    ADD R0, R1                      ; R0 = (R5 + 1) * 10
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

    ; Byte 8: typeId (from SBIN offset 7)
    LD R2, [SM_SRC_HI]
    LD R3, [SM_SRC_LO]
    ADD R3, #7
    LD R0, [R2:R3]
    LD R2, [SM_DST_HI]
    LD R3, [SM_DST_LO]
    ADD R3, #WSP_TYPE_ID
    ST R0, [R2:R3]

    ; Byte 9: direction = 0 (start moving left)
    LD R2, [SM_DST_HI]
    LD R3, [SM_DST_LO]
    ADD R3, #WSP_DIRECTION
    LD R0, #0
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
    ; Calculate world sprite address: R4 * 10
    ; x * 10 = (x << 3) + (x << 1)
    MOV R0, R4
    MOV R1, R4
    SHL R0
    SHL R0
    SHL R0                          ; R0 = R4 * 8
    SHL R1                          ; R1 = R4 * 2
    ADD R0, R1                      ; R0 = R4 * 10
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

    ; Calculate screen X = world_x - scroll_x (16-bit subtraction)
    ; Use simple approach: subtract low bytes, check carry for borrow
    ; SM_TEMP_0 = world_x_lo, SM_TEMP_1 = world_x_hi (already loaded)

    ; Low byte subtraction
    LD R0, [SM_TEMP_0]          ; world_x low
    LD R1, [SM_SCROLL_X_LO]     ; scroll_x low
    SUB R0, R1                  ; R0 = world_lo - scroll_lo
    ST R0, [SM_TEMP_0]          ; store screen_x low

    ; Check if borrow needed: carry is SET if result >= 0, CLEAR if < 0
    ; After SUB, if carry is CLEAR, we need to borrow from high byte
    LD R0, [SM_TEMP_1]          ; world_x high
    LD R1, [SM_SCROLL_X_HI]     ; scroll_x high
    SUB R0, R1                  ; R0 = world_hi - scroll_hi
    ; If original low subtraction had borrow, we need to decrement
    ; But SUB doesn't chain carry! So we need different approach.

    ; Save high result temporarily
    ST R0, [SM_TEMP_1]          ; store (world_hi - scroll_hi)

    ; Now check if we need borrow: compare world_lo with scroll_lo
    LD R0, [SM_TEMP_0]          ; reload screen_x_lo (result of world_lo - scroll_lo)
    ; If world_lo < scroll_lo, there was a borrow
    ; We can tell by re-adding scroll_lo to result and seeing if it equals world_lo
    ; Actually simpler: just compare the original values
    ; world_lo is at sprite entry, scroll_lo is at SM_SCROLL_X_LO
    ; But we already stored world_lo in SM_TEMP_0 before modifying it... wait, no we didn't

    ; Re-read from sprite entry to get original world_x_lo
    LD R0, [SM_SRC_HI]
    LD R1, [SM_SRC_LO]
    LD R2, [R0:R1]              ; R2 = original world_x_lo
    LD R0, [SM_SCROLL_X_LO]     ; R0 = scroll_x_lo
    CMP R2, R0                  ; world_lo - scroll_lo
    BRC .rws_x_no_borrow        ; if carry set (world_lo >= scroll_lo), no borrow needed

    ; Borrow needed: decrement high byte
    LD R0, [SM_TEMP_1]
    DEC R0
    ST R0, [SM_TEMP_1]

.rws_x_no_borrow:
    ; Check X bounds - sprite visible if screen_x in range -16 to (SCREEN_WIDTH-1)
    ; With 9-bit coordinates in SAT, we can use full range
    ; High byte 0x00 = positive (0-255)
    ; High byte 0xFF = negative (-256 to -1)
    ; For visibility: -16 <= screen_x < SCREEN_WIDTH (256)
    LD R0, [SM_TEMP_1]
    CMP R0, #0
    BRZ .rws_x_ok               ; High=0: screen X is 0-255, always visible
    CMP R0, #$FF
    BRNZ .rws_x_skip            ; High not 0 or FF: way off screen (> 255 or < -256)
    ; High byte is 0xFF (negative) - check if partially visible (-16 to -1)
    LD R0, [SM_TEMP_0]
    CMP R0, #$F0                ; screen_x >= -16 (0xF0 in low byte with 0xFF high)?
    BRC .rws_x_ok               ; Low >= 0xF0 means -16 to -1, partially visible on left
.rws_x_skip:
    JMP .rws_next
.rws_x_ok:

    ; Calculate screen Y = world_y - scroll_y (16-bit subtraction with borrow)
    ; Compare low bytes to determine if borrow is needed
    LD R0, [SM_TEMP_2]          ; world_y low
    LD R1, [SM_SCROLL_Y_LO]     ; scroll_y low
    CMP R0, R1                  ; world_y_lo - scroll_y_lo (sets carry if world >= scroll)
    BRC .rws_y_no_borrow_needed ; If carry SET, world_lo >= scroll_lo, no borrow

    ; Borrow needed: world_y_lo < scroll_y_lo
    SUB R0, R1                  ; R0 = world_y_lo - scroll_y_lo (wraps)
    ST R0, [SM_TEMP_2]          ; screen_y low
    LD R0, [SM_TEMP_3]          ; world_y high
    LD R1, [SM_SCROLL_Y_HI]     ; scroll_y high
    SUB R0, R1                  ; high - high
    DEC R0                      ; subtract the borrow
    ST R0, [SM_TEMP_3]          ; screen_y high
    JMP .rws_y_calc_done

.rws_y_no_borrow_needed:
    ; No borrow: world_y_lo >= scroll_y_lo
    SUB R0, R1                  ; R0 = world_y_lo - scroll_y_lo
    ST R0, [SM_TEMP_2]          ; screen_y low
    LD R0, [SM_TEMP_3]          ; world_y high
    LD R1, [SM_SCROLL_Y_HI]     ; scroll_y high
    SUB R0, R1                  ; high - high (no borrow)
    ST R0, [SM_TEMP_3]          ; screen_y high
.rws_y_calc_done:

    ; Check Y bounds - sprite visible if screen_y in range -16 to 159
    LD R0, [SM_TEMP_3]
    CMP R0, #0
    BRZ .rws_y_check_low        ; High=0: check if low byte < 160
    CMP R0, #$FF
    BRNZ .rws_skip_y            ; High not 0 or FF: way off screen
    ; High byte is 0xFF (negative)
    LD R0, [SM_TEMP_2]
    CMP R0, #$F0
    BRC .rws_y_ok               ; Low >= 0xF0 means -16 to -1, partially visible
    JMP .rws_next
.rws_y_check_low:
    LD R0, [SM_TEMP_2]
    CMP R0, #SM_SCREEN_HEIGHT
    BRNC .rws_y_ok              ; Low < 160, on screen
.rws_skip_y:
    JMP .rws_next
.rws_y_ok:

    ; Sprite is visible - write to SAT
    ; Calculate SAT address: SM_SAT_BASE + (R5 * 6)
    ; R5 * 6 = R5 * 4 + R5 * 2 = (R5 << 2) + (R5 << 1)
    MOV R0, R5
    SHL R0                      ; R0 = R5 * 2
    MOV R1, R0                  ; R1 = R5 * 2
    SHL R0                      ; R0 = R5 * 4
    ADD R0, R1                  ; R0 = R5 * 6
    LD R1, #(SM_SAT_BASE & $FF)
    ADD R1, R0
    LD R0, #(SM_SAT_BASE >> 8)
    BRNC .rws_sat_ok
    INC R0
.rws_sat_ok:
    ; R0:R1 = SAT address
    ST R0, [SM_DST_HI]
    ST R1, [SM_DST_LO]

    ; Write X_LO (SAT offset 0)
    LD R2, [SM_DST_HI]
    LD R3, [SM_DST_LO]
    LD R0, [SM_TEMP_0]          ; screen_x low byte
    ST R0, [R2:R3]

    ; Write Y_LO (SAT offset 1)
    INC R3
    LD R0, [SM_TEMP_2]          ; screen_y low byte
    ST R0, [R2:R3]

    ; Read sprite_idx from world sprite
    LD R0, [SM_SRC_HI]
    LD R1, [SM_SRC_LO]
    ADD R1, #WSP_SPRITE_IDX
    BRNC .rws_idx_ok
    INC R0
.rws_idx_ok:

    ; Write sprite_idx (SAT offset 2)
    LD R2, [R0:R1]              ; R2 = sprite_idx
    LD R0, [SM_DST_HI]
    LD R1, [SM_DST_LO]
    ADD R1, #SAT_SPRITE_IDX
    BRNC .rws_idx_dst_ok
    INC R0
.rws_idx_dst_ok:
    ST R2, [R0:R1]

    ; Write flags (SAT offset 3)
    LD R0, [SM_SRC_HI]
    LD R1, [SM_SRC_LO]
    ADD R1, #WSP_FLAGS
    BRNC .rws_flags_src_ok
    INC R0
.rws_flags_src_ok:
    LD R2, [R0:R1]              ; R2 = flags
    LD R0, [SM_DST_HI]
    LD R1, [SM_DST_LO]
    ADD R1, #SAT_FLAGS
    BRNC .rws_flags_dst_ok
    INC R0
.rws_flags_dst_ok:
    ST R2, [R0:R1]

    ; Write bank (SAT offset 4)
    LD R0, [SM_SRC_HI]
    LD R1, [SM_SRC_LO]
    ADD R1, #WSP_BANK
    BRNC .rws_bank_src_ok
    INC R0
.rws_bank_src_ok:
    LD R2, [R0:R1]              ; R2 = bank
    LD R0, [SM_DST_HI]
    LD R1, [SM_DST_LO]
    ADD R1, #SAT_BANK
    BRNC .rws_bank_dst_ok
    INC R0
.rws_bank_dst_ok:
    ST R2, [R0:R1]

    ; Write XY_HI byte (SAT offset 5)
    ; Build XY_HI: bit 0 = X high bit (from SM_TEMP_1), bit 1 = Y high bit (from SM_TEMP_3)
    ; If screen coordinate high byte is 0xFF, the coordinate is negative, so set the high bit
    LD R2, #0                   ; Start with XY_HI = 0
    LD R0, [SM_TEMP_1]          ; screen_x high byte
    CMP R0, #$FF
    BRNZ .rws_x_hi_done
    OR R2, #$01                 ; Set bit 0 (X high bit)
.rws_x_hi_done:
    LD R0, [SM_TEMP_3]          ; screen_y high byte
    CMP R0, #$FF
    BRNZ .rws_y_hi_done
    OR R2, #$02                 ; Set bit 1 (Y high bit)
.rws_y_hi_done:
    ; Write XY_HI to SAT
    LD R0, [SM_DST_HI]
    LD R1, [SM_DST_LO]
    ADD R1, #SAT_XY_HI
    BRNC .rws_xyhi_dst_ok
    INC R0
.rws_xyhi_dst_ok:
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
; Input: R0 = sprite slot index
; =============================================================================
activate_world_sprite:
    PUSH R0
    PUSH R1
    PUSH R2

    ; Calculate offset: R0 * 10 = (R0 << 3) + (R0 << 1)
    MOV R1, R0
    SHL R0
    SHL R0
    SHL R0                          ; R0 = slot * 8
    SHL R1                          ; R1 = slot * 2
    ADD R0, R1                      ; R0 = slot * 10
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
; Input: R0 = sprite slot index
; =============================================================================
deactivate_world_sprite:
    PUSH R0
    PUSH R1
    PUSH R2

    ; Calculate offset: R0 * 10 = (R0 << 3) + (R0 << 1)
    MOV R1, R0
    SHL R0
    SHL R0
    SHL R0                          ; R0 = slot * 8
    SHL R1                          ; R1 = slot * 2
    ADD R0, R1                      ; R0 = slot * 10
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

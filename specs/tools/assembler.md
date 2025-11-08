# Assembler Specification

**Version:** 0.1 Draft  
**Date:** October 18, 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Syntax](#syntax)
3. [Addressing Modes](#addressing-modes)
4. [Directives](#directives)
5. [Number Formats](#number-formats)
6. [Labels and Symbols](#labels-and-symbols)
7. [Expressions](#expressions)
8. [Assembly Process](#assembly-process)
9. [Output Format](#output-format)
10. [Error Handling](#error-handling)

---

## 1. Overview

The assembler translates assembly language source code into machine code for the 8-bit virtual console CPU.

### Design Goals

- Two-pass assembler for forward reference resolution
- Clear, descriptive error messages with line numbers
- Symbol table generation for debugging
- Source map for address-to-line mapping
- Expression evaluation for constants and addresses

### Input

- Plain text assembly source code (UTF-8)
- File extension: `.asm` (convention)

### Output

- Binary machine code (Uint8Array)
- Symbol table (label → address mapping)
- Source map (address → line number mapping)
- Error/warning list

---

## 2. Syntax

### 2.1 Line Format

```
[label:] [opcode [operands]] [; comment]
```

All components are optional (blank lines allowed).

### 2.2 Case Sensitivity

- **Opcodes:** Case-insensitive (`LD`, `ld`, `Ld` all valid)
- **Registers:** Case-insensitive (`R0`, `r0` both valid)
- **Labels:** Case-sensitive (`Main` ≠ `main`)
- **Directives:** Case-insensitive (`.org`, `.ORG` both valid)

### 2.3 Whitespace

- Spaces and tabs are interchangeable
- Multiple spaces/tabs treated as single separator
- Leading and trailing whitespace ignored

### 2.4 Comments

**Single-line comments:** Start with `;` and continue to end of line

```assembly
; This is a comment
LD R0, #42    ; This is also a comment
```

### 2.5 Identifiers

Valid characters for labels and symbols:
- Start with: `A-Z`, `a-z`, `_`, `.`
- Continue with: `A-Z`, `a-z`, `0-9`, `_`, `.`

**Valid identifiers:**
```
main
_start
player_x
.loop
SCREEN_WIDTH
```

**Invalid identifiers:**
```
123start    ; Cannot start with digit
my-label    ; Hyphen not allowed
player x    ; Space not allowed
```

---

## 3. Addressing Modes

### 3.1 Immediate

Load a literal value.

**Syntax:** `#value`

**Examples:**
```assembly
LD R0, #42
ADD R1, #$FF
SUB R2, #%00001111
```

### 3.2 Register Direct

Operate on register contents.

**Syntax:** `Rx` (where x = 0-5)

**Examples:**
```assembly
MOV R0, R1
ADD R2, R3
CMP R4, R5
```

### 3.3 Absolute

Access memory at a 16-bit address.

**Syntax:** `[$addr]` or `[addr]`

**Examples:**
```assembly
LD R0, [$1234]
ST R1, [$C000]
LD R2, [SCREEN_ADDR]
```

### 3.4 Zero Page Indirect

Use a zero page location as a pointer to a 16-bit address.

**Syntax:** `[$zp]` (where zp = 0x00-0xFF)

**Examples:**
```assembly
LD R0, [$80]
ST R1, [$FE]
```

### 3.5 Zero Page Indexed

Use a zero page pointer plus an 8-bit register offset.

**Syntax:** `[$zp+Rx]`

**Examples:**
```assembly
LD R0, [$80+R1]
ST R2, [$FE+R3]
```

### 3.6 Register Pair Indirect

Use a register pair as a 16-bit pointer.

**Syntax:** `[Rx:Ry]`

**Examples:**
```assembly
LD R0, [R2:R3]
ST R1, [R4:R5]
JMP [R0:R1]
```

### 3.7 Relative (Branches)

Branch instructions use relative addressing (±127 bytes). The assembler automatically calculates the offset.

**Syntax:** `label`

**Examples:**
```assembly
BRZ loop
BRNZ done
BRC carry_set
```

---

## 4. Directives

Directives control the assembly process and do not generate CPU instructions.

### 4.1 .org - Set Origin

Set the assembly address (where code will be loaded in memory).

**Syntax:** `.org address`

**Examples:**
```assembly
.org $8000      ; Start assembly at 0x8000
.org $0B00      ; Start assembly at 0x0B00
```

**Default:** If no `.org` is specified, assembly starts at `$0000`.

**Multiple uses:** Each `.org` resets the assembly address. Output addresses are tracked accordingly.

### 4.2 .byte / .db - Define Byte(s)

Define one or more bytes of data.

**Syntax:** `.byte value [, value, ...]`

**Examples:**
```assembly
.byte $12
.byte $12, $34, $56, $78
.db $FF, $00, $AA           ; .db is alias
.byte 'A', 'B', 'C'         ; Character literals
```

### 4.3 .word / .dw - Define Word(s)

Define one or more 16-bit words (little-endian).

**Syntax:** `.word value [, value, ...]`

**Examples:**
```assembly
.word $1234                 ; Stored as: $34 $12
.word $ABCD, $1234
.dw $C000                   ; .dw is alias
.word sprite_table          ; Can use labels
```

### 4.4 .string / .asciiz - Define String

Define null-terminated ASCII string.

**Syntax:** `.string "text"`

**Examples:**
```assembly
.string "Hello, World!"     ; 14 bytes (13 chars + null)
.asciiz "Player 1"          ; .asciiz is alias
```

**Escape sequences:**
- `\n` - Newline (0x0A)
- `\r` - Carriage return (0x0D)
- `\t` - Tab (0x09)
- `\\` - Backslash
- `\"` - Quote
- `\0` - Null (0x00)

### 4.5 .define / .equ - Define Constant

Define a symbolic constant (does not allocate memory).

**Syntax:** `.define name value`

**Examples:**
```assembly
.define SCREEN_WIDTH 256
.define COLOR_BLUE $2A
.equ PLAYER_SPEED 2         ; .equ is alias

; Use in code:
LD R0, #SCREEN_WIDTH
CMP R1, #PLAYER_SPEED
```

**Scope:** Constants are global and available after definition.

### 4.6 .res / .dsb - Reserve Space

Reserve bytes (filled with zeros).

**Syntax:** `.res count`

**Examples:**
```assembly
.res 256        ; Reserve 256 bytes (all $00)
.dsb 10         ; .dsb is alias
```

### 4.7 .align - Align to Boundary

Align the assembly address to the next boundary (filled with zeros).

**Syntax:** `.align boundary`

**Examples:**
```assembly
.align 256      ; Align to next 256-byte boundary
.align 2        ; Align to next even address
```

**Behavior:**
- If current address is already aligned, no padding is added
- Padding bytes are filled with `$00`

---

## 5. Number Formats

### 5.1 Decimal

Default number format (no prefix).

**Examples:**
```assembly
LD R0, #42
ADD R1, #255
```

### 5.2 Hexadecimal

**Formats:**
- `$` prefix (6502 style): `$2A`, `$FF00`
- `0x` prefix (C style): `0x2A`, `0xFF00`

**Examples:**
```assembly
LD R0, #$2A
ST R1, [$0x1234]
```

**Case-insensitive:** `$2a`, `$2A`, `0x2a`, `0x2A` all valid

### 5.3 Binary

**Formats:**
- `%` prefix: `%00101010`
- `0b` prefix: `0b00101010`

**Examples:**
```assembly
LD R0, #%11110000
AND R1, #0b00001111
```

### 5.4 Character Literal

Single character in single quotes.

**Syntax:** `'c'`

**Examples:**
```assembly
LD R0, #'A'     ; Load ASCII 65
CMP R1, #' '    ; Compare with space (ASCII 32)
```

**Escape sequences:** Same as strings (`'\n'`, `'\t'`, etc.)

---

## 6. Labels and Symbols

### 6.1 Label Definition

Labels mark a location in code or data.

**Syntax:** `name:`

**Examples:**
```assembly
main:
    LD R0, #0
    
loop:
    INC R0
    CMP R0, #10
    BRNZ loop
```

**Rules:**
- Must be followed by colon (`:`)
- Can appear on same line as instruction or alone
- Must be unique (no duplicate labels)
- Case-sensitive

### 6.2 Local Labels

Labels starting with `.` are local to the previous non-local label.

**Examples:**
```assembly
main:
    LD R0, #0
.loop:
    INC R0
    CMP R0, #10
    BRNZ .loop      ; References main.loop
    RET

other_func:
.loop:              ; Different from main.loop
    DEC R1
    BRNZ .loop      ; References other_func.loop
    RET
```

**Scope:** Local labels are scoped to the most recent non-local label.

### 6.3 Label References

Labels can be used wherever an address is expected.

**Examples:**
```assembly
JMP main
CALL draw_sprite
LD R0, [player_x]
.word sprite_data
```

### 6.4 Special Symbols

**`$` (current address):**
```assembly
skip_data:
    JMP $+10        ; Jump 10 bytes ahead
    .byte 1,2,3,4,5,6,7,8,9,10
```

---

## 7. Expressions

The assembler evaluates expressions at assembly time.

### 7.1 Operators

**Arithmetic:**
- `+` Addition
- `-` Subtraction
- `*` Multiplication
- `/` Integer division
- `%` Modulo

**Bitwise:**
- `&` AND
- `|` OR
- `^` XOR
- `~` NOT (unary)
- `<<` Shift left
- `>>` Shift right

**Byte Extraction (unary):**
- `<` Low byte (extract bits 0-7 of 16-bit value)
- `>` High byte (extract bits 8-15 of 16-bit value)

**Comparison (result 1 or 0):**
- `==` Equal
- `!=` Not equal
- `<` Less than (binary)
- `>` Greater than (binary)
- `<=` Less than or equal
- `>=` Greater than or equal

**Logical:**
- `&&` Logical AND
- `||` Logical OR
- `!` Logical NOT (unary)

**Note:** The `<` and `>` operators serve dual purposes:
- **Unary (prefix):** Extract low/high byte from 16-bit address or value
- **Binary (infix):** Perform comparison operations

### 7.2 Precedence

From highest to lowest:
1. `()` Parentheses
2. `<`, `>`, `~`, `!`, unary `-` Unary operators (byte extraction, bitwise NOT, logical NOT, negation)
3. `*`, `/`, `%` Multiplicative
4. `+`, `-` Additive
5. `<<`, `>>` Shift
6. `<`, `>`, `<=`, `>=` Comparison (binary)
7. `==`, `!=` Equality
8. `&` Bitwise AND
9. `^` Bitwise XOR
10. `|` Bitwise OR
11. `&&` Logical AND
12. `||` Logical OR

### 7.3 Examples

**Arithmetic and expressions:**
```assembly
.define SCREEN_WIDTH 256
.define SCREEN_HEIGHT 160
.define SCREEN_CENTER_X (SCREEN_WIDTH / 2)
.define SCREEN_SIZE (SCREEN_WIDTH * SCREEN_HEIGHT)

LD R0, #(SCREEN_CENTER_X + 10)
LD R1, #(SCREEN_SIZE >> 8)          ; High byte using shift
```

**Byte extraction with < and > operators:**
```assembly
.org $C000
sprite_data:
    .byte $FF, $00, $AA, $55

main:
    ; Load address of sprite_data into R2:R3 (high:low)
    LD R2, #>sprite_data            ; High byte ($C0)
    LD R3, #<sprite_data            ; Low byte ($00)

    ; Setup interrupt vector
    LD R0, #<vblank_handler
    ST R0, [$0132]                  ; VBLANK_VEC_LO
    LD R0, #>vblank_handler
    ST R0, [$0133]                  ; VBLANK_VEC_HI

    ; Can be used in expressions
    .define BASE_ADDR $8000
    LD R0, #<(BASE_ADDR + 256)      ; Low byte of $8100 = $00
    LD R1, #>(BASE_ADDR + 256)      ; High byte of $8100 = $81

vblank_handler:
    RTI
```

**Comparison operators (binary < and >):**
```assembly
.define MIN_VALUE 10
.define MAX_VALUE 100

    LD R0, [player_x]
    CMP R0, #MIN_VALUE
    ; Note: CMP is the instruction, but < can be used in expressions:
    LD R1, #(MIN_VALUE < MAX_VALUE) ; Result is 1 (true)
    LD R2, #(MAX_VALUE > MIN_VALUE) ; Result is 1 (true)
```

---

## 8. Assembly Process

### 8.1 Two-Pass Assembly

**Pass 1: Symbol Collection**
1. Process directives (`.org`, `.define`)
2. Collect all labels and their addresses
3. Calculate instruction sizes
4. Build symbol table

**Pass 2: Code Generation**
1. Resolve label references
2. Evaluate expressions
3. Generate machine code
4. Build source map

### 8.2 Address Tracking

The assembler maintains a **program counter (PC)** during assembly:
- Initially set by `.org` (or 0 if none)
- Incremented by instruction/data size
- Reset by subsequent `.org` directives

### 8.3 Instruction Encoding

Each instruction is encoded according to the CPU specification:

**1-byte instructions:**
- Register-only operations: `MOV R0, R1`

**2-byte instructions:**
- Immediate: `LD R0, #42`
- Zero page: `LD R0, [$80]`
- Extended instructions: `PUSH R0`

**3-byte instructions:**
- Absolute: `LD R0, [$1234]`
- Jumps: `JMP $8000`

**Branch offset calculation:**
- Branches use relative addressing (±127 bytes)
- Offset = target_address - (current_address + 2)
- Error if offset out of range

---

## 9. Output Format

### 9.1 Binary Output

**Type:** `Uint8Array`

**Contents:** Raw machine code bytes

**Format:**
- Sequential bytes starting from first `.org` address
- Multiple `.org` sections create separate segments (implementation-dependent)

### 9.2 Symbol Table

**Type:** Object/Map

**Format:**
```typescript
{
  "main": 0x8000,
  "loop": 0x8005,
  "player_x": 0x0B00,
  "SCREEN_WIDTH": 256,
  ...
}
```

**Contents:**
- All labels (code and data)
- All constants (`.define`)

### 9.3 Source Map

**Type:** Array of objects

**Format:**
```typescript
[
  { address: 0x8000, line: 5 },
  { address: 0x8002, line: 6 },
  { address: 0x8005, line: 8 },
  ...
]
```

**Purpose:** Map memory addresses back to source line numbers (for debugging)

### 9.4 Listing File (Optional)

Human-readable assembly listing with addresses and machine code.

**Format:**
```
8000: 01 00 2A     main:       LD R0, #42
8003: 04 00 01                 ADD R0, R1
8005: 0C 00 08                 JMP loop
```

---

## 10. Error Handling

### 10.1 Error Types

**Syntax Errors:**
- Unknown opcode
- Invalid operand
- Malformed number
- Invalid character

**Semantic Errors:**
- Undefined label
- Duplicate label
- Branch target out of range
- Invalid addressing mode for instruction

**Expression Errors:**
- Division by zero
- Undefined symbol in expression
- Type mismatch

### 10.2 Error Format

```typescript
interface AssemblerError {
  line: number;           // Source line number (1-based)
  column?: number;        // Column number (1-based, optional)
  message: string;        // Human-readable error message
  severity: 'error' | 'warning';
  suggestion?: string;    // Optional fix suggestion
}
```

### 10.3 Error Examples

```
Error on line 15: Unknown opcode 'LOAD'
  Suggestion: Did you mean 'LD'?

Error on line 23: Undefined label 'player_loop'

Error on line 31: Branch target out of range (distance: 156 bytes, max: 127)
  Suggestion: Use JMP instead of BRZ

Warning on line 8: Label 'old_code' defined but never used

Error on line 42: Division by zero in expression

Error on line 50: Duplicate label 'main' (first defined on line 12)
```

### 10.4 Error Recovery

The assembler should:
- Continue processing after errors when possible
- Report multiple errors in a single pass
- Provide line and column information for all errors
- Offer helpful suggestions where applicable

---

## Appendix A: Instruction Format Summary

| Addressing Mode | Format | Example | Bytes |
|----------------|--------|---------|-------|
| Immediate | `#value` | `LD R0, #42` | 2 |
| Register | `Rx` | `ADD R0, R1` | 1 |
| Absolute | `[$addr]` | `LD R0, [$1234]` | 3 |
| Zero Page | `[$zp]` | `LD R0, [$80]` | 2 |
| ZP Indexed | `[$zp+Rx]` | `LD R0, [$80+R1]` | 2 |
| Reg Pair | `[Rx:Ry]` | `LD R0, [R2:R3]` | 1 |
| Relative | `label` | `BRZ loop` | 2 |

---

## Appendix B: Complete Example

```assembly
; Simple game initialization
.org $8000

; Constants
.define SCREEN_ADDR $C000
.define CTRL_A $08
.define COLOR_BLUE $2A

; Entry point
main:
    ; Initialize palette
    LD R0, #COLOR_BLUE
    ST R0, [$0200]
    
    ; Clear screen
    LD R2, #$C0         ; Screen high byte
    LD R3, #$00         ; Screen low byte
    LD R4, #0           ; Counter
    
.clear_loop:
    LD R0, #0           ; Black
    ST R0, [R2:R3]      ; Write to screen
    
    ; Increment pointer
    INC R3
    BRNZ .clear_loop    ; Continue if low byte didn't wrap
    INC R2              ; Increment high byte
    CMP R2, #$D0        ; Check if done (past screen)
    BRNZ .clear_loop
    
    ; Main game loop
game_loop:
    CALL wait_vblank
    CALL read_input
    CALL update_game
    JMP game_loop

; Wait for VBlank interrupt
wait_vblank:
    LD R0, [$0114]      ; Read INT_STATUS
    AND R0, #$01        ; Check VBlank bit
    BRZ wait_vblank
    
    ; Clear VBlank flag
    LD R0, #$01
    ST R0, [$0114]
    RET

; Read controller input
read_input:
    LD R0, [$0106]      ; Read controller 1
    AND R0, #CTRL_A     ; Check A button
    BRZ .no_button
    
    ; Button pressed - do something
    LD R1, [button_state]
    INC R1
    ST R1, [button_state]
    
.no_button:
    RET

; Update game state
update_game:
    ; Game logic here
    RET

; Data
button_state:
    .byte 0

; Sprite data
sprite_data:
    .byte $FF, $00, $FF, $00
    .byte $00, $FF, $00, $FF
```

---

## Appendix C: Reserved Words

**Opcodes:**
NOP, LD, ST, MOV, ADD, SUB, AND, OR, XOR, SHL, SHR, CMP, JMP, BRZ, BRNZ, BRC, BRNC, BRN, BRNN, BRV, BRNV, CALL, RET, RTI, PUSH, POP, INC, DEC, ROL, ROR, SEI, CLI

**Registers:**
R0, R1, R2, R3, R4, R5, SP, PC

**Directives:**
.org, .byte, .db, .word, .dw, .string, .asciiz, .define, .equ, .res, .dsb, .align

**Note:** Reserved words cannot be used as label names.
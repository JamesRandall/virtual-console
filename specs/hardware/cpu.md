# CPU Architecture Specification

**Version:** 0.1 Draft  
**Date:** October 18, 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Registers](#registers)
3. [Status Flags](#status-flags)
4. [Addressing Modes](#addressing-modes)
5. [Instruction Set](#instruction-set)
6. [Instruction Encoding](#instruction-encoding)
7. [Timing](#timing)

---

## 1. Overview

A custom 8-bit RISC-inspired CPU derived from 6502 principles.

### Key Characteristics

- **Data Width**: 8-bit
- **Address Space**: 16-bit (64KB addressable)
- **Registers**: 6 general-purpose 8-bit registers (R0-R5)
- **Architecture Style**: Load/store with memory-mapped I/O
- **Design Philosophy**: Simplified 6502 with RISC-like orthogonality

---

## 2. Registers

### 2.1 General Purpose Registers (8-bit)

**R0, R1, R2, R3, R4, R5**

- Six 8-bit general-purpose registers
- All registers are equal (no special-purpose designation)
- Can be paired for 16-bit operations:
  - **R0:R1** - Register pair (R0 = high byte, R1 = low byte)
  - **R2:R3** - Register pair
  - **R4:R5** - Register pair

### 2.2 Special Registers (16-bit)

**SP - Stack Pointer**
- 16-bit stack pointer
- Auto-decrements on PUSH operations
- Auto-increments on POP operations
- Can point anywhere in 64KB address space
- Convention: Stack grows downward from 0x7FFF

**PC - Program Counter**
- 16-bit program counter
- Implicit register (not directly accessible)
- Updated by jumps, branches, calls, and returns
- Automatically incremented during instruction fetch

---

## 3. Status Flags

Single 8-bit status register with five active flags:

```
Bit:  7  6  5  4  3  2  1  0
     [N][V][ ][ ][ ][I][Z][C]
```

| Bit | Flag | Name | Description |
|-----|------|------|-------------|
| 7 | N | Negative | Set if bit 7 of result is 1 |
| 6 | V | Overflow | Set on signed arithmetic overflow |
| 5-3 | - | Reserved | Reserved for future use |
| 2 | I | Interrupt Enable | 0=interrupts disabled, 1=interrupts enabled |
| 1 | Z | Zero | Set if result is zero |
| 0 | C | Carry | Set on arithmetic carry/borrow |

### Flag Behavior

**Carry (C)**
- Set by arithmetic operations on overflow
- Used for multi-byte arithmetic
- Affected by: ADD, SUB, SHL, SHR, ROL, ROR, CMP

**Zero (Z)**
- Set when result equals zero
- Affected by: Most ALU operations, LD, CMP

**Negative (N)**
- Set when bit 7 of result is 1
- Used for signed number comparisons
- Affected by: Most ALU operations, LD, CMP

**Overflow (V)**
- Set on signed arithmetic overflow
- Indicates sign bit changed incorrectly
- Affected by: ADD, SUB

**Interrupt Enable (I)**
- Controls hardware interrupt handling
- Set by SEI instruction, cleared by CLI instruction
- When set, allows hardware interrupts to fire
- Automatically cleared when interrupt is triggered
- Restored by RTI instruction

---

## 4. Addressing Modes

### 4.1 Immediate

Load a literal value directly.

**Syntax**: `#value`  
**Example**: `LD R0, #42`  
**Bytes**: 2 (opcode + immediate value)

### 4.2 Register Direct

Operate on register contents.

**Syntax**: `Rx`  
**Example**: `ADD R0, R1`  
**Bytes**: 1

### 4.3 Absolute

Access memory at a fixed 16-bit address.

**Syntax**: `[$addr]`  
**Example**: `LD R0, [$1234]`  
**Bytes**: 3 (opcode + low byte + high byte)

### 4.4 Zero Page Indirect

Use a zero page location (0x00-0xFF) as a pointer to a 16-bit address.

**Syntax**: `[$zp]`  
**Example**: `LD R0, [$80]`  
**Description**: Load from address stored at 0x80-0x81  
**Bytes**: 2 (opcode + zero page address)

**Usage Pattern**:
```assembly
; Setup pointer at $80-$81 pointing to $C000
LD R0, #$C0
ST R0, [$80]     ; Store high byte
LD R0, #$00
ST R0, [$81]     ; Store low byte

; Now use the pointer
LD R1, [$80]     ; Load from $C000
```

### 4.5 Zero Page Indexed

Use a zero page pointer plus an 8-bit register offset.

**Syntax**: `[$zp+Rx]`  
**Example**: `LD R0, [$80+R1]`  
**Description**: Load from (address at $80-$81) + R1  
**Bytes**: 2 (opcode + zero page address + register)

**Usage Pattern**:
```assembly
; Draw 160 pixels
LD R0, #0          ; Index = 0
loop:
  LD R1, #BLUE
  ST R1, [$FE+R0]  ; framebuffer[R0] = color
  INC R0
  CMP R0, #160
  BRNZ loop
```

### 4.6 Register Pair Indirect

Use a register pair as a 16-bit pointer.

**Syntax**: `[Rx:Ry]`  
**Example**: `LD R0, [R2:R3]`  
**Description**: Load from 16-bit address in R2:R3 (R2=high, R3=low)  
**Bytes**: 1

**Usage Pattern**:
```assembly
; Calculate dynamic address
LD R2, base_high
LD R3, base_low
ADD R3, offset     ; Add to low byte
; If carry, would need to INC R2
LD R4, [R2:R3]     ; Load from computed address
```

---

## 5. Instruction Set

### 5.1 Data Movement

#### LD - Load Register
**Opcode**: 0x1  
**Flags**: Z, N

Load a value into a register.

| Mode | Syntax | Description | Bytes |
|------|--------|-------------|-------|
| Immediate | `LD Rd, #imm` | Rd = immediate | 2 |
| Register | `LD Rd, Rs` | Rd = Rs | 1 |
| Absolute | `LD Rd, [$addr]` | Rd = [addr] | 3 |
| Zero Page | `LD Rd, [$zp]` | Rd = [[zp:zp+1]] | 2 |
| ZP Indexed | `LD Rd, [$zp+Rs]` | Rd = [[zp:zp+1]+Rs] | 2 |
| Reg Pair | `LD Rd, [Rs:Rt]` | Rd = [Rs:Rt] | 1 |

#### ST - Store Register
**Opcode**: 0x2  
**Flags**: None

Store a register value to memory.

| Mode | Syntax | Description | Bytes |
|------|--------|-------------|-------|
| Absolute | `ST Rs, [$addr]` | [addr] = Rs | 3 |
| Zero Page | `ST Rs, [$zp]` | [[zp:zp+1]] = Rs | 2 |
| ZP Indexed | `ST Rs, [$zp+Rt]` | [[zp:zp+1]+Rt] = Rs | 2 |
| Reg Pair | `ST Rs, [Rt:Ru]` | [Rt:Ru] = Rs | 1 |

#### MOV - Move Register
**Opcode**: 0x3  
**Flags**: Z, N

Copy one register to another.

**Syntax**: `MOV Rd, Rs`  
**Operation**: Rd = Rs  
**Bytes**: 1

---

### 5.2 Arithmetic

#### ADD - Add
**Opcode**: 0x4  
**Flags**: C, Z, N, V

Add values with carry.

| Mode | Syntax | Description | Bytes |
|------|--------|-------------|-------|
| Register | `ADD Rd, Rs` | Rd = Rd + Rs | 1 |
| Immediate | `ADD Rd, #imm` | Rd = Rd + imm | 2 |

**16-bit Addition Pattern**:
```assembly
; Add R2:R3 to R4:R5 (result in R4:R5)
ADD R5, R3         ; Add low bytes
ADD R4, R2         ; Add high bytes (carry propagates)
```

#### SUB - Subtract
**Opcode**: 0x5  
**Flags**: C, Z, N, V

Subtract values with borrow.

| Mode | Syntax | Description | Bytes |
|------|--------|-------------|-------|
| Register | `SUB Rd, Rs` | Rd = Rd - Rs | 1 |
| Immediate | `SUB Rd, #imm` | Rd = Rd - imm | 2 |

---

### 5.3 Logical Operations

#### AND - Bitwise AND
**Opcode**: 0x6  
**Flags**: Z, N

| Mode | Syntax | Description | Bytes |
|------|--------|-------------|-------|
| Register | `AND Rd, Rs` | Rd = Rd & Rs | 1 |
| Immediate | `AND Rd, #imm` | Rd = Rd & imm | 2 |

#### OR - Bitwise OR
**Opcode**: 0x7  
**Flags**: Z, N

| Mode | Syntax | Description | Bytes |
|------|--------|-------------|-------|
| Register | `OR Rd, Rs` | Rd = Rd \| Rs | 1 |
| Immediate | `OR Rd, #imm` | Rd = Rd \| imm | 2 |

#### XOR - Bitwise XOR
**Opcode**: 0x8  
**Flags**: Z, N

| Mode | Syntax | Description | Bytes |
|------|--------|-------------|-------|
| Register | `XOR Rd, Rs` | Rd = Rd ^ Rs | 1 |
| Immediate | `XOR Rd, #imm` | Rd = Rd ^ imm | 2 |

---

### 5.4 Shift Operations

#### SHL - Shift Left
**Opcode**: 0x9  
**Flags**: C, Z, N

Shift register left (multiply by 2).

| Mode | Syntax | Description | Bytes |
|------|--------|-------------|-------|
| Single | `SHL Rd` | Rd = Rd << 1 | 1 |
| Multiple | `SHL Rd, #n` | Rd = Rd << n | 2 |

**Behavior**: Carry flag receives bit 7, bit 0 becomes 0.

#### SHR - Shift Right
**Opcode**: 0xA  
**Flags**: C, Z, N

Shift register right (divide by 2).

| Mode | Syntax | Description | Bytes |
|------|--------|-------------|-------|
| Single | `SHR Rd` | Rd = Rd >> 1 | 1 |
| Multiple | `SHR Rd, #n` | Rd = Rd >> n | 2 |

**Behavior**: Carry flag receives bit 0, bit 7 becomes 0.

---

### 5.5 Comparison

#### CMP - Compare
**Opcode**: 0xB  
**Flags**: C, Z, N

Compare values by performing subtraction without storing result.

| Mode | Syntax | Description | Bytes |
|------|--------|-------------|-------|
| Register | `CMP Rd, Rs` | Compare Rd with Rs | 1 |
| Immediate | `CMP Rd, #imm` | Compare Rd with imm | 2 |

**Flag Results**:
- **Z=1**: Values are equal
- **C=1**: Rd >= Rs (unsigned)
- **N=1**: Result would be negative (signed)

---

### 5.6 Control Flow

#### JMP - Jump
**Opcode**: 0xC  
**Flags**: None

Unconditional jump to address.

| Mode | Syntax | Description | Bytes |
|------|--------|-------------|-------|
| Absolute | `JMP $addr` | PC = addr | 3 |
| Reg Pair | `JMP [Rs:Rt]` | PC = [Rs:Rt] | 1 |
| Zero Page | `JMP [$zp]` | PC = [[zp:zp+1]] | 2 |

#### BR - Branch (Conditional)
**Opcode**: 0xD  
**Flags**: None

Branch based on status flags (relative addressing, ±127 bytes).

| Variant | Condition | Description |
|---------|-----------|-------------|
| BRZ | Z = 1 | Branch if zero |
| BRNZ | Z = 0 | Branch if not zero |
| BRC | C = 1 | Branch if carry set |
| BRNC | C = 0 | Branch if carry clear |
| BRN | N = 1 | Branch if negative |
| BRNN | N = 0 | Branch if not negative |
| BRV | V = 1 | Branch if overflow |
| BRNV | V = 0 | Branch if no overflow |

**Syntax**: `BRxx label`  
**Bytes**: 2 (opcode variant + signed offset)

#### CALL - Call Subroutine
**Opcode**: 0xE  
**Flags**: None

Push return address to stack and jump.

| Mode | Syntax | Description | Bytes |
|------|--------|-------------|-------|
| Absolute | `CALL $addr` | Push PC, jump to addr | 3 |
| Reg Pair | `CALL [Rs:Rt]` | Push PC, jump to [Rs:Rt] | 1 |

**Operation**:
1. Push PC low byte to [SP], decrement SP
2. Push PC high byte to [SP], decrement SP
3. PC = target address

#### RET - Return
**Opcode**: 0xF0  
**Flags**: None

Pop return address from stack and jump.

**Syntax**: `RET`  
**Bytes**: 1

**Operation**:
1. Increment SP, pop high byte to PC
2. Increment SP, pop low byte to PC

---

### 5.7 Extended Instructions (0xF prefix)

Instructions with 0xF opcode followed by sub-opcode byte.

| Sub-opcode | Mnemonic | Description | Flags |
|------------|----------|-------------|-------|
| 0xF0 | RET | Return from subroutine | None |
| 0xF1 | RTI | Return from interrupt | All |
| 0xF2 | PUSH | Push register to stack | None |
| 0xF3 | POP | Pop from stack to register | Z, N |
| 0xF4 | INC | Increment register | Z, N |
| 0xF5 | DEC | Decrement register | Z, N |
| 0xF6 | ROL | Rotate left through carry | C, Z, N |
| 0xF7 | ROR | Rotate right through carry | C, Z, N |
| 0xF8 | SEI | Set interrupt enable | - |
| 0xF9 | CLI | Clear interrupt enable | - |
| 0xFA | NOP | Extended NOP | None |
| 0xFB-FF | - | Reserved | - |

#### PUSH - Push Register
**Sub-opcode**: 0xF2

**Syntax**: `PUSH Rd`  
**Operation**: [SP] = Rd, SP = SP - 1  
**Bytes**: 2

#### POP - Pop Register
**Sub-opcode**: 0xF3

**Syntax**: `POP Rd`  
**Operation**: SP = SP + 1, Rd = [SP]  
**Bytes**: 2

#### INC - Increment
**Sub-opcode**: 0xF4

**Syntax**: `INC Rd`  
**Operation**: Rd = Rd + 1  
**Bytes**: 2

#### DEC - Decrement
**Sub-opcode**: 0xF5

**Syntax**: `DEC Rd`  
**Operation**: Rd = Rd - 1  
**Bytes**: 2

#### ROL - Rotate Left
**Sub-opcode**: 0xF6

**Syntax**: `ROL Rd`  
**Operation**: Rotate left through carry  
**Bytes**: 2

```
C ← [7][6][5][4][3][2][1][0] ← C
```

#### ROR - Rotate Right
**Sub-opcode**: 0xF7

**Syntax**: `ROR Rd`  
**Operation**: Rotate right through carry  
**Bytes**: 2

```
C → [7][6][5][4][3][2][1][0] → C
```

#### RTI - Return from Interrupt
**Sub-opcode**: 0xF1

**Syntax**: `RTI`
**Operation**: Pop status flags, pop PC
**Bytes**: 2

Returns from an interrupt handler. Restores the CPU state (status register and program counter)
from the stack and resumes execution at the interrupted location. The I flag is restored,
re-enabling interrupts if they were enabled before the interrupt fired.

#### SEI - Set Interrupt Enable
**Sub-opcode**: 0xF8

**Syntax**: `SEI`
**Operation**: Set I flag in status register (enable interrupts)
**Bytes**: 2
**Cycles**: 1

Enables hardware interrupts. Interrupts will fire when:
- I flag is set (by this instruction)
- INT_ENABLE register (0x0115) has corresponding interrupt bit set
- INT_STATUS register (0x0114) has corresponding interrupt bit set

Example:
```assembly
SEI                    ; Enable interrupts in CPU
LD R0, #$01
ST R0, [$0115]         ; Enable VBlank in INT_ENABLE
```

#### CLI - Clear Interrupt Enable
**Sub-opcode**: 0xF9

**Syntax**: `CLI`
**Operation**: Clear I flag in status register (disable interrupts)
**Bytes**: 2
**Cycles**: 1

Disables all hardware interrupts. Used for critical sections where code
must not be interrupted. Interrupts remain pending in INT_STATUS and will
fire when I flag is set again via SEI.

Example:
```assembly
CLI                    ; Disable interrupts
; Critical section here
SEI                    ; Re-enable interrupts
```

---

### 5.8 No Operation

#### NOP - No Operation
**Opcode**: 0x0  
**Flags**: None

**Syntax**: `NOP`  
**Operation**: Do nothing (useful for timing, alignment, breakpoints)  
**Bytes**: 1

---

## 6. Instruction Encoding

### 6.1 Unified Encoding Format

All instructions use a unified variable-length encoding (2-4 bytes). The **mode** field determines how many additional bytes follow and how to interpret them.

#### Base Format (All Instructions)
```
Byte 1: [opcode:4][mode:3][unused:1]
Byte 2: [dest:3][src:3][unused:2]
Byte 3+: Additional data (depends on mode)
```

**Field Descriptions:**
- **opcode** (4 bits): Instruction type (0x0-0xF)
- **mode** (3 bits): Addressing mode (000-101)
- **dest** (3 bits): Destination register number (0-5)
- **src** (3 bits): Source register or index register (0-5)
- **unused** (3 bits total): Reserved, must be 0

### 6.2 Mode Encoding

The 3-bit **mode** field determines addressing mode and instruction length:

| Mode | Code | Name | Length | Byte 3 | Byte 4 | Description |
|------|------|------|--------|--------|--------|-------------|
| 000 | Immediate | IMM | 3 bytes | imm8 | - | Load immediate value |
| 001 | Register | REG | 2 bytes | - | - | Register-to-register |
| 010 | Absolute | ABS | 4 bytes | addr_high | addr_low | 16-bit address |
| 011 | Zero Page | ZP | 3 bytes | zp_addr | - | Zero page indirect |
| 100 | ZP Indexed | ZPX | 3 bytes | zp_addr | - | Zero page + index |
| 101 | Reg Pair | RPR | 2 bytes | - | - | Register pair indirect |
| 110 | Reserved | - | - | - | - | Future use |
| 111 | Reserved | - | - | - | - | Future use |

### 6.3 Encoding Examples

#### Example 1: `LD R0, #42` (Load immediate)
```
Opcode: 0x1 (LD)
Mode:   000 (Immediate)
Dest:   000 (R0)
Src:    xxx (unused)

Byte 1: [0001][000][0] = 0x10
Byte 2: [000][000][00] = 0x00
Byte 3: 42 (0x2A)

Encoded: 10 00 2A
```

#### Example 2: `ADD R2, R3` (Register add)
```
Opcode: 0x4 (ADD)
Mode:   001 (Register)
Dest:   010 (R2)
Src:    011 (R3)

Byte 1: [0100][001][0] = 0x42
Byte 2: [010][011][00] = 0x4C

Encoded: 42 4C
```

#### Example 3: `ST R1, [$C000]` (Store absolute)
```
Opcode: 0x2 (ST)
Mode:   010 (Absolute)
Dest:   001 (R1)
Src:    xxx (unused)

Byte 1: [0010][010][0] = 0x24
Byte 2: [001][000][00] = 0x20
Byte 3: 0xC0 (address high byte)
Byte 4: 0x00 (address low byte)

Encoded: 24 20 C0 00
```

#### Example 4: `LD R4, [$80+R0]` (Zero page indexed)
```
Opcode: 0x1 (LD)
Mode:   100 (ZP Indexed)
Dest:   100 (R4)
Src:    000 (R0 = index register)

Byte 1: [0001][100][0] = 0x18
Byte 2: [100][000][00] = 0x80
Byte 3: 0x80 (zero page address)

Encoded: 18 80 80
```

### 6.4 Special Cases

#### NOP Instruction
```
Opcode: 0x0 (NOP)
Mode:   001 (treated as register mode)

Byte 1: [0000][001][0] = 0x02
Byte 2: [000][000][00] = 0x00

Encoded: 02 00
Length: 2 bytes
```

#### Extended Instructions (0xF prefix)
Extended instructions use opcode 0xF and encode the sub-opcode in byte 2:

```
Byte 1: [1111][mode][0]
Byte 2: [sub_opcode:8]
Byte 3+: Additional data (depends on instruction)

Example - PUSH R3:
Byte 1: [1111][001][0] = 0xF2
Byte 2: [11110010] = 0xF2 (PUSH sub-opcode)
Byte 3: [011][000][00] = 0x60 (R3)

Encoded: F2 F2 60
```

### 6.5 Instruction Length Summary

| Addressing Mode | Bytes | Used By |
|-----------------|-------|---------|
| Register (REG) | 2 | MOV, ADD, SUB, AND, OR, XOR, CMP |
| Immediate (IMM) | 3 | LD, ADD, SUB, AND, OR, XOR, CMP |
| Register Pair (RPR) | 2 | LD, ST, JMP, CALL |
| Zero Page (ZP) | 3 | LD, ST, JMP |
| ZP Indexed (ZPX) | 3 | LD, ST |
| Absolute (ABS) | 4 | LD, ST, JMP, CALL |
| NOP | 2 | - |
| Extended | 3+ | PUSH, POP, INC, DEC, ROL, ROR, RET, RTI |

---

## 7. Timing

### 7.1 Instruction Cycles

Consistent, predictable timing:

| Instruction Type | Cycles |
|------------------|--------|
| Register operations (MOV, ADD, AND, etc.) | 1 |
| Immediate operations | 2 |
| Memory load (zero page) | 2 |
| Memory load (absolute) | 3 |
| Memory store (zero page) | 2 |
| Memory store (absolute) | 3 |
| Branch not taken | 1 |
| Branch taken | 2 |
| Jump | 2 |
| Call | 4 |
| Return | 3 |
| Push/Pop | 2 |

### 7.2 Execution Model

- Instructions execute sequentially
- No pipeline stalls or cache considerations
- Hardware interrupts checked after each instruction completes
- Frame budget: 50,000 cycles per 60Hz frame (at 3MHz)

---

## 8. Interrupt Handling

The CPU supports hardware-triggered interrupts for responding to events like frame completion (VBlank) and scanline rendering.

### 8.1 Interrupt Sources

Hardware interrupts are triggered by peripheral events:

| Interrupt | Trigger | Frequency |
|-----------|---------|-----------|
| **VBlank** | Frame rendering completes | 60 Hz (every ~16.7ms) |
| **Scanline** | Rendering reaches specified scanline | Variable (future) |

### 8.2 Interrupt Vectors

Interrupt handler addresses are stored in hardware registers:

| Register | Address | Description |
|----------|---------|-------------|
| VBLANK_VEC_HI | 0x0132 | VBlank handler address (high byte) |
| VBLANK_VEC_LO | 0x0133 | VBlank handler address (low byte) |
| SCANLINE_VEC_HI | 0x0134 | Scanline handler address (high byte) |
| SCANLINE_VEC_LO | 0x0135 | Scanline handler address (low byte) |

**Vector format**: 16-bit address stored big-endian (high byte, then low byte)

### 8.3 Interrupt Enable Control

Interrupts fire when **all three** conditions are met:

1. **I flag** (status bit 2) is set via SEI instruction
2. **INT_ENABLE** register (0x0115) has corresponding interrupt bit set
3. **INT_STATUS** register (0x0114) has corresponding interrupt bit set

**Example setup:**
```assembly
; Install VBlank handler
LD R0, #>vblank_handler    ; High byte of handler address
ST R0, [$0132]             ; VBLANK_VEC_HI

LD R0, #<vblank_handler    ; Low byte of handler address
ST R0, [$0133]             ; VBLANK_VEC_LO

; Enable VBlank interrupts
LD R0, #$01                ; Bit 0 = VBlank
ST R0, [$0115]             ; INT_ENABLE

SEI                        ; Enable interrupts in CPU
```

### 8.4 Interrupt Handling Sequence

When all enable conditions are met and an interrupt fires:

1. **CPU finishes current instruction**
2. **Push status register to stack** (preserves all flags including I)
3. **Push PC low byte to stack**
4. **Push PC high byte to stack**
5. **Clear I flag** (automatically disables further interrupts)
6. **Read handler address** from interrupt vector (0x0132-0x0133 for VBlank)
7. **Jump to handler address**

**Cycles**: 7 cycles total for interrupt dispatch

**Interrupt handler responsibilities:**
- Save any registers it uses (PUSH Rx)
- Clear the interrupt flag in INT_STATUS (write-1-to-clear)
- Perform time-critical operations
- Restore registers (POP Rx)
- Execute RTI to return

**RTI (Return from Interrupt) sequence:**
1. **Pop PC high byte from stack**
2. **Pop PC low byte from stack**
3. **Pop status register from stack** (restores I flag, re-enables interrupts)
4. **Resume execution** at interrupted location

### 8.5 Interrupt Latency

- **Minimum latency**: 1 cycle (if interrupt fires between instructions)
- **Maximum latency**: ~4 cycles (longest instruction duration)
- **Handler entry overhead**: 7 cycles (stack operations + vector fetch + jump)
- **Total interrupt overhead**: 8-11 cycles from trigger to first handler instruction

### 8.6 Interrupt Priority

If multiple interrupts are pending when I flag is set:

1. **VBlank** has higher priority (checked first)
2. **Scanline** has lower priority (checked second)
3. Only one interrupt handled per instruction completion

### 8.7 Interrupt vs. Polling

The system supports two approaches for handling VBlank:

**Polling (simple but inefficient):**
```assembly
main_loop:
  wait_vblank:
    LD R0, [$0114]         ; Read INT_STATUS
    AND R0, #$01           ; Test VBlank bit
    BRZ wait_vblank        ; Loop until set

  LD R0, #$01
  ST R0, [$0114]           ; Clear VBlank flag

  CALL update_game
  JMP main_loop
```

**Interrupts (efficient, recommended):**
```assembly
; Setup (run once at startup)
setup:
  ; Install VBlank handler
  LD R0, #>vblank_handler
  ST R0, [$0132]           ; VBLANK_VEC_HI
  LD R0, #<vblank_handler
  ST R0, [$0133]           ; VBLANK_VEC_LO

  ; Enable VBlank interrupts
  LD R0, #$01
  ST R0, [$0115]           ; INT_ENABLE
  SEI                      ; Enable in CPU

; Main game loop - runs continuously
main_loop:
  CALL run_ai
  CALL update_physics
  CALL process_input
  JMP main_loop

; VBlank handler - called automatically at 60Hz
vblank_handler:
  PUSH R0
  PUSH R1
  PUSH R2

  ; Clear VBlank flag
  LD R0, #$01
  ST R0, [$0114]           ; INT_STATUS

  ; Update display during safe VBlank period
  CALL update_sprite_positions
  CALL update_palette

  POP R2
  POP R1
  POP R0
  RTI                      ; Return and re-enable interrupts
```

**Comparison:**
- Polling wastes ~40,000 cycles per frame waiting
- Interrupts allow game logic to run continuously
- Interrupts match real console hardware (NES, SNES, Game Boy)
- Polling is simpler for beginners

### 8.8 Critical Sections

Use CLI/SEI to protect code that must not be interrupted:

```assembly
; Reading multi-byte value atomically
CLI                        ; Disable interrupts
LD R0, [$1000]            ; Read low byte
LD R1, [$1001]            ; Read high byte
SEI                        ; Re-enable interrupts

; Now R0:R1 contains consistent value
```

---

## 9. Programming Examples

### 9.1 Hello World (Memory Fill)

```assembly
; Fill screen with color
LD R0, #$FF        ; Framebuffer high byte
LD R1, #$FF        ; Framebuffer low byte
ST R0, [$FE]       ; Setup zero page pointer
ST R1, [$FF]

LD R2, #0          ; Counter
LD R3, #$12        ; Color (Tailwind index)

loop:
  ST R3, [$FE+R2]  ; Write color
  INC R2
  CMP R2, #160     ; Check if done
  BRNZ loop
```

### 9.2 16-bit Counter

```assembly
; Increment 16-bit counter at $0B00-$0B01
LD R0, [$0B00]     ; Load high byte
LD R1, [$0B01]     ; Load low byte

ADD R1, #1         ; Increment low
BRC carry_set      ; If carry, increment high
JMP store

carry_set:
  ADD R0, #1       ; Increment high

store:
  ST R0, [$0B00]   ; Store high
  ST R1, [$0B01]   ; Store low
```

### 9.3 Subroutine Call

```assembly
main:
  LD R0, #42
  CALL multiply_by_two
  ; R0 now contains 84
  
multiply_by_two:
  SHL R0           ; Shift left (×2)
  RET
```

---

## Appendix A: Opcode Reference Table

| Opcode | Mnemonic | Description |
|--------|----------|-------------|
| 0x0 | NOP | No operation |
| 0x1 | LD | Load register |
| 0x2 | ST | Store register |
| 0x3 | MOV | Move register |
| 0x4 | ADD | Add |
| 0x5 | SUB | Subtract |
| 0x6 | AND | Bitwise AND |
| 0x7 | OR | Bitwise OR |
| 0x8 | XOR | Bitwise XOR |
| 0x9 | SHL | Shift left |
| 0xA | SHR | Shift right |
| 0xB | CMP | Compare |
| 0xC | JMP | Jump |
| 0xD | BR | Branch (conditional) |
| 0xE | CALL | Call subroutine |
| 0xF | Extended | See extended instructions |

---

## Appendix B: Register Conventions

While all registers R0-R5 are general-purpose, these conventions are recommended for BBC BASIC compiler and standard library:

| Register | Convention | Usage |
|----------|------------|-------|
| R0 | Return value | Function return values |
| R1 | Scratch | Temporary calculations |
| R2:R3 | Pointer | Primary address pointer pair |
| R4:R5 | Pointer | Secondary address pointer pair |

These are recommendations only; assembly programmers may use registers as needed.
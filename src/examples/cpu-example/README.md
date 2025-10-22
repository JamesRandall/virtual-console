# CPU Example Viewer

An interactive terminal-based debugger for the Virtual Console CPU, built with Ink and React.

## Features

- **Menu-driven interface** with 10 hand-coded example programs
- **Hex memory viewer** showing 128 bytes (0x0000-0x007F) with current PC highlighted
- **Register display** showing R0-R5, SP, PC in hex and decimal
- **Status flags** display (C, Z, N, V)
- **Disassembled instruction** view at the current program counter
- **Step-by-step execution** using Space or Enter keys

## Example Programs

0. **Memory Fill** - Fills first 16 bytes with 0xAA pattern
1. **Count to Ten** - Stores values 0-10 sequentially
2. **Fibonacci Generator** - Generates first 8 Fibonacci numbers
3. **Bit Pattern Shifter** - Creates walking bit pattern (0x01, 0x02, 0x04...)
4. **XOR Cipher** - XOR encryption with key 0x5A
5. **Find Maximum** - Finds maximum value in 8 bytes
6. **Binary Counter with Carry** - 16-bit counter demonstration
7. **Simple Sort** - Bubble sort on 4 values
8. **Subroutine Call** - Demonstrates CALL/RET instructions
9. **Rotate and Mask** - ROL with AND masking

## Installation

```bash
npm install
```

## Running

```bash
npm start
```

## Usage

### Menu Navigation
- Use **arrow keys** to navigate between programs
- Press a **number** (0-9) to quickly select a program
- Press **Enter** to run the selected program
- Press **Esc** to exit

### Program Execution
- Press **Space** or **Enter** to step through instructions
- Press **Esc** to return to menu
- The hex viewer shows memory at 0x0000-0x007F with the current PC byte highlighted in red
- Programs start at address 0x0020 (byte 32)
- Stack pointer is set to 0x007F (end of 128-byte viewing window)
- Programs end when a NOP instruction is encountered

## Implementation Details

- All programs are hand-coded machine code (no assembler used)
- Programs that require initial data have it pre-loaded into memory
- The disassembler converts machine code to assembly mnemonics in real-time
- The CPU implementation follows the Virtual Console CPU specification

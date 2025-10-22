# CPU Examples

To demonstrate that our CPU works we are going to create a simple node app using an "in place" console view that doesn't scroll.

First read these files in this order (all paths are given relative to the project root) which will provide the appropriate background:

* README.md
* specs/typescript-guide.md
* specs/hardware/cpu.md
* src/console/cpu.ts
* src/console/memoryBus.ts

The system should be written in TypeScript and use Ink (https://github.com/vadimdemedes/ink). Create a package.json for this project in that folder and set it up with a script we can use to start the application.

The files for this should be placed in the folder src/examples/cpu-example

## User Interface

The console app should be broken into two user interface parts which are outlined below:

### Menu

The app should start up showing a menu presenting a set of example programs to choose from as a numbered list:

0. Memory fill
1. Count to ten
2. Fibonacci generator
3. Bit pattern shifter
4. XOR cipher
5. Find maximum
6. Binary counter with carry
7. Simple sort (4 values)
8. Subroutine call example
9. Rotate and mask

Pressing escape should exit the system (and a message should indicate that)

### Run

In the run mode we show a "full terminal" view. The terminal has 24 rows. Most of the view should be taken up by a hex viewer with the following format:

AAAA   BB CC DD EE FF 00 11 22    abcdefgh
...

The first column is base address for the row, middle section is hex values for each byte, third section is the ASCII view of the byte (if it has one). None-printable characters should be displayed with a '.' character and color them a dark gray to indicate they are not actual ASCII . characters.

We should show 16 rows giving a window onto 128 bytes.

Underneath the hex display we should show the values of the 5 general purpose registers, the stack pointer, and the program counter. We should also show the status flags broken out into their parts. We should also show the current program counter location in the hex view by colouring the byte red. Show the flags in the format:

C=1 Z=0 N=0 V=0

We should also show a disassembled view of the instruction at the current PC e.g. LD R0 #10.

To advance through the program the user presses the space or return key.

## Running Examples

1. Create a memory bus instance (it has 64kb but we will only use the first 128 bytes)
2. Assemble the code for the example and place it at byte 32.
3. Set the program counter to the start of the program (byte 32).
4. The stack pointer should be set to the end of the memory space. You will need to override the default set by the CPU class.
5. The user now begins to step through the program using the space bar or return key. As they do so we update the memory display, registers, flags etc.
6. When the program is finished we tell them and on the next key press the user is taken back to the menu.

## Example Programs

Note that currently there is no assembler so you will be required to hand code the machine code bytes for each example. We can use the NOP instruction as an indicator that a program has finished.

### 1. **Memory Fill**
**Description:** Loads a value into R0 and stores it repeatedly to fill the first 16 bytes of memory with the same value. Demonstrates basic LD, ST, INC, CMP, and conditional branching.

**What it demonstrates:**
- Immediate load
- Absolute store  
- Loop counter with increment
- Conditional branch (BRNZ)
- Simple memory patterns

---

### 2. **Count to Ten**
**Description:** Increments R0 from 0 to 10, storing each value to sequential memory addresses (0x00-0x09). Shows a basic counting loop with memory writes.

**What it demonstrates:**
- INC instruction
- Memory indexing
- Loop termination with CMP
- Sequential memory access

---

### 3. **Fibonacci Generator**
**Description:** Generates the first 8 Fibonacci numbers (1, 1, 2, 3, 5, 8, 13, 21) and stores them to memory addresses 0x00-0x07. Classic algorithm demonstrating arithmetic.

**What it demonstrates:**
- ADD instruction for arithmetic
- Register swapping with MOV
- Multiple register usage (R0, R1, R2)
- Loop control
- Algorithmic thinking

---

### 4. **Bit Pattern Shifter**
**Description:** Starts with 0x01 in R0 and repeatedly shifts left, creating a walking bit pattern (0x01, 0x02, 0x04, 0x08...). Stores each result to memory before it wraps around.

**What it demonstrates:**
- SHL (shift left) instruction
- Bit manipulation
- Carry flag behavior
- Visual binary patterns

---

### 5. **XOR Cipher**
**Description:** Loads 8 bytes from memory addresses 0x00-0x07, XORs each with a key value (0x5A), and stores the encrypted results to 0x10-0x17. Running twice shows encryption/decryption symmetry.

**What it demonstrates:**
- XOR instruction
- Practical cryptography concept
- Memory-to-memory operations
- Data transformation

---

### 6. **Find Maximum**
**Description:** Scans through 8 bytes of memory (pre-loaded with different values) and finds the maximum value, storing it to a result location. Shows comparison logic.

**What it demonstrates:**
- CMP instruction
- Conditional branching (BRC, BRNZ)
- Memory scanning
- Comparison algorithms

---

### 7. **Binary Counter with Carry**
**Description:** Implements a 16-bit counter using R0:R1 as a register pair. Increments the counter 256 times, demonstrating carry propagation between bytes.

**What it demonstrates:**
- 16-bit arithmetic with 8-bit registers
- Carry flag usage
- Multi-byte operations
- Register pairs

---

### 8. **Simple Sort (4 values)**
**Description:** Performs a bubble sort on 4 bytes at memory addresses 0x00-0x03. Shows nested loop structure and swap operations.

**What it demonstrates:**
- Nested loops
- Conditional swapping
- Memory read-modify-write
- Algorithm complexity

---

### 9. **Subroutine Call Example**
**Description:** Main routine calls a "multiply by 2" subroutine using CALL/RET. Shows stack usage and parameter passing via registers.

**What it demonstrates:**
- CALL instruction
- RET instruction
- Stack operations (implicit)
- Modular programming
- Subroutine concept

---

### 10. **Rotate and Mask**
**Description:** Takes a value, rotates it through the carry flag using ROL/ROR, and uses AND to extract specific bits, demonstrating advanced bit manipulation.

**What it demonstrates:**
- ROL/ROR instructions
- Carry flag in rotations
- AND for bit masking
- Complex bit operations
- Multiple transformation steps
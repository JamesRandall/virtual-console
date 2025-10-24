/**
 * Example programs for the CPU viewer
 * Programs are written in assembly language and assembled using the assembler
 */

import { assemble } from '../../../console/src/assembler';

// Program 0: Memory Fill
// Fills first 16 bytes with 0xAA pattern
const memoryFillAsm = `
  .org $20
  LD R0, #$AA      ; Load pattern
  LD R1, #0        ; Counter
  LD R2, #0        ; Address high byte
  LD R3, #0        ; Address low byte
loop:
  ST R0, [R2:R3]   ; Store pattern
  INC R3           ; Next address
  INC R1           ; Increment counter
  CMP R1, #16      ; Check if done
  BRNZ loop        ; Loop if not done
  NOP
`;
export const memoryFill = assemble(memoryFillAsm).segments[0].data;

// Program 1: Count to Ten
// Stores values 0-10 at addresses 0x00-0x0A
const countToTenAsm = `
  .org $20
  LD R0, #0        ; Counter/value
  LD R2, #0        ; Address high byte
  LD R3, #0        ; Address low byte
loop:
  ST R0, [R2:R3]   ; Store value
  INC R0           ; Increment value
  INC R3           ; Next address
  CMP R0, #11      ; Check if done (0-10 = 11 values)
  BRNZ loop        ; Loop if not done
  NOP
`;
export const countToTen = assemble(countToTenAsm).segments[0].data;

// Program 2: Fibonacci Generator
// Generates first 8 Fibonacci numbers at addresses 0x00-0x07
const fibonacciAsm = `
  .org $20
  LD R0, #1        ; fib(n-1)
  LD R1, #1        ; fib(n)
  LD R2, #0        ; Address high byte
  LD R3, #0        ; Address low byte
  LD R4, #0        ; Counter
loop:
  ST R0, [R2:R3]   ; Store fib number
  MOV R5, R0       ; Save old value
  ADD R0, R1       ; R0 = R0 + R1 (new fib)
  MOV R1, R5       ; R1 = old R0
  INC R3           ; Next address
  INC R4           ; Increment counter
  CMP R4, #8       ; Check if done
  BRNZ loop        ; Loop if not done
  NOP
`;
export const fibonacci = assemble(fibonacciAsm).segments[0].data;

// Program 3: Bit Pattern Shifter
// Creates walking bit pattern: 0x01, 0x02, 0x04, 0x08...
const bitShifterAsm = `
  .org $20
  LD R0, #1        ; Initial bit pattern
  LD R2, #0        ; Address high byte
  LD R3, #0        ; Address low byte
  LD R4, #0        ; Counter
loop:
  ST R0, [R2:R3]   ; Store pattern
  SHL R0, R0       ; Shift left
  INC R3           ; Next address
  INC R4           ; Increment counter
  CMP R4, #8       ; Check if done
  BRNZ loop        ; Loop if not done
  NOP
`;
export const bitShifter = assemble(bitShifterAsm).segments[0].data;

// Program 4: XOR Cipher
// XOR bytes at 0x00-0x07 with key 0x5A, store at 0x10-0x17
const xorCipherAsm = `
  .org $20
  LD R0, #$5A      ; XOR key
  LD R2, #0        ; Source address high byte
  LD R3, #0        ; Source address low byte
  LD R4, #0        ; Dest address high byte
  LD R5, #$10      ; Dest address low byte
loop:
  LD R1, [R2:R3]   ; Load source byte
  XOR R1, R0       ; XOR with key
  ST R1, [R4:R5]   ; Store encrypted byte
  INC R3           ; Next source address
  INC R5           ; Next dest address
  CMP R3, #8       ; Check if done
  BRNZ loop        ; Loop if not done
  NOP
`;
export const xorCipher = assemble(xorCipherAsm).segments[0].data;

// Program 5: Find Maximum
// Scans bytes 0x00-0x07, finds max, stores at 0x10
const findMaximumAsm = `
  .org $20
  LD R0, #0        ; Max value so far
  LD R2, #0        ; Address high byte
  LD R3, #0        ; Address low byte
loop:
  LD R1, [R2:R3]   ; Load current byte
  CMP R1, R0       ; Compare with max
  BRC skip         ; If R1 >= R0 (carry set), skip update
  MOV R0, R1       ; Update max
skip:
  INC R3           ; Next address
  CMP R3, #8       ; Check if done
  BRNZ loop        ; Loop if not done
  ST R0, [$0010]   ; Store result
  NOP
`;
export const findMaximum = assemble(findMaximumAsm).segments[0].data;

// Program 6: Binary Counter with Carry
// 16-bit counter in R0:R1, increment 256 times
const binaryCounterAsm = `
  .org $20
  LD R0, #0        ; High byte of counter
  LD R1, #0        ; Low byte of counter
  LD R2, #0        ; Loop counter
loop:
  INC R1           ; Increment low byte
  CMP R1, #0       ; Check if wrapped to 0
  BRZ carry        ; If wrapped, increment high byte
  JMP skip         ; Otherwise skip carry handling
carry:
  INC R0           ; Increment high byte
skip:
  INC R2           ; Increment loop counter
  CMP R2, #0       ; Run 256 times (wraps to 0)
  BRNZ loop        ; Loop if not done
  NOP
`;
export const binaryCounter = assemble(binaryCounterAsm).segments[0].data;

// Program 7: Simple Sort (4 values)
// Bubble sort on 4 bytes at 0x00-0x03
const simpleSortAsm = `
  .org $20
  LD R4, #3        ; Outer counter
outer:
  LD R5, #0        ; Inner counter/index
inner:
  LD R2, #0        ; Address high byte
  MOV R3, R5       ; Address low = index
  LD R0, [R2:R3]   ; Load arr[i]
  INC R3           ; Point to next element
  LD R1, [R2:R3]   ; Load arr[i+1]
  CMP R0, R1       ; Compare arr[i] with arr[i+1]
  BRC skip         ; If R0 >= R1, no swap needed
  DEC R3           ; Back to arr[i]
  ST R1, [R2:R3]   ; Store arr[i+1] at arr[i]
  INC R3           ; To arr[i+1]
  ST R0, [R2:R3]   ; Store arr[i] at arr[i+1]
skip:
  INC R5           ; Next index
  CMP R5, R4       ; Compare with outer counter
  BRNZ inner       ; Continue inner loop
  DEC R4           ; Decrement outer counter
  CMP R4, #0       ; Check if done
  BRNZ outer       ; Continue outer loop
  NOP
`;
export const simpleSort = assemble(simpleSortAsm).segments[0].data;

// Program 8: Subroutine Call Example
// Calls a "multiply by 2" subroutine
const subroutineCallAsm = `
  .org $20
  LD R0, #21       ; Load value to multiply
  CALL multiplyBy2 ; Call subroutine
  ST R0, [$0010]   ; Store result
  NOP

multiplyBy2:
  SHL R0, R0       ; Shift left (multiply by 2)
  RET              ; Return from subroutine
`;
export const subroutineCall = assemble(subroutineCallAsm).segments[0].data;

// Program 9: Rotate and Mask
// Rotates a value and uses AND to extract bits
const rotateAndMaskAsm = `
  .org $20
  LD R0, #$B4      ; Initial value (0b10110100)
  LD R2, #0        ; Address high byte
  LD R3, #0        ; Address low byte
  LD R4, #0        ; Counter
loop:
  ROL R0           ; Rotate left
  MOV R1, R0       ; Copy for masking
  AND R1, #$0F     ; Mask lower nibble
  ST R1, [R2:R3]   ; Store masked result
  INC R3           ; Next address
  INC R4           ; Increment counter
  CMP R4, #8       ; Check if done
  BRNZ loop        ; Loop if not done
  NOP
`;
export const rotateAndMask = assemble(rotateAndMaskAsm).segments[0].data;

// Initial data for programs that need it
export const initialData: Record<number, Uint8Array> = {
  4: new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F, 0x21, 0x21, 0x21]), // "Hello!!!" for XOR
  5: new Uint8Array([0x23, 0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF, 0x12]), // Random values for max
  7: new Uint8Array([0x42, 0x15, 0x89, 0x33]), // Unsorted values for sort
};

export const programs = [
  { name: 'Memory fill', code: memoryFill, data: null },
  { name: 'Count to ten', code: countToTen, data: null },
  { name: 'Fibonacci generator', code: fibonacci, data: null },
  { name: 'Bit pattern shifter', code: bitShifter, data: null },
  { name: 'XOR cipher', code: xorCipher, data: initialData[4] },
  { name: 'Find maximum', code: findMaximum, data: initialData[5] },
  { name: 'Binary counter with carry', code: binaryCounter, data: null },
  { name: 'Simple sort (4 values)', code: simpleSort, data: initialData[7] },
  { name: 'Subroutine call example', code: subroutineCall, data: null },
  { name: 'Rotate and mask', code: rotateAndMask, data: null },
];

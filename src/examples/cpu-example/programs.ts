/**
 * Example programs for the CPU viewer
 * Each program is hand-coded as machine code bytes
 */

// Helper functions for encoding instructions
const OP_NOP = 0x0, OP_LD = 0x1, OP_ST = 0x2, OP_MOV = 0x3;
const OP_ADD = 0x4, OP_SUB = 0x5, OP_AND = 0x6, OP_OR = 0x7;
const OP_XOR = 0x8, OP_SHL = 0x9, OP_SHR = 0xA, OP_CMP = 0xB;
const OP_JMP = 0xC, OP_BR = 0xD, OP_CALL = 0xE, OP_EXT = 0xF;

const MODE_IMM = 0x0, MODE_REG = 0x1, MODE_ABS = 0x2;
const MODE_ZP = 0x3, MODE_ZPX = 0x4, MODE_RPR = 0x5;

const BR_Z = 0x0, BR_NZ = 0x1, BR_C = 0x2, BR_NC = 0x3;

const EXT_RET = 0xF0, EXT_PUSH = 0xF2, EXT_POP = 0xF3;
const EXT_INC = 0xF4, EXT_DEC = 0xF5, EXT_ROL = 0xF6, EXT_ROR = 0xF7;

const byte1 = (op: number, mode: number): number => ((op << 4) | (mode << 1));
const byte2 = (dest: number, src: number): number => ((dest << 5) | (src << 2));
const offset = (target: number, current: number): number => {
  const off = target - current;
  return off < 0 ? 256 + off : off;
};

// Program 0: Memory Fill
// Fills first 16 bytes with 0xAA pattern
export const memoryFill = (() => {
  const prog: number[] = [];
  // LD R0, #0xAA
  prog.push(byte1(OP_LD, MODE_IMM), byte2(0, 0), 0xAA);
  // LD R1, #0
  prog.push(byte1(OP_LD, MODE_IMM), byte2(1, 0), 0x00);
  // LD R2, #0 (high byte of address)
  prog.push(byte1(OP_LD, MODE_IMM), byte2(2, 0), 0x00);
  // LD R3, #0 (low byte of address)
  prog.push(byte1(OP_LD, MODE_IMM), byte2(3, 0), 0x00);
  // loop: ST R0, [R2:R3]
  const loop = prog.length;
  prog.push(byte1(OP_ST, MODE_RPR), byte2(0, 2));
  // INC R3
  prog.push(byte1(OP_EXT, MODE_REG), EXT_INC, byte2(3, 0));
  // INC R1 (counter)
  prog.push(byte1(OP_EXT, MODE_REG), EXT_INC, byte2(1, 0));
  // CMP R1, #16
  prog.push(byte1(OP_CMP, MODE_IMM), byte2(1, 0), 0x10);
  // BRNZ loop
  const branchPos = prog.length;
  prog.push(byte1(OP_BR, MODE_REG), byte2(BR_NZ, 0), offset(loop, branchPos + 3));
  // NOP
  prog.push(byte1(OP_NOP, MODE_REG), byte2(0, 0));
  return new Uint8Array(prog);
})();

// Program 1: Count to Ten
// Stores values 0-10 at addresses 0x00-0x0A
export const countToTen = (() => {
  const prog: number[] = [];
  // LD R0, #0 (counter/value)
  prog.push(byte1(OP_LD, MODE_IMM), byte2(0, 0), 0x00);
  // LD R2, #0 (address high)
  prog.push(byte1(OP_LD, MODE_IMM), byte2(2, 0), 0x00);
  // LD R3, #0 (address low)
  prog.push(byte1(OP_LD, MODE_IMM), byte2(3, 0), 0x00);
  // loop: ST R0, [R2:R3]
  const loop = prog.length;
  prog.push(byte1(OP_ST, MODE_RPR), byte2(0, 2));
  // INC R0
  prog.push(byte1(OP_EXT, MODE_REG), EXT_INC, byte2(0, 0));
  // INC R3
  prog.push(byte1(OP_EXT, MODE_REG), EXT_INC, byte2(3, 0));
  // CMP R0, #11
  prog.push(byte1(OP_CMP, MODE_IMM), byte2(0, 0), 0x0B);
  // BRNZ loop
  const branchPos = prog.length;
  prog.push(byte1(OP_BR, MODE_REG), byte2(BR_NZ, 0), offset(loop, branchPos + 3));
  // NOP
  prog.push(byte1(OP_NOP, MODE_REG), byte2(0, 0));
  return new Uint8Array(prog);
})();

// Program 2: Fibonacci Generator
// Generates first 8 Fibonacci numbers at addresses 0x00-0x07
export const fibonacci = (() => {
  const prog: number[] = [];
  // LD R0, #1 (fib(n-1))
  prog.push(byte1(OP_LD, MODE_IMM), byte2(0, 0), 0x01);
  // LD R1, #1 (fib(n))
  prog.push(byte1(OP_LD, MODE_IMM), byte2(1, 0), 0x01);
  // LD R3, #0 (address - using R2:R3 pair, R2 assumed 0)
  prog.push(byte1(OP_LD, MODE_IMM), byte2(3, 0), 0x00);
  // LD R2, #0 (address high)
  prog.push(byte1(OP_LD, MODE_IMM), byte2(2, 0), 0x00);
  // LD R4, #0 (counter)
  prog.push(byte1(OP_LD, MODE_IMM), byte2(4, 0), 0x00);
  // loop: ST R0, [R2:R3]
  const loop = prog.length;
  prog.push(byte1(OP_ST, MODE_RPR), byte2(0, 2));
  // MOV R5, R0 (save old value)
  prog.push(byte1(OP_MOV, MODE_REG), byte2(5, 0));
  // ADD R0, R1 (R0 = R0 + R1, new fib number)
  prog.push(byte1(OP_ADD, MODE_REG), byte2(0, 1));
  // MOV R1, R5 (R1 = old R0)
  prog.push(byte1(OP_MOV, MODE_REG), byte2(1, 5));
  // INC R3 (next address)
  prog.push(byte1(OP_EXT, MODE_REG), EXT_INC, byte2(3, 0));
  // INC R4 (counter++)
  prog.push(byte1(OP_EXT, MODE_REG), EXT_INC, byte2(4, 0));
  // CMP R4, #8
  prog.push(byte1(OP_CMP, MODE_IMM), byte2(4, 0), 0x08);
  // BRNZ loop
  const branchPos = prog.length;
  prog.push(byte1(OP_BR, MODE_REG), byte2(BR_NZ, 0), offset(loop, branchPos + 3));
  // NOP
  prog.push(byte1(OP_NOP, MODE_REG), byte2(0, 0));
  return new Uint8Array(prog);
})();

// Program 3: Bit Pattern Shifter
// Creates walking bit pattern: 0x01, 0x02, 0x04, 0x08...
export const bitShifter = (() => {
  const prog: number[] = [];
  // LD R0, #1
  prog.push(byte1(OP_LD, MODE_IMM), byte2(0, 0), 0x01);
  // LD R2, #0 (address high)
  prog.push(byte1(OP_LD, MODE_IMM), byte2(2, 0), 0x00);
  // LD R3, #0 (address low)
  prog.push(byte1(OP_LD, MODE_IMM), byte2(3, 0), 0x00);
  // LD R4, #0 (counter)
  prog.push(byte1(OP_LD, MODE_IMM), byte2(4, 0), 0x00);
  // loop: ST R0, [R2:R3]
  const loop = prog.length;
  prog.push(byte1(OP_ST, MODE_RPR), byte2(0, 2));
  // SHL R0
  prog.push(byte1(OP_SHL, MODE_REG), byte2(0, 0));
  // INC R3
  prog.push(byte1(OP_EXT, MODE_REG), EXT_INC, byte2(3, 0));
  // INC R4
  prog.push(byte1(OP_EXT, MODE_REG), EXT_INC, byte2(4, 0));
  // CMP R4, #8
  prog.push(byte1(OP_CMP, MODE_IMM), byte2(4, 0), 0x08);
  // BRNZ loop
  const branchPos = prog.length;
  prog.push(byte1(OP_BR, MODE_REG), byte2(BR_NZ, 0), offset(loop, branchPos + 3));
  // NOP
  prog.push(byte1(OP_NOP, MODE_REG), byte2(0, 0));
  return new Uint8Array(prog);
})();

// Program 4: XOR Cipher
// XOR bytes at 0x00-0x07 with key 0x5A, store at 0x10-0x17
export const xorCipher = (() => {
  const prog: number[] = [];
  // LD R0, #0x5A (key)
  prog.push(byte1(OP_LD, MODE_IMM), byte2(0, 0), 0x5A);
  // LD R2, #0 (source address high)
  prog.push(byte1(OP_LD, MODE_IMM), byte2(2, 0), 0x00);
  // LD R3, #0 (source address low)
  prog.push(byte1(OP_LD, MODE_IMM), byte2(3, 0), 0x00);
  // LD R4, #0 (dest address high)
  prog.push(byte1(OP_LD, MODE_IMM), byte2(4, 0), 0x00);
  // LD R5, #0x10 (dest address low)
  prog.push(byte1(OP_LD, MODE_IMM), byte2(5, 0), 0x10);
  // LD R1, #0 (counter)
  prog.push(byte1(OP_LD, MODE_IMM), byte2(1, 0), 0x00);
  // loop: LD R0, [R2:R3] - wait, this will overwrite key!
  // Let me fix: use different registers
  // LD R1, [R2:R3] (load source byte)
  const loop = prog.length;
  prog.push(byte1(OP_LD, MODE_RPR), byte2(1, 2));
  // XOR R1, R0 (XOR with key)
  prog.push(byte1(OP_XOR, MODE_REG), byte2(1, 0));
  // ST R1, [R4:R5] (store encrypted)
  prog.push(byte1(OP_ST, MODE_RPR), byte2(1, 4));
  // INC R3
  prog.push(byte1(OP_EXT, MODE_REG), EXT_INC, byte2(3, 0));
  // INC R5
  prog.push(byte1(OP_EXT, MODE_REG), EXT_INC, byte2(5, 0));
  // CMP R3, #8
  prog.push(byte1(OP_CMP, MODE_IMM), byte2(3, 0), 0x08);
  // BRNZ loop
  const branchPos = prog.length;
  prog.push(byte1(OP_BR, MODE_REG), byte2(BR_NZ, 0), offset(loop, branchPos + 3));
  // NOP
  prog.push(byte1(OP_NOP, MODE_REG), byte2(0, 0));
  return new Uint8Array(prog);
})();

// Program 5: Find Maximum
// Scans bytes 0x00-0x07, finds max, stores at 0x10
export const findMaximum = (() => {
  const prog: number[] = [];
  // LD R0, #0 (max value so far)
  prog.push(byte1(OP_LD, MODE_IMM), byte2(0, 0), 0x00);
  // LD R2, #0 (address high)
  prog.push(byte1(OP_LD, MODE_IMM), byte2(2, 0), 0x00);
  // LD R3, #0 (address low)
  prog.push(byte1(OP_LD, MODE_IMM), byte2(3, 0), 0x00);
  // loop: LD R1, [R2:R3] (load current byte)
  const loop = prog.length;
  prog.push(byte1(OP_LD, MODE_RPR), byte2(1, 2));
  // CMP R1, R0 (compare with max)
  prog.push(byte1(OP_CMP, MODE_REG), byte2(1, 0));
  // BRC skip (if R1 >= R0, carry is set)
  const cmpPos = prog.length;
  prog.push(byte1(OP_BR, MODE_REG), byte2(BR_C, 0), 0x05); // skip 5 bytes ahead
  // This will skip the MOV instruction
  // Actually after BRC, PC is at cmpPos + 3, skip should go to cmpPos + 3 + offset
  // MOV is 2 bytes, so offset should be 2
  prog.pop(); prog.pop(); prog.pop();
  prog.push(byte1(OP_BR, MODE_REG), byte2(BR_C, 0), 0x02); // skip MOV (2 bytes)
  // MOV R0, R1 (update max)
  prog.push(byte1(OP_MOV, MODE_REG), byte2(0, 1));
  // skip: INC R3
  prog.push(byte1(OP_EXT, MODE_REG), EXT_INC, byte2(3, 0));
  // CMP R3, #8
  prog.push(byte1(OP_CMP, MODE_IMM), byte2(3, 0), 0x08);
  // BRNZ loop
  const branchPos = prog.length;
  prog.push(byte1(OP_BR, MODE_REG), byte2(BR_NZ, 0), offset(loop, branchPos + 3));
  // ST R0, [$0010] (store result)
  prog.push(byte1(OP_ST, MODE_ABS), byte2(0, 0), 0x10, 0x00);
  // NOP
  prog.push(byte1(OP_NOP, MODE_REG), byte2(0, 0));
  return new Uint8Array(prog);
})();

// Program 6: Binary Counter with Carry
// 16-bit counter in R0:R1, increment 256 times
export const binaryCounter = (() => {
  const prog: number[] = [];
  // LD R0, #0 (high byte)
  prog.push(byte1(OP_LD, MODE_IMM), byte2(0, 0), 0x00);
  // LD R1, #0 (low byte)
  prog.push(byte1(OP_LD, MODE_IMM), byte2(1, 0), 0x00);
  // LD R2, #0 (counter)
  prog.push(byte1(OP_LD, MODE_IMM), byte2(2, 0), 0x00);
  // loop: INC R1
  const loop = prog.length;
  prog.push(byte1(OP_EXT, MODE_REG), EXT_INC, byte2(1, 0));
  // BRC carry (if R1 overflowed, increment R0) - wait, INC doesn't set carry
  // Let me use ADD instead
  // Actually, looking at INC implementation, it doesn't set carry flag
  // I need to detect overflow differently
  // Compare R1 with 0 after increment - if it's 0, it wrapped
  prog.push(byte1(OP_CMP, MODE_IMM), byte2(1, 0), 0x00);
  // BRZ carry (if R1 == 0, it wrapped)
  const checkCarry = prog.length;
  prog.push(byte1(OP_BR, MODE_REG), byte2(BR_Z, 0), 0x02); // skip to INC R0
  // JMP skip - actually just continue, the INC R0 is what we want to skip
  const skipInc = prog.length;
  prog.push(byte1(OP_JMP, MODE_ABS), byte2(0, 0), 0xFF, 0xFF); // placeholder
  // carry: INC R0
  const carryLabel = prog.length;
  // Fix the BRZ offset
  prog[checkCarry + 2] = offset(carryLabel, checkCarry + 3);
  prog.push(byte1(OP_EXT, MODE_REG), EXT_INC, byte2(0, 0));
  // skip: INC R2
  const skip = prog.length;
  // Fix the JMP
  prog[skipInc + 2] = skip & 0xFF;
  prog[skipInc + 3] = (skip >> 8) & 0xFF;
  prog.push(byte1(OP_EXT, MODE_REG), EXT_INC, byte2(2, 0));
  // CMP R2, #0 (run 256 times, wraps to 0)
  prog.push(byte1(OP_CMP, MODE_IMM), byte2(2, 0), 0x00);
  // BRNZ loop
  const branchPos = prog.length;
  prog.push(byte1(OP_BR, MODE_REG), byte2(BR_NZ, 0), offset(loop, branchPos + 3));
  // NOP
  prog.push(byte1(OP_NOP, MODE_REG), byte2(0, 0));
  return new Uint8Array(prog);
})();

// Program 7: Simple Sort (4 values)
// Bubble sort on 4 bytes at 0x00-0x03
export const simpleSort = (() => {
  const prog: number[] = [];
  // Bubble sort: outer loop 3 times, inner loop compares adjacent pairs
  // LD R4, #3 (outer counter)
  prog.push(byte1(OP_LD, MODE_IMM), byte2(4, 0), 0x03);
  // outer: LD R5, #0 (inner counter/index)
  const outer = prog.length;
  prog.push(byte1(OP_LD, MODE_IMM), byte2(5, 0), 0x00);
  // inner: LD R2, #0 (address high for R5)
  const inner = prog.length;
  prog.push(byte1(OP_LD, MODE_IMM), byte2(2, 0), 0x00);
  // MOV R3, R5 (address low = index)
  prog.push(byte1(OP_MOV, MODE_REG), byte2(3, 5));
  // LD R0, [R2:R3] (load arr[i])
  prog.push(byte1(OP_LD, MODE_RPR), byte2(0, 2));
  // INC R3 (point to next element)
  prog.push(byte1(OP_EXT, MODE_REG), EXT_INC, byte2(3, 0));
  // LD R1, [R2:R3] (load arr[i+1])
  prog.push(byte1(OP_LD, MODE_RPR), byte2(1, 2));
  // CMP R0, R1 (compare arr[i] with arr[i+1])
  prog.push(byte1(OP_CMP, MODE_REG), byte2(0, 1));
  // BRC skip (if R0 >= R1, carry set, no swap needed)
  const cmpPos = prog.length;
  prog.push(byte1(OP_BR, MODE_REG), byte2(BR_C, 0), 0x08); // skip swap (8 bytes)
  // Swap: DEC R3 (back to arr[i])
  prog.push(byte1(OP_EXT, MODE_REG), EXT_DEC, byte2(3, 0));
  // ST R1, [R2:R3] (store arr[i+1] at arr[i])
  prog.push(byte1(OP_ST, MODE_RPR), byte2(1, 2));
  // INC R3 (to arr[i+1])
  prog.push(byte1(OP_EXT, MODE_REG), EXT_INC, byte2(3, 0));
  // ST R0, [R2:R3] (store arr[i] at arr[i+1])
  prog.push(byte1(OP_ST, MODE_RPR), byte2(0, 2));
  // skip: INC R5
  prog.push(byte1(OP_EXT, MODE_REG), EXT_INC, byte2(5, 0));
  // CMP R5, R4 (compare with outer counter)
  prog.push(byte1(OP_CMP, MODE_REG), byte2(5, 4));
  // BRNZ inner
  const innerBranch = prog.length;
  prog.push(byte1(OP_BR, MODE_REG), byte2(BR_NZ, 0), offset(inner, innerBranch + 3));
  // DEC R4
  prog.push(byte1(OP_EXT, MODE_REG), EXT_DEC, byte2(4, 0));
  // CMP R4, #0
  prog.push(byte1(OP_CMP, MODE_IMM), byte2(4, 0), 0x00);
  // BRNZ outer
  const outerBranch = prog.length;
  prog.push(byte1(OP_BR, MODE_REG), byte2(BR_NZ, 0), offset(outer, outerBranch + 3));
  // NOP
  prog.push(byte1(OP_NOP, MODE_REG), byte2(0, 0));
  return new Uint8Array(prog);
})();

// Program 8: Subroutine Call Example
// Calls a "multiply by 2" subroutine
export const subroutineCall = (() => {
  const prog: number[] = [];
  // LD R0, #21
  prog.push(byte1(OP_LD, MODE_IMM), byte2(0, 0), 0x15);
  // CALL multiplyBy2
  const callPos = prog.length;
  prog.push(byte1(OP_CALL, MODE_ABS), byte2(0, 0), 0xFF, 0xFF); // placeholder
  // ST R0, [$0010] (store result)
  prog.push(byte1(OP_ST, MODE_ABS), byte2(0, 0), 0x10, 0x00);
  // NOP
  prog.push(byte1(OP_NOP, MODE_REG), byte2(0, 0));
  // multiplyBy2: SHL R0
  const multiplyBy2 = prog.length;
  // Fix CALL address
  const absAddr = 0x20 + multiplyBy2; // Absolute address
  prog[callPos + 2] = absAddr & 0xFF;
  prog[callPos + 3] = (absAddr >> 8) & 0xFF;
  prog.push(byte1(OP_SHL, MODE_REG), byte2(0, 0));
  // RET
  prog.push(byte1(OP_EXT, MODE_REG), EXT_RET, byte2(0, 0));
  return new Uint8Array(prog);
})();

// Program 9: Rotate and Mask
// Rotates a value and uses AND to extract bits
export const rotateAndMask = (() => {
  const prog: number[] = [];
  // LD R0, #0b10110100 (0xB4)
  prog.push(byte1(OP_LD, MODE_IMM), byte2(0, 0), 0xB4);
  // LD R2, #0 (address high)
  prog.push(byte1(OP_LD, MODE_IMM), byte2(2, 0), 0x00);
  // LD R3, #0 (address low for storing)
  prog.push(byte1(OP_LD, MODE_IMM), byte2(3, 0), 0x00);
  // LD R4, #0 (counter)
  prog.push(byte1(OP_LD, MODE_IMM), byte2(4, 0), 0x00);
  // loop: ROL R0
  const loop = prog.length;
  prog.push(byte1(OP_EXT, MODE_REG), EXT_ROL, byte2(0, 0));
  // MOV R1, R0 (copy for masking)
  prog.push(byte1(OP_MOV, MODE_REG), byte2(1, 0));
  // AND R1, #0x0F (mask lower nibble)
  prog.push(byte1(OP_AND, MODE_IMM), byte2(1, 0), 0x0F);
  // ST R1, [R2:R3] (store masked result)
  prog.push(byte1(OP_ST, MODE_RPR), byte2(1, 2));
  // INC R3
  prog.push(byte1(OP_EXT, MODE_REG), EXT_INC, byte2(3, 0));
  // INC R4
  prog.push(byte1(OP_EXT, MODE_REG), EXT_INC, byte2(4, 0));
  // CMP R4, #8
  prog.push(byte1(OP_CMP, MODE_IMM), byte2(4, 0), 0x08);
  // BRNZ loop
  const branchPos = prog.length;
  prog.push(byte1(OP_BR, MODE_REG), byte2(BR_NZ, 0), offset(loop, branchPos + 3));
  // NOP
  prog.push(byte1(OP_NOP, MODE_REG), byte2(0, 0));
  return new Uint8Array(prog);
})();

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

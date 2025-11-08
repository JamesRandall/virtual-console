/**
 * Assembler Test Suite
 *
 * Tests for the assembler implementation covering:
 * - Instruction encoding
 * - Addressing modes
 * - Labels and symbols
 * - Directives
 * - Expression evaluation
 * - Error handling
 */

import { describe, it, expect } from 'vitest';
import { assemble } from './assembler';
import {
  OP_NOP, OP_LD, OP_MOV, OP_ADD, OP_BR, OP_EXT,
  EXT_RET, EXT_PUSH, EXT_POP, EXT_INC, EXT_DEC,
  MODE_IMMEDIATE, MODE_REGISTER, MODE_ABSOLUTE, MODE_ZERO_PAGE,
  MODE_ZERO_PAGE_INDEXED, MODE_REGISTER_PAIR,
  BR_Z, BR_NZ, BR_C
} from './cpu';

describe('Assembler', () => {
  describe('Basic Instructions', () => {
    it('should assemble NOP', () => {
      const result = assemble('NOP');
      expect(result.errors).toHaveLength(0);
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].startAddress).toBe(0);
      expect(result.segments[0].data).toEqual(new Uint8Array([
        (OP_NOP << 4) | (MODE_REGISTER << 1),
        0x00
      ]));
    });

    it('should assemble LD R0, #42', () => {
      const result = assemble('LD R0, #42');
      expect(result.errors).toHaveLength(0);
      expect(result.segments[0].data).toEqual(new Uint8Array([
        (OP_LD << 4) | (MODE_IMMEDIATE << 1),
        (0 << 5) | (0 << 2),
        42
      ]));
    });

    it('should assemble MOV R1, R2', () => {
      const result = assemble('MOV R1, R2');
      expect(result.errors).toHaveLength(0);
      expect(result.segments[0].data).toEqual(new Uint8Array([
        (OP_MOV << 4) | (MODE_REGISTER << 1),
        (1 << 5) | (2 << 2)
      ]));
    });

    it('should assemble ADD R0, R1', () => {
      const result = assemble('ADD R0, R1');
      expect(result.errors).toHaveLength(0);
      expect(result.segments[0].data).toEqual(new Uint8Array([
        (OP_ADD << 4) | (MODE_REGISTER << 1),
        (0 << 5) | (1 << 2)
      ]));
    });

    it('should assemble ADD R2, #10', () => {
      const result = assemble('ADD R2, #10');
      expect(result.errors).toHaveLength(0);
      expect(result.segments[0].data).toEqual(new Uint8Array([
        (OP_ADD << 4) | (MODE_IMMEDIATE << 1),
        (2 << 5) | (0 << 2),
        10
      ]));
    });
  });

  describe('Addressing Modes', () => {
    it('should assemble absolute addressing LD R0, [$1234]', () => {
      const result = assemble('LD R0, [$1234]');
      expect(result.errors).toHaveLength(0);
      expect(result.segments[0].data).toEqual(new Uint8Array([
        (OP_LD << 4) | (MODE_ABSOLUTE << 1),
        (0 << 5) | (0 << 2),
        0x34, // Low byte
        0x12  // High byte
      ]));
    });

    it('should assemble zero page addressing LD R1, [$80]', () => {
      const result = assemble('LD R1, [$80]');
      expect(result.errors).toHaveLength(0);
      expect(result.segments[0].data).toEqual(new Uint8Array([
        (OP_LD << 4) | (MODE_ZERO_PAGE << 1),
        (1 << 5) | (0 << 2),
        0x80
      ]));
    });

    it('should assemble zero page indexed LD R2, [$80+R1]', () => {
      const result = assemble('LD R2, [$80+R1]');
      expect(result.errors).toHaveLength(0);
      expect(result.segments[0].data).toEqual(new Uint8Array([
        (OP_LD << 4) | (MODE_ZERO_PAGE_INDEXED << 1),
        (2 << 5) | (1 << 2),
        0x80
      ]));
    });

    it('should assemble register pair LD R0, [R2:R3]', () => {
      const result = assemble('LD R0, [R2:R3]');
      expect(result.errors).toHaveLength(0);
      expect(result.segments[0].data).toEqual(new Uint8Array([
        (OP_LD << 4) | (MODE_REGISTER_PAIR << 1),
        (0 << 5) | (2 << 2)
      ]));
    });

    it('should error on invalid register pair LD R0, [R2:R4]', () => {
      const result = assemble('LD R0, [R2:R4]');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Invalid register pair');
    });
  });

  describe('Branch Instructions', () => {
    it('should assemble BRZ with forward branch', () => {
      const code = `
        BRZ target
        NOP
        NOP
      target:
        NOP
      `;
      const result = assemble(code);
      expect(result.errors).toHaveLength(0);

      // BRZ is 3 bytes, target is at offset 3 + 2 + 2 = 7
      // Offset = 7 - 3 = 4
      const branchByte1 = (OP_BR << 4) | (MODE_IMMEDIATE << 1);
      const branchByte2 = (BR_Z << 5);
      const offset = 4;

      expect(result.segments[0].data[0]).toBe(branchByte1);
      expect(result.segments[0].data[1]).toBe(branchByte2);
      expect(result.segments[0].data[2]).toBe(offset);
    });

    it('should assemble BRNZ', () => {
      const code = `
        BRNZ target
        NOP
      target:
        NOP
      `;
      const result = assemble(code);
      expect(result.errors).toHaveLength(0);

      const branchByte1 = (OP_BR << 4) | (MODE_IMMEDIATE << 1);
      const branchByte2 = (BR_NZ << 5);

      expect(result.segments[0].data[0]).toBe(branchByte1);
      expect(result.segments[0].data[1]).toBe(branchByte2);
    });

    it('should assemble BRC', () => {
      const code = 'BRC target\ntarget: NOP';
      const result = assemble(code);
      expect(result.errors).toHaveLength(0);

      const branchByte1 = (OP_BR << 4) | (MODE_IMMEDIATE << 1);
      const branchByte2 = (BR_C << 5);

      expect(result.segments[0].data[0]).toBe(branchByte1);
      expect(result.segments[0].data[1]).toBe(branchByte2);
    });

    it('should error on branch target out of range', () => {
      // Create a branch with target > 127 bytes away
      let code = 'BRZ target\n';
      for (let i = 0; i < 70; i++) {
        code += 'NOP\n';
      }
      code += 'target: NOP';

      const result = assemble(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('out of range');
    });
  });

  describe('Labels and Symbols', () => {
    it('should resolve label references', () => {
      const code = `
        JMP main
      main:
        NOP
      `;
      const result = assemble(code);
      expect(result.errors).toHaveLength(0);
      expect(result.symbolTable['main']).toBe(4); // After JMP instruction
    });

    it('should handle local labels', () => {
      const code = `
      main:
        LD R0, #0
      .loop:
        INC R0
        CMP R0, #10
        BRNZ .loop
        RET

      other:
      .loop:
        DEC R1
        BRNZ .loop
        RET
      `;
      const result = assemble(code);
      expect(result.errors).toHaveLength(0);
      expect(result.symbolTable['main.loop']).toBeDefined();
      expect(result.symbolTable['other.loop']).toBeDefined();
      expect(result.symbolTable['main.loop']).not.toBe(result.symbolTable['other.loop']);
    });

    it('should error on duplicate labels', () => {
      const code = `
      main:
        NOP
      main:
        NOP
      `;
      const result = assemble(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.message.includes('Duplicate label'))).toBe(true);
    });

    it('should error on undefined label', () => {
      const code = 'JMP undefined_label';
      const result = assemble(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.message.includes('Undefined symbol'))).toBe(true);
    });
  });

  describe('Directives', () => {
    describe('.org', () => {
      it('should set origin address', () => {
        const code = '.org $8000\nNOP';
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].startAddress).toBe(0x8000);
      });

      it('should create multiple segments with multiple .org', () => {
        const code = `
          .org $8000
          NOP
          .org $9000
          NOP
        `;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments).toHaveLength(2);
        expect(result.segments[0].startAddress).toBe(0x8000);
        expect(result.segments[1].startAddress).toBe(0x9000);
      });
    });

    describe('.byte / .db', () => {
      it('should define bytes', () => {
        const code = '.byte $12, $34, $56';
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].data).toEqual(new Uint8Array([0x12, 0x34, 0x56]));
      });

      it('should support .db alias', () => {
        const code = '.db $FF, $00';
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].data).toEqual(new Uint8Array([0xFF, 0x00]));
      });
    });

    describe('.word / .dw', () => {
      it('should define words in little-endian', () => {
        const code = '.word $1234';
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].data).toEqual(new Uint8Array([0x34, 0x12]));
      });

      it('should define multiple words', () => {
        const code = '.word $ABCD, $1234';
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].data).toEqual(new Uint8Array([0xCD, 0xAB, 0x34, 0x12]));
      });
    });

    describe('.string / .asciiz', () => {
      it('should define null-terminated string', () => {
        const code = '.string "ABC"';
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].data).toEqual(new Uint8Array([65, 66, 67, 0]));
      });

      it('should handle escape sequences', () => {
        const code = '.string "A\\nB"';
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].data).toEqual(new Uint8Array([65, 10, 66, 0]));
      });
    });

    describe('.define / .equ', () => {
      it('should define constants', () => {
        const code = `
          .define SCREEN_WIDTH 256
          LD R0, #SCREEN_WIDTH
        `;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.symbolTable['SCREEN_WIDTH']).toBe(256);
        expect(result.segments[0].data[2]).toBe(0); // 256 & 0xFF = 0
      });

      it('should support .equ alias', () => {
        const code = `
          .equ VALUE 42
          LD R0, #VALUE
        `;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.symbolTable['VALUE']).toBe(42);
        expect(result.segments[0].data[2]).toBe(42);
      });
    });

    describe('.res / .dsb', () => {
      it('should reserve space', () => {
        const code = '.res 10';
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].data.length).toBe(10);
        expect(Array.from(result.segments[0].data)).toEqual(new Array(10).fill(0));
      });
    });

    describe('.align', () => {
      it('should align to boundary', () => {
        const code = `
          .byte $FF
          .align 4
          .byte $AA
        `;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        // First byte at 0, align to 4, next byte at 4
        expect(result.segments[0].data.length).toBe(5);
        expect(result.segments[0].data[0]).toBe(0xFF);
        expect(result.segments[0].data[4]).toBe(0xAA);
      });
    });
  });

  describe('Number Formats', () => {
    it('should parse decimal numbers', () => {
      const code = 'LD R0, #42';
      const result = assemble(code);
      expect(result.segments[0].data[2]).toBe(42);
    });

    it('should parse hexadecimal with $ prefix', () => {
      const code = 'LD R0, #$2A';
      const result = assemble(code);
      expect(result.segments[0].data[2]).toBe(0x2A);
    });

    it('should parse hexadecimal with 0x prefix', () => {
      const code = 'LD R0, #0x2A';
      const result = assemble(code);
      expect(result.segments[0].data[2]).toBe(0x2A);
    });

    it('should parse binary with % prefix', () => {
      const code = 'LD R0, #%00101010';
      const result = assemble(code);
      expect(result.segments[0].data[2]).toBe(0b00101010);
    });

    it('should parse binary with 0b prefix', () => {
      const code = 'LD R0, #0b00101010';
      const result = assemble(code);
      expect(result.segments[0].data[2]).toBe(0b00101010);
    });

    it('should parse character literals', () => {
      const code = "LD R0, #'A'";
      const result = assemble(code);
      expect(result.segments[0].data[2]).toBe(65);
    });
  });

  describe('Expression Evaluation', () => {
    describe('Arithmetic operators', () => {
      it('should evaluate addition', () => {
        const code = `
          .define A 10
          .define B 20
          LD R0, #(A + B)
        `;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].data[2]).toBe(30);
      });

      it('should evaluate subtraction', () => {
        const code = `
          .define A 50
          .define B 30
          LD R0, #(A - B)
        `;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].data[2]).toBe(20);
      });

      it('should evaluate multiplication', () => {
        const code = `LD R0, #(5 * 6)`;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].data[2]).toBe(30);
      });

      it('should evaluate division', () => {
        const code = `LD R0, #(20 / 4)`;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].data[2]).toBe(5);
      });

      it('should evaluate modulo', () => {
        const code = `LD R0, #(17 % 5)`;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].data[2]).toBe(2);
      });

      it('should respect operator precedence (multiplication before addition)', () => {
        const code = `LD R0, #(2 + 3 * 4)`;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].data[2]).toBe(14); // 2 + 12 = 14, not (2+3)*4 = 20
      });

      it('should handle parentheses to override precedence', () => {
        const code = `LD R0, #((2 + 3) * 4)`;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].data[2]).toBe(20);
      });
    });

    describe('Shift operators', () => {
      it('should evaluate left shift (<<)', () => {
        const code = `LD R0, #(1 << 4)`;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].data[2]).toBe(16);
      });

      it('should evaluate right shift (>>)', () => {
        const code = `LD R0, #(32 >> 2)`;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].data[2]).toBe(8);
      });

      it('should evaluate right shift with symbol', () => {
        const code = `
          .define VALUE 32831
          LD R0, #(VALUE >> 8)
        `;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].data[2]).toBe(128); // 32831 >> 8 = 128.24...
      });

      it('should evaluate left shift with symbol', () => {
        const code = `
          .define VALUE 128
          LD R0, #(VALUE << 8)
        `;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        // 128 << 8 = 32768, which is 0x8000
        // As 8-bit value: 0x8000 & 0xFF = 0
        expect(result.segments[0].data[2]).toBe(0);
      });

      it('should evaluate shift in .word directive', () => {
        const code = `.word (256 >> 1)`;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        // 256 >> 1 = 128 = 0x80
        // Little-endian: low byte first
        expect(result.segments[0].data[0]).toBe(0x80);
        expect(result.segments[0].data[1]).toBe(0x00);
      });
    });

    describe('Bitwise operators', () => {
      it('should evaluate bitwise AND (&)', () => {
        const code = `
          .define MASK 0xFF
          LD R0, #(MASK & 0x0F)
        `;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].data[2]).toBe(0x0F);
      });

      it('should evaluate bitwise OR (|)', () => {
        const code = `LD R0, #(0x0F | 0xF0)`;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].data[2]).toBe(0xFF);
      });

      it('should evaluate bitwise XOR (^)', () => {
        const code = `LD R0, #(0xFF ^ 0xAA)`;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].data[2]).toBe(0x55);
      });

      it('should evaluate bitwise NOT (~)', () => {
        const code = `LD R0, #(~0x00)`;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        // ~0x00 in 16-bit = 0xFFFF, as 8-bit = 0xFF
        expect(result.segments[0].data[2]).toBe(0xFF);
      });
    });

    describe('Comparison operators', () => {
      it('should evaluate equality (==)', () => {
        const code = `LD R0, #(5 == 5)`;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].data[2]).toBe(1);
      });

      it('should evaluate inequality (!=)', () => {
        const code = `LD R0, #(5 != 3)`;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].data[2]).toBe(1);
      });

      it('should evaluate less than (<)', () => {
        const code = `LD R0, #(3 < 5)`;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].data[2]).toBe(1);
      });

      it('should evaluate greater than (>)', () => {
        const code = `LD R0, #(7 > 5)`;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].data[2]).toBe(1);
      });

      it('should evaluate less than or equal (<=)', () => {
        const code = `LD R0, #(5 <= 5)`;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].data[2]).toBe(1);
      });

      it('should evaluate greater than or equal (>=)', () => {
        const code = `LD R0, #(6 >= 5)`;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].data[2]).toBe(1);
      });

      it('should not confuse > with >>', () => {
        const code = `LD R0, #(128 >> 4)`;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].data[2]).toBe(8); // 128 >> 4 = 8, not comparison
      });

      it('should not confuse < with <<', () => {
        const code = `LD R0, #(2 << 3)`;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].data[2]).toBe(16); // 2 << 3 = 16, not comparison
      });
    });

    describe('Logical operators', () => {
      it('should evaluate logical AND (&&)', () => {
        const code = `LD R0, #(1 && 1)`;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].data[2]).toBe(1);
      });

      it('should evaluate logical OR (||)', () => {
        const code = `LD R0, #(0 || 1)`;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].data[2]).toBe(1);
      });

      it('should evaluate logical NOT (!)', () => {
        const code = `LD R0, #(!0)`;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].data[2]).toBe(1);
      });
    });

    describe('Complex expressions', () => {
      it('should evaluate expression with mixed operators', () => {
        const code = `
          .define BASE 0x8000
          .define OFFSET 0x100
          LD R0, #((BASE + OFFSET) >> 8)
        `;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        // (0x8000 + 0x100) >> 8 = 0x8100 >> 8 = 0x81
        expect(result.segments[0].data[2]).toBe(0x81);
      });

      it('should handle current address symbol $', () => {
        const code = `
          .org $1000
        skip:
          JMP $+5
        `;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        // JMP is at $1000, target is $1000 + 5 = $1005
        expect(result.segments[0].data[2]).toBe(0x05);
        expect(result.segments[0].data[3]).toBe(0x10);
      });

      it('should evaluate expressions in label context', () => {
        const code = `
          .org $8000
        handler:
          NOP
        main:
          LD R0, #(handler >> 8)
          LD R1, #(handler & $FF)
        `;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        // handler is at $8000
        // NOP is at bytes 0-1, first LD starts at byte 2
        // Byte layout: [opcode, register, immediate]
        expect(result.segments[0].data[4]).toBe(0x80); // High byte of handler
        expect(result.segments[0].data[7]).toBe(0x00); // Low byte of handler
      });
    });

    describe('Error handling', () => {
      it('should error on division by zero', () => {
        const code = `LD R0, #(10 / 0)`;
        const result = assemble(code);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some(e => e.message.includes('evaluation failed'))).toBe(true);
      });

      it('should error on modulo by zero', () => {
        const code = `LD R0, #(10 % 0)`;
        const result = assemble(code);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some(e => e.message.includes('evaluation failed'))).toBe(true);
      });
    });
  });

  describe('Extended Instructions', () => {
    it('should assemble RET', () => {
      const code = 'RET';
      const result = assemble(code);
      expect(result.errors).toHaveLength(0);
      expect(result.segments[0].data).toEqual(new Uint8Array([
        (OP_EXT << 4) | (MODE_REGISTER << 1),
        EXT_RET
      ]));
    });

    it('should assemble PUSH R3', () => {
      const code = 'PUSH R3';
      const result = assemble(code);
      expect(result.errors).toHaveLength(0);
      expect(result.segments[0].data).toEqual(new Uint8Array([
        (OP_EXT << 4) | (MODE_REGISTER << 1),
        EXT_PUSH,
        (3 << 5)
      ]));
    });

    it('should assemble POP R4', () => {
      const code = 'POP R4';
      const result = assemble(code);
      expect(result.errors).toHaveLength(0);
      expect(result.segments[0].data).toEqual(new Uint8Array([
        (OP_EXT << 4) | (MODE_REGISTER << 1),
        EXT_POP,
        (4 << 5)
      ]));
    });

    it('should assemble INC R2', () => {
      const code = 'INC R2';
      const result = assemble(code);
      expect(result.errors).toHaveLength(0);
      expect(result.segments[0].data).toEqual(new Uint8Array([
        (OP_EXT << 4) | (MODE_REGISTER << 1),
        EXT_INC,
        (2 << 5)
      ]));
    });

    it('should assemble DEC R1', () => {
      const code = 'DEC R1';
      const result = assemble(code);
      expect(result.errors).toHaveLength(0);
      expect(result.segments[0].data).toEqual(new Uint8Array([
        (OP_EXT << 4) | (MODE_REGISTER << 1),
        EXT_DEC,
        (1 << 5)
      ]));
    });
  });

  describe('Source Map', () => {
    it('should generate source map', () => {
      const code = `
        NOP
        LD R0, #42
        ADD R0, R1
      `;
      const result = assemble(code);
      expect(result.sourceMap.length).toBeGreaterThan(0);
      expect(result.sourceMap[0].address).toBe(0);
      expect(result.sourceMap[0].line).toBe(2); // First non-empty line
    });
  });

  describe('Case Insensitivity', () => {
    it('should handle case-insensitive opcodes', () => {
      const code1 = 'LD R0, #42';
      const code2 = 'ld r0, #42';
      const code3 = 'Ld R0, #42';

      const result1 = assemble(code1);
      const result2 = assemble(code2);
      const result3 = assemble(code3);

      expect(result1.segments[0].data).toEqual(result2.segments[0].data);
      expect(result1.segments[0].data).toEqual(result3.segments[0].data);
    });

    it('should handle case-sensitive labels', () => {
      const code = `
      Main:
        JMP Main
      main:
        JMP main
      `;
      const result = assemble(code);
      expect(result.symbolTable['Main']).toBeDefined();
      expect(result.symbolTable['main']).toBeDefined();
      expect(result.symbolTable['Main']).not.toBe(result.symbolTable['main']);
    });
  });

  describe('Comments', () => {
    it('should ignore comments', () => {
      const code = `
        ; This is a comment
        NOP  ; Another comment
      `;
      const result = assemble(code);
      expect(result.errors).toHaveLength(0);
      expect(result.segments[0].data.length).toBe(2);
    });
  });

  describe('Operand Count Validation', () => {
    it('should error on too many operands for LD', () => {
      const code = 'LD R0, #0, #1, #2';
      const result = assemble(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Invalid operand count');
      expect(result.errors[0].message).toContain('expected 2');
      expect(result.errors[0].message).toContain('got 4');
    });

    it('should error on too few operands for LD', () => {
      const code = 'LD R0';
      const result = assemble(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Invalid operand count');
      expect(result.errors[0].message).toContain('expected 2');
      expect(result.errors[0].message).toContain('got 1');
    });

    it('should error on too many operands for ADD', () => {
      const code = 'ADD R0, #1, #2';
      const result = assemble(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Invalid operand count');
    });

    it('should error on too many operands for PUSH', () => {
      const code = 'PUSH R0, R1';
      const result = assemble(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Invalid operand count');
      expect(result.errors[0].message).toContain('expected 1');
      expect(result.errors[0].message).toContain('got 2');
    });

    it('should error on operands for NOP', () => {
      const code = 'NOP R0';
      const result = assemble(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Invalid operand count');
      expect(result.errors[0].message).toContain('expected 0');
      expect(result.errors[0].message).toContain('got 1');
    });

    it('should error on operands for RET', () => {
      const code = 'RET R0';
      const result = assemble(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Invalid operand count');
      expect(result.errors[0].message).toContain('expected 0');
    });

    it('should accept valid single operand for SHL', () => {
      const code = 'SHL R0';
      const result = assemble(code);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept valid two operands for SHL', () => {
      const code = 'SHL R0, #2';
      const result = assemble(code);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on too many operands for SHL', () => {
      const code = 'SHL R0, #2, #3';
      const result = assemble(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Invalid operand count');
      expect(result.errors[0].message).toContain('expected 1-2');
      expect(result.errors[0].message).toContain('got 3');
    });
  });

  describe('Byte Extraction Operators', () => {
    describe('Low byte operator (<)', () => {
      it('should extract low byte of a constant', () => {
        const code = `
          .define ADDR $C0FF
          LD R0, #<ADDR
        `;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].data[2]).toBe(0xFF); // Low byte of 0xC0FF
      });

      it('should extract low byte of a label', () => {
        const code = `
          .org $8234
        sprite_data:
          NOP
        main:
          LD R0, #<sprite_data
        `;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        // sprite_data is at $8234, low byte is 0x34
        expect(result.segments[0].data[4]).toBe(0x34);
      });

      it('should extract low byte of an expression', () => {
        const code = `
          .define BASE $1000
          LD R0, #<(BASE + 256)
        `;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        // (0x1000 + 256) = 0x1100, low byte is 0x00
        expect(result.segments[0].data[2]).toBe(0x00);
      });

      it('should work in .word directive', () => {
        const code = `
          .define ADDR $ABCD
          .word <ADDR
        `;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        // Low byte of 0xABCD is 0xCD
        // Little-endian: 0xCD, 0x00
        expect(result.segments[0].data[0]).toBe(0xCD);
        expect(result.segments[0].data[1]).toBe(0x00);
      });
    });

    describe('High byte operator (>)', () => {
      it('should extract high byte of a constant', () => {
        const code = `
          .define ADDR $C0FF
          LD R0, #>ADDR
        `;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].data[2]).toBe(0xC0); // High byte of 0xC0FF
      });

      it('should extract high byte of a label', () => {
        const code = `
          .org $8234
        sprite_data:
          NOP
        main:
          LD R0, #>sprite_data
        `;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        // sprite_data is at $8234, high byte is 0x82
        expect(result.segments[0].data[4]).toBe(0x82);
      });

      it('should extract high byte of an expression', () => {
        const code = `
          .define BASE $1000
          LD R0, #>(BASE + 256)
        `;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        // (0x1000 + 256) = 0x1100, high byte is 0x11
        expect(result.segments[0].data[2]).toBe(0x11);
      });

      it('should work in .word directive', () => {
        const code = `
          .define ADDR $ABCD
          .word >ADDR
        `;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        // High byte of 0xABCD is 0xAB
        // Little-endian: 0xAB, 0x00
        expect(result.segments[0].data[0]).toBe(0xAB);
        expect(result.segments[0].data[1]).toBe(0x00);
      });
    });

    describe('Combined usage', () => {
      it('should load 16-bit address into register pair', () => {
        const code = `
          .org $C000
        screen_buffer:
          .res 256

        main:
          LD R2, #>screen_buffer
          LD R3, #<screen_buffer
        `;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.symbolTable['screen_buffer']).toBe(0xC000);

        // First LD R2, #>screen_buffer (high byte)
        expect(result.segments[0].data[258]).toBe(0xC0);

        // Second LD R3, #<screen_buffer (low byte)
        expect(result.segments[0].data[261]).toBe(0x00);
      });

      it('should setup interrupt vectors', () => {
        const code = `
          .org $8000
        vblank_handler:
          NOP
          RTI

        main:
          LD R0, #<vblank_handler
          ST R0, [$0132]
          LD R0, #>vblank_handler
          ST R0, [$0133]
        `;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.symbolTable['vblank_handler']).toBe(0x8000);

        // LD R0, #<vblank_handler
        expect(result.segments[0].data[6]).toBe(0x00);

        // LD R0, #>vblank_handler (after ST instruction)
        expect(result.segments[0].data[13]).toBe(0x80);
      });

      it('should not interfere with comparison operators', () => {
        const code = `
          .define A 10
          .define B 20
          LD R0, #(A < B)
          LD R1, #(B > A)
        `;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].data[2]).toBe(1); // 10 < 20 is true
        expect(result.segments[0].data[5]).toBe(1); // 20 > 10 is true
      });

      it('should not interfere with shift operators', () => {
        const code = `
          LD R0, #(128 >> 4)
          LD R1, #(2 << 3)
        `;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        expect(result.segments[0].data[2]).toBe(8);  // 128 >> 4
        expect(result.segments[0].data[5]).toBe(16); // 2 << 3
      });

      it('should work with complex expressions', () => {
        const code = `
          .define BASE $8000
          .define OFFSET $0100
          LD R0, #<(BASE + OFFSET)
          LD R1, #>(BASE + OFFSET)
        `;
        const result = assemble(code);
        expect(result.errors).toHaveLength(0);
        // 0x8000 + 0x0100 = 0x8100
        expect(result.segments[0].data[2]).toBe(0x00); // Low byte
        expect(result.segments[0].data[5]).toBe(0x81); // High byte
      });
    });
  });

  describe('Integration Tests', () => {
    it('should assemble a complete program', () => {
      const code = `
        .org $8000
        .define SCREEN_ADDR $C000

      main:
        LD R0, #0
        LD R2, #$C0
        LD R3, #$00

      .loop:
        ST R0, [R2:R3]
        INC R3
        BRNZ .loop
        INC R2
        CMP R2, #$D0
        BRNZ .loop

        RET
      `;

      const result = assemble(code);
      expect(result.errors).toHaveLength(0);
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].startAddress).toBe(0x8000);
      expect(result.symbolTable['main']).toBe(0x8000);
      expect(result.symbolTable['SCREEN_ADDR']).toBe(0xC000);
      expect(result.symbolTable['main.loop']).toBeDefined();
    });
  });
});

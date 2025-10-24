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
  OP_NOP, OP_LD, OP_ST, OP_MOV, OP_ADD, OP_SUB, OP_AND, OP_OR,
  OP_XOR, OP_SHL, OP_SHR, OP_CMP, OP_JMP, OP_BR, OP_CALL, OP_EXT,
  EXT_RET, EXT_PUSH, EXT_POP, EXT_INC, EXT_DEC,
  MODE_IMMEDIATE, MODE_REGISTER, MODE_ABSOLUTE, MODE_ZERO_PAGE,
  MODE_ZERO_PAGE_INDEXED, MODE_REGISTER_PAIR,
  BR_Z, BR_NZ, BR_C, BR_NC
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
    it('should evaluate arithmetic expressions', () => {
      const code = `
        .define A 10
        .define B 20
        LD R0, #(A + B)
      `;
      const result = assemble(code);
      expect(result.errors).toHaveLength(0);
      expect(result.segments[0].data[2]).toBe(30);
    });

    it('should evaluate bitwise operations', () => {
      const code = `
        .define MASK 0xFF
        LD R0, #(MASK & 0x0F)
      `;
      const result = assemble(code);
      expect(result.errors).toHaveLength(0);
      expect(result.segments[0].data[2]).toBe(0x0F);
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

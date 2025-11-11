/**
 * CPU Test Suite
 *
 * Comprehensive tests for the CPU implementation based on the CPU specification.
 * Tests are organized by opcode and addressing mode, ensuring:
 * - Correct status flag behavior
 * - Correct cycle counts
 * - Correct register and memory state
 * - Correct stack operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CPU,
  OP_NOP,
  OP_LD,
  OP_ST,
  OP_MOV,
  OP_ADD,
  OP_SUB,
  OP_AND,
  OP_OR,
  OP_XOR,
  OP_SHL,
  OP_SHR,
  OP_CMP,
  OP_JMP,
  OP_BR,
  OP_CALL,
  OP_EXT,
  EXT_RET,
  EXT_RTI,
  EXT_PUSH,
  EXT_POP,
  EXT_INC,
  EXT_DEC,
  EXT_ROL,
  EXT_ROR,
  EXT_SEI,
  EXT_CLI,
  EXT_NOP,
  MODE_IMMEDIATE,
  MODE_REGISTER,
  MODE_ABSOLUTE,
  MODE_ZERO_PAGE,
  MODE_ZERO_PAGE_INDEXED,
  MODE_REGISTER_PAIR,
  BR_Z,
  BR_NZ,
  BR_C,
  BR_NC,
  BR_N,
  BR_NN,
  BR_V,
  BR_NV,
  FLAG_C,
  FLAG_Z,
  FLAG_I,
  FLAG_N,
  FLAG_V,
} from './cpu';
import { MemoryBus } from './memoryBus';

// Helper function to encode instructions
function encodeInstruction(
  opcode: number,
  mode: number,
  dest: number = 0,
  src: number = 0
): number[] {
  const byte1 = (opcode << 4) | (mode << 1);
  const byte2 = (dest << 5) | (src << 2);
  return [byte1, byte2];
}

// Helper to setup and execute an instruction
function setupAndExecute(
  bus: MemoryBus,
  cpu: CPU,
  bytecode: number[],
  startAddress: number = 0x1000
): number {
  // Write bytecode to memory
  for (let i = 0; i < bytecode.length; i++) {
    bus.write8(startAddress + i, bytecode[i]);
  }

  // Set PC to start address
  cpu.setProgramCounter(startAddress);

  // Execute instruction and return cycles consumed
  return cpu.step();
}

describe('CPU', () => {
  let bus: MemoryBus;
  let cpu: CPU;

  beforeEach(() => {
    bus = new MemoryBus();
    cpu = new CPU(bus);
    cpu.reset();
  });

  describe('NOP - No Operation', () => {
    it('should do nothing and consume 1 cycle', () => {
      const bytecode = encodeInstruction(OP_NOP, MODE_REGISTER);
      const cycles = setupAndExecute(bus, cpu, bytecode);

      expect(cycles).toBe(1);
      expect(cpu.getStatus()).toBe(0); // No flags changed
    });
  });

  describe('LD - Load Register', () => {
    describe('Immediate mode', () => {
      it('should load immediate value into register', () => {
        const bytecode = [...encodeInstruction(OP_LD, MODE_IMMEDIATE, 0, 0), 0x42];
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(0)).toBe(0x42);
        expect(cycles).toBe(2);
        expect(cpu.getStatus() & (1 << FLAG_Z)).toBe(0); // Z flag clear
        expect(cpu.getStatus() & (1 << FLAG_N)).toBe(0); // N flag clear
      });

      it('should set Zero flag when loading 0', () => {
        const bytecode = [...encodeInstruction(OP_LD, MODE_IMMEDIATE, 1, 0), 0x00];
        setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(1)).toBe(0);
        expect(cpu.getStatus() & (1 << FLAG_Z)).toBe(1 << FLAG_Z); // Z flag set
        expect(cpu.getStatus() & (1 << FLAG_N)).toBe(0); // N flag clear
      });

      it('should set Negative flag when loading value >= 0x80', () => {
        const bytecode = [...encodeInstruction(OP_LD, MODE_IMMEDIATE, 2, 0), 0x80];
        setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(2)).toBe(0x80);
        expect(cpu.getStatus() & (1 << FLAG_N)).toBe(1 << FLAG_N); // N flag set
        expect(cpu.getStatus() & (1 << FLAG_Z)).toBe(0); // Z flag clear
      });
    });

    describe('Register mode', () => {
      it('should copy value from source to destination register', () => {
        cpu.setRegister(3, 0x55);
        const bytecode = encodeInstruction(OP_LD, MODE_REGISTER, 0, 3);
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(0)).toBe(0x55);
        expect(cycles).toBe(1);
      });
    });

    describe('Absolute mode', () => {
      it('should load value from absolute address', () => {
        bus.write8(0xC000, 0x99);
        const bytecode = [...encodeInstruction(OP_LD, MODE_ABSOLUTE, 1, 0), 0xC0, 0x00];
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(1)).toBe(0x99);
        expect(cycles).toBe(3);
      });
    });

    describe('Zero Page mode', () => {
      it('should load value from zero page indirect address', () => {
        bus.write16(0x80, 0xC000);
        bus.write8(0xC000, 0xAB);
        const bytecode = [...encodeInstruction(OP_LD, MODE_ZERO_PAGE, 2, 0), 0x80];
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(2)).toBe(0xAB);
        expect(cycles).toBe(2);
      });
    });

    describe('Zero Page Indexed mode', () => {
      it('should load value from zero page pointer plus index', () => {
        bus.write16(0x80, 0xC000);
        bus.write8(0xC005, 0xCD);
        cpu.setRegister(1, 0x05);
        const bytecode = [...encodeInstruction(OP_LD, MODE_ZERO_PAGE_INDEXED, 3, 1), 0x80];
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(3)).toBe(0xCD);
        expect(cycles).toBe(2);
      });
    });

    describe('Register Pair mode', () => {
      it('should load value from address in register pair', () => {
        bus.write8(0xD055, 0x77);
        cpu.setRegister(2, 0xD0);
        cpu.setRegister(3, 0x55);
        const bytecode = encodeInstruction(OP_LD, MODE_REGISTER_PAIR, 4, 2);
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(4)).toBe(0x77);
        expect(cycles).toBe(2);
      });
    });
  });

  describe('ST - Store Register', () => {
    describe('Absolute mode', () => {
      it('should store register value to absolute address', () => {
        cpu.setRegister(1, 0x88);
        const bytecode = [...encodeInstruction(OP_ST, MODE_ABSOLUTE, 1, 0), 0xB0, 0x00];
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(bus.read8(0xB000)).toBe(0x88);
        expect(cycles).toBe(3);
      });

      it('should not affect status flags', () => {
        cpu.setRegister(0, 0x00);
        const initialStatus = cpu.getStatus();
        const bytecode = [...encodeInstruction(OP_ST, MODE_ABSOLUTE, 0, 0), 0xA0, 0x50];
        setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getStatus()).toBe(initialStatus);
      });
    });

    describe('Zero Page mode', () => {
      it('should store to zero page indirect address', () => {
        bus.write16(0x90, 0xC100);
        cpu.setRegister(3, 0xEE);
        const bytecode = [...encodeInstruction(OP_ST, MODE_ZERO_PAGE, 3, 0), 0x90];
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(bus.read8(0xC100)).toBe(0xEE);
        expect(cycles).toBe(2);
      });
    });

    describe('Zero Page Indexed mode', () => {
      it('should store to zero page pointer plus index', () => {
        bus.write16(0x70, 0xC200);
        cpu.setRegister(0, 0x0A);
        cpu.setRegister(2, 0xDD);
        const bytecode = [...encodeInstruction(OP_ST, MODE_ZERO_PAGE_INDEXED, 2, 0), 0x70];
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(bus.read8(0xC20A)).toBe(0xDD);
        expect(cycles).toBe(2);
      });
    });

    describe('Register Pair mode', () => {
      it('should store to address in register pair', () => {
        cpu.setRegister(1, 0xBB);
        cpu.setRegister(4, 0xD5);
        cpu.setRegister(5, 0x33);
        const bytecode = encodeInstruction(OP_ST, MODE_REGISTER_PAIR, 1, 4);
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(bus.read8(0xD533)).toBe(0xBB);
        expect(cycles).toBe(2);
      });
    });
  });

  describe('MOV - Move Register', () => {
    it('should copy register to register', () => {
      cpu.setRegister(2, 0x77);
      const bytecode = encodeInstruction(OP_MOV, MODE_REGISTER, 5, 2);
      const cycles = setupAndExecute(bus, cpu, bytecode);

      expect(cpu.getRegister(5)).toBe(0x77);
      expect(cycles).toBe(1);
    });

    it('should update Zero and Negative flags', () => {
      cpu.setRegister(1, 0x00);
      const bytecode = encodeInstruction(OP_MOV, MODE_REGISTER, 0, 1);
      setupAndExecute(bus, cpu, bytecode);

      expect(cpu.getStatus() & (1 << FLAG_Z)).toBe(1 << FLAG_Z);
    });
  });

  describe('ADD - Add', () => {
    describe('Register mode', () => {
      it('should add two registers', () => {
        cpu.setRegister(0, 0x10);
        cpu.setRegister(1, 0x20);
        const bytecode = encodeInstruction(OP_ADD, MODE_REGISTER, 0, 1); // ADD R0, R1
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(0)).toBe(0x30);
        expect(cycles).toBe(1);
        expect(cpu.getStatus() & (1 << FLAG_C)).toBe(0); // C flag clear
        expect(cpu.getStatus() & (1 << FLAG_V)).toBe(0); // V flag clear
      });

      it('should set Carry flag on overflow', () => {
        cpu.setRegister(0, 0xFF);
        cpu.setRegister(1, 0x02);
        const bytecode = encodeInstruction(OP_ADD, MODE_REGISTER, 0, 1);
        setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(0)).toBe(0x01);
        expect(cpu.getStatus() & (1 << FLAG_C)).toBe(1 << FLAG_C); // C flag set
      });

      it('should set Overflow flag on signed overflow', () => {
        cpu.setRegister(0, 0x7F); // +127
        cpu.setRegister(1, 0x01); // +1
        const bytecode = encodeInstruction(OP_ADD, MODE_REGISTER, 0, 1);
        setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(0)).toBe(0x80); // -128 in two's complement
        expect(cpu.getStatus() & (1 << FLAG_V)).toBe(1 << FLAG_V); // V flag set
        expect(cpu.getStatus() & (1 << FLAG_N)).toBe(1 << FLAG_N); // N flag set
      });
    });

    describe('Immediate mode', () => {
      it('should add immediate value to register', () => {
        cpu.setRegister(2, 0x50);
        const bytecode = [...encodeInstruction(OP_ADD, MODE_IMMEDIATE, 2, 0), 0x30];
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(2)).toBe(0x80);
        expect(cycles).toBe(2);
      });
    });
  });

  describe('SUB - Subtract', () => {
    describe('Register mode', () => {
      it('should subtract registers', () => {
        cpu.setRegister(0, 0x50);
        cpu.setRegister(1, 0x20);
        const bytecode = encodeInstruction(OP_SUB, MODE_REGISTER, 0, 1); // SUB R0, R1
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(0)).toBe(0x30);
        expect(cycles).toBe(1);
        expect(cpu.getStatus() & (1 << FLAG_C)).toBe(1 << FLAG_C); // C flag set (no borrow)
      });

      it('should clear Carry flag on borrow', () => {
        cpu.setRegister(0, 0x10);
        cpu.setRegister(1, 0x20);
        const bytecode = encodeInstruction(OP_SUB, MODE_REGISTER, 0, 1);
        setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(0)).toBe(0xF0); // Wrapped around
        expect(cpu.getStatus() & (1 << FLAG_C)).toBe(0); // C flag clear (borrow)
      });

      it('should set Overflow flag on signed overflow', () => {
        cpu.setRegister(0, 0x80); // -128
        cpu.setRegister(1, 0x01); // -1
        const bytecode = encodeInstruction(OP_SUB, MODE_REGISTER, 0, 1);
        setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getStatus() & (1 << FLAG_V)).toBe(1 << FLAG_V); // V flag set
      });
    });

    describe('Immediate mode', () => {
      it('should subtract immediate value from register', () => {
        cpu.setRegister(3, 0x60);
        const bytecode = [...encodeInstruction(OP_SUB, MODE_IMMEDIATE, 3, 0), 0x10];
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(3)).toBe(0x50);
        expect(cycles).toBe(2);
      });
    });
  });

  describe('AND - Bitwise AND', () => {
    describe('Register mode', () => {
      it('should perform bitwise AND', () => {
        cpu.setRegister(0, 0b11110000);
        cpu.setRegister(1, 0b10101010);
        const bytecode = encodeInstruction(OP_AND, MODE_REGISTER, 0, 1);
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(0)).toBe(0b10100000);
        expect(cycles).toBe(1);
      });

      it('should update Zero and Negative flags', () => {
        cpu.setRegister(0, 0b00001111);
        cpu.setRegister(1, 0b11110000);
        const bytecode = encodeInstruction(OP_AND, MODE_REGISTER, 0, 1);
        setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(0)).toBe(0);
        expect(cpu.getStatus() & (1 << FLAG_Z)).toBe(1 << FLAG_Z); // Z flag set
      });
    });

    describe('Immediate mode', () => {
      it('should perform bitwise AND with immediate', () => {
        cpu.setRegister(2, 0xFF);
        const bytecode = [...encodeInstruction(OP_AND, MODE_IMMEDIATE, 2, 0), 0x0F];
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(2)).toBe(0x0F);
        expect(cycles).toBe(2);
      });
    });
  });

  describe('OR - Bitwise OR', () => {
    describe('Register mode', () => {
      it('should perform bitwise OR', () => {
        cpu.setRegister(0, 0b11110000);
        cpu.setRegister(1, 0b00001111);
        const bytecode = encodeInstruction(OP_OR, MODE_REGISTER, 0, 1);
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(0)).toBe(0xFF);
        expect(cycles).toBe(1);
      });
    });

    describe('Immediate mode', () => {
      it('should perform bitwise OR with immediate', () => {
        cpu.setRegister(3, 0b10101010);
        const bytecode = [...encodeInstruction(OP_OR, MODE_IMMEDIATE, 3, 0), 0b01010101];
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(3)).toBe(0xFF);
        expect(cycles).toBe(2);
      });
    });
  });

  describe('XOR - Bitwise XOR', () => {
    describe('Register mode', () => {
      it('should perform bitwise XOR', () => {
        cpu.setRegister(0, 0b11110000);
        cpu.setRegister(1, 0b10101010);
        const bytecode = encodeInstruction(OP_XOR, MODE_REGISTER, 0, 1);
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(0)).toBe(0b01011010);
        expect(cycles).toBe(1);
      });
    });

    describe('Immediate mode', () => {
      it('should perform bitwise XOR with immediate', () => {
        cpu.setRegister(4, 0xFF);
        const bytecode = [...encodeInstruction(OP_XOR, MODE_IMMEDIATE, 4, 0), 0xAA];
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(4)).toBe(0x55);
        expect(cycles).toBe(2);
      });
    });
  });

  describe('SHL - Shift Left', () => {
    describe('Single shift', () => {
      it('should shift left by 1', () => {
        cpu.setRegister(0, 0b01010101);
        const bytecode = encodeInstruction(OP_SHL, MODE_REGISTER, 0, 0);
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(0)).toBe(0b10101010);
        expect(cycles).toBe(1);
        expect(cpu.getStatus() & (1 << FLAG_C)).toBe(0); // C flag clear
      });

      it('should set Carry flag when bit 7 is shifted out', () => {
        cpu.setRegister(1, 0b10000000);
        const bytecode = encodeInstruction(OP_SHL, MODE_REGISTER, 1, 0);
        setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(1)).toBe(0);
        expect(cpu.getStatus() & (1 << FLAG_C)).toBe(1 << FLAG_C); // C flag set
      });
    });

    describe('Multiple shift', () => {
      it('should shift left by n positions', () => {
        cpu.setRegister(2, 0b00000011);
        const bytecode = [...encodeInstruction(OP_SHL, MODE_IMMEDIATE, 2, 0), 0x03];
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(2)).toBe(0b00011000);
        expect(cycles).toBe(2);
      });
    });
  });

  describe('SHR - Shift Right', () => {
    describe('Single shift', () => {
      it('should shift right by 1', () => {
        cpu.setRegister(0, 0b10101010);
        const bytecode = encodeInstruction(OP_SHR, MODE_REGISTER, 0, 0);
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(0)).toBe(0b01010101);
        expect(cycles).toBe(1);
        expect(cpu.getStatus() & (1 << FLAG_C)).toBe(0); // C flag clear
      });

      it('should set Carry flag when bit 0 is shifted out', () => {
        cpu.setRegister(1, 0b00000001);
        const bytecode = encodeInstruction(OP_SHR, MODE_REGISTER, 1, 0);
        setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(1)).toBe(0);
        expect(cpu.getStatus() & (1 << FLAG_C)).toBe(1 << FLAG_C); // C flag set
      });
    });

    describe('Multiple shift', () => {
      it('should shift right by n positions', () => {
        cpu.setRegister(2, 0b11000000);
        const bytecode = [...encodeInstruction(OP_SHR, MODE_IMMEDIATE, 2, 0), 0x03];
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(2)).toBe(0b00011000);
        expect(cycles).toBe(2);
      });
    });
  });

  describe('CMP - Compare', () => {
    describe('Register mode', () => {
      it('should set Zero flag when equal', () => {
        cpu.setRegister(0, 0x42);
        cpu.setRegister(1, 0x42);
        const bytecode = encodeInstruction(OP_CMP, MODE_REGISTER, 0, 1);
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getStatus() & (1 << FLAG_Z)).toBe(1 << FLAG_Z); // Z flag set
        expect(cpu.getStatus() & (1 << FLAG_C)).toBe(1 << FLAG_C); // C flag set (>=)
        expect(cycles).toBe(1);
      });

      it('should set Carry flag when Rd >= Rs', () => {
        cpu.setRegister(0, 0x50);
        cpu.setRegister(1, 0x30);
        const bytecode = encodeInstruction(OP_CMP, MODE_REGISTER, 0, 1);
        setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getStatus() & (1 << FLAG_C)).toBe(1 << FLAG_C); // C flag set
        expect(cpu.getStatus() & (1 << FLAG_Z)).toBe(0); // Z flag clear
      });

      it('should clear Carry flag when Rd < Rs', () => {
        cpu.setRegister(0, 0x20);
        cpu.setRegister(1, 0x30);
        const bytecode = encodeInstruction(OP_CMP, MODE_REGISTER, 0, 1);
        setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getStatus() & (1 << FLAG_C)).toBe(0); // C flag clear
      });

      it('should set Negative flag for negative result', () => {
        cpu.setRegister(0, 0x10);
        cpu.setRegister(1, 0x20);
        const bytecode = encodeInstruction(OP_CMP, MODE_REGISTER, 0, 1);
        setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getStatus() & (1 << FLAG_N)).toBe(1 << FLAG_N); // N flag set
      });
    });

    describe('Immediate mode', () => {
      it('should compare register with immediate', () => {
        cpu.setRegister(2, 0x55);
        const bytecode = [...encodeInstruction(OP_CMP, MODE_IMMEDIATE, 2, 0), 0x55];
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getStatus() & (1 << FLAG_Z)).toBe(1 << FLAG_Z); // Z flag set
        expect(cycles).toBe(2);
      });
    });
  });

  describe('JMP - Jump', () => {
    describe('Absolute mode', () => {
      it('should jump to absolute address', () => {
        const bytecode = [...encodeInstruction(OP_JMP, MODE_ABSOLUTE, 0, 0), 0x12, 0x34];
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getProgramCounter()).toBe(0x1234);
        expect(cycles).toBe(2);
      });
    });

    describe('Register Pair mode', () => {
      it('should jump to address in register pair', () => {
        cpu.setRegister(0, 0x56); // High byte
        cpu.setRegister(1, 0x78); // Low byte
        const bytecode = encodeInstruction(OP_JMP, MODE_REGISTER_PAIR, 0, 0); // JMP [R0:R1]
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getProgramCounter()).toBe(0x5678);
        expect(cycles).toBe(2);
      });
    });

    describe('Zero Page mode', () => {
      it('should jump to address stored in zero page', () => {
        bus.write16(0xA0, 0x9ABC);
        const bytecode = [...encodeInstruction(OP_JMP, MODE_ZERO_PAGE, 0, 0), 0xA0];
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getProgramCounter()).toBe(0x9ABC);
        expect(cycles).toBe(2);
      });
    });
  });

  describe('BR - Branch', () => {
    const testBranch = (condition: number, flagSetup: () => void, shouldBranch: boolean) => {
      flagSetup();
      const bytecode = [...encodeInstruction(OP_BR, MODE_REGISTER, condition, 0), 0x10]; // Branch forward 16 bytes
      const startPC = 0x1000;
      const cycles = setupAndExecute(bus, cpu, bytecode, startPC);

      if (shouldBranch) {
        expect(cpu.getProgramCounter()).toBe(startPC + 3 + 0x10); // PC after instruction + offset
        expect(cycles).toBe(2);
      } else {
        expect(cpu.getProgramCounter()).toBe(startPC + 3); // PC just after instruction
        expect(cycles).toBe(1);
      }
    };

    it('should branch on zero (BRZ) when Z flag is set', () => {
      testBranch(BR_Z, () => {
        cpu.setRegister(0, 0);
        const ld = [...encodeInstruction(OP_LD, MODE_IMMEDIATE, 0, 0), 0x00];
        setupAndExecute(bus, cpu, ld, 0x0500);
      }, true);
    });

    it('should not branch on zero (BRZ) when Z flag is clear', () => {
      testBranch(BR_Z, () => {
        cpu.setRegister(0, 1);
        const ld = [...encodeInstruction(OP_LD, MODE_IMMEDIATE, 0, 0), 0x01];
        setupAndExecute(bus, cpu, ld, 0x0500);
      }, false);
    });

    it('should branch on not zero (BRNZ) when Z flag is clear', () => {
      testBranch(BR_NZ, () => {
        cpu.setRegister(0, 1);
        const ld = [...encodeInstruction(OP_LD, MODE_IMMEDIATE, 0, 0), 0x01];
        setupAndExecute(bus, cpu, ld, 0x0500);
      }, true);
    });

    it('should branch on carry (BRC) when C flag is set', () => {
      testBranch(BR_C, () => {
        cpu.setRegister(0, 0xFF);
        cpu.setRegister(1, 0x01);
        const add = encodeInstruction(OP_ADD, MODE_REGISTER, 0, 1);
        setupAndExecute(bus, cpu, add, 0x0500);
      }, true);
    });

    it('should branch on not carry (BRNC) when C flag is clear', () => {
      testBranch(BR_NC, () => {
        cpu.setRegister(0, 0x10);
        cpu.setRegister(1, 0x10);
        const add = encodeInstruction(OP_ADD, MODE_REGISTER, 0, 1);
        setupAndExecute(bus, cpu, add, 0x0500);
      }, true);
    });

    it('should branch on negative (BRN) when N flag is set', () => {
      testBranch(BR_N, () => {
        const ld = [...encodeInstruction(OP_LD, MODE_IMMEDIATE, 0, 0), 0x80];
        setupAndExecute(bus, cpu, ld, 0x0500);
      }, true);
    });

    it('should branch on not negative (BRNN) when N flag is clear', () => {
      testBranch(BR_NN, () => {
        const ld = [...encodeInstruction(OP_LD, MODE_IMMEDIATE, 0, 0), 0x7F];
        setupAndExecute(bus, cpu, ld, 0x0500);
      }, true);
    });

    it('should branch on overflow (BRV) when V flag is set', () => {
      testBranch(BR_V, () => {
        cpu.setRegister(0, 0x7F);
        cpu.setRegister(1, 0x01);
        const add = encodeInstruction(OP_ADD, MODE_REGISTER, 0, 1);
        setupAndExecute(bus, cpu, add, 0x0500);
      }, true);
    });

    it('should branch on not overflow (BRNV) when V flag is clear', () => {
      testBranch(BR_NV, () => {
        cpu.setRegister(0, 0x10);
        cpu.setRegister(1, 0x10);
        const add = encodeInstruction(OP_ADD, MODE_REGISTER, 0, 1);
        setupAndExecute(bus, cpu, add, 0x0500);
      }, true);
    });

    it('should handle negative offset (backward branch)', () => {
      cpu.setRegister(0, 0);
      const ld = [...encodeInstruction(OP_LD, MODE_IMMEDIATE, 0, 0), 0x00];
      setupAndExecute(bus, cpu, ld, 0x0500);

      const bytecode = [...encodeInstruction(OP_BR, MODE_REGISTER, BR_Z, 0), 0xF0]; // -16 signed
      const startPC = 0x1000;
      setupAndExecute(bus, cpu, bytecode, startPC);

      expect(cpu.getProgramCounter()).toBe(startPC + 3 - 16);
    });
  });

  describe('CALL - Call Subroutine', () => {
    describe('Absolute mode', () => {
      it('should push return address and jump', () => {
        cpu.setStackPointer(0x7FFF);
        const bytecode = [...encodeInstruction(OP_CALL, MODE_ABSOLUTE, 0, 0), 0x20, 0x00];
        const startPC = 0x1000;
        const cycles = setupAndExecute(bus, cpu, bytecode, startPC);

        expect(cpu.getProgramCounter()).toBe(0x2000);
        expect(cycles).toBe(4);

        // Check stack - return address should be startPC + 4 (after CALL instruction)
        // Stack pushes: low byte first, then high byte
        expect(cpu.getStackPointer()).toBe(0x7FFD);
        expect(bus.read8(0x7FFF)).toBe(0x04); // Low byte of return address (pushed first)
        expect(bus.read8(0x7FFE)).toBe(0x10); // High byte of return address (pushed second)
      });
    });

    describe('Register Pair mode', () => {
      it('should push return address and jump to register pair', () => {
        cpu.setStackPointer(0x7FFF);
        cpu.setRegister(2, 0x30); // High byte
        cpu.setRegister(3, 0x00); // Low byte
        const bytecode = encodeInstruction(OP_CALL, MODE_REGISTER_PAIR, 0, 2); // CALL [R2:R3]
        const startPC = 0x1500;
        const cycles = setupAndExecute(bus, cpu, bytecode, startPC);

        expect(cpu.getProgramCounter()).toBe(0x3000);
        expect(cycles).toBe(4);
        expect(cpu.getStackPointer()).toBe(0x7FFD);
      });
    });
  });

  describe('Extended Instructions', () => {
    describe('RET - Return from Subroutine', () => {
      it('should pop return address and jump', () => {
        cpu.setStackPointer(0x7FFD);
        bus.write8(0x7FFE, 0x12); // High byte (popped first)
        bus.write8(0x7FFF, 0x34); // Low byte (popped second)

        const bytecode = [OP_EXT << 4 | MODE_REGISTER << 1, EXT_RET]; // EXT opcode + RET sub-opcode
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getProgramCounter()).toBe(0x1234);
        expect(cpu.getStackPointer()).toBe(0x7FFF);
        expect(cycles).toBe(3);
      });
    });

    describe('RTI - Return from Interrupt', () => {
      it('should pop status and return address', () => {
        // Setup stack as if interrupt was dispatched
        // Interrupt dispatch pushes: Status, PC low, PC high (in that order)
        // RTI pops in reverse: PC high, PC low, Status
        // So stack should have (from top to bottom):
        //   [0x7FFF] = Status (first pushed, last popped)
        //   [0x7FFE] = PC low (second pushed, second popped)
        //   [0x7FFD] = PC high (last pushed, first popped)
        cpu.setStackPointer(0x7FFC);
        bus.write8(0x7FFF, 0x83); // Status with C, Z, N flags set (first pushed)
        bus.write8(0x7FFE, 0x56); // Low byte of PC (second pushed)
        bus.write8(0x7FFD, 0x78); // High byte of PC (last pushed)

        const bytecode = [OP_EXT << 4 | MODE_REGISTER << 1, EXT_RTI]; // EXT opcode + RTI sub-opcode
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getProgramCounter()).toBe(0x7856);
        expect(cpu.getStatus()).toBe(0x83);
        expect(cpu.getStackPointer()).toBe(0x7FFF);
        expect(cycles).toBe(3);
      });
    });

    describe('PUSH - Push Register', () => {
      it('should push register value onto stack', () => {
        cpu.setStackPointer(0x7FFF);
        cpu.setRegister(3, 0xAB);

        const bytecode = [OP_EXT << 4 | MODE_REGISTER << 1, EXT_PUSH, 0x60]; // EXT + PUSH + R3
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(bus.read8(0x7FFF)).toBe(0xAB);
        expect(cpu.getStackPointer()).toBe(0x7FFE);
        expect(cycles).toBe(2);
      });
    });

    describe('POP - Pop Register', () => {
      it('should pop value from stack to register', () => {
        cpu.setStackPointer(0x7FFE);
        bus.write8(0x7FFF, 0xCD);

        const bytecode = [OP_EXT << 4 | MODE_REGISTER << 1, EXT_POP, 0x80]; // EXT + POP + R4
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(4)).toBe(0xCD);
        expect(cpu.getStackPointer()).toBe(0x7FFF);
        expect(cycles).toBe(2);
      });

      it('should update Zero and Negative flags', () => {
        cpu.setStackPointer(0x7FFE);
        bus.write8(0x7FFF, 0x00);

        const bytecode = [OP_EXT << 4 | MODE_REGISTER << 1, EXT_POP, 0x00]; // EXT + POP + R0
        setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getStatus() & (1 << FLAG_Z)).toBe(1 << FLAG_Z); // Z flag set
      });
    });

    describe('INC - Increment', () => {
      it('should increment register', () => {
        cpu.setRegister(2, 0x41);

        const bytecode = [OP_EXT << 4 | MODE_REGISTER << 1, EXT_INC, 0x40]; // EXT + INC + R2
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(2)).toBe(0x42);
        expect(cycles).toBe(2);
      });

      it('should wrap around from 0xFF to 0x00', () => {
        cpu.setRegister(0, 0xFF);

        const bytecode = [OP_EXT << 4 | MODE_REGISTER << 1, EXT_INC, 0x00]; // EXT + INC + R0
        setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(0)).toBe(0x00);
        expect(cpu.getStatus() & (1 << FLAG_Z)).toBe(1 << FLAG_Z); // Z flag set
      });
    });

    describe('DEC - Decrement', () => {
      it('should decrement register', () => {
        cpu.setRegister(3, 0x42);

        const bytecode = [OP_EXT << 4 | MODE_REGISTER << 1, EXT_DEC, 0x60]; // EXT + DEC + R3
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(3)).toBe(0x41);
        expect(cycles).toBe(2);
      });

      it('should wrap around from 0x00 to 0xFF', () => {
        cpu.setRegister(1, 0x00);

        const bytecode = [OP_EXT << 4 | MODE_REGISTER << 1, EXT_DEC, 0x20]; // EXT + DEC + R1
        setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(1)).toBe(0xFF);
        expect(cpu.getStatus() & (1 << FLAG_N)).toBe(1 << FLAG_N); // N flag set
      });
    });

    describe('ROL - Rotate Left', () => {
      it('should rotate left through carry', () => {
        cpu.setRegister(0, 0b10110011);
        // Set carry flag first
        cpu.setRegister(1, 0xFF);
        cpu.setRegister(2, 0x02);
        const add = encodeInstruction(OP_ADD, MODE_REGISTER, 1, 2);
        setupAndExecute(bus, cpu, add, 0x0500);

        const bytecode = [OP_EXT << 4 | MODE_REGISTER << 1, EXT_ROL, 0x00]; // EXT + ROL + R0
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(0)).toBe(0b01100111); // Rotated with carry in
        expect(cpu.getStatus() & (1 << FLAG_C)).toBe(1 << FLAG_C); // C flag set (bit 7 was 1)
        expect(cycles).toBe(2);
      });

      it('should rotate with carry clear', () => {
        cpu.setRegister(2, 0b01010101);

        const bytecode = [OP_EXT << 4 | MODE_REGISTER << 1, EXT_ROL, 0x40]; // EXT + ROL + R2
        setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(2)).toBe(0b10101010);
        expect(cpu.getStatus() & (1 << FLAG_C)).toBe(0); // C flag clear (bit 7 was 0)
      });
    });

    describe('ROR - Rotate Right', () => {
      it('should rotate right through carry', () => {
        cpu.setRegister(0, 0b11001101);
        // Set carry flag first
        cpu.setRegister(1, 0xFF);
        cpu.setRegister(2, 0x02);
        const add = encodeInstruction(OP_ADD, MODE_REGISTER, 1, 2);
        setupAndExecute(bus, cpu, add, 0x0500);

        const bytecode = [OP_EXT << 4 | MODE_REGISTER << 1, EXT_ROR, 0x00]; // EXT + ROR + R0
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(0)).toBe(0b11100110); // Rotated with carry in
        expect(cpu.getStatus() & (1 << FLAG_C)).toBe(1 << FLAG_C); // C flag set (bit 0 was 1)
        expect(cycles).toBe(2);
      });

      it('should rotate with carry clear', () => {
        cpu.setRegister(3, 0b10101010);

        const bytecode = [OP_EXT << 4 | MODE_REGISTER << 1, EXT_ROR, 0x60]; // EXT + ROR + R3
        setupAndExecute(bus, cpu, bytecode);

        expect(cpu.getRegister(3)).toBe(0b01010101);
        expect(cpu.getStatus() & (1 << FLAG_C)).toBe(0); // C flag clear (bit 0 was 0)
      });
    });

    describe('SEI - Set Interrupt Enable', () => {
      it('should consume 1 cycle', () => {
        const bytecode = [OP_EXT << 4 | MODE_REGISTER << 1, EXT_SEI]; // EXT + SEI
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(cycles).toBe(1);
      });
    });

    describe('CLI - Clear Interrupt Enable', () => {
      it('should consume 1 cycle', () => {
        const bytecode = [OP_EXT << 4 | MODE_REGISTER << 1, EXT_CLI]; // EXT + CLI
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(cycles).toBe(1);
      });
    });

    describe('Extended NOP', () => {
      it('should consume 1 cycle', () => {
        const bytecode = [OP_EXT << 4 | MODE_REGISTER << 1, EXT_NOP]; // EXT + NOP
        const cycles = setupAndExecute(bus, cpu, bytecode);

        expect(cycles).toBe(1);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle interrupt dispatch and RTI correctly', () => {
      // Setup: PC=0x1000, Status=0x00, SP=0x7FFF
      cpu.setProgramCounter(0x1000);
      cpu.setStackPointer(0x7FFF);
      const initialStatus = 0x05; // Some flags set

      // Manually set status to simulate state before interrupt
      cpu.setRegister(0, 0x00);
      const ld = [...encodeInstruction(OP_LD, MODE_IMMEDIATE, 0, 0), initialStatus];
      for (let i = 0; i < ld.length; i++) {
        bus.write8(0x0500 + i, ld[i]);
      }
      cpu.setProgramCounter(0x0500);
      cpu.step();

      // Reset PC to simulate being in middle of execution
      cpu.setProgramCounter(0x1000);

      // Simulate interrupt dispatch manually (normally done by checkInterrupts)
      const statusBeforeInterrupt = cpu.getStatus();
      const pcBeforeInterrupt = cpu.getProgramCounter();

      // Push status, PC low, PC high (as dispatchInterrupt does)
      const push = (value: number) => {
        bus.write8(cpu.getStackPointer(), value & 0xFF);
        cpu.setStackPointer((cpu.getStackPointer() - 1) & 0xFFFF);
      };

      push(statusBeforeInterrupt);
      push(pcBeforeInterrupt & 0xFF);
      push((pcBeforeInterrupt >> 8) & 0xFF);

      // Verify stack contents
      expect(bus.read8(0x7FFF)).toBe(statusBeforeInterrupt); // Status
      expect(bus.read8(0x7FFE)).toBe(0x00); // PC low
      expect(bus.read8(0x7FFD)).toBe(0x10); // PC high
      expect(cpu.getStackPointer()).toBe(0x7FFC);

      // Now execute RTI
      const rti = [OP_EXT << 4 | MODE_REGISTER << 1, EXT_RTI];
      for (let i = 0; i < rti.length; i++) {
        bus.write8(0x2000 + i, rti[i]);
      }
      cpu.setProgramCounter(0x2000);
      cpu.step();

      // Verify RTI restored everything correctly
      expect(cpu.getProgramCounter()).toBe(0x1000); // PC restored
      expect(cpu.getStatus()).toBe(statusBeforeInterrupt); // Status restored
      expect(cpu.getStackPointer()).toBe(0x7FFF); // Stack restored
    });

    it('should execute a sequence of instructions correctly', () => {
      const program = [
        // LD R0, #0x10
        ...encodeInstruction(OP_LD, MODE_IMMEDIATE, 0, 0), 0x10,
        // LD R1, #0x20
        ...encodeInstruction(OP_LD, MODE_IMMEDIATE, 1, 0), 0x20,
        // ADD R0, R1
        ...encodeInstruction(OP_ADD, MODE_REGISTER, 0, 1),
        // ST R0, [$2000]
        ...encodeInstruction(OP_ST, MODE_ABSOLUTE, 0, 0), 0x20, 0x00,
      ];

      for (let i = 0; i < program.length; i++) {
        bus.write8(0x1000 + i, program[i]);
      }

      cpu.setProgramCounter(0x1000);

      cpu.step(); // LD R0, #0x10
      cpu.step(); // LD R1, #0x20
      cpu.step(); // ADD R0, R1
      cpu.step(); // ST R0, [$2000]

      expect(bus.read8(0x2000)).toBe(0x30);
    });

    it('should handle subroutine call and return', () => {
      cpu.setStackPointer(0x7FFF);

      // Main program
      const main = [
        // CALL $2000
        ...encodeInstruction(OP_CALL, MODE_ABSOLUTE, 0, 0), 0x20, 0x00,
      ];

      // Subroutine at $2000
      const subroutine = [
        // LD R0, #0x55
        ...encodeInstruction(OP_LD, MODE_IMMEDIATE, 0, 0), 0x55,
        // RET
        0xF2, 0xF0,
      ];

      for (let i = 0; i < main.length; i++) {
        bus.write8(0x1000 + i, main[i]);
      }
      for (let i = 0; i < subroutine.length; i++) {
        bus.write8(0x2000 + i, subroutine[i]);
      }

      cpu.setProgramCounter(0x1000);

      cpu.step(); // CALL $2000
      expect(cpu.getProgramCounter()).toBe(0x2000);

      cpu.step(); // LD R0, #0x55
      expect(cpu.getRegister(0)).toBe(0x55);

      cpu.step(); // RET
      expect(cpu.getProgramCounter()).toBe(0x1004); // Return to after CALL
      expect(cpu.getStackPointer()).toBe(0x7FFF); // Stack restored
    });
  });
});

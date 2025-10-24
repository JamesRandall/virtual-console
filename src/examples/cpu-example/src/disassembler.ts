/**
 * Disassembler for the Virtual Console CPU
 * Converts machine code bytes to assembly mnemonics
 */

import { MemoryBus } from '../../../console/src/memoryBus';

// Opcode constants
const OP_NOP = 0x0;
const OP_LD = 0x1;
const OP_ST = 0x2;
const OP_MOV = 0x3;
const OP_ADD = 0x4;
const OP_SUB = 0x5;
const OP_AND = 0x6;
const OP_OR = 0x7;
const OP_XOR = 0x8;
const OP_SHL = 0x9;
const OP_SHR = 0xA;
const OP_CMP = 0xB;
const OP_JMP = 0xC;
const OP_BR = 0xD;
const OP_CALL = 0xE;
const OP_EXT = 0xF;

// Extended instruction sub-opcodes
const EXT_RET = 0xF0;
const EXT_RTI = 0xF1;
const EXT_PUSH = 0xF2;
const EXT_POP = 0xF3;
const EXT_INC = 0xF4;
const EXT_DEC = 0xF5;
const EXT_ROL = 0xF6;
const EXT_ROR = 0xF7;
const EXT_SEI = 0xF8;
const EXT_CLI = 0xF9;
const EXT_NOP = 0xFA;

// Addressing mode constants
const MODE_IMMEDIATE = 0x0;
const MODE_REGISTER = 0x1;
const MODE_ABSOLUTE = 0x2;
const MODE_ZERO_PAGE = 0x3;
const MODE_ZERO_PAGE_INDEXED = 0x4;
const MODE_REGISTER_PAIR = 0x5;

// Branch condition constants
const BR_Z = 0x0;
const BR_NZ = 0x1;
const BR_C = 0x2;
const BR_NC = 0x3;
const BR_N = 0x4;
const BR_NN = 0x5;
const BR_V = 0x6;
const BR_NV = 0x7;

const BRANCH_NAMES = ['BRZ', 'BRNZ', 'BRC', 'BRNC', 'BRN', 'BRNN', 'BRV', 'BRNV'];

/**
 * Disassemble a single instruction at the given PC
 * Returns the assembly mnemonic and the number of bytes consumed
 */
export function disassemble(bus: MemoryBus, pc: number): { mnemonic: string; bytes: number } {
  try {
    const byte1 = bus.read8(pc);
    const opcode = (byte1 >> 4) & 0xF;
    const mode = (byte1 >> 1) & 0x7;

    let currentPC = pc + 1;

    // Helper to read next byte
    const readByte = (): number => {
      const value = bus.read8(currentPC);
      currentPC++;
      return value;
    };

    // Helper to decode registers
    const decodeRegs = (): { dest: number; src: number } => {
      const byte2 = readByte();
      return {
        dest: (byte2 >> 5) & 0x7,
        src: (byte2 >> 2) & 0x7,
      };
    };

    const regName = (r: number): string => `R${r}`;

    switch (opcode) {
      case OP_NOP: {
        readByte(); // byte 2
        return { mnemonic: 'NOP', bytes: currentPC - pc };
      }

      case OP_LD: {
        const { dest, src } = decodeRegs();
        switch (mode) {
          case MODE_IMMEDIATE: {
            const imm = readByte();
            return { mnemonic: `LD ${regName(dest)}, #${imm}`, bytes: currentPC - pc };
          }
          case MODE_REGISTER:
            return { mnemonic: `LD ${regName(dest)}, ${regName(src)}`, bytes: currentPC - pc };
          case MODE_ABSOLUTE: {
            const low = readByte();
            const high = readByte();
            const addr = (high << 8) | low;
            return { mnemonic: `LD ${regName(dest)}, [$${addr.toString(16).padStart(4, '0')}]`, bytes: currentPC - pc };
          }
          case MODE_ZERO_PAGE: {
            const zp = readByte();
            return { mnemonic: `LD ${regName(dest)}, [$${zp.toString(16).padStart(2, '0')}]`, bytes: currentPC - pc };
          }
          case MODE_ZERO_PAGE_INDEXED: {
            const zp = readByte();
            return { mnemonic: `LD ${regName(dest)}, [$${zp.toString(16).padStart(2, '0')}+${regName(src)}]`, bytes: currentPC - pc };
          }
          case MODE_REGISTER_PAIR:
            return { mnemonic: `LD ${regName(dest)}, [${regName(src)}:${regName((src + 1) & 0x7)}]`, bytes: currentPC - pc };
          default:
            return { mnemonic: `LD (unknown mode ${mode})`, bytes: currentPC - pc };
        }
      }

      case OP_ST: {
        const { dest, src } = decodeRegs();
        switch (mode) {
          case MODE_ABSOLUTE: {
            const low = readByte();
            const high = readByte();
            const addr = (high << 8) | low;
            return { mnemonic: `ST ${regName(dest)}, [$${addr.toString(16).padStart(4, '0')}]`, bytes: currentPC - pc };
          }
          case MODE_ZERO_PAGE: {
            const zp = readByte();
            return { mnemonic: `ST ${regName(dest)}, [$${zp.toString(16).padStart(2, '0')}]`, bytes: currentPC - pc };
          }
          case MODE_ZERO_PAGE_INDEXED: {
            const zp = readByte();
            return { mnemonic: `ST ${regName(dest)}, [$${zp.toString(16).padStart(2, '0')}+${regName(src)}]`, bytes: currentPC - pc };
          }
          case MODE_REGISTER_PAIR:
            return { mnemonic: `ST ${regName(dest)}, [${regName(src)}:${regName((src + 1) & 0x7)}]`, bytes: currentPC - pc };
          default:
            return { mnemonic: `ST (unknown mode ${mode})`, bytes: currentPC - pc };
        }
      }

      case OP_MOV: {
        const { dest, src } = decodeRegs();
        return { mnemonic: `MOV ${regName(dest)}, ${regName(src)}`, bytes: currentPC - pc };
      }

      case OP_ADD: {
        const { dest, src } = decodeRegs();
        if (mode === MODE_IMMEDIATE) {
          const imm = readByte();
          return { mnemonic: `ADD ${regName(dest)}, #${imm}`, bytes: currentPC - pc };
        } else {
          return { mnemonic: `ADD ${regName(dest)}, ${regName(src)}`, bytes: currentPC - pc };
        }
      }

      case OP_SUB: {
        const { dest, src } = decodeRegs();
        if (mode === MODE_IMMEDIATE) {
          const imm = readByte();
          return { mnemonic: `SUB ${regName(dest)}, #${imm}`, bytes: currentPC - pc };
        } else {
          return { mnemonic: `SUB ${regName(dest)}, ${regName(src)}`, bytes: currentPC - pc };
        }
      }

      case OP_AND: {
        const { dest, src } = decodeRegs();
        if (mode === MODE_IMMEDIATE) {
          const imm = readByte();
          return { mnemonic: `AND ${regName(dest)}, #${imm}`, bytes: currentPC - pc };
        } else {
          return { mnemonic: `AND ${regName(dest)}, ${regName(src)}`, bytes: currentPC - pc };
        }
      }

      case OP_OR: {
        const { dest, src } = decodeRegs();
        if (mode === MODE_IMMEDIATE) {
          const imm = readByte();
          return { mnemonic: `OR ${regName(dest)}, #${imm}`, bytes: currentPC - pc };
        } else {
          return { mnemonic: `OR ${regName(dest)}, ${regName(src)}`, bytes: currentPC - pc };
        }
      }

      case OP_XOR: {
        const { dest, src } = decodeRegs();
        if (mode === MODE_IMMEDIATE) {
          const imm = readByte();
          return { mnemonic: `XOR ${regName(dest)}, #${imm}`, bytes: currentPC - pc };
        } else {
          return { mnemonic: `XOR ${regName(dest)}, ${regName(src)}`, bytes: currentPC - pc };
        }
      }

      case OP_SHL: {
        const { dest } = decodeRegs();
        if (mode === MODE_IMMEDIATE) {
          const imm = readByte();
          return { mnemonic: `SHL ${regName(dest)}, #${imm}`, bytes: currentPC - pc };
        } else {
          return { mnemonic: `SHL ${regName(dest)}`, bytes: currentPC - pc };
        }
      }

      case OP_SHR: {
        const { dest } = decodeRegs();
        if (mode === MODE_IMMEDIATE) {
          const imm = readByte();
          return { mnemonic: `SHR ${regName(dest)}, #${imm}`, bytes: currentPC - pc };
        } else {
          return { mnemonic: `SHR ${regName(dest)}`, bytes: currentPC - pc };
        }
      }

      case OP_CMP: {
        const { dest, src } = decodeRegs();
        if (mode === MODE_IMMEDIATE) {
          const imm = readByte();
          return { mnemonic: `CMP ${regName(dest)}, #${imm}`, bytes: currentPC - pc };
        } else {
          return { mnemonic: `CMP ${regName(dest)}, ${regName(src)}`, bytes: currentPC - pc };
        }
      }

      case OP_JMP: {
        const { src } = decodeRegs();
        switch (mode) {
          case MODE_ABSOLUTE: {
            const low = readByte();
            const high = readByte();
            const addr = (high << 8) | low;
            return { mnemonic: `JMP $${addr.toString(16).padStart(4, '0')}`, bytes: currentPC - pc };
          }
          case MODE_ZERO_PAGE: {
            const zp = readByte();
            return { mnemonic: `JMP [$${zp.toString(16).padStart(2, '0')}]`, bytes: currentPC - pc };
          }
          case MODE_REGISTER_PAIR:
            return { mnemonic: `JMP [${regName(src)}:${regName((src + 1) & 0x7)}]`, bytes: currentPC - pc };
          default:
            return { mnemonic: `JMP (unknown mode ${mode})`, bytes: currentPC - pc };
        }
      }

      case OP_BR: {
        const { dest } = decodeRegs();
        const offset = readByte();
        const signedOffset = offset < 128 ? offset : offset - 256;
        const target = (pc + (currentPC - pc) + signedOffset) & 0xFFFF;
        const branchName = BRANCH_NAMES[dest] || `BR(${dest})`;
        return { mnemonic: `${branchName} $${target.toString(16).padStart(4, '0')}`, bytes: currentPC - pc };
      }

      case OP_CALL: {
        const { src } = decodeRegs();
        switch (mode) {
          case MODE_ABSOLUTE: {
            const low = readByte();
            const high = readByte();
            const addr = (high << 8) | low;
            return { mnemonic: `CALL $${addr.toString(16).padStart(4, '0')}`, bytes: currentPC - pc };
          }
          case MODE_REGISTER_PAIR:
            return { mnemonic: `CALL [${regName(src)}:${regName((src + 1) & 0x7)}]`, bytes: currentPC - pc };
          default:
            return { mnemonic: `CALL (unknown mode ${mode})`, bytes: currentPC - pc };
        }
      }

      case OP_EXT: {
        const subOpcode = readByte();
        switch (subOpcode) {
          case EXT_RET:
            return { mnemonic: 'RET', bytes: currentPC - pc };
          case EXT_RTI:
            return { mnemonic: 'RTI', bytes: currentPC - pc };
          case EXT_PUSH: {
            const byte3 = readByte();
            const reg = (byte3 >> 5) & 0x7;
            return { mnemonic: `PUSH ${regName(reg)}`, bytes: currentPC - pc };
          }
          case EXT_POP: {
            const byte3 = readByte();
            const reg = (byte3 >> 5) & 0x7;
            return { mnemonic: `POP ${regName(reg)}`, bytes: currentPC - pc };
          }
          case EXT_INC: {
            const byte3 = readByte();
            const reg = (byte3 >> 5) & 0x7;
            return { mnemonic: `INC ${regName(reg)}`, bytes: currentPC - pc };
          }
          case EXT_DEC: {
            const byte3 = readByte();
            const reg = (byte3 >> 5) & 0x7;
            return { mnemonic: `DEC ${regName(reg)}`, bytes: currentPC - pc };
          }
          case EXT_ROL: {
            const byte3 = readByte();
            const reg = (byte3 >> 5) & 0x7;
            return { mnemonic: `ROL ${regName(reg)}`, bytes: currentPC - pc };
          }
          case EXT_ROR: {
            const byte3 = readByte();
            const reg = (byte3 >> 5) & 0x7;
            return { mnemonic: `ROR ${regName(reg)}`, bytes: currentPC - pc };
          }
          case EXT_SEI:
            return { mnemonic: 'SEI', bytes: currentPC - pc };
          case EXT_CLI:
            return { mnemonic: 'CLI', bytes: currentPC - pc };
          case EXT_NOP:
            return { mnemonic: 'NOP', bytes: currentPC - pc };
          default:
            return { mnemonic: `EXT(0x${subOpcode.toString(16)})`, bytes: currentPC - pc };
        }
      }

      default:
        return { mnemonic: `UNKNOWN(0x${opcode.toString(16)})`, bytes: 1 };
    }
  } catch (error) {
    return { mnemonic: 'ERROR', bytes: 1 };
  }
}

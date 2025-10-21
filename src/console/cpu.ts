/**
 * CPU Implementation for the Virtual Console
 *
 * An 8-bit RISC-inspired CPU based on 6502 principles with:
 * - 6 general-purpose 8-bit registers (R0-R5)
 * - 16-bit address space (64KB)
 * - 16-bit stack pointer and program counter
 * - Status flags: Carry, Zero, Negative, Overflow
 */

import { MemoryBus } from './memoryBus';

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
const BR_Z = 0x0;   // Branch if zero
const BR_NZ = 0x1;  // Branch if not zero
const BR_C = 0x2;   // Branch if carry
const BR_NC = 0x3;  // Branch if not carry
const BR_N = 0x4;   // Branch if negative
const BR_NN = 0x5;  // Branch if not negative
const BR_V = 0x6;   // Branch if overflow
const BR_NV = 0x7;  // Branch if not overflow

// Status flag bit positions
const FLAG_C = 0; // Carry
const FLAG_Z = 1; // Zero
const FLAG_N = 7; // Negative
const FLAG_V = 6; // Overflow

/**
 * CPU class representing the virtual console's processor
 */
export class CPU {
  // General-purpose registers (R0-R5)
  private readonly r: Uint8Array = new Uint8Array(6);

  // Special registers
  private sp: number = 0; // Stack pointer (16-bit)
  private pc: number = 0; // Program counter (16-bit)
  private status: number = 0; // Status register (8-bit)

  // Cycle counter
  private cycles: number = 0;

  private readonly bus: MemoryBus;

  constructor(bus: MemoryBus) {
    this.bus = bus;
    this.reset();
  }

  /**
   * Reset the CPU to initial state
   */
  reset(): void {
    // Clear all registers
    this.r.fill(0);

    // Initialize special registers
    this.sp = 0x7FFF; // Stack grows downward from top of memory
    this.pc = 0x0000;
    this.status = 0;
    this.cycles = 0;
  }

  /**
   * Get the current cycle count
   */
  getCycles(): number {
    return this.cycles;
  }

  /**
   * Get a register value
   */
  getRegister(index: number): number {
    if (index < 0 || index > 5) {
      throw new Error(`Invalid register index: ${index}`);
    }
    return this.r[index];
  }

  /**
   * Set a register value
   */
  setRegister(index: number, value: number): void {
    if (index < 0 || index > 5) {
      throw new Error(`Invalid register index: ${index}`);
    }
    this.r[index] = value & 0xFF;
  }

  /**
   * Get the stack pointer
   */
  getStackPointer(): number {
    return this.sp;
  }

  /**
   * Get the program counter
   */
  getProgramCounter(): number {
    return this.pc;
  }

  /**
   * Set the program counter
   */
  setProgramCounter(address: number): void {
    this.pc = address & 0xFFFF;
  }

  /**
   * Get the status register
   */
  getStatus(): number {
    return this.status;
  }

  // Flag manipulation methods
  private setFlag(flag: number, value: boolean): void {
    if (value) {
      this.status |= (1 << flag);
    } else {
      this.status &= ~(1 << flag);
    }
  }

  private getFlag(flag: number): boolean {
    return (this.status & (1 << flag)) !== 0;
  }

  /**
   * Update Zero and Negative flags based on a value
   */
  private updateZN(value: number): void {
    this.setFlag(FLAG_Z, (value & 0xFF) === 0);
    this.setFlag(FLAG_N, (value & 0x80) !== 0);
  }

  /**
   * Execute one instruction
   * @returns Number of cycles consumed
   */
  step(): number {
    const startCycles = this.cycles;

    // Fetch instruction
    const byte1 = this.bus.read8(this.pc);
    this.pc = (this.pc + 1) & 0xFFFF;

    // Decode instruction
    const opcode = (byte1 >> 4) & 0xF;
    const mode = (byte1 >> 1) & 0x7;

    // Execute instruction
    this.executeInstruction(opcode, mode);

    return this.cycles - startCycles;
  }

  /**
   * Execute a decoded instruction
   */
  private executeInstruction(opcode: number, mode: number): void {
    switch (opcode) {
      case OP_NOP:
        this.execNOP(mode);
        break;
      case OP_LD:
        this.execLD(mode);
        break;
      case OP_ST:
        this.execST(mode);
        break;
      case OP_MOV:
        this.execMOV(mode);
        break;
      case OP_ADD:
        this.execADD(mode);
        break;
      case OP_SUB:
        this.execSUB(mode);
        break;
      case OP_AND:
        this.execAND(mode);
        break;
      case OP_OR:
        this.execOR(mode);
        break;
      case OP_XOR:
        this.execXOR(mode);
        break;
      case OP_SHL:
        this.execSHL(mode);
        break;
      case OP_SHR:
        this.execSHR(mode);
        break;
      case OP_CMP:
        this.execCMP(mode);
        break;
      case OP_JMP:
        this.execJMP(mode);
        break;
      case OP_BR:
        this.execBR(mode);
        break;
      case OP_CALL:
        this.execCALL(mode);
        break;
      case OP_EXT:
        this.execEXT(mode);
        break;
      default:
        throw new Error(`Unknown opcode: 0x${opcode.toString(16)}`);
    }
  }

  /**
   * Read the next byte from PC and increment
   */
  private fetchByte(): number {
    const value = this.bus.read8(this.pc);
    this.pc = (this.pc + 1) & 0xFFFF;
    return value;
  }

  /**
   * Decode register indices from byte 2
   */
  private decodeRegisters(): { dest: number; src: number } {
    const byte2 = this.fetchByte();
    const dest = (byte2 >> 5) & 0x7;
    const src = (byte2 >> 2) & 0x7;
    return { dest, src };
  }

  /**
   * Resolve address based on addressing mode
   */
  private resolveAddress(mode: number, srcReg: number): number {
    switch (mode) {
      case MODE_ABSOLUTE: {
        // Absolute: read 16-bit address
        const low = this.fetchByte();
        const high = this.fetchByte();
        return (high << 8) | low;
      }
      case MODE_ZERO_PAGE: {
        // Zero page: read address from zero page location
        const zpAddr = this.fetchByte();
        return this.bus.read16(zpAddr);
      }
      case MODE_ZERO_PAGE_INDEXED: {
        // Zero page indexed: read address from zero page, add index register
        const zpAddr = this.fetchByte();
        const baseAddr = this.bus.read16(zpAddr);
        return (baseAddr + this.r[srcReg]) & 0xFFFF;
      }
      case MODE_REGISTER_PAIR: {
        // Register pair: use two registers as 16-bit address
        // srcReg is high byte, srcReg+1 is low byte
        const high = this.r[srcReg];
        const low = this.r[(srcReg + 1) & 0x7];
        return (high << 8) | low;
      }
      default:
        throw new Error(`Invalid addressing mode for address resolution: ${mode}`);
    }
  }

  /**
   * Push a byte onto the stack
   */
  private push(value: number): void {
    this.bus.write8(this.sp, value & 0xFF);
    this.sp = (this.sp - 1) & 0xFFFF;
  }

  /**
   * Pop a byte from the stack
   */
  private pop(): number {
    this.sp = (this.sp + 1) & 0xFFFF;
    return this.bus.read8(this.sp);
  }

  // Instruction implementations

  private execNOP(_mode: number): void {
    this.fetchByte(); // Read byte 2
    this.cycles += 1;
  }

  private execLD(mode: number): void {
    const { dest, src } = this.decodeRegisters();

    let value: number;
    switch (mode) {
      case MODE_IMMEDIATE:
        value = this.fetchByte();
        this.cycles += 2;
        break;
      case MODE_REGISTER:
        value = this.r[src];
        this.cycles += 1;
        break;
      case MODE_ABSOLUTE: {
        const addr = this.resolveAddress(mode, src);
        value = this.bus.read8(addr);
        this.cycles += 3;
        break;
      }
      case MODE_ZERO_PAGE: {
        const addr = this.resolveAddress(mode, src);
        value = this.bus.read8(addr);
        this.cycles += 2;
        break;
      }
      case MODE_ZERO_PAGE_INDEXED: {
        const addr = this.resolveAddress(mode, src);
        value = this.bus.read8(addr);
        this.cycles += 2;
        break;
      }
      case MODE_REGISTER_PAIR: {
        const addr = this.resolveAddress(mode, src);
        value = this.bus.read8(addr);
        this.cycles += 2;
        break;
      }
      default:
        throw new Error(`Invalid mode for LD: ${mode}`);
    }

    this.r[dest] = value & 0xFF;
    this.updateZN(value);
  }

  private execST(mode: number): void {
    const { dest, src } = this.decodeRegisters();

    let addr: number;
    switch (mode) {
      case MODE_ABSOLUTE:
        addr = this.resolveAddress(mode, src);
        this.cycles += 3;
        break;
      case MODE_ZERO_PAGE:
        addr = this.resolveAddress(mode, src);
        this.cycles += 2;
        break;
      case MODE_ZERO_PAGE_INDEXED:
        addr = this.resolveAddress(mode, src);
        this.cycles += 2;
        break;
      case MODE_REGISTER_PAIR:
        addr = this.resolveAddress(mode, src);
        this.cycles += 2;
        break;
      default:
        throw new Error(`Invalid mode for ST: ${mode}`);
    }

    this.bus.write8(addr, this.r[dest]);
  }

  private execMOV(_mode: number): void {
    const { dest, src } = this.decodeRegisters();
    this.r[dest] = this.r[src];
    this.updateZN(this.r[dest]);
    this.cycles += 1;
  }

  private execADD(mode: number): void {
    const { dest, src } = this.decodeRegisters();

    let operand: number;
    if (mode === MODE_IMMEDIATE) {
      operand = this.fetchByte();
      this.cycles += 2;
    } else {
      operand = this.r[src];
      this.cycles += 1;
    }

    const result = this.r[dest] + operand;
    const carry = result > 0xFF;

    // Check for signed overflow
    const a = this.r[dest];
    const b = operand;
    const r = result & 0xFF;
    const overflow = ((a ^ r) & (b ^ r) & 0x80) !== 0;

    this.r[dest] = r;
    this.setFlag(FLAG_C, carry);
    this.setFlag(FLAG_V, overflow);
    this.updateZN(r);
  }

  private execSUB(mode: number): void {
    const { dest, src } = this.decodeRegisters();

    let operand: number;
    if (mode === MODE_IMMEDIATE) {
      operand = this.fetchByte();
      this.cycles += 2;
    } else {
      operand = this.r[src];
      this.cycles += 1;
    }

    const result = this.r[dest] - operand;
    const carry = result >= 0;

    // Check for signed overflow
    const a = this.r[dest];
    const b = operand;
    const r = result & 0xFF;
    const overflow = ((a ^ b) & (a ^ r) & 0x80) !== 0;

    this.r[dest] = r;
    this.setFlag(FLAG_C, carry);
    this.setFlag(FLAG_V, overflow);
    this.updateZN(r);
  }

  private execAND(mode: number): void {
    const { dest, src } = this.decodeRegisters();

    let operand: number;
    if (mode === MODE_IMMEDIATE) {
      operand = this.fetchByte();
      this.cycles += 2;
    } else {
      operand = this.r[src];
      this.cycles += 1;
    }

    const result = this.r[dest] & operand;
    this.r[dest] = result;
    this.updateZN(result);
  }

  private execOR(mode: number): void {
    const { dest, src } = this.decodeRegisters();

    let operand: number;
    if (mode === MODE_IMMEDIATE) {
      operand = this.fetchByte();
      this.cycles += 2;
    } else {
      operand = this.r[src];
      this.cycles += 1;
    }

    const result = this.r[dest] | operand;
    this.r[dest] = result;
    this.updateZN(result);
  }

  private execXOR(mode: number): void {
    const { dest, src } = this.decodeRegisters();

    let operand: number;
    if (mode === MODE_IMMEDIATE) {
      operand = this.fetchByte();
      this.cycles += 2;
    } else {
      operand = this.r[src];
      this.cycles += 1;
    }

    const result = this.r[dest] ^ operand;
    this.r[dest] = result;
    this.updateZN(result);
  }

  private execSHL(mode: number): void {
    const { dest } = this.decodeRegisters();

    let shiftAmount: number;
    if (mode === MODE_IMMEDIATE) {
      shiftAmount = this.fetchByte();
      this.cycles += 2;
    } else {
      shiftAmount = 1;
      this.cycles += 1;
    }

    let value = this.r[dest];
    for (let i = 0; i < shiftAmount; i++) {
      const carry = (value & 0x80) !== 0;
      value = (value << 1) & 0xFF;
      this.setFlag(FLAG_C, carry);
    }

    this.r[dest] = value;
    this.updateZN(value);
  }

  private execSHR(mode: number): void {
    const { dest } = this.decodeRegisters();

    let shiftAmount: number;
    if (mode === MODE_IMMEDIATE) {
      shiftAmount = this.fetchByte();
      this.cycles += 2;
    } else {
      shiftAmount = 1;
      this.cycles += 1;
    }

    let value = this.r[dest];
    for (let i = 0; i < shiftAmount; i++) {
      const carry = (value & 0x01) !== 0;
      value = value >> 1;
      this.setFlag(FLAG_C, carry);
    }

    this.r[dest] = value;
    this.updateZN(value);
  }

  private execCMP(mode: number): void {
    const { dest, src } = this.decodeRegisters();

    let operand: number;
    if (mode === MODE_IMMEDIATE) {
      operand = this.fetchByte();
      this.cycles += 2;
    } else {
      operand = this.r[src];
      this.cycles += 1;
    }

    const result = this.r[dest] - operand;
    this.setFlag(FLAG_C, result >= 0);
    this.updateZN(result & 0xFF);
  }

  private execJMP(mode: number): void {
    const { src } = this.decodeRegisters();

    let addr: number;
    switch (mode) {
      case MODE_ABSOLUTE:
        addr = this.resolveAddress(mode, src);
        break;
      case MODE_ZERO_PAGE:
        addr = this.resolveAddress(mode, src);
        break;
      case MODE_REGISTER_PAIR:
        addr = this.resolveAddress(mode, src);
        break;
      default:
        throw new Error(`Invalid mode for JMP: ${mode}`);
    }

    this.pc = addr;
    this.cycles += 2;
  }

  private execBR(_mode: number): void {
    const { dest } = this.decodeRegisters();
    const condition = dest; // The dest field encodes the branch condition

    const offset = this.fetchByte();
    // Convert unsigned byte to signed offset
    const signedOffset = offset < 128 ? offset : offset - 256;

    let shouldBranch = false;
    switch (condition) {
      case BR_Z:
        shouldBranch = this.getFlag(FLAG_Z);
        break;
      case BR_NZ:
        shouldBranch = !this.getFlag(FLAG_Z);
        break;
      case BR_C:
        shouldBranch = this.getFlag(FLAG_C);
        break;
      case BR_NC:
        shouldBranch = !this.getFlag(FLAG_C);
        break;
      case BR_N:
        shouldBranch = this.getFlag(FLAG_N);
        break;
      case BR_NN:
        shouldBranch = !this.getFlag(FLAG_N);
        break;
      case BR_V:
        shouldBranch = this.getFlag(FLAG_V);
        break;
      case BR_NV:
        shouldBranch = !this.getFlag(FLAG_V);
        break;
      default:
        throw new Error(`Invalid branch condition: ${condition}`);
    }

    if (shouldBranch) {
      this.pc = (this.pc + signedOffset) & 0xFFFF;
      this.cycles += 2;
    } else {
      this.cycles += 1;
    }
  }

  private execCALL(mode: number): void {
    const { src } = this.decodeRegisters();

    let addr: number;
    switch (mode) {
      case MODE_ABSOLUTE:
        addr = this.resolveAddress(mode, src);
        break;
      case MODE_REGISTER_PAIR:
        addr = this.resolveAddress(mode, src);
        break;
      default:
        throw new Error(`Invalid mode for CALL: ${mode}`);
    }

    // Push return address (current PC)
    const high = (this.pc >> 8) & 0xFF;
    const low = this.pc & 0xFF;
    this.push(high);
    this.push(low);

    this.pc = addr;
    this.cycles += 4;
  }

  private execEXT(_mode: number): void {
    const subOpcode = this.fetchByte();

    switch (subOpcode) {
      case EXT_RET:
        this.execRET();
        break;
      case EXT_RTI:
        this.execRTI();
        break;
      case EXT_PUSH:
        this.execPUSH();
        break;
      case EXT_POP:
        this.execPOP();
        break;
      case EXT_INC:
        this.execINC();
        break;
      case EXT_DEC:
        this.execDEC();
        break;
      case EXT_ROL:
        this.execROL();
        break;
      case EXT_ROR:
        this.execROR();
        break;
      case EXT_SEI:
        this.execSEI();
        break;
      case EXT_CLI:
        this.execCLI();
        break;
      case EXT_NOP:
        this.cycles += 1;
        break;
      default:
        throw new Error(`Unknown extended opcode: 0x${subOpcode.toString(16)}`);
    }
  }

  private execRET(): void {
    const low = this.pop();
    const high = this.pop();
    this.pc = (high << 8) | low;
    this.cycles += 3;
  }

  private execRTI(): void {
    // Pop status register
    this.status = this.pop();

    // Pop return address
    const low = this.pop();
    const high = this.pop();
    this.pc = (high << 8) | low;

    this.cycles += 3;
  }

  private execPUSH(): void {
    const byte3 = this.fetchByte();
    const reg = (byte3 >> 5) & 0x7;
    this.push(this.r[reg]);
    this.cycles += 2;
  }

  private execPOP(): void {
    const byte3 = this.fetchByte();
    const reg = (byte3 >> 5) & 0x7;
    const value = this.pop();
    this.r[reg] = value;
    this.updateZN(value);
    this.cycles += 2;
  }

  private execINC(): void {
    const byte3 = this.fetchByte();
    const reg = (byte3 >> 5) & 0x7;
    this.r[reg] = (this.r[reg] + 1) & 0xFF;
    this.updateZN(this.r[reg]);
    this.cycles += 2;
  }

  private execDEC(): void {
    const byte3 = this.fetchByte();
    const reg = (byte3 >> 5) & 0x7;
    this.r[reg] = (this.r[reg] - 1) & 0xFF;
    this.updateZN(this.r[reg]);
    this.cycles += 2;
  }

  private execROL(): void {
    const byte3 = this.fetchByte();
    const reg = (byte3 >> 5) & 0x7;
    const oldCarry = this.getFlag(FLAG_C) ? 1 : 0;
    const newCarry = (this.r[reg] & 0x80) !== 0;
    this.r[reg] = ((this.r[reg] << 1) | oldCarry) & 0xFF;
    this.setFlag(FLAG_C, newCarry);
    this.updateZN(this.r[reg]);
    this.cycles += 2;
  }

  private execROR(): void {
    const byte3 = this.fetchByte();
    const reg = (byte3 >> 5) & 0x7;
    const oldCarry = this.getFlag(FLAG_C) ? 0x80 : 0;
    const newCarry = (this.r[reg] & 0x01) !== 0;
    this.r[reg] = (this.r[reg] >> 1) | oldCarry;
    this.setFlag(FLAG_C, newCarry);
    this.updateZN(this.r[reg]);
    this.cycles += 2;
  }

  private execSEI(): void {
    // Set interrupt enable flag - not yet implemented in status register
    // This is a placeholder for future interrupt support
    this.cycles += 1;
  }

  private execCLI(): void {
    // Clear interrupt enable flag - not yet implemented in status register
    // This is a placeholder for future interrupt support
    this.cycles += 1;
  }
}

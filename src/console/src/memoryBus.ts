/**
 * Memory Bus for the Virtual Console
 *
 * Provides banked memory access with 64KB visible address space.
 * Lower 32KB (0x0000-0x7FFF) is always visible.
 * Upper 32KB (0x8000-0xFFFF) is banked via BANK_REG (0x0100).
 *
 * The bus supports both 8-bit and 16-bit read/write operations.
 */

import {
  BankedMemory,
  LOWER_MEMORY_SIZE,
  BANK_SIZE,
  createSharedMemory,
} from './bankedMemory';

const UPPER_MEMORY_START = 0x8000;
const BANK_REG = 0x0100;
const INT_STATUS = 0x0114;

// Sprite registers
const SPRITE_OVERFLOW = 0x0107;
const COLLISION_FLAGS = 0x0108;
const COLLISION_COUNT = 0x0109;

/**
 * MemoryBus provides the CPU's view of memory with bank switching support
 */
export class MemoryBus {
  private readonly lowerMemory: Uint8Array;
  private readonly bankedMemory: BankedMemory;
  private currentBank: number = 0;

  /**
   * Create a MemoryBus with banked memory support
   *
   * @param bankedMemory - BankedMemory instance managing the SharedArrayBuffer.
   *                       If not provided, creates one with default size.
   */
  constructor(bankedMemory?: BankedMemory) {
    if (bankedMemory) {
      this.bankedMemory = bankedMemory;
    } else {
      // Create default shared memory with space for 16 cartridge banks
      const sharedBuffer = createSharedMemory(16);
      this.bankedMemory = new BankedMemory(sharedBuffer);
    }
    this.lowerMemory = this.bankedMemory.getLowerMemoryView();
  }

  /**
   * Get the BankedMemory instance for cartridge mounting and direct access
   */
  getBankedMemory(): BankedMemory {
    return this.bankedMemory;
  }

  /**
   * Get the underlying SharedArrayBuffer for cross-thread access
   */
  getSharedBuffer(): SharedArrayBuffer {
    return this.bankedMemory.getSharedBuffer();
  }

  /**
   * Get the current bank number
   */
  getCurrentBank(): number {
    return this.currentBank;
  }

  /**
   * Read an 8-bit value from memory
   *
   * @param address - 16-bit memory address (0x0000 - 0xFFFF)
   * @returns The 8-bit value at the specified address
   */
  read8(address: number): number {
    if (address < 0 || address > 0xffff) {
      throw new Error(`Memory read out of bounds: 0x${address.toString(16)}`);
    }

    if (address < UPPER_MEMORY_START) {
      // Lower 32KB - always visible
      return this.lowerMemory[address];
    } else {
      // Upper 32KB - banked
      const offset = address - UPPER_MEMORY_START;
      return this.bankedMemory.readBank(this.currentBank, offset);
    }
  }

  /**
   * Write an 8-bit value to memory
   *
   * @param address - 16-bit memory address (0x0000 - 0xFFFF)
   * @param value - 8-bit value to write
   */
  write8(address: number, value: number): void {
    if (address < 0 || address > 0xffff) {
      throw new Error(`Memory write out of bounds: 0x${address.toString(16)}`);
    }
    if (value < 0 || value > 0xff) {
      throw new Error(`Invalid 8-bit value: 0x${value.toString(16)}`);
    }

    if (address < UPPER_MEMORY_START) {
      // Lower 32KB - always visible

      // Special handling for BANK_REG (0x0100)
      if (address === BANK_REG) {
        this.currentBank = value;
        this.lowerMemory[address] = value;
        return;
      }

      // Special handling for INT_STATUS (0x0114) - write-1-to-clear
      if (address === INT_STATUS) {
        const current = this.lowerMemory[address];
        this.lowerMemory[address] = current & ~value;
        return;
      }

      // Special handling for COLLISION_FLAGS (0x0108) - write-1-to-clear
      if (address === COLLISION_FLAGS) {
        const current = this.lowerMemory[address];
        this.lowerMemory[address] = current & ~value;
        return;
      }

      // Read-only registers - ignore writes
      if (address === SPRITE_OVERFLOW || address === COLLISION_COUNT) {
        return;
      }

      this.lowerMemory[address] = value;
    } else {
      // Upper 32KB - banked
      const offset = address - UPPER_MEMORY_START;
      this.bankedMemory.writeBank(this.currentBank, offset, value);
    }
  }

  /**
   * Read a 16-bit value from memory (big-endian)
   *
   * @param address - 16-bit memory address (0x0000 - 0xFFFE)
   * @returns The 16-bit value at the specified address
   */
  read16(address: number): number {
    const high = this.read8(address);
    const low = this.read8(address + 1);
    return (high << 8) | low;
  }

  /**
   * Write a 16-bit value to memory (big-endian)
   *
   * @param address - 16-bit memory address (0x0000 - 0xFFFE)
   * @param value - 16-bit value to write
   */
  write16(address: number, value: number): void {
    if (value < 0 || value > 0xffff) {
      throw new Error(`Invalid 16-bit value: 0x${value.toString(16)}`);
    }
    const high = (value >> 8) & 0xff;
    const low = value & 0xff;
    this.write8(address, high);
    this.write8(address + 1, low);
  }

  /**
   * Read from a specific bank (bypasses current bank selection)
   * Used by sprite/tile rendering to access graphics in any bank.
   *
   * @param bank - Bank number (0-255)
   * @param offset - Offset within bank (0x0000-0x7FFF)
   * @returns Byte value (0-255)
   */
  readFromBank(bank: number, offset: number): number {
    return this.bankedMemory.readBank(bank, offset);
  }

  /**
   * Reset memory (lower memory and RAM banks, preserves cartridge)
   */
  reset(): void {
    this.lowerMemory.fill(0);
    this.bankedMemory.resetRam();
    this.currentBank = 0;
  }

  /**
   * Full reset including unmounting cartridge
   */
  fullReset(): void {
    this.reset();
    this.bankedMemory.unmountCartridge();
  }

  /**
   * Get the lower memory size (for compatibility)
   */
  get size(): number {
    return LOWER_MEMORY_SIZE + BANK_SIZE; // 64KB visible address space
  }
}

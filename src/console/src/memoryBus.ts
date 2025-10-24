/**
 * Memory Bus for the Virtual Console
 *
 * Provides a simple interface for memory access with 64KB addressable space.
 * The bus supports both 8-bit and 16-bit read/write operations.
 */

const MEMORY_SIZE = 65536; // 64KB address space

/**
 * MemoryBus provides access to the console's memory
 */
export class MemoryBus {
  private readonly memory: Uint8Array;

  constructor() {
    this.memory = new Uint8Array(MEMORY_SIZE);
  }

  /**
   * Read an 8-bit value from memory
   *
   * @param address - 16-bit memory address (0x0000 - 0xFFFF)
   * @returns The 8-bit value at the specified address
   */
  read8(address: number): number {
    if (address < 0 || address >= MEMORY_SIZE) {
      throw new Error(`Memory read out of bounds: 0x${address.toString(16)}`);
    }
    return this.memory[address];
  }

  /**
   * Write an 8-bit value to memory
   *
   * @param address - 16-bit memory address (0x0000 - 0xFFFF)
   * @param value - 8-bit value to write
   */
  write8(address: number, value: number): void {
    if (address < 0 || address >= MEMORY_SIZE) {
      throw new Error(`Memory write out of bounds: 0x${address.toString(16)}`);
    }
    if (value < 0 || value > 0xFF) {
      throw new Error(`Invalid 8-bit value: 0x${value.toString(16)}`);
    }
    this.memory[address] = value;
  }

  /**
   * Read a 16-bit value from memory (little-endian)
   *
   * @param address - 16-bit memory address (0x0000 - 0xFFFE)
   * @returns The 16-bit value at the specified address
   */
  read16(address: number): number {
    const low = this.read8(address);
    const high = this.read8(address + 1);
    return (high << 8) | low;
  }

  /**
   * Write a 16-bit value to memory (little-endian)
   *
   * @param address - 16-bit memory address (0x0000 - 0xFFFE)
   * @param value - 16-bit value to write
   */
  write16(address: number, value: number): void {
    if (value < 0 || value > 0xFFFF) {
      throw new Error(`Invalid 16-bit value: 0x${value.toString(16)}`);
    }
    const low = value & 0xFF;
    const high = (value >> 8) & 0xFF;
    this.write8(address, low);
    this.write8(address + 1, high);
  }

  /**
   * Reset all memory to zero
   */
  reset(): void {
    this.memory.fill(0);
  }

  /**
   * Get the total memory size
   */
  get size(): number {
    return MEMORY_SIZE;
  }
}

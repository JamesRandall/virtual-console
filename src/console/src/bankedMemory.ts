/**
 * BankedMemory manages RAM banks and cartridge ROM
 *
 * All memory is backed by a SharedArrayBuffer for cross-thread access.
 *
 * Memory Layout in SharedArrayBuffer:
 * - Offset 0x00000: Lower memory (32KB) - managed by MemoryBus
 * - Offset 0x08000: RAM Bank 0 (32KB)
 * - Offset 0x10000: RAM Bank 1 (32KB)
 * - Offset 0x18000: RAM Bank 2 (32KB)
 * - Offset 0x20000: RAM Bank 3 (32KB)
 * - Offset 0x28000: Cartridge ROM (variable, up to 7.5MB)
 *
 * Bank mapping:
 * - Banks 0-3: RAM (128KB, always present)
 * - Banks 4-15: Reserved (return 0xFF on read)
 * - Banks 16-255: Cartridge ROM (mapped from mounted ROM file)
 */

// Memory architecture constants
export const BANK_SIZE = 0x8000; // 32KB per bank
export const LOWER_MEMORY_SIZE = 0x8000; // 32KB
export const RAM_BANK_COUNT = 4; // Banks 0-3
export const CARTRIDGE_BANK_OFFSET = 16; // Cartridge starts at bank 16
export const MAX_BANKS = 256; // Total addressable banks
export const MAX_CARTRIDGE_BANKS = MAX_BANKS - CARTRIDGE_BANK_OFFSET; // 240

// Offsets within SharedArrayBuffer
export const LOWER_MEMORY_OFFSET = 0x00000;
export const RAM_BANKS_OFFSET = 0x08000;
export const CARTRIDGE_OFFSET = 0x28000; // 0x8000 + 4 * 0x8000

// Buffer sizes
export const MIN_SHARED_SIZE = LOWER_MEMORY_SIZE + RAM_BANK_COUNT * BANK_SIZE; // 160KB
export const MAX_SHARED_SIZE = MIN_SHARED_SIZE + MAX_CARTRIDGE_BANKS * BANK_SIZE; // ~7.8MB

/**
 * BankedMemory provides access to all banked memory regions
 */
export class BankedMemory {
  private readonly sharedBuffer: SharedArrayBuffer;
  private readonly memoryView: Uint8Array;
  private cartridgeBankCount: number = 0;

  /**
   * @param sharedBuffer - SharedArrayBuffer for all memory.
   *                       Must be at least MIN_SHARED_SIZE bytes.
   */
  constructor(sharedBuffer: SharedArrayBuffer) {
    if (sharedBuffer.byteLength < MIN_SHARED_SIZE) {
      throw new Error(
        `SharedArrayBuffer too small: ${sharedBuffer.byteLength} bytes. ` +
          `Minimum is ${MIN_SHARED_SIZE} bytes.`
      );
    }
    this.sharedBuffer = sharedBuffer;
    this.memoryView = new Uint8Array(sharedBuffer);
  }

  /**
   * Get the underlying SharedArrayBuffer
   */
  getSharedBuffer(): SharedArrayBuffer {
    return this.sharedBuffer;
  }

  /**
   * Get a Uint8Array view of lower memory (for MemoryBus)
   */
  getLowerMemoryView(): Uint8Array {
    return new Uint8Array(this.sharedBuffer, LOWER_MEMORY_OFFSET, LOWER_MEMORY_SIZE);
  }

  /**
   * Mount a cartridge ROM by copying it into the shared buffer
   *
   * @param rom - ROM data (must be multiple of 32KB)
   * @throws Error if ROM size is invalid or buffer too small
   */
  mountCartridge(rom: Uint8Array): void {
    if (rom.length === 0) {
      this.cartridgeBankCount = 0;
      return;
    }

    if (rom.length % BANK_SIZE !== 0) {
      throw new Error(
        `Invalid ROM size: ${rom.length} bytes. Must be multiple of ${BANK_SIZE} (32KB).`
      );
    }

    const bankCount = rom.length / BANK_SIZE;
    if (bankCount > MAX_CARTRIDGE_BANKS) {
      throw new Error(
        `ROM too large: ${bankCount} banks. Maximum is ${MAX_CARTRIDGE_BANKS} banks.`
      );
    }

    // Check if shared buffer is large enough
    const requiredSize = CARTRIDGE_OFFSET + rom.length;
    if (this.sharedBuffer.byteLength < requiredSize) {
      throw new Error(
        `SharedArrayBuffer too small for cartridge. Need ${requiredSize} bytes, ` +
          `have ${this.sharedBuffer.byteLength} bytes.`
      );
    }

    // Copy ROM into shared buffer
    this.memoryView.set(rom, CARTRIDGE_OFFSET);
    this.cartridgeBankCount = bankCount;
  }

  /**
   * Unmount the current cartridge
   */
  unmountCartridge(): void {
    this.cartridgeBankCount = 0;
  }

  /**
   * Check if a cartridge is mounted
   */
  isCartridgeMounted(): boolean {
    return this.cartridgeBankCount > 0;
  }

  /**
   * Get the number of banks in the mounted cartridge
   */
  getCartridgeBankCount(): number {
    return this.cartridgeBankCount;
  }

  /**
   * Read a byte from a specific bank
   *
   * @param bank - Bank number (0-255)
   * @param offset - Offset within bank (0x0000-0x7FFF)
   * @returns Byte value (0-255)
   */
  readBank(bank: number, offset: number): number {
    if (offset < 0 || offset >= BANK_SIZE) {
      throw new Error(`Bank offset out of range: 0x${offset.toString(16)}`);
    }

    if (bank < RAM_BANK_COUNT) {
      // RAM banks 0-3
      const bufferOffset = RAM_BANKS_OFFSET + bank * BANK_SIZE + offset;
      return this.memoryView[bufferOffset];
    } else if (bank < CARTRIDGE_BANK_OFFSET) {
      // Unpopulated RAM banks 4-15
      return 0xff;
    } else {
      // Cartridge ROM banks 16-255
      const cartridgeBank = bank - CARTRIDGE_BANK_OFFSET;
      if (cartridgeBank < this.cartridgeBankCount) {
        const bufferOffset = CARTRIDGE_OFFSET + cartridgeBank * BANK_SIZE + offset;
        return this.memoryView[bufferOffset];
      }
      // No cartridge or bank out of range
      return 0xff;
    }
  }

  /**
   * Write a byte to a specific bank
   *
   * @param bank - Bank number (0-255)
   * @param offset - Offset within bank (0x0000-0x7FFF)
   * @param value - Byte value to write (0-255)
   */
  writeBank(bank: number, offset: number, value: number): void {
    if (offset < 0 || offset >= BANK_SIZE) {
      throw new Error(`Bank offset out of range: 0x${offset.toString(16)}`);
    }

    if (bank < RAM_BANK_COUNT) {
      // RAM banks 0-3 are writable
      const bufferOffset = RAM_BANKS_OFFSET + bank * BANK_SIZE + offset;
      this.memoryView[bufferOffset] = value & 0xff;
    }
    // Cartridge ROM banks are read-only (writes ignored)
  }

  /**
   * Reset RAM banks to zero (does not affect cartridge ROM)
   */
  resetRam(): void {
    // Zero out RAM banks
    for (let bank = 0; bank < RAM_BANK_COUNT; bank++) {
      const start = RAM_BANKS_OFFSET + bank * BANK_SIZE;
      this.memoryView.fill(0, start, start + BANK_SIZE);
    }
  }

  /**
   * Get direct Uint8Array view of a RAM bank
   *
   * @param bank - RAM bank number (0-3)
   * @returns Uint8Array view into the shared buffer
   */
  getRamBankView(bank: number): Uint8Array {
    if (bank < 0 || bank >= RAM_BANK_COUNT) {
      throw new Error(`Invalid RAM bank: ${bank}`);
    }
    const offset = RAM_BANKS_OFFSET + bank * BANK_SIZE;
    return new Uint8Array(this.sharedBuffer, offset, BANK_SIZE);
  }

  /**
   * Get direct Uint8Array view of a cartridge bank
   *
   * @param bank - Absolute bank number (16-255)
   * @returns Uint8Array view or null if bank not available
   */
  getCartridgeBankView(bank: number): Uint8Array | null {
    const cartridgeBank = bank - CARTRIDGE_BANK_OFFSET;
    if (cartridgeBank < 0 || cartridgeBank >= this.cartridgeBankCount) {
      return null;
    }
    const offset = CARTRIDGE_OFFSET + cartridgeBank * BANK_SIZE;
    return new Uint8Array(this.sharedBuffer, offset, BANK_SIZE);
  }

  /**
   * Get the buffer offset for a given bank (for direct access)
   *
   * @param bank - Bank number (0-255)
   * @returns Offset in SharedArrayBuffer, or -1 for unpopulated banks
   */
  getBankOffset(bank: number): number {
    if (bank < RAM_BANK_COUNT) {
      return RAM_BANKS_OFFSET + bank * BANK_SIZE;
    } else if (bank < CARTRIDGE_BANK_OFFSET) {
      return -1; // Unpopulated
    } else {
      const cartridgeBank = bank - CARTRIDGE_BANK_OFFSET;
      if (cartridgeBank < this.cartridgeBankCount) {
        return CARTRIDGE_OFFSET + cartridgeBank * BANK_SIZE;
      }
      return -1; // Beyond cartridge
    }
  }
}

/**
 * Create a SharedArrayBuffer sized for the given number of cartridge banks
 *
 * @param maxCartridgeBanks - Maximum number of cartridge banks to support (default 16)
 * @returns SharedArrayBuffer sized appropriately
 */
export function createSharedMemory(maxCartridgeBanks: number = 16): SharedArrayBuffer {
  const size = MIN_SHARED_SIZE + maxCartridgeBanks * BANK_SIZE;
  return new SharedArrayBuffer(size);
}

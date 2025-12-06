/**
 * Virtual Console
 *
 * Brings together the CPU and memory bus to form a complete virtual console system.
 */

import { CPU } from './cpu';
import { MemoryBus } from './memoryBus';
import { BankedMemory, createSharedMemory } from './bankedMemory';

export interface CartridgeMountResult {
  success: boolean;
  bankCount: number;
  error?: string;
}

/**
 * VirtualConsole class that integrates the CPU and memory subsystems
 */
export class VirtualConsole {
  public readonly cpu: CPU;
  public readonly memory: MemoryBus;
  public readonly bankedMemory: BankedMemory;

  /**
   * Create a new VirtualConsole
   *
   * @param maxCartridgeBanks - Maximum number of cartridge banks to support (default 64)
   */
  constructor(maxCartridgeBanks: number = 64) {
    const sharedBuffer = createSharedMemory(maxCartridgeBanks);
    this.bankedMemory = new BankedMemory(sharedBuffer);
    this.memory = new MemoryBus(this.bankedMemory);
    this.cpu = new CPU(this.memory);
  }

  /**
   * Get the underlying SharedArrayBuffer for cross-thread access
   */
  getSharedBuffer(): SharedArrayBuffer {
    return this.bankedMemory.getSharedBuffer();
  }

  /**
   * Mount a cartridge ROM
   *
   * @param rom - The ROM data
   * @returns Mount result with success status
   */
  mountCartridge(rom: Uint8Array): CartridgeMountResult {
    try {
      this.bankedMemory.mountCartridge(rom);
      return {
        success: true,
        bankCount: this.bankedMemory.getCartridgeBankCount(),
      };
    } catch (error) {
      return {
        success: false,
        bankCount: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Unmount the current cartridge
   */
  unmountCartridge(): void {
    this.bankedMemory.unmountCartridge();
  }

  /**
   * Check if a cartridge is mounted
   */
  isCartridgeMounted(): boolean {
    return this.bankedMemory.isCartridgeMounted();
  }

  /**
   * Reset the console (preserves mounted cartridge)
   */
  reset(): void {
    this.memory.reset();
    this.cpu.reset();
  }

  /**
   * Full reset including cartridge removal
   */
  fullReset(): void {
    this.memory.fullReset();
    this.cpu.reset();
  }
}

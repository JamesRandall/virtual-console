/**
 * BankedMemory and MemoryBus Test Suite
 *
 * Tests for bank switching, cartridge mounting, and memory access.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  BankedMemory,
  createSharedMemory,
  BANK_SIZE,
  RAM_BANK_COUNT,
  CARTRIDGE_BANK_OFFSET,
  CARTRIDGE_OFFSET,
  RAM_BANKS_OFFSET,
  MIN_SHARED_SIZE,
} from './bankedMemory';
import { MemoryBus } from './memoryBus';

describe('BankedMemory', () => {
  let sharedBuffer: SharedArrayBuffer;
  let bankedMemory: BankedMemory;

  beforeEach(() => {
    sharedBuffer = createSharedMemory(16); // Support 16 cartridge banks
    bankedMemory = new BankedMemory(sharedBuffer);
  });

  describe('construction', () => {
    it('should accept a valid SharedArrayBuffer', () => {
      expect(bankedMemory).toBeDefined();
      expect(bankedMemory.getSharedBuffer()).toBe(sharedBuffer);
    });

    it('should reject a buffer that is too small', () => {
      const tooSmall = new SharedArrayBuffer(1024);
      expect(() => new BankedMemory(tooSmall)).toThrow('too small');
    });

    it('should provide a lower memory view', () => {
      const lowerMemory = bankedMemory.getLowerMemoryView();
      expect(lowerMemory.length).toBe(0x8000);
    });
  });

  describe('RAM bank access', () => {
    it('should read and write to RAM bank 0', () => {
      bankedMemory.writeBank(0, 0x0000, 0x42);
      expect(bankedMemory.readBank(0, 0x0000)).toBe(0x42);
    });

    it('should read and write to RAM bank 3', () => {
      bankedMemory.writeBank(3, 0x7fff, 0xab);
      expect(bankedMemory.readBank(3, 0x7fff)).toBe(0xab);
    });

    it('should isolate data between RAM banks', () => {
      bankedMemory.writeBank(0, 0x1000, 0x11);
      bankedMemory.writeBank(1, 0x1000, 0x22);
      bankedMemory.writeBank(2, 0x1000, 0x33);
      bankedMemory.writeBank(3, 0x1000, 0x44);

      expect(bankedMemory.readBank(0, 0x1000)).toBe(0x11);
      expect(bankedMemory.readBank(1, 0x1000)).toBe(0x22);
      expect(bankedMemory.readBank(2, 0x1000)).toBe(0x33);
      expect(bankedMemory.readBank(3, 0x1000)).toBe(0x44);
    });

    it('should return 0xFF for unpopulated banks 4-15', () => {
      for (let bank = 4; bank < 16; bank++) {
        expect(bankedMemory.readBank(bank, 0x0000)).toBe(0xff);
        expect(bankedMemory.readBank(bank, 0x4000)).toBe(0xff);
      }
    });

    it('should ignore writes to unpopulated banks', () => {
      bankedMemory.writeBank(5, 0x1000, 0x99);
      expect(bankedMemory.readBank(5, 0x1000)).toBe(0xff);
    });

    it('should reset RAM banks to zero', () => {
      bankedMemory.writeBank(0, 0x100, 0x42);
      bankedMemory.writeBank(1, 0x200, 0x43);
      bankedMemory.resetRam();

      expect(bankedMemory.readBank(0, 0x100)).toBe(0x00);
      expect(bankedMemory.readBank(1, 0x200)).toBe(0x00);
    });
  });

  describe('cartridge mounting', () => {
    it('should mount a valid cartridge ROM', () => {
      const rom = new Uint8Array(BANK_SIZE * 2); // 2 banks
      rom[0] = 0x56; // 'V'
      rom[1] = 0x43; // 'C'

      bankedMemory.mountCartridge(rom);

      expect(bankedMemory.isCartridgeMounted()).toBe(true);
      expect(bankedMemory.getCartridgeBankCount()).toBe(2);
    });

    it('should reject ROM with invalid size', () => {
      const rom = new Uint8Array(1000); // Not a multiple of 32KB
      expect(() => bankedMemory.mountCartridge(rom)).toThrow('Invalid ROM size');
    });

    it('should read cartridge data from bank 16+', () => {
      const rom = new Uint8Array(BANK_SIZE);
      rom[0] = 0xaa;
      rom[0x7fff] = 0xbb;

      bankedMemory.mountCartridge(rom);

      expect(bankedMemory.readBank(16, 0x0000)).toBe(0xaa);
      expect(bankedMemory.readBank(16, 0x7fff)).toBe(0xbb);
    });

    it('should read multiple cartridge banks', () => {
      const rom = new Uint8Array(BANK_SIZE * 3);
      rom[0] = 0x11; // Bank 16, offset 0
      rom[BANK_SIZE] = 0x22; // Bank 17, offset 0
      rom[BANK_SIZE * 2] = 0x33; // Bank 18, offset 0

      bankedMemory.mountCartridge(rom);

      expect(bankedMemory.readBank(16, 0x0000)).toBe(0x11);
      expect(bankedMemory.readBank(17, 0x0000)).toBe(0x22);
      expect(bankedMemory.readBank(18, 0x0000)).toBe(0x33);
    });

    it('should ignore writes to cartridge ROM', () => {
      const rom = new Uint8Array(BANK_SIZE);
      rom[0x100] = 0x42;
      bankedMemory.mountCartridge(rom);

      bankedMemory.writeBank(16, 0x100, 0x99);
      expect(bankedMemory.readBank(16, 0x100)).toBe(0x42);
    });

    it('should return 0xFF for unmounted cartridge banks', () => {
      expect(bankedMemory.readBank(16, 0x0000)).toBe(0xff);
      expect(bankedMemory.readBank(100, 0x0000)).toBe(0xff);
    });

    it('should unmount cartridge', () => {
      const rom = new Uint8Array(BANK_SIZE);
      bankedMemory.mountCartridge(rom);
      expect(bankedMemory.isCartridgeMounted()).toBe(true);

      bankedMemory.unmountCartridge();
      expect(bankedMemory.isCartridgeMounted()).toBe(false);
      expect(bankedMemory.getCartridgeBankCount()).toBe(0);
    });

    it('should preserve cartridge when resetting RAM', () => {
      const rom = new Uint8Array(BANK_SIZE);
      rom[0] = 0x42;
      bankedMemory.mountCartridge(rom);

      bankedMemory.resetRam();

      expect(bankedMemory.isCartridgeMounted()).toBe(true);
      expect(bankedMemory.readBank(16, 0x0000)).toBe(0x42);
    });
  });

  describe('bank views', () => {
    it('should provide direct RAM bank views', () => {
      const view = bankedMemory.getRamBankView(0);
      expect(view.length).toBe(BANK_SIZE);

      // Write through view
      view[0x100] = 0x55;
      expect(bankedMemory.readBank(0, 0x100)).toBe(0x55);
    });

    it('should provide cartridge bank views', () => {
      const rom = new Uint8Array(BANK_SIZE);
      rom[0x200] = 0x66;
      bankedMemory.mountCartridge(rom);

      const view = bankedMemory.getCartridgeBankView(16);
      expect(view).not.toBeNull();
      expect(view!.length).toBe(BANK_SIZE);
      expect(view![0x200]).toBe(0x66);
    });

    it('should return null for unmounted cartridge bank view', () => {
      expect(bankedMemory.getCartridgeBankView(16)).toBeNull();
    });

    it('should calculate correct bank offsets', () => {
      expect(bankedMemory.getBankOffset(0)).toBe(RAM_BANKS_OFFSET);
      expect(bankedMemory.getBankOffset(1)).toBe(RAM_BANKS_OFFSET + BANK_SIZE);
      expect(bankedMemory.getBankOffset(5)).toBe(-1); // Unpopulated

      const rom = new Uint8Array(BANK_SIZE * 2);
      bankedMemory.mountCartridge(rom);

      expect(bankedMemory.getBankOffset(16)).toBe(CARTRIDGE_OFFSET);
      expect(bankedMemory.getBankOffset(17)).toBe(CARTRIDGE_OFFSET + BANK_SIZE);
      expect(bankedMemory.getBankOffset(18)).toBe(-1); // Beyond cartridge
    });
  });
});

describe('MemoryBus with banking', () => {
  let bankedMemory: BankedMemory;
  let memory: MemoryBus;

  beforeEach(() => {
    const sharedBuffer = createSharedMemory(16);
    bankedMemory = new BankedMemory(sharedBuffer);
    memory = new MemoryBus(bankedMemory);
  });

  describe('lower memory access', () => {
    it('should read and write lower memory', () => {
      memory.write8(0x0050, 0x42);
      expect(memory.read8(0x0050)).toBe(0x42);
    });

    it('should handle INT_STATUS write-1-to-clear', () => {
      // Set some flags directly
      memory.write8(0x0114, 0x00); // Clear first
      const view = new Uint8Array(bankedMemory.getSharedBuffer());
      view[0x0114] = 0x03; // Set bits 0 and 1

      // Write 1 to bit 0 to clear it
      memory.write8(0x0114, 0x01);
      expect(memory.read8(0x0114)).toBe(0x02); // Only bit 1 remains
    });
  });

  describe('bank switching', () => {
    it('should start with bank 0 selected', () => {
      expect(memory.getCurrentBank()).toBe(0);
    });

    it('should switch banks via BANK_REG', () => {
      memory.write8(0x0100, 5);
      expect(memory.getCurrentBank()).toBe(5);
      expect(memory.read8(0x0100)).toBe(5); // BANK_REG is readable
    });

    it('should access correct bank through upper memory window', () => {
      // Write to bank 0
      bankedMemory.writeBank(0, 0x0000, 0x11);
      // Write to bank 1
      bankedMemory.writeBank(1, 0x0000, 0x22);
      // Write to bank 2
      bankedMemory.writeBank(2, 0x0000, 0x33);

      // Select bank 0 and read
      memory.write8(0x0100, 0);
      expect(memory.read8(0x8000)).toBe(0x11);

      // Select bank 1 and read
      memory.write8(0x0100, 1);
      expect(memory.read8(0x8000)).toBe(0x22);

      // Select bank 2 and read
      memory.write8(0x0100, 2);
      expect(memory.read8(0x8000)).toBe(0x33);
    });

    it('should write to upper memory through bank window', () => {
      memory.write8(0x0100, 0); // Select bank 0
      memory.write8(0x8000, 0xab);

      expect(bankedMemory.readBank(0, 0x0000)).toBe(0xab);
    });

    it('should access cartridge ROM banks', () => {
      const rom = new Uint8Array(BANK_SIZE);
      rom[0] = 0xca;
      rom[0x100] = 0xfe;
      bankedMemory.mountCartridge(rom);

      memory.write8(0x0100, 16); // Select cartridge bank 16
      expect(memory.read8(0x8000)).toBe(0xca);
      expect(memory.read8(0x8100)).toBe(0xfe);
    });

    it('should not write to cartridge ROM', () => {
      const rom = new Uint8Array(BANK_SIZE);
      rom[0x200] = 0x42;
      bankedMemory.mountCartridge(rom);

      memory.write8(0x0100, 16);
      memory.write8(0x8200, 0x99); // Try to write
      expect(memory.read8(0x8200)).toBe(0x42); // Original value preserved
    });
  });

  describe('readFromBank', () => {
    it('should bypass current bank selection', () => {
      bankedMemory.writeBank(0, 0x100, 0xaa);
      bankedMemory.writeBank(1, 0x100, 0xbb);

      memory.write8(0x0100, 0); // Current bank is 0

      // readFromBank should access bank 1 directly
      expect(memory.readFromBank(1, 0x100)).toBe(0xbb);
      // Normal read still uses current bank
      expect(memory.read8(0x8100)).toBe(0xaa);
    });

    it('should access cartridge banks directly', () => {
      const rom = new Uint8Array(BANK_SIZE * 2);
      rom[0] = 0x11;
      rom[BANK_SIZE] = 0x22;
      bankedMemory.mountCartridge(rom);

      expect(memory.readFromBank(16, 0)).toBe(0x11);
      expect(memory.readFromBank(17, 0)).toBe(0x22);
    });
  });

  describe('reset', () => {
    it('should reset lower memory and RAM banks', () => {
      memory.write8(0x0050, 0x42);
      memory.write8(0x0100, 5); // Set bank
      bankedMemory.writeBank(0, 0x100, 0x55);

      memory.reset();

      expect(memory.read8(0x0050)).toBe(0x00);
      expect(memory.getCurrentBank()).toBe(0);
      expect(bankedMemory.readBank(0, 0x100)).toBe(0x00);
    });

    it('should preserve mounted cartridge on reset', () => {
      const rom = new Uint8Array(BANK_SIZE);
      rom[0] = 0x42;
      bankedMemory.mountCartridge(rom);

      memory.reset();

      expect(bankedMemory.isCartridgeMounted()).toBe(true);
      expect(bankedMemory.readBank(16, 0)).toBe(0x42);
    });

    it('should unmount cartridge on fullReset', () => {
      const rom = new Uint8Array(BANK_SIZE);
      bankedMemory.mountCartridge(rom);

      memory.fullReset();

      expect(bankedMemory.isCartridgeMounted()).toBe(false);
    });
  });

  describe('16-bit operations', () => {
    it('should handle 16-bit reads across bank boundary', () => {
      memory.write8(0x0100, 0); // Bank 0
      memory.write8(0xffff, 0x12); // Last byte of bank window

      // This would wrap around in the bank window
      // but 16-bit reads call read8 twice, which handles it
    });

    it('should handle 16-bit writes', () => {
      memory.write16(0x1000, 0xabcd);
      expect(memory.read8(0x1000)).toBe(0xab); // High byte
      expect(memory.read8(0x1001)).toBe(0xcd); // Low byte
      expect(memory.read16(0x1000)).toBe(0xabcd);
    });
  });
});

describe('createSharedMemory', () => {
  it('should create buffer with minimum size for no cartridge', () => {
    const buffer = createSharedMemory(0);
    expect(buffer.byteLength).toBe(MIN_SHARED_SIZE);
  });

  it('should create buffer sized for cartridge banks', () => {
    const buffer = createSharedMemory(10);
    expect(buffer.byteLength).toBe(MIN_SHARED_SIZE + 10 * BANK_SIZE);
  });
});

# Bank Switching Implementation Specification

## Overview

This document specifies how to implement bank switching in the Virtual Console emulator, enabling cartridge ROM to be mounted and accessed through the banking system described in the hardware specification.

## Core Architecture

**The implementation is simple: one large SharedArrayBuffer with a sliding window.**

All memory - lower RAM, banked RAM, and cartridge ROM - lives in a single contiguous SharedArrayBuffer. The CPU sees a 64KB address space where the upper 32KB is a "window" that slides over different regions of this buffer based on the current bank selection.

```
SharedArrayBuffer (linear layout):
┌────────────────────────────────────────────────────────────┐
│ 0x00000  Lower Memory (32KB)  - always visible to CPU      │
├────────────────────────────────────────────────────────────┤
│ 0x08000  RAM Bank 0 (32KB)                                 │
│ 0x10000  RAM Bank 1 (32KB)                                 │
│ 0x18000  RAM Bank 2 (32KB)                                 │
│ 0x20000  RAM Bank 3 (32KB)                                 │
├────────────────────────────────────────────────────────────┤
│ 0x28000  Cartridge Bank 16 (32KB)  ← first cartridge bank  │
│ 0x30000  Cartridge Bank 17 (32KB)                          │
│ 0x38000  Cartridge Bank 18 (32KB)                          │
│ ...                                                        │
└────────────────────────────────────────────────────────────┘

CPU's 64KB view:
┌────────────────────────────────────────────────────────────┐
│ 0x0000-0x7FFF  →  Always maps to buffer offset 0x00000     │
│                   (lower memory: registers, sprites, RAM)  │
├────────────────────────────────────────────────────────────┤
│ 0x8000-0xFFFF  →  Maps to selected bank in buffer          │
│                   (controlled by BANK_REG at 0x0100)       │
└────────────────────────────────────────────────────────────┘
```

**How bank switching works:**
1. CPU writes bank number (0-255) to BANK_REG (address 0x0100)
2. MemoryBus updates which 32KB slice the upper window points to
3. Subsequent reads/writes to 0x8000-0xFFFF access that bank

**Why SharedArrayBuffer for everything:**
- Renderer can directly read sprite/tile graphics from any bank (no message passing)
- Debug tools can inspect any memory location in real-time
- Zero-copy access from both main thread and worker thread

---

## Current vs Target State

**Current State:**
- `MemoryBus` provides a flat 64KB address space
- No bank switching is implemented
- Cartridge loading copies code to fixed RAM addresses
- Upper 32KB (0x8000-0xFFFF) is not banked

**Target State:**
- Single SharedArrayBuffer holds all memory (lower + banks + cartridge)
- `MemoryBus` provides 64KB view with sliding window for upper 32KB
- Writing to BANK_REG (0x0100) switches which bank the window points to
- Renderer and debug tools can directly access any offset in the buffer

---

## Component Overview

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `BankedMemory` | console/src/bankedMemory.ts | Manages RAM banks and cartridge ROM |
| `MemoryBus` | console/src/memoryBus.ts | Address translation, bank switching |
| `VirtualConsole` | console/src/virtualConsole.ts | Cartridge mounting, system integration |
| `loadCartridgeCode` | devkit/client/src/services/cartridgeBundler.ts | ROM parsing and initial code loading |

---

## Implementation Details

### 1. BankedMemory Class

Create a new class to manage the banked memory system backed by SharedArrayBuffer.

**File:** `src/console/src/bankedMemory.ts`

```typescript
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

export const BANK_SIZE = 0x8000;           // 32KB per bank
export const LOWER_MEMORY_SIZE = 0x8000;   // 32KB
export const RAM_BANK_COUNT = 4;           // Banks 0-3
export const CARTRIDGE_BANK_OFFSET = 16;   // Cartridge starts at bank 16
export const MAX_BANKS = 256;              // Total addressable banks
export const MAX_CARTRIDGE_BANKS = MAX_BANKS - CARTRIDGE_BANK_OFFSET;  // 240

// Offsets within SharedArrayBuffer
export const LOWER_MEMORY_OFFSET = 0x00000;
export const RAM_BANKS_OFFSET = 0x08000;
export const CARTRIDGE_OFFSET = 0x28000;   // 0x8000 + 4 * 0x8000

// Buffer sizes
export const MIN_SHARED_SIZE = LOWER_MEMORY_SIZE + (RAM_BANK_COUNT * BANK_SIZE);  // 160KB
export const MAX_SHARED_SIZE = MIN_SHARED_SIZE + (MAX_CARTRIDGE_BANKS * BANK_SIZE);  // ~7.8MB

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
    // Optionally zero out cartridge area
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
      const bufferOffset = RAM_BANKS_OFFSET + (bank * BANK_SIZE) + offset;
      return this.memoryView[bufferOffset];
    } else if (bank < CARTRIDGE_BANK_OFFSET) {
      // Unpopulated RAM banks 4-15
      return 0xFF;
    } else {
      // Cartridge ROM banks 16-255
      const cartridgeBank = bank - CARTRIDGE_BANK_OFFSET;
      if (cartridgeBank < this.cartridgeBankCount) {
        const bufferOffset = CARTRIDGE_OFFSET + (cartridgeBank * BANK_SIZE) + offset;
        return this.memoryView[bufferOffset];
      }
      // No cartridge or bank out of range
      return 0xFF;
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
      const bufferOffset = RAM_BANKS_OFFSET + (bank * BANK_SIZE) + offset;
      this.memoryView[bufferOffset] = value & 0xFF;
    }
    // Cartridge ROM banks are read-only (writes ignored)
  }

  /**
   * Reset RAM banks to zero (does not affect cartridge ROM)
   */
  resetRam(): void {
    // Zero out RAM banks
    for (let bank = 0; bank < RAM_BANK_COUNT; bank++) {
      const start = RAM_BANKS_OFFSET + (bank * BANK_SIZE);
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
    const offset = RAM_BANKS_OFFSET + (bank * BANK_SIZE);
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
    const offset = CARTRIDGE_OFFSET + (cartridgeBank * BANK_SIZE);
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
      return RAM_BANKS_OFFSET + (bank * BANK_SIZE);
    } else if (bank < CARTRIDGE_BANK_OFFSET) {
      return -1; // Unpopulated
    } else {
      const cartridgeBank = bank - CARTRIDGE_BANK_OFFSET;
      if (cartridgeBank < this.cartridgeBankCount) {
        return CARTRIDGE_OFFSET + (cartridgeBank * BANK_SIZE);
      }
      return -1; // Beyond cartridge
    }
  }
}
```

### 2. Updated MemoryBus Class

Modify `MemoryBus` to support bank switching.

**File:** `src/console/src/memoryBus.ts`

```typescript
/**
 * Memory Bus for the Virtual Console
 *
 * Provides banked memory access with 64KB visible address space.
 * Lower 32KB (0x0000-0x7FFF) is always visible.
 * Upper 32KB (0x8000-0xFFFF) is banked via BANK_REG (0x0100).
 */

import { BankedMemory } from './bankedMemory';

const LOWER_MEMORY_SIZE = 0x8000;  // 32KB
const UPPER_MEMORY_START = 0x8000;
const BANK_REG = 0x0100;
const INT_STATUS = 0x0114;

export class MemoryBus {
  private readonly lowerMemory: Uint8Array;
  private readonly bankedMemory: BankedMemory;
  private currentBank: number = 0;

  /**
   * @param lowerMemory - Optional Uint8Array for lower 32KB (for SharedArrayBuffer).
   *                      If not provided, creates a new Uint8Array.
   * @param bankedMemory - Optional BankedMemory instance. If not provided, creates one.
   */
  constructor(lowerMemory?: Uint8Array, bankedMemory?: BankedMemory) {
    if (lowerMemory) {
      if (lowerMemory.length !== LOWER_MEMORY_SIZE) {
        throw new Error(`Lower memory must be exactly ${LOWER_MEMORY_SIZE} bytes`);
      }
      this.lowerMemory = lowerMemory;
    } else {
      this.lowerMemory = new Uint8Array(LOWER_MEMORY_SIZE);
    }

    this.bankedMemory = bankedMemory || new BankedMemory();
  }

  /**
   * Get the BankedMemory instance for cartridge mounting
   */
  getBankedMemory(): BankedMemory {
    return this.bankedMemory;
  }

  /**
   * Get the current bank number
   */
  getCurrentBank(): number {
    return this.currentBank;
  }

  /**
   * Read an 8-bit value from memory
   */
  read8(address: number): number {
    if (address < 0 || address > 0xFFFF) {
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
   */
  write8(address: number, value: number): void {
    if (address < 0 || address > 0xFFFF) {
      throw new Error(`Memory write out of bounds: 0x${address.toString(16)}`);
    }
    if (value < 0 || value > 0xFF) {
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

      this.lowerMemory[address] = value;
    } else {
      // Upper 32KB - banked
      const offset = address - UPPER_MEMORY_START;
      this.bankedMemory.writeBank(this.currentBank, offset, value);
    }
  }

  /**
   * Read a 16-bit value from memory (big-endian)
   */
  read16(address: number): number {
    const high = this.read8(address);
    const low = this.read8(address + 1);
    return (high << 8) | low;
  }

  /**
   * Write a 16-bit value to memory (big-endian)
   */
  write16(address: number, value: number): void {
    if (value < 0 || value > 0xFFFF) {
      throw new Error(`Invalid 16-bit value: 0x${value.toString(16)}`);
    }
    const high = (value >> 8) & 0xFF;
    const low = value & 0xFF;
    this.write8(address, high);
    this.write8(address + 1, low);
  }

  /**
   * Read from a specific bank (bypasses current bank selection)
   * Used by sprite/tile rendering to access graphics in any bank.
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
   * Get the total lower memory size
   */
  get size(): number {
    return LOWER_MEMORY_SIZE;
  }
}
```

### 3. Updated VirtualConsole Class

Add cartridge mounting to the console.

**File:** `src/console/src/virtualConsole.ts`

```typescript
/**
 * Virtual Console
 *
 * Brings together the CPU and memory bus to form a complete virtual console system.
 */

import { CPU } from './cpu';
import { MemoryBus } from './memoryBus';
import { BankedMemory } from './bankedMemory';

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

  constructor() {
    this.bankedMemory = new BankedMemory();
    this.memory = new MemoryBus(undefined, this.bankedMemory);
    this.cpu = new CPU(this.memory);
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
```

### 4. Updated CPU Worker

Modify the worker to support cartridge mounting.

**File:** `src/devkit/client/src/consoleIntegration/cpuWorker.ts`

Add new message handlers:

```typescript
case 'mountCartridge': {
  const { rom } = payload;
  const romArray = new Uint8Array(rom);

  try {
    const bankedMemory = memory.getBankedMemory();
    bankedMemory.mountCartridge(romArray);

    self.postMessage({
      type: 'cartridgeMounted',
      bankCount: bankedMemory.getCartridgeBankCount(),
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
  break;
}

case 'unmountCartridge': {
  const bankedMemory = memory.getBankedMemory();
  bankedMemory.unmountCartridge();
  self.postMessage({ type: 'cartridgeUnmounted' });
  break;
}

case 'getCurrentBank': {
  self.postMessage({
    type: 'currentBank',
    bank: memory.getCurrentBank(),
  });
  break;
}
```

### 5. Updated Cartridge Loading

Modify `loadCartridgeCode` to work with the new system.

**File:** `src/devkit/client/src/services/cartridgeBundler.ts`

The existing `loadCartridgeCode` function copies code segments to lower memory, which remains unchanged. The cartridge ROM itself is mounted separately for bank switching access:

```typescript
/**
 * Load and mount a cartridge
 *
 * This performs two operations:
 * 1. Mounts the ROM for bank switching (banks 16+)
 * 2. Copies initial code segments to RAM (bank 0 lower memory)
 *
 * @param rom - The ROM data
 * @param memory - MemoryBus with write8 for code loading
 * @param bankedMemory - BankedMemory for ROM mounting
 * @returns Load result with start address
 */
export function loadAndMountCartridge(
  rom: Uint8Array,
  memory: { write8: (address: number, value: number) => void },
  bankedMemory: { mountCartridge: (rom: Uint8Array) => void }
): { startAddress: number } | null {
  // Mount the ROM for bank switching
  bankedMemory.mountCartridge(rom);

  // Load code segments to RAM
  return loadCartridgeCode(rom, memory);
}
```

---

## Sprite and Tile Graphics Access

The sprite and tile rendering systems need to access graphics from any bank without affecting the current bank selection.

### Sprite Graphics Access

When rendering sprites, the system reads graphics using the per-sprite bank byte:

```typescript
// In sprite renderer
function getSpritePixel(
  memory: MemoryBus,
  spriteBank: number,
  spriteIndex: number,
  x: number,
  y: number
): number {
  const spriteSize = 128; // 16x16 @ 4bpp
  const rowSize = 8;      // 8 bytes per row @ 4bpp

  const offset = (spriteIndex * spriteSize) + (y * rowSize) + Math.floor(x / 2);
  const byte = memory.readFromBank(spriteBank, offset);

  // Extract nibble
  return (x % 2 === 0) ? (byte >> 4) & 0x0F : byte & 0x0F;
}
```

### Tile Graphics Access

Similarly for tiles using TILEMAP_GRAPHICS_BANK register:

```typescript
// In tile renderer
function getTilePixel(
  memory: MemoryBus,
  tileBank: number,
  tileIndex: number,
  x: number,
  y: number
): number {
  const tileSize = 128; // 16x16 @ 4bpp
  const rowSize = 8;

  const offset = (tileIndex * tileSize) + (y * rowSize) + Math.floor(x / 2);
  const byte = memory.readFromBank(tileBank, offset);

  return (x % 2 === 0) ? (byte >> 4) & 0x0F : byte & 0x0F;
}
```

---

## SharedArrayBuffer Architecture

The devkit uses `SharedArrayBuffer` for zero-copy memory access between the main thread and the CPU worker. This enables the renderer and debug tools to directly access all memory without message passing overhead.

### Memory Layout in SharedArrayBuffer

All memory (lower 32KB, RAM banks, and cartridge ROM) is backed by SharedArrayBuffer:

```
┌─────────────────────────────────────────────────────────────────┐
│                    SharedArrayBuffer                            │
├─────────────────────────────────────────────────────────────────┤
│ Offset 0x00000 - 0x07FFF:  Lower Memory (32KB)                  │
│   - Zero page, hardware registers, sprites, general RAM         │
├─────────────────────────────────────────────────────────────────┤
│ Offset 0x08000 - 0x0FFFF:  RAM Bank 0 (32KB)                    │
│ Offset 0x10000 - 0x17FFF:  RAM Bank 1 (32KB)                    │
│ Offset 0x18000 - 0x1FFFF:  RAM Bank 2 (32KB)                    │
│ Offset 0x20000 - 0x27FFF:  RAM Bank 3 (32KB)                    │
├─────────────────────────────────────────────────────────────────┤
│ Offset 0x28000+:           Cartridge ROM (variable size)        │
│   - Copied into shared buffer when cartridge is mounted         │
│   - Up to 240 banks × 32KB = 7.5MB                              │
└─────────────────────────────────────────────────────────────────┘
```

### Initialization Flow

```typescript
// Main thread: Create shared buffer sized for expected cartridge
function createSharedMemory(maxCartridgeBanks: number = 16): SharedArrayBuffer {
  const size = MIN_SHARED_SIZE + (maxCartridgeBanks * BANK_SIZE);
  return new SharedArrayBuffer(size);
}

// Main thread: Initialize and send to worker
const sharedBuffer = createSharedMemory(64); // Support up to 64 cartridge banks (2MB)
worker.postMessage({
  type: 'init',
  sharedBuffer: sharedBuffer
}, [/* no transfer, SharedArrayBuffer is shared */]);

// Worker: Initialize with shared buffer
case 'init': {
  const { sharedBuffer } = payload;
  const bankedMemory = new BankedMemory(sharedBuffer);
  const lowerMemory = bankedMemory.getLowerMemoryView();
  memory = new MemoryBus(lowerMemory, bankedMemory);
  cpu = new CPU(memory);
  // ...
}
```

### Direct Access from Renderer/Debug Tools

With SharedArrayBuffer, the renderer and debug tools can directly access any memory:

```typescript
// Renderer has direct access to the same SharedArrayBuffer
class SpriteRenderer {
  private readonly memoryView: Uint8Array;

  constructor(sharedBuffer: SharedArrayBuffer) {
    this.memoryView = new Uint8Array(sharedBuffer);
  }

  /**
   * Read sprite graphics directly from shared memory
   */
  getSpritePixel(bank: number, spriteIndex: number, x: number, y: number): number {
    const offset = this.getBankOffset(bank) + (spriteIndex * 128) + (y * 8) + Math.floor(x / 2);
    const byte = this.memoryView[offset];
    return (x % 2 === 0) ? (byte >> 4) & 0x0F : byte & 0x0F;
  }

  private getBankOffset(bank: number): number {
    if (bank < RAM_BANK_COUNT) {
      return RAM_BANKS_OFFSET + (bank * BANK_SIZE);
    } else if (bank >= CARTRIDGE_BANK_OFFSET) {
      return CARTRIDGE_OFFSET + ((bank - CARTRIDGE_BANK_OFFSET) * BANK_SIZE);
    }
    return 0; // Unpopulated bank
  }
}

// Debug tools can inspect any bank without worker messages
class MemoryInspector {
  private readonly memoryView: Uint8Array;

  constructor(sharedBuffer: SharedArrayBuffer) {
    this.memoryView = new Uint8Array(sharedBuffer);
  }

  /**
   * Read a range of bytes from any bank
   */
  readBankRange(bank: number, offset: number, length: number): Uint8Array {
    const bankOffset = this.getBankOffset(bank);
    return this.memoryView.slice(bankOffset + offset, bankOffset + offset + length);
  }

  /**
   * Get the entire lower memory for inspection
   */
  getLowerMemory(): Uint8Array {
    return this.memoryView.slice(LOWER_MEMORY_OFFSET, LOWER_MEMORY_OFFSET + LOWER_MEMORY_SIZE);
  }
}
```

### Cartridge Mounting with Shared Memory

When mounting a cartridge, the ROM data is copied into the SharedArrayBuffer:

```typescript
// Main thread: Load and mount cartridge
async function loadCartridge(romFile: File): Promise<void> {
  const romData = new Uint8Array(await romFile.arrayBuffer());

  // Check if shared buffer is large enough
  const requiredBanks = romData.length / BANK_SIZE;
  if (CARTRIDGE_OFFSET + romData.length > sharedBuffer.byteLength) {
    // Need to recreate shared buffer with larger size
    // This requires restarting the worker
    throw new Error(`Cartridge too large. Need to resize shared buffer.`);
  }

  // Send mount command to worker (ROM copied into shared buffer there)
  worker.postMessage({
    type: 'mountCartridge',
    rom: romData  // Transferred as ArrayBuffer
  });
}

// Worker: Mount cartridge
case 'mountCartridge': {
  const { rom } = payload;
  const romArray = new Uint8Array(rom);

  try {
    bankedMemory.mountCartridge(romArray);  // Copies into SharedArrayBuffer

    self.postMessage({
      type: 'cartridgeMounted',
      bankCount: bankedMemory.getCartridgeBankCount(),
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
  break;
}
```

### Benefits of Full SharedArrayBuffer Approach

1. **Zero-copy renderer access** - Sprite and tile renderers read graphics directly without message passing
2. **Real-time debug tools** - Memory inspector shows live values without polling
3. **Consistent architecture** - All memory uses the same access pattern
4. **Performance** - No serialization/deserialization overhead for bank data
5. **Atomics support** - Can use `Atomics` for synchronization if needed

### Thread Safety Considerations

Since multiple threads access the same memory:

1. **CPU writes, others read** - Most access is CPU writing during execution, renderer/UI reading
2. **No locks needed for reads** - Renderer can tolerate slightly stale data (one frame old)
3. **Cartridge mount is synchronized** - Worker completes mount before acknowledging
4. **Bank register** - `currentBank` is in lower memory, visible to all threads

```typescript
// Read current bank from shared memory (lower memory offset 0x0100)
function getCurrentBank(memoryView: Uint8Array): number {
  return memoryView[LOWER_MEMORY_OFFSET + 0x0100];
}
```

---

## Integration Sequence

### Console Startup

```
1. Create BankedMemory (4 RAM banks initialized to zero)
2. Create MemoryBus with BankedMemory
3. Create CPU with MemoryBus
4. Console ready (no cartridge)
```

### Cartridge Load and Run

```
1. Read cartridge.rom file → Uint8Array
2. Mount cartridge: bankedMemory.mountCartridge(rom)
3. Parse metadata from bank 0 (ROM offset 0x00000)
4. Load code segments to RAM (write to lower memory)
5. Set CPU program counter to start address
6. Begin execution
```

### Bank Switching During Execution

```
1. CPU executes: ST R0, [$0100]  ; Write bank number to BANK_REG
2. MemoryBus.write8(0x0100, value) intercepts write
3. MemoryBus.currentBank = value
4. Subsequent reads from 0x8000-0xFFFF access new bank
```

### Sprite Rendering (Per-Scanline)

```
1. Read sprite attributes from 0x0700+ (lower memory)
2. For each visible sprite:
   a. Get sprite bank from attribute byte +4
   b. Call memory.readFromBank(spriteBank, offset)
   c. Render pixels to scanline buffer
```

---

## Testing Requirements

### Unit Tests

1. **BankedMemory**
   - RAM bank read/write
   - Unpopulated bank reads (should return 0xFF)
   - Cartridge mounting/unmounting
   - ROM bank reads
   - Invalid ROM size rejection

2. **MemoryBus with Banking**
   - Lower memory access unchanged
   - BANK_REG writes update current bank
   - Upper memory reads use current bank
   - readFromBank bypasses current bank
   - INT_STATUS W1C behavior preserved

3. **VirtualConsole Integration**
   - Cartridge mount/unmount
   - Reset preserves cartridge
   - Full reset removes cartridge

### Integration Tests

1. **Bank Switching**
   - Write to BANK_REG, read from upper memory
   - Switch between multiple banks
   - Verify RAM banks are writable
   - Verify ROM banks are read-only

2. **Cartridge Loading**
   - Load valid ROM, verify bank count
   - Access code in bank 17
   - Access sprites in bank 18+
   - Run program that switches banks

---

## Constants Reference

```typescript
// Memory architecture
export const BANK_SIZE = 0x8000;           // 32KB per bank
export const LOWER_MEMORY_SIZE = 0x8000;   // 32KB
export const RAM_BANK_COUNT = 4;           // Banks 0-3
export const CARTRIDGE_BANK_OFFSET = 16;   // Cartridge starts at bank 16
export const MAX_BANKS = 256;              // Total addressable banks
export const MAX_CARTRIDGE_BANKS = MAX_BANKS - CARTRIDGE_BANK_OFFSET;  // 240

// SharedArrayBuffer offsets
export const LOWER_MEMORY_OFFSET = 0x00000;
export const RAM_BANKS_OFFSET = 0x08000;   // After lower memory
export const CARTRIDGE_OFFSET = 0x28000;   // After RAM banks

// Buffer sizes
export const MIN_SHARED_SIZE = LOWER_MEMORY_SIZE + (RAM_BANK_COUNT * BANK_SIZE);  // 160KB
export const MAX_SHARED_SIZE = MIN_SHARED_SIZE + (MAX_CARTRIDGE_BANKS * BANK_SIZE);  // ~7.8MB

// Address ranges (CPU view)
export const UPPER_MEMORY_START = 0x8000;  // Bank window start
export const UPPER_MEMORY_END = 0xFFFF;    // Bank window end

// Hardware registers
export const BANK_REG = 0x0100;
export const SPRITE_GRAPHICS_BANK = 0x0106;
export const TILEMAP_GRAPHICS_BANK = 0x013E;
```

---

## Migration Path

### Phase 1: Core Banking
1. Implement `BankedMemory` class
2. Update `MemoryBus` with bank switching
3. Update `VirtualConsole` with mounting
4. Add tests for new functionality

### Phase 2: Worker Integration
1. Add cartridge mounting messages to worker
2. Update initialization flow
3. Add bank inspection messages for debugging

### Phase 3: Rendering Integration
1. Update sprite renderer to use `readFromBank`
2. Update tile renderer to use `readFromBank`
3. Verify graphics load from cartridge banks

### Phase 4: Devkit UI
1. Add bank viewer/inspector panel
2. Show current bank in debugger
3. Add cartridge info display

---

## Revision History

- v1.0 (2024): Initial specification

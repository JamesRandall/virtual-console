/**
 * Palette Management for the Virtual Console
 *
 * Handles video mode setup including palette memory initialization
 * and scanline palette mapping configuration.
 */

import { MemoryBus } from './memoryBus';

// Memory-mapped register addresses
const VIDEO_MODE_REG = 0x0101;
const PALETTE_RAM_START = 0x0200;
const SCANLINE_PALETTE_MAP_START = 0x0600;

// Palette constants
const PALETTE_4BPP_SIZE = 16;
const PALETTE_4BPP_COUNT = 64;
const PALETTE_8BPP_SIZE = 256;
const PALETTE_8BPP_COUNT = 4;
const SCANLINE_COUNT = 256;

// Video modes
const MODE_0_4BPP_256x160 = 0;
const MODE_1_8BPP_160x96 = 1;
const MODE_2_8BPP_128x128 = 2;
const MODE_3_4BPP_176x176 = 3;

/**
 * Default palette indices for 4bpp mode
 * These index into the master 256-color Tailwind palette
 */
const DEFAULT_4BPP_PALETTE: readonly number[] = [
  253, // black
  255, // white
  6,   // red
  61,  // green
  127, // blue
  37,  // yellow
  224, // light gray
  9,   // dark red
  64,  // dark green
  130, // dark blue
  52,  // dark yellow
  229, // dark gray
  149, // purple
  60,  // cyan
  170, // pink
  237, // stone
] as const;

/**
 * Set the video mode and initialize palette memory accordingly
 *
 * @param bus - The memory bus to write to
 * @param mode - Video mode (0-3)
 * @throws Error if mode is invalid
 */
export function setVideoMode(bus: MemoryBus, mode: number): void {
  if (mode < 0 || mode > 3) {
    throw new Error(`Invalid video mode: ${mode}. Must be 0-3.`);
  }

  // Write video mode to register
  bus.write8(VIDEO_MODE_REG, mode);

  // Initialize palette memory based on mode
  if (mode === MODE_0_4BPP_256x160 || mode === MODE_3_4BPP_176x176) {
    initialize4bppPalettes(bus);
  } else if (mode === MODE_1_8BPP_160x96 || mode === MODE_2_8BPP_128x128) {
    initialize8bppPalettes(bus);
  }

  // Initialize all scanline palette map entries to 0 (use first palette)
  initializeScanlinePaletteMap(bus);
}

/**
 * Initialize palette memory for 4bpp modes (0 and 3)
 * Loads 64 instances of the default 16-color palette
 */
function initialize4bppPalettes(bus: MemoryBus): void {
  let address = PALETTE_RAM_START;

  // Write 64 copies of the default 16-color palette
  for (let paletteIndex = 0; paletteIndex < PALETTE_4BPP_COUNT; paletteIndex++) {
    for (let colorIndex = 0; colorIndex < PALETTE_4BPP_SIZE; colorIndex++) {
      bus.write8(address, DEFAULT_4BPP_PALETTE[colorIndex]);
      address++;
    }
  }
}

/**
 * Initialize palette memory for 8bpp modes (1 and 2)
 * Loads linear indices from 0 to 255 for each of the 4 palettes
 */
function initialize8bppPalettes(bus: MemoryBus): void {
  let address = PALETTE_RAM_START;

  // Write 4 palettes, each with linear indices 0-255
  for (let paletteIndex = 0; paletteIndex < PALETTE_8BPP_COUNT; paletteIndex++) {
    for (let colorIndex = 0; colorIndex < PALETTE_8BPP_SIZE; colorIndex++) {
      bus.write8(address, colorIndex);
      address++;
    }
  }
}

/**
 * Initialize all scanline palette map entries to 0
 * This sets each scanline to use the first palette
 */
function initializeScanlinePaletteMap(bus: MemoryBus): void {
  for (let scanline = 0; scanline < SCANLINE_COUNT; scanline++) {
    const address = SCANLINE_PALETTE_MAP_START + scanline;
    bus.write8(address, 0);
  }
}

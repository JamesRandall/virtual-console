/**
 * Test Pattern Generator
 *
 * Creates test data in the virtual console memory to verify rendering.
 */

const FRAMEBUFFER_START = 0xB000;
const PALETTE_RAM_START = 0x0200;
const SCANLINE_MAP_START = 0x0600;

const WIDTH = 256;
const HEIGHT = 160;

/**
 * Default 4bpp palette indices (from video spec)
 */
const DEFAULT_PALETTE = [
  253, // 0: black
  255, // 1: white
  6,   // 2: red
  61,  // 3: green
  127, // 4: blue
  37,  // 5: yellow
  224, // 6: light gray
  9,   // 7: dark red
  64,  // 8: dark green
  130, // 9: dark blue
  52,  // 10: dark yellow
  229, // 11: dark gray
  149, // 12: purple
  60,  // 13: cyan
  170, // 14: pink
  237, // 15: stone
];

/**
 * Write test pattern to framebuffer
 *
 * Creates a colorful test pattern with:
 * - Color bars in the top section
 * - Gradient in the middle section
 * - Checkerboard pattern in the bottom section
 */
export function writeTestPattern(memory: Uint8Array): void {
  // Initialize palette RAM (palette 0)
  for (let i = 0; i < 16; i++) {
    memory[PALETTE_RAM_START + i] = DEFAULT_PALETTE[i];
  }

  // Initialize scanline map (all lines use palette 0)
  for (let y = 0; y < HEIGHT; y++) {
    memory[SCANLINE_MAP_START + y] = 0; // Use palette 0
  }

  // Draw test pattern
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      let colorIndex = 0;

      if (y < 40) {
        // Color bars (top section)
        colorIndex = Math.floor((x / WIDTH) * 16);
      } else if (y < 80) {
        // Horizontal gradient (upper middle)
        colorIndex = Math.floor((x / WIDTH) * 16);
      } else if (y < 120) {
        // Vertical gradient (lower middle)
        colorIndex = Math.floor(((y - 80) / 40) * 16);
      } else {
        // Checkerboard pattern (bottom section)
        const checkerSize = 8;
        const checkerX = Math.floor(x / checkerSize);
        const checkerY = Math.floor(y / checkerSize);
        colorIndex = ((checkerX + checkerY) % 2 === 0) ? 1 : 0; // White or black
      }

      // Write pixel (4bpp = 2 pixels per byte)
      const pixelIndex = y * WIDTH + x;
      const byteIndex = FRAMEBUFFER_START + Math.floor(pixelIndex / 2);
      const isEvenPixel = (pixelIndex % 2) === 0;

      if (isEvenPixel) {
        // Low nibble
        memory[byteIndex] = (memory[byteIndex] & 0xF0) | (colorIndex & 0x0F);
      } else {
        // High nibble
        memory[byteIndex] = (memory[byteIndex] & 0x0F) | ((colorIndex & 0x0F) << 4);
      }
    }
  }
}

/**
 * Write animated test pattern that changes over time
 */
export function writeAnimatedTestPattern(memory: Uint8Array, frame: number): void {
  // Initialize palette RAM (palette 0)
  for (let i = 0; i < 16; i++) {
    memory[PALETTE_RAM_START + i] = DEFAULT_PALETTE[i];
  }

  // Initialize scanline map with cycling palettes (for future use)
  for (let y = 0; y < HEIGHT; y++) {
    memory[SCANLINE_MAP_START + y] = 0; // Use palette 0 for now
  }

  // Draw animated pattern
  const offset = frame % 256;

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      // Create a moving rainbow pattern
      const colorIndex = ((x + offset) % 16);

      // Write pixel (4bpp = 2 pixels per byte)
      const pixelIndex = y * WIDTH + x;
      const byteIndex = FRAMEBUFFER_START + Math.floor(pixelIndex / 2);
      const isEvenPixel = (pixelIndex % 2) === 0;

      if (isEvenPixel) {
        // Low nibble
        memory[byteIndex] = (memory[byteIndex] & 0xF0) | (colorIndex & 0x0F);
      } else {
        // High nibble
        memory[byteIndex] = (memory[byteIndex] & 0x0F) | ((colorIndex & 0x0F) << 4);
      }
    }
  }
}

/**
 * Clear framebuffer to a single color
 */
export function clearFramebuffer(memory: Uint8Array, colorIndex: number): void {
  const color4bit = colorIndex & 0x0F;
  const byteFill = (color4bit << 4) | color4bit; // Both nibbles same color

  for (let i = 0; i < (WIDTH * HEIGHT) / 2; i++) {
    memory[FRAMEBUFFER_START + i] = byteFill;
  }
}

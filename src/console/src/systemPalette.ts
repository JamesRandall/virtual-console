/**
 * System Palette - Single Source of Truth
 *
 * Defines the master 256-color RGB palette based on Tailwind CSS colors
 * and classic 8-bit computer colors (Spectrum, BBC Micro, C64).
 * This palette is referenced by index from Palette RAM (0x0200-0x05FF).
 *
 * Each color is an RGB triplet [R, G, B] where each component is 0-255.
 */

export type RGBColor = readonly [number, number, number];

/**
 * Master 256-color palette (RGB values 0-255)
 * Based on Tailwind CSS colors, organized by hue, plus classic 8-bit computer colors
 */
export const SYSTEM_PALETTE: readonly RGBColor[] = [
  // red - row 0 (indices 0-10)
  [254, 242, 242], [255, 226, 226], [255, 201, 201], [255, 162, 162], [255, 100, 103], [255, 57, 66], [241, 31, 47], [208, 6, 33], [173, 0, 27], [145, 0, 23], [83, 0, 16],
  // orange - row 1 (indices 11-21)
  [255, 251, 235], [255, 244, 214], [255, 232, 176], [255, 214, 130], [255, 184, 72], [255, 161, 46], [247, 132, 24], [207, 99, 5], [169, 74, 1], [139, 57, 2], [85, 33, 2],
  // yellow - row 2 (indices 22-32)
  [255, 254, 234], [254, 252, 197], [254, 245, 140], [255, 235, 87], [255, 222, 54], [254, 203, 44], [248, 166, 26], [209, 125, 6], [175, 98, 3], [147, 79, 5], [92, 49, 3],
  // lime - row 3 (indices 33-43)
  [253, 255, 233], [247, 255, 199], [235, 252, 156], [217, 248, 105], [194, 240, 64], [168, 228, 51], [138, 202, 31], [111, 168, 12], [91, 141, 5], [77, 122, 4], [49, 84, 2],
  // green - row 4 (indices 44-54)
  [247, 254, 231], [235, 251, 210], [214, 246, 178], [183, 238, 140], [141, 224, 95], [105, 209, 76], [74, 182, 63], [53, 153, 53], [38, 128, 45], [29, 110, 41], [15, 75, 28],
  // emerald - row 5 (indices 55-65)
  [236, 253, 245], [212, 250, 230], [178, 245, 209], [137, 237, 183], [89, 224, 152], [56, 209, 133], [38, 184, 118], [27, 157, 107], [18, 131, 94], [13, 111, 83], [6, 76, 59],
  // teal - row 6 (indices 66-76)
  [241, 254, 253], [205, 251, 250], [154, 246, 246], [102, 239, 245], [53, 226, 239], [29, 210, 228], [20, 183, 206], [14, 156, 180], [11, 130, 156], [9, 112, 138], [6, 81, 104],
  // cyan - row 7 (indices 77-87)
  [237, 254, 255], [206, 251, 254], [164, 247, 254], [113, 240, 254], [56, 228, 254], [30, 214, 248], [22, 189, 225], [16, 164, 200], [13, 140, 176], [10, 121, 157], [8, 94, 128],
  // sky - row 8 (indices 88-98)
  [241, 251, 255], [226, 244, 255], [188, 232, 255], [138, 218, 255], [89, 199, 255], [60, 182, 254], [42, 157, 230], [28, 133, 202], [19, 113, 177], [14, 97, 156], [9, 73, 122],
  // blue - row 9 (indices 99-109)
  [239, 246, 255], [222, 235, 255], [192, 219, 255], [151, 199, 255], [109, 173, 255], [81, 151, 255], [62, 130, 247], [50, 112, 223], [40, 92, 191], [33, 77, 166], [22, 53, 123],
  // indigo - row 10 (indices 110-120)
  [239, 243, 255], [225, 231, 255], [200, 211, 255], [166, 184, 255], [128, 152, 255], [103, 127, 254], [84, 106, 240], [72, 90, 216], [60, 73, 187], [50, 61, 163], [32, 38, 118],
  // violet - row 11 (indices 121-131)
  [246, 245, 255], [238, 235, 254], [224, 218, 254], [199, 193, 255], [170, 159, 255], [146, 131, 254], [129, 110, 246], [115, 94, 228], [99, 78, 204], [85, 63, 179], [61, 41, 139],
  // purple - row 12 (indices 132-142)
  [251, 245, 255], [245, 234, 255], [233, 218, 255], [215, 195, 255], [188, 164, 254], [167, 139, 250], [150, 118, 241], [133, 98, 224], [116, 79, 202], [100, 62, 179], [72, 40, 142],
  // fuchsia - row 13 (indices 143-153)
  [253, 244, 255], [250, 232, 255], [243, 216, 255], [232, 193, 254], [217, 162, 254], [205, 138, 254], [192, 117, 248], [175, 96, 231], [155, 75, 207], [136, 56, 183], [105, 36, 146],
  // rose - row 14 (indices 154-164)
  [254, 242, 249], [252, 231, 243], [251, 213, 235], [250, 189, 225], [246, 156, 211], [244, 133, 201], [238, 112, 189], [224, 88, 171], [204, 66, 151], [183, 46, 131], [142, 24, 100],
  // pink - row 15 (indices 165-175)
  [255, 242, 246], [255, 228, 236], [254, 208, 224], [252, 182, 209], [249, 147, 189], [246, 122, 175], [239, 101, 162], [222, 78, 143], [197, 56, 121], [176, 37, 104], [134, 19, 77],
  // gray - row 16 (indices 176-186)
  [252, 252, 253], [248, 249, 251], [241, 243, 247], [227, 231, 239], [187, 193, 209], [146, 153, 178], [115, 123, 151], [93, 102, 133], [68, 76, 107], [50, 58, 87], [30, 36, 65],
  // zinc - row 17 (indices 187-197)
  [252, 252, 253], [249, 249, 251], [240, 240, 245], [228, 228, 235], [187, 188, 201], [146, 147, 166], [113, 114, 137], [92, 93, 118], [66, 67, 91], [49, 50, 70], [33, 34, 51],
  // neutral - row 18 (indices 198-208)
  [252, 252, 253], [250, 250, 250], [241, 241, 241], [229, 229, 229], [189, 189, 189], [148, 148, 148], [113, 113, 113], [93, 93, 93], [66, 66, 66], [49, 49, 49], [35, 35, 35],
  // stone - row 19 (indices 209-219)
  [252, 252, 251], [250, 250, 249], [241, 241, 239], [229, 229, 226], [189, 189, 185], [148, 148, 143], [115, 115, 109], [94, 94, 88], [66, 66, 61], [52, 52, 47], [35, 35, 31],

  // === CLASSIC 8-BIT COMPUTER COLORS ===

  // Sinclair Spectrum 48k - row 20 (indices 220-232)
  [1, 0, 206], [207, 1, 0], [207, 1, 206], [0, 207, 21], [1, 207, 207], [207, 207, 21], [207, 207, 207], [2, 0, 253], [255, 2, 1], [255, 2, 253], [0, 255, 28], [2, 255, 255], [255, 255, 29],

  // BBC Micro - row 21 (indices 233-238)
  [255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0], [0, 255, 255], [255, 0, 255],

  // Commodore 64 - row 22 (indices 239-252)
  [136, 0, 0], [170, 255, 238], [204, 68, 204], [0, 204, 85], [0, 0, 170], [238, 238, 119], [221, 136, 85], [102, 68, 0], [255, 119, 119], [51, 51, 51], [119, 119, 119], [170, 255, 102], [0, 136, 255], [187, 187, 187],

  // black/white - row 23 (indices 253-255)
  [0, 0, 0], [0, 0, 0], [255, 255, 255]
] as const;

/**
 * Helper function to convert an RGB color to a CSS string
 */
export function rgbToString(color: RGBColor): string {
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

/**
 * Helper function to generate WGSL shader code for the palette array
 * Used by the WebGPU renderer
 */
export function generateWGSLPaletteArray(): string {
  const lines: string[] = ['const PALETTE: array<vec3f, 256> = array<vec3f, 256>('];

  // Group colors by rows for readability
  const rowInfo = [
    { name: 'red', start: 0, count: 11 },
    { name: 'orange', start: 11, count: 11 },
    { name: 'yellow', start: 22, count: 11 },
    { name: 'lime', start: 33, count: 11 },
    { name: 'green', start: 44, count: 11 },
    { name: 'emerald', start: 55, count: 11 },
    { name: 'teal', start: 66, count: 11 },
    { name: 'cyan', start: 77, count: 11 },
    { name: 'sky', start: 88, count: 11 },
    { name: 'blue', start: 99, count: 11 },
    { name: 'indigo', start: 110, count: 11 },
    { name: 'violet', start: 121, count: 11 },
    { name: 'purple', start: 132, count: 11 },
    { name: 'fuchsia', start: 143, count: 11 },
    { name: 'rose', start: 154, count: 11 },
    { name: 'pink', start: 165, count: 11 },
    { name: 'gray', start: 176, count: 11 },
    { name: 'zinc', start: 187, count: 11 },
    { name: 'neutral', start: 198, count: 11 },
    { name: 'stone', start: 209, count: 11 },
    { name: 'Spectrum', start: 220, count: 13 },
    { name: 'BBC Micro', start: 233, count: 6 },
    { name: 'C64', start: 239, count: 14 },
    { name: 'black/white', start: 253, count: 3 }
  ];

  for (let rowIndex = 0; rowIndex < rowInfo.length; rowIndex++) {
    const { name, start, count } = rowInfo[rowIndex];
    const rowColors = [];

    for (let i = start; i < start + count; i++) {
      const [r, g, b] = SYSTEM_PALETTE[i];
      rowColors.push(`vec3f(${r}, ${g}, ${b})`);
    }

    lines.push(`  // ${name}`);
    if (rowIndex === rowInfo.length - 1) {
      // Last row - no comma
      lines.push(`  ${rowColors.join(', ')}`);
    } else {
      lines.push(`  ${rowColors.join(', ')},`);
    }
  }

  lines.push(');');

  return lines.join('\n');
}

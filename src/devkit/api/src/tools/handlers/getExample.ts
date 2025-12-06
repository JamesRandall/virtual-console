import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to examples
const EXAMPLES_DIR = join(__dirname, '..', '..', '..', '..', '..', 'examples', 'assembly');

// Example metadata
export const EXAMPLES = [
  {
    name: 'drawLines',
    filename: 'drawLines.asm',
    description: 'Bresenham line drawing with proper signed arithmetic handling',
    demonstrates: ['Bresenham algorithm', '16-bit signed math', 'plot_pixel subroutine', 'carry/borrow propagation'],
    use_for: ['Line drawing', 'Drawing triangles/polygons', 'Reference for signed comparisons']
  },
  {
    name: 'smiley2',
    filename: 'smiley2.asm',
    description: 'Drawing a smiley face with basic graphics primitives',
    demonstrates: ['Basic pixel plotting', 'Palette setup', 'Simple circle drawing', 'Screen initialization'],
    use_for: ['Basic graphics setup', 'Simple shape drawing', 'Palette configuration']
  },
  {
    name: 'drawPixel',
    filename: 'drawPixel.asm',
    description: 'Optimized pixel plotting subroutine for 4bpp mode',
    demonstrates: ['Framebuffer address calculation', 'Nibble packing', '16-bit math with shifts'],
    use_for: ['Pixel plotting', 'Understanding framebuffer layout', 'Address calculation patterns']
  },
  {
    name: 'starfield',
    filename: 'animatedStarfieldWithVblank.asm',
    description: 'Animated starfield using VBlank interrupts',
    demonstrates: ['VBlank interrupt setup', 'Animation loops', 'Interrupt handlers', 'Frame timing'],
    use_for: ['Animation', 'VBlank interrupts', 'Smooth movement', 'Frame synchronization']
  },
  {
    name: 'controllerSquare',
    filename: 'controllerMovingSquare.asm',
    description: 'Interactive square controlled by gamepad D-pad with movement and erase logic',
    demonstrates: ['Controller input reading', 'VBlank interrupts', 'Sprite movement', 'Boundary checking', 'Position tracking', 'Fill/erase squares'],
    use_for: ['Controller input', 'Interactive graphics', 'Player movement', 'Simple game mechanics', 'Sprite position management']
  },
  {
    name: 'gameOfLife',
    filename: 'gameOfLifeOptimised.asm',
    description: 'Optimized Conway\'s Game of Life - only redraws changed cells for performance',
    demonstrates: ['Cellular automaton', 'Double buffering grids', 'Neighbor counting', 'Change tracking', 'Optimized rendering', 'Game state management'],
    use_for: ['Complex game logic', 'Grid-based games', 'Performance optimization', 'State tracking', 'Efficient redraw patterns']
  },
  {
    name: 'spaceInvaderOptimised',
    filename: 'drawSpaceInvaderOptimised.asm',
    description: 'Optimized 8x8 bitmap drawing with inlined pixel plotting to avoid CALL overhead',
    demonstrates: ['Bitmap rendering', 'Inline optimization', 'Pixel plotting', 'Performance optimization', '16-bit address arithmetic', 'Nibble packing'],
    use_for: ['Sprite drawing', 'Performance-critical graphics', 'Understanding inline optimization', 'Bitmap data structures']
  },
  {
    name: 'drawDigits',
    filename: 'drawDigits.asm',
    description: 'Drawing numeric digits 0-9 using bitmap lookup table with pointer arithmetic',
    demonstrates: ['Digit rendering', 'Lookup tables', 'Pointer arithmetic', 'Bitmap arrays', '16-bit address calculation', 'Reusable subroutines'],
    use_for: ['Score display', 'Text rendering', 'Number display', 'UI elements', 'Learning pointer arithmetic']
  },
  {
    name: 'pong',
    filename: 'pong.asm',
    description: 'Complete Pong game with player vs AI, score tracking, and physics-based paddle collisions',
    demonstrates: ['Game loop architecture', 'AI opponent logic', 'Collision detection', 'Score tracking', 'XOR sprite drawing', 'VBlank interrupts', 'Controller input', 'Ball physics', 'Paddle bounce angles', 'State management'],
    use_for: ['Complete game reference', 'AI implementation', 'Game physics', 'Collision systems', 'Score display', 'Two-player games', 'Learning game architecture']
  },
  {
    name: 'simpleSprite',
    filename: 'simpleSprite.asm',
    description: 'Hardware sprite demonstration with 6 sprites moving in different directions using VBlank interrupts',
    demonstrates: ['Hardware sprite setup', 'Sprite attribute configuration', 'VBlank interrupt animation', 'Multiple sprite movement', 'Scanline palette mapping', 'Cartridge bank references'],
    use_for: ['Hardware sprites', 'Sprite animation', 'VBlank-driven movement', 'Palette block switching', 'Learning sprite system']
  }
];

/**
 * Handle get_example tool
 */
export function handleGetExample(parameters: Record<string, unknown>): unknown {
  const name = parameters.name as string | undefined;

  // If no name provided, return list of examples
  if (!name) {
    return {
      examples: EXAMPLES.map(ex => ({
        name: ex.name,
        description: ex.description,
        demonstrates: ex.demonstrates,
        use_for: ex.use_for
      }))
    };
  }

  // Find the requested example
  const example = EXAMPLES.find(ex => ex.name === name);
  if (!example) {
    const availableNames = EXAMPLES.map(ex => ex.name).join(', ');
    return {
      error: `Example '${name}' not found. Available examples: ${availableNames}`
    };
  }

  // Load the example code
  try {
    const filePath = join(EXAMPLES_DIR, example.filename);
    const code = readFileSync(filePath, 'utf-8');

    return {
      name: example.name,
      description: example.description,
      demonstrates: example.demonstrates,
      use_for: example.use_for,
      code: code,
      lines: code.split('\n').length
    };
  } catch (error) {
    return {
      error: `Failed to load example '${name}': ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

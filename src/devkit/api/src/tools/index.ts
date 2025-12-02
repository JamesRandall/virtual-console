import type { Socket } from 'socket.io';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { AIProvider } from '../ai/providers/interface.js';
import { loadHardwareCheatsheet } from '../ai/systemPrompts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to examples
const EXAMPLES_DIR = join(__dirname, '..', '..', '..', '..', 'examples', 'assembly');

// Tool response registry - stores pending tool requests
const pendingToolRequests = new Map<string, {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}>();

const TOOL_TIMEOUT_MS = 30000; // 30 second timeout

// Example metadata
const EXAMPLES = [
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
  }
];

/**
 * Execute a tool request by sending it to the browser and waiting for response
 */
export async function executeToolRequest(
  socket: Socket,
  id: string,
  toolName: string,
  parameters: Record<string, unknown>
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    // Set up timeout
    const timeout = setTimeout(() => {
      pendingToolRequests.delete(id);
      reject(new Error(`Tool execution timeout: ${toolName}`));
    }, TOOL_TIMEOUT_MS);

    // Store resolver
    pendingToolRequests.set(id, { resolve, reject, timeout });

    // Send tool request to browser
    socket.emit('tool_request', {
      id,
      tool: toolName,
      parameters
    });
  });
}

/**
 * Register a tool response from the browser
 */
export function registerToolResponse(id: string, result: unknown, error?: string): void {
  const pending = pendingToolRequests.get(id);

  if (!pending) {
    console.warn(`Received tool response for unknown request: ${id}`);
    return;
  }

  // Log assembly results for debugging
  const typedResult = result as any;
  if (typedResult && typeof typedResult === 'object' && 'success' in typedResult) {
    if (typedResult.success === false && typedResult.errors) {
      console.log('🔴 Assembly FAILED with errors:', JSON.stringify(typedResult.errors, null, 2));
    } else if (typedResult.success === true && typedResult.programCounter !== undefined) {
      console.log('✅ Assembly succeeded, PC:', typedResult.programCounter);
    }
  }

  // Log screen capture results
  if (typedResult && typedResult.success && typedResult.image) {
    console.log('📸 Screen capture received:',
      typedResult.width, 'x', typedResult.height,
      'PC:', typedResult.capturedAt?.programCounter?.toString(16),
      'image data length:', typedResult.image.length
    );
  }

  // Clear timeout
  clearTimeout(pending.timeout);
  pendingToolRequests.delete(id);

  // Resolve or reject
  if (error) {
    pending.reject(new Error(error));
  } else {
    pending.resolve(result);
  }
}

// Server-side tools list
const serverSideTools = ['get_example', 'generate_assembly_code'];

/**
 * Execute a server-side tool (doesn't need browser)
 */
export async function executeServerSideTool(
  toolName: string,
  parameters: Record<string, unknown>,
  provider?: AIProvider
): Promise<unknown> {
  switch (toolName) {
    case 'get_example':
      return handleGetExample(parameters);
    case 'generate_assembly_code':
      return handleGenerateAssemblyCode(parameters, provider);
    default:
      throw new Error(`Unknown server-side tool: ${toolName}`);
  }
}

/**
 * Check if a tool is handled server-side
 */
export function isServerSideTool(toolName: string): boolean {
  return serverSideTools.includes(toolName);
}

/**
 * Handle get_example tool
 */
function handleGetExample(parameters: Record<string, unknown>): unknown {
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

/**
 * Handle generate_assembly_code tool - uses grammar-constrained generation
 */
async function handleGenerateAssemblyCode(
  parameters: Record<string, unknown>,
  provider?: AIProvider
): Promise<{ code: string } | { error: string }> {
  // Check if provider supports grammar-constrained generation
  if (!provider?.generateWithGrammar) {
    return {
      error: 'Grammar-constrained generation is not available. This feature requires the llama.cpp provider.'
    };
  }

  const task = parameters.task as string;
  const context = parameters.context as string | undefined;
  const existingCode = parameters.existing_code as string | undefined;

  if (!task) {
    return { error: 'Task description is required' };
  }

  // Load the GBNF grammar
  let grammar: string;
  try {
    const grammarPath = join(__dirname, '..', 'ai', 'grammars', 'vc-asm.gbnf');
    grammar = readFileSync(grammarPath, 'utf-8');
  } catch (error) {
    return {
      error: `Failed to load grammar file: ${error instanceof Error ? error.message : String(error)}`
    };
  }

  // Build the code generation prompt
  const prompt = buildCodeGenerationPrompt(task, context, existingCode);

  try {
    const code = await provider.generateWithGrammar(prompt, grammar);
    return { code };
  } catch (error) {
    return {
      error: `Code generation failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Build a prompt for grammar-constrained code generation.
 * This includes the FULL hardware specification for accurate code generation.
 */
function buildCodeGenerationPrompt(
  task: string,
  context?: string,
  existingCode?: string
): string {
  // Load the full hardware cheatsheet
  const hardwareSpec = loadHardwareCheatsheet();

  let prompt = `You are a vc-asm assembly code generator for a custom 8-bit virtual console.

## Complete Hardware Specification

${hardwareSpec}

## Task
${task}
`;

  if (context) {
    prompt += `\n## Context\n${context}\n`;
  }

  if (existingCode) {
    prompt += `\n## Existing Code to Modify/Extend\n\`\`\`asm\n${existingCode}\n\`\`\`\n`;
  }

  prompt += `\n## Output
Generate only valid vc-asm assembly code. Include comments to explain the code.

`;

  return prompt;
}

/**
 * Get tool definitions for Claude API
 */
export function getToolDefinitions() {
  return [
    {
      name: 'get_example',
      description: 'Get reference assembly code examples. Call with no parameters to list all available examples with descriptions. Call with a specific example name to get the full source code. CRITICAL: ALWAYS check examples BEFORE implementing complex algorithms like Bresenham line drawing! The examples are tested, working implementations with proper signed arithmetic. DO NOT rewrite algorithms from scratch when an example exists.',
      input_schema: {
        type: 'object' as const,
        properties: {
          name: {
            type: 'string' as const,
            description: 'Example name to fetch. Omit this parameter to list all available examples.',
            enum: EXAMPLES.map(ex => ex.name)
          }
        },
        required: []
      }
    },
    {
      name: 'read_source_code',
      description: 'Reads the current assembly source code from the editor, including cursor position and any text selection. Use this to understand what code the user is working on.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: []
      }
    },
    {
      name: 'update_source_code',
      description: 'Updates the assembly source code in the editor. This replaces the entire content. Optionally positions the cursor at a specific location.',
      input_schema: {
        type: 'object' as const,
        properties: {
          code: {
            type: 'string' as const,
            description: 'The complete new source code to write to the editor'
          },
          cursorLine: {
            type: 'number' as const,
            description: 'Optional line number to position cursor (1-based)'
          },
          cursorColumn: {
            type: 'number' as const,
            description: 'Optional column number to position cursor (1-based)'
          }
        },
        required: ['code']
      }
    },
    {
      name: 'read_cpu_state',
      description: 'Reads the current CPU state including all registers (R0-R5), stack pointer, program counter, status flags, and cycle count. IMPORTANT: The CPU must be paused (use pause_debugger) before reading CPU state, otherwise values will change rapidly as the program executes.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: []
      }
    },
    {
      name: 'read_memory',
      description: 'Reads a range of memory bytes from the virtual console. Memory addresses range from 0x0000 to 0xFFFF (64KB total). IMPORTANT: The CPU must be paused (use pause_debugger) before reading memory, otherwise values may change as the program executes.',
      input_schema: {
        type: 'object' as const,
        properties: {
          address: {
            type: 'number' as const,
            description: 'Starting memory address to read from (0x0000-0xFFFF). Can be a number or hex string like "0xA000"'
          },
          length: {
            type: 'number' as const,
            description: 'Number of bytes to read (1-256 recommended for readability). Can be a number or hex string'
          }
        },
        required: ['address', 'length']
      }
    },
    {
      name: 'set_breakpoint',
      description: 'Sets or clears a breakpoint at a specific source code line number. The debugger will pause execution when it reaches this line.',
      input_schema: {
        type: 'object' as const,
        properties: {
          line: {
            type: 'number' as const,
            description: 'Source code line number (1-based)'
          },
          enabled: {
            type: 'boolean' as const,
            description: 'true to set the breakpoint, false to clear it'
          }
        },
        required: ['line', 'enabled']
      }
    },
    {
      name: 'step_debugger',
      description: 'Executes a single CPU instruction and then pauses. Use this to step through code one instruction at a time for debugging.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: []
      }
    },
    {
      name: 'run_debugger',
      description: 'Starts continuous CPU execution from the current program counter. The CPU will run until a breakpoint is hit or the user manually pauses. After assembling code, just run - do NOT reset first as assembly already set the PC correctly.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: []
      }
    },
    {
      name: 'pause_debugger',
      description: 'Pauses CPU execution. Use this to stop a running program.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: []
      }
    },
    {
      name: 'reset_console',
      description: 'Resets the virtual console CPU to its initial state. This clears registers, resets PC to 0, and initializes the stack pointer. WARNING: This resets PC to 0, so do NOT use after assembling code! Assembly already sets PC correctly.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: []
      }
    },
    {
      name: 'assemble_code',
      description: 'Assembles the current source code and loads it into memory. This sets the program counter to the correct start address automatically. CRITICAL: You MUST check the "success" field in the response! Returns { success: true, programCounter: number } on success (note the PC value for reference). Returns { success: false, errors: [{line: number, column?: number, message: string}] } if assembly fails. If success is false, you MUST fix all errors and reassemble - DO NOT attempt to run the code. After successful assembly, you can run_debugger immediately - do NOT reset!',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: []
      }
    },
    {
      name: 'capture_screen',
      description: 'Captures the current display output as a PNG image for visual inspection. Use this AFTER running graphics code to verify visual output, debug rendering issues, or check sprite/text positioning. IMPORTANT: Only use when you need to SEE the visual result - not for every operation. The CPU should be paused (use pause_debugger) before capture to get a stable image. Returns { success: true, image: "<base64 PNG>", width: number, height: number, capturedAt: { programCounter, cycleCount, timestamp } } on success.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: []
      }
    },
    {
      name: 'generate_assembly_code',
      description: 'Generate vc-asm assembly code using grammar-constrained generation. Use this tool when you need to write new assembly code or make significant modifications to existing code. The output is guaranteed to be syntactically valid vc-asm. NOTE: This tool requires the llama.cpp provider to be configured.',
      input_schema: {
        type: 'object' as const,
        properties: {
          task: {
            type: 'string' as const,
            description: 'Description of what the assembly code should accomplish'
          },
          context: {
            type: 'string' as const,
            description: 'Existing code, memory layout constraints, or other relevant context'
          },
          existing_code: {
            type: 'string' as const,
            description: 'Current code to modify or extend (if applicable)'
          }
        },
        required: ['task']
      }
    },
    {
      name: 'list_project_files',
      description: 'Lists all files and folders in the current project. Use this to explore the project structure and find files. Returns a tree structure showing all directories and files. Call with no path to list from project root, or provide a path to list a specific subdirectory.',
      input_schema: {
        type: 'object' as const,
        properties: {
          path: {
            type: 'string' as const,
            description: 'Optional subdirectory path to list (e.g., "src" or "sprites"). Omit to list from project root.'
          }
        },
        required: []
      }
    },
    {
      name: 'read_project_file',
      description: 'Reads the contents of a file from the project. Use this to read .include files, sprite data, or any other project file. For assembly files referenced with .include directive, use the path as it appears in the directive (e.g., if code has .include "loop.asm", read "src/loop.asm").',
      input_schema: {
        type: 'object' as const,
        properties: {
          path: {
            type: 'string' as const,
            description: 'Path to the file relative to project root (e.g., "src/loop.asm", "sprites/player.gbin", "config.json")'
          }
        },
        required: ['path']
      }
    }
  ];
}

import { EXAMPLES } from './getExample.js';

/**
 * Get tool definitions for AI providers
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

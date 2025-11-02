import type { Socket } from 'socket.io';

// Tool response registry - stores pending tool requests
const pendingToolRequests = new Map<string, {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}>();

const TOOL_TIMEOUT_MS = 30000; // 30 second timeout

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
    } else if (typedResult.success === true) {
      console.log('✅ Assembly succeeded, PC:', typedResult.programCounter);
    }
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

/**
 * Get tool definitions for Claude API
 */
export function getToolDefinitions() {
  return [
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
            description: 'Starting memory address to read from (0x0000-0xFFFF)'
          },
          length: {
            type: 'number' as const,
            description: 'Number of bytes to read (1-256 recommended for readability)'
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
      description: 'Starts continuous CPU execution. The CPU will run until a breakpoint is hit or the user manually pauses.',
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
      description: 'Resets the virtual console CPU to its initial state. This clears registers, resets PC to 0, and initializes the stack pointer.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: []
      }
    },
    {
      name: 'assemble_code',
      description: 'Assembles the current source code and loads it into memory. This must be done before running any code. CRITICAL: You MUST check the "success" field in the response! Returns { success: true, programCounter: number } on success. Returns { success: false, errors: [{line: number, column?: number, message: string}] } if assembly fails. If success is false, you MUST fix all errors and reassemble - DO NOT attempt to run the code. Each error includes the line number, optional column, and a message describing what is wrong.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: []
      }
    }
  ];
}

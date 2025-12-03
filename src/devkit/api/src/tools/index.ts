import type { Socket } from 'socket.io';
import type { AIProvider } from '../ai/providers/interface.js';
import {
  handleGetExample,
  handleGenerateAssemblyCode,
  getToolDefinitions,
} from './handlers/index.js';

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

// Re-export tool definitions
export { getToolDefinitions };

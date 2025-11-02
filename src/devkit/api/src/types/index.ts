// WebSocket message types
export type WebSocketMessageType =
  | 'chat_message'
  | 'ai_response_start'
  | 'ai_response_chunk'
  | 'ai_response_done'
  | 'ai_thinking'
  | 'tool_request'
  | 'tool_response'
  | 'error'
  | 'new_chat';

export interface WebSocketMessage {
  type: WebSocketMessageType;
  payload?: unknown;
}

// Chat message types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// Tool types
export interface ToolRequest {
  id: string;
  tool: string;
  parameters: Record<string, unknown>;
}

export interface ToolResponse {
  id: string;
  result: unknown;
  error?: string;
}

// CPU State
export interface CpuSnapshot {
  registers: number[];  // R0-R5
  stackPointer: number;
  programCounter: number;
  statusRegister: number;
  cycleCount: number;
}

// Source code
export interface SourceCodeInfo {
  code: string;
  cursorLine?: number;
  cursorColumn?: number;
  selection?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
}

// Memory read result
export interface MemoryReadResult {
  address: number;
  data: number[];
}

// Tool result types
export type ToolResult =
  | SourceCodeInfo
  | CpuSnapshot
  | MemoryReadResult
  | { success: boolean; message?: string }
  | null;

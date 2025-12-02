import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';

/**
 * Common interface for AI providers (Anthropic, Bedrock, etc.)
 */
export interface AIProvider {
  /**
   * Stream a chat completion with tool support
   */
  streamChat(params: StreamChatParams): AsyncIterable<StreamEvent>;

  /**
   * Optional: Generate text with grammar constraint (e.g., GBNF for llama.cpp)
   * Used for code generation that must be syntactically valid
   */
  generateWithGrammar?(prompt: string, grammar: string): Promise<string>;
}

export interface StreamChatParams {
  system: string;
  messages: MessageParam[];
  tools: ToolDefinition[];
  maxTokens: number;
  temperature: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

export type StreamEvent =
  | { type: 'content_block_start'; contentBlock: { type: 'text' } | { type: 'tool_use'; id: string; name: string } }
  | { type: 'content_block_delta'; delta: { type: 'text_delta'; text: string } | { type: 'input_json_delta'; partial_json: string } }
  | { type: 'content_block_stop' }
  | { type: 'message_delta'; delta: { stop_reason?: 'end_turn' | 'tool_use' | 'max_tokens' } }
  | { type: 'message_stop' };

export interface ToolUseBlock {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

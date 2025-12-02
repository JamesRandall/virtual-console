import type { AIProvider, StreamChatParams, StreamEvent, ToolDefinition } from './interface.js';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';

interface LlamaCppCompletionResponse {
  content: string;
  stop: boolean;
  generation_settings?: {
    n_predict: number;
    temperature: number;
  };
}

interface LlamaCppChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
}

export class LlamaCppProvider implements AIProvider {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Stream a chat completion using llama.cpp's OpenAI-compatible endpoint
   */
  async *streamChat(params: StreamChatParams): AsyncIterable<StreamEvent> {
    // Convert messages to OpenAI format
    const messages = this.convertMessages(params.system, params.messages);

    // Convert tools to OpenAI format
    const tools = this.convertTools(params.tools);

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        tools: tools.length > 0 ? tools : undefined,
        max_tokens: params.maxTokens,
        temperature: params.temperature,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`llama.cpp request failed: ${response.status} ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body from llama.cpp');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentToolId: string | null = null;
    let currentToolName: string | null = null;
    let toolArgumentsBuffer = '';
    let isInToolCall = false;
    let hasStartedText = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            yield { type: 'message_stop' };
            continue;
          }

          try {
            const chunk: LlamaCppChatCompletionChunk = JSON.parse(data);
            const choice = chunk.choices[0];
            if (!choice) continue;

            const delta = choice.delta;

            // Handle tool calls
            if (delta.tool_calls && delta.tool_calls.length > 0) {
              for (const toolCall of delta.tool_calls) {
                // New tool call starting
                if (toolCall.id && toolCall.function?.name) {
                  if (isInToolCall) {
                    // Finish previous tool call
                    yield { type: 'content_block_stop' };
                  }
                  currentToolId = toolCall.id;
                  currentToolName = toolCall.function.name;
                  toolArgumentsBuffer = '';
                  isInToolCall = true;

                  yield {
                    type: 'content_block_start',
                    contentBlock: {
                      type: 'tool_use',
                      id: currentToolId,
                      name: currentToolName,
                    },
                  };
                }

                // Tool arguments streaming
                if (toolCall.function?.arguments) {
                  toolArgumentsBuffer += toolCall.function.arguments;
                  yield {
                    type: 'content_block_delta',
                    delta: {
                      type: 'input_json_delta',
                      partial_json: toolArgumentsBuffer,
                    },
                  };
                }
              }
            }

            // Handle text content
            if (delta.content) {
              if (!hasStartedText) {
                yield { type: 'content_block_start', contentBlock: { type: 'text' } };
                hasStartedText = true;
              }
              yield {
                type: 'content_block_delta',
                delta: { type: 'text_delta', text: delta.content },
              };
            }

            // Handle finish reason
            if (choice.finish_reason) {
              if (isInToolCall) {
                yield { type: 'content_block_stop' };
                isInToolCall = false;
              }
              if (hasStartedText) {
                yield { type: 'content_block_stop' };
                hasStartedText = false;
              }

              const stopReason = choice.finish_reason === 'tool_calls'
                ? 'tool_use'
                : choice.finish_reason === 'stop'
                  ? 'end_turn'
                  : 'end_turn';

              yield {
                type: 'message_delta',
                delta: { stop_reason: stopReason as 'end_turn' | 'tool_use' | 'max_tokens' },
              };
            }
          } catch {
            // Skip invalid JSON lines
            continue;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Generate text with GBNF grammar constraint
   * Used for code generation that must be syntactically valid
   */
  async generateWithGrammar(prompt: string, grammar: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        n_predict: 4096,
        grammar,
        temperature: 0.7,
        stop: ['\n\n\n'], // Stop on multiple newlines
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`llama.cpp grammar generation failed: ${response.status} ${errorText}`);
    }

    const result = await response.json() as LlamaCppCompletionResponse;
    return result.content;
  }

  /**
   * Convert Anthropic-style messages to OpenAI format for llama.cpp
   */
  private convertMessages(system: string, messages: MessageParam[]): Array<{ role: string; content: string }> {
    const result: Array<{ role: string; content: string }> = [];

    // Add system message
    if (system) {
      result.push({ role: 'system', content: system });
    }

    // Convert each message
    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        result.push({
          role: msg.role,
          content: msg.content,
        });
      } else if (Array.isArray(msg.content)) {
        // Handle structured content (text blocks, tool results, etc.)
        const textParts: string[] = [];

        for (const block of msg.content) {
          if (typeof block === 'object' && block !== null) {
            if ('type' in block && block.type === 'text' && 'text' in block) {
              textParts.push(block.text as string);
            } else if ('type' in block && block.type === 'tool_result' && 'content' in block) {
              // Handle tool results
              textParts.push(`[Tool Result: ${block.content}]`);
            } else if ('type' in block && block.type === 'tool_use') {
              // Handle tool use blocks in assistant messages
              const toolBlock = block as { name?: string; input?: unknown };
              textParts.push(`[Using tool: ${toolBlock.name}(${JSON.stringify(toolBlock.input)})]`);
            }
          }
        }

        if (textParts.length > 0) {
          result.push({
            role: msg.role,
            content: textParts.join('\n'),
          });
        }
      }
    }

    return result;
  }

  /**
   * Convert tool definitions to OpenAI function format for llama.cpp
   */
  private convertTools(tools: ToolDefinition[]): Array<{
    type: string;
    function: {
      name: string;
      description: string;
      parameters: {
        type: string;
        properties: Record<string, unknown>;
        required: string[];
      };
    };
  }> {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: tool.input_schema.properties,
          required: tool.input_schema.required,
        },
      },
    }));
  }
}

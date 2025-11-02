import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
  type Message as BedrockMessage,
  type Tool as BedrockTool,
  type ContentBlock,
} from '@aws-sdk/client-bedrock-runtime';
import type { AIProvider, StreamChatParams, StreamEvent, ToolDefinition } from './interface.js';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';

export class BedrockProvider implements AIProvider {
  private client: BedrockRuntimeClient;
  private modelId: string;
  private maxRetries: number;
  private baseDelayMs: number;

  constructor(
    region: string,
    modelId: string,
    maxRetries: number = 5,
    baseDelayMs: number = 1000
  ) {
    this.client = new BedrockRuntimeClient({ region });
    this.modelId = modelId;
    this.maxRetries = maxRetries;
    this.baseDelayMs = baseDelayMs;
  }

  async *streamChat(params: StreamChatParams): AsyncIterable<StreamEvent> {
    // Convert messages to Bedrock format
    const bedrockMessages = this.convertMessages(params.messages);

    // Convert tools to Bedrock format
    const bedrockTools = this.convertTools(params.tools);

    // Debug logging
    console.log(`📤 Bedrock request with ${bedrockMessages.length} messages`);
    bedrockMessages.forEach((msg, i) => {
      console.log(`  Message ${i}: ${msg.role}, ${msg.content?.length ?? 0} content blocks`);
    });

    const command = new ConverseStreamCommand({
      modelId: this.modelId,
      messages: bedrockMessages,
      system: [{ text: params.system }],
      inferenceConfig: {
        maxTokens: params.maxTokens,
        temperature: params.temperature,
      },
      toolConfig: bedrockTools.length > 0 ? {
        tools: bedrockTools
      } : undefined,
    });

    // Execute with retry policy for throttling
    const response = await this.executeWithRetry(command);

    if (!response.stream) {
      throw new Error('No stream returned from Bedrock');
    }

    let currentToolUse: { id: string; name: string; input: string } | null = null;

    for await (const event of response.stream) {
      if (event.contentBlockStart) {
        if (event.contentBlockStart.start?.toolUse) {
          const toolUse = event.contentBlockStart.start.toolUse;
          currentToolUse = {
            id: toolUse.toolUseId || '',
            name: toolUse.name || '',
            input: ''
          };
          yield {
            type: 'content_block_start',
            contentBlock: {
              type: 'tool_use',
              id: currentToolUse.id,
              name: currentToolUse.name,
            }
          };
        } else {
          yield { type: 'content_block_start', contentBlock: { type: 'text' } };
        }
      } else if (event.contentBlockDelta) {
        if (event.contentBlockDelta.delta?.text) {
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: event.contentBlockDelta.delta.text }
          };
        } else if (event.contentBlockDelta.delta?.toolUse) {
          const input = event.contentBlockDelta.delta.toolUse.input || '';
          if (currentToolUse) {
            currentToolUse.input += input;
            yield {
              type: 'content_block_delta',
              delta: { type: 'input_json_delta', partial_json: currentToolUse.input }
            };
          }
        }
      } else if (event.contentBlockStop) {
        currentToolUse = null;
        yield { type: 'content_block_stop' };
      } else if (event.messageStop) {
        const stopReason = event.messageStop.stopReason;
        let mappedReason: 'end_turn' | 'tool_use' | 'max_tokens' | undefined;

        if (stopReason === 'end_turn') mappedReason = 'end_turn';
        else if (stopReason === 'tool_use') mappedReason = 'tool_use';
        else if (stopReason === 'max_tokens') mappedReason = 'max_tokens';

        if (mappedReason) {
          yield { type: 'message_delta', delta: { stop_reason: mappedReason } };
        }
        yield { type: 'message_stop' };
      }
    }
  }

  private async executeWithRetry(command: ConverseStreamCommand): Promise<any> {
    let lastError: any;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.client.send(command);
      } catch (error: any) {
        lastError = error;

        // Check if it's a throttling error
        const isThrottling =
          error.$metadata?.httpStatusCode === 429 ||
          error.name === 'ThrottlingException' ||
          error.name === 'TooManyRequestsException';

        if (!isThrottling) {
          // Not a throttling error, throw immediately
          throw error;
        }

        if (attempt === this.maxRetries) {
          // No more retries left
          console.error(`❌ Bedrock throttling: Max retries (${this.maxRetries}) exceeded`);
          throw error;
        }

        // Calculate delay with exponential backoff
        const delayMs = this.baseDelayMs * Math.pow(2, attempt);
        console.warn(`⚠️  Bedrock throttled (429), retrying in ${delayMs}ms... (attempt ${attempt + 1}/${this.maxRetries})`);

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    throw lastError;
  }

  private convertMessages(messages: MessageParam[]): BedrockMessage[] {
    return messages.map(msg => {
      const content: ContentBlock[] = [];

      if (typeof msg.content === 'string') {
        content.push({ text: msg.content });
      } else if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          const typedBlock = block as any;

          if (typedBlock.type === 'text' && typedBlock.text) {
            content.push({ text: typedBlock.text });
          } else if (typedBlock.type === 'tool_use') {
            content.push({
              toolUse: {
                toolUseId: typedBlock.id,
                name: typedBlock.name,
                input: typedBlock.input,
              }
            });
          } else if (typedBlock.type === 'tool_result') {
            // Parse the content if it's a string
            let resultContent = typedBlock.content;
            if (typeof resultContent === 'string') {
              content.push({
                toolResult: {
                  toolUseId: typedBlock.tool_use_id,
                  content: [{ text: resultContent }],
                }
              });
            } else if (Array.isArray(resultContent)) {
              content.push({
                toolResult: {
                  toolUseId: typedBlock.tool_use_id,
                  content: resultContent.map((c: any) => ({ text: typeof c === 'string' ? c : JSON.stringify(c) })),
                }
              });
            }
          }
        }
      }

      // Ensure content is not empty - Bedrock requires at least one content block
      if (content.length === 0) {
        console.warn('Empty content in message, adding placeholder text');
        content.push({ text: ' ' });
      }

      return {
        role: msg.role === 'user' ? 'user' : 'assistant',
        content,
      } as BedrockMessage;
    });
  }

  private convertTools(tools: ToolDefinition[]): BedrockTool[] {
    return tools.map(tool => ({
      toolSpec: {
        name: tool.name,
        description: tool.description,
        inputSchema: {
          json: tool.input_schema
        }
      }
    } as BedrockTool));
  }
}

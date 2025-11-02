import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider, StreamChatParams, StreamEvent } from './interface.js';

export class AnthropicProvider implements AIProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async *streamChat(params: StreamChatParams): AsyncIterable<StreamEvent> {
    const stream = await this.client.messages.create({
      model: this.model,
      max_tokens: params.maxTokens,
      temperature: params.temperature,
      system: params.system,
      messages: params.messages,
      tools: params.tools as never, // Type compatibility
      stream: true,
    });

    for await (const event of stream) {
      // Map Anthropic events to our common format
      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'text') {
          yield { type: 'content_block_start', contentBlock: { type: 'text' } };
        } else if (event.content_block.type === 'tool_use') {
          yield {
            type: 'content_block_start',
            contentBlock: {
              type: 'tool_use',
              id: event.content_block.id,
              name: event.content_block.name,
            }
          };
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: event.delta.text }
          };
        } else if (event.delta.type === 'input_json_delta') {
          yield {
            type: 'content_block_delta',
            delta: { type: 'input_json_delta', partial_json: event.delta.partial_json }
          };
        }
      } else if (event.type === 'content_block_stop') {
        yield { type: 'content_block_stop' };
      } else if (event.type === 'message_delta') {
        yield {
          type: 'message_delta',
          delta: { stop_reason: event.delta.stop_reason as never }
        };
      } else if (event.type === 'message_stop') {
        yield { type: 'message_stop' };
      }
    }
  }
}

import type { Socket } from 'socket.io';
import { anthropic, CLAUDE_CONFIG } from './claudeClient.js';
import { loadSystemPrompt } from './systemPrompts.js';
import { getToolDefinitions, executeToolRequest } from '../tools/index.js';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';

// Store conversation history per socket
const conversationHistory = new Map<string, MessageParam[]>();

export async function startNewConversation(socket: Socket): Promise<void> {
  // Clear conversation history for this socket
  conversationHistory.set(socket.id, []);
  console.log(`🆕 New conversation started for ${socket.id}`);
}

export async function processUserMessage(socket: Socket, userMessage: string): Promise<void> {
  // Get or initialize conversation history
  let history = conversationHistory.get(socket.id);
  if (!history) {
    history = [];
    conversationHistory.set(socket.id, history);
  }

  // Add user message to history
  history.push({
    role: 'user',
    content: userMessage
  });

  // Emit thinking indicator
  socket.emit('ai_thinking', { thinking: true });

  try {
    // Call Claude with streaming
    await streamClaudeResponse(socket, history);
  } catch (error) {
    console.error('Error processing message:', error);
    socket.emit('error', {
      message: 'Failed to get AI response',
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    socket.emit('ai_thinking', { thinking: false });
  }
}

async function streamClaudeResponse(socket: Socket, history: MessageParam[]): Promise<void> {
  const systemPrompt = loadSystemPrompt();
  const tools = getToolDefinitions();

  // Start streaming response
  const stream = await anthropic.messages.create({
    ...CLAUDE_CONFIG,
    system: systemPrompt,
    messages: history,
    tools,
    stream: true,
  });

  let currentResponse = '';
  let toolUseBlocks: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];

  socket.emit('ai_response_start', {});

  try {
    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'text') {
          // Text content starting
        } else if (event.content_block.type === 'tool_use') {
          // Tool use starting
          const toolBlock = event.content_block;
          toolUseBlocks.push({
            id: toolBlock.id,
            name: toolBlock.name,
            input: {}
          });
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          // Stream text to client
          const textDelta = event.delta.text;
          currentResponse += textDelta;
          socket.emit('ai_response_chunk', { content: textDelta });
        } else if (event.delta.type === 'input_json_delta') {
          // Accumulate tool input
          const lastToolBlock = toolUseBlocks[toolUseBlocks.length - 1];
          if (lastToolBlock) {
            const partialJson = event.delta.partial_json;
            // Parse incrementally (this is simplified - production would need better JSON parsing)
            try {
              lastToolBlock.input = JSON.parse(partialJson);
            } catch {
              // Not yet complete JSON, continue accumulating
            }
          }
        }
      } else if (event.type === 'content_block_stop') {
        // Content block completed
      } else if (event.type === 'message_delta') {
        if (event.delta.stop_reason === 'tool_use') {
          // Claude wants to use tools
          console.log(`🔧 Claude requesting tool use: ${toolUseBlocks.map(t => t.name).join(', ')}`);
        }
      } else if (event.type === 'message_stop') {
        // Message completed
        break;
      }
    }

    // If there are tool uses, execute them
    if (toolUseBlocks.length > 0) {
      await handleToolUses(socket, history, currentResponse, toolUseBlocks);
    } else {
      // No tools, just save the response
      if (currentResponse) {
        history.push({
          role: 'assistant',
          content: currentResponse
        });
      }
      socket.emit('ai_response_done', {});
    }

  } catch (error) {
    console.error('Streaming error:', error);
    throw error;
  }
}

async function handleToolUses(
  socket: Socket,
  history: MessageParam[],
  textResponse: string,
  toolUseBlocks: Array<{ id: string; name: string; input: Record<string, unknown> }>
): Promise<void> {
  // Build assistant message with tool uses
  const assistantContent: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }> = [];

  if (textResponse) {
    assistantContent.push({ type: 'text', text: textResponse });
  }

  for (const tool of toolUseBlocks) {
    assistantContent.push({
      type: 'tool_use',
      id: tool.id,
      name: tool.name,
      input: tool.input
    });
  }

  history.push({
    role: 'assistant',
    content: assistantContent as never // TypeScript workaround
  });

  // Execute each tool
  const toolResults: Array<{ type: string; tool_use_id: string; content: string }> = [];

  for (const tool of toolUseBlocks) {
    console.log(`🔧 Executing tool: ${tool.name}`);
    socket.emit('ai_tool_use', { tool: tool.name, parameters: tool.input });

    try {
      const result = await executeToolRequest(socket, tool.id, tool.name, tool.input);

      toolResults.push({
        type: 'tool_result',
        tool_use_id: tool.id,
        content: JSON.stringify(result)
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Tool execution failed: ${errorMessage}`);

      toolResults.push({
        type: 'tool_result',
        tool_use_id: tool.id,
        content: JSON.stringify({ error: errorMessage })
      });
    }
  }

  // Add tool results to history
  history.push({
    role: 'user',
    content: toolResults as never // TypeScript workaround
  });

  // Continue the conversation with tool results
  await streamClaudeResponse(socket, history);
}

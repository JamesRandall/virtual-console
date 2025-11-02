import type { Socket } from 'socket.io';
import { processUserMessage, startNewConversation } from '../ai/agentService.js';
import { registerToolResponse } from '../tools/index.js';

export async function handleChatMessage(socket: Socket, data: { message: string }) {
  const { message } = data;

  if (!message || typeof message !== 'string') {
    socket.emit('error', { message: 'Invalid message format' });
    return;
  }

  console.log(`💬 Received message: ${message.substring(0, 50)}...`);

  // Process the message through Claude
  await processUserMessage(socket, message);
}

export async function handleNewChat(socket: Socket) {
  console.log('🆕 Starting new chat');

  // Reset conversation
  await startNewConversation(socket);

  socket.emit('chat_reset', { message: 'Chat reset successfully' });
}

export function handleToolResponse(data: { id: string; result: unknown; error?: string }) {
  const { id, result, error } = data;

  console.log(`🔧 Tool response received for ${id}`);

  // Register the tool response so the waiting agent can continue
  registerToolResponse(id, result, error);
}

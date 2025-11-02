import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import { config } from '../config.js';
import { handleChatMessage, handleNewChat, handleToolResponse } from './messageHandlers.js';

export function initializeSocketServer(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.clientUrl,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Handle chat message from user
    socket.on('chat_message', async (data) => {
      try {
        await handleChatMessage(socket, data);
      } catch (error) {
        console.error('Error handling chat message:', error);
        socket.emit('error', {
          message: 'Failed to process message',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // Handle new chat request
    socket.on('new_chat', async () => {
      try {
        await handleNewChat(socket);
      } catch (error) {
        console.error('Error handling new chat:', error);
        socket.emit('error', {
          message: 'Failed to start new chat',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // Handle tool response from browser
    socket.on('tool_response', (data) => {
      try {
        handleToolResponse(data);
      } catch (error) {
        console.error('Error handling tool response:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

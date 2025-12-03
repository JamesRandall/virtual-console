import { io, type Socket } from 'socket.io-client';
import { useDevkitStore } from '../../stores/devkitStore.ts';
import type { ChatMessage } from '../../stores/devkitStore.ts';

const API_URL = 'http://localhost:3001';

class AiWebSocketClient {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(): void {
    if (this.socket?.connected) {
      console.log('Already connected to AI API');
      return;
    }

    console.log('Connecting to AI API...');

    this.socket = io(API_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.setupEventHandlers();
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  sendMessage(message: string): void {
    if (!this.socket?.connected) {
      console.error('Not connected to AI API');
      return;
    }

    // Add user message to store
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random()}`,
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };

    useDevkitStore.getState().addChatMessage(userMessage);

    // Send to API
    this.socket.emit('chat_message', { message });
  }

  startNewChat(): void {
    if (!this.socket?.connected) {
      console.error('Not connected to AI API');
      return;
    }

    this.socket.emit('new_chat');
  }

  sendToolResponse(id: string, result: unknown, error?: string): void {
    if (!this.socket?.connected) {
      console.error('Not connected to AI API');
      return;
    }

    this.socket.emit('tool_response', { id, result, error });
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Connected to AI API');
      this.reconnectAttempts = 0;
      useDevkitStore.getState().setChatConnected(true);
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from AI API');
      useDevkitStore.getState().setChatConnected(false);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
      }
    });

    this.socket.on('ai_thinking', (data: { thinking: boolean }) => {
      useDevkitStore.getState().setAiThinking(data.thinking);
    });

    this.socket.on('ai_response_start', () => {
      // Start a new streaming message
      useDevkitStore.setState({ currentStreamingMessage: '' });
    });

    this.socket.on('ai_response_chunk', (data: { content: string }) => {
      useDevkitStore.getState().appendToStreamingMessage(data.content);
    });

    this.socket.on('ai_response_done', () => {
      // Finalize and save the current streaming message (if any)
      const currentMessage = useDevkitStore.getState().currentStreamingMessage;
      if (currentMessage && currentMessage.trim()) {
        useDevkitStore.getState().finalizeStreamingMessage();
      } else {
        // Clear empty streaming message
        useDevkitStore.setState({ currentStreamingMessage: '' });
      }
    });

    this.socket.on('ai_tool_use', (data: { tool: string; parameters: Record<string, unknown> }) => {
      console.log(`🔧 AI using tool: ${data.tool}`, data.parameters);
    });

    this.socket.on('tool_request', (data: { id: string; tool: string; parameters: Record<string, unknown> }) => {
      console.log(`🔧 Tool request: ${data.tool}`, data.parameters);
      this.handleToolRequest(data.id, data.tool, data.parameters);
    });

    this.socket.on('chat_reset', () => {
      useDevkitStore.getState().clearChatHistory();
    });

    this.socket.on('error', (data: { message: string; error?: string }) => {
      console.error('AI API error:', data);

      // Add error message to chat
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${data.message}${data.error ? `\n${data.error}` : ''}`,
        timestamp: Date.now(),
      };

      useDevkitStore.getState().addChatMessage(errorMessage);
      useDevkitStore.getState().setAiThinking(false);
    });
  }

  private async handleToolRequest(id: string, tool: string, parameters: Record<string, unknown>): Promise<void> {
    try {
      let result: unknown;

      // Import dynamically to avoid circular dependencies
      const { handleToolRequest } = await import('./toolHandlers.ts');
      result = await handleToolRequest(tool, parameters);

      this.sendToolResponse(id, result);
    } catch (error) {
      console.error('Tool execution error:', error);
      this.sendToolResponse(
        id,
        null,
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}

// Export singleton instance
export const aiWebSocket = new AiWebSocketClient();

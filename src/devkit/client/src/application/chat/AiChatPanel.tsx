import { useState, useEffect, useCallback } from 'react';
import { useDevkitStore } from '../../stores/devkitStore.ts';
import { aiWebSocket } from '../../services/ai/aiWebSocket.ts';
import { ChatHeader } from './ChatHeader.tsx';
import { ChatMessageList } from './ChatMessageList.tsx';
import { ChatInput } from './ChatInput.tsx';

export function AiChatPanel() {
  const [inputValue, setInputValue] = useState('');

  // Zustand store hooks
  const chatMessages = useDevkitStore((state) => state.chatMessages);
  const isChatConnected = useDevkitStore((state) => state.isChatConnected);
  const isAiThinking = useDevkitStore((state) => state.isAiThinking);
  const currentStreamingMessage = useDevkitStore((state) => state.currentStreamingMessage);

  // Connect to WebSocket on mount
  useEffect(() => {
    aiWebSocket.connect();

    return () => {
      aiWebSocket.disconnect();
    };
  }, []);

  const handleSendMessage = useCallback(() => {
    const message = inputValue.trim();

    if (!message || !isChatConnected) {
      return;
    }

    aiWebSocket.sendMessage(message);
    setInputValue('');
  }, [inputValue, isChatConnected]);

  const handleNewChat = useCallback(() => {
    if (!isChatConnected) {
      return;
    }

    aiWebSocket.startNewChat();
  }, [isChatConnected]);

  return (
    <div className="dk-layout-full-height dk-bg-secondary dk-text-primary">
      <ChatHeader
        isChatConnected={isChatConnected}
        onNewChat={handleNewChat}
      />

      <ChatMessageList
        messages={chatMessages}
        isAiThinking={isAiThinking}
        currentStreamingMessage={currentStreamingMessage}
      />

      <ChatInput
        value={inputValue}
        onChange={setInputValue}
        onSend={handleSendMessage}
        isChatConnected={isChatConnected}
        isAiThinking={isAiThinking}
      />
    </div>
  );
}

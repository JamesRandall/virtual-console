import { useRef, useEffect } from 'react';
import { ChatMessageBubble } from './ChatMessageBubble.tsx';
import { EmptyState } from './EmptyState.tsx';
import { ThinkingIndicator } from './ThinkingIndicator.tsx';
import { StreamingMessage } from './StreamingMessage.tsx';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatMessageListProps {
  messages: ChatMessage[];
  isAiThinking: boolean;
  currentStreamingMessage: string | null;
}

export function ChatMessageList({ messages, isAiThinking, currentStreamingMessage }: ChatMessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStreamingMessage]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length === 0 && !currentStreamingMessage && (
        <EmptyState />
      )}

      {messages.map((message) => (
        <ChatMessageBubble key={message.id} message={message} />
      ))}

      {currentStreamingMessage && (
        <StreamingMessage content={currentStreamingMessage} />
      )}

      {isAiThinking && !currentStreamingMessage && (
        <ThinkingIndicator />
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}

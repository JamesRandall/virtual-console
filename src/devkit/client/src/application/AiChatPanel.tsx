import { useState, useEffect, useRef, useCallback } from 'react';
import { useDevkitStore } from '../stores/devkitStore.js';
import { aiWebSocket } from '../services/aiWebSocket.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faPlus, faCircle } from '@fortawesome/free-solid-svg-icons';

export function AiChatPanel() {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, currentStreamingMessage]);

  const handleSendMessage = useCallback(() => {
    const message = inputValue.trim();

    if (!message || !isChatConnected) {
      return;
    }

    aiWebSocket.sendMessage(message);
    setInputValue('');
  }, [inputValue, isChatConnected]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const handleNewChat = useCallback(() => {
    if (!isChatConnected) {
      return;
    }

    aiWebSocket.startNewChat();
  }, [isChatConnected]);

  return (
    <div className="dk-layout-full-height dk-bg-secondary dk-text-primary">
      {/* Header */}
      <div className="dk-layout-header dk-bg-primary flex-shrink-0">
        <div className="flex items-center dk-gap-small">
          <h2 className="dk-subsection-header">AI Assistant</h2>
          <div className="flex items-center dk-gap-tight">
            <FontAwesomeIcon
              icon={faCircle}
              className={`text-xs ${isChatConnected ? 'text-green-500' : 'text-red-500'}`}
            />
            <span className="dk-secondary-text">
              {isChatConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
        <button
          onClick={handleNewChat}
          disabled={!isChatConnected}
          className="dk-icon-text dk-body-text disabled:dk-text-muted"
          title="Start new chat"
        >
          <FontAwesomeIcon icon={faPlus} className="text-xs" />
          New Chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatMessages.length === 0 && !currentStreamingMessage && (
          <div className="text-center text-zinc-500 mt-8">
            <p className="text-lg mb-2">Welcome to the AI Assistant!</p>
            <p className="text-sm">I can help you write and debug assembly code for the virtual console.</p>
            <p className="text-sm mt-4">Try asking:</p>
            <ul className="text-sm mt-2 space-y-1 text-zinc-400">
              <li>"Explain what this code does"</li>
              <li>"Help me fix this bug"</li>
              <li>"Write a program that draws a circle"</li>
              <li>"What's in register R0?"</li>
            </ul>
          </div>
        )}

        {chatMessages.map((message) => (
          <ChatMessageBubble key={message.id} message={message} />
        ))}

        {/* Show streaming message if present */}
        {currentStreamingMessage && (
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-semibold text-sm">
              AI
            </div>
            <div className="flex-1 bg-zinc-800 rounded-lg p-3">
              <div className="prose prose-invert prose-sm max-w-none">
                <MessageContent content={currentStreamingMessage} />
                <span className="inline-block w-2 h-4 bg-purple-500 animate-pulse ml-1"></span>
              </div>
            </div>
          </div>
        )}

        {/* Thinking indicator */}
        {isAiThinking && !currentStreamingMessage && (
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-semibold text-sm">
              AI
            </div>
            <div className="flex-1 bg-zinc-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-zinc-400">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex items-center dk-gap-compact px-3 py-1.5 dk-border-t dk-bg-primary flex-shrink-0">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={!isChatConnected || isAiThinking}
          placeholder={isChatConnected ? "Ask me anything..." : "Connecting..."}
          className="flex-1 px-3 py-1 bg-zinc-700 border border-zinc-600 rounded text-zinc-200 text-sm focus:outline-none focus:border-purple-500 disabled:dk-bg-secondary disabled:dk-text-muted"
        />
        <button
          onClick={handleSendMessage}
          disabled={!isChatConnected || !inputValue.trim() || isAiThinking}
          className="dk-btn-icon bg-purple-600 hover:bg-purple-700 disabled:dk-bg-elevated disabled:dk-text-muted text-white border border-transparent"
        >
          <FontAwesomeIcon icon={faPaperPlane} />
        </button>
      </div>
    </div>
  );
}

interface ChatMessageBubbleProps {
  message: { role: 'user' | 'assistant'; content: string };
}

function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm ${
        isUser ? 'bg-blue-600' : 'bg-purple-600'
      }`}>
        {isUser ? 'You' : 'AI'}
      </div>
      <div className={`flex-1 rounded-lg p-3 ${
        isUser ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-100'
      }`}>
        <div className="prose prose-invert prose-sm max-w-none">
          <MessageContent content={message.content} />
        </div>
      </div>
    </div>
  );
}

function MessageContent({ content }: { content: string }) {
  // Simple markdown-like rendering for code blocks
  const parts = content.split(/(```[\s\S]*?```|`[^`]+`)/);

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          // Code block
          const code = part.slice(3, -3).trim();
          const [, ...codeLines] = code.split('\n');
          const codeContent = codeLines.join('\n');

          return (
            <pre key={index} className="bg-zinc-950 p-3 rounded overflow-x-auto">
              <code className="text-sm">{codeContent || code}</code>
            </pre>
          );
        } else if (part.startsWith('`') && part.endsWith('`')) {
          // Inline code
          return (
            <code key={index} className="bg-zinc-700 px-1 rounded text-sm">
              {part.slice(1, -1)}
            </code>
          );
        } else {
          // Regular text - preserve line breaks
          return part.split('\n').map((line, lineIndex) => (
            <span key={`${index}-${lineIndex}`}>
              {line}
              {lineIndex < part.split('\n').length - 1 && <br />}
            </span>
          ));
        }
      })}
    </>
  );
}

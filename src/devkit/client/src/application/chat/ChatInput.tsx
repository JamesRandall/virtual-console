import { useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isChatConnected: boolean;
  isAiThinking: boolean;
}

export function ChatInput({ value, onChange, onSend, isChatConnected, isAiThinking }: ChatInputProps) {
  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }, [onSend]);

  return (
    <div className="flex items-center dk-gap-compact px-3 py-1.5 dk-border-t dk-bg-primary flex-shrink-0">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyPress={handleKeyPress}
        disabled={!isChatConnected || isAiThinking}
        placeholder={isChatConnected ? "Ask me anything..." : "Connecting..."}
        className="flex-1 px-3 py-1 bg-zinc-700 border border-zinc-600 rounded text-zinc-200 text-sm focus:outline-none focus:border-purple-500 disabled:dk-bg-secondary disabled:dk-text-muted"
      />
      <button
        onClick={onSend}
        disabled={!isChatConnected || !value.trim() || isAiThinking}
        className="dk-btn-icon bg-purple-600 hover:bg-purple-700 disabled:dk-bg-elevated disabled:dk-text-muted text-white border border-transparent"
      >
        <FontAwesomeIcon icon={faPaperPlane} />
      </button>
    </div>
  );
}

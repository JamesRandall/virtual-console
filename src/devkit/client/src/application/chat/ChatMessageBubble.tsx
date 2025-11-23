import { MessageContent } from './MessageContent.tsx';

interface ChatMessageBubbleProps {
  message: { role: 'user' | 'assistant'; content: string };
}

export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
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

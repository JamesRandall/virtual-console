import { MessageContent } from './MessageContent.tsx';

interface StreamingMessageProps {
  content: string;
}

export function StreamingMessage({ content }: StreamingMessageProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-semibold text-sm">
        AI
      </div>
      <div className="flex-1 bg-zinc-800 rounded-lg p-3">
        <div className="prose prose-invert prose-sm max-w-none">
          <MessageContent content={content} />
          <span className="inline-block w-2 h-4 bg-purple-500 animate-pulse ml-1"></span>
        </div>
      </div>
    </div>
  );
}

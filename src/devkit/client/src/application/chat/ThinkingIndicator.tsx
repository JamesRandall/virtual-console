export function ThinkingIndicator() {
  return (
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
  );
}

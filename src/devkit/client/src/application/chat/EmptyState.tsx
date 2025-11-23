export function EmptyState() {
  return (
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
  );
}

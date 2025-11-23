interface MessageContentProps {
  content: string;
}

export function MessageContent({ content }: MessageContentProps) {
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

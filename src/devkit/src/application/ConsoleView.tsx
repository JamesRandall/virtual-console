import {useRef, useEffect, useState} from 'react';

export function ConsoleView() {
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewSize] = useState({width: 256, height: 160})

  // Effects
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set up canvas context
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // TODO: Integrate with virtual console rendering
  }, []);

  // Render
  return (
    <div className="h-full w-full bg-zinc-900 flex items-center justify-center">
      <canvas
        ref={canvasRef}
        className="border border-zinc-700"
        width={viewSize.width}
        height={viewSize.height}
      />
    </div>
  );
}

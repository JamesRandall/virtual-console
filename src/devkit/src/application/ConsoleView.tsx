import { useRef, useEffect, useState } from 'react';
import { useVirtualConsole } from '../consoleIntegration/virtualConsole';
import { createWebGPURenderer, type WebGPURenderer } from '../consoleIntegration/webgpuRendering';

export function ConsoleView({ isActive = true }: { isActive?: boolean } = {}) {
  // Virtual console
  const { sharedMemory } = useVirtualConsole();

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGPURenderer | null>(null);

  // State
  const [viewSize] = useState({ width: 256, height: 160 });
  const [error, setError] = useState<string | null>(null);

  // Initialize WebGPU renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let mounted = true;

    // Initialize renderer
    createWebGPURenderer(canvas, sharedMemory)
      .then((renderer) => {
        if (!mounted) {
          renderer.destroy();
          return;
        }

        rendererRef.current = renderer;
        renderer.start();
      })
      .catch((err) => {
        if (!mounted) return;
        console.error('Failed to initialize WebGPU renderer:', err);
        setError(err instanceof Error ? err.message : String(err));
      });

    // Cleanup
    return () => {
      mounted = false;
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
    };
  }, [sharedMemory]);

  // Control renderer visibility based on isActive prop
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setVisible(isActive);
    }
  }, [isActive]);

  // Render
  if (error) {
    return (
      <div className="h-full w-full bg-zinc-900 flex items-center justify-center">
        <div className="text-red-600 text-center p-4 max-w-lg">
          <div className="font-bold mb-2">WebGPU Initialization Error</div>
          <div className="text-sm">{error}</div>
          {!('gpu' in navigator) && (
            <div className="text-xs text-zinc-400 mt-4">
              WebGPU is not supported in this browser. Try using Chrome, Edge, or another Chromium-based browser.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-zinc-900 flex items-center justify-center">
      <canvas
        ref={canvasRef}
        className="border border-zinc-700"
        style={{
          imageRendering: 'pixelated',
        }}
        width={viewSize.width}
        height={viewSize.height}
      />
    </div>
  );
}

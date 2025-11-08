import { useRef, useEffect, useState } from 'react';
import { useVirtualConsole } from '../consoleIntegration/virtualConsole';
import { createWebGPURenderer, type WebGPURenderer } from '../consoleIntegration/webgpuRendering';
import { useDevkitStore } from '../stores/devkitStore';

export function ConsoleView({ isActive = true }: { isActive?: boolean } = {}) {
  // Virtual console
  const { sharedMemory } = useVirtualConsole();

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGPURenderer | null>(null);

  // State
  const [viewSize] = useState({ width: 256, height: 160 });
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<1 | 2 | 4 | 8>(2); // Default zoom level

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

  // Canvas capture event listener for AI tool
  useEffect(() => {
    const handleCaptureCanvas = async () => {
      const canvas = canvasRef.current;
      const renderer = rendererRef.current;

      if (!canvas || !renderer) {
        window.dispatchEvent(new CustomEvent('canvas-capture-response', {
          detail: { success: false, error: 'Canvas or renderer not available' }
        }));
        return;
      }

      try {
        // Use the renderer's captureFrame method (handles WebGPU properly)
        const imageData = await renderer.captureFrame();
        const cpuSnapshot = useDevkitStore.getState().cpuSnapshot;

        console.log('📸 Captured canvas screenshot via WebGPU renderer');

        window.dispatchEvent(new CustomEvent('canvas-capture-response', {
          detail: {
            success: true,
            image: imageData,
            width: canvas.width,
            height: canvas.height,
            format: 'image/png',
            capturedAt: {
              programCounter: cpuSnapshot.programCounter,
              cycleCount: cpuSnapshot.cycleCount,
              timestamp: Date.now()
            }
          }
        }));
      } catch (error) {
        console.error('Error capturing canvas:', error);
        window.dispatchEvent(new CustomEvent('canvas-capture-response', {
          detail: {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error capturing canvas'
          }
        }));
      }
    };

    window.addEventListener('capture-canvas', handleCaptureCanvas);

    return () => {
      window.removeEventListener('capture-canvas', handleCaptureCanvas);
    };
  }, []);

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
    <div className="h-full w-full bg-zinc-900 flex flex-col">
      <div className="flex-1 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          className="border border-zinc-700"
          style={{
            imageRendering: 'pixelated',
            transform: `scale(${zoom})`,
            transformOrigin: 'center',
          }}
          width={viewSize.width}
          height={viewSize.height}
        />
      </div>

      {/* Zoom controls */}
      <div className="flex items-center justify-center pb-4 relative z-10">
        <div className="flex rounded overflow-hidden border border-white/20 bg-zinc-800">
          {([1, 2, 4, 8] as const).map((zoomLevel) => (
            <button
              key={zoomLevel}
              onClick={() => setZoom(zoomLevel)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                zoom === zoomLevel
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
              } ${zoomLevel !== 8 ? 'border-r border-white/20' : ''}`}
            >
              ×{zoomLevel}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

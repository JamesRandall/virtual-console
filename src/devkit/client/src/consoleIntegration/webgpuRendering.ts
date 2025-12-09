/**
 * WebGPU Renderer for Virtual Console Framebuffer
 *
 * This is the public facade that delegates to the FrameLoop,
 * which coordinates all rendering subsystems.
 */

import { SpriteRenderer } from './spriteRenderer';
import { TilemapRenderer } from './tilemapRenderer';
import { BankedMemory } from '../../../../console/src/bankedMemory';
import { createFrameLoop } from './frameLoop';

/**
 * WebGPU Renderer Interface
 */
export interface WebGPURenderer {
  /**
   * Start the 60fps render loop
   */
  start(): void;

  /**
   * Stop the render loop
   */
  stop(): void;

  /**
   * Clean up GPU resources
   */
  destroy(): void;

  /**
   * Check if renderer is running
   */
  isRunning(): boolean;

  /**
   * Control whether GPU rendering is performed (interrupts always fire)
   */
  setVisible(visible: boolean): void;

  /**
   * Capture the current frame as a PNG data URL
   */
  captureFrame(): Promise<string>;

  /**
   * Get the sprite renderer for debugging/inspection
   */
  getSpriteRenderer(): SpriteRenderer | null;

  /**
   * Get the tilemap renderer for debugging/inspection
   */
  getTilemapRenderer(): TilemapRenderer | null;
}

/**
 * Create a WebGPU renderer for the virtual console framebuffer
 *
 * @param canvas - HTML canvas element to render to
 * @param sharedMemory - SharedArrayBuffer containing console memory
 * @param bankedMemory - Optional BankedMemory for sprite graphics access
 */
export async function createWebGPURenderer(
  canvas: HTMLCanvasElement,
  sharedMemory: SharedArrayBuffer,
  bankedMemory?: BankedMemory
): Promise<WebGPURenderer> {
  const frameLoop = await createFrameLoop(canvas, sharedMemory, bankedMemory);

  return {
    start: () => frameLoop.start(),
    stop: () => frameLoop.stop(),
    destroy: () => frameLoop.destroy(),
    isRunning: () => frameLoop.isRunning(),
    setVisible: (visible) => frameLoop.setVisible(visible),
    captureFrame: () => frameLoop.captureFrame(),
    getSpriteRenderer: () => frameLoop.getSpriteRenderer(),
    getTilemapRenderer: () => frameLoop.getTilemapRenderer(),
  };
}

/**
 * Frame Loop for Virtual Console
 *
 * The main coordinator that runs at 60fps and orchestrates:
 * - GPU compositor for rendering
 * - VBlank interrupt firing
 * - Gamepad polling
 * - Sprite and tilemap renderers
 */

import { pollGamepads, initKeyboardInput, cleanupKeyboardInput } from './gamePad';
import { createGPUCompositor, type GPUCompositor } from './gpuCompositor';
import { SpriteRenderer } from './spriteRenderer';
import { TilemapRenderer } from './tilemapRenderer';
import { BankedMemory } from '../../../../console/src/bankedMemory';

const TARGET_FPS = 60;
const FRAME_TIME = 1000 / TARGET_FPS;

// VBlank interrupt status register
const INT_STATUS_ADDR = 0x0114;

/**
 * Frame Loop Interface
 */
export interface FrameLoop {
  /**
   * Start the 60fps frame loop
   */
  start(): void;

  /**
   * Stop the frame loop
   */
  stop(): void;

  /**
   * Check if the frame loop is running
   */
  isRunning(): boolean;

  /**
   * Control whether GPU rendering is performed (interrupts always fire)
   */
  setVisible(visible: boolean): void;

  /**
   * Clean up resources
   */
  destroy(): void;

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
 * Create a frame loop that coordinates rendering and system timing
 */
export async function createFrameLoop(
  canvas: HTMLCanvasElement,
  sharedMemory: SharedArrayBuffer,
  bankedMemory?: BankedMemory
): Promise<FrameLoop> {
  const memory = new Uint8Array(sharedMemory);

  // Create sprite renderer if banked memory is available
  let spriteRenderer: SpriteRenderer | null = null;
  if (bankedMemory) {
    spriteRenderer = new SpriteRenderer(sharedMemory, bankedMemory);
  }

  // Create tilemap renderer if banked memory is available
  let tilemapRenderer: TilemapRenderer | null = null;
  if (bankedMemory) {
    tilemapRenderer = new TilemapRenderer(sharedMemory, bankedMemory);
  }

  // Create GPU compositor for rendering
  const compositor: GPUCompositor = await createGPUCompositor(
    canvas,
    sharedMemory,
    spriteRenderer,
    tilemapRenderer
  );

  let isActive = false;
  let isVisible = true;
  let lastFrameTime = 0;
  let animationFrameId: number | null = null;

  function renderFrame(timestamp: number): void {
    if (!isActive) return;

    // Throttle to 60fps
    const elapsed = timestamp - lastFrameTime;
    if (elapsed < FRAME_TIME) {
      animationFrameId = requestAnimationFrame(renderFrame);
      return;
    }

    lastFrameTime = timestamp - (elapsed % FRAME_TIME);

    // Only perform GPU rendering if visible
    if (isVisible) {
      compositor.render(memory);
    }

    // Poll gamepad state and update controller registers at 60Hz
    pollGamepads(memory);

    // ALWAYS set VBlank interrupt flag in INT_STATUS
    // This fires even when not visible to keep CPU timing consistent
    // Use Atomics.or to set bit 0 atomically for thread safety
    Atomics.or(memory, INT_STATUS_ADDR, 0x01);

    // Schedule next frame
    animationFrameId = requestAnimationFrame(renderFrame);
  }

  // Initialize keyboard input for controller emulation
  initKeyboardInput();

  return {
    start(): void {
      if (!isActive) {
        isActive = true;
        lastFrameTime = performance.now();
        animationFrameId = requestAnimationFrame(renderFrame);
      }
    },

    stop(): void {
      isActive = false;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    },

    isRunning(): boolean {
      return isActive;
    },

    setVisible(visible: boolean): void {
      isVisible = visible;
    },

    destroy(): void {
      this.stop();
      cleanupKeyboardInput();
      compositor.destroy();
    },

    captureFrame(): Promise<string> {
      return compositor.captureFrame();
    },

    getSpriteRenderer(): SpriteRenderer | null {
      return spriteRenderer;
    },

    getTilemapRenderer(): TilemapRenderer | null {
      return tilemapRenderer;
    },
  };
}

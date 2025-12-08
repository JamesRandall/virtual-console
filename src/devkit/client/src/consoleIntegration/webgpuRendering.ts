/**
 * WebGPU Renderer for Virtual Console Framebuffer
 *
 * Renders Mode 0 (256×160 @ 4bpp) with scanline palette mapping.
 * Runs at 60fps using requestAnimationFrame.
 * Includes sprite rendering support.
 */

import { pollGamepads, initKeyboardInput, cleanupKeyboardInput } from './gamePad';
import { generateWGSLPaletteArray } from '../../../../console/src/systemPalette';
import { SpriteRenderer } from './spriteRenderer';
import { TilemapRenderer } from './tilemapRenderer';
import { BankedMemory } from '../../../../console/src/bankedMemory';

// Memory layout constants for Mode 0
const FRAMEBUFFER_START = 0xB000;
const FRAMEBUFFER_SIZE = 0x5000; // 20,480 bytes
const PALETTE_RAM_START = 0x0200;
const PALETTE_RAM_SIZE = 0x0400; // 1024 bytes
const SCANLINE_MAP_START = 0x0600;
const SCANLINE_MAP_SIZE = 0x0100; // 256 bytes

const TARGET_FPS = 60;
const FRAME_TIME = 1000 / TARGET_FPS;

// Screen dimensions for Mode 0
const SCREEN_WIDTH = 256;
const SCREEN_HEIGHT = 160;

// Sprite enable register
const SPRITE_ENABLE = 0x0104;

// Tilemap enable register
const TILEMAP_ENABLE = 0x013d;

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
  // Check WebGPU support
  if (!('gpu' in navigator)) {
    throw new Error('WebGPU is not supported in this browser');
  }

  const gpu = (navigator as Navigator & { gpu: GPU }).gpu;

  // Get GPU adapter and device
  const adapter = await gpu.requestAdapter();
  if (!adapter) {
    throw new Error('Failed to get GPU adapter');
  }

  const device = await adapter.requestDevice();

  // Handle device lost
  device.lost.then((info) => {
    console.error('WebGPU device was lost:', info.message);
    console.error('Reason:', info.reason);
  });

  // Configure canvas context
  const context = canvas.getContext('webgpu');
  if (!context) {
    throw new Error('Failed to get WebGPU context');
  }

  const presentationFormat = gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: presentationFormat,
    alphaMode: 'opaque',
  });

  // Create memory views
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

  // Sprite overlay buffer (written by sprite renderer, read by GPU)
  // This buffer holds sprite pixels in 4bpp format that will be composited
  const spriteOverlayBuffer = device.createBuffer({
    size: FRAMEBUFFER_SIZE,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  // Sprite mask buffer (1 byte per pixel - indicates if sprite pixel is present)
  const spriteMaskBuffer = device.createBuffer({
    size: SCREEN_WIDTH * SCREEN_HEIGHT,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  // CPU-side buffers for sprite compositing
  const spriteOverlayData = new Uint8Array(FRAMEBUFFER_SIZE);
  const spriteMaskData = new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT);

  // Initialize sprite GPU buffers to zero (WebGPU buffers have undefined initial contents)
  device.queue.writeBuffer(spriteOverlayBuffer, 0, spriteOverlayData);
  device.queue.writeBuffer(spriteMaskBuffer, 0, spriteMaskData);

  // Tilemap overlay buffer (written by tilemap renderer, read by GPU)
  // This buffer holds tilemap pixels as master palette indices (already resolved)
  const tilemapOverlayBuffer = device.createBuffer({
    size: SCREEN_WIDTH * SCREEN_HEIGHT,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  // Tilemap mask buffer (1 byte per pixel - indicates if tilemap pixel is present)
  const tilemapMaskBuffer = device.createBuffer({
    size: SCREEN_WIDTH * SCREEN_HEIGHT,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  // CPU-side buffers for tilemap compositing
  const tilemapOverlayData = new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT);
  const tilemapMaskData = new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT);

  // Initialize tilemap GPU buffers to zero
  device.queue.writeBuffer(tilemapOverlayBuffer, 0, tilemapOverlayData);
  device.queue.writeBuffer(tilemapMaskBuffer, 0, tilemapMaskData);

  // Create GPU buffers
  const framebufferBuffer = device.createBuffer({
    size: FRAMEBUFFER_SIZE,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  const paletteBuffer = device.createBuffer({
    size: PALETTE_RAM_SIZE,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  const scanlineMapBuffer = device.createBuffer({
    size: SCANLINE_MAP_SIZE,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  // Build shader code dynamically with system palette
  const paletteArrayCode = generateWGSLPaletteArray();
  const shaderCode = `
// Tailwind 256-color palette (RGB values 0-255) - Generated from systemPalette.ts
${paletteArrayCode}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) texCoord: vec2f,
}

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  // Fullscreen quad
  var pos = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f(1.0, -1.0),
    vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0),
    vec2f(1.0, -1.0),
    vec2f(1.0, 1.0)
  );

  var texCoord = array<vec2f, 6>(
    vec2f(0.0, 1.0),
    vec2f(1.0, 1.0),
    vec2f(0.0, 0.0),
    vec2f(0.0, 0.0),
    vec2f(1.0, 1.0),
    vec2f(1.0, 0.0)
  );

  var output: VertexOutput;
  output.position = vec4f(pos[vertexIndex], 0.0, 1.0);
  output.texCoord = texCoord[vertexIndex];
  return output;
}

@group(0) @binding(0) var<storage, read> framebuffer: array<u32>;
@group(0) @binding(1) var<storage, read> paletteRam: array<u32>;
@group(0) @binding(2) var<storage, read> scanlineMap: array<u32>;
@group(0) @binding(3) var<storage, read> spriteOverlay: array<u32>;
@group(0) @binding(4) var<storage, read> spriteMask: array<u32>;
@group(0) @binding(5) var<storage, read> tilemapOverlay: array<u32>;
@group(0) @binding(6) var<storage, read> tilemapMask: array<u32>;

// Helper function to read a byte from a u32 array
fn readByte(buffer: ptr<storage, array<u32>, read>, byteIndex: u32) -> u32 {
  let wordIndex = byteIndex / 4u;
  let byteOffset = byteIndex % 4u;
  let word = buffer[wordIndex];
  return (word >> (byteOffset * 8u)) & 0xFFu;
}

@fragment
fn fragmentMain(@location(0) texCoord: vec2f) -> @location(0) vec4f {
  // Calculate pixel coordinates
  let x = u32(texCoord.x * 256.0);
  let y = u32(texCoord.y * 160.0);

  // Bounds check
  if (x >= 256u || y >= 160u) {
    return vec4f(0.0, 0.0, 0.0, 1.0);
  }

  // Calculate pixel index for this position
  let pixelIndex = y * 256u + x;
  let byteIndex = pixelIndex / 2u;

  // Check layer presence
  let hasSpritePixel = readByte(&spriteMask, pixelIndex) != 0u;
  let hasTilemapPixel = readByte(&tilemapMask, pixelIndex) != 0u;

  var masterPaletteIndex: u32;

  // Layer priority (front to back): sprites > tilemap > framebuffer
  if (hasSpritePixel) {
    // Sprite: read color index and apply scanline palette map
    let spriteByte = readByte(&spriteOverlay, byteIndex);
    var colorIndex: u32;
    if ((pixelIndex & 1u) == 0u) {
      colorIndex = (spriteByte >> 4u) & 0xFu; // High nibble (even pixel)
    } else {
      colorIndex = spriteByte & 0xFu; // Low nibble (odd pixel)
    }
    let paletteSelector = readByte(&scanlineMap, y);
    let paletteIndex = paletteSelector * 16u + colorIndex;
    masterPaletteIndex = readByte(&paletteRam, paletteIndex);
  } else if (hasTilemapPixel) {
    // Tilemap: palette already resolved by TilemapEngine
    // tilemapOverlay contains master palette indices directly (1 byte per pixel)
    masterPaletteIndex = readByte(&tilemapOverlay, pixelIndex);
  } else {
    // Framebuffer: read color index and apply scanline palette map
    let byte = readByte(&framebuffer, byteIndex);
    var colorIndex: u32;
    if ((pixelIndex & 1u) == 0u) {
      colorIndex = (byte >> 4u) & 0xFu; // High nibble (even pixel)
    } else {
      colorIndex = byte & 0xFu; // Low nibble (odd pixel)
    }
    let paletteSelector = readByte(&scanlineMap, y);
    let paletteIndex = paletteSelector * 16u + colorIndex;
    masterPaletteIndex = readByte(&paletteRam, paletteIndex);
  }

  // Look up final RGB color from master palette
  let rgb = PALETTE[masterPaletteIndex];

  // Convert from 0-255 to 0.0-1.0
  return vec4f(rgb / 255.0, 1.0);
}
`;

  // Create shader module
  const shaderModule = device.createShaderModule({
    label: 'Virtual Console Framebuffer Shader',
    code: shaderCode,
  });

  // Create bind group layout
  const bindGroupLayout = device.createBindGroupLayout({
    label: 'Framebuffer Bind Group Layout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'read-only-storage' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'read-only-storage' },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'read-only-storage' },
      },
      {
        binding: 3,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'read-only-storage' },
      },
      {
        binding: 4,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'read-only-storage' },
      },
      {
        binding: 5,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'read-only-storage' },
      },
      {
        binding: 6,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'read-only-storage' },
      },
    ],
  });

  // Create bind group
  const bindGroup = device.createBindGroup({
    label: 'Framebuffer Bind Group',
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: framebufferBuffer } },
      { binding: 1, resource: { buffer: paletteBuffer } },
      { binding: 2, resource: { buffer: scanlineMapBuffer } },
      { binding: 3, resource: { buffer: spriteOverlayBuffer } },
      { binding: 4, resource: { buffer: spriteMaskBuffer } },
      { binding: 5, resource: { buffer: tilemapOverlayBuffer } },
      { binding: 6, resource: { buffer: tilemapMaskBuffer } },
    ],
  });

  // Create pipeline
  const pipeline = device.createRenderPipeline({
    label: 'Virtual Console Render Pipeline',
    layout: device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    }),
    vertex: {
      module: shaderModule,
      entryPoint: 'vertexMain',
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fragmentMain',
      targets: [
        {
          format: presentationFormat,
        },
      ],
    },
    primitive: {
      topology: 'triangle-list',
    },
  });

  // Render state
  let isActive = false;
  let isVisible = true;
  let lastFrameTime = 0;
  let animationFrameId: number | null = null;


  /**
   * Render a single frame
   */
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
    if (isVisible && context) {
      // Clear tilemap buffers
      tilemapMaskData.fill(0);

      // Render tilemap if tilemap renderer is available and enabled
      if (tilemapRenderer && (memory[TILEMAP_ENABLE] & 0x01) !== 0) {
        // Clear overlay buffer
        tilemapOverlayData.fill(0);

        // Render each scanline
        for (let y = 0; y < SCREEN_HEIGHT; y++) {
          const scanlineBuffer = tilemapRenderer.renderScanline(y, SCREEN_WIDTH);

          // Copy scanline to overlay and mask buffers
          // Tilemap overlay stores master palette indices directly (1 byte per pixel)
          for (let x = 0; x < SCREEN_WIDTH; x++) {
            const masterPaletteIndex = scanlineBuffer[x];
            if (masterPaletteIndex !== 0) {
              const pixelIndex = y * SCREEN_WIDTH + x;
              tilemapMaskData[pixelIndex] = 1;
              tilemapOverlayData[pixelIndex] = masterPaletteIndex;
            }
          }
        }
      }

      // Always upload tilemap buffers to GPU
      device.queue.writeBuffer(tilemapOverlayBuffer, 0, tilemapOverlayData);
      device.queue.writeBuffer(tilemapMaskBuffer, 0, tilemapMaskData);

      // Clear sprite buffers
      spriteMaskData.fill(0);

      // Render sprites if sprite renderer is available and sprites are enabled
      if (spriteRenderer && (memory[SPRITE_ENABLE] & 0x01) !== 0) {
        // Clear overlay buffer
        spriteOverlayData.fill(0);

        // Reset sprite engine frame state
        spriteRenderer.resetFrame();

        // Render each scanline
        for (let y = 0; y < SCREEN_HEIGHT; y++) {
          const scanlineBuffer = spriteRenderer.renderScanline(y, SCREEN_WIDTH);

          // Copy scanline to overlay and mask buffers
          for (let x = 0; x < SCREEN_WIDTH; x++) {
            const colorIndex = scanlineBuffer[x];
            if (colorIndex !== 0) {
              // Write to mask (sprite pixel present)
              spriteMaskData[y * SCREEN_WIDTH + x] = 1;

              // Write to overlay (4bpp format)
              const pixelIndex = y * SCREEN_WIDTH + x;
              const byteIndex = Math.floor(pixelIndex / 2);
              if (pixelIndex % 2 === 0) {
                // High nibble (even pixel)
                spriteOverlayData[byteIndex] = (spriteOverlayData[byteIndex] & 0x0f) | ((colorIndex & 0x0f) << 4);
              } else {
                // Low nibble (odd pixel)
                spriteOverlayData[byteIndex] = (spriteOverlayData[byteIndex] & 0xf0) | (colorIndex & 0x0f);
              }
            }
          }
        }

        // Finalize frame (write collision data to memory)
        spriteRenderer.finalizeFrame();
      }

      // Always upload sprite buffers to GPU
      device.queue.writeBuffer(spriteOverlayBuffer, 0, spriteOverlayData);
      device.queue.writeBuffer(spriteMaskBuffer, 0, spriteMaskData);

      // Write data from shared memory directly to GPU buffers
      // TypeScript's GPUQueue.writeBuffer types don't recognize SharedArrayBuffer-backed Uint8Array,
      // but it works correctly at runtime per WebGPU spec
      device.queue.writeBuffer(framebufferBuffer, 0, memory as unknown as BufferSource, FRAMEBUFFER_START, FRAMEBUFFER_SIZE);
      device.queue.writeBuffer(paletteBuffer, 0, memory as unknown as BufferSource, PALETTE_RAM_START, PALETTE_RAM_SIZE);
      device.queue.writeBuffer(scanlineMapBuffer, 0, memory as unknown as BufferSource, SCANLINE_MAP_START, SCANLINE_MAP_SIZE);

      // Create command encoder
      const commandEncoder = device.createCommandEncoder();

      // Get current texture to render to
      const textureView = context.getCurrentTexture().createView();

      // Create render pass
      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: textureView,
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      });

      renderPass.setPipeline(pipeline);
      renderPass.setBindGroup(0, bindGroup);
      renderPass.draw(6); // 6 vertices for 2 triangles (fullscreen quad)
      renderPass.end();

      // Submit commands
      device.queue.submit([commandEncoder.finish()]);
    }

    // Poll gamepad state and update controller registers at 60Hz
    pollGamepads(memory);

    // ALWAYS set VBlank interrupt flag in INT_STATUS (0x0114)
    // This fires even when not visible to keep CPU timing consistent
    // Use Atomics.or to set bit 0 atomically for thread safety
    const INT_STATUS_ADDR = 0x0114;
    Atomics.or(memory, INT_STATUS_ADDR, 0x01);

    // Schedule next frame
    animationFrameId = requestAnimationFrame(renderFrame);
  }

  const stop = () => {
      isActive = false;
      if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
      }
  };


  // Initialize keyboard input for controller emulation
  initKeyboardInput();

  // Return renderer interface
  return {
    start() {
      if (!isActive) {
        isActive = true;
        lastFrameTime = performance.now();
        animationFrameId = requestAnimationFrame(renderFrame);
      }
    },

    stop,

    destroy() {
      stop();
      cleanupKeyboardInput();
      framebufferBuffer.destroy();
      paletteBuffer.destroy();
      scanlineMapBuffer.destroy();
      spriteOverlayBuffer.destroy();
      spriteMaskBuffer.destroy();
      tilemapOverlayBuffer.destroy();
      tilemapMaskBuffer.destroy();
      // Unconfigure the context to release WebGPU resources
      if (context) {
        context.unconfigure();
      }
    },

    isRunning() {
      return isActive;
    },

    setVisible(visible: boolean) {
      isVisible = visible;
    },

    getSpriteRenderer(): SpriteRenderer | null {
      return spriteRenderer;
    },

    getTilemapRenderer(): TilemapRenderer | null {
      return tilemapRenderer;
    },

    async captureFrame(): Promise<string> {
      console.log('📸 Capturing frame from WebGPU canvas...');

      // Wait for all GPU work to complete
      await device.queue.onSubmittedWorkDone();
      console.log('📸 GPU work completed');

      // Wait for the next animation frame to ensure the browser has presented the content
      return new Promise((resolve, reject) => {
        requestAnimationFrame(() => {
          try {
            console.log('📸 Capturing after frame presentation...');
            // Now the canvas should have the WebGPU-rendered content
            const dataURL = canvas.toDataURL('image/png');
            console.log('📸 Captured PNG data URL, length:', dataURL.length);
            resolve(dataURL);
          } catch (error) {
            console.error('📸 Error capturing canvas:', error);
            reject(error);
          }
        });
      });
    },
  };
}

/**
 * WebGPU Renderer for Virtual Console Framebuffer
 *
 * Renders Mode 0 (256×160 @ 4bpp) with scanline palette mapping.
 * Runs at 60fps using requestAnimationFrame.
 */

// Memory layout constants for Mode 0
const FRAMEBUFFER_START = 0xB000;
const FRAMEBUFFER_SIZE = 0x5000; // 20,480 bytes
const PALETTE_RAM_START = 0x0200;
const PALETTE_RAM_SIZE = 0x0400; // 1024 bytes
const SCANLINE_MAP_START = 0x0600;
const SCANLINE_MAP_SIZE = 0x0100; // 256 bytes

const TARGET_FPS = 60;
const FRAME_TIME = 1000 / TARGET_FPS;

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
}

/**
 * Create a WebGPU renderer for the virtual console framebuffer
 */
export async function createWebGPURenderer(
  canvas: HTMLCanvasElement,
  sharedMemory: SharedArrayBuffer
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

  // Shader code with embedded 256-color Tailwind palette
  const shaderCode = `
// Tailwind 256-color palette (RGB values 0-255)
const PALETTE: array<vec3f, 256> = array<vec3f, 256>(
  // red - row 0
  vec3f(254, 242, 242), vec3f(255, 226, 226), vec3f(255, 201, 201), vec3f(255, 162, 162), vec3f(255, 100, 103), vec3f(255, 57, 66), vec3f(241, 31, 47), vec3f(208, 6, 33), vec3f(173, 0, 27), vec3f(145, 0, 23), vec3f(83, 0, 16),
  // orange - row 1
  vec3f(255, 251, 235), vec3f(255, 244, 214), vec3f(255, 232, 176), vec3f(255, 214, 130), vec3f(255, 184, 72), vec3f(255, 161, 46), vec3f(247, 132, 24), vec3f(207, 99, 5), vec3f(169, 74, 1), vec3f(139, 57, 2), vec3f(85, 33, 2),
  // amber - row 2
  vec3f(255, 252, 231), vec3f(255, 247, 195), vec3f(254, 237, 150), vec3f(255, 224, 102), vec3f(255, 208, 65), vec3f(255, 188, 51), vec3f(248, 157, 30), vec3f(209, 120, 10), vec3f(173, 93, 3), vec3f(145, 74, 4), vec3f(90, 45, 1),
  // yellow - row 3
  vec3f(255, 254, 234), vec3f(254, 252, 197), vec3f(254, 245, 140), vec3f(255, 235, 87), vec3f(255, 222, 54), vec3f(254, 203, 44), vec3f(248, 166, 26), vec3f(209, 125, 6), vec3f(175, 98, 3), vec3f(147, 79, 5), vec3f(92, 49, 3),
  // lime - row 4
  vec3f(253, 255, 233), vec3f(247, 255, 199), vec3f(235, 252, 156), vec3f(217, 248, 105), vec3f(194, 240, 64), vec3f(168, 228, 51), vec3f(138, 202, 31), vec3f(111, 168, 12), vec3f(91, 141, 5), vec3f(77, 122, 4), vec3f(49, 84, 2),
  // green - row 5
  vec3f(247, 254, 231), vec3f(235, 251, 210), vec3f(214, 246, 178), vec3f(183, 238, 140), vec3f(141, 224, 95), vec3f(105, 209, 76), vec3f(74, 182, 63), vec3f(53, 153, 53), vec3f(38, 128, 45), vec3f(29, 110, 41), vec3f(15, 75, 28),
  // emerald - row 6
  vec3f(236, 253, 245), vec3f(212, 250, 230), vec3f(178, 245, 209), vec3f(137, 237, 183), vec3f(89, 224, 152), vec3f(56, 209, 133), vec3f(38, 184, 118), vec3f(27, 157, 107), vec3f(18, 131, 94), vec3f(13, 111, 83), vec3f(6, 76, 59),
  // teal - row 7
  vec3f(241, 254, 253), vec3f(205, 251, 250), vec3f(154, 246, 246), vec3f(102, 239, 245), vec3f(53, 226, 239), vec3f(29, 210, 228), vec3f(20, 183, 206), vec3f(14, 156, 180), vec3f(11, 130, 156), vec3f(9, 112, 138), vec3f(6, 81, 104),
  // cyan - row 8
  vec3f(237, 254, 255), vec3f(206, 251, 254), vec3f(164, 247, 254), vec3f(113, 240, 254), vec3f(56, 228, 254), vec3f(30, 214, 248), vec3f(22, 189, 225), vec3f(16, 164, 200), vec3f(13, 140, 176), vec3f(10, 121, 157), vec3f(8, 94, 128),
  // sky - row 9
  vec3f(241, 251, 255), vec3f(226, 244, 255), vec3f(188, 232, 255), vec3f(138, 218, 255), vec3f(89, 199, 255), vec3f(60, 182, 254), vec3f(42, 157, 230), vec3f(28, 133, 202), vec3f(19, 113, 177), vec3f(14, 97, 156), vec3f(9, 73, 122),
  // blue - row 10
  vec3f(239, 246, 255), vec3f(222, 235, 255), vec3f(192, 219, 255), vec3f(151, 199, 255), vec3f(109, 173, 255), vec3f(81, 151, 255), vec3f(62, 130, 247), vec3f(50, 112, 223), vec3f(40, 92, 191), vec3f(33, 77, 166), vec3f(22, 53, 123),
  // indigo - row 11
  vec3f(239, 243, 255), vec3f(225, 231, 255), vec3f(200, 211, 255), vec3f(166, 184, 255), vec3f(128, 152, 255), vec3f(103, 127, 254), vec3f(84, 106, 240), vec3f(72, 90, 216), vec3f(60, 73, 187), vec3f(50, 61, 163), vec3f(32, 38, 118),
  // violet - row 12
  vec3f(246, 245, 255), vec3f(238, 235, 254), vec3f(224, 218, 254), vec3f(199, 193, 255), vec3f(170, 159, 255), vec3f(146, 131, 254), vec3f(129, 110, 246), vec3f(115, 94, 228), vec3f(99, 78, 204), vec3f(85, 63, 179), vec3f(61, 41, 139),
  // purple - row 13
  vec3f(251, 245, 255), vec3f(245, 234, 255), vec3f(233, 218, 255), vec3f(215, 195, 255), vec3f(188, 164, 254), vec3f(167, 139, 250), vec3f(150, 118, 241), vec3f(133, 98, 224), vec3f(116, 79, 202), vec3f(100, 62, 179), vec3f(72, 40, 142),
  // fuchsia - row 14
  vec3f(253, 244, 255), vec3f(250, 232, 255), vec3f(243, 216, 255), vec3f(232, 193, 254), vec3f(217, 162, 254), vec3f(205, 138, 254), vec3f(192, 117, 248), vec3f(175, 96, 231), vec3f(155, 75, 207), vec3f(136, 56, 183), vec3f(105, 36, 146),
  // pink - row 15
  vec3f(254, 243, 255), vec3f(252, 232, 254), vec3f(246, 215, 254), vec3f(238, 191, 254), vec3f(227, 160, 254), vec3f(219, 137, 254), vec3f(207, 118, 248), vec3f(190, 97, 230), vec3f(170, 75, 207), vec3f(151, 56, 183), vec3f(115, 35, 142),
  // rose - row 16
  vec3f(254, 242, 249), vec3f(252, 231, 243), vec3f(251, 213, 235), vec3f(250, 189, 225), vec3f(246, 156, 211), vec3f(244, 133, 201), vec3f(238, 112, 189), vec3f(224, 88, 171), vec3f(204, 66, 151), vec3f(183, 46, 131), vec3f(142, 24, 100),
  // pink - row 17
  vec3f(255, 242, 246), vec3f(255, 228, 236), vec3f(254, 208, 224), vec3f(252, 182, 209), vec3f(249, 147, 189), vec3f(246, 122, 175), vec3f(239, 101, 162), vec3f(222, 78, 143), vec3f(197, 56, 121), vec3f(176, 37, 104), vec3f(134, 19, 77),
  // slate - row 18
  vec3f(252, 249, 251), vec3f(247, 243, 248), vec3f(239, 236, 244), vec3f(225, 223, 237), vec3f(186, 186, 214), vec3f(147, 148, 187), vec3f(115, 117, 163), vec3f(93, 96, 146), vec3f(68, 73, 125), vec3f(49, 54, 109), vec3f(30, 33, 82),
  // gray - row 19
  vec3f(252, 252, 253), vec3f(248, 249, 251), vec3f(241, 243, 247), vec3f(227, 231, 239), vec3f(187, 193, 209), vec3f(146, 153, 178), vec3f(115, 123, 151), vec3f(93, 102, 133), vec3f(68, 76, 107), vec3f(50, 58, 87), vec3f(30, 36, 65),
  // zinc - row 20
  vec3f(252, 252, 253), vec3f(249, 249, 251), vec3f(240, 240, 245), vec3f(228, 228, 235), vec3f(187, 188, 201), vec3f(146, 147, 166), vec3f(113, 114, 137), vec3f(92, 93, 118), vec3f(66, 67, 91), vec3f(49, 50, 70), vec3f(33, 34, 51),
  // neutral - row 21
  vec3f(252, 252, 253), vec3f(250, 250, 250), vec3f(241, 241, 241), vec3f(229, 229, 229), vec3f(189, 189, 189), vec3f(148, 148, 148), vec3f(113, 113, 113), vec3f(93, 93, 93), vec3f(66, 66, 66), vec3f(49, 49, 49), vec3f(35, 35, 35),
  // stone - row 22
  vec3f(252, 252, 251), vec3f(250, 250, 249), vec3f(241, 241, 239), vec3f(229, 229, 226), vec3f(189, 189, 185), vec3f(148, 148, 143), vec3f(115, 115, 109), vec3f(94, 94, 88), vec3f(66, 66, 61), vec3f(52, 52, 47), vec3f(35, 35, 31),
  // black/white - row 23
  vec3f(0, 0, 0), vec3f(0, 0, 0), vec3f(255, 255, 255)
);

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

  // Calculate framebuffer byte address (4bpp = 2 pixels per byte)
  let pixelIndex = y * 256u + x;
  let byteIndex = pixelIndex / 2u;
  let byte = readByte(&framebuffer, byteIndex);

  // Extract 4-bit color index
  // Even pixels (x=0,2,4...) use HIGH nibble (bits 4-7)
  // Odd pixels (x=1,3,5...) use LOW nibble (bits 0-3)
  var colorIndex: u32;
  if ((pixelIndex & 1u) == 0u) {
    colorIndex = (byte >> 4u) & 0xFu; // High nibble (even pixel)
  } else {
    colorIndex = byte & 0xFu; // Low nibble (odd pixel)
  }

  // Get palette selector for this scanline
  let paletteSelector = readByte(&scanlineMap, y);

  // Calculate palette RAM address
  // Each palette is 16 bytes (16 colors for 4bpp)
  let paletteIndex = paletteSelector * 16u + colorIndex;
  let masterPaletteIndex = readByte(&paletteRam, paletteIndex);

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
      framebufferBuffer.destroy();
      paletteBuffer.destroy();
      scanlineMapBuffer.destroy();
    },

    isRunning() {
      return isActive;
    },

    setVisible(visible: boolean) {
      isVisible = visible;
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

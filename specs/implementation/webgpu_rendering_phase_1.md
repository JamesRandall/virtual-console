# Rendering the frame buffer with WebGPU

We want to use WebGPU to render the frame buffer of our virtual console into a HTML canvas element.

Begin by reading these files:

./specs/hardware/cpu.md
./specs/hardware/memory-layout.md
./specs/hardware/video.md
./src/devkit/react-guidelines.md

Our virtual console is set up with the CPU in a web worker sharing memory with the browsers UI thread with a SharedArrayBuffer:

/Users/jamesrandall/code/virtual-console/src/devkit/src/consoleIntegration/cpuWorker.ts

And our canvas is in this component:

/Users/jamesrandall/code/virtual-console/src/devkit/src/application/ConsoleView.tsx

We want our rendering to run at 60fps and be based around the requestAnimationFrame capability of the browser. Rendering should run at 60fps regardless of the frame deltas - i.e. on a 120fps display we should still only update the display at 60fps. On each frame it should capture the appropriate section of memory (see specification) and send that byte array to WebGPU.

You can focus solely on mode 0 (256×160 @ 4bpp) for this implementation.

The byte array contains indexed colours and the current palette mappings should be read from the memory map. The WebGPU shader should resolve these indexes at render time and, ideally, "hard code" the full palette

We want the output to fill the canvas and if any scaling takes place it should maintain the pixellated look.

You should split the rendering code into two parts:

* React code: this code should be placed inside the devkit at /src/devkit/src/consoleIntegration/FrameBufferRendering.tsx
* WebGPU code: this code should be placed inside the devkit at /src/devkit/src/consoleIntegration/webgpuRendering.ts

Ask me any questions you have before proceeding with implementation.
# Preload the memory map with the default palette and screen mode

Begin by reading the following files:

./specs/hardware/cpu.md
./specs/hardware/memory-layout.md
./specs/hardware/video.md
./specs/typescript-guide.md
./src/console/src/cpu.ts
./src/console/src/memoryBus.ts

Create a new file called palette.ts in the src/console/src directory and implement methods to support the following via a "setVideoMode" method.

Our default screen mode is mode 0 and should be set in the VIDEO_MODE register as described in the memory map.

When screen mode 0 or 3 is set the palette memory space is loaded with the default palette for 4bpp mode as described in video.md. This should be 64 instances (as per the spec) of the same default palette.

When screen mode 1 or 2 is set the palette memory space is loaded with the default palette for 8bpp mode. This is a linear index from 0 to 255 (i.e. first index is 0, next index is 1, etc.)

Each scanline palette map address should be set to 0 - indicating the first palette.

Finally update the CPU so that when it is reset it will call the setVideoMode method and set to 0 - the default mode.
# Virtual Console

This folder contains the specifications and source code for a virtual console that will be built using TypeScript and that will run in a browser. Our surrounding user interface and tools will be written in React using Zustand.

The console is 8-bit and very loosely 6502 inspired albeit with a RISC style twist on the instruction set. The hardware is constrained by the 8-bit nature of the system but is fairly complete and powerful for such a system featuring:

* A 3Mhz 6502 inspired CPU with a RISC twist
* 8bpp and 4bpp screen modes
* Access to linear video RAM
* Hardware sprites
* Tilemaps
* Collision detection
* Multi-channel audio

The code should be implemented using TypeScript for which you can find a style guide in specs/typescript-guide.md.

The folder structure is as follows

|Folder|Comments|
|------|--------|
|specs/hardware|Contains specifications of the hardware for the console|
|specs/implementation|Specific instructions on how to implement parts of the console|
|specs/tools|Specifications for tools associated with the console (e.g. assemblers, compilers, graphics libraries)|
|src/console|The source files for the console hardware. Files in this folder should be platform agnostic and able to run both in the browser and in environments such as node|
|src/devkit|A react project for the consoles development kit. This presents a website that hosts the console alongside tools for developing games|
|src/website|A public facing website for the project. Runs demo cartridges for the console, gives an overview of the project.


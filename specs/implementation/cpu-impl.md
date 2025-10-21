# CPU Implementation

Read the below files in order (paths are provided relative to the repository root):

* README.md
* The TypeScript style guidelines that can be found at specs/typescript-guide.md.
* The CPU specification that can be found at specs/hardware/cpu.md.

Now proceed with the CPU implementation. It should be created as a TypeScript class with a bus to allow me to interface it to memory. Timing will be externally controlled (we'll be running at 3 Mhz). The class should be in a file at src/console/cpu.ts.

We will need a way of connecting the CPU to memory and so a basic memory bus class should be created to allow this in src/console/memoryBus.ts.


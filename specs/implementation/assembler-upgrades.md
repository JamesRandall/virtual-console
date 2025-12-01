# Assembler Upgrades

We are going to upgrade the assembler to support multiple source files. Begin by reading the following:

    /Users/jamesrandall/code/virtual-console/specs/hardware/cpu.md
    /Users/jamesrandall/code/virtual-console/specs/tools/assembler.md
    /Users/jamesrandall/code/virtual-console/src/console/src/assembler.ts
    //Users/jamesrandall/code/virtual-console/src/devkit/client/src/*

We want to rework our assembler so that it:

* Understands that main.asm is the entry point to the assembly process
* We add a .includes directive to allow additional source files to be included e.g.
    .include './runtime.asm'
* Paths are relative to the source file calling .include
* We should ensure that if a .include for a file occurs more than once, it is only included once (this will require us to check the resolved path)
* We need to track global labels and symbols
* We need to be able to set breakpoints in multiple files

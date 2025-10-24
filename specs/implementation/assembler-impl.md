# Assembler Implementation

Read the below files in order (paths are provided relative to the repository root):

* README.md
* The TypeScript style guidelines that can be found at specs/typescript-guide.md.
* The CPU specification that can be found at specs/hardware/cpu.md.
* The CPU implementation that can be found at src/console/src/cpu.ts
* The assembler specification that can be found at specs/tools/assembler.md

Your task is to implement the assembler as defined in the specification.

The output should be a single, contained, module in src/console/src/assembler.ts that exposes an exported function called assemble. This should take a string containing the assembly code and return a type that includes the machine code in a memory map and associated artifacts (such as source and symbol maps). For example:

export function assemble(assemblyCode: string) : AssembledArtifacts {
    // ...
}

Read the implementation and then ask me any clarifying questions.


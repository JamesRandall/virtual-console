# CPU Tests

We want to create a test suite for the CPU class that you will find in src/console/cpu.ts

You should base the test suite on the specification you can find for the CPU in specs/hardware/cpu.md and only use the source code for the CPU as a guide as to what methods to call to drive the tests and perform the assertions.

You should construct the tests on a per opcode and addressing mode basis, being sure to cover all valid addressing modes for each opcode and frame the tests like this:

1. Construct a memory bus containing the byte code for the instruction under test
2. Set the program counter to point to this byte code
3. Run the instruction in the CPU

Having done that we want to assert for a few things:

1. That the status flags are as defined in the specification following the operation
2. That the stack contents is as defined in the specification following the operation
3. That the cycle consumed by the instruction are as defined in the specification
4. That the content of registers is as expected
5. That the contents of any referenced memory is as expected

Implement the tests using vitest and be sure to follow the TypeScript style guide you can find at specs/typescript-guide.md

We want the tests to be independent of the other components of our solution so that we can add more tests for more virtual hardware and run them in isolation.

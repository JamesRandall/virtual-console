# Virtual Console Core

This directory contains the core CPU and memory bus implementation for the virtual console.

## Testing

The test suite uses [Vitest](https://vitest.dev/) and provides comprehensive coverage of the CPU implementation based on the CPU specification in `specs/hardware/cpu.md`.

### Running Tests

```bash
# Run tests once
npm test -- --run

# Run tests in watch mode
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### Test Structure

Tests are organized by opcode and addressing mode, validating:
- Status flag behavior (Carry, Zero, Negative, Overflow)
- Cycle counts per instruction
- Register state changes
- Memory operations
- Stack operations

All 75 tests cover every instruction and addressing mode defined in the CPU specification.

## Building

The TypeScript configuration excludes test files from the build output. To compile:

```bash
npx tsc --project .
```

The compiled output will be in `../../dist/console/`.

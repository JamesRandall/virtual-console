/**
 * Run Mode Component
 * Executes and displays program execution
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { CPU } from '../../../console/src/cpu';
import { MemoryBus } from '../../../console/src/memoryBus';
import { HexViewer } from './HexViewer';
import { RegisterDisplay } from './RegisterDisplay';
import { disassemble } from './disassembler';
import { programs } from './programs';

interface RunModeProps {
  programIndex: number;
  onExit: () => void;
}

const PROGRAM_START = 0x20; // Programs start at byte 32
const STACK_TOP = 0x7F; // Stack at end of 128-byte space

export const RunMode: React.FC<RunModeProps> = ({ programIndex, onExit }) => {
  const [bus] = useState(() => new MemoryBus());
  const [cpu] = useState(() => new CPU(bus));
  const [updateCounter, setUpdateCounter] = useState(0);
  const [programFinished, setProgramFinished] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize the program
  useEffect(() => {
    const program = programs[programIndex];

    // Reset memory and CPU
    bus.reset();
    cpu.reset();

    // Load initial data if the program needs it
    if (program.data) {
      for (let i = 0; i < program.data.length; i++) {
        bus.write8(i, program.data[i]);
      }
    }

    // Load program at PROGRAM_START
    for (let i = 0; i < program.code.length; i++) {
      bus.write8(PROGRAM_START + i, program.code[i]);
    }

    // Set PC to start of program
    cpu.setProgramCounter(PROGRAM_START);

    // Override stack pointer to be within our viewing window (end of 128 bytes)
    cpu.setStackPointer(STACK_TOP);

    setProgramFinished(false);
    setErrorMessage(null);
    // Force a render to show the initialized program
    setUpdateCounter(1);
  }, [programIndex, bus, cpu]);

  useInput((input, key) => {
    if (errorMessage || programFinished) {
      // If error or finished, any key returns to menu
      onExit();
      return;
    }

    if (key.escape) {
      onExit();
      return;
    }

    if (input === ' ' || key.return) {
      // Step the CPU
      try {
        const pc = cpu.getProgramCounter();
        const opcode = bus.read8(pc);

        // Check for NOP (program finished)
        if (opcode === 0x02) {
          // NOP is encoded as 0x02 0x00
          setProgramFinished(true);
          return;
        }

        cpu.step();
        setUpdateCounter((c) => c + 1);
      } catch (error) {
        if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage('Unknown error occurred');
        }
      }
    }
  });

  const pc = cpu.getProgramCounter();
  const { mnemonic } = disassemble(bus, pc);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>
        Running: {programs[programIndex].name}
      </Text>
      <Text dimColor>
        {errorMessage
          ? 'Press any key to return to menu'
          : programFinished
          ? 'Program finished - Press any key to return to menu'
          : 'Press Space or Enter to step, Esc to return to menu'}
      </Text>
      <Text> </Text>

      {errorMessage ? (
        <Box flexDirection="column">
          <Text color="red" bold>
            Error: {errorMessage}
          </Text>
        </Box>
      ) : (
        <>
          <HexViewer bus={bus} pc={pc} />
          <Text> </Text>
          <RegisterDisplay cpu={cpu} />
          <Text> </Text>
          <Text>
            Current instruction: <Text bold color="cyan">{mnemonic}</Text>
          </Text>
          {programFinished && (
            <Text color="green" bold>
              Program finished!
            </Text>
          )}
        </>
      )}
    </Box>
  );
};

/**
 * Register Display Component
 * Shows CPU registers and status flags
 */

import React from 'react';
import { Box, Text } from 'ink';
import { CPU } from './cpu.js';

interface RegisterDisplayProps {
  cpu: CPU;
}

export const RegisterDisplay: React.FC<RegisterDisplayProps> = ({ cpu }) => {
  const registers = [];

  // Display R0-R5
  for (let i = 0; i < 6; i++) {
    const value = cpu.getRegister(i);
    registers.push(
      <Text key={i}>
        R{i}: 0x{value.toString(16).padStart(2, '0').toUpperCase()} ({value.toString().padStart(3, ' ')})
      </Text>
    );
  }

  const sp = cpu.getStackPointer();
  const pc = cpu.getProgramCounter();
  const status = cpu.getStatus();

  // Extract status flags
  const carry = (status & 0x01) !== 0 ? 1 : 0;
  const zero = (status & 0x02) !== 0 ? 1 : 0;
  const negative = (status & 0x80) !== 0 ? 1 : 0;
  const overflow = (status & 0x40) !== 0 ? 1 : 0;

  return (
    <Box flexDirection="column">
      <Box>{registers}</Box>
      <Text>
        SP: 0x{sp.toString(16).padStart(4, '0').toUpperCase()} ({sp.toString().padStart(5, ' ')})
        PC: 0x{pc.toString(16).padStart(4, '0').toUpperCase()} ({pc.toString().padStart(5, ' ')})
      </Text>
      <Text>C={carry} Z={zero} N={negative} V={overflow}</Text>
    </Box>
  );
};

/**
 * Hex Viewer Component
 * Displays memory in hex dump format with ASCII view
 */

import React from 'react';
import { Box, Text } from 'ink';
import { MemoryBus } from './memoryBus.js';

interface HexViewerProps {
  bus: MemoryBus;
  pc: number;
}

const BYTES_PER_ROW = 8;
const NUM_ROWS = 16;
const START_ADDRESS = 0x0000;

export const HexViewer: React.FC<HexViewerProps> = ({ bus, pc }) => {
  const rows: JSX.Element[] = [];

  for (let row = 0; row < NUM_ROWS; row++) {
    const address = START_ADDRESS + row * BYTES_PER_ROW;
    const bytes: JSX.Element[] = [];
    const ascii: JSX.Element[] = [];

    for (let col = 0; col < BYTES_PER_ROW; col++) {
      const byteAddr = address + col;
      const value = bus.read8(byteAddr);
      const isPC = byteAddr === pc;

      // Hex display
      const hexStr = value.toString(16).padStart(2, '0').toUpperCase();
      bytes.push(
        <Text key={col} color={isPC ? 'red' : undefined} bold={isPC}>
          {hexStr}{col < BYTES_PER_ROW - 1 ? ' ' : ''}
        </Text>
      );

      // ASCII display
      const isPrintable = value >= 0x20 && value <= 0x7E;
      const char = isPrintable ? String.fromCharCode(value) : '.';
      ascii.push(
        <Text key={col} color={isPC ? 'red' : isPrintable ? undefined : 'gray'} bold={isPC}>
          {char}
        </Text>
      );
    }

    rows.push(
      <Box key={row}>
        <Text>{address.toString(16).padStart(4, '0').toUpperCase()}   </Text>
        {bytes}
        <Text>    </Text>
        {ascii}
      </Box>
    );
  }

  return <Box flexDirection="column">{rows}</Box>;
};

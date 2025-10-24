/**
 * Menu Component
 * Displays program selection menu
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { programs } from './programs';

interface MenuProps {
  onSelect: (index: number) => void;
  onExit: () => void;
}

export const Menu: React.FC<MenuProps> = ({ onSelect, onExit }) => {
  const [selected, setSelected] = useState(0);

  useInput((input, key) => {
    if (key.escape) {
      onExit();
      return;
    }

    if (key.upArrow) {
      setSelected((prev) => (prev > 0 ? prev - 1 : programs.length - 1));
    } else if (key.downArrow) {
      setSelected((prev) => (prev < programs.length - 1 ? prev + 1 : 0));
    } else if (key.return) {
      onSelect(selected);
    } else if (input >= '0' && input <= '9') {
      const num = parseInt(input, 10);
      if (num < programs.length) {
        onSelect(num);
      }
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>CPU Example Programs</Text>
      <Text dimColor>Select a program to run (use arrow keys or number, press Enter to confirm, Esc to exit)</Text>
      <Text> </Text>
      {programs.map((program, index) => (
        <Text key={index} color={selected === index ? 'green' : undefined}>
          {selected === index ? '> ' : '  '}
          {index}. {program.name}
        </Text>
      ))}
      <Text> </Text>
      <Text dimColor>Press Esc to exit</Text>
    </Box>
  );
};

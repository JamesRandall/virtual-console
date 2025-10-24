/**
 * Main App Component
 * Manages navigation between menu and run mode
 */

import React, { useState } from 'react';
import { Menu } from './Menu';
import { RunMode } from './RunMode';

type AppMode = 'menu' | 'run';

export const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('menu');
  const [selectedProgram, setSelectedProgram] = useState<number>(0);

  const handleSelectProgram = (index: number): void => {
    setSelectedProgram(index);
    setMode('run');
  };

  const handleExit = (): void => {
    setMode('menu');
  };

  if (mode === 'menu') {
    return <Menu onSelect={handleSelectProgram} onExit={() => process.exit(0)} />;
  } else {
    return <RunMode programIndex={selectedProgram} onExit={handleExit} />;
  }
};

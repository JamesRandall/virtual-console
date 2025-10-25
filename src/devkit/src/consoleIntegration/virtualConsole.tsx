import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { VirtualConsole } from '../../../console/src/virtualConsole';

interface VirtualConsoleContextValue {
  console: VirtualConsole;
}

const VirtualConsoleContext = createContext<VirtualConsoleContextValue | undefined>(undefined);

interface VirtualConsoleProviderProps {
  children: ReactNode;
}

export const VirtualConsoleProvider: React.FC<VirtualConsoleProviderProps> = ({ children }) => {
  const console = useMemo(() => new VirtualConsole(), []);

  const value = useMemo(() => ({ console }), [console]);

  return (
    <VirtualConsoleContext.Provider value={value}>
      {children}
    </VirtualConsoleContext.Provider>
  );
};

export const useVirtualConsole = (): VirtualConsole => {
  const context = useContext(VirtualConsoleContext);

  if (context === undefined) {
    throw new Error('useVirtualConsole must be used within a VirtualConsoleProvider');
  }

  return context.console;
};

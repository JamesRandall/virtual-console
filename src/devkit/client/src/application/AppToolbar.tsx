import { useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faStop, faBars, faComments } from '@fortawesome/free-solid-svg-icons';
import { useDevkitStore } from '../stores/devkitStore';
import { useVirtualConsole } from '../consoleIntegration/virtualConsole';
import { updateVirtualConsoleSnapshot } from '../stores/utilities';
import { assemble } from '../../../../console/src/assembler';

export function AppToolbar() {
  // Zustand store hooks
  const appMode = useDevkitStore((state) => state.appMode);
  const setAppMode = useDevkitStore((state) => state.setAppMode);
  const openFiles = useDevkitStore((state) => state.openFiles);
  const showProjectExplorer = useDevkitStore((state) => state.showProjectExplorer);
  const showChat = useDevkitStore((state) => state.showChat);
  const toggleProjectExplorer = useDevkitStore((state) => state.toggleProjectExplorer);
  const toggleChat = useDevkitStore((state) => state.toggleChat);
  const setSourceMap = useDevkitStore((state) => state.setSourceMap);
  const setSymbolTable = useDevkitStore((state) => state.setSymbolTable);
  const updateBreakpointAddresses = useDevkitStore((state) => state.updateBreakpointAddresses);
  const setCodeChangedSinceAssembly = useDevkitStore((state) => state.setCodeChangedSinceAssembly);
  const updateMemorySnapshot = useDevkitStore((state) => state.updateMemorySnapshot);
  const updateCpuSnapshot = useDevkitStore((state) => state.updateCpuSnapshot);

  // Virtual console hook
  const virtualConsole = useVirtualConsole();

  // Event handlers
  const handleRun = useCallback(async () => {
    // Find main.asm
    const mainAsmFile = openFiles.find(f => f.path === 'src/main.asm');

    if (!mainAsmFile) {
      alert('main.asm not found. Please ensure main.asm exists in the src folder.');
      return;
    }

    try {
      // Assemble the code
      const result = assemble(mainAsmFile.content);

      // Check for errors
      if (result.errors.length > 0) {
        const errorMessages = result.errors
          .map(err => `Line ${err.line}: ${err.message}`)
          .join('\n');
        alert(`Assembly failed with ${result.errors.length} error(s):\n\n${errorMessages}`);
        return;
      }

      // Load the assembled code into memory
      for (const segment of result.segments) {
        for (let i = 0; i < segment.data.length; i++) {
          virtualConsole.memory.write8(segment.startAddress + i, segment.data[i]);
        }
      }

      // Set program counter to the start of the first segment
      if (result.segments.length > 0) {
        virtualConsole.setProgramCounter(result.segments[0].startAddress);
      }

      // Store source map and symbol table
      setSourceMap(result.sourceMap);
      setSymbolTable(result.symbolTable);

      // Update breakpoint addresses based on new source map
      updateBreakpointAddresses(result.sourceMap);

      // Clear the code changed flag since we just assembled
      setCodeChangedSinceAssembly(false);

      // Update snapshots
      await updateVirtualConsoleSnapshot(virtualConsole, updateMemorySnapshot, updateCpuSnapshot);

      // Switch to debug mode
      setAppMode('debug');
    } catch (error) {
      console.error('Unexpected error assembling code:', error);
      alert('Failed to assemble code: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }, [
    openFiles,
    virtualConsole,
    setSourceMap,
    setSymbolTable,
    updateBreakpointAddresses,
    setCodeChangedSinceAssembly,
    updateMemorySnapshot,
    updateCpuSnapshot,
    setAppMode,
  ]);

  const handleStop = useCallback(() => {
    // Switch back to edit mode
    setAppMode('edit');
  }, [setAppMode]);

  // Render
  return (
    <div className="dk-toolbar-app">
      <div className="flex items-center dk-gap-compact">
        <button
          onClick={toggleProjectExplorer}
          className={`dk-btn-icon ${
            showProjectExplorer
              ? 'dk-bg-hover text-white'
              : ''
          }`}
          title="Toggle project explorer"
        >
          <FontAwesomeIcon icon={faBars} />
        </button>
        <h1 className="dk-section-header">Virtual Console DevKit</h1>
        <span className="dk-tertiary-text">
          {appMode === 'edit' ? 'Edit Mode' : 'Debug Mode'}
        </span>
      </div>
      <div className="flex items-center dk-gap-small">
        {appMode === 'edit' ? (
          <button
            onClick={handleRun}
            className="dk-btn-icon"
            title="Assemble and run"
          >
            <FontAwesomeIcon icon={faPlay} />
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="dk-btn-icon"
            title="Stop and return to editor"
          >
            <FontAwesomeIcon icon={faStop} />
          </button>
        )}
        <button
          onClick={toggleChat}
          className={`dk-btn-icon ${
            showChat
              ? 'dk-bg-hover text-white'
              : ''
          }`}
          title="Toggle chat"
        >
          <FontAwesomeIcon icon={faComments} />
        </button>
      </div>
    </div>
  );
}

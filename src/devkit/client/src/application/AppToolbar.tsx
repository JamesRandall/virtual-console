import { useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faStop, faBars, faComments } from '@fortawesome/free-solid-svg-icons';
import { useDevkitStore } from '../stores/devkitStore';
import { useVirtualConsole } from '../consoleIntegration/virtualConsole';
import { updateVirtualConsoleSnapshot } from '../stores/utilities';
import { assembleMultiFile } from '../../../../console/src/assembler';
import { readAllSourceFiles } from '../services/fileSystemService';

export function AppToolbar() {
  // Zustand store hooks
  const appMode = useDevkitStore((state) => state.appMode);
  const setAppMode = useDevkitStore((state) => state.setAppMode);
  const openFiles = useDevkitStore((state) => state.openFiles);
  const currentProjectHandle = useDevkitStore((state) => state.currentProjectHandle);
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
    if (!currentProjectHandle) {
      alert('No project open. Please open a project first.');
      return;
    }

    try {
      // Read all source files from disk, including any not currently open
      const diskSourceFiles = await readAllSourceFiles(currentProjectHandle);

      // Merge with currently open (and potentially modified) files
      // Open files take precedence as they may have unsaved changes
      const sourceFiles = new Map(diskSourceFiles);
      for (const openFile of openFiles) {
        if (openFile.path.endsWith('.asm')) {
          sourceFiles.set(openFile.path, openFile.content);
        }
      }

      // Check that main.asm exists
      if (!sourceFiles.has('src/main.asm')) {
        alert('main.asm not found. Please ensure main.asm exists in the src folder.');
        return;
      }

      // Assemble all source files starting from main.asm
      const result = assembleMultiFile({
        sourceFiles,
        entryPoint: 'src/main.asm',
      });

      // Check for errors
      if (result.errors.length > 0) {
        const errorMessages = result.errors
          .map(err => {
            const fileInfo = err.file ? `${err.file}:` : '';
            return `${fileInfo}${err.line}: ${err.message}`;
          })
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
    currentProjectHandle,
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

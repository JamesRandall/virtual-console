import { useCallback, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faStop, faBars, faComments, faBox } from '@fortawesome/free-solid-svg-icons';
import { useDevkitStore } from '../stores/devkitStore';
import { useVirtualConsole } from '../consoleIntegration/virtualConsole';
import { updateVirtualConsoleSnapshot } from '../stores/utilities';
import { assembleMultiFile } from '../../../../console/src/assembler';
import { readAllSourceFiles, readBinaryFile } from '../services/fileSystemService';
import { buildCartridge, loadCartridgeCode, loadCartridgePalette } from '../services/cartridgeBundler';
import { toast } from '../components/Toast';

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
  const refreshProjectTree = useDevkitStore((state) => state.refreshProjectTree);
  const setSourceMap = useDevkitStore((state) => state.setSourceMap);
  const setSymbolTable = useDevkitStore((state) => state.setSymbolTable);
  const updateBreakpointAddresses = useDevkitStore((state) => state.updateBreakpointAddresses);
  const setCodeChangedSinceAssembly = useDevkitStore((state) => state.setCodeChangedSinceAssembly);
  const updateMemorySnapshot = useDevkitStore((state) => state.updateMemorySnapshot);
  const updateCpuSnapshot = useDevkitStore((state) => state.updateCpuSnapshot);
  const setIsConsoleRunning = useDevkitStore((state) => state.setIsConsoleRunning);

  // Virtual console hook
  const virtualConsole = useVirtualConsole();

  // Local state
  const [isBuilding, setIsBuilding] = useState(false);

  // Event handlers
  const handleBuild = useCallback(async () => {
    if (!currentProjectHandle) {
      toast.error('No project open. Please open a project first.');
      return;
    }

    setIsBuilding(true);

    try {
      const result = await buildCartridge(currentProjectHandle, openFiles);

      if (!result.success) {
        const errorMessages = result.errors.join('\n');
        console.error('Build failed:', errorMessages);
        toast.error(`Build failed:\n${errorMessages}`);
        return;
      }

      // Show success toast
      toast.success(`Build successful: ${result.bankCount} banks, ${result.romSize?.toLocaleString()} bytes`);

      if (result.warnings.length > 0) {
        console.warn('Build warnings:', result.warnings);
        toast.warning(result.warnings.join('\n'));
      }

      // Refresh the project tree to show the new ROM file
      refreshProjectTree();
    } catch (error) {
      console.error('Build error:', error);
      toast.error('Build failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsBuilding(false);
    }
  }, [currentProjectHandle, openFiles, refreshProjectTree]);

  const handleRun = useCallback(async () => {
    if (!currentProjectHandle) {
      toast.error('No project open. Please open a project first.');
      return;
    }

    try {
      // Step 1: Build the cartridge (assembles code and creates ROM)
      const buildResult = await buildCartridge(currentProjectHandle, openFiles);

      if (!buildResult.success) {
        const errorMessages = buildResult.errors.join('\n');
        toast.error(`Build failed:\n${errorMessages}`);
        return;
      }

      // Show build warnings if any
      if (buildResult.warnings.length > 0) {
        toast.warning(buildResult.warnings.join('\n'));
      }

      // Refresh project tree to show ROM file
      refreshProjectTree();

      // Step 2: Read the built cartridge ROM
      const rom = await readBinaryFile(currentProjectHandle, 'cartridge.rom');

      // Step 3: Mount cartridge ROM for runtime access to asset banks (sprites, palettes, etc.)
      await virtualConsole.mountCartridge(rom);

      // Step 4: Load code from ROM into memory using metadata
      const loadResult = loadCartridgeCode(rom, virtualConsole.memory);

      if (!loadResult) {
        toast.error('Failed to load cartridge: invalid ROM format');
        return;
      }

      // Step 5: Load palette from cartridge if present
      if (loadResult.firstPaletteBank !== 0xFF) {
        loadCartridgePalette(rom, loadResult.firstPaletteBank, virtualConsole.memory);
      }

      // Step 6: Set program counter to start address
      virtualConsole.setProgramCounter(loadResult.startAddress);

      // Step 7: Get source map and symbol table by re-assembling (for debugging)
      // We need these for breakpoints and source mapping
      const diskSourceFiles = await readAllSourceFiles(currentProjectHandle);
      const sourceFiles = new Map(diskSourceFiles);
      for (const openFile of openFiles) {
        if (openFile.path.endsWith('.asm')) {
          sourceFiles.set(openFile.path, openFile.content);
        }
      }

      const assemblyResult = assembleMultiFile({
        sourceFiles,
        entryPoint: 'src/main.asm',
      });

      // Store source map and symbol table for debugging
      setSourceMap(assemblyResult.sourceMap);
      setSymbolTable(assemblyResult.symbolTable);

      // Update breakpoint addresses based on source map
      updateBreakpointAddresses(assemblyResult.sourceMap);

      // Clear the code changed flag since we just assembled
      setCodeChangedSinceAssembly(false);

      // Update snapshots
      await updateVirtualConsoleSnapshot(virtualConsole, updateMemorySnapshot, updateCpuSnapshot);

      // Step 8: Switch to debug mode and auto-start the emulator
      setAppMode('debug');

      // Sync breakpoints to worker before starting
      // We need to get the fresh breakpoint addresses from the store since updateBreakpointAddresses
      // just updated them, but our closure still has the old value
      const currentBreakpointAddresses = useDevkitStore.getState().breakpointAddresses;
      virtualConsole.setBreakpoints(Array.from(currentBreakpointAddresses));

      // Start the emulator running
      virtualConsole.run();
      setIsConsoleRunning(true);

    } catch (error) {
      console.error('Unexpected error running:', error);
      toast.error('Failed to run: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }, [
    openFiles,
    currentProjectHandle,
    virtualConsole,
    refreshProjectTree,
    setSourceMap,
    setSymbolTable,
    updateBreakpointAddresses,
    setCodeChangedSinceAssembly,
    updateMemorySnapshot,
    updateCpuSnapshot,
    setAppMode,
    setIsConsoleRunning,
  ]);

  const handleStop = useCallback(async () => {
    // Pause the emulator
    virtualConsole.pause();
    setIsConsoleRunning(false);

    // Reset the CPU and wait for it to complete
    await virtualConsole.reset();

    // Clear debug state so PC marker doesn't show in editor
    setSourceMap([]);
    setSymbolTable({});

    // Switch back to edit mode
    setAppMode('edit');
  }, [virtualConsole, setIsConsoleRunning, setSourceMap, setSymbolTable, setAppMode]);

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
          <>
            <button
              onClick={handleBuild}
              disabled={isBuilding}
              className="dk-btn-icon dk-btn-disabled"
              title="Build cartridge ROM"
            >
              <FontAwesomeIcon icon={faBox} className={isBuilding ? 'animate-pulse' : ''} />
            </button>
            <button
              onClick={handleRun}
              className="dk-btn-icon"
              title="Assemble and run"
            >
              <FontAwesomeIcon icon={faPlay} />
            </button>
          </>
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

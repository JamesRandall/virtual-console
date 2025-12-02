import { useDevkitStore } from '../stores/devkitStore.js';
import { readFile } from './fileSystemService.js';

// Get editor content and state
export async function handleToolRequest(tool: string, parameters: Record<string, unknown>): Promise<unknown> {
  switch (tool) {
    case 'read_source_code':
      return await handleReadSourceCode();

    case 'update_source_code':
      return await handleUpdateSourceCode(parameters);

    case 'read_cpu_state':
      return await handleReadCpuState();

    case 'read_memory':
      return await handleReadMemory(parameters);

    case 'set_breakpoint':
      return await handleSetBreakpoint(parameters);

    case 'step_debugger':
      return await handleStepDebugger();

    case 'run_debugger':
      return await handleRunDebugger();

    case 'pause_debugger':
      return await handlePauseDebugger();

    case 'reset_console':
      return await handleResetConsole();

    case 'assemble_code':
      return await handleAssembleCode();

    case 'capture_screen':
      return await handleCaptureScreen();

    case 'list_project_files':
      return await handleListProjectFiles(parameters);

    case 'read_project_file':
      return await handleReadProjectFile(parameters);

    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}

async function handleReadSourceCode(): Promise<unknown> {
  // First, try to get content directly from the store (most reliable)
  const store = useDevkitStore.getState();
  const activeFile = store.openFiles.find(f => f.path === store.activeFilePath);

  if (activeFile && activeFile.content) {
    console.log('read_source_code: Got content from store for', activeFile.path);
    return {
      code: activeFile.content,
      filePath: activeFile.path,
    };
  }

  // Fallback: try the event-based approach for cursor position info
  return new Promise((resolve) => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      console.log('Received editor content response:', customEvent.detail);
      clearTimeout(timeout);
      resolve(customEvent.detail);
      window.removeEventListener('editor-content-response', handler);
    };

    window.addEventListener('editor-content-response', handler);

    const timeout = setTimeout(() => {
      window.removeEventListener('editor-content-response', handler);
      resolve({ code: '', error: 'No active file open' });
    }, 5000);

    const event = new CustomEvent('get-editor-content');
    window.dispatchEvent(event);
  });
}

async function handleUpdateSourceCode(parameters: Record<string, unknown>): Promise<unknown> {
  const { code, cursorLine, cursorColumn } = parameters as {
    code: string;
    cursorLine?: number;
    cursorColumn?: number;
  };

  return new Promise((resolve) => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      clearTimeout(timeout);
      resolve(customEvent.detail);
      window.removeEventListener('editor-content-updated', handler);
    };

    // Add listener BEFORE dispatching the event
    window.addEventListener('editor-content-updated', handler);

    // Timeout after 5 seconds
    const timeout = setTimeout(() => {
      window.removeEventListener('editor-content-updated', handler);
      resolve({ success: false, error: 'Timeout updating editor content' });
    }, 5000);

    // Now dispatch the event
    const event = new CustomEvent('set-editor-content', {
      detail: { code, cursorLine, cursorColumn }
    });
    window.dispatchEvent(event);
  });
}

async function handleReadCpuState(): Promise<unknown> {
  const snapshot = useDevkitStore.getState().cpuSnapshot;

  return {
    registers: Array.from(snapshot.registers),
    stackPointer: snapshot.stackPointer,
    programCounter: snapshot.programCounter,
    statusRegister: snapshot.statusRegister,
    cycleCount: snapshot.cycleCount,
  };
}

async function handleReadMemory(parameters: Record<string, unknown>): Promise<unknown> {
  const rawAddress = parameters.address as string | number;
  const rawLength = parameters.length as string | number;

  // Parse address - handle hex strings like "0xA000" or decimal
  let address: number;
  if (typeof rawAddress === 'string') {
    address = rawAddress.toLowerCase().startsWith('0x')
      ? parseInt(rawAddress, 16)
      : parseInt(rawAddress, 10);
  } else {
    address = rawAddress;
  }

  // Parse length - handle both string and number
  let length: number;
  if (typeof rawLength === 'string') {
    length = rawLength.toLowerCase().startsWith('0x')
      ? parseInt(rawLength, 16)
      : parseInt(rawLength, 10);
  } else {
    length = rawLength;
  }

  console.log('📖 Reading memory at address:', typeof rawAddress === 'string' ? rawAddress : `0x${address.toString(16)}`, '(parsed:', address, ') length:', length);

  if (isNaN(address) || address < 0 || address > 0xFFFF) {
    throw new Error('Address out of range (0x0000-0xFFFF)');
  }

  if (isNaN(length) || length < 1 || length > 1024) {
    throw new Error('Length out of range (1-1024)');
  }

  const memorySnapshot = useDevkitStore.getState().memorySnapshot;
  const data: number[] = [];

  for (let i = 0; i < length && address + i < memorySnapshot.length; i++) {
    data.push(memorySnapshot[address + i]);
  }

  return {
    address,
    length: data.length,
    data,
  };
}

async function handleSetBreakpoint(parameters: Record<string, unknown>): Promise<unknown> {
  const { line, enabled, file } = parameters as { line: number; enabled: boolean; file?: string };

  const store = useDevkitStore.getState();
  // Default to main.asm if no file specified
  const filePath = file || 'src/main.asm';
  const fileBreakpoints = store.breakpointsByFile.get(filePath) || new Set<number>();
  const hasBreakpoint = fileBreakpoints.has(line);

  if (enabled && !hasBreakpoint) {
    store.toggleBreakpoint(filePath, line);
    return { success: true, message: `Breakpoint set at ${filePath}:${line}` };
  } else if (!enabled && hasBreakpoint) {
    store.toggleBreakpoint(filePath, line);
    return { success: true, message: `Breakpoint cleared at ${filePath}:${line}` };
  }

  return { success: true, message: 'No change needed' };
}

async function handleStepDebugger(): Promise<unknown> {
  const event = new CustomEvent('debugger-step');
  window.dispatchEvent(event);

  return { success: true };
}

async function handleRunDebugger(): Promise<unknown> {
  const cpuSnapshot = useDevkitStore.getState().cpuSnapshot;
  console.log('🏃 Running debugger, PC before run:', cpuSnapshot.programCounter.toString(16));

  const event = new CustomEvent('debugger-run');
  window.dispatchEvent(event);

  return { success: true, programCounter: cpuSnapshot.programCounter };
}

async function handlePauseDebugger(): Promise<unknown> {
  const event = new CustomEvent('debugger-pause');
  window.dispatchEvent(event);

  return { success: true };
}

async function handleResetConsole(): Promise<unknown> {
  console.log('🔄 Resetting console - PC will be set to 0');
  const event = new CustomEvent('debugger-reset');
  window.dispatchEvent(event);

  return { success: true, message: 'Console reset - PC set to 0, all registers cleared' };
}

async function handleAssembleCode(): Promise<unknown> {
  return new Promise((resolve) => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      clearTimeout(timeout);
      resolve(customEvent.detail);
      window.removeEventListener('editor-assemble-response', handler);
    };

    // Add listener BEFORE dispatching the event
    window.addEventListener('editor-assemble-response', handler);

    // Timeout after 10 seconds
    const timeout = setTimeout(() => {
      window.removeEventListener('editor-assemble-response', handler);
      resolve({ success: false, error: 'Timeout assembling code' });
    }, 10000);

    // Now dispatch the event
    const event = new CustomEvent('editor-assemble');
    window.dispatchEvent(event);
  });
}

async function handleCaptureScreen(): Promise<unknown> {
  console.log('📸 Requesting canvas capture...');

  return new Promise((resolve) => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      const response = customEvent.detail as any;
      clearTimeout(timeout);

      if (response.success && response.image) {
        console.log('📸 Canvas captured:', response.width, 'x', response.height, 'image data length:', response.image.length);
      }

      resolve(customEvent.detail);
      window.removeEventListener('canvas-capture-response', handler);
    };

    // Add listener BEFORE dispatching the event
    window.addEventListener('canvas-capture-response', handler);

    // Timeout after 5 seconds
    const timeout = setTimeout(() => {
      window.removeEventListener('canvas-capture-response', handler);
      resolve({ success: false, error: 'Timeout capturing canvas' });
    }, 5000);

    // Now dispatch the event
    const event = new CustomEvent('capture-canvas');
    window.dispatchEvent(event);
  });
}

interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  children?: FileEntry[];
}

/**
 * Recursively list directory contents
 */
async function listDirectoryContents(
  handle: FileSystemDirectoryHandle,
  maxDepth: number = 5,
  currentDepth: number = 0
): Promise<FileEntry[]> {
  if (currentDepth >= maxDepth) {
    return [];
  }

  const entries: FileEntry[] = [];

  // Cast to any to work around incomplete TypeScript types for File System Access API
  for await (const entry of (handle as any).values()) {
    if (entry.kind === 'directory') {
      const subDirHandle = await handle.getDirectoryHandle(entry.name);
      const children = await listDirectoryContents(subDirHandle, maxDepth, currentDepth + 1);
      entries.push({
        name: entry.name,
        type: 'directory',
        children
      });
    } else {
      entries.push({
        name: entry.name,
        type: 'file'
      });
    }
  }

  // Sort: directories first, then files, both alphabetically
  entries.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return entries;
}

async function handleListProjectFiles(parameters: Record<string, unknown>): Promise<unknown> {
  const projectHandle = useDevkitStore.getState().currentProjectHandle;

  if (!projectHandle) {
    return { error: 'No project is currently open' };
  }

  const path = parameters.path as string | undefined;

  try {
    let targetHandle: FileSystemDirectoryHandle = projectHandle;

    // Navigate to subdirectory if path is provided
    if (path) {
      const pathParts = path.split('/').filter(p => p);
      for (const part of pathParts) {
        targetHandle = await targetHandle.getDirectoryHandle(part, { create: false });
      }
    }

    const files = await listDirectoryContents(targetHandle);

    return {
      path: path || '/',
      files
    };
  } catch (error) {
    return {
      error: `Failed to list files: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

async function handleReadProjectFile(parameters: Record<string, unknown>): Promise<unknown> {
  const projectHandle = useDevkitStore.getState().currentProjectHandle;

  if (!projectHandle) {
    return { error: 'No project is currently open' };
  }

  const path = parameters.path as string;

  if (!path) {
    return { error: 'File path is required' };
  }

  try {
    const content = await readFile(projectHandle, path);

    return {
      path,
      content,
      lines: content.split('\n').length
    };
  } catch (error) {
    return {
      error: `Failed to read file '${path}': ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

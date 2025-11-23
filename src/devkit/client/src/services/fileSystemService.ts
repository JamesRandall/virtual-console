/**
 * Service for handling file system operations using the File System Access API
 */

// Extend Window interface to include File System Access API
declare global {
  interface Window {
    showDirectoryPicker(options?: {
      mode?: 'read' | 'readwrite';
    }): Promise<FileSystemDirectoryHandle>;
  }
}

export interface ProjectStructure {
  name: string;
  directoryHandle: FileSystemDirectoryHandle;
}

const DEFAULT_ASM_CONTENT = `.org $B80
  LD R0, #$AA      ; Load pattern
  LD R1, #0        ; Counter
  LD R2, #0        ; Address high byte
  LD R3, #0        ; Address low byte
loop:
  ST R0, [R2:R3]   ; Store pattern
  INC R3           ; Next address
  INC R1           ; Increment counter
  CMP R1, #16      ; Check if done
  BRNZ loop        ; Loop if not done
infiniteloop:
  JMP infiniteloop`;

const DEFAULT_CARTRIDGE_JSON = '{}';

const DEFAULT_CONFIG_JSON = JSON.stringify({ mode: 0 }, null, 2);

/**
 * Create the standard project folder structure
 */
async function createProjectStructure(directoryHandle: FileSystemDirectoryHandle): Promise<void> {
  // Create subdirectories
  await directoryHandle.getDirectoryHandle('src', { create: true });
  await directoryHandle.getDirectoryHandle('sprites', { create: true });
  await directoryHandle.getDirectoryHandle('tiles', { create: true });
  await directoryHandle.getDirectoryHandle('maps', { create: true });
  await directoryHandle.getDirectoryHandle('palettes', { create: true });

  // Create main.asm in src folder
  const srcHandle = await directoryHandle.getDirectoryHandle('src', { create: false });
  const mainAsmHandle = await srcHandle.getFileHandle('main.asm', { create: true });
  const mainAsmWritable = await mainAsmHandle.createWritable();
  await mainAsmWritable.write(DEFAULT_ASM_CONTENT);
  await mainAsmWritable.close();

  // Create cartridge.json
  const cartridgeHandle = await directoryHandle.getFileHandle('cartridge.json', { create: true });
  const cartridgeWritable = await cartridgeHandle.createWritable();
  await cartridgeWritable.write(DEFAULT_CARTRIDGE_JSON);
  await cartridgeWritable.close();

  // Create config.json
  const configHandle = await directoryHandle.getFileHandle('config.json', { create: true });
  const configWritable = await configHandle.createWritable();
  await configWritable.write(DEFAULT_CONFIG_JSON);
  await configWritable.close();

  // Create default.pbin in palettes folder with retro computer colours
  const palettesHandle = await directoryHandle.getDirectoryHandle('palettes', { create: false });
  const defaultPbinHandle = await palettesHandle.getFileHandle('default.pbin', { create: true });
  const defaultPbinWritable = await defaultPbinHandle.createWritable();
  const paletteBuffer = new Uint8Array(1024); // 1024 bytes, initialized to zeros

  // Block 0 - color indexes - BBC
  paletteBuffer.set([254, 255, 233, 234, 235, 236, 237, 238, 254, 254, 254, 254, 254, 254, 254, 254], 0);
  paletteBuffer.set([254, 255, 233, 234, 235, 236, 237, 238, 254, 255, 233, 234, 235, 236, 237, 238], 16);

  // Block 2 - color indexes - Spectrum
  paletteBuffer.set([254, 255, 220, 221, 222, 223, 224, 225, 254, 226, 227, 228, 229, 230, 231, 232], 32);

  // Block 2 - color indexes - C64
  paletteBuffer.set([254, 255, 239, 240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252], 48);

  await defaultPbinWritable.write(paletteBuffer);
  await defaultPbinWritable.close();
}

/**
 * Validate that a directory has the required project structure
 */
async function validateProjectStructure(directoryHandle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    // Check for required folders
    await directoryHandle.getDirectoryHandle('src', { create: false });

    // Check for main.asm
    const srcHandle = await directoryHandle.getDirectoryHandle('src', { create: false });
    await srcHandle.getFileHandle('main.asm', { create: false });

    // Check for cartridge.json
    await directoryHandle.getFileHandle('cartridge.json', { create: false });

    // Check for config.json
    await directoryHandle.getFileHandle('config.json', { create: false });

    return true;
  } catch {
    return false;
  }
}

/**
 * Open an existing project folder
 */
export async function openProject(): Promise<ProjectStructure | null> {
  try {
    const directoryHandle = await window.showDirectoryPicker({
      mode: 'readwrite',
    });

    // Validate the project structure
    const isValid = await validateProjectStructure(directoryHandle);

    if (!isValid) {
      // Ask user if they want to create the missing structure
      const createStructure = confirm(
        'This folder does not have the required project structure. Would you like to create it?'
      );

      if (createStructure) {
        await createProjectStructure(directoryHandle);
      } else {
        return null;
      }
    }

    return {
      name: directoryHandle.name,
      directoryHandle,
    };
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      // User cancelled the picker
      return null;
    }
    console.error('Error opening project:', error);
    throw error;
  }
}

/**
 * Create a new project
 */
export async function createNewProject(projectName: string): Promise<ProjectStructure | null> {
  try {
    // First, let the user pick a parent directory
    const parentHandle = await window.showDirectoryPicker({
      mode: 'readwrite',
    });

    // Create the project folder
    const projectHandle = await parentHandle.getDirectoryHandle(projectName, { create: true });

    // Create the project structure
    await createProjectStructure(projectHandle);

    return {
      name: projectName,
      directoryHandle: projectHandle,
    };
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      // User cancelled the picker
      return null;
    }
    console.error('Error creating project:', error);
    throw error;
  }
}

/**
 * Read a file from the project
 */
export async function readFile(
  directoryHandle: FileSystemDirectoryHandle,
  path: string
): Promise<string> {
  const pathParts = path.split('/');
  let currentHandle: FileSystemDirectoryHandle = directoryHandle;

  // Navigate through directories
  for (let i = 0; i < pathParts.length - 1; i++) {
    currentHandle = await currentHandle.getDirectoryHandle(pathParts[i], { create: false });
  }

  // Get the file
  const fileName = pathParts[pathParts.length - 1];
  const fileHandle = await currentHandle.getFileHandle(fileName, { create: false });
  const file = await fileHandle.getFile();
  return await file.text();
}

/**
 * Write content to a file
 */
export async function writeFile(
  directoryHandle: FileSystemDirectoryHandle,
  path: string,
  content: string
): Promise<void> {
  const pathParts = path.split('/');
  let currentHandle: FileSystemDirectoryHandle = directoryHandle;

  // Navigate through directories
  for (let i = 0; i < pathParts.length - 1; i++) {
    currentHandle = await currentHandle.getDirectoryHandle(pathParts[i], { create: false });
  }

  // Get or create the file
  const fileName = pathParts[pathParts.length - 1];
  const fileHandle = await currentHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

/**
 * Read a binary file from the project
 */
export async function readBinaryFile(
  directoryHandle: FileSystemDirectoryHandle,
  path: string
): Promise<Uint8Array> {
  const pathParts = path.split('/');
  let currentHandle: FileSystemDirectoryHandle = directoryHandle;

  // Navigate through directories
  for (let i = 0; i < pathParts.length - 1; i++) {
    currentHandle = await currentHandle.getDirectoryHandle(pathParts[i], { create: false });
  }

  // Get the file
  const fileName = pathParts[pathParts.length - 1];
  const fileHandle = await currentHandle.getFileHandle(fileName, { create: false });
  const file = await fileHandle.getFile();
  const arrayBuffer = await file.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Write binary content to a file
 */
export async function writeBinaryFile(
  directoryHandle: FileSystemDirectoryHandle,
  path: string,
  content: Uint8Array
): Promise<void> {
  const pathParts = path.split('/');
  let currentHandle: FileSystemDirectoryHandle = directoryHandle;

  // Navigate through directories
  for (let i = 0; i < pathParts.length - 1; i++) {
    currentHandle = await currentHandle.getDirectoryHandle(pathParts[i], { create: false });
  }

  // Get or create the file
  const fileName = pathParts[pathParts.length - 1];
  const fileHandle = await currentHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  // Cast to ArrayBuffer to satisfy TypeScript
  await writable.write(content.buffer as ArrayBuffer);
  await writable.close();
}

/**
 * Create a new file in a directory
 */
export async function createFile(
  directoryHandle: FileSystemDirectoryHandle,
  folderPath: string,
  fileName: string,
  content: string = ''
): Promise<void> {
  const pathParts = folderPath.split('/').filter(p => p);
  let currentHandle: FileSystemDirectoryHandle = directoryHandle;

  // Navigate through directories
  for (const part of pathParts) {
    currentHandle = await currentHandle.getDirectoryHandle(part, { create: false });
  }

  // Create the file
  const fileHandle = await currentHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

/**
 * Delete a file
 */
export async function deleteFile(
  directoryHandle: FileSystemDirectoryHandle,
  path: string
): Promise<void> {
  const pathParts = path.split('/');
  let currentHandle: FileSystemDirectoryHandle = directoryHandle;

  // Navigate through directories
  for (let i = 0; i < pathParts.length - 1; i++) {
    currentHandle = await currentHandle.getDirectoryHandle(pathParts[i], { create: false });
  }

  // Delete the file
  const fileName = pathParts[pathParts.length - 1];
  await currentHandle.removeEntry(fileName);
}

/**
 * Check if a file can be deleted (not main.asm or cartridge.json)
 */
export function canDeleteFile(path: string): boolean {
  const normalizedPath = path.toLowerCase();
  return normalizedPath !== 'src/main.asm' && normalizedPath !== 'cartridge.json';
}

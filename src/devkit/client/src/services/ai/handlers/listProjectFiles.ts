import { useDevkitStore } from '../../../stores/devkitStore.ts';

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

export async function handleListProjectFiles(parameters: Record<string, unknown>): Promise<unknown> {
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

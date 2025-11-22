import { useEffect, useState, useCallback, useRef } from 'react';
import { Tree, type NodeRendererProps } from 'react-arborist';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFolder,
  faFolderOpen,
  faFile,
  faFileCode,
  faImage,
  faMap,
  faPlus,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { useDevkitStore } from '../stores/devkitStore';
import { ProjectDialog } from '../components/ProjectDialog';
import { NewFileDialog } from '../components/NewFileDialog';
import { DeleteFileDialog } from '../components/DeleteFileDialog';
import { readFile, createFile, deleteFile, canDeleteFile } from '../services/fileSystemService';
import type { ProjectStructure } from '../services/fileSystemService';
import { saveProjectHandle, getProjectHandle, verifyHandlePermission } from '../services/projectPersistence';

interface FileNode {
  id: string;
  name: string;
  children?: FileNode[];
  isDirectory: boolean;
}

interface ContextMenuState {
  x: number;
  y: number;
  node: FileNode | null;
}

export function ProjectExplorer() {
  // Zustand store hooks
  const currentProjectHandle = useDevkitStore((state) => state.currentProjectHandle);
  const currentProjectName = useDevkitStore((state) => state.currentProjectName);
  const projectTreeVersion = useDevkitStore((state) => state.projectTreeVersion);
  const setProject = useDevkitStore((state) => state.setProject);
  const openFile = useDevkitStore((state) => state.openFile);
  const refreshProjectTree = useDevkitStore((state) => state.refreshProjectTree);

  // Local state
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [newFileDialog, setNewFileDialog] = useState<{ isOpen: boolean; folderPath: string }>({
    isOpen: false,
    folderPath: '',
  });
  const [deleteFileDialog, setDeleteFileDialog] = useState<{ isOpen: boolean; filePath: string }>({
    isOpen: false,
    filePath: '',
  });

  // Refs
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const treeContainerRef = useRef<HTMLDivElement>(null);
  const [treeHeight, setTreeHeight] = useState(600);

  // Load project on mount if not already loaded
  useEffect(() => {
    const loadProjectFromStorage = async () => {
      if (currentProjectHandle) {
        // Already have a project loaded
        return;
      }

      try {
        // Try to retrieve the saved project handle from IndexedDB
        const storedProject = await getProjectHandle();

        if (!storedProject) {
          // No saved project, show dialog
          setIsProjectDialogOpen(true);
          return;
        }

        // Verify we still have permission to access the handle
        const hasPermission = await verifyHandlePermission(storedProject.handle);

        if (!hasPermission) {
          console.log('Permission denied for stored project');
          setIsProjectDialogOpen(true);
          return;
        }

        // Verify the handle is still valid by trying to access it
        try {
          // Try to read the directory to verify it still exists and is accessible
          // @ts-ignore - entries() is supported but not in all type definitions
          const iterator = storedProject.handle.entries();
          await iterator.next(); // Just check if we can read it

          // Successfully restored project
          console.log('Restored project from IndexedDB:', storedProject.name);
          setProject(storedProject.handle, storedProject.name);
        } catch (error) {
          console.error('Stored project handle is invalid:', error);
          setIsProjectDialogOpen(true);
        }
      } catch (error) {
        console.error('Error loading project from storage:', error);
        setIsProjectDialogOpen(true);
      }
    };

    loadProjectFromStorage();
  }, [currentProjectHandle, setProject]);

  // Measure tree container height
  useEffect(() => {
    const updateHeight = () => {
      if (treeContainerRef.current) {
        const height = treeContainerRef.current.clientHeight;
        setTreeHeight(height);
      }
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(updateHeight);
    if (treeContainerRef.current) {
      resizeObserver.observe(treeContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Load file tree when project changes
  useEffect(() => {
    if (!currentProjectHandle) {
      setFileTree([]);
      return;
    }

    const loadFileTree = async () => {
      try {
        const tree = await buildFileTree(currentProjectHandle);
        setFileTree(tree);
      } catch (error) {
        console.error('Error loading file tree:', error);
      }
    };

    loadFileTree();
  }, [currentProjectHandle, projectTreeVersion]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };

    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }

    return undefined;
  }, [contextMenu]);

  // Build file tree from directory handle
  const buildFileTree = async (
    dirHandle: FileSystemDirectoryHandle,
    path = ''
  ): Promise<FileNode[]> => {
    const nodes: FileNode[] = [];

    try {
      // @ts-ignore - entries() is supported but not in all type definitions
      for await (const [name, handle] of dirHandle.entries()) {
        const fullPath = path ? `${path}/${name}` : name;

        if (handle.kind === 'directory') {
          const children = await buildFileTree(handle as FileSystemDirectoryHandle, fullPath);
          nodes.push({
            id: fullPath,
            name,
            isDirectory: true,
            children,
          });
        } else {
          nodes.push({
            id: fullPath,
            name,
            isDirectory: false,
          });
        }
      }
    } catch (error) {
      console.error('Error reading directory:', error);
      return [];
    }

    // Sort: directories first, then files, alphabetically
    return nodes.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  };

  // Get icon for file/folder
  const getIcon = (node: FileNode, isOpen: boolean) => {
    if (node.isDirectory) {
      return isOpen ? faFolderOpen : faFolder;
    }

    const ext = node.name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'asm':
        return faFileCode;
      case 'gbin':
        return faImage;
      case 'mbin':
        return faMap;
      case 'json':
        return faFile;
      default:
        return faFile;
    }
  };

  // Event handlers
  const handleProjectSelected = useCallback(
    async (project: ProjectStructure) => {
      setProject(project.directoryHandle, project.name);

      // Store project handle in IndexedDB for next session
      try {
        await saveProjectHandle(project.name, project.directoryHandle);
        console.log('Project saved to IndexedDB:', project.name);
      } catch (error) {
        console.error('Error saving project to IndexedDB:', error);
      }
    },
    [setProject]
  );

  const handleNodeDoubleClick = useCallback(
    async (node: FileNode) => {
      if (!currentProjectHandle || node.isDirectory) {
        return;
      }

      try {
        const content = await readFile(currentProjectHandle, node.id);
        openFile(node.id, content);
      } catch (error) {
        console.error('Error reading file:', error);
        alert('Failed to open file: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    },
    [currentProjectHandle, openFile]
  );

  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: FileNode) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      node,
    });
  }, []);

  const handleCreateFile = useCallback(() => {
    if (!contextMenu?.node) return;

    const folderPath = contextMenu.node.isDirectory
      ? contextMenu.node.id
      : contextMenu.node.id.split('/').slice(0, -1).join('/');

    setNewFileDialog({ isOpen: true, folderPath });
    setContextMenu(null);
  }, [contextMenu]);

  const handleDeleteFile = useCallback(() => {
    if (!contextMenu?.node || contextMenu.node.isDirectory) return;

    if (!canDeleteFile(contextMenu.node.id)) {
      alert('Cannot delete main.asm or cartridge.json');
      setContextMenu(null);
      return;
    }

    setDeleteFileDialog({ isOpen: true, filePath: contextMenu.node.id });
    setContextMenu(null);
  }, [contextMenu]);

  const handleCreateFileConfirm = useCallback(
    async (fileName: string) => {
      if (!currentProjectHandle) return;

      try {
        await createFile(currentProjectHandle, newFileDialog.folderPath, fileName, '');
        refreshProjectTree();
      } catch (error) {
        console.error('Error creating file:', error);
        throw error;
      }
    },
    [currentProjectHandle, newFileDialog.folderPath, refreshProjectTree]
  );

  const handleDeleteFileConfirm = useCallback(async () => {
    if (!currentProjectHandle) return;

    try {
      await deleteFile(currentProjectHandle, deleteFileDialog.filePath);
      refreshProjectTree();
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }, [currentProjectHandle, deleteFileDialog.filePath, refreshProjectTree]);

  // Node renderer
  const Node = ({ node, style, dragHandle }: NodeRendererProps<FileNode>) => {
    const handleDoubleClick = () => {
      if (node.data.isDirectory) {
        node.toggle();
      } else {
        handleNodeDoubleClick(node.data);
      }
    };
    const handleContextMenu = (e: React.MouseEvent) => handleNodeContextMenu(e, node.data);

    return (
      <div
        ref={dragHandle}
        style={style}
        className={`flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-zinc-700 ${
          node.isSelected ? 'bg-zinc-600' : ''
        }`}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        <FontAwesomeIcon
          icon={getIcon(node.data, node.isOpen)}
          className="w-4 h-4 text-zinc-400"
        />
        <span className="text-zinc-200 text-sm">{node.data.name}</span>
      </div>
    );
  };

  // Render
  if (!currentProjectHandle) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-zinc-800 text-zinc-400 p-4">
        <p className="mb-4">No project loaded</p>
        <button
          onClick={() => setIsProjectDialogOpen(true)}
          className="px-4 py-2 bg-zinc-600 hover:bg-zinc-700 text-white rounded"
        >
          Open or Create Project
        </button>
        <ProjectDialog
          isOpen={isProjectDialogOpen}
          onClose={() => setIsProjectDialogOpen(false)}
          onProjectSelected={handleProjectSelected}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700">
        <h2 className="text-zinc-200 text-sm font-medium">{currentProjectName}</h2>
        <button
          onClick={() => setIsProjectDialogOpen(true)}
          className="text-zinc-400 hover:text-zinc-200 text-xs"
          title="Change project"
        >
          Change
        </button>
      </div>

      {/* Tree view */}
      <div ref={treeContainerRef} className="flex-1 min-h-0">
        <Tree
          data={fileTree}
          openByDefault={true}
          width="100%"
          height={treeHeight}
          indent={16}
          rowHeight={28}
          overscanCount={5}
          idAccessor="id"
          childrenAccessor="children"
        >
          {Node}
        </Tree>
      </div>

      {/* Context menu */}
      {contextMenu && contextMenu.node && (
        <div
          ref={contextMenuRef}
          className="fixed bg-zinc-700 border border-zinc-600 rounded shadow-lg py-1 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.node.isDirectory && (
            <button
              onClick={handleCreateFile}
              className="w-full px-4 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-600 flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faPlus} className="w-3 h-3" />
              New File
            </button>
          )}
          {!contextMenu.node.isDirectory && canDeleteFile(contextMenu.node.id) && (
            <button
              onClick={handleDeleteFile}
              className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-zinc-600 flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
              Delete
            </button>
          )}
        </div>
      )}

      {/* Dialogs */}
      <ProjectDialog
        isOpen={isProjectDialogOpen}
        onClose={() => setIsProjectDialogOpen(false)}
        onProjectSelected={handleProjectSelected}
      />
      <NewFileDialog
        isOpen={newFileDialog.isOpen}
        onClose={() => setNewFileDialog({ isOpen: false, folderPath: '' })}
        folderPath={newFileDialog.folderPath}
        onCreateFile={handleCreateFileConfirm}
      />
      <DeleteFileDialog
        isOpen={deleteFileDialog.isOpen}
        onClose={() => setDeleteFileDialog({ isOpen: false, filePath: '' })}
        filePath={deleteFileDialog.filePath}
        onDeleteFile={handleDeleteFileConfirm}
      />
    </div>
  );
}

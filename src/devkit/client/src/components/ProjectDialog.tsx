import { useState, useCallback } from 'react';
import { Dialog } from './Dialog';
import { openProject, createNewProject } from '../services/fileSystemService';
import type { ProjectStructure } from '../services/fileSystemService';

interface ProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectSelected: (project: ProjectStructure) => void;
}

export function ProjectDialog({ isOpen, onClose, onProjectSelected }: ProjectDialogProps) {
  // Local state
  const [mode, setMode] = useState<'select' | 'create'>('select');
  const [projectName, setProjectName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Event handlers
  const handleOpenExisting = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const project = await openProject();
      if (project) {
        onProjectSelected(project);
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open project');
    } finally {
      setIsLoading(false);
    }
  }, [onProjectSelected, onClose]);

  const handleCreateNew = useCallback(async () => {
    if (!projectName.trim()) {
      setError('Please enter a project name');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const project = await createNewProject(projectName.trim());
      if (project) {
        onProjectSelected(project);
        onClose();
        setProjectName('');
        setMode('select');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setIsLoading(false);
    }
  }, [projectName, onProjectSelected, onClose]);

  const handleModeChange = useCallback((newMode: 'select' | 'create') => {
    setMode(newMode);
    setError(null);
    setProjectName('');
  }, []);

  // Render
  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Open or Create Project">
      <div className="flex flex-col gap-4">
        {/* Mode selection */}
        <div className="flex gap-2 border-b border-zinc-700 pb-2">
          <button
            onClick={() => handleModeChange('select')}
            className={`px-4 py-2 rounded ${
              mode === 'select'
                ? 'bg-zinc-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
            disabled={isLoading}
          >
            Open Existing
          </button>
          <button
            onClick={() => handleModeChange('create')}
            className={`px-4 py-2 rounded ${
              mode === 'create'
                ? 'bg-zinc-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
            disabled={isLoading}
          >
            Create New
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-600 text-white px-4 py-2 rounded">
            {error}
          </div>
        )}

        {/* Mode-specific content */}
        {mode === 'select' ? (
          <div className="flex flex-col gap-4">
            <p className="text-zinc-300 text-sm">
              Select an existing project folder. It should contain a <code className="bg-zinc-700 px-1 rounded">src</code> folder
              with a <code className="bg-zinc-700 px-1 rounded">main.asm</code> file.
            </p>
            <button
              onClick={handleOpenExisting}
              disabled={isLoading}
              className="px-4 py-2 bg-zinc-600 hover:bg-zinc-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Opening...' : 'Browse for Project Folder'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-zinc-300 text-sm">
              Create a new project with the standard folder structure.
            </p>
            <div className="flex flex-col gap-2">
              <label htmlFor="projectName" className="text-zinc-300 text-sm font-medium">
                Project Name
              </label>
              <input
                id="projectName"
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateNew();
                  }
                }}
                placeholder="my-awesome-project"
                className="px-3 py-2 bg-zinc-700 text-white rounded border border-zinc-600 focus:outline-none focus:border-zinc-500"
                disabled={isLoading}
              />
            </div>
            <button
              onClick={handleCreateNew}
              disabled={isLoading || !projectName.trim()}
              className="px-4 py-2 bg-zinc-600 hover:bg-zinc-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        )}
      </div>
    </Dialog>
  );
}

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
      <div className="flex flex-col dk-gap-standard">
        {/* Mode selection */}
        <div className="flex dk-gap-small dk-border-b pb-2">
          <button
            onClick={() => handleModeChange('select')}
            className={mode === 'select' ? 'dk-btn-primary' : 'dk-btn-secondary'}
            disabled={isLoading}
          >
            Open Existing
          </button>
          <button
            onClick={() => handleModeChange('create')}
            className={mode === 'create' ? 'dk-btn-primary' : 'dk-btn-secondary'}
            disabled={isLoading}
          >
            Create New
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-600 text-white dk-padding-standard dk-rounded">
            {error}
          </div>
        )}

        {/* Mode-specific content */}
        {mode === 'select' ? (
          <div className="flex flex-col dk-gap-standard">
            <p className="dk-body-text">
              Select an existing project folder. It should contain a <code className="dk-bg-elevated px-1 dk-rounded">src</code> folder
              with a <code className="dk-bg-elevated px-1 dk-rounded">main.asm</code> file.
            </p>
            <button
              onClick={handleOpenExisting}
              disabled={isLoading}
              className="dk-btn-primary dk-btn-disabled"
            >
              {isLoading ? 'Opening...' : 'Browse for Project Folder'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col dk-gap-standard">
            <p className="dk-body-text">
              Create a new project with the standard folder structure.
            </p>
            <div className="flex flex-col dk-gap-small">
              <label htmlFor="projectName" className="dk-subsection-header">
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
                className="dk-input"
                disabled={isLoading}
              />
            </div>
            <button
              onClick={handleCreateNew}
              disabled={isLoading || !projectName.trim()}
              className="dk-btn-primary dk-btn-disabled"
            >
              {isLoading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        )}
      </div>
    </Dialog>
  );
}

import { useState, useCallback } from 'react';
import { Dialog } from './Dialog';

interface NewFileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  folderPath: string;  // The folder where the file will be created (e.g., "src", "sprites")
  onCreateFile: (fileName: string) => Promise<void>;
}

export function NewFileDialog({ isOpen, onClose, folderPath, onCreateFile }: NewFileDialogProps) {
  // Local state
  const [fileName, setFileName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine the expected file extension based on folder
  const getExpectedExtension = useCallback(() => {
    if (folderPath.includes('src')) return '.asm';
    if (folderPath.includes('sprites') || folderPath.includes('tiles')) return '.gbin';
    if (folderPath.includes('maps')) return '.mbin';
    return '';
  }, [folderPath]);

  // Event handlers
  const handleCreate = useCallback(async () => {
    if (!fileName.trim()) {
      setError('Please enter a file name');
      return;
    }

    const expectedExt = getExpectedExtension();
    let finalFileName = fileName.trim();

    // Add extension if not present
    if (expectedExt && !finalFileName.endsWith(expectedExt)) {
      finalFileName += expectedExt;
    }

    setIsCreating(true);
    setError(null);

    try {
      await onCreateFile(finalFileName);
      setFileName('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create file');
    } finally {
      setIsCreating(false);
    }
  }, [fileName, getExpectedExtension, onCreateFile, onClose]);

  const handleClose = useCallback(() => {
    if (!isCreating) {
      setFileName('');
      setError(null);
      onClose();
    }
  }, [isCreating, onClose]);

  // Render
  return (
    <Dialog isOpen={isOpen} onClose={handleClose} title="Create New File">
      <div className="flex flex-col gap-4">
        {/* Info */}
        <p className="text-zinc-300 text-sm">
          Creating file in: <code className="bg-zinc-700 px-1 rounded">{folderPath}</code>
        </p>

        {/* Error message */}
        {error && (
          <div className="bg-red-600 text-white px-4 py-2 rounded text-sm">
            {error}
          </div>
        )}

        {/* File name input */}
        <div className="flex flex-col gap-2">
          <label htmlFor="fileName" className="text-zinc-300 text-sm font-medium">
            File Name
          </label>
          <input
            id="fileName"
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreate();
              } else if (e.key === 'Escape') {
                handleClose();
              }
            }}
            placeholder={`myfile${getExpectedExtension()}`}
            className="px-3 py-2 bg-zinc-700 text-white rounded border border-zinc-600 focus:outline-none focus:border-zinc-500"
            disabled={isCreating}
            autoFocus
          />
          {getExpectedExtension() && (
            <p className="text-zinc-400 text-xs">
              Extension {getExpectedExtension()} will be added automatically if not provided.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={handleClose}
            disabled={isCreating}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating || !fileName.trim()}
            className="px-4 py-2 bg-zinc-600 hover:bg-zinc-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

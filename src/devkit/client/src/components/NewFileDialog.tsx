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
      <div className="flex flex-col dk-gap-standard">
        {/* Info */}
        <p className="dk-body-text">
          Creating file in: <code className="dk-bg-elevated px-1 dk-rounded">{folderPath}</code>
        </p>

        {/* Error message */}
        {error && (
          <div className="bg-red-600 text-white dk-padding-standard dk-rounded dk-body-text">
            {error}
          </div>
        )}

        {/* File name input */}
        <div className="flex flex-col dk-gap-small">
          <label htmlFor="fileName" className="dk-subsection-header">
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
            className="dk-input"
            disabled={isCreating}
            autoFocus
          />
          {getExpectedExtension() && (
            <p className="dk-secondary-text">
              Extension {getExpectedExtension()} will be added automatically if not provided.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex dk-gap-small justify-end">
          <button
            onClick={handleClose}
            disabled={isCreating}
            className="dk-btn-secondary dk-btn-disabled"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating || !fileName.trim()}
            className="dk-btn-primary dk-btn-disabled"
          >
            {isCreating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

import { useState, useCallback } from 'react';
import { Dialog } from './Dialog';

interface DeleteFileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  filePath: string;  // The file to delete (e.g., "src/myfile.asm")
  onDeleteFile: () => Promise<void>;
}

export function DeleteFileDialog({ isOpen, onClose, filePath, onDeleteFile }: DeleteFileDialogProps) {
  // Local state
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Event handlers
  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    setError(null);

    try {
      await onDeleteFile();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file');
    } finally {
      setIsDeleting(false);
    }
  }, [onDeleteFile, onClose]);

  const handleClose = useCallback(() => {
    if (!isDeleting) {
      setError(null);
      onClose();
    }
  }, [isDeleting, onClose]);

  // Render
  return (
    <Dialog isOpen={isOpen} onClose={handleClose} title="Delete File">
      <div className="flex flex-col dk-gap-standard">
        {/* Warning message */}
        <div className="bg-amber-600 text-white dk-padding-standard dk-rounded flex items-start dk-gap-compact">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div className="flex-1">
            <p className="font-medium">Are you sure you want to delete this file?</p>
            <p className="dk-body-text mt-1">This action cannot be undone.</p>
          </div>
        </div>

        {/* File path */}
        <p className="dk-body-text">
          File: <code className="dk-bg-elevated dk-padding-tight dk-rounded">{filePath}</code>
        </p>

        {/* Error message */}
        {error && (
          <div className="bg-red-600 text-white dk-padding-standard dk-rounded dk-body-text">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex dk-gap-small justify-end">
          <button
            onClick={handleClose}
            disabled={isDeleting}
            className="dk-btn-secondary dk-btn-disabled"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="dk-btn-danger dk-btn-disabled"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

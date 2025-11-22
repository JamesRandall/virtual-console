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
      <div className="flex flex-col gap-4">
        {/* Warning message */}
        <div className="bg-amber-600 text-white px-4 py-3 rounded flex items-start gap-3">
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
            <p className="text-sm mt-1">This action cannot be undone.</p>
          </div>
        </div>

        {/* File path */}
        <p className="text-zinc-300 text-sm">
          File: <code className="bg-zinc-700 px-2 py-1 rounded">{filePath}</code>
        </p>

        {/* Error message */}
        {error && (
          <div className="bg-red-600 text-white px-4 py-2 rounded text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={handleClose}
            disabled={isDeleting}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

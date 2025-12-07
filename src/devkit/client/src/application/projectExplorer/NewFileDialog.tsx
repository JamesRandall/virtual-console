import { useState, useCallback, useMemo } from 'react';
import { Dialog } from '../../components/Dialog.tsx';

interface NewFileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  folderPath: string;  // The folder where the file will be created (e.g., "src", "sprites")
  onCreateFile: (fileName: string, options?: { width?: number; height?: number }) => Promise<void>;
}

// Maximum file size for tbin is 32KB
const MAX_TBIN_SIZE = 32768;
const TBIN_HEADER_SIZE = 8;
const MAX_TILES = Math.floor((MAX_TBIN_SIZE - TBIN_HEADER_SIZE) / 2);

// Mode 0 screen size in tiles (256x160 pixels / 16x16 tiles = 16x10 tiles)
const SCREEN_WIDTH_TILES = 16;
const SCREEN_HEIGHT_TILES = 10;

// Preset screen sizes
const SCREEN_PRESETS = [
  { label: '1×1', width: 1, height: 1 },
  { label: '2×1', width: 2, height: 1 },
  { label: '1×2', width: 1, height: 2 },
  { label: '2×2', width: 2, height: 2 },
] as const;

export function NewFileDialog({ isOpen, onClose, folderPath, onCreateFile }: NewFileDialogProps) {
  // Local state
  const [fileName, setFileName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tilemap dimensions (for .tbin files) - stored as strings for natural input editing
  // Default to 1 screen (16x10 tiles for Mode 0)
  const [tilemapWidthStr, setTilemapWidthStr] = useState(String(SCREEN_WIDTH_TILES));
  const [tilemapHeightStr, setTilemapHeightStr] = useState(String(SCREEN_HEIGHT_TILES));

  // Parse dimensions to numbers (default to 0 if invalid/empty for validation)
  const tilemapWidth = parseInt(tilemapWidthStr) || 0;
  const tilemapHeight = parseInt(tilemapHeightStr) || 0;

  // Determine the expected file extension based on folder
  const getExpectedExtension = useCallback(() => {
    if (folderPath.includes('src')) return '.asm';
    if (folderPath.includes('sprites') || folderPath.includes('tiles')) return '.gbin';
    if (folderPath.includes('maps')) return '.tbin';
    return '';
  }, [folderPath]);

  // Check if we're creating a tbin file
  const isTbinFile = useMemo(() => {
    const expectedExt = getExpectedExtension();
    return expectedExt === '.tbin' || fileName.toLowerCase().endsWith('.tbin');
  }, [getExpectedExtension, fileName]);

  // Validate tilemap dimensions
  const dimensionError = useMemo(() => {
    if (!isTbinFile) return null;
    const totalTiles = tilemapWidth * tilemapHeight;
    if (totalTiles > MAX_TILES) {
      return `Tilemap too large: ${totalTiles} tiles (max ${MAX_TILES}). Reduce dimensions.`;
    }
    if (tilemapWidth <= 0 || tilemapHeight <= 0) {
      return 'Width and height must be positive numbers.';
    }
    return null;
  }, [isTbinFile, tilemapWidth, tilemapHeight]);

  // Event handlers
  const handleCreate = useCallback(async () => {
    if (!fileName.trim()) {
      setError('Please enter a file name');
      return;
    }

    // Check dimension error for tbin files
    if (isTbinFile && dimensionError) {
      setError(dimensionError);
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
      // Pass dimensions for tbin files
      if (isTbinFile) {
        await onCreateFile(finalFileName, { width: tilemapWidth, height: tilemapHeight });
      } else {
        await onCreateFile(finalFileName);
      }
      setFileName('');
      setTilemapWidthStr(String(SCREEN_WIDTH_TILES));
      setTilemapHeightStr(String(SCREEN_HEIGHT_TILES));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create file');
    } finally {
      setIsCreating(false);
    }
  }, [fileName, getExpectedExtension, onCreateFile, onClose, isTbinFile, dimensionError, tilemapWidth, tilemapHeight]);

  const handleClose = useCallback(() => {
    if (!isCreating) {
      setFileName('');
      setError(null);
      setTilemapWidthStr(String(SCREEN_WIDTH_TILES));
      setTilemapHeightStr(String(SCREEN_HEIGHT_TILES));
      onClose();
    }
  }, [isCreating, onClose]);

  // Set dimensions from screen preset
  const handlePresetClick = useCallback((widthScreens: number, heightScreens: number) => {
    setTilemapWidthStr(String(widthScreens * SCREEN_WIDTH_TILES));
    setTilemapHeightStr(String(heightScreens * SCREEN_HEIGHT_TILES));
  }, []);

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

        {/* Tilemap dimensions (for .tbin files) */}
        {isTbinFile && (
          <div className="flex flex-col dk-gap-small">
            <label className="dk-subsection-header">
              Tilemap Dimensions
            </label>

            {/* Screen size presets */}
            <div className="flex items-center dk-gap-small">
              <span className="dk-secondary-text text-sm">Screens:</span>
              {SCREEN_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handlePresetClick(preset.width, preset.height)}
                  disabled={isCreating}
                  className="dk-btn-secondary text-xs py-1 px-2"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Manual dimension inputs */}
            <div className="flex dk-gap-standard items-center">
              <div className="flex items-center dk-gap-small">
                <label htmlFor="tilemapWidth" className="dk-secondary-text text-sm">Width:</label>
                <input
                  id="tilemapWidth"
                  type="number"
                  min={1}
                  max={256}
                  value={tilemapWidthStr}
                  onChange={(e) => setTilemapWidthStr(e.target.value)}
                  className="dk-input w-20"
                  disabled={isCreating}
                />
              </div>
              <span className="dk-secondary-text">×</span>
              <div className="flex items-center dk-gap-small">
                <label htmlFor="tilemapHeight" className="dk-secondary-text text-sm">Height:</label>
                <input
                  id="tilemapHeight"
                  type="number"
                  min={1}
                  max={256}
                  value={tilemapHeightStr}
                  onChange={(e) => setTilemapHeightStr(e.target.value)}
                  className="dk-input w-20"
                  disabled={isCreating}
                />
              </div>
            </div>
            <p className="dk-secondary-text text-xs">
              Total tiles: {tilemapWidth * tilemapHeight} / {MAX_TILES} max
              {' '}({Math.ceil(tilemapWidth / SCREEN_WIDTH_TILES)}×{Math.ceil(tilemapHeight / SCREEN_HEIGHT_TILES)} screens)
            </p>
            {dimensionError && (
              <p className="text-red-400 text-xs">{dimensionError}</p>
            )}
          </div>
        )}

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

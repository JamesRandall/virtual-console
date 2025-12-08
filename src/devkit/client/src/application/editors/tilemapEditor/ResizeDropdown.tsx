import { useState, useCallback, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';

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

interface ResizeDropdownProps {
  currentWidth: number;
  currentHeight: number;
  onResize: (newWidth: number, newHeight: number) => void;
}

export function ResizeDropdown({ currentWidth, currentHeight, onResize }: ResizeDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [widthStr, setWidthStr] = useState(String(currentWidth));
  const [heightStr, setHeightStr] = useState(String(currentHeight));
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Parse dimensions to numbers
  const width = parseInt(widthStr) || 0;
  const height = parseInt(heightStr) || 0;

  // Sync with current dimensions when they change externally
  useEffect(() => {
    setWidthStr(String(currentWidth));
    setHeightStr(String(currentHeight));
  }, [currentWidth, currentHeight]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Validate dimensions
  const dimensionError = (() => {
    const totalTiles = width * height;
    if (totalTiles > MAX_TILES) {
      return `Too large: ${totalTiles} tiles (max ${MAX_TILES})`;
    }
    if (width <= 0 || height <= 0) {
      return 'Width and height must be positive';
    }
    return null;
  })();

  // Check if dimensions have changed
  const hasChanges = width !== currentWidth || height !== currentHeight;

  // Handle preset click
  const handlePresetClick = useCallback((widthScreens: number, heightScreens: number) => {
    setWidthStr(String(widthScreens * SCREEN_WIDTH_TILES));
    setHeightStr(String(heightScreens * SCREEN_HEIGHT_TILES));
  }, []);

  // Handle apply
  const handleApply = useCallback(() => {
    if (!dimensionError && hasChanges) {
      onResize(width, height);
      setIsOpen(false);
    }
  }, [dimensionError, hasChanges, onResize, width, height]);

  // Handle key down in inputs
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !dimensionError && hasChanges) {
      handleApply();
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setWidthStr(String(currentWidth));
      setHeightStr(String(currentHeight));
    }
  }, [dimensionError, hasChanges, handleApply, currentWidth, currentHeight]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-zinc-700 transition-colors text-xs text-zinc-200"
        title="Click to resize tilemap"
      >
        <span className="text-zinc-400">Size:</span>
        <span>{currentWidth} × {currentHeight}</span>
        <FontAwesomeIcon icon={faChevronDown} className={`w-2.5 h-2.5 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl p-3 min-w-64">
          <div className="flex flex-col gap-3">
            {/* Header */}
            <div className="text-xs font-medium text-zinc-300">Resize Tilemap</div>

            {/* Screen size presets */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-zinc-400">Screen presets:</span>
              <div className="flex items-center gap-1.5">
                {SCREEN_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handlePresetClick(preset.width, preset.height)}
                    className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Manual dimension inputs */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <label htmlFor="resizeWidth" className="text-xs text-zinc-400">W:</label>
                <input
                  id="resizeWidth"
                  type="number"
                  min={1}
                  max={256}
                  value={widthStr}
                  onChange={(e) => setWidthStr(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="dk-input w-16 text-xs py-1 px-2"
                />
              </div>
              <span className="text-xs text-zinc-400">×</span>
              <div className="flex items-center gap-1.5">
                <label htmlFor="resizeHeight" className="text-xs text-zinc-400">H:</label>
                <input
                  id="resizeHeight"
                  type="number"
                  min={1}
                  max={256}
                  value={heightStr}
                  onChange={(e) => setHeightStr(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="dk-input w-16 text-xs py-1 px-2"
                />
              </div>
            </div>

            {/* Info / Error */}
            <div className="text-xs">
              {dimensionError ? (
                <span className="text-red-400">{dimensionError}</span>
              ) : (
                <span className="text-zinc-500">
                  {width * height} tiles ({Math.ceil(width / SCREEN_WIDTH_TILES)}×{Math.ceil(height / SCREEN_HEIGHT_TILES)} screens)
                </span>
              )}
            </div>

            {/* Warning about clipping */}
            {hasChanges && !dimensionError && (width < currentWidth || height < currentHeight) && (
              <div className="text-xs text-amber-400">
                Warning: Reducing size will clip existing tiles
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1 border-t border-zinc-700">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setWidthStr(String(currentWidth));
                  setHeightStr(String(currentHeight));
                }}
                className="px-3 py-1.5 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={!!dimensionError || !hasChanges}
                className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

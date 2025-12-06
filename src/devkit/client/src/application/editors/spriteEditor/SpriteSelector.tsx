import { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faBackward, faForward, faTableCells } from '@fortawesome/free-solid-svg-icons';
import { SpritePicker } from '../../../components/SpritePicker';
import type { SpritePaletteConfig } from '../../../stores/devkitStore';

interface SpriteSelectorProps {
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  maxSprites: number;
  // Props needed for SpritePicker
  gbinData: Uint8Array | string;
  paletteData: Uint8Array | null;
  paletteBlockIndex: number;
  spritePaletteConfigs?: SpritePaletteConfig[];
}

export function SpriteSelector({
  selectedIndex,
  onSelectIndex,
  maxSprites,
  gbinData,
  paletteData,
  paletteBlockIndex,
  spritePaletteConfigs,
}: SpriteSelectorProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handlePrevious = () => {
    if (selectedIndex > 0) {
      onSelectIndex(selectedIndex - 1);
    }
  };

  const handleNext = () => {
    if (selectedIndex < maxSprites - 1) {
      onSelectIndex(selectedIndex + 1);
    }
  };

  const handleFirst = () => {
    onSelectIndex(0);
  };

  const handleLast = () => {
    onSelectIndex(maxSprites - 1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 0 && value < maxSprites) {
      onSelectIndex(value);
    }
  };

  const handlePickerSelect = (index: number) => {
    onSelectIndex(index);
    setIsDropdownOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const btnClass = "h-7 w-7 flex items-center justify-center bg-zinc-700 hover:bg-zinc-600 text-zinc-400 hover:text-zinc-200 rounded transition-colors disabled:bg-zinc-800 disabled:cursor-not-allowed disabled:text-zinc-600";

  return (
    <div className="flex items-center gap-1 relative" ref={dropdownRef}>
      {/* First button */}
      <button
        onClick={handleFirst}
        disabled={selectedIndex === 0}
        className={btnClass}
        title="First sprite"
      >
        <FontAwesomeIcon icon={faBackward} className="text-xs" />
      </button>

      {/* Previous button */}
      <button
        onClick={handlePrevious}
        disabled={selectedIndex === 0}
        className={btnClass}
        title="Previous sprite"
      >
        <FontAwesomeIcon icon={faChevronLeft} className="text-xs" />
      </button>

      {/* Index input */}
      <input
        type="number"
        min={0}
        max={maxSprites - 1}
        value={selectedIndex}
        onChange={handleInputChange}
        className="h-7 w-14 px-2 bg-zinc-700 border border-zinc-600 rounded text-zinc-200 text-sm text-center focus:outline-none focus:border-zinc-500"
        title="Sprite index"
      />

      {/* Next button */}
      <button
        onClick={handleNext}
        disabled={selectedIndex === maxSprites - 1}
        className={btnClass}
        title="Next sprite"
      >
        <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
      </button>

      {/* Last button */}
      <button
        onClick={handleLast}
        disabled={selectedIndex === maxSprites - 1}
        className={btnClass}
        title="Last sprite"
      >
        <FontAwesomeIcon icon={faForward} className="text-xs" />
      </button>

      {/* Total count */}
      <span className="dk-tertiary-text text-xs">
        / {maxSprites - 1}
      </span>

      {/* Sprite picker dropdown button */}
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className={`${btnClass} ${isDropdownOpen ? 'bg-zinc-600 text-white' : ''}`}
        title="Open sprite picker"
      >
        <FontAwesomeIcon icon={faTableCells} className="text-xs" />
      </button>

      {/* Dropdown with SpritePicker */}
      {isDropdownOpen && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl p-3 min-w-[320px]">
          <SpritePicker
            gbinData={gbinData}
            paletteData={paletteData}
            paletteBlockIndex={paletteBlockIndex}
            spritePaletteConfigs={spritePaletteConfigs}
            selectedIndex={selectedIndex}
            onSelect={handlePickerSelect}
            spriteCount={maxSprites}
            initialZoom={2}
            showTransparency={true}
            maxHeight={300}
          />
        </div>
      )}
    </div>
  );
}

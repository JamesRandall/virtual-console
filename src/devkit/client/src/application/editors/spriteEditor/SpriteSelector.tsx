import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faBackward, faForward } from '@fortawesome/free-solid-svg-icons';

interface SpriteSelectorProps {
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  maxSprites: number;
}

export function SpriteSelector({ selectedIndex, onSelectIndex, maxSprites }: SpriteSelectorProps) {
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

  return (
    <div className="flex items-center dk-gap-tight">
      {/* First button */}
      <button
        onClick={handleFirst}
        disabled={selectedIndex === 0}
        className="dk-btn-icon dk-btn-disabled"
        title="First sprite"
      >
        <FontAwesomeIcon icon={faBackward} className="text-xs" />
      </button>

      {/* Previous button */}
      <button
        onClick={handlePrevious}
        disabled={selectedIndex === 0}
        className="dk-btn-icon dk-btn-disabled"
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
        className="dk-input w-16 text-center"
        title="Sprite index"
      />

      {/* Next button */}
      <button
        onClick={handleNext}
        disabled={selectedIndex === maxSprites - 1}
        className="dk-btn-icon dk-btn-disabled"
        title="Next sprite"
      >
        <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
      </button>

      {/* Last button */}
      <button
        onClick={handleLast}
        disabled={selectedIndex === maxSprites - 1}
        className="dk-btn-icon dk-btn-disabled"
        title="Last sprite"
      >
        <FontAwesomeIcon icon={faForward} className="text-xs" />
      </button>

      {/* Total count */}
      <span className="dk-tertiary-text text-xs">
        / {maxSprites - 1}
      </span>
    </div>
  );
}

import type { LevelSprite } from './spriteUtils';

interface SpriteAttributeEditorProps {
  sprites: LevelSprite[];
  onChange: (updates: Partial<LevelSprite>) => void;
  onPositionChange: (id: number, x: number, y: number) => void;
  onDelete: () => void;
}

type MixedValue<T> = T | 'mixed';

function getMixedValue<T>(sprites: LevelSprite[], key: keyof LevelSprite): MixedValue<T> | undefined {
  if (sprites.length === 0) return undefined;
  const first = sprites[0][key] as T;
  for (let i = 1; i < sprites.length; i++) {
    if (sprites[i][key] !== first) return 'mixed';
  }
  return first;
}

export function SpriteAttributeEditor({
  sprites,
  onChange,
  onPositionChange,
  onDelete,
}: SpriteAttributeEditorProps) {
  if (sprites.length === 0) {
    return (
      <div className="p-3">
        <h3 className="text-xs font-medium text-zinc-300 mb-2">Sprite Attributes</h3>
        <p className="text-xs text-zinc-500">No sprite selected</p>
        <p className="text-xs text-zinc-600 mt-2">
          Click a sprite to select it, or use the place tool to add sprites.
        </p>
      </div>
    );
  }

  const flipH = getMixedValue<boolean>(sprites, 'flipH');
  const flipV = getMixedValue<boolean>(sprites, 'flipV');
  const priority = getMixedValue<boolean>(sprites, 'priority');
  const paletteOffset = getMixedValue<number>(sprites, 'paletteOffset');
  const bankOffset = getMixedValue<number>(sprites, 'bankOffset');
  const typeId = getMixedValue<number>(sprites, 'typeId');

  const singleSprite = sprites.length === 1 ? sprites[0] : null;

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium text-zinc-300">Sprite Attributes</h3>
        <span className="text-xs text-zinc-500">
          {sprites.length === 1 ? `ID: ${sprites[0].id}` : `${sprites.length} selected`}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {/* Position (only for single selection) */}
        {singleSprite && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-400">Position</label>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-xs text-zinc-500">X:</span>
                <input
                  type="number"
                  value={singleSprite.x}
                  onChange={(e) => onPositionChange(singleSprite.id, Number(e.target.value), singleSprite.y)}
                  className="dk-input text-xs py-0.5 px-1 w-16"
                  min={0}
                  max={65535}
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-zinc-500">Y:</span>
                <input
                  type="number"
                  value={singleSprite.y}
                  onChange={(e) => onPositionChange(singleSprite.id, singleSprite.x, Number(e.target.value))}
                  className="dk-input text-xs py-0.5 px-1 w-16"
                  min={0}
                  max={65535}
                />
              </div>
            </div>
          </div>
        )}

        {/* Sprite Index (only for single selection) */}
        {singleSprite && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-400">Sprite Index</label>
            <input
              type="number"
              value={singleSprite.spriteIndex}
              onChange={(e) => onChange({ spriteIndex: Number(e.target.value) })}
              className="dk-input text-xs py-0.5 px-1 w-20"
              min={0}
              max={255}
            />
          </div>
        )}

        {/* Flip toggles */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400">Flip</label>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={flipH === true}
                ref={(el) => {
                  if (el) el.indeterminate = flipH === 'mixed';
                }}
                onChange={(e) => onChange({ flipH: e.target.checked })}
                className="cursor-pointer"
              />
              <span className="text-xs text-zinc-300">Horizontal</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={flipV === true}
                ref={(el) => {
                  if (el) el.indeterminate = flipV === 'mixed';
                }}
                onChange={(e) => onChange({ flipV: e.target.checked })}
                className="cursor-pointer"
              />
              <span className="text-xs text-zinc-300">Vertical</span>
            </label>
          </div>
        </div>

        {/* Priority */}
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={priority === true}
              ref={(el) => {
                if (el) el.indeterminate = priority === 'mixed';
              }}
              onChange={(e) => onChange({ priority: e.target.checked })}
              className="cursor-pointer"
            />
            <span className="text-xs text-zinc-300">Behind tiles</span>
          </label>
        </div>

        {/* Palette Offset */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400">Palette Offset</label>
          <select
            value={paletteOffset === 'mixed' ? '' : paletteOffset}
            onChange={(e) => onChange({ paletteOffset: Number(e.target.value) })}
            className="dk-input text-xs py-0.5 px-1 w-20"
          >
            {paletteOffset === 'mixed' && <option value="">Mixed</option>}
            <option value={0}>0</option>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </div>

        {/* Bank Offset */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400">Bank Offset</label>
          <select
            value={bankOffset === 'mixed' ? '' : bankOffset}
            onChange={(e) => onChange({ bankOffset: Number(e.target.value) })}
            className="dk-input text-xs py-0.5 px-1 w-20"
          >
            {bankOffset === 'mixed' && <option value="">Mixed</option>}
            <option value={0}>0</option>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </div>

        {/* Type ID */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400">Type ID</label>
          <input
            type="number"
            value={typeId === 'mixed' ? '' : typeId}
            placeholder={typeId === 'mixed' ? 'Mixed' : undefined}
            onChange={(e) => onChange({ typeId: Number(e.target.value) })}
            className="dk-input text-xs py-0.5 px-1 w-20"
            min={0}
            max={255}
          />
          <span className="text-xs text-zinc-600">For game logic (enemy type, item ID, etc.)</span>
        </div>

        {/* Delete button */}
        <div className="pt-2 border-t border-zinc-700">
          <button
            onClick={onDelete}
            className="dk-btn-danger text-xs py-1 px-2 w-full"
          >
            Delete {sprites.length === 1 ? 'Sprite' : `${sprites.length} Sprites`}
          </button>
        </div>
      </div>
    </div>
  );
}

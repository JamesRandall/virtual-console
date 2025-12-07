import type { TileEntry } from './TilemapEditor';

interface TileAttributes {
  flipH: boolean | 'mixed' | undefined;
  flipV: boolean | 'mixed' | undefined;
  priority: boolean | 'mixed' | undefined;
  palette: number | 'mixed' | undefined;
  bankOffset: number | 'mixed' | undefined;
}

interface AttributeEditorProps {
  attributes: TileAttributes | null;
  onAttributeChange: (attr: keyof Omit<TileEntry, 'index'>, value: boolean | number) => void;
}

export function AttributeEditor({ attributes, onAttributeChange }: AttributeEditorProps) {
  if (!attributes) {
    return (
      <div className="p-4">
        <h3 className="text-sm font-medium text-zinc-200 mb-4">Tile Attributes</h3>
        <p className="text-xs text-zinc-500">
          Use the pointer tool or select tool to select tiles, then edit their attributes here.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-zinc-200 mb-4">Tile Attributes</h3>

      <div className="flex flex-col gap-4">
        {/* Flip Horizontal */}
        <div className="flex items-center justify-between">
          <label className="text-xs text-zinc-400">Flip Horizontal</label>
          <input
            type="checkbox"
            checked={attributes.flipH === true}
            ref={(el) => {
              if (el) el.indeterminate = attributes.flipH === 'mixed';
            }}
            onChange={(e) => onAttributeChange('flipH', e.target.checked)}
            className="cursor-pointer"
          />
        </div>

        {/* Flip Vertical */}
        <div className="flex items-center justify-between">
          <label className="text-xs text-zinc-400">Flip Vertical</label>
          <input
            type="checkbox"
            checked={attributes.flipV === true}
            ref={(el) => {
              if (el) el.indeterminate = attributes.flipV === 'mixed';
            }}
            onChange={(e) => onAttributeChange('flipV', e.target.checked)}
            className="cursor-pointer"
          />
        </div>

        {/* Priority */}
        <div className="flex items-center justify-between">
          <label className="text-xs text-zinc-400">Priority (over sprites)</label>
          <input
            type="checkbox"
            checked={attributes.priority === true}
            ref={(el) => {
              if (el) el.indeterminate = attributes.priority === 'mixed';
            }}
            onChange={(e) => onAttributeChange('priority', e.target.checked)}
            className="cursor-pointer"
          />
        </div>

        {/* Palette Selection */}
        <div className="flex items-center justify-between">
          <label className="text-xs text-zinc-400">Palette</label>
          <select
            value={attributes.palette === 'mixed' ? '' : (attributes.palette ?? 0)}
            onChange={(e) => onAttributeChange('palette', Number(e.target.value))}
            className="dk-input text-xs py-1 px-2 w-20"
          >
            {attributes.palette === 'mixed' && <option value="">Mixed</option>}
            <option value={0}>0</option>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </div>

        {/* Bank Offset */}
        <div className="flex items-center justify-between">
          <label className="text-xs text-zinc-400">Bank Offset</label>
          <select
            value={attributes.bankOffset === 'mixed' ? '' : (attributes.bankOffset ?? 0)}
            onChange={(e) => onAttributeChange('bankOffset', Number(e.target.value))}
            className="dk-input text-xs py-1 px-2 w-20"
          >
            {attributes.bankOffset === 'mixed' && <option value="">Mixed</option>}
            <option value={0}>0</option>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </div>
      </div>

      {/* Help text */}
      <div className="mt-6 pt-4 border-t border-zinc-700">
        <h4 className="text-xs font-medium text-zinc-400 mb-2">Attribute Info</h4>
        <ul className="text-xs text-zinc-500 space-y-1">
          <li><span className="text-zinc-400">Flip H/V:</span> Mirror the tile</li>
          <li><span className="text-zinc-400">Priority:</span> Render in front of sprites</li>
          <li><span className="text-zinc-400">Palette:</span> Which palette slot (0-3)</li>
          <li><span className="text-zinc-400">Bank Offset:</span> Graphics bank offset</li>
        </ul>
      </div>
    </div>
  );
}

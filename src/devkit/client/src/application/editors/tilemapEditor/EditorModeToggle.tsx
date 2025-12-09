import type { EditorMode } from './spriteUtils';

interface EditorModeToggleProps {
  mode: EditorMode;
  onChange: (mode: EditorMode) => void;
}

export function EditorModeToggle({ mode, onChange }: EditorModeToggleProps) {
  return (
    <div className="flex items-center bg-zinc-700 rounded overflow-hidden">
      <button
        onClick={() => onChange('tile')}
        className={`px-3 py-1 text-xs font-medium transition-colors ${
          mode === 'tile'
            ? 'bg-blue-600 text-white'
            : 'text-zinc-300 hover:bg-zinc-600'
        }`}
        title="Tile editing mode (T)"
      >
        Tiles
      </button>
      <button
        onClick={() => onChange('sprite')}
        className={`px-3 py-1 text-xs font-medium transition-colors ${
          mode === 'sprite'
            ? 'bg-green-600 text-white'
            : 'text-zinc-300 hover:bg-zinc-600'
        }`}
        title="Sprite placement mode (S)"
      >
        Sprites
      </button>
    </div>
  );
}

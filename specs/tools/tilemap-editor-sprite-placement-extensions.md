# Tilemap Editor: Sprite Placement Extensions

## Overview

Extend the tilemap editor to support placing sprites on levels, enabling designers to define starting positions for game objects (enemies, collectibles, spawn points, etc.) that can be manipulated at runtime via assembly code.

## Goals

- Allow sprite placement directly in the level editor
- Store sprite placement data in a paired `.sbin` file per tilemap
- Keep the tile editing workflow unchanged
- Provide intuitive sprite selection, placement, and manipulation tools

## Non-Goals

- Runtime sprite animation editing (handled elsewhere)
- Sprite graphics editing (use the existing Sprite Editor)
- Multi-level sprite packing (future enhancement)

---

## File Format

### .sbin (Sprite Binary) Format

Each `.tbin` file has a paired `.sbin` file with the same base name in the same directory:
```
maps/level00.tbin  →  maps/level00.sbin
maps/level01.tbin  →  maps/level01.sbin
```

#### Binary Structure

```
Header (8 bytes):
┌─────────────────────────────────────────────────────┐
│ Offset │ Size │ Field         │ Description         │
├────────┼──────┼───────────────┼─────────────────────┤
│ 0x00   │ 2    │ sprite_count  │ Number of sprites   │
│ 0x02   │ 2    │ version       │ Format version (1)  │
│ 0x04   │ 4    │ reserved      │ Future use (0x00)   │
└─────────────────────────────────────────────────────┘

Sprite Entries (8 bytes each, repeated sprite_count times):
┌─────────────────────────────────────────────────────┐
│ Offset │ Size │ Field         │ Description         │
├────────┼──────┼───────────────┼─────────────────────┤
│ 0x00   │ 2    │ x             │ World X (uint16 LE) │
│ 0x02   │ 2    │ y             │ World Y (uint16 LE) │
│ 0x04   │ 1    │ sprite_index  │ Sprite gfx (0-255)  │
│ 0x05   │ 1    │ flags         │ Attribute flags     │
│ 0x06   │ 1    │ bank_offset   │ Graphics bank (0-3) │
│ 0x07   │ 1    │ type_id       │ Game-specific type  │
└─────────────────────────────────────────────────────┘

Flags byte layout:
┌─────────────────────────────────────────────────────┐
│ Bit │ Field          │ Description                  │
├─────┼────────────────┼──────────────────────────────┤
│ 7   │ flipH          │ Horizontal flip              │
│ 6   │ flipV          │ Vertical flip                │
│ 5   │ priority       │ 1 = behind tiles             │
│ 4-3 │ palette_offset │ Palette offset (0-3)         │
│ 2-0 │ reserved       │ Future use                   │
└─────────────────────────────────────────────────────┘
```

#### Capacity

- Header: 8 bytes
- Per sprite: 8 bytes
- Max file size: 32,768 bytes (one bank)
- Max sprites per level: (32,768 - 8) / 8 = **4,095 sprites**

#### Empty File

A newly created `.sbin` contains only the header with `sprite_count = 0`:
```
00 00 01 00 00 00 00 00
```

---

## Data Structures

### TypeScript Interfaces

```typescript
// Placed sprite in the level
interface LevelSprite {
  id: number;           // Unique ID within this level (for selection tracking)
  x: number;            // World X coordinate (pixels)
  y: number;            // World Y coordinate (pixels)
  spriteIndex: number;  // Sprite graphics index (0-255)
  flipH: boolean;
  flipV: boolean;
  priority: boolean;    // true = render behind tiles
  paletteOffset: number; // 0-3
  bankOffset: number;   // 0-3
  typeId: number;       // Game-specific type identifier (0-255)
}

// Editor mode
type EditorMode = 'tile' | 'sprite';

// Sprite-specific tools
type SpriteTool = 'place' | 'select' | 'delete';

// Sprite selection state
interface SpriteSelection {
  spriteIds: Set<number>;
}

// Sprite clipboard for copy/paste
interface SpriteClipboard {
  sprites: Omit<LevelSprite, 'id'>[]; // IDs assigned on paste
  anchorX: number; // Reference point for relative positioning
  anchorY: number;
}

// Undo state extension
interface UndoState {
  width: number;
  height: number;
  tiles: TileEntry[][];
  sprites: LevelSprite[]; // Added
}
```

---

## UI Design

### Mode Toggle

Add a segmented control to the toolbar, before the undo/redo buttons:

```
┌─────────────────────────────────────────────────────────────┐
│ [Tiles][Sprites]  │  [↶][↷]  │  [Tool Palette]  │  [Resize] │
└─────────────────────────────────────────────────────────────┘
```

- Default mode: Tiles
- Mode persists for the editing session
- Keyboard shortcut: `T` for tiles, `S` for sprites

### Tool Palette by Mode

**Tile Mode (existing):**
| Icon | Tool | Shortcut |
|------|------|----------|
| ✏️ | Pen | P |
| ⬜ | Eraser | E |
| 🪣 | Fill | F |
| ╱ | Line | L |
| ▢ | Rectangle | R |
| ⬚ | Select | M |
| ✥ | Move | V |
| 👆 | Pointer | I |

**Sprite Mode (new):**
| Icon | Tool | Shortcut |
|------|------|----------|
| ➕ | Place | P |
| ⬚ | Select | M |
| 🗑️ | Delete | D |

### Left Panel by Mode

**Tile Mode:** Existing `TilePicker` component

**Sprite Mode:** New `SpritePicker` component
- Grid of sprites from the configured `gbin`
- Click to select sprite index for placement
- Shows sprite index number overlay
- Respects palette configuration from config.json

### Attribute Panel by Mode

**Tile Mode:** Existing `AttributeEditor` component

**Sprite Mode:** New `SpriteAttributeEditor` component (when sprite(s) selected)
- Flip H checkbox
- Flip V checkbox
- Priority checkbox (behind tiles)
- Palette offset dropdown (0-3)
- Bank offset dropdown (0-3)
- Type ID input (0-255)
- Position fields (X, Y) - editable for precise placement

---

## Canvas Behavior

### Rendering Layers

1. **Background** (checkerboard for transparency)
2. **Tiles** (existing)
3. **Sprite Layer** (new)
4. **Selection Overlays** (existing for tiles, new for sprites)
5. **Preview/Ghost** (paste preview, placement preview)

### Mode-Specific Rendering

**Tile Mode:**
- Tiles: Full opacity
- Sprites: 50% opacity, non-interactive
- Purpose: See sprite context while editing tiles

**Sprite Mode:**
- Tiles: 70% opacity
- Sprites: Full opacity, interactive
- Selected sprites: Highlight border + resize handles (future)
- Hovered sprite: Subtle highlight

### Sprite Rendering

- Sprites render at their world coordinates
- Use same atlas/rendering approach as tiles
- Apply flip, palette, bank offset transformations
- Show sprite index or type ID as small label (toggle option)

---

## Tool Behaviors

### Place Tool (Sprite Mode)

| Action | Behavior |
|--------|----------|
| Click | Place sprite at click position (snapped to pixel) |
| Shift+Click | Place sprite aligned to 8px grid |
| Ctrl+Click | Place sprite aligned to 16px grid (tile grid) |
| Drag | Place multiple sprites along drag path (throttled) |

New sprites inherit current attribute settings from the attribute panel defaults.

### Select Tool (Sprite Mode)

| Action | Behavior |
|--------|----------|
| Click sprite | Select single sprite (deselect others) |
| Click empty | Deselect all |
| Shift+Click | Add/remove from selection |
| Drag on empty | Marquee select |
| Drag on sprite | Move selected sprite(s) |
| Arrow keys | Nudge selected sprite(s) by 1px |
| Shift+Arrow | Nudge by 8px |
| Delete/Backspace | Delete selected sprites |
| Ctrl+C | Copy selected sprites |
| Ctrl+X | Cut selected sprites |
| Ctrl+V | Paste (enters paste preview mode) |
| Ctrl+D | Duplicate selected sprites (offset by 16px) |

### Delete Tool (Sprite Mode)

| Action | Behavior |
|--------|----------|
| Click sprite | Delete single sprite |
| Drag | Delete sprites under cursor |

---

## Keyboard Shortcuts

### Global (Both Modes)

| Shortcut | Action |
|----------|--------|
| T | Switch to Tile Mode |
| S | Switch to Sprite Mode |
| Ctrl+Z | Undo |
| Ctrl+Y / Ctrl+Shift+Z | Redo |
| Ctrl+S | Save |

### Sprite Mode Specific

| Shortcut | Action |
|----------|--------|
| P | Place tool |
| M | Select tool |
| D | Delete tool |
| Delete | Delete selection |
| Ctrl+A | Select all sprites |
| Escape | Deselect / cancel paste preview |
| H | Flip selected horizontal |
| V | Flip selected vertical |

---

## State Management

### New State in TilemapEditor

```typescript
// Add to TilemapEditor component state
const [editorMode, setEditorMode] = useState<EditorMode>('tile');
const [sprites, setSprites] = useState<LevelSprite[]>([]);
const [selectedSpriteIds, setSelectedSpriteIds] = useState<Set<number>>(new Set());
const [spriteTool, setSpriteTool] = useState<SpriteTool>('select');
const [spriteToPlace, setSpriteToPlace] = useState<number>(0); // sprite index
const [spriteClipboard, setSpriteClipboard] = useState<SpriteClipboard | null>(null);
const [nextSpriteId, setNextSpriteId] = useState<number>(1);

// Default attributes for new sprites
const [defaultSpriteAttrs, setDefaultSpriteAttrs] = useState({
  flipH: false,
  flipV: false,
  priority: false,
  paletteOffset: 0,
  bankOffset: 0,
  typeId: 0,
});
```

### Undo/Redo Integration

Extend existing undo system to include sprites:

```typescript
interface UndoState {
  width: number;
  height: number;
  tiles: TileEntry[][];
  sprites: LevelSprite[]; // Added
}

// Push to undo stack on:
// - Sprite placement
// - Sprite deletion
// - Sprite move
// - Sprite attribute change
// - Any tile operation (existing)
```

### Dirty Tracking

Mark document dirty on any sprite change (same as tile changes).

---

## File Operations

### Creating New Tilemap

When creating a new `.tbin` file:
1. Create the `.tbin` with default dimensions
2. Create matching `.sbin` with empty header (8 bytes, sprite_count=0)

### Loading

When opening a `.tbin`:
1. Load and parse `.tbin` (existing)
2. Derive `.sbin` path: `filePath.replace('.tbin', '.sbin')`
3. If `.sbin` exists: load and parse sprites
4. If `.sbin` missing: initialize empty sprites array, create on save

### Saving

When saving:
1. Serialize tiles to `.tbin` (existing)
2. Serialize sprites to `.sbin`:
   ```typescript
   function serializeSbin(sprites: LevelSprite[]): Uint8Array {
     const buffer = new Uint8Array(8 + sprites.length * 8);
     const view = new DataView(buffer.buffer);

     // Header
     view.setUint16(0, sprites.length, true);  // sprite count
     view.setUint16(2, 1, true);               // version
     view.setUint32(4, 0, true);               // reserved

     // Sprites
     sprites.forEach((sprite, i) => {
       const offset = 8 + i * 8;
       view.setUint16(offset + 0, sprite.x, true);
       view.setUint16(offset + 2, sprite.y, true);
       buffer[offset + 4] = sprite.spriteIndex;
       buffer[offset + 5] = encodeFlags(sprite);
       buffer[offset + 6] = sprite.bankOffset;
       buffer[offset + 7] = sprite.typeId;
     });

     return buffer;
   }

   function encodeFlags(sprite: LevelSprite): number {
     let flags = 0;
     if (sprite.flipH) flags |= 0x80;
     if (sprite.flipV) flags |= 0x40;
     if (sprite.priority) flags |= 0x20;
     flags |= (sprite.paletteOffset & 0x03) << 3;
     return flags;
   }
   ```
3. Save both files

---

## Component Structure

### New Components

```
src/application/editors/tilemapEditor/
├── TilemapEditor.tsx        # Extend with sprite state + mode
├── TilemapCanvas.tsx        # Extend with sprite rendering + interaction
├── TilePicker.tsx           # Existing (unchanged)
├── TilemapToolPalette.tsx   # Extend with mode-aware tools
├── AttributeEditor.tsx      # Existing (unchanged)
├── ResizeDropdown.tsx       # Existing (unchanged)
├── EditorModeToggle.tsx     # NEW: Tile/Sprite mode switcher
├── SpritePicker.tsx         # NEW: Sprite selection for placement
├── SpriteAttributeEditor.tsx # NEW: Attributes for selected sprites
└── spriteUtils.ts           # NEW: sbin parsing/serialization
```

### EditorModeToggle.tsx

```typescript
interface EditorModeToggleProps {
  mode: EditorMode;
  onChange: (mode: EditorMode) => void;
}
```

Simple segmented control with "Tiles" and "Sprites" options.

### SpritePicker.tsx

```typescript
interface SpritePickerProps {
  gbinPath: string;
  pbinPath: string;
  selectedIndex: number;
  onSelect: (index: number) => void;
  paletteConfigs?: SpritePaletteConfig[];
}
```

Grid display of available sprites. Reuse rendering logic from existing tile picker / sprite editor.

### SpriteAttributeEditor.tsx

```typescript
interface SpriteAttributeEditorProps {
  sprites: LevelSprite[];           // Selected sprites
  onChange: (updates: Partial<LevelSprite>) => void;
  onPositionChange: (id: number, x: number, y: number) => void;
}
```

Shows attributes for selection. Mixed values shown as indeterminate.

### spriteUtils.ts

```typescript
// Parse .sbin file
function parseSbin(data: Uint8Array): LevelSprite[];

// Serialize sprites to .sbin format
function serializeSbin(sprites: LevelSprite[]): Uint8Array;

// Generate unique sprite ID
function generateSpriteId(existing: LevelSprite[]): number;

// Hit testing
function findSpriteAt(sprites: LevelSprite[], x: number, y: number): LevelSprite | null;

// Marquee selection
function findSpritesInRect(
  sprites: LevelSprite[],
  rect: { x: number, y: number, width: number, height: number }
): LevelSprite[];
```

---

## Implementation Phases

### Phase 1: Foundation
1. Create `spriteUtils.ts` with sbin parse/serialize functions
2. Add `.sbin` creation alongside `.tbin` in file creation flow
3. Load sprites when opening tilemap editor
4. Save sprites alongside tilemap
5. Add sprite state to undo system

### Phase 2: Display
1. Add `EditorModeToggle` component
2. Extend `TilemapCanvas` to render sprites
3. Implement mode-specific opacity (dim inactive layer)
4. Add sprite labels/indicators option

### Phase 3: Sprite Picker
1. Create `SpritePicker` component
2. Wire up sprite selection for placement
3. Show picker in left panel when in sprite mode

### Phase 4: Placement Tool
1. Implement place tool click handling
2. Add grid snapping options
3. Show placement preview cursor
4. Wire up default attributes

### Phase 5: Selection & Manipulation
1. Implement select tool with click/marquee
2. Add sprite dragging (move)
3. Implement keyboard nudging
4. Add multi-select support

### Phase 6: Deletion & Clipboard
1. Implement delete tool
2. Add Delete key handling
3. Implement copy/cut/paste
4. Add duplicate (Ctrl+D)

### Phase 7: Attribute Editing
1. Create `SpriteAttributeEditor` component
2. Wire up attribute changes
3. Handle mixed selection values
4. Add position editing fields

### Phase 8: Polish
1. Add keyboard shortcuts
2. Refine visual feedback
3. Add status bar info (sprite count, selection)
4. Test edge cases and undo/redo

---

## Testing Considerations

- Load/save round-trip: sprites survive save and reload
- Undo/redo: all sprite operations reversible
- Large sprite counts: performance with 1000+ sprites
- Edge cases: sprites at 0,0; sprites at max coordinates
- Mode switching: state preserved between modes
- Dirty tracking: unsaved changes warning works for sprite changes

---

## Future Enhancements

- Sprite layers/groups for organization
- Sprite templates (predefined type + attributes)
- Copy sprites between levels
- Search/filter sprites by type
- Bulk attribute editing
- Sprite alignment tools (distribute, align edges)
- Multi-level sbin packing for cartridge optimization
- Visual connection lines between related sprites (e.g., patrol paths)

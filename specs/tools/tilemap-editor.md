# Tilemap Editor

First read these documents:

    /Users/jamesrandall/code/virtual-console/specs/hardware/cpu.md
    /Users/jamesrandall/code/virtual-console/specs/hardware/memory-layout.md
    /Users/jamesrandall/code/virtual-console/specs/hardware/video.md
    /Users/jamesrandall/code/virtual-console/specs/tools/assembler.md
    /Users/jamesrandall/code/virtual-console/src/devkit/react-guidelines.md
    /Users/jamesrandall/code/virtual-console/src/devkit/client/styleguide.md
    /Users/jamesrandall/code/virtual-console/specs/hardware/sprites.md
    /Users/jamesrandall/code/virtual-console/specs/hardware/tilemap.md
    /Users/jamesrandall/code/virtual-console/specs/implementation/tilemap-impl.md

Now look at the existing IDE editors in this folder:

    /Users/jamesrandall/code/virtual-console/src/devkit/client/src/application/editors

We make specific reference to the sprite editor in this spec:

    /Users/jamesrandall/code/virtual-console/src/devkit/client/src/application/editors/spriteEditor

And the project explorer in this folder:

    /Users/jamesrandall/code/virtual-console/src/devkit/client/src/application/projectExplorer

---

## Overview

We want to add an editor that lets us work on tilemap files. Tilemaps are stored in the existing `maps` folder in the project structure. Within this folder we can create tilemaps that are `.tbin` files. The tilemaps are basically a 32KB chunk of ROM/RAM that we can bundle into the cartridge and use with the tilemap system. The tilemap.md spec outlines the format.

---

## File Format (.tbin)

### Structure

The `.tbin` file is a 32KB binary file with the following structure:

**Header (8 bytes):**
- Bytes 0-1: Width in tiles (little-endian uint16)
- Bytes 2-3: Height in tiles (little-endian uint16)
- Bytes 4-7: Reserved for future use (set to 0)

**Tile Data (remaining bytes):**
- Each tile is 2 bytes stored in row-major order
- Byte 0: Tile index (0-255, where 0 = transparent/no tile)
- Byte 1: Tile attributes:
  - Bit 7: Flip horizontal (0=normal, 1=flipped)
  - Bit 6: Flip vertical (0=normal, 1=flipped)
  - Bit 5: Priority (0=behind sprites, 1=in front of sprites)
  - Bits 4-3: Palette selection (0-3)
  - Bit 2: Reserved (must be 0)
  - Bits 1-0: Bank offset (0-3, added to TILEMAP_GRAPHICS_BANK)

**Size Constraints:**
- Maximum 32KB total file size
- Header takes 8 bytes, leaving 32,760 bytes for tile data
- Each tile takes 2 bytes, so maximum 16,380 tiles
- Maximum dimensions validated by: width × height × 2 + 8 ≤ 32,768

---

## Editor Features

### Opening Files

* The editor is opened when double-clicking a `.tbin` file in the project explorer
* The project explorer should use the existing `maps` folder (already in project structure)
* File extension should be `.tbin` (not `.mbin`)

### Creating New Tilemaps

* When creating a new `.tbin` file in the project explorer, prompt the user for dimensions
* Default dimensions: 128×128 tiles
* Validate that the dimensions fit within the 32KB limit
* Initialize with header and all tiles set to index 0 (empty)

### Graphics and Palette Selection

* User can select which `.gbin` file to use for tile graphics
* User can select which `.pbin` file to use for palettes
* The association between gbin sprites and their palettes is stored in `config.json` (same pattern as sprite editor)
* This is a build-time concern - at runtime only the bank number matters
* Show tiles in the tile picker using the correct palettes from config.json

### Main Grid View (Center)

* Displays the tilemap as a scrollable/zoomable grid
* Each cell shows the tile graphic with its attributes applied (flip, palette)
* Grid lines to show tile boundaries
* Zoom controls (1x, 2x, 4x, 8x, etc.)
* Visual indication for selected tiles
* Empty tiles (index 0) shown as transparent/checkerboard

### Tile Picker (Bottom)

* Shows tiles from the selected `.gbin` file
* Similar to the existing SpritePicker component (can adapt/reuse)
* Display tiles with correct palettes from config.json
* Click to select a tile for painting
* **Checkbox option**: "Show only non-empty tiles" to filter out blank tiles
* Shows currently selected tile index

### Drawing Tools (Left Toolbar)

Reuse the same tool paradigm from the sprite editor, but drawing tiles instead of colors:

* **Pen Tool**: Click/drag to place the currently selected tile
* **Eraser Tool**: Click/drag to set tiles to index 0 (empty)
* **Fill Tool**: Flood fill an area with the currently selected tile
* **Rectangle Tool**: Draw a rectangle of tiles
* **Line Tool**: Draw a line of tiles
* **Select Tool**: Select a rectangular region of tiles
* **Move Tool**: Move selected tiles
* **Pointer Tool**: Click on placed tiles to select them for attribute editing

### Selection Operations

* **Cut**: Copy selection to clipboard and clear to index 0
* **Copy**: Copy selection to clipboard
* **Paste**: Paste from clipboard (shows preview, click to place)
* Selection supports multiple tiles (rectangular region)
* Move tool allows dragging selected tiles to new location

### Attribute Editor (Right Panel)

When tiles are selected (via pointer tool or selection tool), show an attribute editor panel:

* **Flip Horizontal**: Checkbox
* **Flip Vertical**: Checkbox
* **Priority**: Checkbox (behind/in front of sprites)
* **Palette**: Dropdown (0-3)
* **Bank Offset**: Dropdown (0-3)

Note: The tile index is NOT exposed in the attribute editor - tile placement is done through the painting tools.

Changes to attributes apply to all selected tiles.

### Undo/Redo

* Support undo/redo for tile placement and attribute changes
* Same pattern as sprite editor (push state before changes, max history limit)
* Undo/Redo buttons in toolbar

### Dimension Settings

* Display current dimensions in toolbar
* Allow changing dimensions (with warning about data loss if shrinking)
* Validate that new dimensions fit within 32KB limit

---

## Cartridge Integration

### Cartridge Editor Updates

Location: `/Users/jamesrandall/code/virtual-console/src/devkit/client/src/application/editors/cartridge`

* Add `.tbin` as a recognized asset type
* Show tbin files in the asset palette (with appropriate icon)
* Allow dragging tbin files into cartridge bank configuration

### Cartridge Bundler Updates

Location: `/Users/jamesrandall/code/virtual-console/src/devkit/client/src/services/cartridgeBundler.ts`

* Include `.tbin` files when building the cartridge ROM
* Load tbin files as 32KB banks (same as gbin/pbin)

---

## Project Explorer Updates

### File Type Recognition

* Recognize `.tbin` files as tilemap files
* Use appropriate icon (faMap already exists)
* Double-click opens the tilemap editor

### New File Dialog

* When creating a new file in the `maps` folder:
  * If filename ends with `.tbin`, show dimension picker dialog
  * Default dimensions: 128×128
  * Validate dimensions fit within 32KB
  * Create file with proper header and empty tile data

---

## UI Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ Toolbar: [Gbin Selector] [Pbin Selector] [Dimensions] [Zoom] [Undo/Redo] │
├─────┬───────────────────────────────────────────────────────┬───────┤
│     │                                                       │       │
│  T  │                                                       │  A    │
│  o  │              Main Tilemap Grid                        │  t    │
│  o  │              (scrollable canvas)                      │  t    │
│  l  │                                                       │  r    │
│  s  │                                                       │  i    │
│     │                                                       │  b    │
│     │                                                       │       │
├─────┴───────────────────────────────────────────────────────┴───────┤
│ Tile Picker: [Tiles from gbin] [☐ Show only non-empty]              │
│ Selected: Tile 42                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Notes

### Reusable Components

* Adapt `SpritePicker` component for tile selection
* Reuse `ToolPalette` component structure (with tilemap-specific tools)
* Reuse `PaletteSelector` component for palette selection
* Follow patterns from `SpriteEditor` for:
  * Undo/redo implementation
  * Selection handling
  * Clipboard operations
  * Canvas rendering

### State Management

* Use local React state (same pattern as SpriteEditor)
* Store tilemap data as base64-encoded content in openFiles
* Track dirty state for unsaved changes
* Store gbin/pbin associations in config.json

### Performance Considerations

* For large tilemaps (128×128 = 16,384 tiles), consider:
  * Only render visible tiles
  * Use canvas for efficient rendering
  * Debounce redraw on scroll/zoom

---

## File Locations

New files to create:
- `/src/devkit/client/src/application/editors/tilemapEditor/TilemapEditor.tsx`
- `/src/devkit/client/src/application/editors/tilemapEditor/TilemapCanvas.tsx`
- `/src/devkit/client/src/application/editors/tilemapEditor/TilePicker.tsx`
- `/src/devkit/client/src/application/editors/tilemapEditor/TilemapToolPalette.tsx`
- `/src/devkit/client/src/application/editors/tilemapEditor/AttributeEditor.tsx`
- `/src/devkit/client/src/application/editors/tilemapEditor/DimensionSelector.tsx`

Files to modify:
- `/src/devkit/client/src/application/editors/EditorContainer.tsx` - Add tbin editor routing
- `/src/devkit/client/src/application/projectExplorer/ProjectExplorer.tsx` - Handle tbin files
- `/src/devkit/client/src/application/projectExplorer/NewFileDialog.tsx` - Add dimension picker for tbin
- `/src/devkit/client/src/application/editors/cartridge/CartridgeEditor.tsx` - Add tbin support
- `/src/devkit/client/src/application/editors/cartridge/AssetPalette.tsx` - Show tbin files
- `/src/devkit/client/src/services/cartridgeBundler.ts` - Bundle tbin files
- `/src/devkit/client/src/services/fileSystemService.ts` - Create tbin with header

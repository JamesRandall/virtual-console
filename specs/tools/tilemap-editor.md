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

We want to add an editor that lets us work on tilemap files. This will require adding a "tilemap" folder to our project explorer. It should be added to the default project structure. Within these folder we should be able to create tilemaps that are .tbin files. The tilemaps are basically a 32k chunk of ROM/RAM that we can bundle into the cartridge and use with the tilemap system. The tilemap.md spec outlines the format.

Our tilemap editor should have the following features:

* Is opened when we double click a .tbin file in the project explorer
* Allows us to set the dimensions of the tilemap - and validates that the dimensions will fit within the 32k space (each tile takes 2 bytes, so we can have up to 16k total tiles)
* We should be able to select which gbin file we are using for tiles and which pbin file we are using for palettes
* The main view should be a grid onto which we can "draw" tiles
* Their should be a sprite palette and the bottom of the screen that lets us pick tiles
* We should be able to draw with the currently selected tile with the same tools you will find in the sprite editor - only we're not drawing colours, we're drawing tiles
    - We also need a "pointer" tool that lets us pick a drawn tile so we can edit its attributes
    - We should also be able to use the select, cut, copy, paste, move tools
* The eraser should set the tile index to 0 - 0 means "no tile"
* On the right hand side we need an "attribute" editor that lets us edit the attributes of a selected tile
* Note that our config.json file in the root of the project will associate a graphic/sprite in an sbin with its palette. This isn't encoded into the gbin files but can be used to select the default palette for the tile attributes for a tile. We should show the sprites in the sprite picker using the correct palettes
    - In the components folder you will find an existing sprite picker that you may be able to adapt and reuse

# Palette Editor

First read the memory layout specification, specifically the part that begins around line 460 explaining how palettes are configured.

/Users/jamesrandall/code/virtual-console/specs/hardware/memory-layout.md

Now read the following:

/Users/jamesrandall/code/virtual-console/src/devkit/client/react-guidelines.md
/Users/jamesrandall/code/virtual-console/src/devkit/client/styleguide.md
/Users/jamesrandall/code/virtual-console/src/devkit/client/src/**

## Phase 1

I want to begin by adding a "palettes" folder to our project file structure. This will contain .pbin files - each of these .pbin files are a 1k block of bytes that we will be packing onto our cartridge and that defines the palettes in use. When we create a project we should create a default palette called default.pbin which is set to be all zero.

I also want us to add a config.json into the root of or project structure. This should default to:

```json
{
    "mode": 0
}
```

It defines settings for our game and editor, for now just the screen mode our tools are working with. We will need to reference this in our tools so it should be loaded into the Zustand store.


## Phase 2

In phase 2 I want us to rework our code so that we have a single source of truth for the palette. Currently it is duplicated in two places:

    /Users/jamesrandall/code/virtual-console/src/devkit/client/src/components/ImageGenerator.tsx
    /Users/jamesrandall/code/virtual-console/src/devkit/client/src/consoleIntegration/webgpuRendering.ts

We should move this to a single file and actually define it as part of our console "hardware". Place the single source of truth in:

    /Users/jamesrandall/code/virtual-console/src/console/src/systemPalette.ts

The Web GPU renderer should "build" the palette into the shader by reading this. We still want it to form part of the shader as it does now but construct the string for it from the source of truth.


## Phase 3

In phase 3 we are going to create a palette editor. This editor should open as a tab in our editor space and so the routing should be extended in:

    /Users/jamesrandall/code/virtual-console/src/devkit/client/src/application/editors/EditorContainer.tsx

The editor itself should be created as a series of components in:

    /Users/jamesrandall/code/virtual-console/src/devkit/client/src/application/editors/palette

The editor should have the following features:

* Make use of a vertical split pane - the top half representing the pbin being edited and the bottom half showing the system palette (making use of our source of truth)
* We should show all "palette blocks" being edited (64 blocks of 16 colours for 4bpp modes, 4 blocks of 256 colours for 8bpp modes - read the mode from config.json) with a demarkation between them so it is clear they are different palette blocks
* We should use drag and drop to allow the user to drag a colour from the system palette into the palette block, setting the index in the block
* We should be able to drag and drop between our palette blocks
* We need a save feature that saves the block back to our .pbin file


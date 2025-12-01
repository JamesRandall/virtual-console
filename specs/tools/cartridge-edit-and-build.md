# Cartridge Edit and Build

I want to create an editor that allows the user to define how the cartridge is built - and then build it!

Read the following files:

    /Users/jamesrandall/code/virtual-console/specs/tools/ide-framework.md
    /Users/jamesrandall/code/virtual-console/src/devkit/client/react-guidelines.md
    /Users/jamesrandall/code/virtual-console/src/devkit/client/styleguide.md
    /Users/jamesrandall/code/virtual-console/src/devkit/client/src/*

You can find the existing editors here as a reference:

    /Users/jamesrandall/code/virtual-console/src/devkit/client/src/application/editors

## Phase 1 - Cartridge Editor

When the user clicks the cartridge.json file in the file tree, we should open the cartridge editor. It should have the following features:

* Present a "list" that shows our asset files.
  - Item 0 should be our metadata bank - it will contain the load positions for our assembler based on the .org directive in our code and (eventually) a loading screen. This is fixed.
  - Item 1 should be our "build source" - lets call it code. This should be fixed.
  - Subsequent items should be our assets - pbin files, gbin files, tbin files.
  - We need to be able to rearrange the order of these asset files - except items 0 and 1 which are fixed.
  - The order of the asset files indicates the 32k bank on the cartridge to which they are assigned.
  - None of the assets should be included to begin with exist the fixed code bank.
  - We should be able to drag and drop items into the list from a "palette" of our assets
  - We should be able to delete items from the list
  - We should be able to reorder items in the list
* When saved this should update the cartridge.json file in the cartridge directory. The file should be edited to that the bank list is added / overwritten:

{
    ...,
    "banks": [
        "metadata.bin",
        "code.bin",
        "tiles/mytiles.gbin",
        "sprites/mysprites_1.gbin",
        "sprites/mysprites_1.gbin",
        "maps/level0.tbin"
    ]
}

## Phase 2 - Building the cartridge

In the devkit we need to add a "build" button to the left of the run button that will build the cartridge. When pressed it will create a cartridge.rom file in the root directory and show it in the project explorer. The build process should take the assets and pack them into the cartridge using 32k alignment for each bank so that our code can say things like "the sprites are in bank 1". You will need to assemble the code to obtain the code.bin asset.

## Phase 3 - Updating our run process

When the run button is pressed we should copy the code in bank 1 into RAM positioning it based on the org metadata in bank 0. We should then position the program counter, start the emulator and switch to run/debug mode as we do now but things should already be running (we don't want to have to press the debuggers run button to start it).
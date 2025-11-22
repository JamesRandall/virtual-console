# Conversion to an IDE

I want to update the development kit and start to transform it into a more integrated development experience. Before continuing please read the following:

/Users/jamesrandall/code/virtual-console/src/devkit/client/react-guidelines.md
/Users/jamesrandall/code/virtual-console/src/devkit/client/src

## Description of changes

The changes I want to make are described below.

### Introduction of a project explorer

To support the creation of more complex projects and to enable us to edit multiple source files, cartridges, levels we need to introduce a "Project Explorer". This should take the form of a tree view on the left of the devkit (inside a splitter pane) and be backed by a users chosed folder on their file system.

Projects should have a top level folder structure as follows:

src - contains .asm files, their must ALWAYS be a main.asm file that represents the entry point to the program
sprites - contains .gbin files, 32k blocks that store graphics data and can be packed onto a cartridge
tiles - contains .gbin files, 32k blocks that store graphics data and can be packed onto a cartridge
maps - contains .mbin files, 32k blocks that contain tilemap data and can be packed onto a cartridge
cartridge.json - a top level file that defines how the cartridge is laid out from the source assets

For the tree view I would like to use the popular react-arborist component: https://github.com/brimdata/react-arborist?tab=readme-ov-file

We should be able to right click the folders and add new files, delete files (except main.asm and cartridge.json). I'd like to use appropriate FontAwesome icons for the nodes (we already have the package added). You should be able to double click a file and open it for editing. Open files should be shown in tabs at the top of the editor. The editor we show will depend on the file type - but for now we will only have an editor for .asm files, and that is the Monaco based editor we have now. This editor should continue to support the setting of breakpoints.

We need to allow the user to select what folder on their file system they are using for the project and to be able to create a new project (give it a name and create a subfolder within a selected folder) and create the base files. For now cartridge.json can be a simple empty JSON object and main.asm can contain the following example program:

```
.org $B80
  LD R0, #$AA      ; Load pattern
  LD R1, #0        ; Counter
  LD R2, #0        ; Address high byte
  LD R3, #0        ; Address low byte
loop:
  ST R0, [R2:R3]   ; Store pattern
  INC R3           ; Next address
  INC R1           ; Increment counter
  CMP R1, #16      ; Check if done
  BRNZ loop        ; Loop if not done
infiniteloop:
  JMP infiniteloop
```

The current project location should be stored in local storage so that its remembered between browser sessions. And if the setting is not available on startup the user should be given the choice of picking a local folder and/or creating a new project.

### Introduction of a debug / edit mode toggle

Our system is getting quite complex and busy now and we need to free up some screen space. What we've built so far is essentially the debugger. We need to be able to toggle modes so that we have more space for the editor. This should take the form of a "run" button like in IDEs that assembles the code and then runs it - showing the debugger (memory map, running console etc.). For now when run is pressed all it should do is assemble main.asm but we should architect the solution such that this is easy to extend - ultimately we will want to pack the cartridge.

When running a button should be available to "stop" and return to the editor.

Chat should be available in both modes.

## Implementation

I want to implement this in two phases. In phase 1 implement the project explorer but the design should account for the addition of the "run" button in phase 2 where we will implement the "run" mode.
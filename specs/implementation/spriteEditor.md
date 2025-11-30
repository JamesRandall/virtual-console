# Sprite Editor

Begin by reading these files:

    /Users/jamesrandall/code/virtual-console/src/devkit/client/react-guidelines.md
    /Users/jamesrandall/code/virtual-console/src/devkit/client/styleguide.md
    /Users/jamesrandall/code/virtual-console/specs/implementation/ide-framework.md
    /Users/jamesrandall/code/virtual-console/specs/implementation/palette_editor.md
    /Users/jamesrandall/code/virtual-console/specs/hardware/sprites.md
    

We want to create a sprite editor for our .gbin files. The sprite editor should have the following features:

* When opened the sprite editor should take a copy of the .gbin file
* A save button should be available that writes back to the .gbin file
* Allow a user to pick a palette file (.pbin) and palette from the file to use for the display of the sprite in the editor (this should be changeable while editing)
* Pick a sprite from the .gbin - the gbin contains 256 sprites, start on sprite 0
* Sprites are sized 16x16 and 4bpp (we will look at 8bpp later, account for this in the design but don't implement it)
* Set a colour to draw with from the selected palette
    - Show the colours in a zone at the bottom of the editor pane
    - Show the selected colour highlighted by a white or black rectangle (depending on the brightness of the selected colour) and similarly coloured "small circle" centered in the colour.
* Support a tool palette which should be shown at the left of the editor:
    - Drawing tools:
        - Pixels (use the FontAwesome pen icon) 
        - Rectangles (use the FontAwesome rectangle icon)
        - Circles (use the FontAwesome circle icon)
        - Lines (use the FontAwesome pen-line icon)
    - Selection tools:
        - Select area (use the FontAwesome square-dashed icon)
        - Cut area (use the FontAwesome scissors icon)
        - Copy area (use the FontAwesome copy icon)
        - Paste (use the FontAwesome paste icon)
        - Drag move area (use the FontAwesome hand icon)
* Set zoom levels for the sprite, start at 16x
    - Zoom should not be "smoothed" - we want to see the hard edges of the zoomed pixels
* Be able to show colour index 0 both as its colour and as transparency - when used as a sprite index 0 always means transparent

Its important to note that the sprites are stored row wise in the .gbin in 4bpp format - high nibble even pixels, low nibble odd pixels. The gbin is basically a continuous block of sprites and we need to be able to 
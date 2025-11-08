# Add controller input

First read these files:

/Users/jamesrandall/code/virtual-console/specs/hardware/cpu.md
/Users/jamesrandall/code/virtual-console/specs/hardware/memory-layout.md
/Users/jamesrandall/code/virtual-console/src/devkit/client/src/consoleIntegration/webgpuRendering.ts
/Users/jamesrandall/code/virtual-console/src/devkit/client/src/consoleIntegration/cpuWorker.ts
/Users/jamesrandall/code/virtual-console/src/console/src/cpu.ts
/Users/jamesrandall/code/virtual-console/src/console/src/memoryBus.ts

I want to add game pad controller support to the console. You will find the specifications for the mapping of a game pad onto memory registers in memory-layout.md. You will notice we want to support two "plugged in" controllers.

The left thumbstick of the controller should behave in the same way as the d-pad - but allow a deadzone so that tiny movements of it don't result in a change in the register.

Mappings should be as follows:

B12 or l-stick up - up
B13 or l-stick down - down
B14 or l-stick left - left
B15 or l-stick right - right
B5 - RB / right shoulder
B4 - LB / left shoulder
B3 - Button A
B4 - Button B
B0 - Button C
B2 - Button D
B9 - Options
B8 - Start



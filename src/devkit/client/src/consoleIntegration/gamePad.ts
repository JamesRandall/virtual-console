/**
 * Gamepad Input Handling for Virtual Console
 *
 * Polls connected gamepads and updates controller registers in shared memory.
 * Supports up to 2 controllers with D-pad, face buttons, shoulder buttons, and analog stick input.
 */

// Controller register addresses
const CONTROLLER_1_BUTTONS = 0x0136;
const CONTROLLER_1_EXTENDED = 0x0137;
const CONTROLLER_2_BUTTONS = 0x0138;
const CONTROLLER_2_EXTENDED = 0x0139;

// Thumbstick deadzone (analog values below this threshold are ignored)
const THUMBSTICK_DEADZONE = 0.25;

/**
 * Poll gamepad state and update controller registers in memory
 */
export function pollGamepads(memory: Uint8Array): void {
  const gamepads = navigator.getGamepads();

  // Debug: Log gamepad detection once every 60 frames (1 second)
  if (Math.random() < 1/60) {
    const connected = Array.from(gamepads).filter(g => g?.connected).length;
    if (connected > 0) {
      console.log(`Gamepads connected: ${connected}`);
    }
  }

  // Process up to 2 controllers
  for (let controllerIndex = 0; controllerIndex < 2; controllerIndex++) {
    const gamepad = gamepads[controllerIndex];

    // Calculate register addresses for this controller
    const buttonsAddr = controllerIndex === 0 ? CONTROLLER_1_BUTTONS : CONTROLLER_2_BUTTONS;
    const extendedAddr = controllerIndex === 0 ? CONTROLLER_1_EXTENDED : CONTROLLER_2_EXTENDED;

    if (!gamepad || !gamepad.connected) {
      // Controller not connected - clear registers
      memory[buttonsAddr] = 0;
      memory[extendedAddr] = 0;
      continue;
    }

    // Main buttons register (bits 7-0: Up, Down, Left, Right, A, B, C, D)
    let mainButtons = 0;

    // Extended buttons register (bits 3-0: LB, RB, Start, Options)
    let extendedButtons = 0;

    // D-pad buttons (B12-B15)
    if (gamepad.buttons[12]?.pressed) mainButtons |= 0x80; // Up (bit 7)
    if (gamepad.buttons[13]?.pressed) mainButtons |= 0x40; // Down (bit 6)
    if (gamepad.buttons[14]?.pressed) mainButtons |= 0x20; // Left (bit 5)
    if (gamepad.buttons[15]?.pressed) mainButtons |= 0x10; // Right (bit 4)

    // Left thumbstick handling with deadzone
    // Axis 0 = horizontal (left = -1, right = +1)
    // Axis 1 = vertical (up = -1, down = +1)
    const leftStickX = gamepad.axes[0] || 0;
    const leftStickY = gamepad.axes[1] || 0;

    if (leftStickY < -THUMBSTICK_DEADZONE) mainButtons |= 0x80; // Up (bit 7)
    if (leftStickY > THUMBSTICK_DEADZONE) mainButtons |= 0x40;  // Down (bit 6)
    if (leftStickX < -THUMBSTICK_DEADZONE) mainButtons |= 0x20; // Left (bit 5)
    if (leftStickX > THUMBSTICK_DEADZONE) mainButtons |= 0x10;  // Right (bit 4)

    // Face buttons
    // Note: The spec has B4 listed twice - using B1 for Button B based on standard layout
    if (gamepad.buttons[3]?.pressed) mainButtons |= 0x08; // Button A (bit 3) - B3
    if (gamepad.buttons[1]?.pressed) mainButtons |= 0x04; // Button B (bit 2) - B1
    if (gamepad.buttons[0]?.pressed) mainButtons |= 0x02; // Button C (bit 1) - B0
    if (gamepad.buttons[2]?.pressed) mainButtons |= 0x01; // Button D (bit 0) - B2

    // Shoulder buttons
    if (gamepad.buttons[4]?.pressed) extendedButtons |= 0x08; // LB (bit 3) - B4
    if (gamepad.buttons[5]?.pressed) extendedButtons |= 0x04; // RB (bit 2) - B5

    // Start/Options buttons
    if (gamepad.buttons[8]?.pressed) extendedButtons |= 0x02; // Start (bit 1) - B8
    if (gamepad.buttons[9]?.pressed) extendedButtons |= 0x01; // Options (bit 0) - B9

    // Write to memory registers using atomic operations for thread safety
    Atomics.store(memory, buttonsAddr, mainButtons);
    Atomics.store(memory, extendedAddr, extendedButtons);

    // Debug: Log button presses occasionally
    if ((mainButtons !== 0 || extendedButtons !== 0) && Math.random() < 0.1) {
      console.log(`Controller ${controllerIndex + 1}: main=0x${mainButtons.toString(16).padStart(2, '0')}, ext=0x${extendedButtons.toString(16).padStart(2, '0')}, addr=0x${buttonsAddr.toString(16)}`);
    }
  }
}

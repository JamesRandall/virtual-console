/**
 * Gamepad Input Handling for Virtual Console
 *
 * Polls connected gamepads and updates controller registers in shared memory.
 * Supports up to 2 controllers with D-pad, face buttons, shoulder buttons, and analog stick input.
 * Also supports keyboard input mapped to controller 1.
 */

// Controller register addresses
const CONTROLLER_1_BUTTONS = 0x0136;
const CONTROLLER_1_EXTENDED = 0x0137;
const CONTROLLER_2_BUTTONS = 0x0138;
const CONTROLLER_2_EXTENDED = 0x0139;

// Thumbstick deadzone (analog values below this threshold are ignored)
const THUMBSTICK_DEADZONE = 0.25;

// Button bit masks for main buttons register
const BUTTON_UP = 0x80;    // bit 7
const BUTTON_DOWN = 0x40;  // bit 6
const BUTTON_LEFT = 0x20;  // bit 5
const BUTTON_RIGHT = 0x10; // bit 4
const BUTTON_A = 0x08;     // bit 3
const BUTTON_B = 0x04;     // bit 2
const BUTTON_C = 0x02;     // bit 1
const BUTTON_D = 0x01;     // bit 0

// Button bit masks for extended buttons register
const BUTTON_LB = 0x08;      // bit 3
const BUTTON_RB = 0x04;      // bit 2
const BUTTON_START = 0x02;   // bit 1
const BUTTON_OPTIONS = 0x01; // bit 0

// Keyboard to controller mapping
// Maps keyboard key codes to { main?: number, extended?: number } button masks
const KEYBOARD_MAPPINGS: Record<string, { main?: number; extended?: number }> = {
  // D-pad: Arrow keys
  'ArrowUp': { main: BUTTON_UP },
  'ArrowDown': { main: BUTTON_DOWN },
  'ArrowLeft': { main: BUTTON_LEFT },
  'ArrowRight': { main: BUTTON_RIGHT },
  // Button A: Left Ctrl
  'ControlLeft': { main: BUTTON_C },
  // Future mappings can be added here:
  // 'KeyX': { main: BUTTON_A },
  // 'KeyZ': { main: BUTTON_B },
  // 'KeyC': { main: BUTTON_D },
  // 'ShiftLeft': { extended: BUTTON_LB },
  // 'ShiftRight': { extended: BUTTON_RB },
  // 'Enter': { extended: BUTTON_START },
  // 'Escape': { extended: BUTTON_OPTIONS },
};

// Track currently pressed keys
const pressedKeys = new Set<string>();

// Keyboard state for controller 1
let keyboardMainButtons = 0;
let keyboardExtendedButtons = 0;

/**
 * Initialize keyboard input listeners
 * Call this once when the application starts
 */
export function initKeyboardInput(): void {
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  // Clear pressed keys when window loses focus to prevent stuck keys
  window.addEventListener('blur', handleBlur);
}

/**
 * Clean up keyboard input listeners
 * Call this when the application is unmounting
 */
export function cleanupKeyboardInput(): void {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
  window.removeEventListener('blur', handleBlur);
  pressedKeys.clear();
  keyboardMainButtons = 0;
  keyboardExtendedButtons = 0;
}

function handleKeyDown(event: KeyboardEvent): void {
  const mapping = KEYBOARD_MAPPINGS[event.code];
  if (mapping && !pressedKeys.has(event.code)) {
    pressedKeys.add(event.code);
    if (mapping.main) keyboardMainButtons |= mapping.main;
    if (mapping.extended) keyboardExtendedButtons |= mapping.extended;
    // Prevent default for mapped keys to avoid browser shortcuts
    event.preventDefault();
  }
}

function handleKeyUp(event: KeyboardEvent): void {
  const mapping = KEYBOARD_MAPPINGS[event.code];
  if (mapping && pressedKeys.has(event.code)) {
    pressedKeys.delete(event.code);
    if (mapping.main) keyboardMainButtons &= ~mapping.main;
    if (mapping.extended) keyboardExtendedButtons &= ~mapping.extended;
  }
}

function handleBlur(): void {
  // Clear all pressed keys when window loses focus
  pressedKeys.clear();
  keyboardMainButtons = 0;
  keyboardExtendedButtons = 0;
}

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
      // Controller not connected - use keyboard input for controller 1, clear for others
      if (controllerIndex === 0) {
        Atomics.store(memory, buttonsAddr, keyboardMainButtons);
        Atomics.store(memory, extendedAddr, keyboardExtendedButtons);
      } else {
        memory[buttonsAddr] = 0;
        memory[extendedAddr] = 0;
      }
      continue;
    }

    // Main buttons register (bits 7-0: Up, Down, Left, Right, A, B, C, D)
    let mainButtons = 0;

    // Extended buttons register (bits 3-0: LB, RB, Start, Options)
    let extendedButtons = 0;

    // D-pad buttons (B12-B15)
    if (gamepad.buttons[12]?.pressed) mainButtons |= BUTTON_UP;
    if (gamepad.buttons[13]?.pressed) mainButtons |= BUTTON_DOWN;
    if (gamepad.buttons[14]?.pressed) mainButtons |= BUTTON_LEFT;
    if (gamepad.buttons[15]?.pressed) mainButtons |= BUTTON_RIGHT;

    // Left thumbstick handling with deadzone
    // Axis 0 = horizontal (left = -1, right = +1)
    // Axis 1 = vertical (up = -1, down = +1)
    const leftStickX = gamepad.axes[0] || 0;
    const leftStickY = gamepad.axes[1] || 0;

    if (leftStickY < -THUMBSTICK_DEADZONE) mainButtons |= BUTTON_UP;
    if (leftStickY > THUMBSTICK_DEADZONE) mainButtons |= BUTTON_DOWN;
    if (leftStickX < -THUMBSTICK_DEADZONE) mainButtons |= BUTTON_LEFT;
    if (leftStickX > THUMBSTICK_DEADZONE) mainButtons |= BUTTON_RIGHT;

    // Face buttons
    // Note: The spec has B4 listed twice - using B1 for Button B based on standard layout
    if (gamepad.buttons[3]?.pressed) mainButtons |= BUTTON_A; // B3
    if (gamepad.buttons[1]?.pressed) mainButtons |= BUTTON_B; // B1
    if (gamepad.buttons[0]?.pressed) mainButtons |= BUTTON_C; // B0
    if (gamepad.buttons[2]?.pressed) mainButtons |= BUTTON_D; // B2

    // Shoulder buttons
    if (gamepad.buttons[4]?.pressed) extendedButtons |= BUTTON_LB; // B4
    if (gamepad.buttons[5]?.pressed) extendedButtons |= BUTTON_RB; // B5

    // Start/Options buttons
    if (gamepad.buttons[8]?.pressed) extendedButtons |= BUTTON_START;   // B8
    if (gamepad.buttons[9]?.pressed) extendedButtons |= BUTTON_OPTIONS; // B9

    // Merge keyboard input for controller 1
    if (controllerIndex === 0) {
      mainButtons |= keyboardMainButtons;
      extendedButtons |= keyboardExtendedButtons;
    }

    // Write to memory registers using atomic operations for thread safety
    Atomics.store(memory, buttonsAddr, mainButtons);
    Atomics.store(memory, extendedAddr, extendedButtons);

    // Debug: Log button presses occasionally
    if ((mainButtons !== 0 || extendedButtons !== 0) && Math.random() < 0.1) {
      console.log(`Controller ${controllerIndex + 1}: main=0x${mainButtons.toString(16).padStart(2, '0')}, ext=0x${extendedButtons.toString(16).padStart(2, '0')}, addr=0x${buttonsAddr.toString(16)}`);
    }
  }
}

/**
 * Virtual Console
 *
 * Brings together the CPU and memory bus to form a complete virtual console system.
 */

import { CPU } from './cpu';
import { MemoryBus } from './memoryBus';

/**
 * VirtualConsole class that integrates the CPU and memory subsystems
 */
export class VirtualConsole {
  public readonly cpu: CPU;
  public readonly memory: MemoryBus;

  constructor() {
    this.memory = new MemoryBus();
    this.cpu = new CPU(this.memory);
  }
}

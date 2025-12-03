import { useDevkitStore } from '../../../stores/devkitStore.ts';

export async function handleReadMemory(parameters: Record<string, unknown>): Promise<unknown> {
  const rawAddress = parameters.address as string | number;
  const rawLength = parameters.length as string | number;

  // Parse address - handle hex strings like "0xA000" or decimal
  let address: number;
  if (typeof rawAddress === 'string') {
    address = rawAddress.toLowerCase().startsWith('0x')
      ? parseInt(rawAddress, 16)
      : parseInt(rawAddress, 10);
  } else {
    address = rawAddress;
  }

  // Parse length - handle both string and number
  let length: number;
  if (typeof rawLength === 'string') {
    length = rawLength.toLowerCase().startsWith('0x')
      ? parseInt(rawLength, 16)
      : parseInt(rawLength, 10);
  } else {
    length = rawLength;
  }

  console.log('📖 Reading memory at address:', typeof rawAddress === 'string' ? rawAddress : `0x${address.toString(16)}`, '(parsed:', address, ') length:', length);

  if (isNaN(address) || address < 0 || address > 0xFFFF) {
    throw new Error('Address out of range (0x0000-0xFFFF)');
  }

  if (isNaN(length) || length < 1 || length > 1024) {
    throw new Error('Length out of range (1-1024)');
  }

  const memorySnapshot = useDevkitStore.getState().memorySnapshot;
  const data: number[] = [];

  for (let i = 0; i < length && address + i < memorySnapshot.length; i++) {
    data.push(memorySnapshot[address + i]);
  }

  return {
    address,
    length: data.length,
    data,
  };
}

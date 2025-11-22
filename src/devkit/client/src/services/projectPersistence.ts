/**
 * Service for persisting project handles using IndexedDB
 * FileSystemHandle objects can be stored in IndexedDB and retrieved later
 */

// Extend FileSystemHandle interface for permission methods
declare global {
  interface FileSystemHandle {
    queryPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
    requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  }
}

const DB_NAME = 'virtual-console-devkit';
const DB_VERSION = 1;
const STORE_NAME = 'project-handles';
const PROJECT_KEY = 'current-project';

interface StoredProject {
  name: string;
  handle: FileSystemDirectoryHandle;
  lastOpened: number;
}

/**
 * Open the IndexedDB database
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Save the current project handle to IndexedDB
 */
export async function saveProjectHandle(
  name: string,
  handle: FileSystemDirectoryHandle
): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const project: StoredProject = {
      name,
      handle,
      lastOpened: Date.now(),
    };

    const request = store.put(project, PROJECT_KEY);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();

    transaction.oncomplete = () => db.close();
  });
}

/**
 * Retrieve the saved project handle from IndexedDB
 */
export async function getProjectHandle(): Promise<StoredProject | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(PROJECT_KEY);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      resolve(request.result || null);
    };

    transaction.oncomplete = () => db.close();
  });
}

/**
 * Clear the saved project handle
 */
export async function clearProjectHandle(): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(PROJECT_KEY);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();

    transaction.oncomplete = () => db.close();
  });
}

/**
 * Verify that we still have permission to access the handle
 * and request permission if needed
 */
export async function verifyHandlePermission(
  handle: FileSystemDirectoryHandle
): Promise<boolean> {
  // Check if we already have permission
  const permission = await handle.queryPermission({ mode: 'readwrite' });
  if (permission === 'granted') {
    return true;
  }

  // Request permission
  const requestedPermission = await handle.requestPermission({ mode: 'readwrite' });
  return requestedPermission === 'granted';
}

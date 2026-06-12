/**
 * offlineQueue.ts — IndexedDB persistent queue for offline requirement actions.
 * Handles saving and retrieving JSON payloads and binary assets (File/Blob) offline.
 */

export interface QueueItem {
  id: string; // Unique queue task ID
  type: 'create' | 'edit' | 'status';
  reqId: string; // Requirement ID (can be temporary like 'temp-xxx')
  payload: any; // Operation payload (can contain Blobs/Files)
  timestamp: number;
  errorCount: number;
  lastError?: string;
}

const DB_NAME = 'catatrack-offline-db';
const STORE_NAME = 'queue';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        dbPromise = null;
        resolve(null);
      };

      request.onblocked = () => {
        resolve(null);
      };
    } catch (err) {
      console.error('IndexedDB open error:', err);
      resolve(null);
    }
  });

  return dbPromise;
}

/**
 * Enqueues an operation to IndexedDB.
 */
export async function enqueueOperation(
  type: QueueItem['type'],
  reqId: string,
  payload: any
): Promise<QueueItem | null> {
  const db = await openDb();
  if (!db) return null;

  const item: QueueItem = {
    id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    reqId,
    payload,
    timestamp: Date.now(),
    errorCount: 0,
  };

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(item);

      request.onsuccess = () => resolve(item);
      request.onerror = () => resolve(null);
    } catch (err) {
      console.error('Failed to enqueue operation:', err);
      resolve(null);
    }
  });
}

/**
 * Retrieves all items in the queue, sorted by timestamp ascending.
 */
export async function getQueue(): Promise<QueueItem[]> {
  const db = await openDb();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const items = request.result as QueueItem[];
        // Sort by timestamp to ensure chronological order of actions
        items.sort((a, b) => a.timestamp - b.timestamp);
        resolve(items);
      };
      request.onerror = () => resolve([]);
    } catch (err) {
      console.error('Failed to get queue:', err);
      resolve([]);
    }
  });
}

/**
 * Removes an item from the queue.
 */
export async function dequeueOperation(id: string): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    } catch (err) {
      console.error('Failed to dequeue operation:', err);
      resolve(false);
    }
  });
}

/**
 * Updates an item's error count and message.
 */
export async function updateOperationError(id: string, errorMessage: string): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const item = getReq.result as QueueItem;
        if (item) {
          item.errorCount += 1;
          item.lastError = errorMessage;
          const putReq = store.put(item);
          putReq.onsuccess = () => resolve(true);
          putReq.onerror = () => resolve(false);
        } else {
          resolve(false);
        }
      };
      getReq.onerror = () => resolve(false);
    } catch (err) {
      console.error('Failed to update operation error:', err);
      resolve(false);
    }
  });
}

/**
 * Scans the queue and updates references to a temporary requirement ID
 * with the final Firestore ID returned by the backend.
 */
export async function updateQueueReqId(tempId: string, realId: string): Promise<void> {
  const db = await openDb();
  if (!db) return;

  const items = await getQueue();
  const matchedItems = items.filter((item) => item.reqId === tempId);

  if (matchedItems.length === 0) return;

  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  for (const item of matchedItems) {
    try {
      item.reqId = realId;
      // If there are internal references inside payload, update them too
      if (item.payload && typeof item.payload === 'object') {
        if (item.payload.id === tempId) item.payload.id = realId;
        if (item.payload.reqId === tempId) item.payload.reqId = realId;
      }
      store.put(item);
    } catch (err) {
      console.error(`Failed to update reqId from ${tempId} to ${realId} in item ${item.id}:`, err);
    }
  }
}

import { writable } from 'svelte/store';
import { getQueue } from '../lib/offlineQueue';

interface OfflineState {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncTime: number | null;
}

function createOfflineStore() {
  const { subscribe, update, set } = writable<OfflineState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    pendingCount: 0,
    isSyncing: false,
    lastSyncTime: null,
  });

  // Helper to update pending count from IndexedDB
  async function refreshPendingCount() {
    try {
      const items = await getQueue();
      update((s) => ({ ...s, pendingCount: items.length }));
    } catch (err) {
      console.error('Failed to refresh pending count:', err);
    }
  }

  // Setup connection listeners
  if (typeof window !== 'undefined') {
    window.addEventListener('online', async () => {
      update((s) => ({ ...s, isOnline: true }));
      // Trigger auto-sync when coming back online
      const { seguimientoStore } = await import('./seguimientoStore');
      await seguimientoStore.syncOfflineQueue();
    });

    window.addEventListener('offline', () => {
      update((s) => ({ ...s, isOnline: false }));
    });

    // Initial load
    refreshPendingCount();
  }

  return {
    subscribe,
    refreshPendingCount,
    setSyncing(isSyncing: boolean) {
      update((s) => ({ ...s, isSyncing }));
      if (!isSyncing) {
        update((s) => ({ ...s, lastSyncTime: Date.now() }));
      }
    },
    syncNow: async () => {
      update((s) => ({ ...s, isSyncing: true }));
      try {
        const { seguimientoStore } = await import('./seguimientoStore');
        await seguimientoStore.syncOfflineQueue();
      } catch (err) {
        console.error('Manual sync failed:', err);
      } finally {
        update((s) => ({ ...s, isSyncing: false, lastSyncTime: Date.now() }));
        await refreshPendingCount();
      }
    }
  };
}

export const offlineStore = createOfflineStore();
export default offlineStore;

import { writable } from 'svelte/store';

interface PwaState {
  needRefresh: boolean;
  offlineReady: boolean;
  updateSW: ((reloadPage?: boolean) => Promise<void>) | null;
}

function createPwaStore() {
  const { subscribe, update } = writable<PwaState>({
    needRefresh: false,
    offlineReady: false,
    updateSW: null,
  });

  return {
    subscribe,
    setUpdateSW(fn: (reloadPage?: boolean) => Promise<void>) {
      update((s) => ({ ...s, updateSW: fn }));
    },
    setNeedRefresh(val: boolean) {
      update((s) => ({ ...s, needRefresh: val }));
    },
    setOfflineReady(val: boolean) {
      update((s) => ({ ...s, offlineReady: val }));
    },
  };
}

export const pwaStore = createPwaStore();

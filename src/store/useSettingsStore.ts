import { create } from 'zustand';
import { settingsService, syncChannel } from '../db/storageService';
import type { Settings } from '../types';

interface SettingsState {
  settings: Settings | null;
  loading: boolean;
  loadSettings: () => Promise<void>;
  hydrate: (settings: Settings | null) => void;
  updateSettings: (changes: Partial<Settings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => {
  // Listen for cross-tab syncs
  syncChannel.addEventListener('message', (e) => {
    if (e.data.action === 'SYNC') {
      useSettingsStore.getState().loadSettings();
    }
  });

  return {
    settings: null,
    loading: false,

    loadSettings: async () => {
      set({ loading: true });
      const settings = await settingsService.get();
      set({ settings, loading: false });
    },

    hydrate: (settings) => {
      set({ settings: settings || null, loading: false });
    },

    updateSettings: async (changes) => {
      set({ loading: true });
      await settingsService.update(changes);
      const settings = await settingsService.get();
      set({ settings, loading: false });
    },
  };
});

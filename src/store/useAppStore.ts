import { create } from 'zustand';
import { seedDatabase } from '../utils/seed';
import { db } from '../db/database';
import { exportDatabase, importDatabase, resetDatabase } from '../db/storageService';
import { useSalesStore } from './useSalesStore';
import { useInventoryStore } from './useInventoryStore';
import { usePrescriptionStore } from './usePrescriptionStore';
import { usePatientStore } from './usePatientStore';

type ActivePage = 'dashboard' | 'pos' | 'inventory' | 'patients' | 'prescriptions' | 'reports' | 'settings' | 'refunds' | 'procurement' | 'auditlog';

interface AppState {
  activePage: ActivePage;
  sidebarOpen: boolean;
  isBooting: boolean;
  initialized: boolean;
  initError: string | null;

  setPage: (page: ActivePage) => void;
  toggleSidebar: () => void;
  init: () => Promise<void>;
  exportData: () => Promise<void>;
  importData: (file: File) => Promise<void>;
  resetData: () => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  activePage: 'dashboard',
  sidebarOpen: true,
  isBooting: true,
  initialized: false,
  initError: null,

  setPage: (page) => set({ activePage: page }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  init: async () => {
    try {
      // 1. Explicitly open Dexie DB
      await db.open();

      const { BootOrchestrator } = await import('../boot/BootOrchestrator');
      await BootOrchestrator.run();

      set({ initialized: true, isBooting: false });
    } catch (e: any) {
      console.error('[Boot] Initialization failed:', e);
      set({ initError: e.message, initialized: true, isBooting: false });
    }
  },

  exportData: async () => {
    await exportDatabase();
  },

  importData: async (file) => {
    await importDatabase(file);
    // Reload stores after import
    await Promise.all([
      useSalesStore.getState().loadAll(),
      useInventoryStore.getState().loadAll(),
      usePrescriptionStore.getState().loadAll(),
      usePatientStore.getState().loadAll(),
    ]);
  },

  resetData: async () => {
    await resetDatabase();
    await seedDatabase();
    // Reload stores after reset
    await Promise.all([
      useSalesStore.getState().loadAll(),
      useInventoryStore.getState().loadAll(),
      usePrescriptionStore.getState().loadAll(),
      usePatientStore.getState().loadAll(),
    ]);
  },
}));

import { create } from 'zustand';
import { purchaseService } from '../db/storageService';
import type { Purchase } from '../types';

interface PurchaseState {
  purchases: Purchase[];
  loading: boolean;
  loadAll: () => Promise<void>;
  hydrate: (purchases: Purchase[]) => void;
}

export const usePurchaseStore = create<PurchaseState>((set) => ({
  purchases: [],
  loading: false,

  loadAll: async () => {
    set({ loading: true });
    const purchases = await purchaseService.getAll();
    set({ purchases, loading: false });
  },

  hydrate: (purchases) => {
    set({ purchases, loading: false });
  },
}));

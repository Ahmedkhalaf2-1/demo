import { create } from 'zustand';
import { refundService } from '../db/storageService';
import type { Refund } from '../types';

interface RefundState {
  refunds: Refund[];
  loading: boolean;
  loadAll: () => Promise<void>;
  hydrate: (refunds: Refund[]) => void;
}

export const useRefundStore = create<RefundState>((set) => ({
  refunds: [],
  loading: false,

  loadAll: async () => {
    set({ loading: true });
    const refunds = await refundService.getAll();
    set({ refunds, loading: false });
  },

  hydrate: (refunds) => {
    set({ refunds, loading: false });
  },
}));

import { create } from 'zustand';
import { salesService } from '../db/storageService';
import type { Sale, DailySalesSummary, ProductSalesSummary } from '../types';
import { getLocalDateKey, getDateKeyDaysAgo, normalizeDateKey } from '../utils/time';

interface SalesState {
  sales: Sale[];
  loading: boolean;
  loadAll: () => Promise<void>;
  hydrate: (sales: Sale[]) => void;
  getTodaySales: () => Sale[];
  getDailySummary: (days: number) => DailySalesSummary[];
  getTopProducts: (limit: number) => ProductSalesSummary[];
  getTotalRevenue: () => number;
  getTotalProfit: () => number;
}

export const useSalesStore = create<SalesState>((set, get) => ({
  sales: [],
  loading: false,

  loadAll: async () => {
    set({ loading: true });
    const sales = await salesService.getAll();
    set({ sales, loading: false });
  },

  hydrate: (sales) => {
    set({ sales, loading: false });
  },

  /**
   * Returns sales for TODAY in local timezone.
   *
   * FIX: Previously used `new Date().toISOString().split('T')[0]` which is UTC.
   * In UTC+3, at 01:00 AM local, UTC is still 22:00 the previous day — so sales
   * after midnight were invisibly placed on yesterday.
   *
   * Now: compares against the LOCAL dateKey stored at write time.
   * For existing records without `dateKey`, we normalise `createdAt` to local.
   */
  getTodaySales: () => {
    const todayKey = getLocalDateKey();
    return get().sales.filter((s) => {
      // Prefer explicit dateKey (new records); fall back to normalizing createdAt
      const key = (s as any).dateKey ?? normalizeDateKey(s.createdAt);
      return key === todayKey;
    });
  },

  /**
   * Returns a day-by-day summary for the last `days` days.
   *
   * FIX: Previously used `date-fns/subDays(new Date(), i)` then formatted to
   * yyyy-MM-dd and compared against ISO createdAt strings. This mixed local
   * day-generation with UTC-stored timestamps.
   *
   * Now: generates each day key in LOCAL timezone and matches against the
   * normalised local dateKey of each sale.
   */
  getDailySummary: (days) => {
    const { sales } = get();
    const result: DailySalesSummary[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const dateKey = getDateKeyDaysAgo(i);

      const daySales = sales.filter((s) => {
        if (s.status !== 'completed') return false;
        const key = (s as any).dateKey ?? normalizeDateKey(s.createdAt);
        return key === dateKey;
      });

      result.push({
        date: dateKey,
        totalSales:   daySales.length,
        totalRevenue: daySales.reduce((sum, s) => sum + s.total, 0),
        totalProfit:  daySales.reduce((sum, s) => sum + s.profit, 0),
      });
    }

    return result;
  },

  getTopProducts: (limit) => {
    const { sales } = get();
    const map = new Map<string, ProductSalesSummary>();
    sales
      .filter((s) => s.status === 'completed')
      .forEach((s) => {
        s.items.forEach((item) => {
          const existing = map.get(item.productId);
          if (existing) {
            existing.totalQuantity += item.quantity;
            existing.totalRevenue  += item.total;
            existing.totalProfit   += item.profit;
          } else {
            map.set(item.productId, {
              productId:     item.productId,
              productName:   item.productName,
              totalQuantity: item.quantity,
              totalRevenue:  item.total,
              totalProfit:   item.profit,
            });
          }
        });
      });
    return Array.from(map.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit);
  },

  getTotalRevenue: () =>
    get().sales
      .filter((s) => s.status === 'completed')
      .reduce((sum, s) => sum + s.total, 0),

  getTotalProfit: () =>
    get().sales
      .filter((s) => s.status === 'completed')
      .reduce((sum, s) => sum + s.profit, 0),
}));

/**
 * useAnalytics — Lightweight intelligence layer
 *
 * Derives all insights from existing Zustand store data.
 * No external dependencies, no AI services, no network calls.
 *
 * Provides:
 * - Top-selling products (by revenue)
 * - Low-stock alerts (below minStock threshold)
 * - Out-of-stock products
 * - Expiry alerts (expired, critical ≤15d, warning ≤30d)
 * - Today's KPIs (revenue, sales count, profit margin)
 * - Revenue trend (last 7 days)
 */

import { useMemo, useState, useEffect } from 'react';
import { eventBus } from '../domain/eventBus';
import { useSalesStore } from '../store/useSalesStore';
import { useInventoryStore } from '../store/useInventoryStore';
import { getLocalDateKey, getDateKeyDaysAgo } from '../utils/time';

export interface StockAlert {
  productId:   string;
  productName: string;
  current:     number;
  minimum:     number;
  type:        'out' | 'low' | 'critical';
}

export interface ExpiryAlert {
  batchId:     string;
  productName: string;
  lotNumber:   string;
  expiryDate:  string;
  daysLeft:    number;
  remaining:   number;
  severity:    'expired' | 'critical' | 'warning';
}

export interface DayTrend {
  dateKey:   string;
  label:     string;
  revenue:   number;
  profit:    number;
  salesCount: number;
}

export function useAnalytics() {
  const { sales, getTopProducts, getTodaySales, getDailySummary } = useSalesStore();
  const { inventory, products, batches } = useInventoryStore();

  const [tick, setTick] = useState(0);

  useEffect(() => {
    const off = eventBus.on('stock:updated', () => {
      setTick((t) => t + 1);
    });
    return () => off();
  }, []);

  // ── Today KPIs ──────────────────────────────────────────────────────────────
  const todayKPIs = useMemo(() => {
    const todaySales = getTodaySales();
    const revenue = todaySales.reduce((s, sale) => s + sale.total, 0);
    const profit  = todaySales.reduce((s, sale) => s + sale.profit, 0);
    const count   = todaySales.length;
    const margin  = revenue > 0 ? (profit / revenue) * 100 : 0;
    return { revenue, profit, count, margin };
  }, [sales]); // recalculates when sales list changes

  // ── Top Products (all-time, by revenue) ────────────────────────────────────
  const topProducts = useMemo(() => getTopProducts(10), [sales]);

  // ── Stock Alerts ────────────────────────────────────────────────────────────
  const stockAlerts = useMemo((): StockAlert[] => {
    return inventory
      .map((inv) => {
        const product = products.find((p) => p.id === inv.productId);
        if (!product) return null;
        if (inv.totalQuantity === 0) {
          return { productId: inv.productId, productName: product.name, current: 0, minimum: inv.minStock, type: 'out' as const };
        }
        if (inv.totalQuantity <= inv.minStock * 0.5) {
          return { productId: inv.productId, productName: product.name, current: inv.totalQuantity, minimum: inv.minStock, type: 'critical' as const };
        }
        if (inv.totalQuantity <= inv.minStock) {
          return { productId: inv.productId, productName: product.name, current: inv.totalQuantity, minimum: inv.minStock, type: 'low' as const };
        }
        return null;
      })
      .filter(Boolean) as StockAlert[];
  }, [inventory, products, tick]);

  const outOfStock = useMemo(() => stockAlerts.filter((a) => a.type === 'out'), [stockAlerts]);
  const lowStock   = useMemo(() => stockAlerts.filter((a) => a.type === 'low'), [stockAlerts]);

  // ── Expiry Alerts ───────────────────────────────────────────────────────────
  const expiryAlerts = useMemo((): ExpiryAlert[] => {
    const today = getLocalDateKey();
    return batches
      .filter((b) => b.remaining > 0)
      .map((b) => {
        const product  = products.find((p) => p.id === b.productId);
        const daysLeft = Math.ceil((new Date(b.expiryDate).getTime() - Date.now()) / 86_400_000);
        if (daysLeft > 30) return null; // Only surface within 30 days
        const severity: ExpiryAlert['severity'] =
          b.expiryDate < today ? 'expired'
          : daysLeft <= 15     ? 'critical'
          : 'warning';
        return {
          batchId:     b.id,
          productName: product?.name ?? '—',
          lotNumber:   b.lotNumber,
          expiryDate:  b.expiryDate,
          daysLeft,
          remaining:   b.remaining,
          severity,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a!.daysLeft - b!.daysLeft) as ExpiryAlert[];
  }, [batches, products]);

  // ── 7-Day Revenue Trend ─────────────────────────────────────────────────────
  const revenueTrend = useMemo((): DayTrend[] => {
    const summary = getDailySummary(7);
    return summary.map((d) => ({
      dateKey:    d.date,
      label:      d.date.slice(5), // MM-DD
      revenue:    d.totalRevenue,
      profit:     d.totalProfit,
      salesCount: d.totalSales,
    }));
  }, [sales]);

  return {
    todayKPIs,
    topProducts,
    stockAlerts,
    outOfStock,
    lowStock,
    expiryAlerts,
    revenueTrend,
    // Convenience counts
    alertCount: outOfStock.length + lowStock.length + expiryAlerts.filter((e) => e.severity !== 'warning').length,
  };
}

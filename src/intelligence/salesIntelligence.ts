/**
 * Sales Intelligence Engine
 *
 * Pure functions — takes store data, returns derived sales insights.
 * Builds on top of existing useSalesStore data without duplicating logic.
 *
 * New capabilities beyond existing useAnalytics:
 * - Per-product true profit (not just per-sale aggregate)
 * - Peak hours detection (hour-of-day sales distribution)
 * - WoW / MoM growth comparison
 * - Fast vs slow moving classification by revenue + quantity
 * - Customer value segmentation (by patient)
 */

import type { Sale } from '../types';
import { getLocalDateKey, getDateKeyDaysAgo, normalizeDateKey } from '../utils/time';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProductPerformance {
  productId:      string;
  productName:    string;
  totalQty:       number;
  totalRevenue:   number;
  totalProfit:    number;
  avgMargin:      number;       // profit margin %
  profitPerUnit:  number;
  salesCount:     number;       // number of sales containing this product
  classification: 'star' | 'cash-cow' | 'slow' | 'dog';
}

export interface HourBucket {
  hour:       number;     // 0–23
  label:      string;     // "08:00"
  salesCount: number;
  revenue:    number;
}

export interface PeriodComparison {
  current:    number;
  previous:   number;
  delta:      number;     // absolute
  growthPct:  number;     // percentage, can be negative
  trend:      'up' | 'down' | 'flat';
}

export interface PatientValue {
  patientId:   string;
  patientName: string;
  totalSpend:  number;
  visitCount:  number;
  avgBasket:   number;
  lastVisit:   string;  // dateKey
}

export interface SalesInsights {
  productPerformance:  ProductPerformance[];   // all products with sales
  starProducts:        ProductPerformance[];   // high revenue + high margin
  cashCowProducts:     ProductPerformance[];   // high revenue + low margin
  slowProducts:        ProductPerformance[];   // low revenue + high margin
  dogProducts:         ProductPerformance[];   // low revenue + low margin
  peakHours:           HourBucket[];           // sorted by salesCount desc
  weeklyGrowth:        PeriodComparison;       // this week vs last week
  monthlyGrowth:       PeriodComparison;       // this month vs last month
  topPatients:         PatientValue[];         // top 10 by total spend
  avgBasketSize:       number;                 // avg sale total
  avgItemsPerSale:     number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function periodRevenue(sales: Sale[], fromDateKey: string, toDateKey: string): number {
  return sales
    .filter((s) => {
      if (s.status !== 'completed') return false;
      const key = (s as any).dateKey ?? normalizeDateKey(s.createdAt);
      return key >= fromDateKey && key <= toDateKey;
    })
    .reduce((sum, s) => sum + s.total, 0);
}

// ── Main Engine Function ──────────────────────────────────────────────────────

export function getSalesInsights(sales: Sale[]): SalesInsights {
  const completed = sales.filter((s) => s.status === 'completed');
  const today     = getLocalDateKey();

  // ── Per-product performance ────────────────────────────────────────────────
  const perfMap = new Map<string, ProductPerformance>();

  for (const sale of completed) {
    for (const item of sale.items) {
      const entry = perfMap.get(item.productId);
      if (entry) {
        entry.totalQty     += item.quantity;
        entry.totalRevenue += item.total;
        entry.totalProfit  += item.profit;
        entry.salesCount   += 1;
      } else {
        perfMap.set(item.productId, {
          productId:     item.productId,
          productName:   item.productName,
          totalQty:      item.quantity,
          totalRevenue:  item.total,
          totalProfit:   item.profit,
          avgMargin:     0,     // computed below
          profitPerUnit: 0,
          salesCount:    1,
          classification: 'slow', // default, overridden below
        });
      }
    }
  }

  // Compute derived fields + BCG-matrix classification
  const allPerf = Array.from(perfMap.values());
  if (allPerf.length > 0) {
    const medianRevenue = median(allPerf.map((p) => p.totalRevenue));
    const medianMargin  = median(allPerf.map((p) =>
      p.totalRevenue > 0 ? (p.totalProfit / p.totalRevenue) * 100 : 0
    ));

    for (const p of allPerf) {
      p.avgMargin     = p.totalRevenue > 0
        ? Math.round((p.totalProfit / p.totalRevenue) * 10000) / 100
        : 0;
      p.profitPerUnit = p.totalQty > 0
        ? Math.round((p.totalProfit / p.totalQty) * 100) / 100
        : 0;

      const highRevenue = p.totalRevenue >= medianRevenue;
      const highMargin  = p.avgMargin    >= medianMargin;

      p.classification =
        highRevenue &&  highMargin ? 'star'
        : highRevenue && !highMargin ? 'cash-cow'
        : !highRevenue &&  highMargin ? 'slow'
        : 'dog';
    }
  }

  const sortedPerf = [...allPerf].sort((a, b) => b.totalRevenue - a.totalRevenue);

  // ── Peak hours distribution ────────────────────────────────────────────────
  const hourBuckets: HourBucket[] = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: `${String(h).padStart(2, '0')}:00`,
    salesCount: 0,
    revenue: 0,
  }));

  for (const sale of completed) {
    const hour = new Date(sale.createdAt).getHours();
    hourBuckets[hour].salesCount += 1;
    hourBuckets[hour].revenue    += sale.total;
  }

  const peakHours = [...hourBuckets].sort((a, b) => b.salesCount - a.salesCount);

  // ── WoW & MoM growth ──────────────────────────────────────────────────────
  const thisWeekStart  = getDateKeyDaysAgo(6);
  const lastWeekStart  = getDateKeyDaysAgo(13);
  const lastWeekEnd    = getDateKeyDaysAgo(7);
  const thisMonthStart = getDateKeyDaysAgo(29);
  const lastMonthStart = getDateKeyDaysAgo(59);
  const lastMonthEnd   = getDateKeyDaysAgo(30);

  const thisWeekRev  = periodRevenue(sales, thisWeekStart, today);
  const lastWeekRev  = periodRevenue(sales, lastWeekStart, lastWeekEnd);
  const thisMonthRev = periodRevenue(sales, thisMonthStart, today);
  const lastMonthRev = periodRevenue(sales, lastMonthStart, lastMonthEnd);

  const weeklyGrowth  = buildComparison(thisWeekRev, lastWeekRev);
  const monthlyGrowth = buildComparison(thisMonthRev, lastMonthRev);

  // ── Patient value ──────────────────────────────────────────────────────────
  const patientMap = new Map<string, PatientValue>();

  for (const sale of completed) {
    if (!sale.patientId || !sale.patientName) continue;
    const key = (sale as any).dateKey ?? normalizeDateKey(sale.createdAt);
    const entry = patientMap.get(sale.patientId);
    if (entry) {
      entry.totalSpend += sale.total;
      entry.visitCount += 1;
      if (key > entry.lastVisit) entry.lastVisit = key;
    } else {
      patientMap.set(sale.patientId, {
        patientId:   sale.patientId,
        patientName: sale.patientName,
        totalSpend:  sale.total,
        visitCount:  1,
        avgBasket:   0,    // computed below
        lastVisit:   key,
      });
    }
  }

  const topPatients = Array.from(patientMap.values())
    .map((p) => ({ ...p, avgBasket: Math.round((p.totalSpend / p.visitCount) * 100) / 100 }))
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, 10);

  // ── Basket metrics ─────────────────────────────────────────────────────────
  const avgBasketSize  = completed.length > 0
    ? Math.round((completed.reduce((s, sale) => s + sale.total, 0) / completed.length) * 100) / 100
    : 0;
  const avgItemsPerSale = completed.length > 0
    ? Math.round((completed.reduce((s, sale) => s + sale.items.length, 0) / completed.length) * 10) / 10
    : 0;

  return {
    productPerformance: sortedPerf,
    starProducts:       sortedPerf.filter((p) => p.classification === 'star'),
    cashCowProducts:    sortedPerf.filter((p) => p.classification === 'cash-cow'),
    slowProducts:       sortedPerf.filter((p) => p.classification === 'slow'),
    dogProducts:        sortedPerf.filter((p) => p.classification === 'dog'),
    peakHours,
    weeklyGrowth,
    monthlyGrowth,
    topPatients,
    avgBasketSize,
    avgItemsPerSale,
  };
}

// ── Utility helpers ───────────────────────────────────────────────────────────

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid    = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function buildComparison(current: number, previous: number): PeriodComparison {
  const delta     = current - previous;
  const growthPct = previous > 0
    ? Math.round((delta / previous) * 10000) / 100
    : current > 0 ? 100 : 0;
  return {
    current,
    previous,
    delta,
    growthPct,
    trend: delta > 0.01 ? 'up' : delta < -0.01 ? 'down' : 'flat',
  };
}

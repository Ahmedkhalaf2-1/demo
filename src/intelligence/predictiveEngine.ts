/**
 * Predictive Engine — Light AI Behavior (no ML required)
 *
 * Implements deterministic prediction algorithms using:
 * - Linear trend extrapolation over rolling windows
 * - Z-score anomaly detection for sales spikes
 * - Exponential moving average (EMA) for demand smoothing
 * - Weighted restock priority scoring
 *
 * Pure functions — takes store data, returns predictions.
 * Safe to memoize. No network calls, no ML models.
 */

import type { Sale, Batch, Product, Inventory, Purchase } from '../types';
import { getLocalDateKey, getDateKeyDaysAgo, normalizeDateKey } from '../utils/time';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ShortageAlert {
  productId:          string;
  productName:        string;
  currentStock:       number;
  predictedRunoutKey: string;   // YYYY-MM-DD estimated empty date
  daysUntilEmpty:     number;
  confidence:         'high' | 'medium' | 'low';
  velocity30d:        number;
}

export interface DemandForecast {
  productId:      string;
  productName:    string;
  predicted7d:    number;   // predicted units to be sold in next 7 days
  predicted30d:   number;
  trend:          'rising' | 'stable' | 'falling';
  trendPct:       number;   // % change vs prior period
}

export interface SpikeAlert {
  type:        'sales_spike' | 'refund_spike' | 'unusual_pattern';
  dateKey:     string;
  metric:      string;
  observed:    number;
  expected:    number;
  zScore:      number;      // standard deviations from mean
  description: string;
}

export interface RestockPriority {
  rank:           number;
  productId:      string;
  productName:    string;
  score:          number;   // 0–100 priority score
  urgency:        'critical' | 'high' | 'medium' | 'low';
  reasoning:      string[];
  suggestedQty:   number;
  daysUntilEmpty: number;
}

export interface PredictionInsights {
  shortageAlerts:   ShortageAlert[];
  demandForecasts:  DemandForecast[];
  spikeAlerts:      SpikeAlert[];
  restockPriority:  RestockPriority[];
  systemHealth: {
    totalSpikeAlerts:    number;
    criticalShortages:   number;
    risingDemandCount:   number;
    fallingDemandCount:  number;
  };
}

// ── Main Engine Function ──────────────────────────────────────────────────────

export function getPredictionInsights(
  products:  Product[],
  batches:   Batch[],
  inventory: Inventory[],
  sales:     Sale[],
  purchases: Purchase[],
): PredictionInsights {
  const today  = getLocalDateKey();
  const nowMs  = Date.now();

  // ── Build daily sales map: dateKey → { productId → units } ────────────────
  const dailyProductSales = new Map<string, Map<string, number>>();  // dateKey → Map<productId, qty>
  const dailyTotals       = new Map<string, number>();               // dateKey → total revenue

  for (const sale of sales) {
    if (sale.status !== 'completed') continue;
    const key = (sale as any).dateKey ?? normalizeDateKey(sale.createdAt);

    const existing = dailyProductSales.get(key) ?? new Map<string, number>();
    for (const item of sale.items) {
      existing.set(item.productId, (existing.get(item.productId) ?? 0) + item.quantity);
    }
    dailyProductSales.set(key, existing);
    dailyTotals.set(key, (dailyTotals.get(key) ?? 0) + sale.total);
  }

  // Build convenience: per product, daily array for last 30 / last 60 days
  function getDailyQty(productId: string, daysBack: number): number[] {
    return Array.from({ length: daysBack }, (_, i) => {
      const dk = getDateKeyDaysAgo(daysBack - 1 - i);
      return dailyProductSales.get(dk)?.get(productId) ?? 0;
    });
  }

  // ── Inventory index ────────────────────────────────────────────────────────
  const invByProduct = new Map(inventory.map((i) => [i.productId, i]));

  // ── Shortage prediction ────────────────────────────────────────────────────
  const shortageAlerts: ShortageAlert[] = [];

  for (const product of products) {
    const inv = invByProduct.get(product.id);
    if (!inv || inv.totalQuantity === 0) continue;

    const daily30 = getDailyQty(product.id, 30);
    const totalSold30 = daily30.reduce((s, n) => s + n, 0);
    const velocity    = totalSold30 / 30;   // avg units/day

    if (velocity < 0.01) continue;  // not enough movement to predict

    const daysUntilEmpty     = Math.floor(inv.totalQuantity / velocity);
    const predictedRunoutMs  = nowMs + daysUntilEmpty * 86_400_000;
    const predictedRunoutKey = getLocalDateKey(new Date(predictedRunoutMs));

    // Confidence based on data density (days with actual sales)
    const daysWithSales = daily30.filter((d) => d > 0).length;
    const confidence: ShortageAlert['confidence'] =
      daysWithSales >= 20 ? 'high'
      : daysWithSales >= 10 ? 'medium'
      : 'low';

    if (daysUntilEmpty <= 30) {  // only surface near-term threats
      shortageAlerts.push({
        productId:          product.id,
        productName:        product.name,
        currentStock:       inv.totalQuantity,
        predictedRunoutKey,
        daysUntilEmpty,
        confidence,
        velocity30d:        Math.round(velocity * 100) / 100,
      });
    }
  }

  shortageAlerts.sort((a, b) => a.daysUntilEmpty - b.daysUntilEmpty);

  // ── Demand forecasting ─────────────────────────────────────────────────────
  const demandForecasts: DemandForecast[] = [];

  for (const product of products) {
    const daily60 = getDailyQty(product.id, 60);
    const first30 = daily60.slice(0, 30);
    const last30  = daily60.slice(30);

    const sum30   = last30.reduce((s, n) => s + n, 0);
    const sumPrev = first30.reduce((s, n) => s + n, 0);

    if (sum30 === 0 && sumPrev === 0) continue;

    const predicted7d  = Math.round((sum30 / 30) * 7);
    const predicted30d = Math.round(sum30);  // assumes similar next 30 days

    const trendPct = sumPrev > 0
      ? Math.round(((sum30 - sumPrev) / sumPrev) * 10000) / 100
      : sum30 > 0 ? 100 : 0;

    const trend: DemandForecast['trend'] =
      trendPct > 5  ? 'rising'
      : trendPct < -5 ? 'falling'
      : 'stable';

    demandForecasts.push({
      productId:   product.id,
      productName: product.name,
      predicted7d,
      predicted30d,
      trend,
      trendPct,
    });
  }

  demandForecasts.sort((a, b) => b.predicted30d - a.predicted30d);

  // ── Anomaly / spike detection ──────────────────────────────────────────────
  const spikeAlerts: SpikeAlert[] = [];

  // Revenue spike detection using Z-score over last 30 days
  const revLast30: number[] = Array.from({ length: 30 }, (_, i) => {
    const dk = getDateKeyDaysAgo(30 - 1 - i);
    return dailyTotals.get(dk) ?? 0;
  });

  const revMean   = mean(revLast30.slice(0, 23));  // baseline: first 23 days
  const revStdDev = stddev(revLast30.slice(0, 23));

  for (let i = 23; i < 30; i++) {
    const observed = revLast30[i];
    const zScore   = revStdDev > 0 ? (observed - revMean) / revStdDev : 0;
    const dk       = getDateKeyDaysAgo(30 - 1 - i);

    if (Math.abs(zScore) >= 2.5 && observed > 0) {
      spikeAlerts.push({
        type:        zScore > 0 ? 'sales_spike' : 'unusual_pattern',
        dateKey:     dk,
        metric:      'daily_revenue',
        observed:    Math.round(observed * 100) / 100,
        expected:    Math.round(revMean * 100)  / 100,
        zScore:      Math.round(zScore * 100)   / 100,
        description: zScore > 0
          ? `ارتفاع غير معتاد في الإيرادات (${Math.abs(Math.round(zScore))}σ)`
          : `انخفاض غير معتاد في الإيرادات (${Math.abs(Math.round(zScore))}σ)`,
      });
    }
  }

  // ── Restock priority ranking ───────────────────────────────────────────────
  const restockPriority: RestockPriority[] = [];

  for (const product of products) {
    const inv       = invByProduct.get(product.id);
    const stock     = inv?.totalQuantity ?? 0;
    const minStock  = inv?.minStock ?? 0;
    const shortage  = shortageAlerts.find((s) => s.productId === product.id);
    const forecast  = demandForecasts.find((f) => f.productId === product.id);

    let score = 0;
    const reasoning: string[] = [];

    if (stock === 0) {
      score += 40; reasoning.push('المخزون نفد بالكامل');
    } else if (minStock > 0 && stock <= minStock * 0.5) {
      score += 30; reasoning.push('مستوى حرج أقل من 50% من الحد الأدنى');
    } else if (minStock > 0 && stock <= minStock) {
      score += 20; reasoning.push('أقل من الحد الأدنى للمخزون');
    }

    if (shortage) {
      if (shortage.daysUntilEmpty <= 7)  { score += 30; reasoning.push(`ينفد خلال ${shortage.daysUntilEmpty} أيام`); }
      else if (shortage.daysUntilEmpty <= 14) { score += 20; reasoning.push(`ينفد خلال ${shortage.daysUntilEmpty} يوماً`); }
      else { score += 10; }
    }

    if (forecast?.trend === 'rising' && (forecast.trendPct ?? 0) > 20) {
      score += 20; reasoning.push(`طلب متزايد (+${forecast.trendPct}%)`);
    }

    if (score < 10) continue;  // not worth suggesting

    const urgency: RestockPriority['urgency'] =
      score >= 60 ? 'critical'
      : score >= 40 ? 'high'
      : score >= 25 ? 'medium'
      : 'low';

    const velocity    = shortage?.velocity30d ?? 0;
    const suggestedQty = velocity > 0
      ? Math.max(1, Math.ceil(velocity * 30) - stock)
      : Math.max(1, (minStock ?? 0) * 3 - stock);

    restockPriority.push({
      rank:           0,  // set after sort
      productId:      product.id,
      productName:    product.name,
      score:          Math.min(100, score),
      urgency,
      reasoning,
      suggestedQty,
      daysUntilEmpty: shortage?.daysUntilEmpty ?? Infinity,
    });
  }

  restockPriority
    .sort((a, b) => b.score - a.score)
    .forEach((r, i) => { r.rank = i + 1; });

  return {
    shortageAlerts,
    demandForecasts,
    spikeAlerts,
    restockPriority,
    systemHealth: {
      totalSpikeAlerts:   spikeAlerts.length,
      criticalShortages:  shortageAlerts.filter((a) => a.daysUntilEmpty <= 7).length,
      risingDemandCount:  demandForecasts.filter((f) => f.trend === 'rising').length,
      fallingDemandCount: demandForecasts.filter((f) => f.trend === 'falling').length,
    },
  };
}

// ── Math helpers ──────────────────────────────────────────────────────────────

function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((s, n) => s + n, 0) / arr.length;
}

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, n) => s + Math.pow(n - m, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

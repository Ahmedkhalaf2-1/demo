/**
 * Financial Engine — Lightweight ERP Accounting Layer
 *
 * Pure functions. Computes:
 * - COGS per batch (using actual batch costPerUnit)
 * - True profit per sale (revenue − actual batch cost)
 * - Daily P&L statement
 * - Cash flow summary (in: sales; out: purchases + refunds)
 * - Inventory valuation at cost
 *
 * Philosophy:
 *   The Sale already records `profit` at the time of checkout.
 *   This engine provides AGGREGATE financial views across periods,
 *   plus cash flow (sales don't include purchase cash flow context).
 */

import type { Sale, Refund, Purchase, Batch, Product } from '../types';
import { getLocalDateKey, getDateKeyDaysAgo, normalizeDateKey } from '../utils/time';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DailyPnL {
  dateKey:       string;
  revenue:       number;
  cogs:          number;     // gross cost of goods sold that day
  grossProfit:   number;     // revenue − cogs
  refundTotal:   number;     // cash returned to customers
  purchaseCost:  number;     // cash paid to suppliers
  netCashFlow:   number;     // revenue − refunds − purchaseCost
  salesCount:    number;
  margin:        number;     // gross profit % of revenue
}

export interface CashFlowSummary {
  period:          string;   // "7d" | "30d" | "90d"
  totalCashIn:     number;   // completed sales total
  totalCashOut:    number;   // purchases + refunds
  netCashFlow:     number;
  totalSales:      number;
  totalRefunds:    number;
  totalPurchases:  number;
  avgDailyRevenue: number;
}

export interface FinancialReport {
  dailyPnL:          DailyPnL[];      // last 30 days
  last7Summary:      CashFlowSummary;
  last30Summary:     CashFlowSummary;
  allTimeSummary:    CashFlowSummary;
  inventoryAtCost:   number;          // current stock value (batch cost × remaining)
  inventoryAtRetail: number;          // current stock value (product price × remaining)
  grossMarginPct:    number;          // all-time gross margin
  topCostDrivers:    { productName: string; totalCost: number }[]; // top 5 by COGS
}

// ── Main Engine Function ──────────────────────────────────────────────────────

export function getFinancialReport(
  sales:     Sale[],
  refunds:   Refund[],
  purchases: Purchase[],
  batches:   Batch[],
  products:  Product[],
): FinancialReport {
  const today       = getLocalDateKey();

  // ── Daily P&L — last 30 days ───────────────────────────────────────────────
  const dailyPnL: DailyPnL[] = [];

  for (let i = 29; i >= 0; i--) {
    const dateKey = getDateKeyDaysAgo(i);

    const daySales = sales.filter((s) => {
      if (s.status !== 'completed') return false;
      const key = (s as any).dateKey ?? normalizeDateKey(s.createdAt);
      return key === dateKey;
    });

    const dayRefunds = refunds.filter((r) => {
      const key = (r as any).dateKey ?? normalizeDateKey(r.createdAt);
      return key === dateKey;
    });

    const dayPurchases = purchases.filter((p) => {
      const key = (p as any).dateKey ?? normalizeDateKey(p.createdAt);
      return key === dateKey;
    });

    const revenue      = daySales.reduce((s, sale) => s + sale.total, 0);
    const grossProfit  = daySales.reduce((s, sale) => s + sale.profit, 0);
    const cogs         = revenue - grossProfit;
    const refundTotal  = dayRefunds.reduce((s, r) => s + r.total, 0);
    const purchaseCost = dayPurchases.reduce((s, p) => s + p.totalCost, 0);
    const netCashFlow  = revenue - refundTotal - purchaseCost;
    const margin       = revenue > 0 ? Math.round((grossProfit / revenue) * 10000) / 100 : 0;

    dailyPnL.push({
      dateKey,
      revenue:      Math.round(revenue * 100)      / 100,
      cogs:         Math.round(cogs * 100)          / 100,
      grossProfit:  Math.round(grossProfit * 100)   / 100,
      refundTotal:  Math.round(refundTotal * 100)   / 100,
      purchaseCost: Math.round(purchaseCost * 100)  / 100,
      netCashFlow:  Math.round(netCashFlow * 100)   / 100,
      salesCount:   daySales.length,
      margin,
    });
  }

  // ── Cash flow summaries ────────────────────────────────────────────────────
  const last7Summary  = buildCashFlow(sales, refunds, purchases, 7,  today);
  const last30Summary = buildCashFlow(sales, refunds, purchases, 30, today);
  const allTimeSummary = buildCashFlow(sales, refunds, purchases, Infinity, today);

  // ── Inventory at cost (live batches) ───────────────────────────────────────
  const productPriceMap = new Map(products.map((p) => [p.id, p.unitPrice]));
  let inventoryAtCost   = 0;
  let inventoryAtRetail = 0;

  for (const b of batches) {
    if (b.remaining <= 0 || b.expiryDate < today) continue;
    inventoryAtCost   += b.remaining * b.costPerUnit;
    inventoryAtRetail += b.remaining * (productPriceMap.get(b.productId) ?? 0);
  }

  // ── Gross margin all-time ──────────────────────────────────────────────────
  const totalRev    = allTimeSummary.totalCashIn;
  const totalProfit = sales
    .filter((s) => s.status === 'completed')
    .reduce((sum, s) => sum + s.profit, 0);
  const grossMarginPct = totalRev > 0
    ? Math.round((totalProfit / totalRev) * 10000) / 100
    : 0;

  // ── Top COGS drivers (per product, using sale cost price) ─────────────────
  const cogsMap = new Map<string, { productName: string; totalCost: number }>();
  for (const sale of sales) {
    if (sale.status !== 'completed') continue;
    for (const item of sale.items) {
      const cost = item.costPrice * item.quantity * (1 - item.discount / 100);
      const existing = cogsMap.get(item.productId);
      if (existing) {
        existing.totalCost += cost;
      } else {
        cogsMap.set(item.productId, { productName: item.productName, totalCost: cost });
      }
    }
  }

  const topCostDrivers = Array.from(cogsMap.values())
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, 5)
    .map((d) => ({ ...d, totalCost: Math.round(d.totalCost * 100) / 100 }));

  return {
    dailyPnL,
    last7Summary,
    last30Summary,
    allTimeSummary,
    inventoryAtCost:   Math.round(inventoryAtCost   * 100) / 100,
    inventoryAtRetail: Math.round(inventoryAtRetail * 100) / 100,
    grossMarginPct,
    topCostDrivers,
  };
}

// ── Cash flow builder helper ──────────────────────────────────────────────────

function buildCashFlow(
  sales:     Sale[],
  refunds:   Refund[],
  purchases: Purchase[],
  days:      number,
  today:     string,
): CashFlowSummary {
  const fromKey = days === Infinity ? '0000-00-00' : getDateKeyDaysAgo(days - 1);

  const inScope = <T extends { createdAt: string }>(r: T) => {
    const key = (r as any).dateKey ?? normalizeDateKey(r.createdAt);
    return key >= fromKey && key <= today;
  };

  const periodSales     = sales.filter((s) => s.status === 'completed' && inScope(s));
  const periodRefunds   = refunds.filter(inScope);
  const periodPurchases = purchases.filter(inScope);

  const totalCashIn   = periodSales.reduce((s, x) => s + x.total, 0);
  const refundOut     = periodRefunds.reduce((s, x) => s + x.total, 0);
  const purchaseOut   = periodPurchases.reduce((s, x) => s + x.totalCost, 0);
  const totalCashOut  = refundOut + purchaseOut;
  const actualDays    = days === Infinity ? 1 : Math.max(days, 1);

  return {
    period:          days === Infinity ? 'all-time' : `${days}d`,
    totalCashIn:     Math.round(totalCashIn  * 100) / 100,
    totalCashOut:    Math.round(totalCashOut * 100) / 100,
    netCashFlow:     Math.round((totalCashIn - totalCashOut) * 100) / 100,
    totalSales:      periodSales.length,
    totalRefunds:    periodRefunds.length,
    totalPurchases:  periodPurchases.length,
    avgDailyRevenue: Math.round((totalCashIn / actualDays) * 100) / 100,
  };
}

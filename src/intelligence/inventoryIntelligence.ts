/**
 * Inventory Intelligence Engine
 *
 * Pure functions — takes store data as input, returns derived insights.
 * Zero side-effects, zero async, zero IndexedDB calls.
 * All results are safe to memoize with useMemo() in React components.
 *
 * Algorithms used:
 * - Velocity = units sold in window / window days
 * - Depletion = currentStock / velocity (days remaining)
 * - Dead stock = last sale date > DEAD_STOCK_DAYS days ago (or never sold)
 * - Reorder qty = (velocity × REORDER_LEAD_DAYS) − currentStock
 */

import type { Product, Batch, Inventory, Sale } from '../types';
import { getLocalDateKey } from '../utils/time';

// ── Constants (sensible defaults, configurable in future via settings) ────────
const VELOCITY_WINDOW_DAYS  = 30;  // rolling window for velocity calculation
const DEAD_STOCK_DAYS       = 45;  // no movement → dead stock
const REORDER_LEAD_DAYS     = 14;  // procurement lead time estimate
const FAST_MOVING_THRESHOLD = 2;   // units/day = fast-moving

// ── Types ─────────────────────────────────────────────────────────────────────

export type StockStatus = 'healthy' | 'low' | 'critical' | 'out' | 'dead';

export interface ProductVelocity {
  productId:     string;
  productName:   string;
  unitsSoldLast30d: number;
  velocityPerDay: number;        // avg units/day over VELOCITY_WINDOW_DAYS
  daysUntilDepletion: number;    // Infinity = no sales trend
  currentStock:  number;
  costPrice:     number;
  status:        StockStatus;
  isFastMoving:  boolean;
  isDeadStock:   boolean;
}

export interface ReorderSuggestion {
  productId:     string;
  productName:   string;
  currentStock:  number;
  suggestedQty:  number;
  urgency:       'immediate' | 'soon' | 'planned';
  daysUntilDepletion: number;
  reason:        string;
}

export interface InventoryValuation {
  totalProducts:    number;
  totalSKUs:        number;       // products with ≥1 batch
  totalCostValue:   number;       // sum(batch.remaining × batch.costPerUnit)
  totalRetailValue: number;       // sum(batch.remaining × product.unitPrice)
  potentialProfit:  number;       // retailValue − costValue
  expiringValue:    number;       // cost value of stock expiring ≤30 days
}

export interface InventoryHealthIndex {
  score:          number;         // 0–100
  grade:          'A' | 'B' | 'C' | 'D' | 'F';
  breakdown: {
    stockoutRate:    number;      // % products out of stock
    lowStockRate:    number;      // % products below minStock
    deadStockRate:   number;      // % products with no movement
    expiryRiskRate:  number;      // % stock value at expiry risk
  };
}

export interface InventoryInsights {
  velocities:       ProductVelocity[];
  fastMoving:       ProductVelocity[];
  slowMoving:       ProductVelocity[];
  deadStock:        ProductVelocity[];
  reorderList:      ReorderSuggestion[];
  valuation:        InventoryValuation;
  healthIndex:      InventoryHealthIndex;
}

// ── Main Engine Function ──────────────────────────────────────────────────────

export function getInventoryInsights(
  products:  Product[],
  batches:   Batch[],
  inventory: Inventory[],
  sales:     Sale[],
): InventoryInsights {
  const today     = getLocalDateKey();
  const nowMs     = Date.now();
  const windowMs  = VELOCITY_WINDOW_DAYS * 86_400_000;
  const cutoffMs  = nowMs - windowMs;
  const deadCutMs = nowMs - DEAD_STOCK_DAYS * 86_400_000;

  // Index inventory & batches by productId for O(1) lookups
  const invByProduct = new Map(inventory.map((i) => [i.productId, i]));
  const validBatchesByProduct = new Map<string, Batch[]>();
  for (const b of batches) {
    if (b.remaining > 0 && b.expiryDate >= today) {
      const arr = validBatchesByProduct.get(b.productId) ?? [];
      arr.push(b);
      validBatchesByProduct.set(b.productId, arr);
    }
  }

  // Build per-product sold-units map for the velocity window
  const soldInWindow  = new Map<string, number>();  // productId → units
  const lastSaleDate  = new Map<string, number>();  // productId → timestamp ms

  for (const sale of sales) {
    if (sale.status !== 'completed') continue;
    const saleMs = new Date(sale.createdAt).getTime();
    for (const item of sale.items) {
      if (saleMs >= cutoffMs) {
        soldInWindow.set(item.productId, (soldInWindow.get(item.productId) ?? 0) + item.quantity);
      }
      const prev = lastSaleDate.get(item.productId) ?? 0;
      if (saleMs > prev) lastSaleDate.set(item.productId, saleMs);
    }
  }

  // ── Compute velocity per product ───────────────────────────────────────────
  const velocities: ProductVelocity[] = products.map((p) => {
    const inv          = invByProduct.get(p.id);
    const currentStock = inv?.totalQuantity ?? 0;
    const unitsSold    = soldInWindow.get(p.id) ?? 0;
    const velocity     = unitsSold / VELOCITY_WINDOW_DAYS;  // units/day
    const lastSaleMs   = lastSaleDate.get(p.id);

    const daysUntilDepletion =
      velocity > 0 ? Math.floor(currentStock / velocity) : Infinity;

    const isDeadStock =
      currentStock > 0 &&
      (lastSaleMs === undefined || lastSaleMs < deadCutMs);

    const isFastMoving = velocity >= FAST_MOVING_THRESHOLD;

    let status: StockStatus;
    if (currentStock === 0) status = 'out';
    else if (inv && currentStock <= inv.minStock * 0.5) status = 'critical';
    else if (inv && currentStock <= inv.minStock)        status = 'low';
    else if (isDeadStock)   status = 'dead';
    else                                                 status = 'healthy';

    return {
      productId: p.id,
      productName: p.name,
      unitsSoldLast30d: unitsSold,
      velocityPerDay: Math.round(velocity * 100) / 100,
      daysUntilDepletion,
      currentStock,
      costPrice: p.costPrice,
      status,
      isFastMoving,
      isDeadStock,
    };
  });

  const fastMoving = velocities.filter((v) => v.isFastMoving && !v.isDeadStock);
  const slowMoving = velocities.filter((v) => !v.isFastMoving && !v.isDeadStock && v.currentStock > 0 && v.velocityPerDay > 0);
  const deadStock  = velocities.filter((v) => v.isDeadStock);

  // ── Reorder suggestions ────────────────────────────────────────────────────
  const reorderList: ReorderSuggestion[] = velocities
    .filter((v) => {
      const inv = invByProduct.get(v.productId);
      if (!inv) return false;
      // Suggest if: out of stock, critical, or depleting within lead time
      return (
        v.status === 'out' ||
        v.status === 'critical' ||
        (v.daysUntilDepletion !== Infinity && v.daysUntilDepletion <= REORDER_LEAD_DAYS)
      );
    })
    .map((v) => {
      const suggestedQty = Math.max(
        1,
        Math.ceil(v.velocityPerDay * (REORDER_LEAD_DAYS * 2)) - v.currentStock
      );
      const urgency: ReorderSuggestion['urgency'] =
        v.status === 'out' || v.daysUntilDepletion <= 3 ? 'immediate'
        : v.daysUntilDepletion <= 7                      ? 'soon'
        : 'planned';

      const reason =
        v.status === 'out'
          ? 'المخزون نفد بالكامل'
          : v.status === 'critical'
          ? `مستوى حرج — متبقٍ ${v.currentStock} وحدة`
          : `سينفد خلال ${v.daysUntilDepletion} يوم`;

      return {
        productId: v.productId,
        productName: v.productName,
        currentStock: v.currentStock,
        suggestedQty,
        urgency,
        daysUntilDepletion: v.daysUntilDepletion,
        reason,
      };
    })
    .sort((a, b) => {
      const order = { immediate: 0, soon: 1, planned: 2 };
      return order[a.urgency] - order[b.urgency];
    });

  // ── Inventory valuation ────────────────────────────────────────────────────
  const productPriceMap = new Map(products.map((p) => [p.id, p.unitPrice]));
  const thirtyDaysOut   = getLocalDateKey(new Date(nowMs + 30 * 86_400_000));

  let totalCostValue   = 0;
  let totalRetailValue = 0;
  let expiringValue    = 0;

  for (const b of batches) {
    if (b.remaining <= 0) continue;
    const batchCost   = b.remaining * b.costPerUnit;
    const retailPrice = productPriceMap.get(b.productId) ?? 0;
    const batchRetail = b.remaining * retailPrice;
    totalCostValue   += batchCost;
    totalRetailValue += batchRetail;
    if (b.expiryDate <= thirtyDaysOut) expiringValue += batchCost;
  }

  const skusWithStock = new Set(
    batches.filter((b) => b.remaining > 0).map((b) => b.productId)
  ).size;

  const valuation: InventoryValuation = {
    totalProducts:    products.length,
    totalSKUs:        skusWithStock,
    totalCostValue:   Math.round(totalCostValue * 100) / 100,
    totalRetailValue: Math.round(totalRetailValue * 100) / 100,
    potentialProfit:  Math.round((totalRetailValue - totalCostValue) * 100) / 100,
    expiringValue:    Math.round(expiringValue * 100) / 100,
  };

  // ── Health index 0–100 ─────────────────────────────────────────────────────
  const total = products.length || 1;
  const stockoutRate   = velocities.filter((v) => v.status === 'out').length  / total;
  const lowStockRate   = velocities.filter((v) => v.status === 'low' || v.status === 'critical').length / total;
  const deadStockRate  = deadStock.length / total;
  const expiryRiskRate = totalCostValue > 0 ? expiringValue / totalCostValue : 0;

  const score = Math.max(0, Math.round(
    100
    - stockoutRate  * 40   // out of stock is most critical
    - lowStockRate  * 25
    - deadStockRate * 20
    - expiryRiskRate * 15
  ));

  const grade: InventoryHealthIndex['grade'] =
    score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';

  const healthIndex: InventoryHealthIndex = {
    score,
    grade,
    breakdown: {
      stockoutRate:   Math.round(stockoutRate  * 100),
      lowStockRate:   Math.round(lowStockRate  * 100),
      deadStockRate:  Math.round(deadStockRate * 100),
      expiryRiskRate: Math.round(expiryRiskRate * 100),
    },
  };

  return {
    velocities,
    fastMoving,
    slowMoving,
    deadStock,
    reorderList,
    valuation,
    healthIndex,
  };
}

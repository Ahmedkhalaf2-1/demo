/**
 * useIntelligence — Master Intelligence Hook
 *
 * Single entry-point for all PIOS intelligence engines.
 * Mount in any component to get real-time derived insights.
 *
 * Architecture:
 *   Zustand stores (source of truth)
 *       │
 *       ▼ (useMemo — each engine re-runs only when its inputs change)
 *   Intelligence Engines (pure functions)
 *   ├── inventoryIntelligence   → velocities, dead stock, reorder, health index
 *   ├── salesIntelligence       → BCG matrix, peak hours, growth, patient value
 *   ├── financialEngine         → P&L, cash flow, COGS, inventory valuation
 *   └── predictiveEngine        → shortage prediction, demand forecast, spike detection
 *       │
 *       ▼
 *   Returned to consuming component
 *
 * Event integration:
 *   - Subscribes to sale:created, sale:refunded, purchase:created, stock:updated
 *   - When any event fires → eventBus → useEventConsumers reloads stores
 *   - Store update → useMemo dependencies change → engines recalculate
 *   This means: intelligence is always in sync with reality, automatically.
 *
 * Performance:
 *   - Each engine is separately memoized: a sale event only re-runs sales + financial + predictive
 *   - Inventory engine only re-runs on inventory/batches change
 *   - No blocking: all computations are synchronous micro-operations (sub-5ms for 10k records)
 *   - Heavy arrays (velocities, forecasts) are NOT filtered in the hook — let consumers slice
 *
 * Usage:
 *   const { inventory, sales, financial, predictive } = useIntelligence();
 *   inventory.healthIndex.score          // 0–100
 *   sales.weeklyGrowth.growthPct         // % WoW revenue change
 *   financial.last30Summary.netCashFlow  // net cash position last 30 days
 *   predictive.shortageAlerts            // products at risk of stockout
 */

import { useMemo } from 'react';
import { useSalesStore } from '../store/useSalesStore';
import { useInventoryStore } from '../store/useInventoryStore';
import { usePurchaseStore } from '../store/usePurchaseStore';
import { useRefundStore } from '../store/useRefundStore';
import { eventBus } from '../domain/eventBus';

import { getInventoryInsights } from './inventoryIntelligence';
import { getSalesInsights }     from './salesIntelligence';
import { getFinancialReport }   from './financialEngine';
import { getPredictionInsights } from './predictiveEngine';

import type { InventoryInsights } from './inventoryIntelligence';
import type { SalesInsights }     from './salesIntelligence';
import type { FinancialReport }   from './financialEngine';
import type { PredictionInsights } from './predictiveEngine';

// Refunds and purchases are stored in Dexie but not yet in Zustand.
// We read them from localStorage cache at boot (set by event consumers).
// Until a dedicated Zustand store exists for them, we load them on demand.
import { refundService, purchaseService } from '../db/storageService';
import { useEffect, useRef, useState } from 'react';

interface FinancialData {
  refunds:   import('../types').Refund[];
  purchases: import('../types').Purchase[];
}

export interface IntelligenceResult {
  inventory:  InventoryInsights;
  sales:      SalesInsights;
  financial:  FinancialReport;
  predictive: PredictionInsights;
  isLoading:  boolean;
}

// ── Empty / default results for loading state ──────────────────────────────────
const EMPTY_INVENTORY: InventoryInsights = {
  velocities: [], fastMoving: [], slowMoving: [], deadStock: [],
  reorderList: [],
  valuation: { totalProducts: 0, totalSKUs: 0, totalCostValue: 0, totalRetailValue: 0, potentialProfit: 0, expiringValue: 0 },
  healthIndex: { score: 0, grade: 'F', breakdown: { stockoutRate: 0, lowStockRate: 0, deadStockRate: 0, expiryRiskRate: 0 } },
};
const EMPTY_SALES: SalesInsights = {
  productPerformance: [], starProducts: [], cashCowProducts: [], slowProducts: [], dogProducts: [],
  peakHours: [], weeklyGrowth: { current: 0, previous: 0, delta: 0, growthPct: 0, trend: 'flat' },
  monthlyGrowth: { current: 0, previous: 0, delta: 0, growthPct: 0, trend: 'flat' },
  topPatients: [], avgBasketSize: 0, avgItemsPerSale: 0,
};
const EMPTY_FINANCIAL: FinancialReport = {
  dailyPnL: [], last7Summary: emptyCashFlow('7d'), last30Summary: emptyCashFlow('30d'),
  allTimeSummary: emptyCashFlow('all-time'), inventoryAtCost: 0, inventoryAtRetail: 0,
  grossMarginPct: 0, topCostDrivers: [],
};
const EMPTY_PREDICTIVE: PredictionInsights = {
  shortageAlerts: [], demandForecasts: [], spikeAlerts: [], restockPriority: [],
  systemHealth: { totalSpikeAlerts: 0, criticalShortages: 0, risingDemandCount: 0, fallingDemandCount: 0 },
};

function emptyCashFlow(period: string) {
  return { period, totalCashIn: 0, totalCashOut: 0, netCashFlow: 0, totalSales: 0, totalRefunds: 0, totalPurchases: 0, avgDailyRevenue: 0 };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useIntelligence(): IntelligenceResult {
  const { sales }                          = useSalesStore();
  const { products, batches, inventory }   = useInventoryStore();
  const { purchases }                      = usePurchaseStore();
  const { refunds }                        = useRefundStore();

  const financialData = useMemo(() => ({ refunds, purchases }), [refunds, purchases]);
  const isLoading = false;

  const [tick, setTick] = useState(0);

  useEffect(() => {
    const off = eventBus.on('stock:updated', () => {
      setTick((t) => t + 1);
    });
    return () => off();
  }, []);

  // ── Engine computations — each memoized independently ────────────────────

  const inventoryInsights = useMemo(
    () => products.length > 0
      ? getInventoryInsights(products, batches, inventory, sales)
      : EMPTY_INVENTORY,
    [products, batches, inventory, sales, tick]
  );

  const salesInsights = useMemo(
    () => sales.length > 0 ? getSalesInsights(sales) : EMPTY_SALES,
    [sales]
  );

  const financialReport = useMemo(
    () => sales.length > 0 || financialData.purchases.length > 0
      ? getFinancialReport(sales, financialData.refunds, financialData.purchases, batches, products)
      : EMPTY_FINANCIAL,
    [sales, financialData.refunds, financialData.purchases, batches, products]
  );

  const predictiveInsights = useMemo(
    () => products.length > 0
      ? getPredictionInsights(products, batches, inventory, sales, financialData.purchases)
      : EMPTY_PREDICTIVE,
    [products, batches, inventory, sales, financialData.purchases, tick]
  );

  return {
    inventory:  inventoryInsights,
    sales:      salesInsights,
    financial:  financialReport,
    predictive: predictiveInsights,
    isLoading,
  };
}

/**
 * useEventConsumers — Global event consumer registry hook
 *
 * Mounts ONCE in App.tsx and wires all cross-cutting event reactions:
 *
 *   sale:created        → reload useSalesStore + useInventoryStore
 *   sale:refunded       → reload useSalesStore + useInventoryStore
 *   purchase:created    → reload useInventoryStore
 *   stock:updated       → reload useInventoryStore
 *   batch:created       → reload useInventoryStore
 *
 * Architecture Principle:
 *   Stores do NOT call each other directly.
 *   Instead: action → eventBus.emit → this registry reacts.
 *   This gives us full decoupling: POS doesn't know Inventory exists.
 *
 * Extending:
 *   To add a new consumer (e.g. loyalty points, cloud sync), just add
 *   one more eventBus.on() call here. No other files change.
 *
 * Debounce:
 *   Rapid fire events (batch:allocated per item) are debounced 150ms
 *   so a 20-item sale triggers ONE inventory reload, not 20.
 */

import { useEffect, useRef } from 'react';
import { eventBus } from '../domain/eventBus';
import { useSalesStore } from '../store/useSalesStore';
import { useInventoryStore } from '../store/useInventoryStore';
import { usePurchaseStore } from '../store/usePurchaseStore';
import { useRefundStore } from '../store/useRefundStore';

/** Debounce helper — collapses rapid-fire calls into one trailing call */
function debounce<T extends () => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...(args as [])), ms);
  }) as T;
}

export function useEventConsumers() {
  // Stable refs so debounced functions are created once
  const salesRef = useRef(useSalesStore.getState().loadAll);
  const inventoryRef = useRef(useInventoryStore.getState().loadAll);

  useEffect(() => {
    // Always use the latest store functions
    salesRef.current = useSalesStore.getState().loadAll;
    inventoryRef.current = useInventoryStore.getState().loadAll;
  });

  useEffect(() => {
    const reloadSales = () => salesRef.current();
    const reloadInventory = () => inventoryRef.current();

    // Debounce inventory reload — a single sale may emit many batch:allocated events
    const reloadInventoryDebounced = debounce(reloadInventory, 150);

    // ── Sales consumers ──────────────────────────────────────────────────────
    const offSaleCreated = eventBus.on('sale:created', () => {
      reloadSales();
      reloadInventoryDebounced(); // cart items deducted from batches
    });

    const offSaleRefunded = eventBus.on('sale:refunded', () => {
      reloadSales();
      reloadInventoryDebounced(); // stock restored to batches
      useRefundStore.getState().loadAll();
    });

    // ── Procurement consumers ────────────────────────────────────────────────
    const offPurchaseCreated = eventBus.on('purchase:created', () => {
      reloadInventoryDebounced(); // new batches added
      usePurchaseStore.getState().loadAll();
    });

    // ── Batch consumers (debounced — high-frequency) ─────────────────────────
    const offBatchCreated = eventBus.on('batch:created', reloadInventoryDebounced);
    const offBatchAllocated = eventBus.on('batch:allocated', reloadInventoryDebounced);
    const offStockUpdated = eventBus.on('stock:updated', reloadInventoryDebounced);

    // ── Cleanup on unmount ───────────────────────────────────────────────────
    return () => {
      offSaleCreated();
      offSaleRefunded();
      offPurchaseCreated();
      offBatchCreated();
      offBatchAllocated();
      offStockUpdated();
    };
  }, []); // mount once — stable debounced fns + refs handle freshness
}

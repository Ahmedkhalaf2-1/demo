/**
 * Global Barcode Scanner State & Handler Registry
 *
 * Architecture:
 *   Each page registers a handler for its context (e.g. 'pos', 'inventory').
 *   The global scanner hook calls dispatch(barcode) on every confirmed scan.
 *   dispatch() looks up the handler registered for the current activePage and calls it.
 *
 * Adding a new context = one registerHandler() call in the new page. Zero other changes.
 */

import { create } from 'zustand';

/** A context handler receives the raw barcode string and returns a result */
export type BarcodeHandler = (barcode: string) => void | Promise<void>;

interface BarcodeStore {
  /** Last successfully dispatched barcode (for debugging / audit) */
  lastScan: string | null;
  lastScanAt: number | null;

  /** Currently executing a scan action */
  scanning: boolean;

  /** Per-context handler registry: activePage key → handler */
  handlers: Record<string, BarcodeHandler>;

  /** Register (or overwrite) a handler for a given context */
  registerHandler: (context: string, handler: BarcodeHandler) => void;

  /** Unregister a context handler (call in page unmount) */
  unregisterHandler: (context: string) => void;

  /** Dispatch a barcode scan to the currently registered context handler */
  dispatch: (barcode: string, activeContext: string) => Promise<void>;
}

export const useBarcodeStore = create<BarcodeStore>((set, get) => ({
  lastScan:   null,
  lastScanAt: null,
  scanning:   false,
  handlers:   {},

  registerHandler: (context, handler) => {
    set((s) => ({ handlers: { ...s.handlers, [context]: handler } }));
  },

  unregisterHandler: (context) => {
    set((s) => {
      const next = { ...s.handlers };
      delete next[context];
      return { handlers: next };
    });
  },

  dispatch: async (barcode, activeContext) => {
    const { handlers, scanning } = get();
    if (scanning) return; // guard: don't overlap async handlers

    const handler = handlers[activeContext];
    if (!handler) {
      console.warn(`[BarcodeDispatcher] No handler registered for context: "${activeContext}"`);
      return;
    }

    set({ scanning: true, lastScan: barcode, lastScanAt: Date.now() });
    try {
      await handler(barcode);
    } catch (e) {
      console.error('[BarcodeDispatcher] Handler error:', e);
    } finally {
      set({ scanning: false });
    }
  },
}));

/**
 * PharmacyEventBus — Lightweight synchronous pub/sub event bus
 *
 * Design Principles:
 * - ZERO external dependencies (no RxJS, no EventEmitter npm packages)
 * - Fully typed via PharmacyEventMap — compile-time safety on emit & subscribe
 * - Synchronous dispatch: handlers are called inline, in registration order
 * - Async handlers: supported via fire-and-forget (errors are caught + logged)
 * - Thin abstraction: does NOT replace Zustand stores, sits on top of them
 *
 * Architecture:
 *   Business Action
 *       │
 *       ▼
 *   eventBus.emit('sale:created', payload)   ← from usePosStore / storageService
 *       │
 *       ▼
 *   Registered Handlers (any module can subscribe)
 *   ├── Analytics recalculation
 *   ├── Audit log writer
 *   ├── Cross-tab BroadcastChannel sync
 *   └── Future: webhook relay, cloud sync, etc.
 *
 * Adding a new event = one line in events.ts PharmacyEventMap. Zero other changes.
 *
 * Usage:
 *   // Emit
 *   eventBus.emit('sale:created', { saleId, total, ... });
 *
 *   // Subscribe (returns unsubscribe function)
 *   const off = eventBus.on('sale:created', (payload) => { ... });
 *   off(); // cleanup
 *
 *   // One-time subscription
 *   eventBus.once('batch:created', (payload) => { ... });
 */

import type {
  PharmacyEventName,
  PharmacyEventMap,
  PharmacyEventPayload,
} from './events';

type Handler<T> = (payload: T) => void | Promise<void>;

class PharmacyEventBus {
  private listeners = new Map<string, Set<Handler<any>>>();

  /**
   * Subscribe to an event. Returns an unsubscribe function.
   */
  on<E extends PharmacyEventName>(
    event: E,
    handler: Handler<PharmacyEventPayload<E>>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  /**
   * Subscribe once — automatically unsubscribes after first emission.
   */
  once<E extends PharmacyEventName>(
    event: E,
    handler: Handler<PharmacyEventPayload<E>>
  ): void {
    const wrapped: Handler<PharmacyEventPayload<E>> = (payload) => {
      this.off(event, wrapped);
      return handler(payload);
    };
    this.on(event, wrapped);
  }

  /**
   * Unsubscribe a specific handler.
   */
  off<E extends PharmacyEventName>(
    event: E,
    handler: Handler<PharmacyEventPayload<E>>
  ): void {
    this.listeners.get(event)?.delete(handler);
  }

  /**
   * Emit an event to all subscribers.
   * Handlers run synchronously in registration order.
   * Async handlers are fire-and-forget; errors are caught and logged.
   */
  emit<E extends PharmacyEventName>(
    event: E,
    payload: PharmacyEventPayload<E>
  ): void {
    const handlers = this.listeners.get(event);
    if (!handlers || handlers.size === 0) return;

    for (const handler of handlers) {
      try {
        const result = handler(payload);
        // If handler returns a Promise, catch errors silently
        if (result && typeof (result as any).catch === 'function') {
          (result as Promise<void>).catch((err) =>
            console.error(`[EventBus] Async handler error on "${event}":`, err)
          );
        }
      } catch (err) {
        console.error(`[EventBus] Sync handler error on "${event}":`, err);
      }
    }
  }

  /**
   * Remove all handlers for an event (useful in test teardown).
   */
  clear(event?: PharmacyEventName): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Diagnostics — returns count of listeners per event.
   */
  listenerCount(event: PharmacyEventName): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

// ── Singleton export ──────────────────────────────────────────────────────────
// One bus instance for the entire application lifetime.
// Import this anywhere: `import { eventBus } from '../domain/eventBus'`
export const eventBus = new PharmacyEventBus();

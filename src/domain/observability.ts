/**
 * Event Bus Observability Layer (Development Mode Only)
 *
 * Maintains a ring buffer of the last N events for debugging.
 * Does NOT affect production behavior — all logging is guarded by import.meta.env.DEV.
 *
 * Features:
 * - Circular buffer: keeps last MAX_EVENTS entries (no unbounded memory growth)
 * - Each entry records: event name, payload, timestamp, execution duration
 * - Exposed on window.__pharmaBus for console inspection:
 *     window.__pharmaBus.events   → last N events
 *     window.__pharmaBus.clear()  → wipe log
 *     window.__pharmaBus.filter('sale:created') → filtered entries
 *
 * Usage: import once in main.tsx or App.tsx in dev mode.
 *        Automatically attaches to the eventBus singleton.
 */

import { eventBus } from './eventBus';
import type { PharmacyEventName, PharmacyEventMap } from './events';

const MAX_EVENTS = 200;

export interface EventLogEntry {
  id:        number;
  event:     string;
  payload:   unknown;
  timestamp: string;   // ISO
  ms:        number;   // wall-clock time event was received
}

let _seq = 0;
const _log: EventLogEntry[] = [];

function record(event: string, payload: unknown): void {
  _seq += 1;
  const entry: EventLogEntry = {
    id:        _seq,
    event,
    payload,
    timestamp: new Date().toISOString(),
    ms:        performance.now(),
  };
  _log.push(entry);
  if (_log.length > MAX_EVENTS) _log.shift(); // maintain ring buffer
  console.debug(`%c[EventBus]%c ${event}`, 'color:#6366f1;font-weight:700', 'color:inherit', payload);
}

// Subscribe to ALL known events
const ALL_EVENTS: PharmacyEventName[] = [
  'sale:created',
  'sale:refunded',
  'stock:updated',
  'batch:allocated',
  'batch:created',
  'purchase:created',
  'prescription:dispensed',
  'barcode:scanned',
];

const unsubscribers: Array<() => void> = [];

export function initObservability(): void {
  if (!import.meta.env.DEV) return; // NOOP in production

  for (const name of ALL_EVENTS) {
    const off = eventBus.on(name, (payload) => record(name, payload));
    unsubscribers.push(off);
  }

  // Expose on window for console debugging
  (window as any).__pharmaBus = {
    get events() { return [..._log]; },
    clear() { _log.length = 0; console.info('[EventBus] Log cleared'); },
    filter(name: string) { return _log.filter((e) => e.event === name); },
    stats() {
      const counts: Record<string, number> = {};
      _log.forEach((e) => { counts[e.event] = (counts[e.event] ?? 0) + 1; });
      return counts;
    },
    listenerCounts() {
      return Object.fromEntries(
        ALL_EVENTS.map((e) => [e, eventBus.listenerCount(e)])
      );
    },
  };

  console.info(
    '%c[PharmacyOS] Event Bus Observability active. Use window.__pharmaBus to inspect.',
    'color:#6366f1;font-weight:700'
  );
}

export function destroyObservability(): void {
  unsubscribers.forEach((off) => off());
  unsubscribers.length = 0;
  delete (window as any).__pharmaBus;
}

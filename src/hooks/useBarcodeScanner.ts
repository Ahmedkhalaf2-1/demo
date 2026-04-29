/**
 * useBarcodeScanner — Global keyboard capture hook
 *
 * HOW USB SCANNER DETECTION WORKS:
 * A USB barcode scanner behaves as a keyboard that types all digits
 * of a barcode in rapid succession (<30ms per character) and then
 * sends Enter. A human typing is much slower (>150ms between keys).
 *
 * Algorithm:
 *  1. Listen for all keydown events globally.
 *  2. Accumulate characters into a buffer.
 *  3. Track time of first character in the current burst.
 *  4. On Enter:
 *     - If buffer has ≥3 chars AND the burst lasted <120ms → SCANNER input.
 *     - Otherwise → human typing, ignore.
 *  5. Dispatch confirmed scan via useBarcodeStore.dispatch().
 *  6. Debounce: ignore repeat scans of the same barcode within 300ms.
 *
 * SAFETY:
 *  - Skip processing if the focused element is a regular text input
 *    (form fields, search boxes) UNLESS it is the dedicated barcode field.
 *  - This prevents scanner input from conflicting with form entry.
 *
 * Mount this hook ONCE in App.tsx.
 */

import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useBarcodeStore } from '../store/useBarcodeStore';

/** Maximum milliseconds between first and last character for scanner detection */
const SCANNER_MAX_BURST_MS = 120;

/** Minimum barcode length to be considered valid */
const MIN_BARCODE_LENGTH = 3;

/** Milliseconds to block duplicate scans of the same barcode */
const DEBOUNCE_MS = 300;

/** CSS selector for inputs that should BLOCK global scanner capture */
const BLOCKING_INPUTS = 'input[type="text"], input[type="search"], input[type="number"], input[type="password"], textarea';

/** Data attribute to ALLOW a specific input to act as dedicated barcode field */
export const BARCODE_INPUT_ATTR = 'data-barcode-field';

export function useBarcodeScanner() {
  const buffer       = useRef<string>('');
  const burstStart   = useRef<number>(0);
  const lastBarcode  = useRef<string>('');
  const lastScanTime = useRef<number>(0);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;

      // If focus is inside a blocking input that is NOT a dedicated barcode field, ignore
      if (
        target.matches(BLOCKING_INPUTS) &&
        !target.hasAttribute(BARCODE_INPUT_ATTR)
      ) {
        // Allow Escape to always work
        if (e.key !== 'Escape') return;
      }

      if (e.key === 'Enter') {
        const barcode   = buffer.current.trim();
        const burstMs   = Date.now() - burstStart.current;
        const now       = Date.now();

        buffer.current    = '';
        burstStart.current = 0;

        // Validate: length + speed
        if (barcode.length < MIN_BARCODE_LENGTH) return;
        if (burstMs > SCANNER_MAX_BURST_MS) return; // too slow → human typed it

        // Debounce: same barcode within 300ms
        if (barcode === lastBarcode.current && now - lastScanTime.current < DEBOUNCE_MS) return;

        lastBarcode.current  = barcode;
        lastScanTime.current = now;

        // Route to the correct page handler
        const activeContext = useAppStore.getState().activePage;
        useBarcodeStore.getState().dispatch(barcode, activeContext);

      } else if (e.key.length === 1) {
        // Single printable character — accumulate into buffer
        if (buffer.current.length === 0) {
          burstStart.current = Date.now(); // record burst start
        }
        buffer.current += e.key;
      } else if (e.key === 'Escape') {
        // Clear buffer on Escape
        buffer.current = '';
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}

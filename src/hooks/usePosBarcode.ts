/**
 * usePosBarcode — POS context barcode handler
 *
 * Registers itself into useBarcodeStore for the 'pos' context.
 * When a barcode scan arrives:
 *   1. Find product by barcode in the inventory store.
 *   2. Check available valid stock.
 *   3. Add to cart automatically.
 *   4. Play audible feedback (success / error).
 *   5. Show inline notification.
 *
 * Mount this hook inside the POS page component.
 * It automatically unregisters on unmount.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useBarcodeStore } from '../store/useBarcodeStore';
import { useInventoryStore } from '../store/useInventoryStore';
import { usePosStore } from '../store/usePosStore';
import { batchService } from '../db/storageService';
import type { CartItem } from '../types';

// ── Audio feedback (Web Audio API — no external files needed) ──────────────
function playBeep(frequency: number, duration: number, type: OscillatorType = 'sine') {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
    ctx.close();
  } catch {
    // AudioContext not available — silent failure
  }
}

const beepSuccess = () => playBeep(1046, 0.12, 'sine');  // C6 — clean confirm tone
const beepError   = () => playBeep(220,  0.3,  'sawtooth'); // A3 — harsh error tone

// ── Hook ──────────────────────────────────────────────────────────────────
interface Options {
  onSuccess: (productName: string) => void;
  onError:   (message: string) => void;
}

export function usePosBarcode({ onSuccess, onError }: Options) {
  const { products, inventory } = useInventoryStore();
  const { addToCart } = usePosStore();
  const { registerHandler, unregisterHandler } = useBarcodeStore();

  // Keep refs so the handler always sees fresh store data without re-registering
  const productsRef  = useRef(products);
  const inventoryRef = useRef(inventory);
  const addToCartRef = useRef(addToCart);

  useEffect(() => { productsRef.current = products; },   [products]);
  useEffect(() => { inventoryRef.current = inventory; }, [inventory]);
  useEffect(() => { addToCartRef.current = addToCart; }, [addToCart]);

  const handler = useCallback(async (barcode: string) => {
    // 1. Find product by barcode
    const product = productsRef.current.find(
      (p) => p.barcode === barcode || p.barcode === barcode.replace(/^0+/, '')
    );

    if (!product) {
      beepError();
      onError(`الباركود "${barcode}" غير موجود في الكتالوج`);
      return;
    }

    // 2. Check inventory total
    const inv = inventoryRef.current.find((i) => i.productId === product.id);
    if (!inv || inv.totalQuantity === 0) {
      beepError();
      onError(`${product.name}: نفد من المخزون`);
      return;
    }

    // 3. Get valid batch stock (non-expired)
    const validBatches = await batchService.getValidByProduct(product.id);
    const availableStock = validBatches.reduce((sum, b) => sum + b.remaining, 0);

    if (availableStock === 0) {
      beepError();
      onError(`${product.name}: جميع الدفعات منتهية الصلاحية`);
      return;
    }

    // 4. Add to cart
    const item: CartItem = {
      productId:      product.id,
      productName:    product.name,
      quantity:       1,
      unitPrice:      product.unitPrice,
      costPrice:      product.costPrice,
      discount:       0,
      availableStock,
    };
    addToCartRef.current(item);

    // 5. Success feedback
    beepSuccess();
    onSuccess(product.name);
  }, []); // stable — uses refs internally

  useEffect(() => {
    registerHandler('pos', handler);
    return () => unregisterHandler('pos');
  }, [handler, registerHandler, unregisterHandler]);
}

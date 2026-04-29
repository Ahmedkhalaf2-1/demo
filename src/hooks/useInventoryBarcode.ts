/**
 * useInventoryBarcode — Inventory context barcode handler
 *
 * Registers itself into useBarcodeStore for the 'inventory' context.
 * When a barcode scan arrives in the Inventory page:
 *   1. Find product by barcode.
 *   2. If found → call onFound(product) so the page can open the batch-add modal.
 *   3. If not found → call onError.
 *
 * Mount this hook inside the Inventory page component.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useBarcodeStore } from '../store/useBarcodeStore';
import { useInventoryStore } from '../store/useInventoryStore';
import type { Product } from '../types';

interface Options {
  onFound: (product: Product) => void;
  onError: (message: string) => void;
}

export function useInventoryBarcode({ onFound, onError }: Options) {
  const { products } = useInventoryStore();
  const { registerHandler, unregisterHandler } = useBarcodeStore();

  const productsRef = useRef(products);
  useEffect(() => { productsRef.current = products; }, [products]);

  const onFoundRef = useRef(onFound);
  useEffect(() => { onFoundRef.current = onFound; }, [onFound]);

  const handler = useCallback(async (barcode: string) => {
    const product = productsRef.current.find(
      (p) => p.barcode === barcode || p.barcode === barcode.replace(/^0+/, '')
    );
    if (!product) {
      onError(`الباركود "${barcode}" غير موجود — يمكنك إضافة منتج جديد يدوياً`);
      return;
    }
    onFoundRef.current(product);
  }, [onError]);

  useEffect(() => {
    registerHandler('inventory', handler);
    return () => unregisterHandler('inventory');
  }, [handler, registerHandler, unregisterHandler]);
}

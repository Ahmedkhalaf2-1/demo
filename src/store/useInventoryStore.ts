import { create } from 'zustand';
import { productService, batchService, inventoryService } from '../db/storageService';
import { db } from '../db/database';
import type { Product, Batch, Inventory } from '../types';
import { nanoid } from '../utils/id';
import { eventBus } from '../domain/eventBus';

interface InventoryState {
  products: Product[];
  batches: Batch[];
  inventory: Inventory[];
  loading: boolean;
  error: string | null;

  loadAll: () => Promise<void>;
  hydrate: (products: Product[], batches: Batch[], inventory: Inventory[]) => void;
  addProduct: (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateProduct: (id: string, data: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addBatch: (data: Omit<Batch, 'id' | 'receivedAt'>) => Promise<void>;
  updateBatch: (id: string, data: Partial<Batch>) => Promise<void>;
  deleteBatch: (id: string) => Promise<void>;
  setMinStock: (productId: string, minStock: number) => Promise<void>;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  products: [],
  batches: [],
  inventory: [],
  loading: false,
  error: null,

  loadAll: async () => {
    set({ loading: true, error: null });
    try {
      const [products, batches, inventory] = await Promise.all([
        productService.getAll(),
        batchService.getAll(),
        inventoryService.getAll(),
      ]);
      set({ products, batches, inventory, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  hydrate: (products, batches, inventory) => {
    set({ products, batches, inventory, loading: false });
  },

  addProduct: async (data) => {
    const now = new Date().toISOString();
    const product: Product = { ...data, id: nanoid(), createdAt: now, updatedAt: now };
    await productService.add(product);
    set((s) => ({ products: [...s.products, product] }));
  },

  updateProduct: async (id, data) => {
    const updated = { ...data, updatedAt: new Date().toISOString() };
    await productService.update(id, updated);
    set((s) => ({
      products: s.products.map((p) => (p.id === id ? { ...p, ...updated } : p)),
    }));
  },

  deleteProduct: async (id) => {
    // Also remove batches and inventory
    const batchesToDelete = get().batches.filter((b) => b.productId === id);
    await Promise.all(batchesToDelete.map((b) => batchService.delete(b.id)));
    const inv = get().inventory.find((i) => i.productId === id);
    if (inv) await db.inventory.delete(inv.id);
    await productService.delete(id);
    set((s) => ({
      products: s.products.filter((p) => p.id !== id),
      batches: s.batches.filter((b) => b.productId !== id),
      inventory: s.inventory.filter((i) => i.productId !== id),
    }));
  },

  addBatch: async (data) => {
    const batch: Batch = { ...data, id: nanoid(), receivedAt: new Date().toISOString() };
    await batchService.add(batch);
    // Recalculate inventory
    const newTotal = await inventoryService.recalculate(data.productId);
    set((s) => ({
      batches: [...s.batches, batch],
      inventory: s.inventory.map((i) =>
        i.productId === data.productId
          ? { ...i, totalQuantity: newTotal, updatedAt: new Date().toISOString() }
          : i
      ),
    }));
    
    const productName = get().products.find(p => p.id === data.productId)?.name ?? '';
    eventBus.emit('stock:updated', {
      productId:   data.productId,
      productName,
      newQuantity: newTotal,
      delta:       data.quantity,
      reason:      'adjustment',
    });
    // If inventory record didn't exist yet, reload
    const exists = get().inventory.find((i) => i.productId === data.productId);
    if (!exists) await get().loadAll();
  },

  updateBatch: async (id, data) => {
    await batchService.update(id, data);
    set((s) => ({
      batches: s.batches.map((b) => (b.id === id ? { ...b, ...data } : b)),
    }));
    const batch = get().batches.find((b) => b.id === id);
    if (batch) {
      const newTotal = await inventoryService.recalculate(batch.productId);
      set((s) => ({
        inventory: s.inventory.map((i) =>
          i.productId === batch.productId
            ? { ...i, totalQuantity: newTotal, updatedAt: new Date().toISOString() }
            : i
        ),
      }));

      const productName = get().products.find(p => p.id === batch.productId)?.name ?? '';
      eventBus.emit('stock:updated', {
        productId:   batch.productId,
        productName,
        newQuantity: newTotal,
        delta:       0,
        reason:      'adjustment',
      });
    }
  },

  deleteBatch: async (id) => {
    const batch = get().batches.find((b) => b.id === id);
    await batchService.delete(id);
    set((s) => ({ batches: s.batches.filter((b) => b.id !== id) }));
    if (batch) {
      const newTotal = await inventoryService.recalculate(batch.productId);
      set((s) => ({
        inventory: s.inventory.map((i) =>
          i.productId === batch.productId
            ? { ...i, totalQuantity: newTotal, updatedAt: new Date().toISOString() }
            : i
        ),
      }));

      const productName = get().products.find(p => p.id === batch.productId)?.name ?? '';
      eventBus.emit('stock:updated', {
        productId:   batch.productId,
        productName,
        newQuantity: newTotal,
        delta:       -batch.remaining,
        reason:      'adjustment',
      });
    }
  },

  setMinStock: async (productId, minStock) => {
    await inventoryService.setMinStock(productId, minStock);
    set((s) => ({
      inventory: s.inventory.map((i) =>
        i.productId === productId ? { ...i, minStock } : i
      ),
    }));
  },
}));

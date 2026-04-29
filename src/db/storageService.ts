import { db } from './database';
import { getLocalDateKey, getNowISO } from '../utils/time';
import { eventBus } from '../domain/eventBus';
import type {
  Product,
  Batch,
  Inventory,
  Patient,
  Prescription,
  Sale,
  SaleItem,
  User,
  Settings,
  Refund,
  RefundItem,
  Purchase,
  PurchaseItem,
} from '../types';
import { useAuthStore } from '../store/useAuthStore';

// ─── Cross-Tab Sync ───────────────────────────────────────────────────────────
export const syncChannel = new BroadcastChannel('pharma_sync_channel');

// ─── Users ────────────────────────────────────────────────────────────────────
export const userService = {
  getAll: () => db.users.toArray(),
  add: (u: User) => {
    const p = db.users.add(u);
    p.then(() => syncChannel.postMessage({ action: 'SYNC' }));
    return p;
  },
  update: (id: string, changes: Partial<User>) => {
    const p = db.users.update(id, changes);
    p.then(() => syncChannel.postMessage({ action: 'SYNC' }));
    return p;
  },
  delete: (id: string) => {
    const p = db.users.delete(id);
    p.then(() => syncChannel.postMessage({ action: 'SYNC' }));
    return p;
  },
};

// ─── Products ─────────────────────────────────────────────────────────────────
export const productService = {
  getAll: () => db.products.orderBy('name').toArray(),
  getById: (id: string) => db.products.get(id),
  getByBarcode: (barcode: string) =>
    db.products.where('barcode').equals(barcode).first(),
  search: (query: string) =>
    db.products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.barcode.includes(query)
      )
      .toArray(),
  add: (p: Product) => {
    const res = db.products.add(p);
    res.then(() => syncChannel.postMessage({ action: 'SYNC' }));
    return res;
  },
  update: (id: string, changes: Partial<Product>) => {
    const res = db.products.update(id, changes);
    res.then(() => syncChannel.postMessage({ action: 'SYNC' }));
    return res;
  },
  delete: (id: string) => {
    const res = db.products.delete(id);
    res.then(() => syncChannel.postMessage({ action: 'SYNC' }));
    return res;
  },
};

// ─── Batches ──────────────────────────────────────────────────────────────────
export const batchService = {
  getAll: () => db.batches.toArray(),
  getById: (id: string) => db.batches.get(id),
  getByProduct: (productId: string) =>
    db.batches.where('productId').equals(productId).toArray(),
  getValidByProduct: (productId: string) => {
    const today = getLocalDateKey();
    return db.batches
      .where('productId')
      .equals(productId)
      .filter((b) => b.remaining > 0 && b.expiryDate >= today)
      .sortBy('expiryDate'); // FEFO: soonest-to-expire first
  },
  getExpiringSoon: (daysAhead: number) => {
    const todayStr = getLocalDateKey();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    const futureStr = getLocalDateKey(futureDate);
    return db.batches
      .where('expiryDate')
      .between(todayStr, futureStr, true, true)
      .filter((b) => b.remaining > 0)
      .toArray();
  },
  add: (b: Batch) => {
    const res = db.batches.add(b);
    res.then(() => {
      syncChannel.postMessage({ action: 'SYNC' });
      auditService.log('CREATE_BATCH', 'batch', b.id, `إضافة دفعة جديدة بكمية ${b.remaining}`);
    });
    return res;
  },
  update: (id: string, changes: Partial<Batch>) => {
    const res = db.batches.update(id, changes);
    res.then(() => {
      syncChannel.postMessage({ action: 'SYNC' });
      auditService.log('UPDATE_BATCH', 'batch', id, `تعديل الدفعة ${JSON.stringify(changes)}`);
    });
    return res;
  },
  delete: (id: string) => {
    const res = db.batches.delete(id);
    res.then(() => syncChannel.postMessage({ action: 'SYNC' }));
    return res;
  },
};

// ─── Inventory ────────────────────────────────────────────────────────────────
export const inventoryService = {
  getAll: () => db.inventory.toArray(),
  getByProduct: (productId: string) =>
    db.inventory.where('productId').equals(productId).first(),
  upsert: async (productId: string, qty: number, minStock = 10) => {
    const existing = await db.inventory
      .where('productId')
      .equals(productId)
      .first();
    if (existing) {
      await db.inventory.update(existing.id, {
        totalQuantity: qty,
        updatedAt: new Date().toISOString(),
      });
    } else {
      const { nanoid } = await import('nanoid');
      await db.inventory.add({
        id: nanoid(),
        productId,
        totalQuantity: qty,
        minStock,
        updatedAt: new Date().toISOString(),
      });
    }
  },
  /** Rebuild inventory total from all valid batches for a product */
  recalculate: async (productId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const batches = await db.batches
      .where('productId')
      .equals(productId)
      .toArray();
    const total = batches
      .filter((b) => b.expiryDate >= today)
      .reduce((sum, b) => sum + b.remaining, 0);
    await inventoryService.upsert(productId, total);
    return total;
  },
  setMinStock: async (productId: string, minStock: number) => {
    const existing = await db.inventory
      .where('productId')
      .equals(productId)
      .first();
    if (existing) {
      await db.inventory.update(existing.id, { minStock });
    }
  },
};

// ─── Patients ─────────────────────────────────────────────────────────────────
export const patientService = {
  getAll: () => db.patients.orderBy('name').toArray(),
  getById: (id: string) => db.patients.get(id),
  search: (query: string) =>
    db.patients
      .filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.phone.includes(query)
      )
      .toArray(),
  add: (p: Patient) => db.patients.add(p),
  update: (id: string, changes: Partial<Patient>) =>
    db.patients.update(id, changes),
  delete: (id: string) => db.patients.delete(id),
};

// ─── Prescriptions ────────────────────────────────────────────────────────────
export const prescriptionService = {
  getAll: () => db.prescriptions.orderBy('createdAt').reverse().toArray(),
  getById: (id: string) => db.prescriptions.get(id),
  getByPatient: (patientId: string) =>
    db.prescriptions.where('patientId').equals(patientId).toArray(),
  add: (p: Prescription) => db.prescriptions.add(p),
  update: (id: string, changes: Partial<Prescription>) =>
    db.prescriptions.update(id, changes),
  delete: (id: string) => db.prescriptions.delete(id),
};

// ─── Sales ────────────────────────────────────────────────────────────────────
export const salesService = {
  getAll: () => db.sales.orderBy('createdAt').reverse().toArray(),
  getById: (id: string) => db.sales.get(id),
  getByPatient: (patientId: string) =>
    db.sales.where('patientId').equals(patientId).toArray(),
  getByDateRange: (from: string, to: string) =>
    db.sales
      .where('createdAt')
      .between(from, to + 'T23:59:59', true, true)
      .toArray(),
  add: (s: Sale) => db.sales.add(s),
  update: (id: string, changes: Partial<Sale>) =>
    db.sales.update(id, changes),
};

export const saleItemService = {
  getBySale: (saleId: string) =>
    db.sale_items.where('saleId').equals(saleId).toArray(),
  addBulk: (items: SaleItem[]) => db.sale_items.bulkAdd(items),
};

// ─── Refunds ──────────────────────────────────────────────────────────────
export const refundService = {
  getAll: () => db.refunds.orderBy('createdAt').reverse().toArray(),
  getById: (id: string) => db.refunds.get(id),
  getBySale: (saleId: string) =>
    db.refunds.where('originalSaleId').equals(saleId).toArray(),

  /** Process a full or partial refund atomically */
  processRefund: async (refund: Refund, refundItems: RefundItem[]) => {
    await db.transaction(
      'rw',
      [db.refunds, db.refund_items, db.batches, db.inventory, db.sales, db.audit_logs],
      async () => {
        await db.refunds.add(refund);
        await db.refund_items.bulkAdd(refundItems);
        // Restore stock to originating batches
        for (const item of refundItems) {
          const batch = await db.batches.get(item.batchId);
          if (batch) {
            await db.batches.update(item.batchId, { remaining: batch.remaining + item.quantity });
          }
        }
        // Recalculate inventory
        const today = getLocalDateKey(); // ✔ local-safe
        const uniqueProducts = [...new Set(refundItems.map((i) => i.productId))];
        for (const productId of uniqueProducts) {
          const batches = await db.batches.where('productId').equals(productId).toArray();
          const total = batches.filter((b) => b.expiryDate >= today).reduce((sum, b) => sum + b.remaining, 0);
          const inv = await db.inventory.where('productId').equals(productId).first();
          if (inv) await db.inventory.update(inv.id, { totalQuantity: total, updatedAt: getNowISO() });
        }
        await db.sales.update(refund.originalSaleId, { status: 'refunded' });
        await db.audit_logs.add({
          id: crypto.randomUUID(),
          action: 'REFUND_PROCESSED',
          entity: 'refund',
          entityId: refund.id,
          details: `استرداد للفاتورة #${refund.originalSaleId.slice(-6).toUpperCase()} — القيمة: ${refund.total} ج.م`,
          timestamp: getNowISO(),
        });
      }
    );

    // ── Emit event after transaction commits ──────────────────────────────────
    eventBus.emit('sale:refunded', {
      refundId: refund.id,
      originalSaleId: refund.originalSaleId,
      dateKey: getLocalDateKey(),
      refundTotal: refund.total,
      itemCount: refundItems.length,
    });

    for (const item of refundItems) {
      eventBus.emit('stock:updated', {
        productId: item.productId,
        productName: item.productName,
        newQuantity: -1,
        delta: item.quantity,
        reason: 'refund',
      });
    }
  },
};


// ─── Purchases (Procurement) ────────────────────────────────────────────────
export const purchaseService = {
  getAll: () => db.purchases.orderBy('createdAt').reverse().toArray(),
  getById: (id: string) => db.purchases.get(id),

  /**
   * Record a supplier purchase invoice.
   * Creates batches for each received product line, then recalculates inventory.
   * Entire operation is atomic: if any step fails, nothing is persisted.
   */
  receivePurchase: async (purchase: Purchase, purchaseItems: PurchaseItem[]) => {
    const createdBatchIds: { batchId: string; productId: string; quantity: number; expiryDate: string; lotNumber: string }[] = [];

    await db.transaction(
      'rw',
      [db.purchases, db.purchase_items, db.batches, db.inventory, db.audit_logs],
      async () => {
        await db.purchases.add(purchase);
        await db.purchase_items.bulkAdd(purchaseItems);

        // For each line item, create a new batch and update inventory
        for (const item of purchaseItems) {
          const batchId = crypto.randomUUID();
          await db.batches.add({
            id: batchId,
            productId: item.productId,
            lotNumber: item.batchLotNumber,
            expiryDate: item.expiryDate,
            manufactureDate: item.manufactureDate,
            quantity: item.quantity,
            remaining: item.quantity,
            costPerUnit: item.costPerUnit,
            receivedAt: purchase.createdAt,
          });
          createdBatchIds.push({ batchId, productId: item.productId, quantity: item.quantity, expiryDate: item.expiryDate, lotNumber: item.batchLotNumber });
        }

        // Recalculate inventory for each affected product
        const today = getLocalDateKey(); // ✔ local-safe
        const uniqueProducts = [...new Set(purchaseItems.map((i) => i.productId))];
        for (const productId of uniqueProducts) {
          const batches = await db.batches.where('productId').equals(productId).toArray();
          const total = batches
            .filter((b) => b.expiryDate >= today)
            .reduce((sum, b) => sum + b.remaining, 0);
          const inv = await db.inventory.where('productId').equals(productId).first();
          if (inv) {
            await db.inventory.update(inv.id, {
              totalQuantity: total,
              updatedAt: getNowISO(),
            });
          }
        }

        await db.audit_logs.add({
          id: crypto.randomUUID(),
          action: 'PURCHASE_RECEIVED',
          entity: 'purchase',
          entityId: purchase.id,
          details: `استلام مشتريات من المورد: ${purchase.supplierName} — فاتورة: ${purchase.invoiceNumber} — التكلفة: ${purchase.totalCost} ج.م`,
          timestamp: getNowISO(),
        });
      }
    );

    // ── Emit domain events after transaction commits ──────────────────────────
    eventBus.emit('purchase:created', {
      purchaseId: purchase.id,
      dateKey: getLocalDateKey(),
      supplierName: purchase.supplierName,
      totalCost: purchase.totalCost,
      itemCount: purchaseItems.length,
    });
    for (const b of createdBatchIds) {
      eventBus.emit('batch:created', {
        batchId: b.batchId,
        productId: b.productId,
        quantity: b.quantity,
        expiryDate: b.expiryDate,
        lotNumber: b.lotNumber,
        purchaseId: purchase.id,
      });
      eventBus.emit('stock:updated', {
        productId: b.productId,
        productName: '',   // not available in service layer — consumers can resolve
        newQuantity: -1,   // consumers read from store for actual value
        delta: b.quantity,
        reason: 'purchase',
      });
    }
  },
};

// ─── Settings ─────────────────────────────────────────────────────────────────
const defaultSettings: Settings = {
  id: 'global',
  pharmacyName: 'صيدليتي',
  phone: '',
  address: '',
  currency: 'EGP',
  lowStockThreshold: 10,
  expiryWarningDays: 30,
  enablePrinting: true,
  pharmacistName: '',
  pharmacistAvatar: '',
};

export const settingsService = {
  get: async () => {
    const s = await db.settings.get('global');
    if (!s) {
      await db.settings.add(defaultSettings);
      return defaultSettings;
    }
    return s;
  },
  update: async (changes: Partial<Settings>) => {
    const p = db.settings.update('global', changes);
    p.then(() => syncChannel.postMessage({ action: 'SYNC' }));
    return p;
  },
};

// ─── Audit Logs ───────────────────────────────────────────────────────────────
export const auditService = {
  getAll: () => db.audit_logs.orderBy('timestamp').reverse().toArray(),
  log: (action: string, entity: string, entityId: string, details: string, userId?: string) => {
    const user = useAuthStore.getState().currentUser;
    const userPrefix = user ? `${user.name} (${user.role === 'admin' ? 'مدير' : user.role === 'pharmacist' ? 'صيدلي' : 'كاشير'}) ` : '';
    return db.audit_logs.add({
      id: crypto.randomUUID(),
      action,
      entity,
      entityId,
      details: userPrefix + details,
      userId: userId || user?.id,
      timestamp: new Date().toISOString(),
    });
  },
};

// ─── Export / Import ──────────────────────────────────────────────────────────
export const exportDatabase = async () => {
  const [users, products, batches, inventory, patients, prescriptions, sales, sale_items] =
    await Promise.all([
      db.users.toArray(),
      db.products.toArray(),
      db.batches.toArray(),
      db.inventory.toArray(),
      db.patients.toArray(),
      db.prescriptions.toArray(),
      db.sales.toArray(),
      db.sale_items.toArray(),
    ]);

  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    users,
    products,
    batches,
    inventory,
    patients,
    prescriptions,
    sales,
    sale_items,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pharmacy-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

export const importDatabase = async (file: File): Promise<void> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target!.result as string);
        await db.transaction(
          'rw',
          [db.users, db.products, db.batches, db.inventory, db.patients, db.prescriptions, db.sales, db.sale_items],
          async () => {
            await Promise.all([
              db.users.clear(),
              db.products.clear(),
              db.batches.clear(),
              db.inventory.clear(),
              db.patients.clear(),
              db.prescriptions.clear(),
              db.sales.clear(),
              db.sale_items.clear(),
            ]);
            await Promise.all([
              data.users?.length && db.users.bulkAdd(data.users),
              data.products?.length && db.products.bulkAdd(data.products),
              data.batches?.length && db.batches.bulkAdd(data.batches),
              data.inventory?.length && db.inventory.bulkAdd(data.inventory),
              data.patients?.length && db.patients.bulkAdd(data.patients),
              data.prescriptions?.length &&
              db.prescriptions.bulkAdd(data.prescriptions),
              data.sales?.length && db.sales.bulkAdd(data.sales),
              data.sale_items?.length &&
              db.sale_items.bulkAdd(data.sale_items),
            ]);
          }
        );
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
};

export const resetDatabase = async () => {
  await db.transaction(
    'rw',
    [db.users, db.products, db.batches, db.inventory, db.patients, db.prescriptions, db.sales, db.sale_items],
    async () => {
      await Promise.all([
        db.users.clear(),
        db.products.clear(),
        db.batches.clear(),
        db.inventory.clear(),
        db.patients.clear(),
        db.prescriptions.clear(),
        db.sales.clear(),
        db.sale_items.clear(),
      ]);
    }
  );
};

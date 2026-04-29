import { db } from '../db/database';
import type { 
  Sale, 
  Inventory, 
  Batch, 
  Purchase, 
  Refund, 
  Settings, 
  Product, 
  Patient, 
  Prescription 
} from '../types';

export interface BootPayload {
  sales: Sale[];
  inventory: Inventory[];
  batches: Batch[];
  purchases: Purchase[];
  refunds: Refund[];
  settings: Settings | null;
  products: Product[];
  patients: Patient[];
  prescriptions: Prescription[];
}

export const BootLoader = {
  async loadAll(): Promise<BootPayload> {
    const [
      sales,
      inventory,
      batches,
      purchases,
      refunds,
      settingsArray,
      products,
      patients,
      prescriptions
    ] = await Promise.all([
      db.sales.toArray(),
      db.inventory.toArray(),
      db.batches.toArray(),
      db.purchases.toArray(),
      db.refunds.toArray(),
      db.settings.toArray(),
      db.products.toArray(),
      db.patients.toArray(),
      db.prescriptions.toArray(),
    ]);

    // Sales items, refund items, and purchase items are often loaded dynamically,
    // but we should ensure they are attached if the stores expect them.
    // However, looking at useSalesStore.ts, it calls salesService.getAll().
    // Let's check what salesService.getAll() does to see if it loads items.
    
    return {
      sales,
      inventory,
      batches,
      purchases,
      refunds,
      settings: settingsArray[0] || null,
      products,
      patients,
      prescriptions
    };
  }
};

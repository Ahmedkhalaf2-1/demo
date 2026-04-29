import { BootLoader } from './BootLoader';
import { useSalesStore } from '../store/useSalesStore';
import { useInventoryStore } from '../store/useInventoryStore';
import { usePatientStore } from '../store/usePatientStore';
import { usePrescriptionStore } from '../store/usePrescriptionStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { usePurchaseStore } from '../store/usePurchaseStore';
import { useRefundStore } from '../store/useRefundStore';
import { settingsService } from '../db/storageService';

import { getInventoryInsights } from '../intelligence/inventoryIntelligence';
import { getSalesInsights }     from '../intelligence/salesIntelligence';
import { getFinancialReport }   from '../intelligence/financialEngine';
import { getPredictionInsights } from '../intelligence/predictiveEngine';

import { seedDatabase } from '../utils/seed';

export const BootOrchestrator = {
  async run(): Promise<void> {
    console.log('[Boot] Starting enterprise boot sequence...');

    // 1. Load data from DB (or fallback to seed)
    let payload = await BootLoader.loadAll();

    // Check if empty (automatic fallback)
    const isEmpty = 
      payload.products.length === 0 && 
      payload.sales.length === 0 && 
      payload.batches.length === 0;

    if (isEmpty) {
      console.log('[Boot] DB is empty. Initializing clean seed state...');
      await seedDatabase();
      // Reload after seed
      payload = await BootLoader.loadAll();
    }

    if (!payload.settings) {
      payload.settings = await settingsService.get();
    }

    // 2. Hydrate stores
    console.log('[Boot] Hydrating Zustand stores...');
    useSalesStore.getState().hydrate(payload.sales);
    useInventoryStore.getState().hydrate(payload.products, payload.batches, payload.inventory);
    usePatientStore.getState().hydrate(payload.patients);
    
    // Prescription hydration is async
    await usePrescriptionStore.getState().hydrate(payload.prescriptions);
    
    useSettingsStore.getState().hydrate(payload.settings);
    usePurchaseStore.getState().hydrate(payload.purchases);
    useRefundStore.getState().hydrate(payload.refunds);

    // 3. Warm up intelligence engines
    console.log('[Boot] Warming up intelligence engines...');
    try {
      if (payload.products.length > 0) {
        getInventoryInsights(payload.products, payload.batches, payload.inventory, payload.sales);
      }
      if (payload.sales.length > 0) {
        getSalesInsights(payload.sales);
      }
      if (payload.sales.length > 0 || payload.purchases.length > 0) {
        getFinancialReport(payload.sales, payload.refunds, payload.purchases, payload.batches, payload.products);
      }
      if (payload.products.length > 0) {
        getPredictionInsights(payload.products, payload.batches, payload.inventory, payload.sales, payload.purchases);
      }
    } catch (e) {
      console.warn('[Boot] Intelligence engine warm-up warning:', e);
    }

    console.log('[Boot] Boot sequence complete.');
  }
};

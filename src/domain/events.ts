/**
 * Domain Event Type Definitions
 *
 * Every business action in the system has a strongly-typed event.
 * New events = just add a new interface + entry to PharmacyEventMap.
 * No other changes required.
 */

// ── Sale Events ──────────────────────────────────────────────────────────────
export interface SaleCreatedEvent {
  saleId: string;
  dateKey: string;
  total: number;
  profit: number;
  itemCount: number;
  paymentMethod: string;
  patientId?: string;
}

export interface SaleRefundedEvent {
  refundId: string;
  originalSaleId: string;
  dateKey: string;
  refundTotal: number;
  itemCount: number;
}

// ── Inventory Events ─────────────────────────────────────────────────────────
export interface StockUpdatedEvent {
  productId: string;
  productName: string;
  newQuantity: number;
  delta: number; // positive = added, negative = deducted
  reason: 'sale' | 'purchase' | 'refund' | 'adjustment';
}

export interface BatchAllocatedEvent {
  batchId: string;
  productId: string;
  quantity: number;
  saleId: string;
}

export interface BatchCreatedEvent {
  batchId: string;
  productId: string;
  quantity: number;
  expiryDate: string;
  lotNumber: string;
  purchaseId: string;
}

// ── Procurement Events ───────────────────────────────────────────────────────
export interface PurchaseCreatedEvent {
  purchaseId: string;
  dateKey: string;
  supplierName: string;
  totalCost: number;
  itemCount: number;
}

// ── Prescription Events ──────────────────────────────────────────────────────
export interface PrescriptionDispensedEvent {
  prescriptionId: string;
  saleId: string;
  patientId: string;
}

// ── Barcode Events ───────────────────────────────────────────────────────────
export interface BarcodeScanEvent {
  barcode: string;
  context: string;
  resolvedProductId?: string;
  success: boolean;
}

// ── Master Event Map — add new events here ───────────────────────────────────
export interface PharmacyEventMap {
  'sale:created': SaleCreatedEvent;
  'sale:refunded': SaleRefundedEvent;
  'stock:updated': StockUpdatedEvent;
  'batch:allocated': BatchAllocatedEvent;
  'batch:created': BatchCreatedEvent;
  'purchase:created': PurchaseCreatedEvent;
  'prescription:dispensed': PrescriptionDispensedEvent;
  'barcode:scanned': BarcodeScanEvent;
}

export type PharmacyEventName = keyof PharmacyEventMap;
export type PharmacyEventPayload<T extends PharmacyEventName> = PharmacyEventMap[T];

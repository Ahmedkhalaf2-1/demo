import Dexie, { type Table } from 'dexie';
import type {
  User,
  Product,
  Batch,
  Inventory,
  Patient,
  Prescription,
  Sale,
  SaleItem,
  Settings,
  AuditLog,
  Refund,
  RefundItem,
  Purchase,
  PurchaseItem,
} from '../types';

export class PharmacyDatabase extends Dexie {
  users!: Table<User, string>;
  products!: Table<Product, string>;
  batches!: Table<Batch, string>;
  inventory!: Table<Inventory, string>;
  patients!: Table<Patient, string>;
  prescriptions!: Table<Prescription, string>;
  sales!: Table<Sale, string>;
  sale_items!: Table<SaleItem, string>;
  settings!: Table<Settings, string>;
  audit_logs!: Table<AuditLog, string>;
  refunds!: Table<Refund, string>;
  refund_items!: Table<RefundItem, string>;
  purchases!: Table<Purchase, string>;
  purchase_items!: Table<PurchaseItem, string>;

  constructor() {
    super('PharmacyDB');

    this.version(1).stores({
      users: 'id, role',
      products: 'id, barcode, category, name',
      batches: 'id, productId, expiryDate',
      inventory: 'id, productId',
      patients: 'id, phone, name',
      prescriptions: 'id, patientId, status',
      sales: 'id, patientId, createdAt, status',
      sale_items: 'id, saleId, productId',
    });

    this.version(2).stores({
      prescriptions: 'id, patientId, status, createdAt',
    });

    this.version(3).stores({
      settings: 'id',
      audit_logs: 'id, action, entity, timestamp',
    });

    this.version(4).stores({
      refunds: 'id, originalSaleId, createdAt',
      refund_items: 'id, refundId, saleItemId, batchId, productId',
    });

    this.version(5).stores({
      purchases: 'id, supplierName, createdAt',
      purchase_items: 'id, purchaseId, productId',
    });
  }
}

export const db = new PharmacyDatabase();

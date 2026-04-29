// ─── Core Entity Types ────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'pharmacist' | 'cashier';
export type PaymentMethod = 'cash' | 'card' | 'insurance';
export type SaleStatus = 'completed' | 'refunded' | 'pending';
export type PrescriptionStatus = 'pending' | 'dispensed' | 'expired';
export type ProductCategory =
  | 'أدوية عامة'
  | 'مضادات حيوية'
  | 'مسكنات'
  | 'فيتامينات'
  | 'أدوية قلب'
  | 'أدوية سكر'
  | 'أدوية ضغط'
  | 'مستلزمات طبية'
  | 'مستحضرات تجميل'
  | 'أخرى';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  passcodeHash: string;
  isActive: boolean;
  permissions: {
    canSell: boolean;
    canEditPrice: boolean;
    canViewReports: boolean;
    canManageInventory: boolean;
    canManageUsers: boolean;
    canAccessSettings: boolean;
    canViewDashboard: boolean;
  };
  avatar?: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  barcode: string;
  category: ProductCategory;
  unitPrice: number;   // selling price
  costPrice: number;   // purchase cost
  unit: string;        // e.g. "حبة", "علبة", "زجاجة"
  description: string;
  requiresPrescription: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Batch {
  id: string;
  productId: string;
  lotNumber: string;
  expiryDate: string;    // ISO date string YYYY-MM-DD
  manufactureDate: string;
  quantity: number;      // original received quantity
  remaining: number;     // current remaining
  costPerUnit: number;
  receivedAt: string;
}

export interface Inventory {
  id: string;
  productId: string;
  totalQuantity: number; // sum of all valid batch remainders
  minStock: number;
  updatedAt: string;
}

export interface Patient {
  id: string;
  name: string;
  phone: string;
  dateOfBirth: string;
  gender: 'male' | 'female';
  address: string;
  notes: string;
  createdAt: string;
}

export interface PrescriptionMedication {
  productId: string;
  productName: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
}

export interface Prescription {
  id: string;
  patientId: string;
  doctorName: string;
  issuedDate: string;
  expiryDate: string;
  medications: PrescriptionMedication[];
  status: PrescriptionStatus;
  linkedSaleId?: string;
  notes: string;
  createdAt: string;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  productName: string;
  batchId: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  discount: number;    // percentage 0-100
  total: number;       // quantity * unitPrice * (1 - discount/100)
  profit: number;      // (unitPrice - costPrice) * quantity * (1 - discount/100)
}

export interface Sale {
  id: string;
  patientId?: string;
  patientName?: string;
  prescriptionId?: string;
  items: SaleItem[];
  subtotal: number;
  discountTotal: number;
  total: number;
  profit: number;
  paymentMethod: PaymentMethod;
  status: SaleStatus;
  notes: string;
  createdAt: string;
  dateKey?: string;   // local YYYY-MM-DD — set at creation for timezone-safe filtering
}

// ─── Cart (POS in-memory) ─────────────────────────────────────────────────────

export interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  discount: number;
  availableStock: number;
}

// ─── Report Types ─────────────────────────────────────────────────────────────

export interface DailySalesSummary {
  date: string;
  totalSales: number;
  totalRevenue: number;
  totalProfit: number;
}

export interface ProductSalesSummary {
  productId: string;
  productName: string;
  totalQuantity: number;
  totalRevenue: number;
  totalProfit: number;
}

export interface Settings {
  id: string; // usually 'global'
  pharmacyName: string;
  phone: string;
  address: string;
  currency: string;
  lowStockThreshold: number;
  expiryWarningDays: number;
  enablePrinting: boolean;
  pharmacistName?: string;
  pharmacistAvatar?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  userId?: string;
  timestamp: string;
}

export interface RefundItem {
  id: string;
  refundId: string;
  saleItemId: string;
  productId: string;
  productName: string;
  batchId: string;
  quantity: number;
  unitPrice: number;
  refundTotal: number;
}

export interface Refund {
  id: string;
  originalSaleId: string;
  items: RefundItem[];
  reason: string;
  total: number;
  paymentMethod: PaymentMethod;
  createdAt: string;
  dateKey?: string;  // local YYYY-MM-DD
}

export interface PurchaseItem {
  id: string;
  purchaseId: string;
  productId: string;
  productName: string;
  batchLotNumber: string;
  expiryDate: string;
  manufactureDate: string;
  quantity: number;
  costPerUnit: number;
  totalCost: number;
}

export interface Purchase {
  id: string;
  supplierName: string;
  invoiceNumber: string;
  items: PurchaseItem[];
  totalCost: number;
  notes: string;
  createdAt: string;
  dateKey?: string;  // local YYYY-MM-DD
}

// ─── Notification Types ───────────────────────────────────────────────────────

export type NotificationCategory = 'inventory' | 'expiry' | 'sales' | 'smart';
export type NotificationSeverity = 'low' | 'medium' | 'high';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  isRead: boolean;
  createdAt: string;
  actionableLink?: string;
  recommendation?: string;
}




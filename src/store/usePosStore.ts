import { create } from 'zustand';
// POS Store logic
import { prescriptionService } from '../db/storageService';
import { db } from '../db/database';
import type { CartItem, Sale, SaleItem, PaymentMethod } from '../types';
import { nanoid } from '../utils/id';
import { buildTimestamps } from '../utils/time';
import { eventBus } from '../domain/eventBus';

interface PosState {
  cart: CartItem[];
  patientId: string;
  prescriptionId: string;
  paymentMethod: PaymentMethod;
  notes: string;
  processing: boolean;
  lastSaleId: string | null;

  addToCart: (item: CartItem) => void;
  updateCartItem: (productId: string, qty: number) => void;
  removeFromCart: (productId: string) => void;
  setDiscount: (productId: string, discount: number) => void;
  clearCart: () => void;
  setPatient: (patientId: string) => void;
  setPrescription: (prescriptionId: string) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  setNotes: (notes: string) => void;
  completeSale: (patientName?: string) => Promise<Sale>;
  getCartTotals: () => { subtotal: number; discount: number; total: number; profit: number };
}

export const usePosStore = create<PosState>((set, get) => ({
  cart: [],
  patientId: '',
  prescriptionId: '',
  paymentMethod: 'cash',
  notes: '',
  processing: false,
  lastSaleId: null,

  addToCart: (item) => {
    set((s) => {
      const existing = s.cart.find((c) => c.productId === item.productId);
      if (existing) {
        return {
          cart: s.cart.map((c) =>
            c.productId === item.productId
              ? { ...c, quantity: Math.min(c.quantity + item.quantity, c.availableStock) }
              : c
          ),
        };
      }
      return { cart: [...s.cart, item] };
    });
  },

  updateCartItem: (productId, qty) => {
    set((s) => ({
      cart: s.cart.map((c) =>
        c.productId === productId
          ? { ...c, quantity: Math.max(1, Math.min(qty, c.availableStock)) }
          : c
      ),
    }));
  },

  removeFromCart: (productId) => {
    set((s) => ({ cart: s.cart.filter((c) => c.productId !== productId) }));
  },

  setDiscount: (productId, discount) => {
    set((s) => ({
      cart: s.cart.map((c) =>
        c.productId === productId
          ? { ...c, discount: Math.max(0, Math.min(100, discount)) }
          : c
      ),
    }));
  },

  clearCart: () => {
    set({ cart: [], patientId: '', prescriptionId: '', notes: '', paymentMethod: 'cash' });
  },

  setPatient: (patientId) => set({ patientId }),
  setPrescription: (prescriptionId) => set({ prescriptionId }),
  setPaymentMethod: (method) => set({ paymentMethod: method }),
  setNotes: (notes) => set({ notes }),

  getCartTotals: () => {
    const { cart } = get();
    let subtotal = 0, discountTotal = 0, total = 0, profit = 0;
    cart.forEach((c) => {
      const itemSubtotal = c.unitPrice * c.quantity;
      const itemDiscount = itemSubtotal * (c.discount / 100);
      const itemTotal = itemSubtotal - itemDiscount;
      const itemProfit = (c.unitPrice - c.costPrice) * c.quantity - itemDiscount;
      subtotal += itemSubtotal;
      discountTotal += itemDiscount;
      total += itemTotal;
      profit += itemProfit;
    });
    return { subtotal, discount: discountTotal, total, profit };
  },

  completeSale: async (patientName) => {
    const { cart, patientId, prescriptionId, paymentMethod, notes } = get();
    if (cart.length === 0) throw new Error('السلة فارغة');

    set({ processing: true });
    try {
      const { subtotal, discount, total, profit } = get().getCartTotals();
      const saleId = nanoid();
      const { createdAt: now, dateKey } = buildTimestamps();
      const today = dateKey; // local YYYY-MM-DD, safe across midnight

      // Validate prescription expiry BEFORE entering transaction (fast fail)
      if (prescriptionId) {
        const prescription = await prescriptionService.getById(prescriptionId);
        if (prescription && prescription.expiryDate < today) {
          throw new Error('الوصفة الطبية المرتبطة منتهية الصلاحية ولا يمكن صرفها');
        }
      }

      // allSaleItems is populated inside the transaction
      const allSaleItems: SaleItem[] = [];

      // ━━━ RACE-CONDITION PROOF ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // All FIFO allocation AND all writes happen inside ONE IDB transaction.
      // IndexedDB transactions are serialized within a browser context.
      // A concurrent tab starting the same transaction will block until this
      // one commits or aborts — preventing double-deduction of the same stock.
      // If stock runs out mid-allocation (consumed by another session just before),
      // an error is thrown, Dexie automatically rolls back all writes, and the
      // user receives a clear recovery message.
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      await db.transaction(
        'rw',
        [db.sales, db.sale_items, db.batches, db.inventory, db.prescriptions, db.audit_logs],
        async () => {
          // Phase 1: Allocate batches (FIFO) — reading LIVE DB state inside transaction
          for (const cartItem of cart) {
            const validBatches = await db.batches
              .where('productId').equals(cartItem.productId)
              .filter((b) => b.remaining > 0 && b.expiryDate >= today)
              .sortBy('expiryDate'); // Soonest-to-expire first (FEFO ≡ FIFO for pharmacy)

            let remaining = cartItem.quantity;

            for (const batch of validBatches) {
              if (remaining <= 0) break;
              const take = Math.min(remaining, batch.remaining);
              remaining -= take;

              const sub = cartItem.unitPrice * take;
              const disc = sub * (cartItem.discount / 100);
              allSaleItems.push({
                id: nanoid(),
                saleId,
                productId: cartItem.productId,
                productName: cartItem.productName,
                batchId: batch.id,
                quantity: take,
                unitPrice: cartItem.unitPrice,
                costPrice: cartItem.costPrice,
                discount: cartItem.discount,
                total: sub - disc,
                profit: (cartItem.unitPrice - cartItem.costPrice) * take - disc,
              });

              // Deduct immediately — subsequent reads within this transaction see updated value
              await db.batches.update(batch.id, { remaining: batch.remaining - take });
            }

            if (remaining > 0) {
              // Another concurrent session consumed the stock before us.
              // Throwing here triggers automatic Dexie rollback of ALL writes above.
              throw new Error(
                `نفد المخزون أثناء تسجيل البيع: ${cartItem.productName}. يرجى تحديث الصفحة والمحاولة مجدداً.`
              );
            }
          }

          // Phase 2: Persist sale header + line items
          const sale: Sale = {
            id: saleId,
            patientId: patientId || undefined,
            patientName: patientName || undefined,
            prescriptionId: prescriptionId || undefined,
            items: allSaleItems,
            subtotal, discountTotal: discount, total, profit,
            paymentMethod, status: 'completed', notes,
            createdAt: now,
            dateKey,   // local YYYY-MM-DD — timezone-safe daily filtering
          } satisfies Sale;
          await db.sales.add(sale);
          await db.sale_items.bulkAdd(allSaleItems);

          // Phase 3: Recalculate inventory totals from live batch data
          const uniqueProducts = [...new Set(cart.map((c) => c.productId))];
          for (const productId of uniqueProducts) {
            const batches = await db.batches.where('productId').equals(productId).toArray();
            const newTotal = batches.filter((b) => b.expiryDate >= today).reduce((s, b) => s + b.remaining, 0);
            // Negative stock guard: newTotal can never be negative because we throw above
            const inv = await db.inventory.where('productId').equals(productId).first();
            if (inv) await db.inventory.update(inv.id, { totalQuantity: Math.max(0, newTotal), updatedAt: now });
          }

          // Phase 4: Update linked prescription
          if (prescriptionId) {
            await db.prescriptions.update(prescriptionId, { status: 'dispensed', linkedSaleId: saleId });
          }

          // Phase 5: Audit log
          await db.audit_logs.add({
            id: crypto.randomUUID(),
            action: 'SALE_COMPLETED',
            entity: 'sale',
            entityId: saleId,
            details: `بيع مكتمل — الإجمالي: ${total.toFixed(2)} ج.م — عدد الأصناف: ${allSaleItems.length}`,
            timestamp: now,
          });
        }
      );

      const completedSale: Sale = {
        id: saleId,
        patientId: patientId || undefined,
        patientName: patientName || undefined,
        prescriptionId: prescriptionId || undefined,
        items: allSaleItems,
        subtotal, discountTotal: discount, total, profit,
        paymentMethod, status: 'completed', notes, createdAt: now,
      };

      // ── Emit domain events (after transaction commits) ─────────────────────
      eventBus.emit('sale:created', {
        saleId,
        dateKey,
        total,
        profit,
        itemCount:     allSaleItems.length,
        paymentMethod: String(paymentMethod),
        patientId:     patientId || undefined,
      });

      // Per-item batch allocation events
      for (const item of allSaleItems) {
        eventBus.emit('batch:allocated', {
          batchId:   item.batchId,
          productId: item.productId,
          quantity:  item.quantity,
          saleId,
        });
      }

      // Per-product stock update events
      const uniqueProducts = [...new Set(allSaleItems.map((i) => i.productId))];
      for (const productId of uniqueProducts) {
        const qtyDeducted = allSaleItems
          .filter((i) => i.productId === productId)
          .reduce((s, i) => s + i.quantity, 0);
        const productName = allSaleItems.find((i) => i.productId === productId)?.productName ?? '';
        eventBus.emit('stock:updated', {
          productId,
          productName,
          newQuantity: -1,      // actual value recalculated in transaction; -1 = unknown here
          delta:       -qtyDeducted,
          reason:      'sale',
        });
      }

      set({ processing: false, lastSaleId: saleId });
      get().clearCart();
      return completedSale;
    } catch (e) {
      set({ processing: false });
      throw e;
    }
  },
}));

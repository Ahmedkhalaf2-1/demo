import { create } from 'zustand';
import type { AppNotification, NotificationCategory, NotificationSeverity, Inventory, Product, Sale } from '../types';
import { nanoid } from 'nanoid';

interface NotificationState {
  notifications: AppNotification[];
  toasts: { id: string; title: string; message: string; severity: NotificationSeverity }[];
  addNotification: (notification: Omit<AppNotification, 'id' | 'isRead' | 'createdAt'>) => void;
  addToast: (title: string, message: string, severity: NotificationSeverity) => void;
  removeToast: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  runSmartEngine: (products: Product[], inventory: Inventory[], sales: Sale[], settings: any) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [
    {
      id: 'welcome-alert',
      title: 'أهلاً بك في نظام الإشعارات الذكي',
      message: 'يقوم النظام بمراقبة المخزون والمبيعات لتزويدك بتحليلات استباقية دورية.',
      category: 'smart',
      severity: 'low',
      isRead: false,
      createdAt: new Date().toISOString(),
    }
  ],
  toasts: [],

  addNotification: (notif) => {
    const id = nanoid();
    const newNotif: AppNotification = {
      ...notif,
      id,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    set((state) => {
      // Avoid exact duplicate messages in the center within 12 hours
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
      const exists = state.notifications.some(n => 
        n.message === notif.message && 
        new Date(n.createdAt) >= twelveHoursAgo
      );
      if (exists) return state;

      return {
        notifications: [newNotif, ...state.notifications],
        toasts: [...state.toasts, { id, title: notif.title, message: notif.message, severity: notif.severity }]
      };
    });
  },

  addToast: (title, message, severity) => {
    const id = nanoid();
    set((state) => ({
      toasts: [...state.toasts, { id, title, message, severity }]
    }));
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter(t => t.id !== id)
    }));
  },

  markAsRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      ),
    }));
  },

  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
    }));
  },

  runSmartEngine: (products, inventory, sales, settings) => {
    const lowStockLimit = settings?.lowStockThreshold || 10;
    const warningDays = settings?.expiryWarningDays || 30;

    // 1. Check Low Stock Thresholds
    inventory.forEach((inv) => {
      if (inv.totalQuantity <= inv.minStock || inv.totalQuantity <= lowStockLimit) {
        const prod = products.find(p => p.id === inv.productId);
        if (prod) {
          get().addNotification({
            title: 'تنبيه: مخزون منخفض',
            message: `وصل المنتج "${prod.name}" إلى الحد الحرج للمخزون (${inv.totalQuantity} وحدة متبقية).`,
            category: 'inventory',
            severity: 'high',
            recommendation: `الطلب المقترح: 50-100 وحدة لسد العجز التشغيلي`
          });
        }
      }
    });

    // 2. Sales Velocity & Predictive Demand
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    products.forEach((prod) => {
      // Calculate sales over the last 30 days
      const prodSales = sales.filter(s => 
        new Date(s.createdAt) >= thirtyDaysAgo && 
        s.items.some(item => item.productId === prod.id)
      );

      const totalQtySold = prodSales.reduce((sum, sale) => {
        const item = sale.items.find(i => i.productId === prod.id);
        return sum + (item?.quantity || 0);
      }, 0);

      const velocity = totalQtySold / 30; // units per day

      if (velocity > 0.5) { // Sells frequently
        const currentStock = inventory.find(i => i.productId === prod.id)?.totalQuantity || 0;
        const daysRemaining = velocity > 0 ? Math.floor(currentStock / velocity) : 999;

        if (daysRemaining <= 7 && currentStock > 0) {
          const suggestedOrder = Math.ceil(velocity * 30);
          get().addNotification({
            title: `تنبيه: قرب نفاد "${prod.name}"`,
            message: `بناءً على معدل المبيعات، من المتوقع نفاد الكمية بالكامل خلال ${daysRemaining} أيام.`,
            category: 'smart',
            severity: 'medium',
            recommendation: `نقترح طلب ${suggestedOrder} وحدة فوراً لتغطية الـ 30 يوماً القادمة.`
          });
        }
      }
    });
  }
}));

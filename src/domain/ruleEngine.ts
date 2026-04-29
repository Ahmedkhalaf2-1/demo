import { getLocalDateKey } from '../utils/time';

export interface PolicyRule {
  id: string;
  name: string;
  evaluate: (context: any) => { passed: boolean; riskLevel: 'low' | 'medium' | 'high'; reason?: string };
}

export const ruleEngine = {
  evaluateSale: (cart: any[], validBatches: any[]) => {
    // Check stock depletion
    const totalRequired  = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalAvailable = validBatches.reduce((sum, b) => sum + b.remaining, 0);

    if (totalRequired > totalAvailable) {
      return { passed: false, riskLevel: 'high' as const, reason: 'مجموع الكميات المطلوبة يتجاوز المخزون الفعلي المتاح' };
    }

    // Check expiry threshold (14 days) — use local dateKey to avoid UTC offset bug
    const criticalDays = 14;
    const criticalDate = new Date();
    criticalDate.setDate(criticalDate.getDate() + criticalDays);
    const criticalKey = getLocalDateKey(criticalDate);

    const hasCriticalExpiry = validBatches.some((b) => b.expiryDate <= criticalKey);
    if (hasCriticalExpiry) {
      return { passed: true, riskLevel: 'medium' as const, reason: 'بعض الدفعات في السلة قاربت على الانتهاء (أقل من أسبوعين)' };
    }

    return { passed: true, riskLevel: 'low' as const };
  },
};


import { create } from 'zustand';

export interface CashboxTransaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  createdAt: string;
}

export interface DailyBalance {
  date: string; // YYYY-MM-DD
  openingBalance: number;
}

interface AccountingState {
  transactions: CashboxTransaction[];
  dailyBalances: DailyBalance[];
  
  addTransaction: (type: 'income' | 'expense', amount: number, description: string) => void;
  deleteTransaction: (id: string) => void;
  setOpeningBalance: (date: string, amount: number) => void;
  getDailyAccounting: (date: string, totalSales: number) => {
    openingBalance: number;
    totalSales: number;
    totalIncome: number;
    totalExpenses: number;
    closingBalance: number;
  };
}

export const useAccountingStore = create<AccountingState>((set, get) => ({
  transactions: JSON.parse(localStorage.getItem('pharma_accounting_txs') || '[]'),
  dailyBalances: JSON.parse(localStorage.getItem('pharma_accounting_balances') || '[]'),

  addTransaction: (type, amount, description) => {
    const newTx: CashboxTransaction = {
      id: crypto.randomUUID(),
      type,
      amount,
      description,
      createdAt: new Date().toISOString()
    };
    const updated = [...get().transactions, newTx];
    localStorage.setItem('pharma_accounting_txs', JSON.stringify(updated));
    set({ transactions: updated });
  },

  deleteTransaction: (id) => {
    const updated = get().transactions.filter(t => t.id !== id);
    localStorage.setItem('pharma_accounting_txs', JSON.stringify(updated));
    set({ transactions: updated });
  },

  setOpeningBalance: (date, amount) => {
    const exists = get().dailyBalances.some(b => b.date === date);
    let updated;
    if (exists) {
      updated = get().dailyBalances.map(b => b.date === date ? { ...b, openingBalance: amount } : b);
    } else {
      updated = [...get().dailyBalances, { date, openingBalance: amount }];
    }
    localStorage.setItem('pharma_accounting_balances', JSON.stringify(updated));
    set({ dailyBalances: updated });
  },

  getDailyAccounting: (date, totalSales) => {
    const txs = get().transactions.filter(t => t.createdAt.startsWith(date));
    const income = txs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = txs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    
    const balanceObj = get().dailyBalances.find(b => b.date === date);
    const openingBalance = balanceObj ? balanceObj.openingBalance : 0;
    const closingBalance = openingBalance + totalSales + income - expenses;

    return {
      openingBalance,
      totalSales,
      totalIncome: income,
      totalExpenses: expenses,
      closingBalance
    };
  }
}));

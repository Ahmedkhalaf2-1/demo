import { create } from 'zustand';
import { prescriptionService } from '../db/storageService';
import type { Prescription } from '../types';
import { nanoid } from '../utils/id';
import { getLocalDateKey, getNowISO } from '../utils/time';

interface PrescriptionState {
  prescriptions: Prescription[];
  loading: boolean;
  loadAll: () => Promise<void>;
  hydrate: (prescriptions: Prescription[]) => Promise<void>;
  addPrescription: (data: Omit<Prescription, 'id' | 'createdAt'>) => Promise<Prescription>;
  updatePrescription: (id: string, data: Partial<Prescription>) => Promise<void>;
  deletePrescription: (id: string) => Promise<void>;
  getByPatient: (patientId: string) => Prescription[];
}

export const usePrescriptionStore = create<PrescriptionState>((set, get) => ({
  prescriptions: [],
  loading: false,

  loadAll: async () => {
    set({ loading: true });
    const prescriptions = await prescriptionService.getAll();
    const today = getLocalDateKey();
    const toExpire = prescriptions.filter(
      (p) => p.status === 'pending' && p.expiryDate < today
    );
    if (toExpire.length > 0) {
      await Promise.all(
        toExpire.map((p) =>
          prescriptionService.update(p.id, { status: 'expired' })
        )
      );
    }
    const updated = prescriptions.map((p) =>
      p.status === 'pending' && p.expiryDate < today
        ? { ...p, status: 'expired' as const }
        : p
    );
    set({ prescriptions: updated, loading: false });
  },

  hydrate: async (prescriptions) => {
    const today = getLocalDateKey();
    const updated = prescriptions.map((p) =>
      p.status === 'pending' && p.expiryDate < today
        ? { ...p, status: 'expired' as const }
        : p
    );
    set({ prescriptions: updated, loading: false });

    const toExpire = prescriptions.filter(
      (p) => p.status === 'pending' && p.expiryDate < today
    );
    if (toExpire.length > 0) {
      Promise.all(
        toExpire.map((p) =>
          prescriptionService.update(p.id, { status: 'expired' })
        )
      ).catch(console.error);
    }
  },

  addPrescription: async (data) => {
    const prescription: Prescription = {
      ...data,
      id:        nanoid(),
      createdAt: getNowISO(),
    };
    await prescriptionService.add(prescription);
    set((s) => ({ prescriptions: [prescription, ...s.prescriptions] }));
    return prescription;
  },

  updatePrescription: async (id, data) => {
    await prescriptionService.update(id, data);
    set((s) => ({
      prescriptions: s.prescriptions.map((p) =>
        p.id === id ? { ...p, ...data } : p
      ),
    }));
  },

  deletePrescription: async (id) => {
    await prescriptionService.delete(id);
    set((s) => ({
      prescriptions: s.prescriptions.filter((p) => p.id !== id),
    }));
  },

  getByPatient: (patientId) =>
    get().prescriptions.filter((p) => p.patientId === patientId),
}));

import { create } from 'zustand';
import { patientService } from '../db/storageService';
import type { Patient } from '../types';
import { nanoid } from '../utils/id';

interface PatientState {
  patients: Patient[];
  loading: boolean;
  loadAll: () => Promise<void>;
  hydrate: (patients: Patient[]) => void;
  addPatient: (data: Omit<Patient, 'id' | 'createdAt'>) => Promise<Patient>;
  updatePatient: (id: string, data: Partial<Patient>) => Promise<void>;
  deletePatient: (id: string) => Promise<void>;
  search: (q: string) => Patient[];
}

export const usePatientStore = create<PatientState>((set, get) => ({
  patients: [],
  loading: false,

  loadAll: async () => {
    set({ loading: true });
    const patients = await patientService.getAll();
    set({ patients, loading: false });
  },

  hydrate: (patients) => {
    set({ patients, loading: false });
  },

  addPatient: async (data) => {
    const patient: Patient = { ...data, id: nanoid(), createdAt: new Date().toISOString() };
    await patientService.add(patient);
    set((s) => ({ patients: [...s.patients, patient] }));
    return patient;
  },

  updatePatient: async (id, data) => {
    await patientService.update(id, data);
    set((s) => ({
      patients: s.patients.map((p) => (p.id === id ? { ...p, ...data } : p)),
    }));
  },

  deletePatient: async (id) => {
    await patientService.delete(id);
    set((s) => ({ patients: s.patients.filter((p) => p.id !== id) }));
  },

  search: (q) => {
    if (!q) return get().patients;
    const lower = q.toLowerCase();
    return get().patients.filter(
      (p) => p.name.toLowerCase().includes(lower) || p.phone.includes(q)
    );
  },
}));

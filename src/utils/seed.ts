import { db } from '../db/database';
import { nanoid } from './id';
import type { Product, Batch, Patient, Prescription } from '../types';

const today = new Date();
const addMonths = (date: Date, months: number) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
};
const addDays = (date: Date, days: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

export const seedDatabase = async () => {
  const [prodCount, salesCount, batchCount, invCount, patientCount, rxCount] = await Promise.all([
    db.products.count(),
    db.sales.count(),
    db.batches.count(),
    db.inventory.count(),
    db.patients.count(),
    db.prescriptions.count(),
  ]);

  if (prodCount > 0 || salesCount > 0 || batchCount > 0 || invCount > 0 || patientCount > 0 || rxCount > 0) {
    return; // database is not completely empty
  }

  // ── Products ────────────────────────────────────────────────────────────────
  const products: Product[] = [
    {
      id: nanoid(), name: 'أموكسيسيللين 500مج', barcode: '6001001001',
      category: 'مضادات حيوية', unitPrice: 45, costPrice: 28,
      unit: 'علبة', description: 'مضاد حيوي واسع الطيف',
      requiresPrescription: true,
      createdAt: today.toISOString(), updatedAt: today.toISOString(),
    },
    {
      id: nanoid(), name: 'باراسيتامول 500مج', barcode: '6001001002',
      category: 'مسكنات', unitPrice: 12, costPrice: 6,
      unit: 'علبة', description: 'مسكن للآلام وخافض للحرارة',
      requiresPrescription: false,
      createdAt: today.toISOString(), updatedAt: today.toISOString(),
    },
    {
      id: nanoid(), name: 'فيتامين سي 1000مج', barcode: '6001001003',
      category: 'فيتامينات', unitPrice: 55, costPrice: 35,
      unit: 'علبة', description: 'فيتامين C لتقوية المناعة',
      requiresPrescription: false,
      createdAt: today.toISOString(), updatedAt: today.toISOString(),
    },
    {
      id: nanoid(), name: 'أتورفاستاتين 20مج', barcode: '6001001004',
      category: 'أدوية قلب', unitPrice: 85, costPrice: 55,
      unit: 'علبة', description: 'خافض للكوليسترول',
      requiresPrescription: true,
      createdAt: today.toISOString(), updatedAt: today.toISOString(),
    },
    {
      id: nanoid(), name: 'ميتفورمين 500مج', barcode: '6001001005',
      category: 'أدوية سكر', unitPrice: 25, costPrice: 14,
      unit: 'علبة', description: 'علاج داء السكري من النوع الثاني',
      requiresPrescription: true,
      createdAt: today.toISOString(), updatedAt: today.toISOString(),
    },
    {
      id: nanoid(), name: 'لوسارتان 50مج', barcode: '6001001006',
      category: 'أدوية ضغط', unitPrice: 65, costPrice: 40,
      unit: 'علبة', description: 'خافض ضغط الدم',
      requiresPrescription: true,
      createdAt: today.toISOString(), updatedAt: today.toISOString(),
    },
    {
      id: nanoid(), name: 'أوميبرازول 20مج', barcode: '6001001007',
      category: 'أدوية عامة', unitPrice: 35, costPrice: 20,
      unit: 'علبة', description: 'علاج قرحة المعدة وارتداد الحمض',
      requiresPrescription: false,
      createdAt: today.toISOString(), updatedAt: today.toISOString(),
    },
    {
      id: nanoid(), name: 'سيتريزين 10مج', barcode: '6001001008',
      category: 'أدوية عامة', unitPrice: 18, costPrice: 10,
      unit: 'علبة', description: 'مضاد للحساسية',
      requiresPrescription: false,
      createdAt: today.toISOString(), updatedAt: today.toISOString(),
    },
    {
      id: nanoid(), name: 'إيبوبروفين 400مج', barcode: '6001001009',
      category: 'مسكنات', unitPrice: 15, costPrice: 8,
      unit: 'علبة', description: 'مضاد للالتهابات ومسكن للآلام',
      requiresPrescription: false,
      createdAt: today.toISOString(), updatedAt: today.toISOString(),
    },
    {
      id: nanoid(), name: 'كلاريثروميسين 500مج', barcode: '6001001010',
      category: 'مضادات حيوية', unitPrice: 120, costPrice: 80,
      unit: 'علبة', description: 'مضاد حيوي لعلاج التهابات الجهاز التنفسي',
      requiresPrescription: true,
      createdAt: today.toISOString(), updatedAt: today.toISOString(),
    },
  ];

  await db.products.bulkAdd(products);

  // ── Batches ─────────────────────────────────────────────────────────────────
  const batches: Batch[] = products.map((p, i) => ({
    id: nanoid(),
    productId: p.id,
    lotNumber: `LOT-2024-${String(i + 1).padStart(3, '0')}`,
    manufactureDate: addMonths(today, -6),
    expiryDate: i === 2
      ? addDays(today, 15)  // 3rd product expiring soon for demo
      : addMonths(today, 18),
    quantity: 100,
    remaining: i === 1 ? 5 : 50 + i * 5, // paracetamol low stock
    costPerUnit: p.costPrice,
    receivedAt: today.toISOString(),
  }));

  await db.batches.bulkAdd(batches);

  // ── Inventory ───────────────────────────────────────────────────────────────
  const inventories = products.map((p, i) => ({
    id: nanoid(),
    productId: p.id,
    totalQuantity: i === 1 ? 5 : 50 + i * 5,
    minStock: 10,
    updatedAt: today.toISOString(),
  }));

  await db.inventory.bulkAdd(inventories);

  // ── Patients ─────────────────────────────────────────────────────────────────
  const patients: Patient[] = [
    {
      id: nanoid(), name: 'أحمد محمد علي', phone: '0501234567',
      dateOfBirth: '1985-03-15', gender: 'male',
      address: 'الرياض، حي النزهة', notes: 'يعاني من ضغط الدم',
      createdAt: today.toISOString(),
    },
    {
      id: nanoid(), name: 'فاطمة حسن إبراهيم', phone: '0559876543',
      dateOfBirth: '1990-07-22', gender: 'female',
      address: 'جدة، حي الروضة', notes: 'مريضة سكري',
      createdAt: today.toISOString(),
    },
    {
      id: nanoid(), name: 'عمر خالد السعيد', phone: '0531122334',
      dateOfBirth: '1978-11-08', gender: 'male',
      address: 'الدمام، حي الفيصلية', notes: '',
      createdAt: today.toISOString(),
    },
  ];

  await db.patients.bulkAdd(patients);

  // ── Prescriptions ─────────────────────────────────────────────────────────
  const prescriptions: Prescription[] = [
    {
      id: nanoid(),
      patientId: patients[0].id,
      doctorName: 'د. سامي الأحمد',
      issuedDate: addDays(today, -5),
      expiryDate: addDays(today, 25),
      medications: [
        {
          productId: products[5].id,
          productName: products[5].name,
          dosage: '50 مج',
          frequency: 'مرة يومياً',
          duration: 'شهر',
          quantity: 1,
        },
      ],
      status: 'pending',
      notes: 'مراجعة بعد شهر',
      createdAt: today.toISOString(),
    },
    {
      id: nanoid(),
      patientId: patients[1].id,
      doctorName: 'د. ليلى العمري',
      issuedDate: addDays(today, -3),
      expiryDate: addDays(today, 27),
      medications: [
        {
          productId: products[4].id,
          productName: products[4].name,
          dosage: '500 مج',
          frequency: 'مرتين يومياً',
          duration: 'ثلاثة أشهر',
          quantity: 3,
        },
      ],
      status: 'pending',
      notes: '',
      createdAt: today.toISOString(),
    },
  ];

  await db.prescriptions.bulkAdd(prescriptions);
};

import React, { useEffect, useState } from 'react';
import { Plus, Search, Trash2, Eye, FileText } from 'lucide-react';
import { usePrescriptionStore } from '../store/usePrescriptionStore';
import { usePatientStore } from '../store/usePatientStore';
import { useInventoryStore } from '../store/useInventoryStore';
import { Modal } from '../components/shared/Modal';
import type { Prescription, PrescriptionMedication } from '../types';
import { nanoid } from '../utils/id';
import { getLocalDateKey } from '../utils/time';
import { differenceInDays } from 'date-fns';

const emptyForm = (): Omit<Prescription, 'id' | 'createdAt'> => ({
  patientId: '',
  doctorName: '',
  issuedDate: getLocalDateKey(),  // local timezone, not UTC
  expiryDate: '',
  medications: [],
  status: 'pending',
  notes: '',
});

const emptyMed = (): PrescriptionMedication => ({
  productId: '', productName: '', dosage: '', frequency: '', duration: '', quantity: 1,
});

const statusLabel: Record<string, string> = {
  pending: 'معلق',
  dispensed: 'تم الصرف',
  expired: 'منتهي',
};

export const Prescriptions: React.FC = () => {
  const { prescriptions, loadAll, addPrescription, deletePrescription } = usePrescriptionStore();
  const { patients, loadAll: loadPatients } = usePatientStore();
  const { products, loadAll: loadProducts } = useInventoryStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedRx, setSelectedRx] = useState<Prescription | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [activeKPI, setActiveKPI] = useState<'ACTIVE' | 'EXPIRED' | 'TODAY' | 'NEAR' | null>(null);

  useEffect(() => {
    loadAll();
    loadPatients();
    loadProducts();
  }, []);

  const filtered = prescriptions.filter((rx) => {
    const patient = patients.find((p) => p.id === rx.patientId);
    const matchSearch = !search || (patient?.name.includes(search) ?? false) || rx.doctorName.includes(search);
    const matchStatus = !statusFilter || rx.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleAddMed = () => {
    setForm((f) => ({ ...f, medications: [...f.medications, emptyMed()] }));
  };

  const handleUpdateMed = (index: number, key: keyof PrescriptionMedication, value: any) => {
    setForm((f) => {
      const meds = [...f.medications];
      if (key === 'productId') {
        const product = products.find((p) => p.id === value);
        meds[index] = { ...meds[index], productId: value, productName: product?.name ?? '' };
      } else {
        (meds[index] as any)[key] = value;
      }
      return { ...f, medications: meds };
    });
  };

  const handleRemoveMed = (index: number) => {
    setForm((f) => ({ ...f, medications: f.medications.filter((_, i) => i !== index) }));
  };

  const handleSave = async () => {
    const newErrors: Record<string, boolean> = {};
    if (!form.patientId) newErrors.patientId = true;
    if (!form.doctorName) newErrors.doctorName = true;
    if (!form.expiryDate) newErrors.expiryDate = true;
    if (form.medications.length === 0) newErrors.medications = true;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    await addPrescription(form);
    setShowModal(false);
    setForm(emptyForm());
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الوصفة؟')) return;
    await deletePrescription(id);
  };

  const setField = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div>
      {/* KPI Details Modal */}
      {activeKPI && (
        <Modal
          open={activeKPI !== null}
          onClose={() => setActiveKPI(null)}
          title={
            activeKPI === 'ACTIVE' ? 'روشتات نشطة' :
              activeKPI === 'EXPIRED' ? 'روشتات منتهية' :
                activeKPI === 'TODAY' ? 'روشتات اليوم' :
                  'قريبة الانتهاء'
          }
          size="lg"
        >
          <div className="table-wrap" style={{ maxHeight: 400, overflowY: 'auto' }}>
            <table className="table">
              <thead>
                <tr style={{ background: 'var(--surface-hover)', position: 'sticky', top: 0, zIndex: 10, fontSize: '13px' }}>
                  <th style={{ textAlign: 'right', padding: '12px 16px' }}>المريض</th>
                  <th style={{ textAlign: 'center', padding: '12px 16px' }}>الطبيب</th>
                  <th style={{ textAlign: 'center', padding: '12px 16px' }}>تاريخ الانتهاء</th>
                </tr>
              </thead>
              <tbody>
                {prescriptions
                  .filter(rx => {
                    const daysLeft = differenceInDays(new Date(rx.expiryDate), new Date());
                    if (activeKPI === 'ACTIVE') return rx.status === 'pending';
                    if (activeKPI === 'EXPIRED') return rx.status === 'expired' || daysLeft < 0;
                    if (activeKPI === 'TODAY') return rx.issuedDate === new Date().toISOString().split('T')[0];
                    if (activeKPI === 'NEAR') return rx.status === 'pending' && daysLeft >= 0 && daysLeft <= 7;
                    return true;
                  })
                  .map(rx => (
                    <tr key={rx.id} style={{ transition: 'all 150ms ease', borderBottom: '1px solid var(--border)' }} className="inventory-row-hover">
                      <td style={{ textAlign: 'right', padding: '14px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>{patients.find(p => p.id === rx.patientId)?.name || '—'}</td>
                      <td style={{ textAlign: 'center', padding: '14px 16px', color: 'var(--text-secondary)' }}>{rx.doctorName}</td>
                      <td style={{ textAlign: 'center', padding: '14px 16px', color: 'var(--danger)', fontWeight: 700 }}>{rx.expiryDate}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}



      {/* Actionable KPI Widgets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 24 }}>
        {/* نشطة */}
        <div 
          onClick={() => setActiveKPI('ACTIVE')}
          style={{ 
            background: 'var(--surface)', 
            border: '1px solid var(--border)', 
            borderRadius: '16px', 
            padding: '24px', 
            display: 'flex', 
            flexDirection: 'column',
            gap: 6,
            textAlign: 'right',
            boxShadow: 'var(--shadow-sm)', 
            cursor: 'pointer' 
          }}
        >
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>نشطة</span>
          <span style={{ fontSize: '32px', fontWeight: 800, color: '#ca8a04' }}>
            {prescriptions.filter(rx => rx.status === 'pending').length}
          </span>
        </div>

        {/* منتهية */}
        <div 
          onClick={() => setActiveKPI('EXPIRED')}
          style={{ 
            background: 'var(--surface)', 
            border: '1px solid var(--border)', 
            borderRadius: '16px', 
            padding: '24px', 
            display: 'flex', 
            flexDirection: 'column',
            gap: 6,
            textAlign: 'right',
            boxShadow: 'var(--shadow-sm)', 
            cursor: 'pointer' 
          }}
        >
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>منتهية</span>
          <span style={{ fontSize: '32px', fontWeight: 800, color: 'var(--danger)' }}>
            {prescriptions.filter(rx => rx.status === 'expired' || differenceInDays(new Date(rx.expiryDate), new Date()) < 0).length}
          </span>
        </div>

        {/* اليوم */}
        <div 
          onClick={() => setActiveKPI('TODAY')}
          style={{ 
            background: 'var(--surface)', 
            border: '1px solid var(--border)', 
            borderRadius: '16px', 
            padding: '24px', 
            display: 'flex', 
            flexDirection: 'column',
            gap: 6,
            textAlign: 'right',
            boxShadow: 'var(--shadow-sm)', 
            cursor: 'pointer' 
          }}
        >
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>اليوم</span>
          <span style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {prescriptions.filter(rx => rx.issuedDate === new Date().toISOString().split('T')[0]).length}
          </span>
        </div>

        {/* قريبة الانتهاء */}
        <div 
          onClick={() => setActiveKPI('NEAR')}
          style={{ 
            background: 'var(--surface)', 
            border: '1px solid var(--border)', 
            borderRadius: '16px', 
            padding: '24px', 
            display: 'flex', 
            flexDirection: 'column',
            gap: 6,
            textAlign: 'right',
            boxShadow: 'var(--shadow-sm)', 
            cursor: 'pointer' 
          }}
        >
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>قريبة الانتهاء</span>
          <span style={{ fontSize: '32px', fontWeight: 800, color: '#ca8a04' }}>
            {prescriptions.filter(rx => rx.status === 'pending' && differenceInDays(new Date(rx.expiryDate), new Date()) >= 0 && differenceInDays(new Date(rx.expiryDate), new Date()) <= 7).length}
          </span>
        </div>
      </div>

      {/* Search + Action Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
        <div style={{ flex: 1, maxWidth: '400px', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input 
            className="form-input" 
            placeholder="ابحث باسم المريض أو رقم الروشتة..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingRight: '44px', paddingLeft: '16px', paddingTop: '12px', paddingBottom: '12px', borderRadius: '30px', border: '1px solid var(--border)', width: '100%', fontSize: '14px', background: 'var(--surface)', color: 'var(--text-primary)' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <select
            className="form-input form-select"
            style={{ width: 160, height: '40px', padding: '0 12px', fontSize: '13.5px', background: 'var(--surface)', borderRadius: '30px', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">جميع الحالات</option>
            <option value="pending">معلقة</option>
            <option value="dispensed">تم الصرف</option>
            <option value="expired">منتهية</option>
          </select>

          <button 
            onClick={() => { setForm(emptyForm()); setShowModal(true); }}
            style={{ background: 'var(--accent)', color: '#111827', border: 'none', padding: '10px 20px', borderRadius: '30px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '14px' }}
          >
            <Plus size={18} /> إضافة روشتة
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card card-table" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 350px)', overflowY: 'auto' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--surface-hover)', borderBottom: '1px solid var(--border)' }}>
              <tr>
                <th style={{ textAlign: 'right', padding: '14px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>المريض</th>
                <th style={{ textAlign: 'center', padding: '14px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>الطبيب</th>
                <th style={{ textAlign: 'center', padding: '14px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>تاريخ الإصدار</th>
                <th style={{ textAlign: 'center', padding: '14px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>تاريخ الانتهاء</th>
                <th style={{ textAlign: 'center', padding: '14px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>الأدوية</th>
                <th style={{ textAlign: 'center', padding: '14px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>الحالة</th>
                <th style={{ textAlign: 'center', padding: '14px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--text-tertiary)' }}>
                    <div style={{ fontSize: '15px', fontWeight: 600 }}>لا توجد روشتات مسجلة</div>
                  </td>
                </tr>
              ) : (
                filtered.map((rx) => {
                  const patient = patients.find((p) => p.id === rx.patientId);
                  const daysLeft = differenceInDays(new Date(rx.expiryDate), new Date());
                  const isExpiringSoon = rx.status === 'pending' && daysLeft >= 0 && daysLeft <= 7;
                  const isExpired = daysLeft < 0 || rx.status === 'expired';

                  return (
                    <tr
                      key={rx.id}
                      style={{
                        background: isExpired ? 'rgba(239, 68, 68, 0.02)' : isExpiringSoon ? 'rgba(245, 158, 11, 0.02)' : 'transparent',
                        borderBottom: '1px solid var(--border)',
                        transition: 'all 150ms ease',
                        cursor: 'pointer'
                      }}
                      className="inventory-row-hover"
                      onClick={() => { setSelectedRx(rx); setShowDetail(true); }}
                    >
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>{patient?.name ?? '—'}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>{rx.doctorName}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>{rx.issuedDate}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 600, color: isExpired ? 'var(--danger)' : isExpiringSoon ? 'var(--warning)' : 'var(--text-secondary)' }}>
                        {rx.expiryDate}
                        {isExpiringSoon && <span style={{ fontSize: '11px', color: 'var(--warning)', marginRight: '6px' }}>(ينتهي قريباً)</span>}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 700 }}>{rx.medications.length}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        {rx.status === 'dispensed' ? (
                          <span className="badge badge-success">تم الصرف</span>
                        ) : isExpired ? (
                          <span className="badge badge-danger">منتهي</span>
                        ) : (
                          <span className="badge badge-warning">معلق</span>
                        )}
                      </td>
                      <td onClick={(e) => e.stopPropagation()} style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => { setSelectedRx(rx); setShowDetail(true); }} style={{ fontSize: '12px', padding: '6px 12px' }}>عرض</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(rx.id)} style={{ fontSize: '12px', padding: '6px 12px' }}>حذف</button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Prescription Modal */}
      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setErrors({}); }}
        title="روشتة جديدة"
        size="xl"
        footer={
          <>
            <button className="btn btn-primary" onClick={handleSave}>حفظ الروشتة</button>
            <button className="btn btn-ghost" style={{ color: '#64748B' }} onClick={() => { setShowModal(false); setErrors({}); }}>إلغاء</button>
          </>
        }
      >
        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>المريض *</label>
            <select
              className={`form-input form-select ${errors.patientId ? 'input-error' : ''}`}
              value={form.patientId}
              onChange={(e) => setField('patientId', e.target.value)}
            >
              <option value="">اختر المريض</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.phone}</option>)}
            </select>
            {errors.patientId && <div className="error-text">هذا الحقل مطلوب</div>}
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>اسم الطبيب *</label>
            <input
              className={`form-input ${errors.doctorName ? 'input-error' : ''}`}
              value={form.doctorName}
              onChange={(e) => setField('doctorName', e.target.value)}
              placeholder="أدخل اسم الطبيب..."
            />
            {errors.doctorName && <div className="error-text">هذا الحقل مطلوب</div>}
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>تاريخ الإصدار</label>
            <input
              className="form-input"
              type="date"
              value={form.issuedDate}
              onChange={(e) => setField('issuedDate', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>تاريخ الصلاحية *</label>
            <input
              className={`form-input ${errors.expiryDate ? 'input-error' : ''}`}
              type="date"
              value={form.expiryDate}
              onChange={(e) => setField('expiryDate', e.target.value)}
            />
            {errors.expiryDate && <div className="error-text">هذا الحقل مطلوب</div>}
          </div>
        </div>

        {/* Medications */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label className="form-label" style={{ marginBottom: 0, fontWeight: 600, fontSize: '13px' }}>الأدوية المقررة</label>
            <button className="btn btn-secondary btn-sm" onClick={handleAddMed}>
              <Plus size={13} /> إضافة دواء
            </button>
          </div>
          {errors.medications && <div className="error-text" style={{ marginBottom: 8 }}>يرجى إضافة دواء واحد على الأقل</div>}
          {form.medications.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-tertiary)', border: '1px dashed var(--border)', borderRadius: 6, fontSize: 13 }}>
              اضغط "إضافة دواء" لإضافة دواء للروشتة
            </div>
          ) : (
            form.medications.map((med, idx) => (
              <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px', marginBottom: 8 }}>
                <div className="form-grid-2" style={{ marginBottom: 8 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>الدواء</label>
                    <select
                      className="form-input form-select"
                      value={med.productId}
                      onChange={(e) => handleUpdateMed(idx, 'productId', e.target.value)}
                    >
                      <option value="">اختر الدواء</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>الجرعة</label>
                    <input className="form-input" value={med.dosage} onChange={(e) => handleUpdateMed(idx, 'dosage', e.target.value)} placeholder="500 مج" />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 8, alignItems: 'flex-end' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>التكرار</label>
                    <input className="form-input" value={med.frequency} onChange={(e) => handleUpdateMed(idx, 'frequency', e.target.value)} placeholder="مرتان يومياً" />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>المدة</label>
                    <input className="form-input" value={med.duration} onChange={(e) => handleUpdateMed(idx, 'duration', e.target.value)} placeholder="أسبوع" />
                  </div>
                  <button className="btn btn-danger btn-sm" onClick={() => handleRemoveMed(idx)} style={{ marginBottom: 2 }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="form-group">
          <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>ملاحظات</label>
          <textarea
            className="form-input"
            rows={2}
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
            placeholder="تعليمات إضافية..."
            style={{ resize: 'vertical' }}
          />
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal
        open={showDetail}
        onClose={() => setShowDetail(false)}
        title="تفاصيل الروشتة"
        size="lg"
        footer={<button className="btn btn-secondary" onClick={() => setShowDetail(false)}>إغلاق</button>}
      >
        {selectedRx && (() => {
          const patient = patients.find((p) => p.id === selectedRx.patientId);
          return (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16, fontSize: 13.5 }}>
                <div><span className="text-muted">المريض: </span><strong>{patient?.name}</strong></div>
                <div><span className="text-muted">الطبيب: </span><strong>{selectedRx.doctorName}</strong></div>
                <div><span className="text-muted">تاريخ الإصدار: </span>{selectedRx.issuedDate}</div>
                <div><span className="text-muted">تاريخ الانتهاء: </span>{selectedRx.expiryDate}</div>
                <div>
                  <span className="text-muted">الحالة: </span>
                  <span className={`badge ${selectedRx.status === 'pending' ? 'badge-warning' : selectedRx.status === 'dispensed' ? 'badge-success' : 'badge-danger'}`}>
                    {statusLabel[selectedRx.status]}
                  </span>
                </div>
              </div>

              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>الأدوية المقررة</div>
              <table className="table">
                <thead>
                  <tr><th>الدواء</th><th>الجرعة</th><th>التكرار</th><th>المدة</th></tr>
                </thead>
                <tbody>
                  {selectedRx.medications.map((med, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500 }}>{med.productName}</td>
                      <td>{med.dosage}</td>
                      <td>{med.frequency}</td>
                      <td>{med.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {selectedRx.notes && (
                <div style={{ marginTop: 12, background: 'var(--surface-2)', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
                  📝 {selectedRx.notes}
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};

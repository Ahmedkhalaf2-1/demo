import React, { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, User, Phone, Calendar, FileText } from 'lucide-react';
import { usePatientStore } from '../store/usePatientStore';
import { useSalesStore } from '../store/useSalesStore';
import { usePrescriptionStore } from '../store/usePrescriptionStore';
import { Modal } from '../components/shared/Modal';
import type { Patient } from '../types';
import { format } from 'date-fns';

const formatCurrency = (n: number) =>
  n.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 });

const emptyForm = (): Omit<Patient, 'id' | 'createdAt'> => ({
  name: '', phone: '', dateOfBirth: '', gender: 'male', address: '', notes: '',
});

export const Patients: React.FC = () => {
  const { patients, loadAll, addPatient, updatePatient, deletePatient } = usePatientStore();
  const { loadAll: loadSales, sales } = useSalesStore();
  const { loadAll: loadRx, prescriptions } = usePrescriptionStore();

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [editPatient, setEditPatient] = useState<Patient | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [activeKPI, setActiveKPI] = useState<'TOTAL' | 'ACTIVE' | 'TODAY' | 'RX' | null>(null);

  useEffect(() => {
    loadAll();
    loadSales();
    loadRx();
  }, []);

  const filtered = !search
    ? patients
    : patients.filter((p) =>
      p.name.includes(search) || p.phone.includes(search)
    );

  const openAdd = () => { setEditPatient(null); setForm(emptyForm()); setShowModal(true); };
  const openEdit = (p: Patient) => {
    setEditPatient(p);
    setForm({ name: p.name, phone: p.phone, dateOfBirth: p.dateOfBirth, gender: p.gender, address: p.address, notes: p.notes });
    setShowModal(true);
  };
  const openProfile = (p: Patient) => { setSelectedPatient(p); setShowProfile(true); };

  const handleSave = async () => {
    const newErrors: Record<string, boolean> = {};
    if (!form.name) newErrors.name = true;
    if (!form.phone) newErrors.phone = true;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    if (editPatient) {
      await updatePatient(editPatient.id, form);
    } else {
      await addPatient(form);
    }
    setShowModal(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف "${name}"؟`)) return;
    await deletePatient(id);
  };

  const setField = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  // Profile data
  const patientSales = selectedPatient
    ? sales.filter((s) => s.patientId === selectedPatient.id)
    : [];
  const patientRx = selectedPatient
    ? prescriptions.filter((rx) => rx.patientId === selectedPatient.id)
    : [];

  return (
    <div>
      {/* Search Bar matching Inventory.tsx */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
        <div style={{ flex: 1, maxWidth: '400px', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input
            className="form-input"
            placeholder="بحث بالاسم أو رقم الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingRight: '44px', paddingLeft: '16px', paddingTop: '12px', paddingBottom: '12px', borderRadius: '30px', border: '1px solid var(--border)', width: '100%', fontSize: '14px', background: 'var(--surface)', color: 'var(--text-primary)' }}
          />
        </div>
        <button 
          className="btn btn-primary" 
          onClick={openAdd}
          style={{ padding: '12px 24px', borderRadius: '30px', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <Plus size={16} /> إضافة مريض جديد
        </button>
      </div>

      {/* Main Table Card */}
      <div className="card card-table">
        <div className="table-wrap">
          <table className="table table-dense">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>رقم الهاتف</th>
                <th>الجنس</th>
                <th>تاريخ الميلاد</th>
                <th>الزيارات</th>
                <th>إجمالي المشتريات</th>
                <th style={{ textAlign: 'center' }}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr className="loading-row">
                  <td colSpan={7}>لا يوجد مرضى مسجلين حالياً.</td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const pSales = sales.filter((s) => s.patientId === p.id);
                  const totalSpent = pSales.reduce((sum, s) => sum + s.total, 0);
                  return (
                    <tr key={p.id}>
                      <td className="td-primary">
                        <button className="btn btn-ghost" style={{ padding: 0, fontWeight: 700 }} onClick={() => openProfile(p)}>
                          {p.name}
                        </button>
                      </td>
                      <td className="td-secondary">{p.phone}</td>
                      <td className="td-secondary">{p.gender === 'male' ? 'ذكر' : 'أنثى'}</td>
                      <td className="td-secondary">{p.dateOfBirth || '—'}</td>
                      <td className="td-num">{pSales.length}</td>
                      <td className="td-num">{totalSpent > 0 ? formatCurrency(totalSpent) : '—'}</td>
                      <td style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                        <button 
                          onClick={() => openProfile(p)} 
                          title="ملف المريض"
                          style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#ffffff', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 150ms ease' }}
                        >
                          <User size={15} />
                        </button>
                        <button 
                          onClick={() => openEdit(p)} 
                          title="تعديل"
                          style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#ffffff', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 150ms ease' }}
                        >
                          <Edit2 size={15} />
                        </button>
                        <button 
                          onClick={() => handleDelete(p.id, p.name)} 
                          title="حذف"
                          style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#ffffff', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 150ms ease' }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setErrors({}); }}
        title={editPatient ? 'تعديل بيانات المريض' : 'إضافة مريض جديد'}
        size="lg"
        footer={
          <>
            <button className="btn btn-primary" onClick={handleSave}>
              {editPatient ? 'حفظ التعديلات' : 'إضافة المريض'}
            </button>
            <button className="btn btn-ghost" onClick={() => { setShowModal(false); setErrors({}); }}>إلغاء</button>
          </>
        }
      >
        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">الاسم الكامل *</label>
            <input className={`form-input ${errors.name ? 'input-error' : ''}`} value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="الاسم الكامل" />
            {errors.name && <div className="error-text">هذا الحقل مطلوب</div>}
          </div>
          <div className="form-group">
            <label className="form-label">رقم الهاتف *</label>
            <input className={`form-input ${errors.phone ? 'input-error' : ''}`} value={form.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="رقم الهاتف" />
            {errors.phone && <div className="error-text">هذا الحقل مطلوب</div>}
          </div>
          <div className="form-group">
            <label className="form-label">الجنس</label>
            <select className="form-input form-select" value={form.gender} onChange={(e) => setField('gender', e.target.value)}>
              <option value="male">ذكر</option>
              <option value="female">أنثى</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">تاريخ الميلاد</label>
            <input className="form-input" type="date" value={form.dateOfBirth} onChange={(e) => setField('dateOfBirth', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">العنوان</label>
          <input className="form-input" value={form.address} onChange={(e) => setField('address', e.target.value)} placeholder="المدينة، الحي" />
        </div>
        <div className="form-group">
          <label className="form-label">ملاحظات طبية</label>
          <textarea className="form-input" rows={2} value={form.notes} onChange={(e) => setField('notes', e.target.value)} placeholder="أمراض مزمنة، حساسية..." style={{ resize: 'vertical' }} />
        </div>
      </Modal>

      {/* Patient Profile Modal */}
      <Modal
        open={showProfile}
        onClose={() => setShowProfile(false)}
        title={selectedPatient?.name ?? 'ملف المريض'}
        size="xl"
        footer={
          <button className="btn btn-secondary" onClick={() => setShowProfile(false)}>إغلاق</button>
        }
      >
        {selectedPatient && (
          <div>
            {/* Patient meta */}
            <div className="detail-grid" style={{ marginBottom: 16 }}>
              <div>
                <div className="detail-label">رقم الهاتف</div>
                <div className="detail-value flex items-center gap-2"><Phone size={13} /> {selectedPatient.phone}</div>
              </div>
              <div>
                <div className="detail-label">تاريخ الميلاد</div>
                <div className="detail-value flex items-center gap-2"><Calendar size={13} /> {selectedPatient.dateOfBirth || '—'}</div>
              </div>
            </div>

            {selectedPatient.notes && (
              <div className="alert alert-warning" style={{ marginBottom: 14 }}>{selectedPatient.notes}</div>
            )}

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'عدد الزيارات', value: patientSales.length },
                { label: 'إجمالي المشتريات', value: formatCurrency(patientSales.reduce((s, x) => s + x.total, 0)) },
                { label: 'الروشتات', value: patientRx.length },
              ].map(({ label, value }) => (
                <div key={label} className="card-flat" style={{ padding: '10px 14px' }}>
                  <div className="detail-label">{label}</div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Sales */}
            <div style={{ marginBottom: 16 }}>
              <div className="section-header"><span className="section-title">سجل المشتريات</span></div>
              {patientSales.length === 0 ? (
                <div className="text-sm text-muted">لا توجد مشتريات</div>
              ) : (
                <table className="table table-dense">
                  <thead><tr><th>التاريخ</th><th>الأدوية</th><th>الإجمالي</th><th>الدفع</th></tr></thead>
                  <tbody>
                    {patientSales.slice(0, 5).map((s) => (
                      <tr key={s.id}>
                        <td className="td-secondary">{format(new Date(s.createdAt), 'dd/MM/yyyy')}</td>
                        <td className="td-secondary">{s.items.length} دواء</td>
                        <td className="td-num">{formatCurrency(s.total)}</td>
                        <td className="td-secondary">{s.paymentMethod === 'cash' ? 'نقدي' : s.paymentMethod === 'card' ? 'بطاقة' : 'تأمين'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Prescriptions */}
            <div>
              <div className="section-header"><span className="section-title">الروشتات</span></div>
              {patientRx.length === 0 ? (
                <div className="text-sm text-muted">لا توجد روشتات</div>
              ) : (
                <table className="table table-dense">
                  <thead><tr><th>الطبيب</th><th>الإصدار</th><th>الانتهاء</th><th>الحالة</th></tr></thead>
                  <tbody>
                    {patientRx.map((rx) => (
                      <tr key={rx.id}>
                        <td className="td-primary">{rx.doctorName}</td>
                        <td className="td-secondary">{rx.issuedDate}</td>
                        <td className="td-secondary">{rx.expiryDate}</td>
                        <td>
                          <span className={`badge ${rx.status === 'pending' ? 'badge-warning' : rx.status === 'dispensed' ? 'badge-success' : 'badge-danger'}`}>
                            {rx.status === 'pending' ? 'معلق' : rx.status === 'dispensed' ? 'تم الصرف' : 'منتهي'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

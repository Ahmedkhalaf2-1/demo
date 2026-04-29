import React, { useRef, useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useInventoryStore } from '../store/useInventoryStore';
import { useAuthStore, hashPasscode, DEFAULT_PERMISSIONS } from '../store/useAuthStore';
import { Download, Upload, RotateCcw, Database, Info, Settings as SettingsIcon, Save, Printer, FileSpreadsheet, Plus, Lock, Fingerprint, Key } from 'lucide-react';

const PERMISSIONS_LIST = [
  { key: 'canSell', label: 'إتمام البيع' },
  { key: 'canEditPrice', label: 'تعديل الأسعار' },
  { key: 'canViewReports', label: 'عرض التقارير' },
  { key: 'canManageInventory', label: 'إدارة المخزون' },
  { key: 'canManageUsers', label: 'إدارة المستخدمين' },
  { key: 'canAccessSettings', label: 'الوصول للإعدادات' },
  { key: 'canViewDashboard', label: 'عرض لوحة التحكم' },
] as const;

export const Settings: React.FC = () => {
  const { exportData, importData, resetData } = useAppStore();
  const { settings, loadSettings, updateSettings } = useSettingsStore();
  const { products, inventory, loadAll: loadInventory } = useInventoryStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    pharmacyName: '',
    phone: '',
    address: '',
    currency: 'EGP',
    lowStockThreshold: 10,
    expiryWarningDays: 30,
    enablePrinting: true,
    pharmacistName: '',
    pharmacistAvatar: '',
  });

  const { users, currentUser, addUser, updateUser, deleteUser, resetUserPasscode, biometricAvailable, biometricRegistered } = useAuthStore();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<any>(null);
  
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'pharmacist' | 'cashier'>('pharmacist');
  const [newUserPasscode, setNewUserPasscode] = useState('');
  const [newUserPerms, setNewUserPerms] = useState({
    canSell: true, canEditPrice: false, canViewReports: false, canManageInventory: true, canManageUsers: false, canAccessSettings: false, canViewDashboard: true
  });
  
  const [adminPasscodeConfirm, setAdminPasscodeConfirm] = useState('');
  const [actionToConfirm, setActionToConfirm] = useState<() => void>(() => () => {});
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const triggerAdminConfirmation = (action: () => void) => {
    setActionToConfirm(() => action);
    setAdminPasscodeConfirm('');
    setShowConfirmModal(true);
  };

  const handleAdminVerify = async () => {
    const adminHashed = await hashPasscode(adminPasscodeConfirm);
    if (adminHashed === currentUser?.passcodeHash) {
      actionToConfirm();
      setShowConfirmModal(false);
    } else {
      alert('رمز تأكيد المدير غير صحيح');
    }
  };

  const handleCreateUser = () => {
    if (!newUserName || newUserPasscode.length !== 6) {
      alert('الرجاء تعبئة الاسم وإدخال رمز مكون من 6 أرقام');
      return;
    }
    triggerAdminConfirmation(async () => {
      await addUser({
        name: newUserName,
        role: newUserRole,
        isActive: true,
        permissions: { ...DEFAULT_PERMISSIONS[newUserRole], ...newUserPerms }
      }, newUserPasscode);
      alert('تمت إضافة المستخدم بنجاح');
      setShowAddModal(false);
      setNewUserName('');
      setNewUserPasscode('');
    });
  };

  const handleRegisterBiometric = async () => {
    try {
      const challenge = new Uint8Array([1, 2, 3, 4]);
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "Pharma System" },
          user: {
            id: new Uint8Array([1]),
            name: "user@pharma",
            displayName: "Pharmacy User"
          },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }],
          authenticatorSelection: {
            userVerification: "required",
            residentKey: "required",
            requireResidentKey: true
          },
          timeout: 60000
        }
      });

      if (credential) {
        const cred = credential as PublicKeyCredential;
        const base64Id = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
        localStorage.setItem('pharma_webauthn_credential_id', base64Id);
        useAuthStore.getState().setBiometricRegistered(true);
        alert('تم تفعيل البصمة بنجاح');
      }
    } catch (err) {
      console.error('Biometric registration failed:', err);
      alert('فشل تفعيل البصمة. تأكد من دعم الجهاز.');
    }
  };

  const handleUnregisterBiometric = () => {
    useAuthStore.getState().setBiometricRegistered(false);
    alert('تم إلغاء تفعيل البصمة');
  };

  useEffect(() => {
    loadSettings();
    loadInventory();
  }, []);

  useEffect(() => {
    if (settings) {
      setForm({
        pharmacyName: settings.pharmacyName,
        phone: settings.phone,
        address: settings.address,
        currency: settings.currency,
        lowStockThreshold: settings.lowStockThreshold,
        expiryWarningDays: settings.expiryWarningDays,
        enablePrinting: settings.enablePrinting,
        pharmacistName: settings.pharmacistName || '',
        pharmacistAvatar: settings.pharmacistAvatar || '',
      });
    }
  }, [settings]);

  const handleSaveSettings = async () => {
    await updateSettings(form);
    alert('تم حفظ الإعدادات بنجاح');
  };

  const handleExportInventory = () => {
    // Columns: اسم الدواء, الباركود, التصنيف, سعر البيع, سعر التكلفة, الكمية, الحالة, إجراءات
    const csvRows = [
      ['اسم الدواء', 'الباركود', 'التصنيف', 'سعر البيع', 'سعر التكلفة', 'الكمية', 'الحالة', 'إجراءات'],
      ...products.map(p => {
        const inv = inventory.find(i => i.productId === p.id);
        const qty = inv?.totalQuantity ?? 0;
        const minStock = inv?.minStock || 5;
        return [
          p.name,
          p.barcode || 'N/A',
          p.category || 'عام',
          p.unitPrice,
          p.costPrice,
          qty,
          qty === 0 ? 'نفد' : qty <= minStock * 0.5 ? 'حرج' : qty <= minStock ? 'منخفض' : 'طبيعي',
          'متاح'
        ];
      })
    ];

    const csvString = '\ufeff' + csvRows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `inventory_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importData(file);
      alert('تم استيراد البيانات بنجاح. سيتم إعادة تحميل الصفحة.');
      window.location.reload();
    } catch {
      alert('فشل في استيراد البيانات. تأكد من صحة الملف.');
    }
    e.target.value = '';
  };

  const handleReset = async () => {
    if (!confirm('هل أنت متأكد؟ سيتم حذف جميع البيانات وإعادة التعيين إلى البيانات التجريبية.')) return;
    await resetData();
    window.location.reload();
  };

  return (
    <div style={{ maxWidth: 1024, margin: '0 auto', padding: '0 16px' }}>


      {/* 2-Column Grid for Settings Modules */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24, marginBottom: 32 }}>
        
        {/* Card A: الحساب والإعدادات العامة */}
        <div className="card card-p" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 24 }}>
          <div className="card-header" style={{ padding: '0 0 16px', borderBottom: '1px solid var(--border)', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card-title" style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>الحساب والإعدادات العامة</span>
            <Info size={18} color="var(--text-tertiary)" />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
              <span style={{ fontSize: '13.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>اسم المستخدم</span>
              <input 
                className="form-input" 
                value={form.pharmacistName} 
                onChange={(e) => setForm({ ...form, pharmacistName: e.target.value })} 
                style={{ fontSize: '13.5px', color: 'var(--text-primary)', fontWeight: 700, textAlign: 'left', border: 'none', background: 'transparent', width: '50%', padding: 0 }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
              <span style={{ fontSize: '13.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>اسم الصيدلية</span>
              <input 
                className="form-input" 
                value={form.pharmacyName} 
                onChange={(e) => setForm({ ...form, pharmacyName: e.target.value })} 
                style={{ fontSize: '13.5px', color: 'var(--text-primary)', fontWeight: 700, textAlign: 'left', border: 'none', background: 'transparent', width: '50%', padding: 0 }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
              <span style={{ fontSize: '13.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>العملة</span>
              <input 
                className="form-input" 
                value={form.currency} 
                onChange={(e) => setForm({ ...form, currency: e.target.value })} 
                style={{ fontSize: '13.5px', color: 'var(--text-primary)', fontWeight: 700, textAlign: 'left', border: 'none', background: 'transparent', width: '30%', padding: 0 }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
              <span style={{ fontSize: '13.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>اللغة</span>
              <span style={{ fontSize: '13.5px', color: 'var(--text-primary)', fontWeight: 700 }}>العربية</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
              <span style={{ fontSize: '13.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>الوقت والتاريخ</span>
              <span style={{ fontSize: '13.5px', color: 'var(--text-primary)', fontWeight: 700 }}>توقيت محلي</span>
            </div>
          </div>
        </div>

        {/* Standalone Low Stock Alert Configuration & Management Widget */}
        <div className="card card-p" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 24 }}>
          <div className="card-header" style={{ padding: '0 0 16px', borderBottom: '1px solid var(--border)', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card-title" style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>إعدادات تنبيه المخزون</span>
            <SettingsIcon size={18} color="var(--text-tertiary)" />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '13.5px', marginBottom: '8px', display: 'block', color: 'var(--text-secondary)' }}>تنبيه المخزون المنخفض (كمية)</label>
              <input 
                className="form-input" 
                type="number"
                value={form.lowStockThreshold} 
                onChange={(e) => setForm({ ...form, lowStockThreshold: +e.target.value })} 
                style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '30px', background: 'var(--surface)', color: 'var(--text-primary)', marginBottom: '12px' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <button 
                className="btn btn-primary" 
                onClick={handleExportInventory} 
                style={{ width: '100%', padding: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: '14px', fontWeight: 700 }}
              >
                <FileSpreadsheet size={18} /> تصدير Excel للمخزون
              </button>
            </div>
          </div>
        </div>

      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
        <button className="btn btn-primary" onClick={handleSaveSettings} style={{ padding: '12px 24px', borderRadius: '30px', fontSize: '15px', fontWeight: 700 }}>
          <Save size={18} style={{ marginLeft: 8 }} /> حفظ التغييرات
        </button>
      </div>

      {/* Pharmacist Profile */}
      <div className="card card-p" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 24, marginBottom: 24 }}>
        <div className="card-header" style={{ padding: '0 0 16px', borderBottom: '1px solid var(--border)', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="card-title" style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>الملف الشخصي للصيدلي</span>
          <Info size={18} color="var(--text-tertiary)" />
        </div>
        
        <div className="form-grid-2" style={{ gap: 20 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '13.5px', marginBottom: '8px', display: 'block' }}>اسم الصيدلي</label>
            <input 
              className="form-input" 
              type="text"
              value={form.pharmacistName} 
              onChange={(e) => setForm({ ...form, pharmacistName: e.target.value })} 
              style={{ padding: '10px 14px' }}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '13.5px', marginBottom: '8px', display: 'block' }}>الصورة الشخصية</label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {form.pharmacistAvatar && (
                <img 
                  src={form.pharmacistAvatar} 
                  alt="Avatar" 
                  style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }} 
                />
              )}
              <input 
                className="form-input" 
                type="text"
                placeholder="رابط الصورة (URL)..."
                value={form.pharmacistAvatar} 
                onChange={(e) => setForm({ ...form, pharmacistAvatar: e.target.value })} 
                style={{ flex: 1, padding: '10px 14px' }}
              />
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = (e: any) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        setForm(f => ({ ...f, pharmacistAvatar: evt.target?.result as string }));
                      };
                      reader.readAsDataURL(file);
                    }
                  };
                  input.click();
                }}
                style={{ padding: '10px 20px', fontWeight: 600 }}
              >
                رفع
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Authentication & Security */}
      <div className="card card-p" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 24, marginBottom: 24 }}>
        <div className="card-header" style={{ padding: '0 0 16px', borderBottom: '1px solid var(--border)', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="card-title" style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>إعدادات الأمان وقفل الشاشة</span>
          <Lock size={18} color="var(--text-tertiary)" />
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              إدارة المستخدمين والصلاحيات متاحة للمسؤولين فقط. يمكنك التحكم في المستخدمين بالأسفل.
            </span>
          </div>
        </div>
      </div>

      {/* User Management Section */}
      {currentUser?.permissions.canManageUsers && (
        <div className="card card-p" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 24, marginBottom: 24 }}>
          <div className="card-header" style={{ padding: '0 0 16px', borderBottom: '1px solid var(--border)', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card-title" style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>إدارة المستخدمين والصلاحيات</span>
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)} style={{ padding: '6px 16px' }}>إضافة مستخدم</button>
          </div>

          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>الدور</th>
                  <th>الحالة</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td className="td-primary">{u.name}</td>
                    <td className="td-secondary">{u.role === 'admin' ? 'مدير' : u.role === 'pharmacist' ? 'صيدلي' : 'كاشير'}</td>
                    <td>
                      <span className={`badge ${u.isActive ? 'badge-success' : 'badge-neutral'}`}>
                        {u.isActive ? 'نشط' : 'معطل'}
                      </span>
                    </td>
                    <td style={{ display: 'flex', gap: 12 }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => {
                        setSelectedUserForEdit(u);
                        setNewUserPerms(u.permissions);
                        setNewUserRole(u.role);
                        setShowEditModal(true);
                      }}>تعديل الصلاحيات</button>
                      <button className="btn btn-sm btn-secondary" onClick={() => {
                        setSelectedUserForEdit(u);
                        setNewUserPasscode('');
                        setShowResetModal(true);
                      }}>إعادة تعيين الرمز</button>
                      {u.role !== 'admin' && (
                        <button className="btn btn-sm btn-danger" onClick={() => {
                          triggerAdminConfirmation(() => {
                            deleteUser(u.id);
                            alert('تم حذف المستخدم');
                          });
                        }}>حذف</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal modal-md">
            <div className="modal-header">
              <span className="modal-title">إضافة مستخدم جديد</span>
              <button className="btn-ghost" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">الاسم</label>
                <input className="form-input" value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="اسم الموظف..." />
              </div>
              <div className="form-group">
                <label className="form-label">الدور</label>
                <select className="form-input form-select" value={newUserRole} onChange={e => {
                  const role = e.target.value as 'admin' | 'pharmacist' | 'cashier';
                  setNewUserRole(role);
                  setNewUserPerms(DEFAULT_PERMISSIONS[role]);
                }}>
                  <option value="cashier">كاشير</option>
                  <option value="pharmacist">صيدلي</option>
                  <option value="admin">مدير</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">رمز الدخول (6 أرقام)</label>
                <input className="form-input" type="password" maxLength={6} value={newUserPasscode} onChange={e => setNewUserPasscode(e.target.value.replace(/\D/g, ''))} placeholder="******" />
              </div>
              
              <div className="form-group" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <span className="form-label" style={{ marginBottom: 12 }}>تعديل الصلاحيات:</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {PERMISSIONS_LIST.map(({ key, label }) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={!!(newUserPerms as any)[key]} 
                        onChange={(e) => setNewUserPerms(p => ({ ...p, [key]: e.target.checked }))} 
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>إلغاء</button>
              <button className="btn btn-primary" onClick={handleCreateUser}>إضافة وحفظ</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Permissions Modal */}
      {showEditModal && selectedUserForEdit && (
        <div className="modal-overlay">
          <div className="modal modal-md">
            <div className="modal-header">
              <span className="modal-title">تعديل صلاحيات: {selectedUserForEdit.name}</span>
              <button className="btn-ghost" onClick={() => setShowEditModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {PERMISSIONS_LIST.map(({ key, label }) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={!!(newUserPerms as any)[key]} 
                      onChange={(e) => setNewUserPerms(p => ({ ...p, [key]: e.target.checked }))} 
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>إلغاء</button>
              <button className="btn btn-primary" onClick={() => {
                triggerAdminConfirmation(() => {
                  updateUser(selectedUserForEdit.id, { permissions: newUserPerms });
                  alert('تم تحديث الصلاحيات');
                  setShowEditModal(false);
                });
              }}>تعديل الصلاحيات</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Passcode Modal */}
      {showResetModal && selectedUserForEdit && (
        <div className="modal-overlay">
          <div className="modal modal-sm">
            <div className="modal-header">
              <span className="modal-title">إعادة تعيين رمز {selectedUserForEdit.name}</span>
              <button className="btn-ghost" onClick={() => setShowResetModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">الرمز الجديد (6 أرقام)</label>
                <input className="form-input" type="password" maxLength={6} value={newUserPasscode} onChange={e => setNewUserPasscode(e.target.value.replace(/\D/g, ''))} placeholder="******" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowResetModal(false)}>إلغاء</button>
              <button className="btn btn-primary" onClick={() => {
                if (newUserPasscode.length !== 6) {
                  alert('يجب أن يتكون الرمز من 6 أرقام');
                  return;
                }
                triggerAdminConfirmation(async () => {
                  await resetUserPasscode(selectedUserForEdit.id, newUserPasscode);
                  alert('تمت إعادة تعيين الرمز بنجاح');
                  setShowResetModal(false);
                });
              }}>تأكيد</button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal-overlay" style={{ zIndex: 1010 }}>
          <div className="modal modal-sm">
            <div className="modal-header">
              <span className="modal-title">تأكيد رمز المدير</span>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>يجب إدخال رمز المدير الخاص بك لتأكيد هذا الإجراء.</p>
              <input 
                className="form-input" 
                type="password" 
                maxLength={6} 
                value={adminPasscodeConfirm} 
                onChange={e => setAdminPasscodeConfirm(e.target.value.replace(/\D/g, ''))} 
                placeholder="******" 
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowConfirmModal(false)}>إلغاء</button>
              <button className="btn btn-primary" onClick={handleAdminVerify}>تأكيد</button>
            </div>
          </div>
        </div>
      )}

      {/* Biometric */}
      <div className="card card-p" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Fingerprint size={16} /> المصادقة الحيوية (البصمة)
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>
              {biometricAvailable 
                ? (biometricRegistered ? 'تم تفعيل البصمة لتسجيل الدخول السريع' : 'قم بتفعيل البصمة لتسجيل الدخول السريع بدلاً من كتابة الرمز')
                : 'المصادقة الحيوية غير مدعومة أو غير متاحة على هذا المتصفح/الجهاز.'}
            </div>
          </div>
          {biometricAvailable && (
            <label className="switch">
              <input 
                type="checkbox" 
                checked={biometricRegistered} 
                onChange={() => {
                  if (biometricRegistered) {
                    useAuthStore.getState().setBiometricRegistered(false);
                  } else {
                    // Quick WebAuthn fake trigger for consistency
                    navigator.credentials.create({
                      publicKey: {
                        challenge: new Uint8Array([1,2,3,4]),
                        rp: { name: "Pharma System" },
                        user: { id: new Uint8Array([1]), name: "user@pharma", displayName: "Pharmacy User" },
                        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
                        authenticatorSelection: { userVerification: "required", residentKey: "required", requireResidentKey: true },
                        timeout: 60000
                      }
                    }).then(credential => {
                      if (credential) {
                        const cred = credential as PublicKeyCredential;
                        const base64Id = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
                        localStorage.setItem('pharma_webauthn_credential_id', base64Id);
                        if (currentUser) localStorage.setItem('pharma_biometric_user_id', currentUser.id);
                        useAuthStore.getState().setBiometricRegistered(true);
                        alert('تم تفعيل البصمة بنجاح');
                      }
                    }).catch(e => console.error(e));
                  }
                }} 
              />
              <span className="slider"></span>
            </label>
          )}
        </div>
      </div>

      {/* Data Management */}
      <div className="card card-p">
        <div className="card-header" style={{ padding: '0 0 16px', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
          <span className="card-title">إدارة البيانات والنسخ الاحتياطي</span>
          <Database size={18} color="var(--text-tertiary)" />
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text-primary)' }}>تصدير البيانات</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                تحميل نسخة احتياطية كاملة للمخزون، المبيعات، والمرضى بصيغة JSON.
              </div>
            </div>
            <button className="btn btn-primary" onClick={exportData} style={{ padding: '8px 16px', borderRadius: '30px' }}>
              <Download size={15} style={{ marginLeft: 6 }} /> تصدير
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text-primary)' }}>استيراد البيانات</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                استعادة قاعدة البيانات بالكامل من ملف احتياطي سابق بصيغة JSON.
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => fileRef.current?.click()} style={{ padding: '8px 16px', borderRadius: '30px' }}>
              <Upload size={15} style={{ marginLeft: 6 }} /> استيراد
            </button>
            <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--danger)' }}>إعادة ضبط النظام</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                حذف جميع البيانات المسجلة وإعادة تهيئة النظام بالكامل (البيانات التجريبية).
              </div>
            </div>
            <button className="btn btn-danger" onClick={handleReset} style={{ padding: '8px 16px', borderRadius: '30px' }}>
              <RotateCcw size={15} style={{ marginLeft: 6 }} /> إعادة ضبط
            </button>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="card card-p">
        <div className="card-header" style={{ padding: '0 0 16px', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
          <span className="card-title">حول النظام</span>
          <Info size={18} color="var(--text-tertiary)" />
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 13.5 }}>
          {[
            ['اسم النظام', 'صيدليتي — نظام إدارة الصيدليات المتكامل'],
            ['الإصدار', '1.0.0'],
            ['قاعدة البيانات', 'IndexedDB (Dexie.js) - تخزين محلي مستقل'],
            ['إدارة الحالة', 'Zustand State Manager'],
            ['بنية الواجهة', 'React 18 + TypeScript + Recharts'],
            ['الأمان', 'بياناتك محفوظة بالكامل داخل متصفحك الشخصي']
          ].map(([label, value]) => (
            <div key={label} style={{ padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>{label}</div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

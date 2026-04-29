import React, { useEffect, useState } from 'react';
import { Plus, Trash2, ShoppingBag, CheckCircle, AlertTriangle } from 'lucide-react';
import { purchaseService } from '../db/storageService';
import { useInventoryStore } from '../store/useInventoryStore';
import { Modal } from '../components/shared/Modal';
import type { Purchase, PurchaseItem } from '../types';
import { format } from 'date-fns';
import { nanoid } from '../utils/id';
import { buildTimestamps, getLocalDateKey } from '../utils/time';

interface LineItem {
  tempId: string;
  productId: string;
  productName: string;
  batchLotNumber: string;
  expiryDate: string;
  manufactureDate: string;
  quantity: number;
  costPerUnit: number;
}

const emptyLine = (): LineItem => ({
  tempId: nanoid(),
  productId: '',
  productName: '',
  batchLotNumber: '',
  expiryDate: '',
  manufactureDate: '',
  quantity: 1,
  costPerUnit: 0,
});

const formatCurrency = (n: number) =>
  n.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 });

export const Procurement: React.FC = () => {
  const { products, loadAll: loadInventory } = useInventoryStore();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [supplierName, setSupplierName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState<'new' | 'history'>('new');
  const [activeKPI, setActiveKPI] = useState<'TOTAL' | 'PENDING' | 'DONE' | 'TODAY' | null>(null);

  useEffect(() => {
    loadInventory();
    loadPurchases();
  }, []);

  const loadPurchases = async () => {
    const all = await purchaseService.getAll();
    setPurchases(all);
  };

  const updateLine = (tempId: string, field: keyof LineItem, value: string | number) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.tempId !== tempId) return l;
        if (field === 'productId') {
          const p = products.find((pr) => pr.id === value);
          return { ...l, productId: value as string, productName: p?.name ?? '', costPerUnit: p?.costPrice ?? 0 };
        }
        return { ...l, [field]: value };
      })
    );
  };

  const totalCost = lines.reduce((sum, l) => sum + l.quantity * l.costPerUnit, 0);

  const handleSubmit = async () => {
    setError('');
    if (!supplierName.trim()) { setError('يرجى إدخال اسم المورد'); return; }
    if (!invoiceNumber.trim()) { setError('يرجى إدخال رقم الفاتورة'); return; }
    const validLines = lines.filter((l) => l.productId && l.expiryDate && l.quantity > 0);
    if (validLines.length === 0) { setError('يجب إضافة دواء واحد على الأقل بالبيانات الكاملة'); return; }

    setLoading(true);
    try {
      const purchaseId = nanoid();
      const { createdAt: now, dateKey } = buildTimestamps();

      const purchaseItems: PurchaseItem[] = validLines.map((l) => ({
        id: nanoid(),
        purchaseId,
        productId: l.productId,
        productName: l.productName,
        batchLotNumber: l.batchLotNumber || `AUTO-${Date.now()}`,
        expiryDate: l.expiryDate,
        manufactureDate: l.manufactureDate || dateKey,  // local date, not UTC split
        quantity: l.quantity,
        costPerUnit: l.costPerUnit,
        totalCost: l.quantity * l.costPerUnit,
      }));

      const purchase: Purchase = {
        id: purchaseId,
        supplierName,
        invoiceNumber,
        items: purchaseItems,
        totalCost,
        notes,
        createdAt: now,
        dateKey,   // local YYYY-MM-DD
      };

      await purchaseService.receivePurchase(purchase, purchaseItems);

      await loadInventory();
      await loadPurchases();

      setSuccess(`تم استلام المشتريات بنجاح — تم إضافة ${purchaseItems.length} دفعة للمخزون`);
      setSupplierName('');
      setInvoiceNumber('');
      setNotes('');
      setLines([emptyLine()]);
    } catch (e: any) {
      setError(e.message || 'فشل في تسجيل المشتريات');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-medium">
      {/* KPI Details Modal */}
      {activeKPI && (
        <Modal
          open={activeKPI !== null}
          onClose={() => setActiveKPI(null)}
          title={
            activeKPI === 'TOTAL' ? 'إجمالي طلبات الشراء' :
              activeKPI === 'PENDING' ? 'طلبات قيد التنفيذ' :
                activeKPI === 'DONE' ? 'طلبات مكتملة' :
                  'طلبات اليوم'
          }
          size="lg"
        >
          <div className="table-wrap" style={{ maxHeight: 400, overflowY: 'auto' }}>
            <table className="table">
              <thead>
                <tr style={{ background: 'var(--surface-hover)', position: 'sticky', top: 0, zIndex: 10, fontSize: '13px' }}>
                  <th style={{ textAlign: 'right', padding: '12px 16px' }}>المورد</th>
                  <th style={{ textAlign: 'center', padding: '12px 16px' }}>رقم الفاتورة</th>
                  <th style={{ textAlign: 'center', padding: '12px 16px' }}>التكلفة الإجمالية</th>
                </tr>
              </thead>
              <tbody>
                {purchases
                  .filter(p => {
                    if (activeKPI === 'TOTAL') return true;
                    if (activeKPI === 'PENDING') return false;
                    if (activeKPI === 'DONE') return true;
                    if (activeKPI === 'TODAY') return p.dateKey === getLocalDateKey();
                    return true;
                  })
                  .map(p => (
                    <tr key={p.id} style={{ transition: 'all 150ms ease', borderBottom: '1px solid var(--border)' }} className="inventory-row-hover">
                      <td style={{ textAlign: 'right', padding: '14px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>{p.supplierName}</td>
                      <td style={{ textAlign: 'center', padding: '14px 16px', color: 'var(--text-secondary)' }}>{p.invoiceNumber}</td>
                      <td style={{ textAlign: 'center', padding: '14px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(p.totalCost)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {/* Actionable KPI Widgets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 24 }}>
        {/* إجمالي الطلبات */}
        <div
          onClick={() => setActiveKPI('TOTAL')}
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
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>إجمالي الطلبات</span>
          <span style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)' }}>{purchases.length}</span>
        </div>

        {/* قيد التنفيذ */}
        <div
          onClick={() => setActiveKPI('PENDING')}
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
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>قيد التنفيذ</span>
          <span style={{ fontSize: '32px', fontWeight: 800, color: '#ca8a04' }}>0</span>
        </div>

        {/* مكتملة */}
        <div
          onClick={() => setActiveKPI('DONE')}
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
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>مكتملة</span>
          <span style={{ fontSize: '32px', fontWeight: 800, color: '#10b981' }}>{purchases.length}</span>
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
            {purchases.filter(p => p.dateKey === getLocalDateKey()).length}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        {[
          ['new', 'فاتورة جديدة'], 
          ['history', 'سجل المشتريات'],
        ].map(([key, label]) => (
          <button
            key={key}
            className={`tab-btn ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key as any)}
          >{label}</button>
        ))}
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert alert-danger">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}
      {success && (
        <div className="alert alert-success">
          <CheckCircle size={18} />
          {success}
        </div>
      )}

      {tab === 'new' && (
        <div className="card card-p">
          {/* Header Fields */}
          <div className="form-grid-2" style={{ marginBottom: 20 }}>
            <div className="form-group">
              <label className="form-label">اسم المورد</label>
              <input className="form-input" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="مثال: شركة الفارابي للأدوية" />
            </div>
            <div className="form-group">
              <label className="form-label">رقم الفاتورة</label>
              <input className="form-input" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="مثال: INV-2024-001" />
            </div>
          </div>

          {/* Line Items */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>أدوية الفاتورة</div>
            {lines.map((line, idx) => (
              <div key={line.tempId} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 10, alignItems: 'end' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  {idx === 0 && <label className="form-label" style={{ fontSize: 11 }}>الدواء</label>}
                  <select className="form-input" value={line.productId} onChange={(e) => updateLine(line.tempId, 'productId', e.target.value)}>
                    <option value="">-- اختر دواءً --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  {idx === 0 && <label className="form-label" style={{ fontSize: 11 }}>رقم الدفعة</label>}
                  <input className="form-input" value={line.batchLotNumber} onChange={(e) => updateLine(line.tempId, 'batchLotNumber', e.target.value)} placeholder="LOT-001" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  {idx === 0 && <label className="form-label" style={{ fontSize: 11 }}>تاريخ الصلاحية</label>}
                  <input type="date" className="form-input" value={line.expiryDate} onChange={(e) => updateLine(line.tempId, 'expiryDate', e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  {idx === 0 && <label className="form-label" style={{ fontSize: 11 }}>الكمية</label>}
                  <input type="number" min={1} className="form-input" value={line.quantity} onChange={(e) => updateLine(line.tempId, 'quantity', +e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  {idx === 0 && <label className="form-label" style={{ fontSize: 11 }}>سعر الوحدة (ج.م)</label>}
                  <input type="number" min={0} step="0.01" className="form-input" value={line.costPerUnit} onChange={(e) => updateLine(line.tempId, 'costPerUnit', +e.target.value)} />
                </div>
                <button
                  onClick={() => setLines((prev) => prev.filter((l) => l.tempId !== line.tempId))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 8, marginTop: idx === 0 ? 20 : 0 }}
                  disabled={lines.length === 1}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button className="btn btn-secondary" onClick={() => setLines((prev) => [...prev, emptyLine()])} style={{ marginTop: 8, borderRadius: '30px' }}>
              <Plus size={15} style={{ marginLeft: 6 }} /> إضافة دواء
            </button>
          </div>

          {/* Notes */}
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">ملاحظات</label>
            <input className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات اختيارية" />
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>
              إجمالي الفاتورة: <span style={{ color: 'var(--accent-dark)' }}>{formatCurrency(totalCost)}</span>
            </div>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading} style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 8, borderRadius: '30px' }}>
              <ShoppingBag size={16} />
              {loading ? 'جارٍ الحفظ...' : 'تسجيل المشتريات وتحديث المخزون'}
            </button>
          </div>
        </div>
      )}
      {tab === 'history' && (
        <div className="card card-table" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginTop: 16 }}>
          <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 400px)', overflowY: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--surface-hover)', borderBottom: '1px solid var(--border)' }}>
                <tr>
                  <th style={{ textAlign: 'right', padding: '14px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>المورد</th>
                  <th style={{ textAlign: 'center', padding: '14px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>رقم الفاتورة</th>
                  <th style={{ textAlign: 'center', padding: '14px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>عدد الأدوية</th>
                  <th style={{ textAlign: 'center', padding: '14px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>إجمالي التكلفة</th>
                  <th style={{ textAlign: 'center', padding: '14px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--text-tertiary)' }}>
                      <div style={{ fontSize: '15px', fontWeight: 600 }}>لا توجد فواتير مشتريات مسجلة</div>
                    </td>
                  </tr>
                ) : (
                  purchases.map((p) => (
                    <tr
                      key={p.id}
                      style={{ transition: 'all 150ms ease', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                      className="inventory-row-hover"
                    >
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>{p.supplierName}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>{p.invoiceNumber}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 700 }}>{p.items.length}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(p.totalCost)}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>{format(new Date(p.createdAt), 'dd/MM/yyyy HH:mm')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};


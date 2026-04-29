import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, Package, AlertTriangle, Clock, ChevronDown, ChevronUp, CheckCircle, X, ScanLine, Pill, Eye, FileSpreadsheet, Filter } from 'lucide-react';
import {
  HiOutlineCube, HiOutlineShieldCheck, HiOutlineSparkles, HiOutlineHeart,
  HiOutlineBeaker, HiOutlineUserCircle, HiOutlineArchiveBox, HiOutlinePlusCircle
} from 'react-icons/hi2';
import { useInventoryStore } from '../store/useInventoryStore';
import { useIntelligence } from '../intelligence/useIntelligence';
import { useInventoryBarcode } from '../hooks/useInventoryBarcode';
import { Modal } from '../components/shared/Modal';
import { Can } from '../components/shared/Can';
import { useAuthStore, hasPermission } from '../store/useAuthStore';
import type { Product, Batch, ProductCategory } from '../types';
import { getLocalDateKey } from '../utils/time';
import { format, differenceInDays } from 'date-fns';

const CATEGORIES: ProductCategory[] = [
  'أدوية عامة', 'مضادات حيوية', 'مسكنات', 'فيتامينات',
  'أدوية قلب', 'أدوية سكر', 'أدوية ضغط', 'مستلزمات طبية', 'مستحضرات تجميل', 'أخرى'
];
const UNITS = ['حبة', 'علبة', 'زجاجة', 'أمبول', 'كبسولة', 'كيس', 'ملليلتر', 'غرام'];
const formatCurrency = (n: number) =>
  n.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 });

const emptyProduct = (): Omit<Product, 'id' | 'createdAt' | 'updatedAt'> => ({
  name: '', barcode: '', category: 'أدوية عامة', unitPrice: 0,
  costPrice: 0, unit: 'علبة', description: '', requiresPrescription: false,
});

const emptyBatch = (productId: string): Omit<Batch, 'id' | 'receivedAt'> => ({
  productId,
  lotNumber: '',
  manufactureDate: '',
  expiryDate: '',
  quantity: 0,
  remaining: 0,
  costPerUnit: 0,
});

export const Inventory: React.FC = () => {
  const { products, batches, inventory, loadAll, addProduct, updateProduct, deleteProduct, addBatch, updateBatch, deleteBatch } = useInventoryStore();
  const { currentUser } = useAuthStore();
  const allowedToEditPrice = hasPermission(currentUser, 'canEditPrice');
  const { inventory: intelInv, isLoading: intelLoading } = useIntelligence();
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [batchProductId, setBatchProductId] = useState('');
  const [formData, setFormData] = useState(emptyProduct());
  const [batchData, setBatchData] = useState(emptyBatch(''));
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'expiry' | 'insights'>('products');
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [batchErrors, setBatchErrors] = useState<Record<string, boolean>>({});
  const [scanToast, setScanToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [activeKPI, setActiveKPI] = useState<'TOTAL' | 'LOW' | 'EXPIRING' | 'CRITICAL' | null>(null);

  useEffect(() => { loadAll(); }, []);

  // ── Inventory barcode handler: scan a product → open batch-add modal ─────────────
  useInventoryBarcode({
    onFound: useCallback((product: Product) => {
      setScanToast({ text: `✓ ${product.name} — أدخل بيانات الدفعة`, ok: true });
      setTimeout(() => setScanToast(null), 2500);
      openBatch(product.id);
    }, []),
    onError: useCallback((msg: string) => {
      setScanToast({ text: msg, ok: false });
      setTimeout(() => setScanToast(null), 3000);
    }, []),
  });

  // ── Local-safe today key ──────────────────────────────────────────────
  const today = getLocalDateKey();

  const filtered = products.filter((p) => {
    const matchSearch = !search || p.name.includes(search) || p.barcode.includes(search);
    const matchCat = !filterCat || p.category === filterCat;
    return matchSearch && matchCat;
  });

  const getInv = (pid: string) => inventory.find((i) => i.productId === pid);
  const getBatches = (pid: string) => batches.filter((b) => b.productId === pid);

  const openAdd = () => { setEditProduct(null); setFormData(emptyProduct()); setShowProductModal(true); };
  const openEdit = (p: Product) => {
    setEditProduct(p);
    setFormData({ name: p.name, barcode: p.barcode, category: p.category, unitPrice: p.unitPrice, costPrice: p.costPrice, unit: p.unit, description: p.description, requiresPrescription: p.requiresPrescription });
    setShowProductModal(true);
  };

  const handleSaveProduct = async () => {
    const newErrors: Record<string, boolean> = {};
    if (!formData.name) newErrors.name = true;
    if (!formData.barcode) newErrors.barcode = true;
    if (formData.unitPrice <= 0) newErrors.unitPrice = true;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    if (editProduct) {
      await updateProduct(editProduct.id, formData);
    } else {
      await addProduct(formData);
    }
    setShowProductModal(false);
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف "${name}"؟ سيتم حذف جميع الدفعات المرتبطة.`)) return;
    await deleteProduct(id);
  };

  const openBatch = (productId: string) => {
    setBatchProductId(productId);
    const product = products.find(p => p.id === productId);
    setBatchData({ ...emptyBatch(productId), costPerUnit: product?.costPrice ?? 0 });
    setShowBatchModal(true);
  };

  const handleSaveBatch = async () => {
    const newErrors: Record<string, boolean> = {};
    if (!batchData.lotNumber) newErrors.lotNumber = true;
    if (!batchData.expiryDate) newErrors.expiryDate = true;
    if (batchData.quantity <= 0) newErrors.quantity = true;

    if (Object.keys(newErrors).length > 0) {
      setBatchErrors(newErrors);
      return;
    }

    setBatchErrors({});
    await addBatch({ ...batchData, productId: batchProductId, remaining: batchData.quantity });
    setShowBatchModal(false);
  };

  // Expiry report
  const expiryBatches = batches
    .map((b) => {
      const daysLeft = differenceInDays(new Date(b.expiryDate), new Date());
      const product = products.find((p) => p.id === b.productId);
      return { ...b, daysLeft, productName: product?.name ?? '—' };
    })
    .filter((b) => b.remaining > 0)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const setField = (key: string, val: any) => setFormData((f) => ({ ...f, [key]: val }));
  const setBatchField = (key: string, val: any) => setBatchData((f) => ({ ...f, [key]: val }));

  const handleExportInventory = () => {
    const csvRows = [
      ['اسم الدواء', 'الباركود', 'التصنيف', 'سعر البيع', 'سعر التكلفة', 'الكمية', 'الحالة'],
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
          qty === 0 ? 'نفد' : qty <= minStock * 0.5 ? 'حرج' : qty <= minStock ? 'منخفض' : 'طبيعي'
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

  const handleQuickStockChange = async (productId: string, delta: number) => {
    const prodBatches = batches.filter((b) => b.productId === productId);
    if (prodBatches.length > 0) {
      const latest = [...prodBatches].sort((a, b) => b.expiryDate.localeCompare(a.expiryDate))[0];
      const newQty = Math.max(0, latest.remaining + delta);
      await updateBatch(latest.id, { remaining: newQty });
    } else if (delta > 0) {
      await addBatch({
        productId,
        lotNumber: 'AUTO-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
        manufactureDate: new Date().toISOString().split('T')[0],
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        quantity: delta,
        remaining: delta,
        costPerUnit: products.find(p => p.id === productId)?.costPrice ?? 0,
      });
    }
  };

  return (
    <div>
      {/* Scan Toast */}
      {scanToast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%',
          transform: 'translateX(-50%)', zIndex: 9000,
          padding: '12px 22px', borderRadius: 40, fontWeight: 700, fontSize: 14,
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: 'var(--shadow-lg)', animation: 'slideUp 180ms ease-out',
          background: scanToast.ok ? 'var(--success)' : 'var(--danger)',
          color: '#fff', pointerEvents: 'none',
        }}>
          {scanToast.ok ? <CheckCircle size={17} /> : <X size={17} />}
          {scanToast.text}
        </div>
      )}
      {/* KPI Details Modal */}
      {activeKPI && (
        <Modal
          open={activeKPI !== null}
          onClose={() => setActiveKPI(null)}
          title={
            activeKPI === 'TOTAL' ? 'إجمالي الأدوية' :
              activeKPI === 'LOW' ? 'مخزون منخفض' :
                activeKPI === 'EXPIRING' ? 'قارب على الانتهاء' :
                  'أصناف حرجة'
          }
          size="lg"
        >
          <div className="table-wrap" style={{ maxHeight: 400, overflowY: 'auto' }}>
            <table className="table">
              <thead>
                <tr style={{ background: 'var(--surface-hover)', position: 'sticky', top: 0, zIndex: 10, fontSize: '13px' }}>
                  {activeKPI === 'EXPIRING' ? (
                    <>
                      <th style={{ textAlign: 'right', padding: '12px 16px' }}>اسم الدواء</th>
                      <th style={{ textAlign: 'center', padding: '12px 16px' }}>رقم الدفعة</th>
                      <th style={{ textAlign: 'center', padding: '12px 16px' }}>تاريخ الانتهاء</th>
                      <th style={{ textAlign: 'center', padding: '12px 16px' }}>المتبقي</th>
                    </>
                  ) : (
                    <>
                      <th style={{ textAlign: 'right', padding: '12px 16px' }}>اسم الدواء</th>
                      <th style={{ textAlign: 'center', padding: '12px 16px' }}>الباركود</th>
                      <th style={{ textAlign: 'center', padding: '12px 16px' }}>التصنيف</th>
                      <th style={{ textAlign: 'center', padding: '12px 16px' }}>المخزون الحالي</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {activeKPI === 'EXPIRING' ? (
                  batches
                    .filter(b => b.remaining > 0 && differenceInDays(new Date(b.expiryDate), new Date()) <= 30)
                    .map(b => (
                      <tr key={b.id} style={{ transition: 'all 150ms ease', borderBottom: '1px solid var(--border)' }} className="inventory-row-hover">
                        <td style={{ textAlign: 'right', padding: '14px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>{products.find(p => p.id === b.productId)?.name || '—'}</td>
                        <td style={{ textAlign: 'center', padding: '14px 16px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{b.lotNumber}</td>
                        <td style={{ textAlign: 'center', padding: '14px 16px', color: 'var(--danger)', fontWeight: 700 }}>{b.expiryDate}</td>
                        <td style={{ textAlign: 'center', padding: '14px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>{b.remaining}</td>
                      </tr>
                    ))
                ) : (
                  products
                    .filter(p => {
                      const inv = getInv(p.id);
                      const qty = inv?.totalQuantity ?? 0;
                      const min = inv?.minStock ?? 10;
                      if (activeKPI === 'TOTAL') return true;
                      if (activeKPI === 'LOW') return qty > 0 && qty <= min;
                      if (activeKPI === 'CRITICAL') return qty > 0 && qty <= min * 0.5;
                      return true;
                    })
                    .map(p => {
                      const inv = getInv(p.id);
                      const qty = inv?.totalQuantity ?? 0;
                      return (
                        <tr key={p.id} style={{ transition: 'all 150ms ease', borderBottom: '1px solid var(--border)' }} className="inventory-row-hover">
                          <td style={{ textAlign: 'right', padding: '14px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>{p.name}</td>
                          <td style={{ textAlign: 'center', padding: '14px 16px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{p.barcode}</td>
                          <td style={{ textAlign: 'center', padding: '14px 16px' }}>
                            <span className="badge badge-neutral">{p.category}</span>
                          </td>
                          <td style={{ textAlign: 'center', padding: '14px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>{qty}</td>
                        </tr>
                      );
                    })
                )}
                {((activeKPI === 'EXPIRING' && batches.filter(b => b.remaining > 0 && differenceInDays(new Date(b.expiryDate), new Date()) <= 30).length === 0) ||
                  (activeKPI !== 'EXPIRING' && products.filter(p => {
                    const inv = getInv(p.id);
                    const qty = inv?.totalQuantity ?? 0;
                    const min = inv?.minStock ?? 10;
                    if (activeKPI === 'TOTAL') return true;
                    if (activeKPI === 'LOW') return qty > 0 && qty <= min;
                    if (activeKPI === 'CRITICAL') return qty > 0 && qty <= min * 0.5;
                    return true;
                  }).length === 0)) && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-tertiary)', fontSize: '13.5px' }}>
                        لا توجد بيانات متاحة
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>
        </Modal>
      )}



      {/* Tabs */}
      <div className="tab-bar">
        {[['products', 'الأدوية'], ['expiry', 'تقرير الصلاحية'], ['insights', 'ذكاء المخزون']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as any)}
            className={`tab-btn ${activeTab === key ? 'active' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'products' ? (
        <>
          {/* Top KPI Summary Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 24 }}>
            {/* Total Products */}
            <div
              onClick={() => setActiveKPI('TOTAL')}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: 'var(--shadow-sm)',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'right' }}>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>إجمالي المنتجات</span>
                <span style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)' }}>{products.length}</span>
              </div>
              <div style={{ background: 'var(--bg)', borderRadius: '12px', padding: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={28} />
              </div>
            </div>

            {/* Low Stock Items */}
            <div
              onClick={() => setActiveKPI('LOW')}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: 'var(--shadow-sm)',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'right' }}>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>مخزون منخفض</span>
                <span style={{ fontSize: '32px', fontWeight: 800, color: '#ca8a04' }}>
                  {products.filter(p => { const inv = getInv(p.id); const qty = inv?.totalQuantity ?? 0; const min = inv?.minStock ?? 10; return qty > 0 && qty <= min; }).length}
                </span>
              </div>
              <div style={{ background: '#fef9c3', borderRadius: '12px', padding: '16px', color: '#ca8a04', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={28} />
              </div>
            </div>

            {/* Out of Stock */}
            <div
              onClick={() => setActiveKPI('CRITICAL')}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: 'var(--shadow-sm)',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'right' }}>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>نافد بالكامل</span>
                <span style={{ fontSize: '32px', fontWeight: 800, color: 'var(--danger)' }}>
                  {products.filter(p => { const inv = getInv(p.id); const qty = inv?.totalQuantity ?? 0; return qty === 0; }).length}
                </span>
              </div>
              <div style={{ background: '#fee2e2', borderRadius: '12px', padding: '16px', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={28} />
              </div>
            </div>
          </div>

          {/* Middle Category Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 32 }}>
            {CATEGORIES.map((cat) => {
              const count = products.filter(p => p.category === cat).length;
              const isSelected = filterCat === cat;

              const catIconMap: Record<string, React.FC<any>> = {
                'أدوية عامة': HiOutlineCube,
                'مضادات حيوية': HiOutlineShieldCheck,
                'مسكنات': HiOutlineSparkles,
                'فيتامينات': HiOutlineSparkles,
                'أدوية قلب': HiOutlineHeart,
                'أدوية سكر': HiOutlineBeaker,
                'أدوية ضغط': HiOutlineUserCircle,
                'مستلزمات طبية': HiOutlineArchiveBox,
                'مستحضرات تجميل': HiOutlineSparkles,
                'أخرى': HiOutlinePlusCircle,
              };
              const CatIcon = catIconMap[cat] || HiOutlineCube;

              return (
                <div
                  key={cat}
                  onClick={() => setFilterCat(isSelected ? '' : cat)}
                  style={{
                    background: isSelected ? 'rgba(209, 243, 102, 0.2)' : 'var(--surface)',
                    color: 'var(--text-primary)',
                    border: isSelected ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                    borderRadius: '16px',
                    padding: '20px',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'all 150ms ease'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'right' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{cat}</span>
                    <span style={{ fontSize: '24px', fontWeight: 800 }}>{count}</span>
                  </div>
                  <div style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: '50%', padding: (cat === 'فيتامينات' || cat === 'مسكنات' || cat === 'مستحضرات تجميل') ? '4px' : '10px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', overflow: 'hidden' }}>
                    {cat === 'فيتامينات' ? (
                      <img src="/src/assets/vitamine.jpg" alt="Vitamins" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.src = "/vitamine.jpg"; }} />
                    ) : cat === 'مسكنات' ? (
                      <img src="/src/assets/pills.avif" alt="Painkillers" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.src = "/pills.avif"; }} />
                    ) : cat === 'مستحضرات تجميل' ? (
                      <img src="/src/assets/1.svg" alt="Cosmetics" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.src = "/1.png"; }} />
                    ) : (
                      <CatIcon size={16} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Search + Action Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
            {/* Search */}
            <div style={{ flex: 1, maxWidth: '400px', position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
              <input
                className="form-input"
                placeholder="البحث باسم الدواء..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingRight: '44px', paddingLeft: '16px', paddingTop: '12px', paddingBottom: '12px', borderRadius: '30px', border: '1px solid var(--border)', width: '100%', fontSize: '14px', background: 'var(--surface)', color: 'var(--text-primary)' }}
              />
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Can permission="canManageInventory">
                <button
                  onClick={openAdd}
                  style={{ background: 'var(--accent)', color: '#111827', border: 'none', padding: '12px 24px', borderRadius: '30px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '14px' }}
                >
                  <Plus size={18} /> إضافة دواء جديد
                </button>
              </Can>

              <button
                onClick={handleExportInventory}
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '12px 20px', borderRadius: '30px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '14px' }}
              >
                <FileSpreadsheet size={16} /> تصدير Excel
              </button>
            </div>
          </div>

          {/* Products Table Zone */}
          <div className="card card-table" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 350px)', overflowY: 'auto' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--surface-hover)', borderBottom: '1px solid var(--border)' }}>
                  <tr>
                    <th style={{ width: '40px', padding: '14px 16px' }}></th>
                    <th style={{ textAlign: 'right', padding: '14px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>اسم الدواء</th>
                    <th style={{ textAlign: 'center', padding: '14px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>الباركود</th>
                    <th style={{ textAlign: 'center', padding: '14px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>التصنيف</th>
                    <th style={{ textAlign: 'center', padding: '14px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>سعر البيع</th>
                    <th style={{ textAlign: 'center', padding: '14px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>سعر التكلفة</th>
                    <th style={{ textAlign: 'center', padding: '14px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>الكمية</th>
                    <th style={{ textAlign: 'center', padding: '14px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>الحالة</th>
                    <th style={{ textAlign: 'center', padding: '14px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--text-tertiary)' }}>
                        <Package size={48} style={{ marginBottom: '12px', color: 'var(--border)' }} />
                        <div style={{ fontSize: '15px', fontWeight: 600 }}>لا توجد أدوية مسجلة حالياً</div>
                        <button className="btn btn-primary" onClick={openAdd} style={{ marginTop: '16px' }}>
                          إضافة دواء
                        </button>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((product) => {
                      const inv = getInv(product.id);
                      const qty = inv?.totalQuantity ?? 0;
                      const min = inv?.minStock ?? 10;
                      const isOut = qty === 0;
                      const isCritical = qty > 0 && qty <= min * 0.5;
                      const isLow = qty > 0 && qty <= min;
                      const prodBatches = getBatches(product.id);
                      const isExpanded = expandedProduct === product.id;

                      return (
                        <React.Fragment key={product.id}>
                          <tr
                            style={{
                              background: isOut ? 'rgba(239, 68, 68, 0.02)' : isCritical ? 'rgba(239, 68, 68, 0.04)' : isLow ? 'rgba(245, 158, 11, 0.04)' : 'transparent',
                              transition: 'all 150ms ease',
                              borderBottom: '1px solid var(--border)',
                              cursor: 'pointer'
                            }}
                            className="inventory-row-hover"
                            onClick={() => openEdit(product)}
                          >
                            <td onClick={(e) => e.stopPropagation()} style={{ padding: '14px 16px', textAlign: 'center' }}>
                              <button className="btn-ghost" onClick={() => setExpandedProduct(isExpanded ? null : product.id)} style={{ padding: '4px' }}>
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                            </td>
                            <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{product.name}</div>
                              <div style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{product.unit}</div>
                            </td>
                            <td style={{ padding: '14px 16px', textAlign: 'center', fontFamily: 'monospace', fontSize: '13px', color: 'var(--text-secondary)' }}>{product.barcode}</td>
                            <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                              <span className="badge badge-neutral" style={{ fontSize: '12px' }}>{product.category}</span>
                            </td>
                            <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(product.unitPrice)}</td>
                            <td style={{ padding: '14px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>{formatCurrency(product.costPrice)}</td>

                            {/* Quantity with quick controls */}
                            <td onClick={(e) => e.stopPropagation()} style={{ padding: '14px 16px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                                {hasPermission(currentUser, 'canManageInventory') && (
                                  <button
                                    className="btn btn-ghost"
                                    onClick={() => handleQuickStockChange(product.id, -1)}
                                    style={{
                                      width: '26px', height: '26px', padding: 0,
                                      borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontWeight: 'bold', color: 'var(--text-secondary)'
                                    }}
                                  >
                                    −
                                  </button>
                                )}
                                <span style={{ fontWeight: 800, fontSize: '15px', minWidth: '24px', textAlign: 'center', color: isOut ? 'var(--danger)' : isLow ? 'var(--warning)' : 'var(--text-primary)' }}>
                                  {qty}
                                </span>
                                {hasPermission(currentUser, 'canManageInventory') && (
                                  <button
                                    className="btn btn-ghost"
                                    onClick={() => handleQuickStockChange(product.id, 1)}
                                    style={{
                                      width: '26px', height: '26px', padding: 0,
                                      borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontWeight: 'bold', color: 'var(--text-secondary)'
                                    }}
                                  >
                                    +
                                  </button>
                                )}
                              </div>
                            </td>

                            <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                              {isOut ? (
                                <span className="badge badge-danger" style={{ fontWeight: 800, opacity: 1 }}>نفد</span>
                              ) : isCritical ? (
                                <span className="badge badge-danger" style={{ fontWeight: 700 }}>حرج</span>
                              ) : isLow ? (
                                <span className="badge badge-warning" style={{ fontWeight: 700 }}>منخفض</span>
                              ) : (
                                <span className="badge badge-success" style={{ fontWeight: 500 }}>متاح</span>
                              )}
                            </td>

                            <td onClick={(e) => e.stopPropagation()} style={{ padding: '14px 16px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                                {hasPermission(currentUser, 'canManageInventory') && (
                                  <>
                                    <button
                                      className="btn btn-secondary btn-sm"
                                      onClick={() => openBatch(product.id)}
                                      title="إضافة دفعة"
                                      style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                      <Plus size={16} />
                                    </button>
                                    <button
                                      className="btn btn-secondary btn-sm"
                                      onClick={() => openEdit(product)}
                                      title="تعديل"
                                      style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button
                                      className="btn btn-danger btn-sm"
                                      onClick={() => handleDeleteProduct(product.id, product.name)}
                                      title="حذف"
                                      style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Batch Rows */}
                          {isExpanded && (
                            <tr onClick={(e) => e.stopPropagation()}>
                              <td colSpan={10} style={{ background: 'var(--surface-hover)', padding: '16px 24px' }}>
                                <div style={{ fontSize: '13.5px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-secondary)' }}>
                                  الدفعات المرتبطة ({prodBatches.length})
                                </div>
                                {prodBatches.length === 0 ? (
                                  <div style={{ color: 'var(--text-tertiary)', fontSize: '13px', padding: '12px 0' }}>لا توجد دفعات متاحة حالياً.</div>
                                ) : (
                                  <table className="table" style={{ width: '100%', fontSize: '13px' }}>
                                    <thead>
                                      <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                                        <th style={{ textAlign: 'right', padding: '10px' }}>رقم الدفعة</th>
                                        <th style={{ textAlign: 'center', padding: '10px' }}>تاريخ الإنتاج</th>
                                        <th style={{ textAlign: 'center', padding: '10px' }}>تاريخ الانتهاء</th>
                                        <th style={{ textAlign: 'center', padding: '10px' }}>الكمية الأصلية</th>
                                        <th style={{ textAlign: 'center', padding: '10px' }}>المتبقي</th>
                                        <th style={{ textAlign: 'center', padding: '10px' }}>الحالة</th>
                                        <th style={{ textAlign: 'center', padding: '10px' }}></th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {prodBatches.map((b) => {
                                        const daysLeft = differenceInDays(new Date(b.expiryDate), new Date());
                                        const expired = b.expiryDate < today;
                                        const expiringSoon = !expired && daysLeft <= 30;
                                        return (
                                          <tr key={b.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ textAlign: 'right', padding: '12px 10px', fontFamily: 'monospace' }}>{b.lotNumber}</td>
                                            <td style={{ textAlign: 'center', padding: '12px 10px' }}>{b.manufactureDate || '—'}</td>
                                            <td style={{ textAlign: 'center', padding: '12px 10px' }} className={expired ? 'text-danger font-bold' : expiringSoon ? 'text-warning font-bold' : ''}>
                                              {b.expiryDate}
                                              {expiringSoon && !expired && <span style={{ fontSize: '11px', marginRight: '6px' }}>({daysLeft} يوم)</span>}
                                            </td>
                                            <td style={{ textAlign: 'center', padding: '12px 10px' }}>{b.quantity}</td>
                                            <td style={{ textAlign: 'center', padding: '12px 10px', fontWeight: 700 }} className={b.remaining === 0 ? 'text-danger' : ''}>{b.remaining}</td>
                                            <td style={{ textAlign: 'center', padding: '12px 10px' }}>
                                              {expired ? (
                                                <span className="badge badge-danger">منتهي</span>
                                              ) : expiringSoon ? (
                                                <span className="badge badge-warning">قريب</span>
                                              ) : (
                                                <span className="badge badge-success">صالح</span>
                                              )}
                                            </td>
                                            <td style={{ textAlign: 'center', padding: '12px 10px' }}>
                                              <button
                                                className="btn btn-danger btn-sm"
                                                onClick={() => deleteBatch(b.id)}
                                                style={{ padding: '4px' }}
                                              >
                                                <Trash2 size={14} />
                                              </button>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : activeTab === 'expiry' ? (
        /* Expiry Tab */
        <div className="card card-table" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
          <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <span className="card-title" style={{ fontSize: '16px', fontWeight: 700 }}>تقرير الصلاحية</span>
          </div>
          <div className="table-wrap">
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr style={{ background: 'var(--surface-hover)', fontSize: '13px' }}>
                  <th style={{ textAlign: 'right', padding: '14px 16px' }}>المنتج</th>
                  <th style={{ textAlign: 'center', padding: '14px 16px' }}>رقم الدفعة</th>
                  <th style={{ textAlign: 'center', padding: '14px 16px' }}>تاريخ الانتهاء</th>
                  <th style={{ textAlign: 'center', padding: '14px 16px' }}>الأيام المتبقية</th>
                  <th style={{ textAlign: 'center', padding: '14px 16px' }}>المتبقي</th>
                  <th style={{ textAlign: 'center', padding: '14px 16px' }}>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {expiryBatches.map((b) => {
                  const expired = b.daysLeft < 0;
                  const critical = !expired && b.daysLeft <= 15;
                  const warning = !expired && !critical && b.daysLeft <= 30;
                  return (
                    <tr key={b.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ textAlign: 'right', padding: '14px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>{b.productName}</td>
                      <td style={{ textAlign: 'center', padding: '14px 16px', fontFamily: 'monospace', fontSize: '12px' }}>{b.lotNumber}</td>
                      <td style={{ textAlign: 'center', padding: '14px 16px' }}>{b.expiryDate}</td>
                      <td style={{ textAlign: 'center', padding: '14px 16px' }} className={expired ? 'text-danger font-bold' : critical ? 'text-danger font-bold' : warning ? 'text-warning font-bold' : ''}>
                        {expired ? `منتهي منذ ${Math.abs(b.daysLeft)} يوم` : `${b.daysLeft} يوم`}
                      </td>
                      <td style={{ textAlign: 'center', padding: '14px 16px', fontWeight: 700 }}>{b.remaining}</td>
                      <td style={{ textAlign: 'center', padding: '14px 16px' }}>
                        {expired ? (
                          <span className="badge badge-danger">منتهي الصلاحية</span>
                        ) : critical ? (
                          <span className="badge badge-danger">حرج</span>
                        ) : warning ? (
                          <span className="badge badge-warning">تنبيه</span>
                        ) : (
                          <span className="badge badge-success">صالح</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {expiryBatches.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-tertiary)' }}>
                      لا توجد دفعات منتهية أو قريبة الانتهاء.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'insights' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {intelLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 12 }}>
              <div className="spinner" style={{ width: 24, height: 24 }} />
              <span className="text-muted">جارٍ تحميل تحليلات الذكاء...</span>
            </div>
          ) : (
            <>
              {/* KPIs (Valuation & Health) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
                <div className="kpi-card">
                  <div>
                    <div className="kpi-label">مؤشر صحة المخزون</div>
                    <div className="kpi-value">{intelInv.healthIndex.score} <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>({intelInv.healthIndex.grade})</span></div>
                    <div className="kpi-sub">جودة دوران الأدوية</div>
                  </div>
                </div>
                <div className="kpi-card">
                  <div>
                    <div className="kpi-label">قيمة المخزون (التكلفة)</div>
                    <div className="kpi-value" style={{ fontSize: 18 }}>{formatCurrency(intelInv.valuation.totalCostValue)}</div>
                    <div className="kpi-sub">المبالغ المدفوعة بالمستودع</div>
                  </div>
                </div>
                <div className="kpi-card">
                  <div>
                    <div className="kpi-label">القيمة المتوقعة للبيع</div>
                    <div className="kpi-value" style={{ fontSize: 18 }}>{formatCurrency(intelInv.valuation.totalRetailValue)}</div>
                    <div className="kpi-sub">إجمالي العوائد المستقبلية</div>
                  </div>
                </div>
                <div className="kpi-card">
                  <div>
                    <div className="kpi-label">إجمالي الأرباح الكامنة</div>
                    <div className="kpi-value" style={{ fontSize: 18, color: 'var(--success)' }}>{formatCurrency(intelInv.valuation.potentialProfit)}</div>
                    <div className="kpi-sub">هامش الربح المخزن</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {/* 1. Fast & Slow Moving Products */}
                <div className="card">
                  <div className="card-header"><span className="card-title">مؤشرات سرعة دوران الأدوية</span></div>
                  <div className="card-body">
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)', marginBottom: 10 }}>الأدوية سريعة الحركة (Fast Moving)</div>
                    <div className="table-wrap" style={{ marginBottom: 20 }}>
                      <table className="table table-dense">
                        <thead>
                          <tr><th>الدواء</th><th>مبيعات 30 يوم</th><th>مخزون</th></tr>
                        </thead>
                        <tbody>
                          {intelInv.fastMoving.slice(0, 5).map(m => (
                            <tr key={m.productId}>
                              <td className="td-primary">{m.productName}</td>
                              <td className="td-num">{m.unitsSoldLast30d}</td>
                              <td className="td-secondary">{m.currentStock}</td>
                            </tr>
                          ))}
                          {intelInv.fastMoving.length === 0 && <tr><td colSpan={3} className="text-center text-muted">لا توجد أدوية سريعة الحركة</td></tr>}
                        </tbody>
                      </table>
                    </div>

                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--warning)', marginBottom: 10 }}>الأدوية بطيئة الحركة (Slow Moving)</div>
                    <div className="table-wrap">
                      <table className="table table-dense">
                        <thead>
                          <tr><th>الدواء</th><th>مبيعات 30 يوم</th><th>مخزون</th></tr>
                        </thead>
                        <tbody>
                          {intelInv.slowMoving.slice(0, 5).map(m => (
                            <tr key={m.productId}>
                              <td className="td-primary">{m.productName}</td>
                              <td className="td-num">{m.unitsSoldLast30d}</td>
                              <td className="td-secondary">{m.currentStock}</td>
                            </tr>
                          ))}
                          {intelInv.slowMoving.length === 0 && <tr><td colSpan={3} className="text-center text-muted">لا توجد أدوية بطيئة الحركة</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* 2. Dead Stock List */}
                <div className="card">
                  <div className="card-header"><span className="card-title">البضاعة الراكدة (Dead Stock)</span></div>
                  <div className="card-body">
                    <div className="table-wrap">
                      <table className="table table-dense">
                        <thead>
                          <tr><th>الدواء</th><th>المخزون الحالي</th><th>قيمة الخسارة المحتملة</th></tr>
                        </thead>
                        <tbody>
                          {intelInv.deadStock.slice(0, 8).map(d => (
                            <tr key={d.productId}>
                              <td className="td-primary">{d.productName}</td>
                              <td className="td-num">{d.currentStock}</td>
                              <td className="td-secondary">{formatCurrency(d.currentStock * d.costPrice)}</td>
                            </tr>
                          ))}
                          {intelInv.deadStock.length === 0 && (
                            <tr><td colSpan={3} className="text-center text-muted" style={{ padding: 24 }}>ممتاز! لا يوجد راكد.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Reorder Suggestions */}
              <div className="card">
                <div className="card-header"><span className="card-title">قائمة المقترحات الذكية لإعادة الطلب</span></div>
                <div className="card-body">
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>الدواء</th>
                          <th>الحالة</th>
                          <th>التبرير الرياضي</th>
                          <th>الكمية المقترحة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {intelInv.reorderList.map(r => (
                          <tr key={r.productId}>
                            <td className="td-primary">{r.productName}</td>
                            <td>
                              <span className={`badge ${r.urgency === 'immediate' ? 'badge-danger' : r.urgency === 'soon' ? 'badge-warning' : 'badge-neutral'}`}>
                                {r.urgency === 'immediate' ? 'عاجل جداً' : r.urgency === 'soon' ? 'قريباً' : 'مخطط'}
                              </span>
                            </td>
                            <td className="td-secondary">{r.reason}</td>
                            <td className="td-num font-bold" style={{ color: 'var(--accent-dark)' }}>{r.suggestedQty} وحدة</td>
                          </tr>
                        ))}
                        {intelInv.reorderList.length === 0 && (
                          <tr><td colSpan={4} className="text-center text-muted" style={{ padding: 24 }}>المخزون آمن حالياً</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}

      {/* Product Modal */}
      <Modal
        open={showProductModal}
        onClose={() => { setShowProductModal(false); setErrors({}); }}
        title={editProduct ? 'تعديل الدواء' : 'إضافة دواء جديد'}
        size="lg"
        footer={
          <>
            <button className="btn btn-primary" onClick={handleSaveProduct}>
              {editProduct ? 'حفظ التعديلات' : 'إضافة الدواء'}
            </button>
            <button className="btn btn-ghost" style={{ color: '#64748B' }} onClick={() => { setShowProductModal(false); setErrors({}); }}>إلغاء</button>
          </>
        }
      >
        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>اسم الدواء *</label>
            <input
              className={`form-input ${errors.name ? 'input-error' : ''}`}
              value={formData.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="أدخل اسم الدواء..."
            />
            {errors.name && <div className="error-text">هذا الحقل مطلوب</div>}
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>الباركود *</label>
            <input
              className={`form-input ${errors.barcode ? 'input-error' : ''}`}
              value={formData.barcode}
              onChange={(e) => setField('barcode', e.target.value)}
              placeholder="أدخل الباركود..."
            />
            {errors.barcode && <div className="error-text">هذا الحقل مطلوب</div>}
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>التصنيف</label>
            <select className="form-input form-select" value={formData.category} onChange={(e) => setField('category', e.target.value)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>الوحدة</label>
            <select className="form-input form-select" value={formData.unit} onChange={(e) => setField('unit', e.target.value)}>
              {UNITS.map((u) => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>سعر البيع (ج.م) *</label>
            <input
              className={`form-input ${errors.unitPrice ? 'input-error' : ''}`}
              type="number"
              min="0"
              step="0.01"
              value={formData.unitPrice || ''}
              disabled={!allowedToEditPrice}
              onChange={(e) => setField('unitPrice', +e.target.value)}
              placeholder="0.00"
              style={{
                background: !allowedToEditPrice ? 'var(--surface-hover)' : 'var(--bg)',
                cursor: !allowedToEditPrice ? 'not-allowed' : 'text'
              }}
            />
            {errors.unitPrice && <div className="error-text">يرجى إدخال سعر صحيح</div>}
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>سعر التكلفة (ج.م)</label>
            <input
              className="form-input"
              type="number"
              min="0"
              step="0.01"
              value={formData.costPrice || ''}
              disabled={!allowedToEditPrice}
              onChange={(e) => setField('costPrice', +e.target.value)}
              placeholder="0.00"
              style={{
                background: !allowedToEditPrice ? 'var(--surface-hover)' : 'var(--bg)',
                cursor: !allowedToEditPrice ? 'not-allowed' : 'text'
              }}
            />
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>الوصف</label>
          <input
            className="form-input"
            value={formData.description}
            onChange={(e) => setField('description', e.target.value)}
            placeholder="وصف مختصر للدواء..."
          />
        </div>
        <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, display: 'flex' }}>
          <label className="switch">
            <input
              type="checkbox"
              id="rxRequired"
              checked={formData.requiresPrescription}
              onChange={(e) => setField('requiresPrescription', e.target.checked)}
            />
            <span className="slider"></span>
          </label>
          <label htmlFor="rxRequired" style={{ fontSize: 13.5, cursor: 'pointer', fontWeight: 600, color: 'var(--text-primary)' }}>
            يلزم روشتة
          </label>
        </div>
      </Modal>

      {/* Batch Modal */}
      <Modal
        open={showBatchModal}
        onClose={() => { setShowBatchModal(false); setBatchErrors({}); }}
        title={`إضافة دفعة — ${products.find((p) => p.id === batchProductId)?.name ?? ''}`}
        size="lg"
        footer={
          <>
            <button className="btn btn-primary" onClick={handleSaveBatch}>إضافة الدفعة</button>
            <button className="btn btn-ghost" style={{ color: '#64748B' }} onClick={() => { setShowBatchModal(false); setBatchErrors({}); }}>إلغاء</button>
          </>
        }
      >
        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>رقم الدفعة *</label>
            <input
              className={`form-input ${batchErrors.lotNumber ? 'input-error' : ''}`}
              value={batchData.lotNumber}
              onChange={(e) => setBatchField('lotNumber', e.target.value)}
              placeholder="أدخل رقم الدفعة..."
            />
            {batchErrors.lotNumber && <div className="error-text">هذا الحقل مطلوب</div>}
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>الكمية المستلمة *</label>
            <input
              className={`form-input ${batchErrors.quantity ? 'input-error' : ''}`}
              type="number"
              min="1"
              value={batchData.quantity || ''}
              onChange={(e) => setBatchField('quantity', +e.target.value)}
              placeholder="1"
            />
            {batchErrors.quantity && <div className="error-text">يرجى إدخال كمية صحيحة</div>}
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>تاريخ الإنتاج</label>
            <input
              className="form-input"
              type="date"
              value={batchData.manufactureDate}
              onChange={(e) => setBatchField('manufactureDate', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>تاريخ الصلاحية *</label>
            <input
              className={`form-input ${batchErrors.expiryDate ? 'input-error' : ''}`}
              type="date"
              value={batchData.expiryDate}
              onChange={(e) => setBatchField('expiryDate', e.target.value)}
            />
            {batchErrors.expiryDate && <div className="error-text">هذا الحقل مطلوب</div>}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>سعر الوحدة (التكلفة)</label>
          <input
            className="form-input"
            type="number"
            min="0"
            step="0.01"
            value={batchData.costPerUnit || ''}
            disabled={!allowedToEditPrice}
            onChange={(e) => setBatchField('costPerUnit', +e.target.value)}
            placeholder="0.00"
            style={{
              background: !allowedToEditPrice ? 'var(--surface-hover)' : 'var(--bg)',
              cursor: !allowedToEditPrice ? 'not-allowed' : 'text'
            }}
          />
        </div>
      </Modal>
    </div>
  );
};

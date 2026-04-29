import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Search, Plus, Trash2, ShoppingBag, X, User, FileText, ChevronDown, ScanLine, CheckCircle, Camera } from 'lucide-react';
import { useInventoryStore } from '../store/useInventoryStore';
import { usePosStore } from '../store/usePosStore';
import { useSalesStore } from '../store/useSalesStore';
import { usePatientStore } from '../store/usePatientStore';
import { usePrescriptionStore } from '../store/usePrescriptionStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { batchService } from '../db/storageService';
import { usePosBarcode } from '../hooks/usePosBarcode';
import type { CartItem, Product } from '../types';
import { useAuthStore, hasPermission } from '../store/useAuthStore';
import { Modal } from '../components/shared/Modal';
import { ReceiptPrint } from '../components/POS/ReceiptPrint';
import { format } from 'date-fns';
import { Html5Qrcode } from 'html5-qrcode';

const formatCurrency = (n: number) =>
  n.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 });

const paymentLabels: Record<string, string> = { cash: 'نقدي', card: 'بطاقة بنكية', insurance: 'تأمين صحي' };

export const POS: React.FC = () => {
  const { currentUser } = useAuthStore();
  const allowedToEditPrice = hasPermission(currentUser, 'canEditPrice');

  const { products, inventory, loadAll: loadInventory } = useInventoryStore();
  const { loadAll: loadSales } = useSalesStore();
  const { patients, loadAll: loadPatients } = usePatientStore();
  const { prescriptions, loadAll: loadPrescriptions } = usePrescriptionStore();
  const { settings, loadSettings } = useSettingsStore();
  const {
    cart, addToCart, updateCartItem, removeFromCart, setDiscount,
    clearCart, getCartTotals, completeSale, processing,
    patientId, setPatient, prescriptionId, setPrescription,
    paymentMethod, setPaymentMethod, notes, setNotes,
  } = usePosStore();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientDrop, setShowPatientDrop] = useState(false);
  const [error, setError] = useState('');
  const [scanToast, setScanToast] = useState<{ text: string; ok: boolean } | null>(null);

  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const startScanning = useCallback(async () => {
    setShowCameraScanner(true);
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("mobile-qr-reader");
        scannerRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            const prod = products.find(p => p.barcode === decodedText);
            if (prod) {
              handleAddToCart(prod);
              stopScanning();
            } else {
              setError(`لم يتم العثور على الباركود: ${decodedText}`);
              stopScanning();
            }
          },
          () => { }
        );
      } catch (err) {
        setError("تعذر تشغيل الكاميرا للمسح");
        setShowCameraScanner(false);
      }
    }, 300);
  }, [products]);

  const stopScanning = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (err) {
        console.error(err);
      }
    }
    setShowCameraScanner(false);
  }, []);

  const searchRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── Barcode scanner (POS context) ────────────────────────────────────────
  usePosBarcode({
    onSuccess: (productName) => {
      clearTimeout(toastTimer.current);
      setScanToast({ text: `✓ تمت إضافة ${productName}`, ok: true });
      toastTimer.current = setTimeout(() => setScanToast(null), 2000);
    },
    onError: (message) => {
      clearTimeout(toastTimer.current);
      setScanToast({ text: message, ok: false });
      toastTimer.current = setTimeout(() => setScanToast(null), 3000);
    },
  });

  useEffect(() => {
    loadInventory();
    loadPatients();
    loadPrescriptions();
    loadSales();
    loadSettings();
    setTimeout(() => searchRef.current?.focus(), 100);
  }, []);

  // F2 = focus search, Escape = clear it
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus(); searchRef.current?.select(); }
      if (e.key === 'Escape' && document.activeElement === searchRef.current) { setSearch(''); searchRef.current?.blur(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  const categories = [...new Set(products.map((p) => p.category))];

  const filtered = products.filter((p) => {
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.includes(search);
    const matchCat = !category || p.category === category;
    return matchSearch && matchCat;
  });

  const getStock = (productId: string) =>
    inventory.find((i) => i.productId === productId)?.totalQuantity ?? 0;

  const handleAddToCart = async (product: Product) => {
    setError('');
    const stock = getStock(product.id);
    if (stock === 0) { setError(`${product.name}: نفد من المخزون`); return; }

    // Get total valid stock across all batches
    const validBatches = await batchService.getValidByProduct(product.id);
    const availableStock = validBatches.reduce((sum, b) => sum + b.remaining, 0);

    if (availableStock === 0) {
      setError(`${product.name}: لا توجد دفعات صالحة (منتهية الصلاحية أو نفدت)`);
      return;
    }

    const item: CartItem = {
      productId: product.id,
      productName: product.name,
      quantity: 1,
      unitPrice: product.unitPrice,
      costPrice: product.costPrice,
      discount: 0,
      availableStock,
    };
    addToCart(item);
  };

  const { subtotal, discount, total, profit } = getCartTotals();

  const handleCompleteSale = async () => {
    setError('');
    try {
      const selectedPatient = patients.find((p) => p.id === patientId);
      const sale = await completeSale(selectedPatient?.name);
      setLastSale(sale);
      setShowReceipt(true);
      loadSales();
      loadInventory();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const selectedPatient = patients.find((p) => p.id === patientId);
  const patientPrescriptions = prescriptions.filter(
    (rx) => rx.patientId === patientId && rx.status === 'pending'
  );

  return (
    <div style={{ marginTop: -8 }}>
      {/* ── Scan Toast — fixed bottom center ───────────────────────────── */}
      {scanToast && (
        <div style={{
          position: 'fixed',
          bottom: 28, left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9000,
          padding: '12px 22px',
          borderRadius: 40,
          fontWeight: 700,
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: 'var(--shadow-lg)',
          animation: 'slideUp 180ms cubic-bezier(.16,1,.3,1)',
          background: scanToast.ok ? 'var(--success)' : 'var(--danger)',
          color: '#fff',
          pointerEvents: 'none',
        }}>
          {scanToast.ok
            ? <CheckCircle size={17} />
            : <X size={17} />}
          {scanToast.text}
        </div>
      )}

      {/* ── Error Banner ─────────────────────────────────────────────── */}
      {error && (
        <div style={{
          background: 'var(--danger-light)', border: '1px solid #FECACA',
          borderRadius: 12, padding: '12px 16px', marginBottom: 16,
          fontSize: 13, color: 'var(--danger)', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between',
          boxShadow: 'var(--shadow)'
        }}>
          {error}
          <button className="btn-ghost btn-sm" onClick={() => setError('')}><X size={14} /></button>
        </div>
      )}

      <style>{`
        .product-card {
          transition: all 150ms ease !important;
        }
        .product-card:hover {
          transform: translateY(-2px) scale(1.01);
          box-shadow: var(--shadow-md) !important;
          border-color: var(--text-secondary) !important;
        }
        .product-card:active {
          transform: scale(0.99);
        }
        .product-card.disabled {
          opacity: 0.5 !important;
          cursor: not-allowed !important;
          transform: none !important;
          box-shadow: none !important;
          border-color: var(--border) !important;
        }
      `}</style>

      {/* 1. TOP Zone: Search + Filters + Scan Indicator */}
      <div className="pos-top-bar" style={{
        display: 'flex',
        gap: 16,
        marginBottom: 24,
        alignItems: 'center',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '16px 20px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        {/* Search Input */}
        <div className="search-wrap" style={{ flex: 1, position: 'relative' }}>
          <Search size={20} style={{
            position: 'absolute',
            right: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-tertiary)'
          }} />
          <input
            ref={searchRef}
            className="form-input search-input"
            placeholder="ابحث باسم الدواء أو امسح الباركود..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filtered.length > 0) {
                const first = filtered[0];
                const stock = getStock(first.id);
                if (stock > 0) {
                  handleAddToCart(first);
                  setSearch('');
                  searchRef.current?.focus();
                }
              }
            }}
            style={{
              paddingRight: 44,
              paddingLeft: 60,
              height: '48px',
              borderRadius: '30px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              fontSize: '15px',
              width: '100%'
            }}
          />
          <div style={{
            position: 'absolute',
            left: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'var(--surface-hover)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '2px 6px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            fontWeight: 600
          }}>
            F2
          </div>
        </div>

        {/* Category Selector */}
        <select
          className="form-input form-select"
          style={{
            width: 200,
            height: '48px',
            borderRadius: '30px',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            padding: '0 16px',
            fontSize: '14px',
            color: 'var(--text-primary)'
          }}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">جميع الأصناف</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Scan Indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 16px',
          height: '48px',
          background: 'var(--surface-hover)',
          borderRadius: '30px',
          border: '1px solid var(--border)',
          fontSize: '13px',
          color: 'var(--success)',
          fontWeight: 600
        }}>
          <ScanLine size={18} />
          <span>جاهز لقراءة الباركود</span>
        </div>
      </div>

      <div className="pos-layout" style={{ display: 'flex', flexDirection: 'row', gap: 24, alignItems: 'flex-start' }}>
        {/* 1. LEFT Zone (30%): Sticky Cart */}
        <div className="pos-cart" style={{
          width: 'calc(30% - 12px)',
          flexShrink: 0,
          background: 'var(--surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          padding: '20px',
          position: 'sticky',
          top: 16,
          height: 'calc(100vh - 32px)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-sm)',
          order: 1
        }}>
          {/* Cart Header */}
          <div style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>قائمة الطلب</span>
                <span style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  borderRadius: '20px',
                  padding: '2px 10px',
                  fontSize: '13px',
                  fontWeight: 700
                }}>
                  {cart.length}
                </span>
              </div>
              {cart.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={clearCart} title="مسح السلة" style={{ color: 'var(--danger)' }}>
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Patient Selector */}
          <div style={{ marginBottom: '16px', position: 'relative' }}>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                border: '1px solid var(--border)', borderRadius: '30px', cursor: 'pointer',
                background: 'var(--surface-hover)', fontSize: '13.5px'
              }}
              onClick={() => setShowPatientDrop(!showPatientDrop)}
            >
              <User size={16} color="var(--text-secondary)" />
              <span style={{ flex: 1, color: selectedPatient ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: selectedPatient ? 700 : 500 }}>
                {selectedPatient ? selectedPatient.name : 'اختيار المريض (اختياري)'}
              </span>
              <ChevronDown size={16} color="var(--text-secondary)" />
            </div>
            {showPatientDrop && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, left: 0, zIndex: 50,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', maxHeight: 200, overflowY: 'auto',
                marginTop: '4px', boxShadow: 'var(--shadow-lg)'
              }}>
                <div style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>
                  <input
                    className="form-input"
                    placeholder="بحث عن مريض..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ borderRadius: '30px', padding: '8px 12px' }}
                  />
                </div>
                <div
                  style={{ padding: '10px 12px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)' }}
                  onClick={() => { setPatient(''); setPrescription(''); setShowPatientDrop(false); setPatientSearch(''); }}
                >
                  عميل عابر
                </div>
                {patients
                  .filter((p) =>
                    !patientSearch ||
                    p.name.includes(patientSearch) ||
                    p.phone.includes(patientSearch)
                  )
                  .map((p) => (
                    <div
                      key={p.id}
                      style={{ padding: '10px 12px', cursor: 'pointer', fontSize: '13px', borderTop: '1px solid var(--border)' }}
                      onClick={() => { setPatient(p.id); setPrescription(''); setShowPatientDrop(false); setPatientSearch(''); }}
                    >
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{p.phone}</div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Prescription Selector */}
          {patientId && patientPrescriptions.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <select
                className="form-input form-select"
                value={prescriptionId}
                onChange={(e) => setPrescription(e.target.value)}
                style={{ borderRadius: 'var(--radius-sm)', padding: '10px', fontSize: '13px' }}
              >
                <option value="">بدون ربط روشتة</option>
                {patientPrescriptions.map((rx) => (
                  <option key={rx.id} value={rx.id}>
                    روشتة د. {rx.doctorName} — {rx.issuedDate}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Cart List Content */}
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px', paddingLeft: '4px' }}>
            {cart.length === 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--text-tertiary)',
                gap: 12
              }}>
                <ShoppingBag size={48} color="var(--border)" />
                <span style={{ fontSize: '15px', fontWeight: 600 }}>السلة فارغة</span>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>ابدأ بإضافة منتج</span>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.productId} style={{
                  padding: '12px',
                  background: 'var(--surface-hover)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      marginBottom: '8px',
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }} title={item.productName}>
                      {item.productName}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={() => updateCartItem(item.productId, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        style={{ width: '28px', height: '28px', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', color: 'var(--text-primary)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 'bold' }}
                      >−</button>
                      <input
                        className="qty-input form-input"
                        type="number"
                        min={1}
                        max={item.availableStock}
                        value={item.quantity}
                        onChange={(e) => updateCartItem(item.productId, +e.target.value)}
                        style={{ width: '48px', height: '28px', padding: '0', textAlign: 'center', fontSize: '13px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)' }}
                      />
                      <button
                        onClick={() => updateCartItem(item.productId, item.quantity + 1)}
                        disabled={item.quantity >= item.availableStock}
                        style={{ width: '28px', height: '28px', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', color: 'var(--text-primary)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 'bold' }}
                      >+</button>

                      <div
                        style={{ marginRight: '8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: '12px' }}
                        title={!allowedToEditPrice ? "تحتاج صلاحية المدير" : undefined}
                      >
                        <span style={{ color: 'var(--text-secondary)', opacity: !allowedToEditPrice ? 0.5 : 1 }}>خصم</span>
                        <input
                          className="qty-input form-input"
                          type="number"
                          min={0}
                          max={100}
                          value={item.discount}
                          disabled={!allowedToEditPrice}
                          onChange={(e) => {
                            if (!allowedToEditPrice) throw new Error("Unauthorized");
                            setDiscount(item.productId, +e.target.value);
                          }}
                          style={{
                            width: '40px', height: '28px', padding: '0', textAlign: 'center', fontSize: '12px',
                            borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)',
                            opacity: !allowedToEditPrice ? 0.5 : 1, cursor: !allowedToEditPrice ? 'not-allowed' : 'text'
                          }}
                        />
                        <span style={{ color: 'var(--text-secondary)', opacity: !allowedToEditPrice ? 0.5 : 1 }}>%</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {formatCurrency(item.unitPrice * item.quantity * (1 - item.discount / 100))}
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => removeFromCart(item.productId)} style={{ padding: '4px', color: 'var(--danger)' }}>
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Cart Footer */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <span>إجمالي قبل الخصم</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: 'var(--danger)' }}>
                <span>الخصم</span>
                <span>− {formatCurrency(discount)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-secondary)' }}>الإجمالي النهائي</span>
              <span style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)' }}>{formatCurrency(total)}</span>
            </div>

            {/* Payment Options */}
            <div style={{ display: 'flex', gap: 8, marginBottom: '16px' }}>
              {(['cash', 'card', 'insurance'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  style={{
                    flex: 1,
                    padding: '10px 0',
                    borderRadius: '30px',
                    fontSize: '13px',
                    fontWeight: paymentMethod === m ? 700 : 500,
                    background: paymentMethod === m ? 'var(--surface-hover)' : 'var(--bg)',
                    color: paymentMethod === m ? 'var(--text-primary)' : 'var(--text-secondary)',
                    border: '1px solid',
                    borderColor: paymentMethod === m ? 'var(--text-primary)' : 'var(--border)',
                    cursor: 'pointer',
                    transition: 'all 150ms ease'
                  }}
                >
                  {paymentLabels[m]}
                </button>
              ))}
            </div>

            <button
              className="btn btn-primary"
              onClick={handleCompleteSale}
              disabled={cart.length === 0 || processing}
              style={{
                borderRadius: '30px',
                padding: '14px',
                fontSize: '16px',
                fontWeight: 800,
                width: '100%',
                height: '52px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: 'var(--shadow)'
              }}
            >
              {processing ? 'جارٍ الحفظ...' : 'إتمام عملية البيع'}
            </button>
          </div>
        </div>

        {/* 2. RIGHT Zone (70%): Product Grid */}
        <div className="pos-products" style={{ width: 'calc(70% - 12px)', flexShrink: 0, order: 2 }}>
          <div className="product-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 24
          }}>
            {filtered.map((product) => {
              const stock = getStock(product.id);
              const outOfStock = stock === 0;
              const isLowStock = stock > 0 && stock <= 10;
              return (
                <div
                  key={product.id}
                  className={`product-card ${outOfStock ? 'disabled' : ''}`}
                  style={{
                    padding: '16px',
                    background: outOfStock ? 'var(--surface-hover)' : 'var(--surface)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    cursor: outOfStock ? 'not-allowed' : 'pointer',
                    opacity: outOfStock ? 0.6 : 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 16,
                    position: 'relative'
                  }}
                  onClick={() => !outOfStock && handleAddToCart(product)}
                >
                  {/* Card Content Top */}
                  <div>
                    <div style={{
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      fontSize: '15px',
                      marginBottom: '4px',
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }} title={product.name}>
                      {product.name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '12px' }}>
                      {product.category}
                    </div>

                    {/* Card Stock Status */}
                    <div style={{
                      fontSize: '13px',
                      fontWeight: isLowStock ? 700 : 500,
                      background: isLowStock ? 'var(--warning-light)' : 'transparent',
                      color: isLowStock ? 'var(--warning)' : 'var(--text-secondary)',
                      padding: isLowStock ? '4px 8px' : '0',
                      borderRadius: isLowStock ? 'var(--radius-sm)' : '0',
                      display: 'inline-block'
                    }}>
                      {outOfStock ? 'نفد المخزون' : `المتاح: ${stock} ${product.unit}`}
                    </div>

                    {product.requiresPrescription && (
                      <div style={{ marginTop: 8 }}>
                        <span style={{
                          background: 'var(--surface-hover)',
                          color: 'var(--text-secondary)',
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border)',
                          fontWeight: 600
                        }}>
                          يلزم روشتة
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Bottom CTA */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    paddingTop: '12px',
                    borderTop: '1px solid var(--border)'
                  }}>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {formatCurrency(product.unitPrice)}
                    </div>
                    <button
                      className="btn btn-primary"
                      style={{
                        width: '100%',
                        height: '36px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        fontWeight: 700,
                        fontSize: '13px'
                      }}
                      disabled={outOfStock}
                      onClick={(e) => { e.stopPropagation(); handleAddToCart(product); }}
                    >
                      <Plus size={16} />
                      إضافة للسلة
                    </button>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="empty-state" style={{
                gridColumn: '1/-1',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 20px',
                color: 'var(--text-tertiary)',
                gap: 16
              }}>
                <ShoppingBag size={64} color="var(--border)" />
                <span style={{ fontSize: '15px', fontWeight: 600 }}>لا توجد أدوية مطابقة</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      <Modal
        open={showReceipt}
        onClose={() => setShowReceipt(false)}
        title="تم إتمام البيع ✓"
        footer={
          <button className="btn btn-primary" onClick={() => setShowReceipt(false)}>
            بيع جديد
          </button>
        }
      >
        {lastSale && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {format(new Date(lastSale.createdAt), 'dd/MM/yyyy HH:mm')}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                رقم الفاتورة: #{lastSale.id.slice(-8).toUpperCase()}
              </div>
            </div>

            <table className="table" style={{ marginBottom: 12 }}>
              <thead>
                <tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr>
              </thead>
              <tbody>
                {lastSale.items.map((item: any) => (
                  <tr key={item.id}>
                    <td>{item.productName}</td>
                    <td>{item.quantity}</td>
                    <td>{formatCurrency(item.unitPrice)}</td>
                    <td>{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <div className="totals-row">
                <span>الإجمالي</span>
                <span className="font-bold" style={{ fontSize: 16 }}>{formatCurrency(lastSale.total)}</span>
              </div>
              <div className="totals-row">
                <span className="text-muted">طريقة الدفع</span>
                <span>{paymentLabels[lastSale.paymentMethod]}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                onClick={() => window.print()}
              >
                طباعة الإيصال
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Hidden Thermal Receipt for Printing */}
      {lastSale && (
        <ReceiptPrint sale={lastSale} pharmacyName={settings?.pharmacyName || 'الصيدلية'} />
      )}
    </div>
  );
};

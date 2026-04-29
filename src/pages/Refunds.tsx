import React, { useEffect, useState } from 'react';
import { RotateCcw, Search, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { salesService, saleItemService, refundService } from '../db/storageService';
import type { Sale, SaleItem, Refund, RefundItem } from '../types';
import { format } from 'date-fns';
import { nanoid } from '../utils/id';
import { buildTimestamps } from '../utils/time';

const formatCurrency = (n: number) =>
  n.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 });

export const Refunds: React.FC = () => {
  const [saleSearch, setSaleSearch] = useState('');
  const [foundSale, setFoundSale] = useState<Sale | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [selectedQtys, setSelectedQtys] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSearch = async () => {
    setError('');
    setFoundSale(null);
    setSaleItems([]);
    setSelectedQtys({});
    const results = await salesService.getAll();
    const sale = results.find(
      (s) => s.id.slice(-8).toUpperCase() === saleSearch.toUpperCase().trim() ||
             s.id === saleSearch.trim()
    );
    if (!sale) {
      setError('لم يتم العثور على فاتورة بهذا الرقم');
      return;
    }
    if (sale.status === 'refunded') {
      setError('هذه الفاتورة تم استردادها مسبقاً');
      return;
    }
    const items = await saleItemService.getBySale(sale.id);
    setFoundSale(sale);
    setSaleItems(items);
    const defaultQtys: Record<string, number> = {};
    items.forEach((i) => { defaultQtys[i.id] = i.quantity; });
    setSelectedQtys(defaultQtys);
  };

  const refundTotal = saleItems.reduce((sum, item) => {
    const qty = selectedQtys[item.id] ?? 0;
    return sum + (item.unitPrice * qty * (1 - item.discount / 100));
  }, 0);

  const handleProcessRefund = async () => {
    if (!foundSale) return;
    if (!reason.trim()) { setError('يرجى إدخال سبب الاسترداد'); return; }
    const hasAny = saleItems.some((i) => (selectedQtys[i.id] ?? 0) > 0);
    if (!hasAny) { setError('يجب اختيار كمية واحدة على الأقل للاسترداد'); return; }

    setLoading(true);
    setError('');
    try {
      const refundId = nanoid();
      const { createdAt: now, dateKey } = buildTimestamps();

      const refundItems: RefundItem[] = saleItems
        .filter((i) => (selectedQtys[i.id] ?? 0) > 0)
        .map((i) => ({
          id: nanoid(),
          refundId,
          saleItemId: i.id,
          productId: i.productId,
          productName: i.productName,
          batchId: i.batchId,
          quantity: selectedQtys[i.id],
          unitPrice: i.unitPrice,
          refundTotal: i.unitPrice * selectedQtys[i.id] * (1 - i.discount / 100),
        }));

      const refund: Refund = {
        id: refundId,
        originalSaleId: foundSale.id,
        items: refundItems,
        reason,
        total: refundTotal,
        paymentMethod: foundSale.paymentMethod,
        createdAt: now,
        dateKey,   // local YYYY-MM-DD for timezone-safe daily filtering
      };

      await refundService.processRefund(refund, refundItems);
      setSuccess(`تم الاسترداد بنجاح — المبلغ المُسترد: ${formatCurrency(refundTotal)}`);
      setFoundSale(null);
      setSaleItems([]);
      setSaleSearch('');
      setReason('');
    } catch (e: any) {
      setError(e.message || 'فشل في معالجة الاسترداد');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 780 }}>


      {/* Search Bar */}
      <div className="card card-p">
        <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 15 }}>بحث عن فاتورة</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <input
            className="form-input"
            style={{ flex: 1 }}
            placeholder="رقم الفاتورة (آخر 8 أرقام أو الرقم الكامل)"
            value={saleSearch}
            onChange={(e) => setSaleSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button className="btn btn-primary" onClick={handleSearch}>
            <Search size={16} />
            بحث
          </button>
        </div>
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

      {/* Found Sale */}
      {foundSale && (
        <div className="card card-p">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>
                فاتورة #{foundSale.id.slice(-8).toUpperCase()}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
                {format(new Date(foundSale.createdAt), 'dd/MM/yyyy HH:mm')}
                {foundSale.patientName && ` — ${foundSale.patientName}`}
              </div>
            </div>
            <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--accent-dark)' }}>
              {formatCurrency(foundSale.total)}
            </div>
          </div>

          <table className="table" style={{ marginBottom: 20 }}>
            <thead>
              <tr>
                <th>الدواء</th>
                <th>الكمية المباعة</th>
                <th>الكمية المُستردة</th>
                <th>المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {saleItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.productName}</td>
                  <td>{item.quantity}</td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={item.quantity}
                      value={selectedQtys[item.id] ?? 0}
                      onChange={(e) =>
                        setSelectedQtys((prev) => ({
                          ...prev,
                          [item.id]: Math.max(0, Math.min(item.quantity, Number(e.target.value))),
                        }))
                      }
                      style={{ width: 70, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, textAlign: 'center' }}
                    />
                  </td>
                  <td>
                    {formatCurrency(item.unitPrice * (selectedQtys[item.id] ?? 0) * (1 - item.discount / 100))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginBottom: 16 }}>
            <label className="form-label" style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>سبب الاسترداد</label>
            <input
              className="form-input"
              placeholder="مثال: دواء تالف، خطأ في الصرف..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>
              إجمالي الاسترداد: <span style={{ color: 'var(--accent-dark)' }}>{formatCurrency(refundTotal)}</span>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setFoundSale(null)}>
                إلغاء
              </button>
              <button
                className="btn btn-danger"
                onClick={handleProcessRefund}
                disabled={loading}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <RotateCcw size={16} />
                {loading ? 'جارٍ المعالجة...' : 'تأكيد الاسترداد'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

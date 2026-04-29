import React, { useEffect, useState } from 'react';
import { useSalesStore } from '../store/useSalesStore';
import { useInventoryStore } from '../store/useInventoryStore';
import { useAccountingStore } from '../store/useAccountingStore';
import { Modal } from '../components/shared/Modal';
import { Plus, Trash2, Wallet, ArrowUpRight, ArrowDownRight, TrendingUp, BarChart2, Package, Activity } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import { format, subDays } from 'date-fns';

const formatCurrency = (n: number) =>
  n.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 });

type Period = '7' | '30' | '90';

export const Reports: React.FC = () => {
  const { loadAll: loadSales, getDailySummary, getTopProducts, getTotalRevenue, getTotalProfit, sales } = useSalesStore();
  const { loadAll: loadInventory, products, inventory } = useInventoryStore();
  const { transactions, addTransaction, deleteTransaction, setOpeningBalance, getDailyAccounting } = useAccountingStore();

  const [period, setPeriod] = useState<Period>('7');
  const [reportTab, setReportTab] = useState<'analytical' | 'accounting'>('analytical');
  const [activeKPI, setActiveKPI] = useState<'REVENUE' | 'PROFIT' | 'COUNT' | 'AVERAGE' | null>(null);

  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [newTxType, setNewTxType] = useState<'income' | 'expense'>('income');
  const [newTxAmount, setNewTxAmount] = useState<string>('');
  const [newTxDesc, setNewTxDesc] = useState<string>('');
  const [openingInput, setOpeningInput] = useState<string>('');
  const [showAddTxModal, setShowAddTxModal] = useState<boolean>(false);

  useEffect(() => {
    loadSales();
    loadInventory();
  }, []);

  const days = parseInt(period);
  const dailyData = getDailySummary(days);
  const topProducts = getTopProducts(10);
  const totalRevenue = getTotalRevenue();
  const totalProfit = getTotalProfit();
  const totalSales = sales.filter((s) => s.status === 'completed').length;
  const avgSaleValue = totalSales > 0 ? totalRevenue / totalSales : 0;
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  // Inventory valuation
  const inventoryValue = inventory.reduce((sum, inv) => {
    const product = products.find((p) => p.id === inv.productId);
    return sum + (product?.costPrice ?? 0) * inv.totalQuantity;
  }, 0);
  const inventorySaleValue = inventory.reduce((sum, inv) => {
    const product = products.find((p) => p.id === inv.productId);
    return sum + (product?.unitPrice ?? 0) * inv.totalQuantity;
  }, 0);

  const dateSales = sales.filter(s => s.status === 'completed' && s.createdAt.startsWith(selectedDate));
  const dateSalesRevenue = dateSales.reduce((sum, s) => sum + s.total, 0);

  const accounting = getDailyAccounting(selectedDate, dateSalesRevenue);
  const dateTxs = transactions.filter(t => t.createdAt.startsWith(selectedDate));

  const chartData = dailyData.map((d) => ({
    date: format(new Date(d.date + 'T00:00:00'), 'MM/dd'),
    إيرادات: Math.round(d.totalRevenue),
    أرباح: Math.round(d.totalProfit),
    'عدد المبيعات': d.totalSales,
  }));

  return (
    <div>
      {/* KPI Details Modal */}
      {activeKPI && (
        <Modal
          open={activeKPI !== null}
          onClose={() => setActiveKPI(null)}
          title={
            activeKPI === 'REVENUE' ? 'تفاصيل الإيرادات' :
              activeKPI === 'PROFIT' ? 'تفاصيل صافي الربح' :
                activeKPI === 'COUNT' ? 'سجل العمليات' :
                  'متوسط القيمة'
          }
          size="lg"
        >
          <div className="table-wrap" style={{ maxHeight: 400, overflowY: 'auto' }}>
            <table className="table">
              <thead>
                <tr style={{ background: 'var(--surface-hover)', position: 'sticky', top: 0, zIndex: 10, fontSize: '13px' }}>
                  <th style={{ textAlign: 'right', padding: '12px 16px' }}>التاريخ</th>
                  <th style={{ textAlign: 'center', padding: '12px 16px' }}>العمليات</th>
                  <th style={{ textAlign: 'center', padding: '12px 16px' }}>القيمة</th>
                </tr>
              </thead>
              <tbody>
                {dailyData.map(d => (
                  <tr key={d.date} style={{ transition: 'all 150ms ease', borderBottom: '1px solid var(--border)' }} className="inventory-row-hover">
                    <td style={{ textAlign: 'right', padding: '14px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>{d.date}</td>
                    <td style={{ textAlign: 'center', padding: '14px 16px', color: 'var(--text-secondary)' }}>{d.totalSales} مبيعات</td>
                    <td style={{ textAlign: 'center', padding: '14px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {formatCurrency(activeKPI === 'REVENUE' ? d.totalRevenue : activeKPI === 'PROFIT' ? d.totalProfit : activeKPI === 'AVERAGE' ? (d.totalSales > 0 ? d.totalRevenue / d.totalSales : 0) : d.totalSales)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div className="tab-bar" style={{ marginBottom: 0 }}>
          <button
            onClick={() => setReportTab('analytical')}
            className={`tab-btn ${reportTab === 'analytical' ? 'active' : ''}`}
          >
            التقارير التحليلية
          </button>
          <button
            onClick={() => setReportTab('accounting')}
            className={`tab-btn ${reportTab === 'accounting' ? 'active' : ''}`}
          >
            الخزنة اليومية (الحسابات)
          </button>
        </div>

        {reportTab === 'analytical' ? (
          <div className="tab-bar" style={{ marginBottom: 0 }}>
            {([['7', 'أسبوع'], ['30', 'شهر'], ['90', '3 أشهر']] as [Period, string][]).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setPeriod(val)}
                className={`tab-btn ${period === val ? 'active' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setOpeningInput('');
            }}
            style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: '30px', fontSize: '13.5px', background: 'var(--surface)', color: 'var(--text-primary)' }}
          />
        )}
      </div>

      {reportTab === 'analytical' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 32 }}>
            <div
              className="kpi-card"
              onClick={() => setActiveKPI('REVENUE')}
              style={{ cursor: 'pointer', transition: 'all 150ms ease', background: 'var(--surface)', border: '1px solid var(--border)', padding: '24px', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>إجمالي الإيرادات</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>{formatCurrency(totalRevenue)}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{totalSales} فاتورة مكتملة</div>
              </div>
              <div style={{ background: 'var(--surface-hover)', borderRadius: '12px', padding: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={24} />
              </div>
            </div>

            <div
              className="kpi-card"
              onClick={() => setActiveKPI('PROFIT')}
              style={{ cursor: 'pointer', transition: 'all 150ms ease', background: 'var(--surface)', border: '1px solid var(--border)', padding: '24px', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: '13px', color: 'var(--success)', fontWeight: 600 }}>إجمالي الأرباح</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--success)' }}>{formatCurrency(totalProfit)}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>هامش الربح: {profitMargin.toFixed(1)}%</div>
              </div>
              <div style={{ background: 'var(--success-bg)', borderRadius: '12px', padding: '12px', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Activity size={24} />
              </div>
            </div>

            <div
              className="kpi-card"
              onClick={() => setActiveKPI('AVERAGE')}
              style={{ cursor: 'pointer', transition: 'all 150ms ease', background: 'var(--surface)', border: '1px solid var(--border)', padding: '24px', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>متوسط الفاتورة</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>{formatCurrency(avgSaleValue)}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>لكل عملية بيع</div>
              </div>
              <div style={{ background: 'var(--surface-hover)', borderRadius: '12px', padding: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BarChart2 size={24} />
              </div>
            </div>

            <div
              className="kpi-card"
              onClick={() => setActiveKPI('COUNT')}
              style={{ cursor: 'pointer', transition: 'all 150ms ease', background: 'var(--surface)', border: '1px solid var(--border)', padding: '24px', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>قيمة المخزون (تكلفة)</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>{formatCurrency(inventoryValue)}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>البيع: {formatCurrency(inventorySaleValue)}</div>
              </div>
              <div style={{ background: 'var(--surface-hover)', borderRadius: '12px', padding: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={24} />
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
            {/* Revenue & Profit Line */}
            <div className="card" style={{ padding: '24px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ paddingBottom: '16px', marginBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>الإيرادات والأرباح اليومية</span>
              </div>
              <div style={{ paddingTop: 8 }}>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={chartData}>
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} hide />
                    <Tooltip
                      contentStyle={{ border: 'none', borderRadius: 12, boxShadow: 'var(--shadow-md)', fontSize: 12 }}
                      formatter={(val: any) => [`${Number(val).toLocaleString('ar-EG')} ج.م`]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} iconType="circle" />
                    <Line dataKey="إيرادات" name="الإيرادات" stroke="#002B2B" strokeWidth={3} dot={false} />
                    <Line dataKey="أرباح" name="الأرباح" stroke="#A1A1AA" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Sales Count Bar */}
            <div className="card" style={{ padding: '24px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ paddingBottom: '16px', marginBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>عدد المبيعات اليومي</span>
              </div>
              <div style={{ paddingTop: 8 }}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartData}>
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} allowDecimals={false} hide />
                    <Tooltip contentStyle={{ border: 'none', borderRadius: 12, boxShadow: 'var(--shadow-md)', fontSize: 12 }} />
                    <Bar dataKey="عدد المبيعات" name="عدد المبيعات" fill="#002B2B" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Top Products */}
          <div className="card card-table">
            <div className="card-header">
              <span className="card-title">الأدوية الأكثر مبيعاً</span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>اسم الدواء</th>
                    <th>الكمية المباعة</th>
                    <th>الإيرادات</th>
                    <th>الأرباح</th>
                    <th>هامش الربح</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)' }}>
                        لا توجد مبيعات بعد
                      </td>
                    </tr>
                  ) : (
                    topProducts.map((p, idx) => {
                      const margin = p.totalRevenue > 0 ? (p.totalProfit / p.totalRevenue) * 100 : 0;
                      return (
                        <tr key={p.productId}>
                          <td style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{idx + 1}</td>
                          <td style={{ fontWeight: 500 }}>{p.productName}</td>
                          <td>{p.totalQuantity.toLocaleString('ar-EG')}</td>
                          <td className="font-bold">{formatCurrency(p.totalRevenue)}</td>
                          <td className="text-success">{formatCurrency(p.totalProfit)}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 99 }}>
                                <div style={{ width: `${Math.min(margin, 100)}%`, height: '100%', background: 'var(--success)', borderRadius: 99 }} />
                              </div>
                              <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 36 }}>
                                {margin.toFixed(1)}%
                              </span>
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

          {/* All Sales Table */}
          <div className="card card-table">
            <div className="card-header">
              <span className="card-title">سجل المبيعات الكامل</span>
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{sales.length} فاتورة</span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>رقم الفاتورة</th>
                    <th>التاريخ</th>
                    <th>المريض</th>
                    <th>المنتجات</th>
                    <th>الإجمالي</th>
                    <th>الربح</th>
                    <th>طريقة الدفع</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.slice(0, 50).map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 11.5, color: 'var(--text-secondary)' }}>
                        #{s.id.slice(-6).toUpperCase()}
                      </td>
                      <td style={{ fontSize: 12.5 }}>
                        {format(new Date(s.createdAt), 'dd/MM/yyyy HH:mm')}
                      </td>
                      <td>{s.patientName || <span className="text-muted">عميل عادي</span>}</td>
                      <td style={{ fontSize: 12.5 }}>{s.items.length} صنف</td>
                      <td className="font-bold">{formatCurrency(s.total)}</td>
                      <td className="text-success">{formatCurrency(s.profit)}</td>
                      <td>
                        <span className="badge badge-neutral">
                          {s.paymentMethod === 'cash' ? 'نقدي' : s.paymentMethod === 'card' ? 'بطاقة' : 'تأمين'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {sales.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)' }}>
                        لا توجد مبيعات
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Accounting Dashboard Layer */}

          {/* Daily Summary KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
            <div className="card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '20px', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>رصيد أول اليوم</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>{formatCurrency(accounting.openingBalance)}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <input
                  type="number"
                  placeholder="تعديل الرصيد..."
                  value={openingInput}
                  onChange={(e) => setOpeningInput(e.target.value)}
                  style={{ flex: 1, padding: '4px 10px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '12px', background: 'var(--surface)', color: 'var(--text-primary)' }}
                />
                <button
                  onClick={() => {
                    if (openingInput !== '') {
                      setOpeningBalance(selectedDate, parseFloat(openingInput));
                      setOpeningInput('');
                    }
                  }}
                  className="btn btn-sm btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                >
                  حفظ
                </button>
              </div>
            </div>

            <div className="card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '20px', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>إجمالي المبيعات (النقدي)</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>{formatCurrency(accounting.totalSales)}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: 4 }}>{dateSales.length} عملية بيع مكتملة</div>
            </div>

            <div className="card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '20px', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>حركة عوائد أخرى / مصروفات</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ArrowUpRight size={14} /> +{formatCurrency(accounting.totalIncome)}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--error)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ArrowDownRight size={14} /> -{formatCurrency(accounting.totalExpenses)}
                </div>
              </div>
            </div>

            <div className="card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '20px', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>الرصيد النهائي (الخزنة)</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>{formatCurrency(accounting.closingBalance)}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: 4 }}>توازن تلقائي للحركة اليومية</div>
            </div>
          </div>

          {/* Transactions Ledger */}
          <div className="card card-table" style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: 24, borderRadius: 'var(--radius-md)' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0 16px', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
              <span className="card-title" style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Wallet size={20} /> دفتر العمليات اليومية
              </span>
              <button onClick={() => setShowAddTxModal(true)} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={16} /> إضافة معاملة
              </button>
            </div>

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>البيان</th>
                    <th>النوع</th>
                    <th>المبلغ</th>
                    <th>الوقت</th>
                    <th>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {dateTxs.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)' }}>
                        لا توجد معاملات مسجلة لهذا اليوم.
                      </td>
                    </tr>
                  ) : (
                    dateTxs.map(tx => (
                      <tr key={tx.id}>
                        <td style={{ fontWeight: 500 }}>{tx.description}</td>
                        <td>
                          <span className={`badge ${tx.type === 'income' ? 'badge-success' : 'badge-danger'}`} style={{ color: tx.type === 'income' ? 'var(--success)' : 'var(--error)' }}>
                            {tx.type === 'income' ? 'دخل' : 'مصروفات'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, color: tx.type === 'income' ? 'var(--success)' : 'var(--text-primary)' }}>{formatCurrency(tx.amount)}</td>
                        <td style={{ fontSize: 12 }}>{format(new Date(tx.createdAt), 'HH:mm')}</td>
                        <td>
                          <button onClick={() => deleteTransaction(tx.id)} className="btn btn-ghost" style={{ padding: 4, color: 'var(--error)' }}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add Transaction Modal */}
          {showAddTxModal && (
            <Modal open={showAddTxModal} onClose={() => setShowAddTxModal(false)} title="تسجيل حركة خزنة جديدة">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '10px 0' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>النوع</label>
                  <select
                    className="form-input form-select"
                    value={newTxType}
                    onChange={(e) => setNewTxType(e.target.value as 'income' | 'expense')}
                    style={{ width: '100%', padding: '10px' }}
                  >
                    <option value="income">إيرادات / دخل (Income)</option>
                    <option value="expense">مصروفات (Expense)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>المبلغ</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="0.00"
                    value={newTxAmount}
                    onChange={(e) => setNewTxAmount(e.target.value)}
                    style={{ width: '100%', padding: '10px' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>الوصف / البيان</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="رواتب، فواتير كهرباء، إيداع..."
                    value={newTxDesc}
                    onChange={(e) => setNewTxDesc(e.target.value)}
                    style={{ width: '100%', padding: '10px' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                  <button className="btn btn-secondary" onClick={() => setShowAddTxModal(false)}>إلغاء</button>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      if (newTxAmount !== '' && newTxDesc !== '') {
                        addTransaction(newTxType, parseFloat(newTxAmount), newTxDesc);
                        setNewTxAmount('');
                        setNewTxDesc('');
                        setShowAddTxModal(false);
                      }
                    }}
                  >
                    إضافة للحسابات
                  </button>
                </div>
              </div>
            </Modal>
          )}
        </div>
      )}
    </div>
  );
};

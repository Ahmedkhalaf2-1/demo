import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useIntelligence } from '../intelligence/useIntelligence';
import { useAppStore } from '../store/useAppStore';
import { useSalesStore } from '../store/useSalesStore';
import { useInventoryStore } from '../store/useInventoryStore';
import { Modal } from '../components/shared/Modal';
import { eventBus } from '../domain/eventBus';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Package, ShoppingBag, DollarSign, Activity, Zap, Play, Radio, ShoppingCart } from 'lucide-react';
import { HiOutlineBanknotes, HiOutlineArrowTrendingUp, HiOutlineCube, HiOutlineExclamationTriangle, HiOutlineBolt } from 'react-icons/hi2';

const fmt = (n: number) =>
  n.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 });

const fmtNum = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 1 });

function GrowthBadge({ pct }: { pct: number }) {
  if (pct > 0) return <span className="badge badge-success">+{fmtNum(pct)}%</span>;
  if (pct < 0) return <span className="badge badge-danger">{fmtNum(pct)}%</span>;
  return <span className="badge badge-neutral">ثابت</span>;
}

function UrgencyBadge({ urgency }: { urgency: string }) {
  if (urgency === 'critical' || urgency === 'immediate') return <span className="badge badge-danger">{urgency === 'immediate' ? 'فوري' : 'حرج'}</span>;
  if (urgency === 'high' || urgency === 'soon') return <span className="badge badge-warning">{urgency === 'soon' ? 'قريب' : 'مرتفع'}</span>;
  return <span className="badge badge-neutral">مخطط</span>;
}

// ── Reusable panel card ─────────────────────────────────────────────────────
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">{title}</span>
      </div>
      <div className="card-body">{children}</div>
    </div>
  );
}

// ── Stat row inside a panel ─────────────────────────────────────────────────
function StatRow({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="stat-row">
      <span className="stat-row-label">{label}</span>
      <span className="stat-row-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {value}{sub && <span style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--text-tertiary)' }}>{sub}</span>}
      </span>
    </div>
  );
}

// ── Section heading ─────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="section-label mb-4 mt-1">
      {children}
    </div>
  );
}

interface KPIDetailsModalProps {
  type: null | "REVENUE_TODAY" | "PROFIT_TODAY" | "LOW_STOCK" | "CRITICAL_STOCK" | "PREDICTED_SHORTAGE";
  onClose: () => void;
}

const KPIDetailsModal: React.FC<KPIDetailsModalProps> = ({ type, onClose }) => {
  const { getTodaySales } = useSalesStore();
  const { inventory: inventoryState } = useInventoryStore();
  const { inventory: intelInv, predictive } = useIntelligence();

  if (!type) return null;

  let title = '';
  let content = null;

  const todaySales = getTodaySales();

  if (type === 'REVENUE_TODAY') {
    title = 'إيرادات اليوم';
    const totalRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
    content = (
      <div className="flex-col gap-6">
        <div className="p-6 text-center flex-col gap-2 items-center" style={{
          background: 'var(--surface-hover)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)',
        }}>
          <div className="text-sm text-secondary font-medium">إجمالي إيرادات اليوم</div>
          <div className="text-display color-primary">{fmt(totalRevenue)}</div>
        </div>

        {todaySales.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">لا توجد مبيعات</div>
            <div className="empty-state-text">لم يتم تسجيل أي فواتير بيع اليوم.</div>
          </div>
        ) : (
          <div className="table-wrap" style={{ maxHeight: '350px', overflowY: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ textAlign: 'right', padding: '12px 8px', color: 'var(--text-secondary)', fontSize: 13 }}>رقم الفاتورة</th>
                  <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-secondary)', fontSize: 13 }}>الوقت</th>
                  <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-secondary)', fontSize: 13 }}>عدد الأصناف</th>
                  <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-secondary)', fontSize: 13 }}>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {todaySales.map((sale, i) => (
                  <tr key={sale.id} className="hover-row" style={{ borderBottom: i === todaySales.length - 1 ? 'none' : '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>INV-{sale.id.slice(-6).toUpperCase()}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>{new Date(sale.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>{sale.items.length}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 600 }}>{fmt(sale.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  } else if (type === 'PROFIT_TODAY') {
    title = 'صافي الربح اليوم';
    const totalRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
    const totalProfit = todaySales.reduce((sum, s) => sum + s.profit, 0);
    const totalCost = totalRevenue - totalProfit;

    content = (
      <div className="flex-col gap-6">
        <div className="p-6 text-center flex-col gap-2 items-center" style={{
          background: 'var(--surface-hover)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)',
        }}>
          <div className="text-sm text-secondary font-medium">صافي الربح الفعلي اليوم</div>
          <div className="text-display" style={{ color: totalProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {fmt(totalProfit)}
          </div>
        </div>

        <div className="table-wrap" style={{ maxHeight: '350px', overflowY: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ textAlign: 'right', padding: '12px 8px', color: 'var(--text-secondary)', fontSize: 13 }}>البيان</th>
                <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-secondary)', fontSize: 13 }}>القيمة</th>
              </tr>
            </thead>
            <tbody>
              <tr className="hover-row" style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--text-primary)' }}>إجمالي المبيعات</td>
                <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-primary)', fontWeight: 600 }}>{fmt(totalRevenue)}</td>
              </tr>
              <tr className="hover-row" style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--text-primary)' }}>إجمالي التكلفة</td>
                <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-primary)' }}>{fmt(totalCost)}</td>
              </tr>
              <tr className="hover-row" style={{ borderBottom: 'none' }}>
                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>صافي الربح المتوقع</td>
                <td style={{
                  padding: '12px 8px',
                  textAlign: 'center',
                  fontWeight: 700,
                  fontSize: 16,
                  color: totalProfit >= 0 ? 'var(--success)' : 'var(--danger)'
                }}>
                  {fmt(totalProfit)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  } else if (type === 'LOW_STOCK') {
    title = 'المخزون المنخفض (أقل من الحد الأدنى)';
    const lowStockItems = intelInv.velocities.filter(v => {
      const inv = inventoryState.find(i => i.productId === v.productId);
      return v.currentStock <= (inv?.minStock ?? 0);
    });

    content = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{
          background: 'var(--surface-hover)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '24px 16px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          alignItems: 'center'
        }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>إجمالي المنتجات منخفضة المخزون</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--warning)', letterSpacing: '-0.5px' }}>{lowStockItems.length}</div>
        </div>

        {lowStockItems.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">المخزون ممتاز</div>
            <div className="empty-state-text">لا توجد منتجات تحت الحد الأدنى للمخزون.</div>
          </div>
        ) : (
          <div className="table-wrap" style={{ maxHeight: '350px', overflowY: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ textAlign: 'right', padding: '12px 8px', color: 'var(--text-secondary)', fontSize: 13 }}>اسم المنتج</th>
                  <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-secondary)', fontSize: 13 }}>الكمية الحالية</th>
                  <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-secondary)', fontSize: 13 }}>الحد الأدنى</th>
                  <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-secondary)', fontSize: 13 }}>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {lowStockItems.map((item, i) => {
                  const inv = inventoryState.find(i => i.productId === item.productId);
                  const isCritical = item.currentStock <= (inv?.minStock ?? 0) * 0.5;
                  return (
                    <tr key={item.productId} className="hover-row" style={{ borderBottom: i === lowStockItems.length - 1 ? 'none' : '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600 }}>{item.productName}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'center', color: item.currentStock === 0 ? 'var(--danger)' : 'inherit' }}>{item.currentStock}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>{inv?.minStock ?? 0}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <span className={`badge badge-${isCritical ? 'danger' : 'warning'}`}>
                          {isCritical ? 'حرج' : 'منخفض'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  } else if (type === 'CRITICAL_STOCK') {
    title = 'المخزون الحرج (أقل من 50% من الحد الأدنى)';
    const criticalStockItems = intelInv.velocities.filter(v => {
      const inv = inventoryState.find(i => i.productId === v.productId);
      return v.currentStock <= (inv?.minStock ?? 0) * 0.5;
    });

    content = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{
          background: 'var(--surface-hover)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '24px 16px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          alignItems: 'center'
        }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>إجمالي الحالات الحرجة</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--danger)', letterSpacing: '-0.5px' }}>{criticalStockItems.length}</div>
        </div>

        {criticalStockItems.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">لا توجد حالات حرجة</div>
            <div className="empty-state-text">جميع الأصناف بمستويات مقبولة.</div>
          </div>
        ) : (
          <div className="table-wrap" style={{ maxHeight: '350px', overflowY: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ textAlign: 'right', padding: '12px 8px', color: 'var(--text-secondary)', fontSize: 13 }}>اسم المنتج</th>
                  <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-secondary)', fontSize: 13 }}>الكمية</th>
                  <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-secondary)', fontSize: 13 }}>الحد الأدنى</th>
                  <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-secondary)', fontSize: 13 }}>الخطورة</th>
                </tr>
              </thead>
              <tbody>
                {criticalStockItems.map((item, i) => {
                  const inv = inventoryState.find(i => i.productId === item.productId);
                  return (
                    <tr key={item.productId} className="hover-row" style={{ borderBottom: i === criticalStockItems.length - 1 ? 'none' : '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600 }}>{item.productName}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--danger)' }}>{item.currentStock}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>{inv?.minStock ?? 0}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <span className="badge badge-danger">حرج</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  } else if (type === 'PREDICTED_SHORTAGE') {
    title = 'النقص المتوقع خلال 30 يوماً';
    const alerts = predictive.shortageAlerts;

    content = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{
          background: 'var(--surface-hover)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '24px 16px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          alignItems: 'center'
        }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>عجز متوقع خلال 30 يوماً</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--danger)', letterSpacing: '-0.5px' }}>{alerts.length}</div>
        </div>

        {alerts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">لا توجد تنبؤات بالنقص</div>
            <div className="empty-state-text">توقعات الطلب لا تشير لأي عجز خلال 30 يوماً.</div>
          </div>
        ) : (
          <div className="table-wrap" style={{ maxHeight: '350px', overflowY: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ textAlign: 'right', padding: '12px 8px', color: 'var(--text-secondary)', fontSize: 13 }}>اسم المنتج</th>
                  <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-secondary)', fontSize: 13 }}>الأيام المتبقية</th>
                  <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-secondary)', fontSize: 13 }}>الطلب المتوقع (30 يوماً)</th>
                  <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-secondary)', fontSize: 13 }}>مستوى الثقة</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((item, i) => (
                  <tr key={item.productId} className="hover-row" style={{ borderBottom: i === alerts.length - 1 ? 'none' : '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600 }}>{item.productName}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', color: item.daysUntilEmpty <= 7 ? 'var(--danger)' : 'var(--warning)', fontWeight: 600 }}>{item.daysUntilEmpty}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>{Math.round(item.velocity30d * 30)}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      <span className={`badge badge-${item.confidence === 'high' ? 'success' : item.confidence === 'medium' ? 'warning' : 'neutral'}`}>
                        {item.confidence === 'high' ? 'عالية' : item.confidence === 'medium' ? 'متوسطة' : 'منخفضة'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <Modal open={true} onClose={onClose} title={title} size="lg">
      {content}
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

export const Dashboard: React.FC = () => {
  const { inventory, sales, financial, predictive, isLoading } = useIntelligence();
  const { inventory: inventoryState } = useInventoryStore();
  const { setPage: setActivePage } = useAppStore();
  const [liveEvents, setLiveEvents] = React.useState<any[]>([]);
  const [activeKPI, setActiveKPI] = React.useState<null | "REVENUE_TODAY" | "PROFIT_TODAY" | "LOW_STOCK" | "CRITICAL_STOCK" | "PREDICTED_SHORTAGE">(null);

  React.useEffect(() => {
    const pushEvent = (type: string, details: string) => {
      setLiveEvents((prev) => [{ type, details, time: new Date().toLocaleTimeString('ar-EG') }, ...prev].slice(0, 15));
    };

    const unsubscribers = [
      eventBus.on('sale:created', (p) => pushEvent('بيع مكتمل', `فاتورة بقيمة ${fmt(p.total)}`)),
      eventBus.on('sale:refunded', (p) => pushEvent('مرتجع', `استرداد فاتورة بقيمة ${fmt(p.refundTotal)}`)),
      eventBus.on('stock:updated', (p) => pushEvent('تحديث مخزون', `${p.productName}: ${p.delta > 0 ? '+' : ''}${p.delta} (${p.reason})`)),
      eventBus.on('purchase:created', (p) => pushEvent('شراء', `توريد من ${p.supplierName} بقيمة ${fmt(p.totalCost)}`)),
    ];
    return () => unsubscribers.forEach((off) => off());
  }, []);

  // ── Derive today KPIs from financial daily P&L ─────────────────────────
  const todayPnL = financial.dailyPnL[financial.dailyPnL.length - 1];
  const todayRev = todayPnL?.revenue ?? 0;
  const todayProfit = todayPnL?.grossProfit ?? 0;

  const lowStockCount = inventory.velocities.filter(v => {
    const inv = inventoryState.find(i => i.productId === v.productId);
    return v.currentStock <= (inv?.minStock ?? 0);
  }).length;

  const criticalStockCount = inventory.velocities.filter(v => {
    const inv = inventoryState.find(i => i.productId === v.productId);
    return v.currentStock <= (inv?.minStock ?? 0) * 0.5;
  }).length;

  const criticalShortages = predictive.systemHealth.criticalShortages;

  // ── Chart data for P&L panel ───────────────────────────────────────────
  const chartData = financial.dailyPnL.slice(-7).map(d => ({
    day: d.dateKey.slice(5),
    'إيرادات': Math.round(d.revenue),
    'أرباح': Math.round(d.grossProfit),
  }));

  // ── Peak hour ─────────────────────────────────────────────────────────
  const peakHour = sales.peakHours[0];

  if (isLoading) {
    return (
      <div className="flex-col items-center justify-center gap-4" style={{ height: '60vh' }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
        <span className="text-muted text-sm">جارٍ تحليل بيانات الصيدلية...</span>
      </div>
    );
  }

  return (
    <div>
      {/* ═══════════════════════════════════════════════════════════
          SECTION 1 — KPI STRIP
      ═══════════════════════════════════════════════════════════ */}
      <div className="grid-5 mb-8">

        <div className="kpi-card" onClick={() => setActiveKPI('REVENUE_TODAY')}>
          <div className="flex-col">
            <div className="kpi-label">إيرادات اليوم</div>
            <div className="kpi-value">{fmt(todayRev)}</div>
            <div className="kpi-sub">إجمالي 30 يوم: {fmt(financial.last30Summary.totalCashIn)}</div>
          </div>
          <div className="kpi-icon" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <HiOutlineBanknotes size={24} color="var(--text-secondary)" />
          </div>
        </div>

        <div className="kpi-card" onClick={() => setActiveKPI('PROFIT_TODAY')}>
          <div className="flex-col">
            <div className="kpi-label">صافي الربح اليوم</div>
            <div className="kpi-value">{fmt(todayProfit)}</div>
            <div className="kpi-sub">هامش: {todayRev > 0 ? fmtNum((todayProfit / todayRev) * 100) : 0}%</div>
          </div>
          <div className="kpi-icon" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <HiOutlineArrowTrendingUp size={24} color="var(--text-secondary)" />
          </div>
        </div>

        <div className="kpi-card" onClick={() => setActiveKPI('LOW_STOCK')}>
          <div className="flex-col">
            <div className="kpi-label">مخزون منخفض</div>
            <div className="kpi-value" style={{ color: lowStockCount > 0 ? 'var(--danger)' : undefined }}>
              {lowStockCount}
            </div>
            <div className="kpi-sub">نفد: {inventory.velocities.filter(v => v.status === 'out').length} منتج</div>
          </div>
          <div className="kpi-icon" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <HiOutlineCube size={24} color="var(--text-secondary)" />
          </div>
        </div>

        <div className="kpi-card" onClick={() => setActiveKPI('CRITICAL_STOCK')}>
          <div className="flex-col">
            <div className="kpi-label">مخزون حرج</div>
            <div className="kpi-value" style={{ color: criticalStockCount > 0 ? 'var(--danger)' : undefined }}>
              {criticalStockCount}
            </div>
            <div className="kpi-sub">يحتاج لطلب شراء فوري</div>
          </div>
          <div className="kpi-icon" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <HiOutlineExclamationTriangle size={24} color="var(--text-secondary)" />
          </div>
        </div>

        <div className="kpi-card" onClick={() => setActiveKPI('PREDICTED_SHORTAGE')}>
          <div className="flex-col">
            <div className="kpi-label">نقص متوقع (7 أيام)</div>
            <div className="kpi-value" style={{ color: criticalShortages > 0 ? 'var(--danger)' : undefined }}>
              {criticalShortages}
            </div>
            <div className="kpi-sub">{predictive.shortageAlerts.length} تنبيه إجمالاً</div>
          </div>
          <div className="kpi-icon" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <HiOutlineBolt size={24} color="var(--text-secondary)" />
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 2 — INTELLIGENCE PANELS (3-col)
      ═══════════════════════════════════════════════════════════ */}
      <div className="grid-3 mb-8">

        {/* A) Inventory Intelligence */}
        <Panel title=" المخزون">
          <StatRow
            label="مؤشر صحة المخزون"
            value={
              <span style={{ fontWeight: 800, fontSize: 18 }}>
                {inventory.healthIndex.score}
                <span style={{ fontSize: 13, marginRight: 4, color: 'var(--text-secondary)' }}>/ 100 ({inventory.healthIndex.grade})</span>
              </span>
            }
          />
          <StatRow label="سريعة الحركة" value={`${inventory.fastMoving.length} دواء`} />
          <StatRow label="بضاعة راكدة" value={`${inventory.deadStock.length} دواء`} />
          <StatRow label="قيمة المخزون (التكلفة)" value={fmt(inventory.valuation.totalCostValue)} />
          <StatRow label="الربح المتوقع من المخزون" value={fmt(inventory.valuation.potentialProfit)} />

          {inventory.reorderList.slice(0, 4).length > 0 && (
            <>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-tertiary)', margin: '14px 0 8px', letterSpacing: '.5px', textTransform: 'uppercase' }}>
                أولوية الطلب
              </div>
              {inventory.reorderList.slice(0, 4).map(r => (
                <div key={r.productId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{r.productName}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{r.reason}</div>
                  </div>
                  <UrgencyBadge urgency={r.urgency} />
                </div>
              ))}
            </>
          )}
        </Panel>

        {/* B) Sales Intelligence */}
        <Panel title=" المبيعات">
          <StatRow
            label="نمو هذا الأسبوع"
            value={<GrowthBadge pct={sales.weeklyGrowth.growthPct} />}
          />
          <StatRow
            label="نمو هذا الشهر"
            value={<GrowthBadge pct={sales.monthlyGrowth.growthPct} />}
          />
          <StatRow label="متوسط قيمة الفاتورة" value={fmt(sales.avgBasketSize)} />
          <StatRow label="متوسط الأدوية / فاتورة" value={`${sales.avgItemsPerSale} دواء`} />
          {peakHour && (
            <StatRow label="ذروة المبيعات" value={`${peakHour.label} (${peakHour.salesCount} فاتورة)`} />
          )}

          {sales.starProducts.slice(0, 3).length > 0 && (
            <>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-tertiary)', margin: '14px 0 8px', letterSpacing: '.5px', textTransform: 'uppercase' }}>
                الأدوية المتميزة
              </div>
              {sales.starProducts.slice(0, 3).map(p => (
                <div key={p.productId} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{p.productName}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>هامش {fmtNum(p.avgMargin)}%</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{fmt(p.totalRevenue)}</div>
                </div>
              ))}
            </>
          )}

          {sales.cashCowProducts.slice(0, 2).length > 0 && (
            <>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-tertiary)', margin: '14px 0 8px', letterSpacing: '.5px', textTransform: 'uppercase' }}>
                الأدوية الأعلى إيراداً
              </div>
              {sales.cashCowProducts.slice(0, 2).map(p => (
                <div key={p.productId} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 4, marginBottom: 4 }}>
                  <span style={{ fontSize: 13 }}>{p.productName}</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{fmt(p.totalRevenue)}</span>
                </div>
              ))}
            </>
          )}
        </Panel>

        {/* C) Financial Intelligence */}
        <Panel title="الأداء المالي">
          <StatRow label="الهامش الإجمالي (كل الوقت)" value={`${fmtNum(financial.grossMarginPct)}%`} />
          <StatRow label="صافي التدفق النقدي (30 يوم)" value={fmt(financial.last30Summary.netCashFlow)} />
          <StatRow label="إجمالي المشتريات (30 يوم)" value={fmt(financial.last30Summary.totalCashOut)} />
          <StatRow label="قيمة المخزون بسعر البيع" value={fmt(inventory.valuation.totalRetailValue)} />

          <div className="section-label mb-2 mt-4" style={{ color: 'var(--text-tertiary)', fontSize: 10.5 }}>
            الإيرادات مقابل الأرباح — آخر 7 أيام
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={chartData} barGap={3} barSize={14}>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ border: 'none', borderRadius: 8, boxShadow: 'var(--shadow-md)', fontSize: 11 }}
                formatter={(v: any) => [`${Number(v).toLocaleString('ar-EG')} ج.م`]}
              />
              <Bar dataKey="إيرادات" fill="var(--accent-dark)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="أرباح" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          {financial.topCostDrivers.slice(0, 3).length > 0 && (
            <>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-tertiary)', margin: '14px 0 8px', letterSpacing: '.5px', textTransform: 'uppercase' }}>
                أعلى تكاليف (COGS)
              </div>
              {financial.topCostDrivers.slice(0, 3).map(d => (
                <div key={d.productName} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 5, marginBottom: 5, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13 }}>{d.productName}</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{fmt(d.totalCost)}</span>
                </div>
              ))}
            </>
          )}
        </Panel>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 3 — PREDICTIVE ALERT CENTER
      ═══════════════════════════════════════════════════════════ */}
      <SectionLabel>مركز التنبيهات التنبؤية</SectionLabel>
      <div className="grid-2 mb-8">

        {/* Shortage Alerts */}
        <Panel title="تنبيهات النقص المتوقع">
          {predictive.shortageAlerts.length === 0 ? (
            <div className="empty-state" style={{ padding: '28px 0' }}>
              <div className="empty-state-title">لا توجد تنبيهات</div>
              <div className="empty-state-text">جميع الأدوية بمستويات آمنة</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table table-dense">
                <thead>
                  <tr>
                    <th>الدواء</th>
                    <th>الكمية</th>
                    <th>ينفد في</th>
                    <th>الثقة</th>
                  </tr>
                </thead>
                <tbody>
                  {predictive.shortageAlerts.slice(0, 6).map(a => (
                    <tr key={a.productId}>
                      <td className="td-primary">{a.productName}</td>
                      <td className="td-num">{a.currentStock}</td>
                      <td className="td-secondary">
                        {a.daysUntilEmpty === Infinity ? '—' : `${a.daysUntilEmpty} يوم`}
                      </td>
                      <td>
                        <span className={`badge ${a.confidence === 'high' ? 'badge-success' : a.confidence === 'medium' ? 'badge-warning' : 'badge-neutral'}`}>
                          {a.confidence === 'high' ? 'عالية' : a.confidence === 'medium' ? 'متوسطة' : 'منخفضة'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {/* Demand Forecast + Spike Alerts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Panel title="توقعات الطلب (7 أيام)">
            {predictive.demandForecasts.length === 0 ? (
              <div className="text-sm text-muted" style={{ padding: '8px 0' }}>بيانات غير كافية للتنبؤ</div>
            ) : (
              <>
                {predictive.demandForecasts.slice(0, 4).map(f => (
                  <div key={f.productId} className="stat-row">
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{f.productName}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                        {f.predicted7d} وحدة متوقعة
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {f.trend === 'rising' && <TrendingUp size={14} color="var(--success)" />}
                      {f.trend === 'falling' && <TrendingDown size={14} color="var(--danger)" />}
                      {f.trend === 'stable' && <Minus size={14} color="var(--text-tertiary)" />}
                      <GrowthBadge pct={f.trendPct} />
                    </div>
                  </div>
                ))}
              </>
            )}
          </Panel>

          <Panel title="اكتشاف الشذوذات">
            {predictive.spikeAlerts.length === 0 ? (
              <div className="text-sm text-muted" style={{ padding: '8px 0' }}>لا توجد أنماط غير عادية</div>
            ) : (
              <>
                {predictive.spikeAlerts.slice(0, 3).map((a, i) => (
                  <div key={i} className="stat-row">
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{a.description}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{a.dateKey}</div>
                    </div>
                    <div style={{ textAlign: 'left', fontSize: 12 }}>
                      <div className="td-num">{fmt(a.observed)}</div>
                      <div className="text-faint">متوقع: {fmt(a.expected)}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </Panel>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 4 — ACTION PANEL
      ═══════════════════════════════════════════════════════════ */}
      <SectionLabel>توصيات إجرائية</SectionLabel>
      <div className="grid-3 mb-4">

        {/* A) Restock Actions */}
        <Panel title="طلبات الشراء المقترحة">
          {predictive.restockPriority.length === 0 ? (
            <div className="empty-state" style={{ padding: '28px 0' }}>
              <div className="empty-state-title">لا توجد توصيات</div>
              <div className="empty-state-text">مستويات المخزون مقبولة</div>
            </div>
          ) : (
            <>
              {predictive.restockPriority.slice(0, 5).map(r => (
                <div key={r.productId} style={{ paddingBottom: 12, marginBottom: 12, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700 }}>{r.productName}</span>
                    <UrgencyBadge urgency={r.urgency} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 3 }}>
                    {r.reasoning.slice(0, 2).join(' · ')}
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent-dark)' }}>
                    اطلب {r.suggestedQty} وحدة
                  </div>
                </div>
              ))}
            </>
          )}
        </Panel>

        {/* B) Dead Stock — Stop Buying */}
        <Panel title="أدوية بلا حركة (أوقف الطلب)">
          {inventory.deadStock.length === 0 ? (
            <div className="empty-state" style={{ padding: '28px 0' }}>
              <div className="empty-state-title">لا توجد بضاعة راكدة</div>
              <div className="empty-state-text">جميع الأدوية لها حركة</div>
            </div>
          ) : (
            <>
              {inventory.deadStock.slice(0, 5).map(d => (
                <div key={d.productId} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 3 }}>{d.productName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 3 }}>
                    متبقٍ {d.currentStock} وحدة · مبيعات 30 يوم: {d.unitsSoldLast30d}
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    لا تجدد الطلب · راجع العرض أو الخصم
                  </div>
                </div>
              ))}
            </>
          )}
        </Panel>

        {/* C) Revenue Optimization */}
        <Panel title="فرص تحسين الإيراد">
          {sales.slowProducts.length === 0 && sales.dogProducts.length === 0 ? (
            <div className="empty-state" style={{ padding: '28px 0' }}>
              <div className="empty-state-title">أداء متوازن</div>
              <div className="empty-state-text">لا توجد أدوية ذات أداء ضعيف</div>
            </div>
          ) : (
            <>
              {/* Slow: high margin, low revenue → promote */}
              {sales.slowProducts.slice(0, 3).map(p => (
                <div key={p.productId} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 3 }}>{p.productName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 3 }}>
                    هامش عالٍ {fmtNum(p.avgMargin)}% · إيراد منخفض
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent-dark)' }}>
                    روّج هذا الدواء — ربح مرتفع بإمكانية بيع أعلى
                  </div>
                </div>
              ))}
              {/* Dog: low margin + low revenue → review price */}
              {sales.dogProducts.slice(0, 2).map(p => (
                <div key={p.productId} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 3 }}>{p.productName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 3 }}>
                    هامش منخفض {fmtNum(p.avgMargin)}% · إيراد منخفض
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    راجع سعر البيع أو أوقف التخزين
                  </div>
                </div>
              ))}
            </>
          )}
        </Panel>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 5 — SYSTEM CORE & ACTIVITY FEED
      ═══════════════════════════════════════════════════════════ */}
      <SectionLabel>العمليات والنشاط المباشر</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20, marginBottom: 20 }}>

        {/* Quick Actions */}
        <Panel title="إجراءات سريعة">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            <button className="btn btn-primary" onClick={() => setActivePage('pos')} style={{ justifyContent: 'center', padding: '14px', borderRadius: '30px' }}>
              <ShoppingBag size={18} style={{ marginLeft: 8 }} />
              شاشة البيع السريع (POS)
            </button>
            <button className="btn btn-secondary" onClick={() => setActivePage('inventory')} style={{ justifyContent: 'center', padding: '14px', borderRadius: '30px' }}>
              <Package size={18} style={{ marginLeft: 8 }} />
              إضافة وإدارة المخزون
            </button>
            <div style={{ background: 'var(--surface-hover)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13, textAlign: 'center' }}>
              <Zap size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', color: 'var(--accent-dark)', marginLeft: 6 }} />
              <strong>اختصار ماسح الباركود:</strong> الماسح يعمل تلقائياً في أي مكان دون الحاجة للضغط.
            </div>
          </div>
        </Panel>

        {/* Live Event Activity Feed */}
        <Panel title="سجل الأحداث الفوري">
          {liveEvents.length === 0 ? (
            <div className="empty-state" style={{ padding: '28px 0' }}>
              <div className="empty-state-title">بانتظار الأحداث...</div>
              <div className="empty-state-text">سيتم عرض العمليات الحية للمخزون والبيع تلقائياً</div>
            </div>
          ) : (
            <div style={{ maxHeight: 200, overflowY: 'auto', paddingRight: 6 }}>
              {liveEvents.map((ev, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', marginBottom: 8, background: 'var(--surface-hover)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Radio size={14} color="var(--success)" className="spinner-slow" style={{ animation: 'pulse 2s infinite' }} />
                    <div>
                      <span className="badge badge-neutral" style={{ marginLeft: 8 }}>{ev.type}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{ev.details}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{ev.time}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
      <KPIDetailsModal type={activeKPI} onClose={() => setActiveKPI(null)} />
    </div>
  );
};

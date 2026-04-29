import React, { useEffect, useState } from 'react';
import { ShieldCheck, RefreshCw } from 'lucide-react';
import { auditService } from '../db/storageService';
import type { AuditLog } from '../types';
import { format } from 'date-fns';

const actionMeta: Record<string, { label: string; badgeClass: string }> = {
  SALE_COMPLETED:    { label: 'بيع مكتمل',       badgeClass: 'badge-success' },
  REFUND_PROCESSED:  { label: 'استرداد',          badgeClass: 'badge-warning' },
  PURCHASE_RECEIVED: { label: 'استلام مشتريات',  badgeClass: 'badge-info'    },
  CREATE_BATCH:      { label: 'إضافة دفعة',      badgeClass: 'badge-info'    },
  UPDATE_BATCH:      { label: 'تعديل دفعة',      badgeClass: 'badge-neutral' },
};

export const AuditLogViewer: React.FC = () => {
  const [logs, setLogs]       = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('');

  const load = async () => {
    setLoading(true);
    const all = await auditService.getAll();
    setLogs(all);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered      = logs.filter((l) => !filter || l.action === filter);
  const uniqueActions = [...new Set(logs.map((l) => l.action))];

  return (
    <div className="page-medium">

      {/* Filter Pills + Refresh */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          className={`tag-filter-btn ${!filter ? 'active' : ''}`}
          onClick={() => setFilter('')}
        >
          الكل ({logs.length})
        </button>
        {uniqueActions.map((action) => (
          <button
            key={action}
            className={`tag-filter-btn ${filter === action ? 'active' : ''}`}
            onClick={() => setFilter(action)}
          >
            {actionMeta[action]?.label ?? action} ({logs.filter((l) => l.action === action).length})
          </button>
        ))}

        <button 
          className="btn btn-primary" 
          onClick={load} 
          style={{ padding: '8px 16px', borderRadius: '30px', fontWeight: 700, fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginRight: 'auto' }}
        >
          <RefreshCw size={15} /> تحديث
        </button>
      </div>

      {/* Log Table */}
      <div className="card card-table">
        {loading ? (
          <div className="empty-state">
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            جارٍ التحميل...
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <ShieldCheck size={40} className="empty-state-icon" />
            <div className="empty-state-title">لا توجد أحداث مسجلة</div>
            <div className="empty-state-text">
              ستظهر هنا جميع عمليات البيع والمشتريات والمرتجعات تلقائياً
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table table-dense">
              <thead>
                <tr>
                  <th>النوع</th>
                  <th>التفاصيل</th>
                  <th>المرجع</th>
                  <th>التاريخ والوقت</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span className={`badge ${actionMeta[log.action]?.badgeClass ?? 'badge-neutral'}`}>
                        {actionMeta[log.action]?.label ?? log.action}
                      </span>
                    </td>
                    <td className="td-primary" style={{ maxWidth: 380 }}>
                      {log.details}
                    </td>
                    <td className="td-mono">
                      {log.entity}#{log.entityId.slice(-6).toUpperCase()}
                    </td>
                    <td className="td-secondary" style={{ whiteSpace: 'nowrap' }}>
                      {format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

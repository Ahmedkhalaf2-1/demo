import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useSalesStore } from '../../store/useSalesStore';
import { Bell, User, AlertCircle, AlertTriangle, Lock, Search, Check, Sparkles, Timer } from 'lucide-react';
import { useTrialTimer } from '../../hooks/useTrialTimer';


const pageTitles: Record<string, string> = {
  dashboard:     'لوحة التحكم',
  pos:           'نقطة البيع',
  inventory:     'إدارة المخزون',
  patients:      'سجلات المرضى',
  prescriptions: 'الوصفات الطبية',
  reports:       'التقارير والإحصائيات',
  refunds:       'المرتجعات والاستردادات',
  procurement:   'المشتريات والموردين',
  auditlog:      'سجل الأحداث والتدقيق',
  settings:      'الإعدادات',
};

export const Header: React.FC = () => {
  const { activePage, sidebarOpen } = useAppStore();
  const { settings } = useSettingsStore();
  const { inventory, products } = useInventoryStore();
  const { currentUser, logout, updateUser } = useAuthStore();

  const { notifications, markAsRead, markAllAsRead, runSmartEngine } = useNotificationStore();
  const { sales } = useSalesStore();

  const [showAlarms, setShowAlarms] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    if (products.length > 0 && inventory.length > 0) {
      runSmartEngine(products, inventory, sales, settings);
    }
  }, [products, inventory, sales, settings]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const filteredNotifs = notifications.filter(n => {
    const matchesFilter = filter === 'all' || n.category === filter;
    const matchesSearch = !searchQuery || 
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      n.message.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const phName = currentUser?.name || settings?.pharmacistName || 'الصيدلي المسؤول';
  const phAvatar = currentUser?.avatar || settings?.pharmacistAvatar || '';
  const phRoleLabel = currentUser?.role === 'admin' ? 'مدير' : currentUser?.role === 'pharmacist' ? 'صيدلي' : currentUser?.role === 'cashier' ? 'كاشير' : 'الصيدلي المسؤول';

  const handleAvatarClick = () => {
    if (!currentUser) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          updateUser(currentUser.id, { avatar: evt.target?.result as string });
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const alarms = inventory.map(i => {
    const prod = products.find(p => p.id === i.productId);
    if (!prod) return null;
    if (i.totalQuantity === 0) return { name: prod.name, msg: 'نفد بالكامل', type: 'critical' };
    if (i.totalQuantity <= i.minStock * 0.5) return { name: prod.name, msg: 'كمية حرجة', type: 'critical' };
    if (i.totalQuantity <= i.minStock) return { name: prod.name, msg: 'مخزون منخفض', type: 'warning' };
    return null;
  }).filter(Boolean) as { name: string; msg: string; type: string }[];

  const { formattedTime, progress } = useTrialTimer();

  return (
    <header className={`header ${!sidebarOpen ? 'sidebar-collapsed' : ''}`}>
      {/* Title */}
      <div className="header-title">{pageTitles[activePage] || ''}</div>

      {/* Trial Countdown */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: 'var(--accent-light)',
        padding: '6px 14px',
        borderRadius: '50px',
        border: '1px solid var(--accent)',
        marginRight: 'auto',
        marginLeft: '20px'
      }}>
        <span style={{ 
          fontSize: '13px', 
          fontWeight: 700, 
          color: progress < 20 ? 'var(--danger)' : 'var(--accent-dark)',
          fontFamily: 'monospace'
        }}>
          {formattedTime}
        </span>
      </div>

      {/* User Profile + Actions (Far Right) */}
      <div className="header-actions">
        <button 
          className="btn btn-ghost" 
          onClick={logout}
          style={{ padding: 8 }}
          title="تسجيل الخروج"
        >
          <Lock size={18} />
        </button>

        <div style={{ position: 'relative' }}>
          <button 
            className="btn btn-ghost" 
            onClick={() => setShowAlarms(!showAlarms)}
            style={{ padding: 8, color: unreadCount > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: 2,
                right: 2,
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: 'var(--danger)',
                color: '#fff',
                fontSize: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                border: '2px solid var(--surface)'
              }}>{unreadCount}</span>
            )}
          </button>

          {/* Alerts Dropdown Panel */}
          {showAlarms && (
            <div style={{
              position: 'absolute',
              top: '48px',
              left: 0,
              width: '360px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 100,
              padding: '20px',
              maxHeight: '500px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}>
              <div className="flex justify-between items-center">
                <span className="text-heading">مركز الإشعارات الذكي</span>
                {unreadCount > 0 && (
                  <button 
                    className="btn btn-ghost btn-sm" 
                    onClick={markAllAsRead}
                    style={{ fontSize: 12, gap: 6 }}
                  >
                    <Check size={14} /> مقروء الكل
                  </button>
                )}
              </div>

              {/* Search + Category Filter */}
              <div className="flex gap-2 items-center">
                <div className="search-wrap flex-1">
                  <Search size={14} className="search-icon" />
                  <input 
                    className="form-input search-input"
                    placeholder="ابحث..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ height: '36px', fontSize: '13px' }}
                  />
                </div>
                <select 
                  className="form-input"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  style={{ height: '36px', width: 'auto', padding: '0 12px', fontSize: '13px' }}
                >
                  <option value="all">الكل</option>
                  <option value="inventory">المخزون</option>
                  <option value="smart">ذكية</option>
                </select>
              </div>

              {/* Notifications List */}
              <div className="flex-1 overflow-y-auto flex-col gap-3" style={{ maxHeight: '350px' }}>
                {filteredNotifs.length === 0 ? (
                  <div className="p-8 text-center text-muted text-sm">لا توجد تنبيهات</div>
                ) : (
                  filteredNotifs.map((n) => (
                    <div 
                      key={n.id} 
                      className="p-3 cursor-pointer"
                      style={{ 
                        borderRadius: 'var(--r-sm)', 
                        background: n.isRead ? 'transparent' : 'var(--surface-hover)',
                        border: '1px solid var(--border)',
                        display: 'flex', 
                        gap: 12,
                        opacity: n.isRead ? 0.7 : 1,
                      }}
                      onClick={() => markAsRead(n.id)}
                    >
                      <div className="mt-1">
                        <AlertTriangle size={18} color={n.severity === 'high' ? 'var(--danger)' : 'var(--warning)'} />
                      </div>
                      <div className="flex-1 flex-col gap-1">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-bold">{n.title}</span>
                          {!n.isRead && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)' }}></span>}
                        </div>
                        <div className="text-xs text-secondary">{n.message}</div>
                        {n.recommendation && (
                          <div className="mt-2 text-xs font-semibold" style={{ color: 'var(--accent-dark)', background: 'var(--accent-light)', padding: '6px 10px', borderRadius: 'var(--r-xs)' }}>
                            💡 {n.recommendation}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex-col text-right">
            <span className="text-sm font-bold color-primary">{phName}</span>
            <span className="text-xs text-secondary">{phRoleLabel}</span>
          </div>
          <div 
            onClick={handleAvatarClick}
            className={`cursor-pointer flex items-center justify-center overflow-hidden`}
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'var(--surface-hover)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
            title={currentUser ? 'تغيير الصورة' : undefined}
          >
            {phAvatar ? (
              <img src={phAvatar} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <User size={20} />
            )}
          </div>
        </div>
      </div>
    </header>

  );
};

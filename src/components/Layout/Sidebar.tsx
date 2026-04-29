import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import {
  HiOutlineChartPie, HiOutlineBuildingStorefront, HiOutlineCube, HiOutlineShoppingBag,
  HiOutlineUsers, HiOutlineClipboardDocumentCheck, HiOutlineArrowPathRoundedSquare,
  HiOutlineArrowTrendingUp, HiOutlineClock, HiOutlineCog6Tooth
} from 'react-icons/hi2';
import { Command, ChevronRight } from 'lucide-react';

import { useAuthStore, hasPermission } from '../../store/useAuthStore';

type NavItem = { key: string; label: string; icon: React.FC<any> };

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'العمليات اليومية',
    items: [
      { key: 'dashboard', label: 'لوحة التحكم', icon: HiOutlineChartPie },
      { key: 'pos', label: 'نقطة البيع', icon: HiOutlineBuildingStorefront },
      { key: 'inventory', label: 'المخزون', icon: HiOutlineCube },
      { key: 'procurement', label: 'المشتريات', icon: HiOutlineShoppingBag },
    ],
  },
  {
    label: 'السجلات الطبية',
    items: [
      { key: 'patients', label: 'المرضى', icon: HiOutlineUsers },
      { key: 'prescriptions', label: 'الروشتات', icon: HiOutlineClipboardDocumentCheck },
    ],
  },
  {
    label: 'المالية والتقارير',
    items: [
      { key: 'refunds', label: 'المرتجعات', icon: HiOutlineArrowPathRoundedSquare },
      { key: 'reports', label: 'التقارير', icon: HiOutlineArrowTrendingUp },
    ],
  },
  {
    label: 'الإدارة والنظام',
    items: [
      { key: 'auditlog', label: 'سجل الأحداث', icon: HiOutlineClock },
      { key: 'settings', label: 'الإعدادات', icon: HiOutlineCog6Tooth },
    ],
  },
];

const pagePermissionMap: Record<string, 'canSell' | 'canManageInventory' | 'canViewReports' | 'canAccessSettings' | 'canViewDashboard'> = {
  dashboard: 'canViewDashboard',
  pos: 'canSell',
  inventory: 'canManageInventory',
  procurement: 'canManageInventory',
  patients: 'canSell',
  prescriptions: 'canSell',
  refunds: 'canSell',
  reports: 'canViewReports',
  auditlog: 'canAccessSettings',
  settings: 'canAccessSettings',
};

export const Sidebar: React.FC = () => {
  const { activePage, setPage, sidebarOpen, toggleSidebar } = useAppStore();
  const { settings, loading } = useSettingsStore();
  const { currentUser } = useAuthStore();

  // State to track which groups are expanded
  const [expandedGroups, setExpandedGroups] = React.useState<string[]>(() => {
    // By default, expand the group that contains the active page
    const initialGroup = navGroups.find(group =>
      group.items.some(item => item.key === activePage)
    );
    return initialGroup ? [initialGroup.label] : [navGroups[0].label];
  });

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev =>
      prev.includes(label)
        ? prev.filter(l => l !== label)
        : [...prev, label]
    );
  };

  // Auto-expand group if activePage changes
  React.useEffect(() => {
    const parentGroup = navGroups.find(group =>
      group.items.some(item => item.key === activePage)
    );
    if (parentGroup && !expandedGroups.includes(parentGroup.label)) {
      setExpandedGroups(prev => [...prev, parentGroup.label]);
    }
  }, [activePage]);
  const pharmacyName = loading ? '...' : settings?.pharmacyName || '...';

  return (
    <aside className={`sidebar ${!sidebarOpen ? 'collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Command size={16} />
        </div>
        {sidebarOpen && (
          <span className="sidebar-logo-text flex items-center gap-2">
            {pharmacyName}
            <span style={{
              fontSize: 10, fontWeight: 700,
              background: 'var(--accent-light)',
              color: 'var(--accent)',
              padding: '2px 8px',
              borderRadius: 'var(--r-xs)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Pro
            </span>
          </span>
        )}
      </div>

      {/* Navigation Groups */}
      <nav className="sidebar-nav">
        {navGroups.map((group) => {
          const isExpanded = expandedGroups.includes(group.label);
          const visibleItems = group.items.filter(({ key }) =>
            !pagePermissionMap[key] || hasPermission(currentUser, pagePermissionMap[key])
          );

          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label} className={`nav-group ${isExpanded ? 'is-expanded' : ''}`}>
              {sidebarOpen ? (
                <div
                  className="nav-group-label flex items-center justify-between cursor-pointer"
                  onClick={() => toggleGroup(group.label)}
                  style={{
                    padding: '12px 18px',
                    marginBottom: 4,
                    transition: 'var(--transition)',
                    color: isExpanded ? 'var(--accent)' : 'var(--sidebar-text-muted)'
                  }}
                >
                  <span className="text-xs font-bold uppercase tracking-wider">{group.label}</span>
                  <ChevronRight
                    size={14}
                    style={{
                      transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                      opacity: 0.5
                    }}
                  />
                </div>
              ) : (
                <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '12px 0' }} />
              )}

              <div style={{
                overflow: 'hidden',
                maxHeight: (isExpanded || !sidebarOpen) ? '500px' : '0',
                transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                opacity: (isExpanded || !sidebarOpen) ? 1 : 0
              }}>
                {visibleItems.map(({ key, label, icon: Icon }) => (
                  <div
                    key={key}
                    className={`nav-item ${activePage === key ? 'active' : ''}`}
                    onClick={() => setPage(key as any)}
                    title={!sidebarOpen ? label : undefined}
                    style={{
                      paddingRight: sidebarOpen ? 32 : 18
                    }}
                  >
                    <Icon size={18} className="nav-item-icon" />
                    {sidebarOpen && <span>{label}</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="sidebar-footer">
        <div className="nav-item mb-0" onClick={toggleSidebar}>
          <ChevronRight
            size={18}
            className="nav-item-icon"
            style={{
              transform: sidebarOpen ? 'rotate(0deg)' : 'rotate(180deg)',
              transition: 'var(--transition)',
            }}
          />
          {sidebarOpen && (
            <span className="text-xs font-medium" style={{ color: 'var(--sidebar-text-muted)' }}>طي القائمة</span>
          )}
        </div>
      </div>
    </aside>
  );
};

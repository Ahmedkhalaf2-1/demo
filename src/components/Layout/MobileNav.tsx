import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore, hasPermission } from '../../store/useAuthStore';
import { 
  HiOutlineBuildingStorefront, HiOutlineCube, 
  HiOutlineArrowTrendingUp, HiOutlineCog6Tooth 
} from 'react-icons/hi2';

export const MobileNav: React.FC = () => {
  const { activePage, setPage } = useAppStore();
  const { currentUser } = useAuthStore();
  
  const mobileItems = [
    { key: 'pos',         label: 'الكاشير',  icon: HiOutlineBuildingStorefront, perm: 'canSell' },
    { key: 'inventory',   label: 'المخزون',   icon: HiOutlineCube, perm: 'canManageInventory' },
    { key: 'reports',     label: 'التقارير',  icon: HiOutlineArrowTrendingUp, perm: 'canViewReports' },
    { key: 'settings',    label: 'الإعدادات', icon: HiOutlineCog6Tooth, perm: 'canAccessSettings' },
  ] as const;

  return (
    <div className="mobile-nav">
      {mobileItems
        .filter(item => !item.perm || hasPermission(currentUser, item.perm as any))
        .map(({ key, label, icon: Icon }) => (
          <div 
            key={key} 
            className={`mobile-nav-item ${activePage === key ? 'active' : ''}`}
            onClick={() => setPage(key as any)}
          >
            <Icon size={20} />
            <span>{label}</span>
          </div>
        ))}
    </div>
  );
};

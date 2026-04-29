import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { useAppStore } from '../../store/useAppStore';

interface Props {
  children: React.ReactNode;
}

export const Layout: React.FC<Props> = ({ children }) => {
  const { sidebarOpen } = useAppStore();
  return (
    <div className="app-shell">
      <Sidebar />
      <div className={`main-content ${!sidebarOpen ? 'sidebar-collapsed' : ''}`}>
        <Header />
        <div className="page-body">{children}</div>
      </div>
      <MobileNav />
    </div>
  );
};

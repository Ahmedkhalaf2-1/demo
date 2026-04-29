import { useEffect, useState } from 'react';
import React from 'react';
import { Layout } from './components/Layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { POS } from './pages/POS';
import { Inventory } from './pages/Inventory';
import { Patients } from './pages/Patients';
import { Prescriptions } from './pages/Prescriptions';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Procurement } from './pages/Procurement';
import { Refunds } from './pages/Refunds';
import { AuditLogViewer } from './pages/AuditLog';
import { OnboardingWizard } from './components/shared/OnboardingWizard';
import { useAppStore } from './store/useAppStore';
import { syncChannel } from './db/storageService';
import { useInventoryStore } from './store/useInventoryStore';
import { useSalesStore } from './store/useSalesStore';
import { usePatientStore } from './store/usePatientStore';
import { usePrescriptionStore } from './store/usePrescriptionStore';
import { useDayChangeWatcher } from './hooks/useDayChangeWatcher';
import { useBarcodeScanner } from './hooks/useBarcodeScanner';
import { useEventConsumers } from './hooks/useEventConsumers';
import { useAuthStore, hasPermission } from './store/useAuthStore';
import { Unauthorized } from './components/shared/Unauthorized';
import { LockScreen } from './components/shared/LockScreen';
import { useInactivityLock } from './hooks/useInactivityLock';
import { initObservability } from './domain/observability';

function BootstrappedApp({ onboardingDone, setOnboardingDone }: { onboardingDone: boolean, setOnboardingDone: (v: boolean) => void }) {
  const { activePage } = useAppStore();
  const { isLocked, currentUser } = useAuthStore();

  // Inactivity lock handler
  useInactivityLock();

  // Midnight auto-reload
  useDayChangeWatcher();

  // Global barcode scanner — one listener for the entire app lifetime
  useBarcodeScanner();

  // Event consumer registry — wires all cross-store reactions via event bus
  useEventConsumers();

  if (isLocked) {
    return <LockScreen />;
  }

  // Show onboarding wizard on first run
  if (!onboardingDone) {
    return <OnboardingWizard onComplete={() => setOnboardingDone(true)} />;
  }

  const pages: Record<string, React.ReactNode> = {
    dashboard: hasPermission(currentUser, 'canViewDashboard') ? <Dashboard /> : <Unauthorized />,
    pos: hasPermission(currentUser, 'canSell') ? <POS /> : <Unauthorized />,
    inventory: hasPermission(currentUser, 'canManageInventory') ? <Inventory /> : <Unauthorized />,
    patients: hasPermission(currentUser, 'canSell') ? <Patients /> : <Unauthorized />,
    prescriptions: hasPermission(currentUser, 'canSell') ? <Prescriptions /> : <Unauthorized />,
    refunds: hasPermission(currentUser, 'canSell') ? <Refunds /> : <Unauthorized />,
    procurement: hasPermission(currentUser, 'canManageInventory') ? <Procurement /> : <Unauthorized />,
    reports: hasPermission(currentUser, 'canViewReports') ? <Reports /> : <Unauthorized />,
    auditlog: hasPermission(currentUser, 'canAccessSettings') ? <AuditLogViewer /> : <Unauthorized />,
    settings: hasPermission(currentUser, 'canAccessSettings') ? <Settings /> : <Unauthorized />,
  };

  return (
    <Layout>
      {pages[activePage] ?? (hasPermission(currentUser, 'canViewDashboard') ? <Dashboard /> : <Unauthorized />)}
    </Layout>
  );
}

function App() {
  const { isBooting, init } = useAppStore();
  const [onboardingDone, setOnboardingDone] = useState(
    () => localStorage.getItem('pharma_onboarding_done') === '1'
  );

  // Dev-only observability: window.__pharmaBus.events / .stats() / .filter(name)
  useEffect(() => { initObservability(); }, []);

  useEffect(() => {
    init();

    // Global listener for cross-tab synchronization
    const handleSync = (e: MessageEvent) => {
      if (e.data.action === 'SYNC') {
        useInventoryStore.getState().loadAll();
        useSalesStore.getState().loadAll();
        usePatientStore.getState().loadAll();
        usePrescriptionStore.getState().loadAll();
      }
    };
    syncChannel.addEventListener('message', handleSync);
    return () => syncChannel.removeEventListener('message', handleSync);
  }, []);

  if (isBooting) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', flexDirection: 'column', gap: 16
      }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
        <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>جارٍ تحميل النظام...</span>
      </div>
    );
  }

  return <BootstrappedApp onboardingDone={onboardingDone} setOnboardingDone={setOnboardingDone} />;
}

export default App;

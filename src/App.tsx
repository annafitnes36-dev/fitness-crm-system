import { useState, useEffect } from 'react';
import { useStore, loadAuth, saveAuth, clearAuth, parseStaffLink } from '@/store';
import Layout from '@/components/Layout';
import SellModal from '@/components/SellModal';
import InquiryModal from '@/components/InquiryModal';
import ExpenseModal from '@/components/ExpenseModal';
import Dashboard from '@/pages/Dashboard';
import DirectorDashboard from '@/pages/DirectorDashboard';
import Clients from '@/pages/Clients';
import Schedule from '@/pages/Schedule';
import Subscriptions from '@/pages/Subscriptions';
import Sales from '@/pages/Sales';
import Finance from '@/pages/Finance';
import Branches from '@/pages/Branches';
import Staff from '@/pages/Staff';
import Settings from '@/pages/Settings';
import Reports from '@/pages/Reports';
import Notifications from '@/pages/Notifications';
import Cash from '@/pages/Cash';
import Login from '@/pages/Login';

export default function App() {
  const store = useStore();
  const [activePage, setActivePage] = useState('dashboard');
  const [showSell, setShowSell] = useState(false);
  const [sellClientId, setSellClientId] = useState<string | undefined>(undefined);
  const [showInquiry, setShowInquiry] = useState(false);
  const [showExpense, setShowExpense] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // При открытии ссылки ?sl=... — сразу встраиваем сотрудников в state
    const params = new URLSearchParams(window.location.search);
    const sl = params.get('sl');
    if (sl) {
      const staffFromLink = parseStaffLink(sl);
      if (staffFromLink && staffFromLink.length > 0) {
        try {
          const raw = localStorage.getItem('fitcrm_state_v1');
          const base = raw ? JSON.parse(raw) : {};
          // Мёржим сотрудников из ссылки в сохранённый state
          base.staff = staffFromLink;
          localStorage.setItem('fitcrm_state_v1', JSON.stringify(base));
        } catch { /* ignore */ }
        // Убираем параметр из URL
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
    const savedId = loadAuth();
    if (!savedId) return false;
    try {
      const raw = localStorage.getItem('fitcrm_state_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.staff && parsed.staff.find((s: { id: string }) => s.id === savedId)) return true;
        return false;
      }
    } catch { /* ignore */ }
    const defaultIds = ['st1', 'st2', 'st3'];
    return defaultIds.includes(savedId);
  });

  useEffect(() => {
    const savedStaffId = loadAuth();
    if (!savedStaffId) return;
    const found = store.state.staff.find(s => s.id === savedStaffId);
    if (found) {
      store.setCurrentStaff(savedStaffId);
      setIsAuthenticated(true);
    } else if (store.dbLoaded) {
      // Только сбрасываем если БД уже загружена и сотрудника нет
      clearAuth();
      setIsAuthenticated(false);
    }
  }, [store.state.staff.length, store.dbLoaded]);

  // Автоматически активировать pending абонементы при загрузке
  useEffect(() => {
    store.autoActivatePendingSubscriptions();
  }, []);

  const handleLogin = (staffId: string) => {
    store.setCurrentStaff(staffId);
    saveAuth(staffId);
    // Переключаем на первый доступный филиал сотрудника
    const member = store.state.staff.find(s => s.id === staffId);
    if (member?.branchIds?.length) {
      const hasAccess = member.branchIds.includes(store.state.currentBranchId);
      if (!hasAccess) store.setCurrentBranch(member.branchIds[0]);
    }
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    clearAuth();
    setIsAuthenticated(false);
  };

  const handleSell = (clientId?: string) => {
    setSellClientId(clientId);
    setShowSell(true);
  };

  if (!store.dbLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-sm text-muted-foreground">Загрузка данных...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login store={store} onLogin={handleLogin} />;
  }

  const renderPage = () => {
    switch (activePage) {
      case 'director-dashboard': return <DirectorDashboard store={store} />;
      case 'reports': return <Reports store={store} />;
      case 'dashboard': return <Dashboard store={store} onSell={handleSell} onNavigate={setActivePage} />;
      case 'clients': return <Clients store={store} onSell={handleSell} />;
      case 'schedule': return <Schedule store={store} onSell={handleSell} />;
      case 'subscriptions': return <Subscriptions store={store} onSell={handleSell} />;
      case 'sales': return <Sales store={store} onSell={() => handleSell()} />;
      case 'finance': return <Finance store={store} />;
      case 'cash': return <Cash store={store} />;
      case 'branches': return <Branches store={store} />;
      case 'staff': return <Staff store={store} />;
      case 'settings': return <Settings store={store} />;
      case 'notifications': return <Notifications store={store} onSell={handleSell} />;
      default: return <Dashboard store={store} onSell={handleSell} onNavigate={setActivePage} />;
    }
  };

  return (
    <>
      <Layout
        activePage={activePage}
        onNavigate={setActivePage}
        store={store}
        onSell={() => handleSell()}
        onInquiry={() => setShowInquiry(true)}
        onExpense={() => setShowExpense(true)}
        onLogout={handleLogout}
      >
        {renderPage()}
      </Layout>
      <SellModal
        open={showSell}
        onClose={() => { setShowSell(false); setSellClientId(undefined); }}
        store={store}
        preselectedClientId={sellClientId}
      />
      <InquiryModal
        open={showInquiry}
        onClose={() => setShowInquiry(false)}
        store={store}
      />
      <ExpenseModal
        open={showExpense}
        onClose={() => setShowExpense(false)}
        store={store}
      />
    </>
  );
}
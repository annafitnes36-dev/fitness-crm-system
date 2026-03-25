import { useState, useEffect } from 'react';
import { useStore, loadAuth, saveAuth, clearAuth } from '@/store';
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
import Login from '@/pages/Login';

export default function App() {
  const store = useStore();
  const [activePage, setActivePage] = useState('dashboard');
  const [showSell, setShowSell] = useState(false);
  const [sellClientId, setSellClientId] = useState<string | undefined>(undefined);
  const [showInquiry, setShowInquiry] = useState(false);
  const [showExpense, setShowExpense] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!loadAuth());

  useEffect(() => {
    const savedStaffId = loadAuth();
    if (savedStaffId && store.state.staff.find(s => s.id === savedStaffId)) {
      store.setCurrentStaff(savedStaffId);
    }
  }, []);

  const handleLogin = (staffId: string) => {
    store.setCurrentStaff(staffId);
    saveAuth(staffId);
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
      case 'branches': return <Branches store={store} />;
      case 'staff': return <Staff store={store} />;
      case 'settings': return <Settings store={store} />;
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
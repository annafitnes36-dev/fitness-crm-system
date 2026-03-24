import { useState } from 'react';
import { useStore } from '@/store';
import Layout from '@/components/Layout';
import SellModal from '@/components/SellModal';
import Dashboard from '@/pages/Dashboard';
import Clients from '@/pages/Clients';
import Schedule from '@/pages/Schedule';
import Subscriptions from '@/pages/Subscriptions';
import Sales from '@/pages/Sales';
import Finance from '@/pages/Finance';
import Branches from '@/pages/Branches';
import Settings from '@/pages/Settings';

export default function App() {
  const store = useStore();
  const [activePage, setActivePage] = useState('dashboard');
  const [showSell, setShowSell] = useState(false);
  const [sellClientId, setSellClientId] = useState<string | undefined>(undefined);

  const handleSell = (clientId?: string) => {
    setSellClientId(clientId);
    setShowSell(true);
  };

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <Dashboard store={store} onSell={handleSell} onNavigate={setActivePage} />;
      case 'clients': return <Clients store={store} onSell={handleSell} />;
      case 'schedule': return <Schedule store={store} />;
      case 'subscriptions': return <Subscriptions store={store} onSell={handleSell} />;
      case 'sales': return <Sales store={store} onSell={() => handleSell()} />;
      case 'finance': return <Finance store={store} />;
      case 'branches': return <Branches store={store} />;
      case 'settings': return <Settings store={store} />;
      default: return <Dashboard store={store} onSell={handleSell} onNavigate={setActivePage} />;
    }
  };

  return (
    <>
      <Layout activePage={activePage} onNavigate={setActivePage} store={store} onSell={() => handleSell()}>
        {renderPage()}
      </Layout>
      <SellModal
        open={showSell}
        onClose={() => { setShowSell(false); setSellClientId(undefined); }}
        store={store}
        preselectedClientId={sellClientId}
      />
    </>
  );
}

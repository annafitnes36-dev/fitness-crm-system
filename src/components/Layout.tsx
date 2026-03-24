import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { StoreType } from '@/store';

interface LayoutProps {
  children: React.ReactNode;
  activePage: string;
  onNavigate: (page: string) => void;
  store: StoreType;
  onSell: () => void;
}

const navItems = [
  { id: 'dashboard', label: 'Дашборд', icon: 'LayoutDashboard' },
  { id: 'clients', label: 'Клиенты', icon: 'Users' },
  { id: 'schedule', label: 'Расписание', icon: 'Calendar' },
  { id: 'subscriptions', label: 'Абонементы', icon: 'CreditCard' },
  { id: 'sales', label: 'Продажи', icon: 'ShoppingBag' },
  { id: 'finance', label: 'Финансы', icon: 'BarChart3' },
  { id: 'branches', label: 'Филиалы', icon: 'Building2' },
  { id: 'settings', label: 'Настройки', icon: 'Settings' },
];

export default function Layout({ children, activePage, onNavigate, store, onSell }: LayoutProps) {
  const { state, setCurrentBranch } = store;
  const currentBranch = state.branches.find(b => b.id === state.currentBranchId);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-border flex flex-col shrink-0">
        <div className="px-4 py-5 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 bg-foreground rounded-md flex items-center justify-center">
              <Icon name="Dumbbell" size={14} className="text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm tracking-tight">FitCRM</span>
          </div>
          <select
            value={state.currentBranchId}
            onChange={e => setCurrentBranch(e.target.value)}
            className="w-full text-xs text-muted-foreground bg-transparent border-none outline-none cursor-pointer mt-1"
          >
            {state.branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`nav-item w-full text-left ${activePage === item.id ? 'active' : ''}`}
            >
              <Icon name={item.icon} size={16} className="shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-border">
          <button
            onClick={onSell}
            className="w-full flex items-center justify-center gap-2 bg-foreground text-primary-foreground text-sm font-medium px-3 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
          >
            <Icon name="Plus" size={15} />
            Продать
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-border px-6 py-4 flex items-center justify-between shrink-0">
          <h1 className="text-base font-semibold">
            {navItems.find(n => n.id === activePage)?.label}
          </h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{currentBranch?.name}</span>
            <div className="w-7 h-7 bg-secondary rounded-full flex items-center justify-center">
              <Icon name="User" size={14} />
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
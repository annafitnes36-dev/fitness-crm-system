import Icon from '@/components/ui/icon';
import { StoreType, ROLE_LABELS, Permission } from '@/store';

interface LayoutProps {
  children: React.ReactNode;
  activePage: string;
  onNavigate: (page: string) => void;
  store: StoreType;
  onSell: () => void;
  onInquiry: () => void;
  onExpense: () => void;
  onLogout?: () => void;
}

const ALL_NAV_ITEMS = [
  { id: 'director-dashboard', label: 'Аналитика', icon: 'TrendingUp', permKey: 'menuAnalytics' as keyof Permission },
  { id: 'reports', label: 'Отчёты', icon: 'FileBarChart2', permKey: 'menuReports' as keyof Permission },
  { id: 'dashboard', label: 'Дашборд', icon: 'LayoutDashboard', permKey: 'menuDashboard' as keyof Permission },
  { id: 'clients', label: 'Клиенты', icon: 'Users', permKey: 'menuClients' as keyof Permission },
  { id: 'schedule', label: 'Расписание', icon: 'Calendar', permKey: 'menuSchedule' as keyof Permission },
  { id: 'subscriptions', label: 'Абонементы', icon: 'CreditCard', permKey: 'menuSubscriptions' as keyof Permission },
  { id: 'sales', label: 'Продажи', icon: 'ShoppingBag', permKey: 'menuSales' as keyof Permission },
  { id: 'finance', label: 'Финансы', icon: 'BarChart3', permKey: 'menuFinance' as keyof Permission },
  { id: 'branches', label: 'Филиалы', icon: 'Building2', permKey: 'menuBranches' as keyof Permission },
  { id: 'staff', label: 'Сотрудники', icon: 'UserCog', permKey: 'menuStaff' as keyof Permission },
  { id: 'settings', label: 'Настройки', icon: 'Settings', permKey: 'menuSettings' as keyof Permission },
];

export default function Layout({ children, activePage, onNavigate, store, onSell, onInquiry, onExpense, onLogout }: LayoutProps) {
  const { state, setCurrentBranch } = store;
  const currentBranch = state.branches.find(b => b.id === state.currentBranchId);
  const currentStaff = state.staff.find(m => m.id === state.currentStaffId);
  const perms = currentStaff?.permissions;

  const navItems = perms
    ? ALL_NAV_ITEMS.filter(item => perms[item.permKey] !== false)
    : ALL_NAV_ITEMS;

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

        <div className="p-3 border-t border-border space-y-2">
          <button
            onClick={onSell}
            className="w-full flex items-center justify-center gap-2 bg-foreground text-primary-foreground text-sm font-medium px-3 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
          >
            <Icon name="Plus" size={15} />
            Продать
          </button>
          <button
            onClick={onInquiry}
            className="w-full flex items-center justify-center gap-2 bg-secondary text-foreground text-sm font-medium px-3 py-2.5 rounded-lg hover:bg-secondary/70 transition-colors border border-border"
          >
            <Icon name="PhoneIncoming" size={15} />
            Обращение
          </button>
          <button
            onClick={onExpense}
            className="w-full flex items-center justify-center gap-2 bg-secondary text-foreground text-sm font-medium px-3 py-2.5 rounded-lg hover:bg-secondary/70 transition-colors border border-border"
          >
            <Icon name="TrendingDown" size={15} />
            Расход
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
            <div className="flex items-center gap-2 bg-secondary rounded-lg px-2 py-1">
              <Icon name="User" size={13} />
              <span className="text-xs font-medium text-foreground">
                {currentStaff ? `${currentStaff.name.split(' ').slice(0, 2).join(' ')} (${ROLE_LABELS[currentStaff.role]})` : '—'}
              </span>
            </div>
            {onLogout && (
              <button onClick={onLogout} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-secondary">
                <Icon name="LogOut" size={13} />
                Выйти
              </button>
            )}
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
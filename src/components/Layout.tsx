import { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import { StoreType, SyncStatus, ROLE_LABELS, Permission, Shift } from '@/store';
import ShiftReport from '@/components/ShiftReport';

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
  { id: 'cash', label: 'Касса', icon: 'Landmark', permKey: 'menuCash' as keyof Permission },
  { id: 'notifications', label: 'Уведомления', icon: 'Bell', permKey: 'menuDashboard' as keyof Permission },
  { id: 'branches', label: 'Филиалы', icon: 'Building2', permKey: 'menuBranches' as keyof Permission },
  { id: 'staff', label: 'Сотрудники', icon: 'UserCog', permKey: 'menuStaff' as keyof Permission },
  { id: 'settings', label: 'Настройки', icon: 'Settings', permKey: 'menuSettings' as keyof Permission },
];

// Bottom nav — самые частые действия
const BOTTOM_NAV_KEYS = ['dashboard', 'clients', 'schedule', 'notifications', 'sales'];

function countNotifications(store: StoreType): number {
  const { state } = store;
  const today = new Date();
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const todayStr = fmt(today);
  const tomorrowStr = fmt(new Date(today.getTime() + 86400000));
  const yesterdayStr = fmt(new Date(today.getTime() - 86400000));

  const catMap: Record<string, typeof state.notificationCategories[0]> = {};
  (state.notificationCategories ?? []).forEach(c => { catMap[c.key] = c; });
  const daysAhead = catMap['sub_end']?.daysAhead ?? 3;
  const daysAgo = catMap['two_weeks']?.daysAgo ?? 14;
  const inNDays = fmt(new Date(today.getTime() + daysAhead * 86400000));
  const agoNDays = fmt(new Date(today.getTime() - daysAgo * 86400000));

  const dismissed = new Set(state.dismissedNotifications ?? []);
  const branchClients = state.clients.filter(c => c.branchId === state.currentBranchId);
  const branchScheduleIds = new Set(state.schedule.filter(e => e.branchId === state.currentBranchId).map(e => e.id));
  const clientFirstVisitDate: Record<string, string> = {};
  state.visits.filter(v => branchScheduleIds.has(v.scheduleEntryId)).sort((a, b) => a.date.localeCompare(b.date)).forEach(v => { if (!clientFirstVisitDate[v.clientId]) clientFirstVisitDate[v.clientId] = v.date; });
  let count = 0;
  for (const client of branchClients) {
    const sub = client.activeSubscriptionId ? state.subscriptions.find(s => s.id === client.activeSubscriptionId) : null;
    if (catMap['birthday']?.enabled && client.birthDate && client.birthDate.slice(5) === todayStr.slice(5) && !dismissed.has(`birthday:${client.id}:${todayStr}`)) count++;
    if (catMap['sub_end']?.enabled && sub && sub.status === 'active' && sub.endDate === inNDays && !dismissed.has(`sub_end:${client.id}:${sub.endDate}`)) count++;
    if (catMap['last_session']?.enabled && sub && sub.sessionsLeft === 1 && !dismissed.has(`last_session:${client.id}:${sub.id}`)) count++;
    if (catMap['two_weeks']?.enabled && state.sales.some(s => s.clientId === client.id && s.type === 'subscription' && s.date === agoNDays) && !dismissed.has(`two_weeks:${client.id}:${agoNDays}`)) count++;
    const firstDate = clientFirstVisitDate[client.id];
    if (catMap['first_today']?.enabled && firstDate === todayStr && !dismissed.has(`first_today:${client.id}:${todayStr}`)) count++;
    if (catMap['first_tomorrow']?.enabled && firstDate === tomorrowStr && !dismissed.has(`first_tomorrow:${client.id}:${tomorrowStr}`)) count++;
    if (firstDate === yesterdayStr) {
      const v = state.visits.find(v2 => v2.clientId === client.id && v2.date === yesterdayStr && branchScheduleIds.has(v2.scheduleEntryId));
      if (catMap['missed_first']?.enabled && v && (v.status === 'missed' || v.status === 'cancelled') && !dismissed.has(`missed_first:${client.id}:${yesterdayStr}`)) count++;
      if (catMap['no_sub_after_first']?.enabled && v && v.status === 'attended' && !state.subscriptions.some(s => s.clientId === client.id) && !dismissed.has(`no_sub_after_first:${client.id}:${yesterdayStr}`)) count++;
    }
  }
  return count;
}

function SyncIndicator({ status }: { status: SyncStatus }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status === 'syncing' || status === 'error') {
      setVisible(true);
    } else if (status === 'saved') {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [status]);

  if (!visible) return null;
  if (status === 'syncing') return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      <span className="hidden sm:inline">Сохранение...</span>
    </span>
  );
  if (status === 'saved') return (
    <span className="flex items-center gap-1 text-xs text-emerald-600">
      <Icon name="Check" size={12} />
      <span className="hidden sm:inline">Сохранено</span>
    </span>
  );
  if (status === 'error') return (
    <span className="flex items-center gap-1 text-xs text-red-500" title="Нет связи с сервером. Данные в браузере.">
      <Icon name="WifiOff" size={12} />
      <span className="hidden sm:inline">Нет связи</span>
    </span>
  );
  return null;
}

export default function Layout({ children, activePage, onNavigate, store, onSell, onInquiry, onExpense, onLogout }: LayoutProps) {
  const { state, setCurrentBranch, openShift, closeShift, getActiveShift } = store;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [closedShift, setClosedShift] = useState<Shift | null>(null);
  const currentStaff = state.staff.find(m => m.id === state.currentStaffId);
  const perms = currentStaff?.permissions;
  const isAdmin = currentStaff?.role === 'admin';

  const activeShift = currentStaff ? getActiveShift(currentStaff.id, state.currentBranchId) : null;

  // При входе администратора — автоматически открываем смену
  useEffect(() => {
    if (!isAdmin || !currentStaff) return;
    const existing = getActiveShift(currentStaff.id, state.currentBranchId);
    if (!existing) {
      openShift(currentStaff.id, state.currentBranchId);
    }
  }, [currentStaff?.id, state.currentBranchId]);

  const handleCloseShift = () => {
    if (!activeShift) return;
    closeShift(activeShift.id);
    const closed = { ...activeShift, closedAt: new Date().toISOString() };
    setClosedShift(closed);
    // Не разлогиниваем сразу — показываем отчёт смены
  };

  const handleOpenNewShift = () => {
    setClosedShift(null);
    if (onLogout) onLogout();
  };

  // Только филиалы к которым у сотрудника есть доступ
  const allowedBranches = currentStaff?.branchIds?.length
    ? state.branches.filter(b => currentStaff.branchIds.includes(b.id))
    : state.branches;

  const currentBranch = state.branches.find(b => b.id === state.currentBranchId);
  const notifCount = countNotifications(store);

  const navItems = perms
    ? ALL_NAV_ITEMS.filter(item => perms[item.permKey] !== false)
    : ALL_NAV_ITEMS;

  const bottomNavItems = navItems.filter(item => BOTTOM_NAV_KEYS.includes(item.id));

  const handleNavigate = (id: string) => {
    onNavigate(id);
    setSidebarOpen(false);
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-4 py-5 border-b border-border">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 bg-foreground rounded-md flex items-center justify-center">
            <Icon name="Dumbbell" size={14} className="text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm tracking-tight">Рельеф-СРМ</span>
        </div>
        <select
          value={state.currentBranchId}
          onChange={e => setCurrentBranch(e.target.value)}
          className="w-full text-xs text-muted-foreground bg-transparent border-none outline-none cursor-pointer mt-1"
        >
          {allowedBranches.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => handleNavigate(item.id)}
            className={`nav-item w-full text-left ${activePage === item.id ? 'active' : ''}`}
          >
            <Icon name={item.icon} size={16} className="shrink-0" />
            {item.label}
            {item.id === 'notifications' && notifCount > 0 && (
              <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {notifCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Action buttons */}
      <div className="p-3 border-t border-border space-y-2">
        <button
          onClick={() => { onSell(); setSidebarOpen(false); }}
          className="w-full flex items-center justify-center gap-2 bg-foreground text-primary-foreground text-sm font-medium px-3 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
        >
          <Icon name="Plus" size={15} />
          Продать
        </button>
        <button
          onClick={() => { onInquiry(); setSidebarOpen(false); }}
          className="w-full flex items-center justify-center gap-2 bg-secondary text-foreground text-sm font-medium px-3 py-2.5 rounded-lg hover:bg-secondary/70 transition-colors border border-border"
        >
          <Icon name="PhoneIncoming" size={15} />
          Обращение
        </button>
        <button
          onClick={() => { onExpense(); setSidebarOpen(false); }}
          className="w-full flex items-center justify-center gap-2 bg-secondary text-foreground text-sm font-medium px-3 py-2.5 rounded-lg hover:bg-secondary/70 transition-colors border border-border"
        >
          <Icon name="TrendingDown" size={15} />
          Расход
        </button>
      </div>

      {/* Staff / Logout */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <div className="w-6 h-6 bg-secondary rounded-full flex items-center justify-center shrink-0">
            <Icon name="User" size={12} />
          </div>
          <div className="min-w-0">
            <div className="font-medium text-foreground truncate">{currentStaff?.name ?? '—'}</div>
            <div className="truncate">{ROLE_LABELS[currentStaff?.role ?? 'admin']}</div>
          </div>
        </div>
        {isAdmin && activeShift && (
          <button
            onClick={() => { handleCloseShift(); setSidebarOpen(false); }}
            className="w-full flex items-center gap-2 text-xs text-orange-600 hover:text-orange-700 px-2 py-1.5 rounded-md hover:bg-orange-50 transition-colors"
          >
            <Icon name="DoorOpen" size={13} />
            Закрыть смену
          </button>
        )}
        {onLogout && !isAdmin && (
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-md hover:bg-secondary transition-colors"
          >
            <Icon name="LogOut" size={13} />
            Выйти
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 bg-white border-r border-border flex-col shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 z-50 bg-white border-r border-border flex flex-col transition-transform duration-300 md:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {sidebarContent}
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-border px-3 md:px-6 py-3 md:py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {/* Burger — mobile only */}
            <button
              className="md:hidden p-1.5 rounded-md hover:bg-secondary transition-colors"
              onClick={() => setSidebarOpen(v => !v)}
            >
              <Icon name="Menu" size={20} />
            </button>
            <h1 className="text-sm md:text-base font-semibold truncate">
              {ALL_NAV_ITEMS.find(n => n.id === activePage)?.label ?? activePage}
            </h1>
          </div>
          <div className="flex items-center gap-2 md:gap-3 text-xs md:text-sm text-muted-foreground">
            <SyncIndicator status={store.syncStatus} />
            <span className="hidden sm:block truncate max-w-[120px]">{currentBranch?.name}</span>
            {/* Quick actions — mobile */}
            <button
              onClick={onSell}
              className="md:hidden flex items-center gap-1 bg-foreground text-primary-foreground text-xs font-medium px-2.5 py-1.5 rounded-lg"
            >
              <Icon name="Plus" size={13} />
              Продать
            </button>
            {/* Desktop staff info */}
            <div className="hidden md:flex items-center gap-2">
              <div className="w-6 h-6 bg-secondary rounded-full flex items-center justify-center">
                <Icon name="User" size={12} />
              </div>
              <span className="text-xs font-medium text-foreground">{currentStaff?.name ?? '—'}</span>
              <span className="text-xs text-muted-foreground">· {ROLE_LABELS[currentStaff?.role ?? 'admin']}</span>
            </div>
            {isAdmin && activeShift && (
              <button
                onClick={handleCloseShift}
                className="hidden md:flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-700 px-2 py-1 rounded-md hover:bg-orange-50 transition-colors"
              >
                <Icon name="DoorOpen" size={13} />
                Закрыть смену
              </button>
            )}
            {onLogout && !isAdmin && (
              <button
                onClick={onLogout}
                className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-secondary transition-colors"
              >
                <Icon name="LogOut" size={13} />
                Выйти
              </button>
            )}
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto pb-16 md:pb-0">
          {children}
        </div>

        {/* Bottom navigation — mobile only */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-border flex items-stretch">
          {bottomNavItems.map(item => (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id)}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] transition-colors relative ${
                activePage === item.id
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
              {item.id === 'notifications' && notifCount > 0 && (
                <span className="absolute top-1.5 right-[calc(50%-14px)] bg-red-500 text-white text-[9px] font-bold px-1 py-px rounded-full min-w-[14px] text-center leading-tight">
                  {notifCount}
                </span>
              )}
            </button>
          ))}
          {/* More button */}
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon name="Menu" size={18} />
            <span>Ещё</span>
          </button>
        </nav>
      </main>
    </div>

    {closedShift && (
      <ShiftReport
        open={true}
        store={store}
        shift={closedShift}
        onOpenShift={handleOpenNewShift}
      />
    )}
    </>
  );
}
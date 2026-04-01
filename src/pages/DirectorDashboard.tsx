import { useState, useMemo } from 'react';
import { StoreType } from '@/store';
import Icon from '@/components/ui/icon';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface DirectorDashboardProps {
  store: StoreType;
}

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
    </div>
  );
}

function PieChart({ segments }: { segments: { value: number; color: string; label: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) return <div className="text-center text-sm text-muted-foreground py-4">Нет данных</div>;
  let offset = 0;
  const circles = segments.map((seg, i) => {
    const pct = seg.value / total;
    const dash = pct * 100;
    const gap = 100 - dash;
    const el = (
      <circle key={i} cx="20" cy="20" r="15.915" fill="none" stroke={seg.color}
        strokeWidth="7" strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-offset}
        style={{ transition: 'stroke-dashoffset 0.5s, stroke-dasharray 0.5s' }}
      />
    );
    offset += dash;
    return el;
  });
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 40 40" className="w-20 h-20 -rotate-90">
        {circles}
      </svg>
      <div className="space-y-1.5">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: seg.color }} />
            <span className="text-muted-foreground">{seg.label}</span>
            <span className="font-semibold ml-auto">{total > 0 ? Math.round(seg.value / total * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type DrillItem = { id: string; title: string; subtitle: string; amount?: number; badge?: string; badgeColor?: string };

function DrillModal({ title, items, onClose }: { title: string; items: DrillItem[]; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent aria-describedby="drill-desc" className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription id="drill-desc">Список операций за выбранный период</DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 space-y-1 pr-1">
          {items.length === 0 && (
            <div className="text-center text-muted-foreground py-8 text-sm">Нет данных за выбранный период</div>
          )}
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-secondary transition-colors">
              <div>
                <div className="text-sm font-medium">{item.title}</div>
                <div className="text-xs text-muted-foreground">{item.subtitle}</div>
              </div>
              <div className="flex items-center gap-2">
                {item.badge && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${item.badgeColor || 'bg-secondary text-foreground'}`}>{item.badge}</span>
                )}
                {item.amount !== undefined && (
                  <span className="text-sm font-semibold">{item.amount.toLocaleString()} ₽</span>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="text-xs text-muted-foreground pt-2 border-t border-border">{items.length} записей</div>
      </DialogContent>
    </Dialog>
  );
}

export default function DirectorDashboard({ store }: DirectorDashboardProps) {
  const { state } = store;
  const now = new Date();

  // Навигация по месяцам
  const [browseYear, setBrowseYear] = useState(now.getFullYear());
  const [browseMonthIdx, setBrowseMonthIdx] = useState(now.getMonth());
  const [branchFilter, setBranchFilter] = useState<string>('all');

  const isCurrentMonth = browseYear === now.getFullYear() && browseMonthIdx === now.getMonth();

  const goPrevMonth = () => {
    if (browseMonthIdx === 0) { setBrowseYear(y => y - 1); setBrowseMonthIdx(11); }
    else setBrowseMonthIdx(m => m - 1);
  };
  const goNextMonth = () => {
    if (isCurrentMonth) return;
    if (browseMonthIdx === 11) { setBrowseYear(y => y + 1); setBrowseMonthIdx(0); }
    else setBrowseMonthIdx(m => m + 1);
  };

  const monthLabel = new Date(browseYear, browseMonthIdx, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

  // Диапазон дат выбранного месяца
  const monthStart = `${browseYear}-${String(browseMonthIdx + 1).padStart(2, '0')}-01`;
  const nextY = browseMonthIdx === 11 ? browseYear + 1 : browseYear;
  const nextM = browseMonthIdx === 11 ? 1 : browseMonthIdx + 2;
  const monthEndExcl = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
  // включительная дата для фильтров
  const d = new Date(nextY, nextM - 1, 0);
  const monthEnd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const inMonth = (date: string) => date >= monthStart && date < monthEndExcl;
  const bf = (bId: string) => branchFilter === 'all' || bId === branchFilter;

  // Drill-down modal
  const [drill, setDrill] = useState<{ title: string; items: DrillItem[] } | null>(null);

  // ─── ПРОДАЖИ ──────────────────────────────────────────────────────────────
  const allMonthSales = useMemo(() =>
    state.sales.filter(s => inMonth(s.date) && bf(s.branchId)),
    [state.sales, monthStart, monthEndExcl, branchFilter]
  );

  const subSales = allMonthSales.filter(s => s.type === 'subscription' && !s.isRefund);
  const singleSales = allMonthSales.filter(s => s.type === 'single');
  const refunds = allMonthSales.filter(s => s.isRefund);

  const totalSubs = subSales.length;
  const firstTimeSubs = subSales.filter(s => s.isFirstSubscription).length;
  const renewalSubs = subSales.filter(s => s.isRenewal).length;
  const returnSubs = subSales.filter(s => s.isReturn).length;

  const subRevenue = subSales.reduce((s, x) => s + x.finalPrice, 0);
  const singleRevenue = singleSales.reduce((s, x) => s + x.finalPrice, 0);
  const totalReturns = refunds.reduce((s, x) => s + Math.abs(x.finalPrice), 0);
  const totalRevenue = subRevenue + singleRevenue - totalReturns;

  const branchExpenses = state.expenses.filter(e => inMonth(e.date) && bf(e.branchId));
  const totalExpenses = branchExpenses.reduce((s, e) => s + e.amount, 0);
  const profit = totalRevenue - totalExpenses;
  const margin = totalRevenue > 0 ? Math.round((profit / totalRevenue) * 100) : 0;
  const totalDiscounts = allMonthSales.reduce((s, x) => s + (x.price - x.finalPrice), 0);
  const totalBonusSpent = allMonthSales.reduce((s, x) => s + (x.bonusUsed || 0), 0);
  const avgCheck = totalSubs > 0 ? Math.round(subRevenue / totalSubs) : 0;

  // ─── ВОРОНКА ──────────────────────────────────────────────────────────────
  const branchInquiries = state.inquiries.filter(i => inMonth(i.date) && bf(i.branchId));
  const newClients = state.clients.filter(c => inMonth(c.createdAt) && bf(c.branchId));

  const branchScheduleIds = useMemo(() => new Set(
    state.schedule.filter(e => bf(e.branchId)).map(e => e.id)
  ), [state.schedule, branchFilter]);

  const attendedVisitsMonth = state.visits.filter(v =>
    v.status === 'attended' && inMonth(v.date) && branchScheduleIds.has(v.scheduleEntryId)
  );

  const funnelSteps = [
    { label: 'Обращений', value: branchInquiries.length + newClients.length, color: '#8b5cf6' },
    { label: 'Зарегистрировалось', value: newClients.length, color: '#3b82f6' },
    { label: 'Дошло до занятий', value: attendedVisitsMonth.length, color: '#10b981' },
    { label: 'Купило (новички)', value: firstTimeSubs, color: '#f59e0b' },
  ];
  const funnelMax = funnelSteps[0].value || 1;

  // ─── HELPERS FOR DRILL ────────────────────────────────────────────────────
  const clientName = (clientId: string) => {
    const c = state.clients.find(cl => cl.id === clientId);
    return c ? `${c.lastName || ''} ${c.firstName || ''}`.trim() || 'Клиент' : 'Неизвестный';
  };

  const openSubSalesDrill = () => {
    const items: DrillItem[] = subSales.map(s => ({
      id: s.id,
      title: clientName(s.clientId),
      subtitle: `${s.itemName} · ${s.date}`,
      amount: s.finalPrice,
      badge: s.isFirstSubscription ? 'Первый' : s.isRenewal ? 'Продление' : s.isReturn ? 'Возвращение' : undefined,
      badgeColor: s.isFirstSubscription ? 'bg-violet-100 text-violet-700' : s.isRenewal ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
    }));
    setDrill({ title: `Продажи абонементов — ${monthLabel}`, items });
  };

  const openRenewalsDrill = () => {
    const items: DrillItem[] = subSales.filter(s => s.isRenewal).map(s => ({
      id: s.id,
      title: clientName(s.clientId),
      subtitle: `${s.itemName} · ${s.date}`,
      amount: s.finalPrice,
    }));
    setDrill({ title: `Продления — ${monthLabel}`, items });
  };

  const openFirstTimesDrill = () => {
    const items: DrillItem[] = subSales.filter(s => s.isFirstSubscription).map(s => ({
      id: s.id,
      title: clientName(s.clientId),
      subtitle: `${s.itemName} · ${s.date}`,
      amount: s.finalPrice,
      badge: 'Новичок',
      badgeColor: 'bg-violet-100 text-violet-700',
    }));
    setDrill({ title: `Первичные продажи — ${monthLabel}`, items });
  };

  const openReturnsDrill = () => {
    const items: DrillItem[] = subSales.filter(s => s.isReturn).map(s => ({
      id: s.id,
      title: clientName(s.clientId),
      subtitle: `${s.itemName} · ${s.date}`,
      amount: s.finalPrice,
    }));
    setDrill({ title: `Возвращения — ${monthLabel}`, items });
  };

  const openRevenueDrill = () => {
    const items: DrillItem[] = [
      ...subSales.map(s => ({
        id: s.id,
        title: clientName(s.clientId),
        subtitle: `Абонемент: ${s.itemName} · ${s.date}`,
        amount: s.finalPrice,
        badge: 'Абонемент',
        badgeColor: 'bg-blue-100 text-blue-700',
      })),
      ...singleSales.map(s => ({
        id: s.id,
        title: clientName(s.clientId),
        subtitle: `Разовый: ${s.itemName} · ${s.date}`,
        amount: s.finalPrice,
        badge: 'Разовый',
        badgeColor: 'bg-purple-100 text-purple-700',
      })),
      ...refunds.map(s => ({
        id: s.id,
        title: clientName(s.clientId),
        subtitle: `Возврат: ${s.itemName} · ${s.date}`,
        amount: -Math.abs(s.finalPrice),
        badge: 'Возврат',
        badgeColor: 'bg-red-100 text-red-700',
      })),
    ].sort((a, b) => b.subtitle.localeCompare(a.subtitle));
    setDrill({ title: `Выручка — ${monthLabel}`, items });
  };

  const openExpensesDrill = () => {
    const items: DrillItem[] = branchExpenses.map(e => {
      const cat = state.expenseCategories.find(c => c.id === e.categoryId);
      return {
        id: e.id,
        title: cat?.name || 'Расход',
        subtitle: `${e.comment || '—'} · ${e.date}`,
        amount: e.amount,
      };
    }).sort((a, b) => b.subtitle.localeCompare(a.subtitle));
    setDrill({ title: `Расходы — ${monthLabel}`, items });
  };

  const openProfitDrill = () => {
    const incomeItems: DrillItem[] = [
      ...subSales.map(s => ({
        id: s.id,
        title: clientName(s.clientId),
        subtitle: `Абонемент: ${s.itemName} · ${s.date}`,
        amount: s.finalPrice,
        badge: '+',
        badgeColor: 'bg-emerald-100 text-emerald-700',
      })),
      ...singleSales.map(s => ({
        id: `sv_${s.id}`,
        title: clientName(s.clientId),
        subtitle: `Разовый: ${s.itemName} · ${s.date}`,
        amount: s.finalPrice,
        badge: '+',
        badgeColor: 'bg-emerald-100 text-emerald-700',
      })),
      ...refunds.map(s => ({
        id: `rf_${s.id}`,
        title: clientName(s.clientId),
        subtitle: `Возврат: ${s.itemName} · ${s.date}`,
        amount: -Math.abs(s.finalPrice),
        badge: '−',
        badgeColor: 'bg-red-100 text-red-700',
      })),
      ...branchExpenses.map(e => {
        const cat = state.expenseCategories.find(c => c.id === e.categoryId);
        return {
          id: `exp_${e.id}`,
          title: cat?.name || 'Расход',
          subtitle: `${e.comment || '—'} · ${e.date}`,
          amount: -e.amount,
          badge: '−',
          badgeColor: 'bg-red-100 text-red-700',
        };
      }),
    ].sort((a, b) => b.subtitle.localeCompare(a.subtitle));
    setDrill({ title: `Прибыль — ${monthLabel}`, items: incomeItems });
  };

  const openAttendedDrill = () => {
    const items: DrillItem[] = attendedVisitsMonth.map(v => {
      const entry = state.schedule.find(e => e.id === v.scheduleEntryId);
      const tt = entry ? state.trainingTypes.find(t => t.id === entry.trainingTypeId) : null;
      return {
        id: v.id,
        title: clientName(v.clientId),
        subtitle: `${tt?.name || 'Тренировка'} · ${v.date}`,
      };
    });
    setDrill({ title: `Посещения — ${monthLabel}`, items });
  };

  const openInquiriesDrill = () => {
    const items: DrillItem[] = [
      ...branchInquiries.map(i => ({
        id: i.id,
        title: 'Обращение',
        subtitle: `${i.channel || '—'} · ${i.date}`,
        badge: 'Обращение',
        badgeColor: 'bg-purple-100 text-purple-700',
      })),
      ...newClients.map(c => ({
        id: c.id,
        title: `${c.lastName || ''} ${c.firstName || ''}`.trim() || 'Клиент',
        subtitle: `Зарегистрирован · ${c.createdAt}`,
        badge: 'Новый клиент',
        badgeColor: 'bg-blue-100 text-blue-700',
      })),
    ].sort((a, b) => b.subtitle.localeCompare(a.subtitle));
    setDrill({ title: `Обращения — ${monthLabel}`, items });
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Переключатель месяцев */}
        <div className="flex items-center gap-1 bg-white border border-border rounded-xl px-3 py-2 shadow-sm">
          <button onClick={goPrevMonth}
            className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <Icon name="ChevronLeft" size={16} />
          </button>
          <span className="px-2 text-sm font-medium capitalize min-w-[160px] text-center">{monthLabel}
            {isCurrentMonth && <span className="ml-1.5 text-xs text-muted-foreground font-normal">(текущий)</span>}
          </span>
          <button onClick={goNextMonth} disabled={isCurrentMonth}
            className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed">
            <Icon name="ChevronRight" size={16} />
          </button>
        </div>

        {!isCurrentMonth && (
          <button
            onClick={() => { setBrowseYear(now.getFullYear()); setBrowseMonthIdx(now.getMonth()); }}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Текущий месяц
          </button>
        )}

        <select className="border border-input rounded-lg px-3 py-1.5 text-sm ml-auto" value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
          <option value="all">Все филиалы</option>
          {state.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {/* Sales counts */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: 'Продаж абонементов', value: totalSubs, sub: 'за месяц', icon: 'CreditCard', color: 'text-blue-600',
            onClick: openSubSalesDrill,
          },
          {
            label: 'Продлений', value: renewalSubs, sub: `${totalSubs > 0 ? Math.round(renewalSubs / totalSubs * 100) : 0}% от продаж`, icon: 'RefreshCw', color: 'text-emerald-600',
            onClick: openRenewalsDrill,
          },
          {
            label: 'Новички', value: firstTimeSubs, sub: 'первая покупка', icon: 'UserPlus', color: 'text-violet-600',
            onClick: openFirstTimesDrill,
          },
          {
            label: 'Возвращения', value: returnSubs, sub: 'вернулись после паузы', icon: 'TrendingUp', color: 'text-amber-600',
            onClick: openReturnsDrill,
          },
        ].map((s, i) => (
          <button key={i} className="stat-card text-left hover:shadow-md transition-shadow cursor-pointer"
            onClick={s.onClick}>
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide leading-tight">{s.label}</span>
              <Icon name={s.icon} size={16} className={s.color} />
            </div>
            <div className="text-2xl font-semibold">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.sub}</div>
          </button>
        ))}
      </div>

      {/* Revenue + Pie charts */}
      <div className="grid grid-cols-3 gap-4">
        {/* Finance numbers */}
        <div className="bg-white border border-border rounded-xl p-5 space-y-3">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">Финансы</div>
          {[
            { label: 'Общая выручка', value: totalRevenue, color: 'text-foreground', bold: true, onClick: openRevenueDrill },
            { label: 'Абонементы', value: subRevenue, color: 'text-blue-600', bold: false, onClick: openSubSalesDrill },
            { label: 'Доп. продажи', value: singleRevenue, color: 'text-violet-600', bold: false, onClick: null },
            { label: 'Расходы', value: -totalExpenses, color: 'text-red-500', bold: false, onClick: openExpensesDrill },
            ...(totalReturns > 0 ? [{ label: 'Возвраты абонементов', value: -totalReturns, color: 'text-orange-600', bold: false, onClick: null as null }] : []),
            { label: 'Прибыль', value: profit, color: profit >= 0 ? 'text-emerald-600' : 'text-red-500', bold: true, onClick: openProfitDrill },
            { label: 'Скидки (потери)', value: -totalDiscounts, color: 'text-orange-500', bold: false, onClick: null },
            ...(totalBonusSpent > 0 ? [{ label: 'Оплачено бонусами', value: -totalBonusSpent, color: 'text-amber-600', bold: false, onClick: null as null }] : []),
          ].map(item => (
            <div key={item.label}
              className={`flex items-center justify-between py-0.5 ${item.onClick ? 'cursor-pointer hover:opacity-70 transition-opacity rounded' : ''}`}
              onClick={item.onClick || undefined}
            >
              <span className="text-sm text-muted-foreground">{item.label}</span>
              <span className={`text-sm font-${item.bold ? 'bold' : 'medium'} ${item.color} flex items-center gap-1`}>
                {item.value < 0 ? '−' : ''}{Math.abs(item.value).toLocaleString()} ₽
                {item.onClick && <Icon name="ChevronRight" size={12} className="text-muted-foreground" />}
              </span>
            </div>
          ))}
          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Рентабельность</span>
              <span className={`text-sm font-bold ${margin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{margin}%</span>
            </div>
            <div className="text-xs text-muted-foreground">Ср. чек: {avgCheck.toLocaleString()} ₽</div>
          </div>
        </div>

        {/* Repeat vs new */}
        <div className="bg-white border border-border rounded-xl p-5">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">Повторные vs новые</div>
          <PieChart segments={[
            { value: renewalSubs + returnSubs, color: '#10b981', label: 'Повторные (продл. + возвр.)' },
            { value: firstTimeSubs, color: '#6366f1', label: 'Первичные' },
          ]} />
          <div className="mt-4 grid grid-cols-2 gap-2 text-center">
            <button className="bg-emerald-50 rounded-lg p-2 hover:bg-emerald-100 transition-colors" onClick={openRenewalsDrill}>
              <div className="text-lg font-bold text-emerald-700">{renewalSubs + returnSubs}</div>
              <div className="text-xs text-emerald-600">Повторные</div>
            </button>
            <button className="bg-violet-50 rounded-lg p-2 hover:bg-violet-100 transition-colors" onClick={openFirstTimesDrill}>
              <div className="text-lg font-bold text-violet-700">{firstTimeSubs}</div>
              <div className="text-xs text-violet-600">Первичные</div>
            </button>
          </div>
        </div>

        {/* Revenue split */}
        <div className="bg-white border border-border rounded-xl p-5">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">Структура выручки</div>
          <PieChart segments={[
            { value: subRevenue, color: '#3b82f6', label: 'Абонементы' },
            { value: singleRevenue, color: '#a855f7', label: 'Доп. продажи' },
          ]} />
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Первичные продажи</span>
              <span className="font-medium text-blue-600">{subSales.filter(s => s.isFirstSubscription).reduce((a, s) => a + s.finalPrice, 0).toLocaleString()} ₽</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Повторные продажи</span>
              <span className="font-medium text-emerald-600">{subSales.filter(s => !s.isFirstSubscription).reduce((a, s) => a + s.finalPrice, 0).toLocaleString()} ₽</span>
            </div>
          </div>
        </div>
      </div>

      {/* Посещения */}
      <button className="w-full text-left bg-white border border-border rounded-xl p-5 hover:shadow-md transition-shadow" onClick={openAttendedDrill}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Посещения за месяц</div>
          <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
        </div>
        <div className="text-2xl font-semibold">{attendedVisitsMonth.length}</div>
        <div className="text-xs text-muted-foreground mt-1">Тренировок отмечено «пришёл»</div>
      </button>

      {/* Funnel */}
      <div className="bg-white border border-border rounded-xl p-5">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-5">Воронка продаж</div>
        <div className="space-y-3">
          {funnelSteps.map((step, i) => {
            const pct = funnelMax > 0 ? (step.value / funnelMax) * 100 : 0;
            const conv = i > 0 && funnelSteps[i - 1].value > 0
              ? Math.round((step.value / funnelSteps[i - 1].value) * 100) : null;
            const onStepClick = i === 0 ? openInquiriesDrill
              : i === 1 ? openInquiriesDrill
              : i === 2 ? openAttendedDrill
              : openFirstTimesDrill;
            return (
              <button key={step.label} className="w-full text-left" onClick={onStepClick}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-muted-foreground">{step.label}</span>
                  <div className="flex items-center gap-3">
                    {conv !== null && (
                      <span className="text-xs text-muted-foreground">конв. {conv}%</span>
                    )}
                    <span className="text-sm font-semibold" style={{ color: step.color }}>{step.value}</span>
                  </div>
                </div>
                <div className="h-6 bg-secondary rounded-lg overflow-hidden">
                  <div className="h-full rounded-lg flex items-center pl-3 text-xs text-white font-medium transition-all duration-500"
                    style={{ width: `${Math.max(pct, 2)}%`, background: step.color }}>
                    {step.value > 0 && Math.round(pct) > 10 ? `${Math.round(pct)}%` : ''}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          Итоговая конверсия: {funnelSteps[0].value > 0 ? Math.round((firstTimeSubs / funnelSteps[0].value) * 100) : 0}% (обращение → покупка)
        </div>
      </div>

      {/* Primary vs repeat revenue */}
      <div className="bg-white border border-border rounded-xl p-5">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">Выручка: первичные vs повторные продажи</div>
        {(() => {
          const primaryRev = subSales.filter(s => s.isFirstSubscription).reduce((a, s) => a + s.finalPrice, 0);
          const repeatRev = subSales.filter(s => !s.isFirstSubscription).reduce((a, s) => a + s.finalPrice, 0);
          const total = primaryRev + repeatRev;
          return (
            <div className="flex items-center gap-6">
              <PieChart segments={[
                { value: repeatRev, color: '#10b981', label: 'Повторные' },
                { value: primaryRev, color: '#6366f1', label: 'Первичные' },
              ]} />
              <div className="flex-1 space-y-3">
                {[
                  { label: 'Повторные продажи', value: repeatRev, color: '#10b981', bg: 'bg-emerald-50', onClick: openRenewalsDrill },
                  { label: 'Первичные продажи', value: primaryRev, color: '#6366f1', bg: 'bg-violet-50', onClick: openFirstTimesDrill },
                ].map(item => (
                  <button key={item.label} className="w-full text-left" onClick={item.onClick}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-semibold">{item.value.toLocaleString()} ₽ ({total > 0 ? Math.round(item.value / total * 100) : 0}%)</span>
                    </div>
                    <MiniBar pct={total > 0 ? item.value / total * 100 : 0} color={item.color} />
                  </button>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Drill-down modal */}
      {drill && (
        <DrillModal
          title={drill.title}
          items={drill.items}
          onClose={() => setDrill(null)}
        />
      )}
    </div>
  );
}
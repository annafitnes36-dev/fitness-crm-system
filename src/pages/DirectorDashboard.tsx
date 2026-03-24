import { useState } from 'react';
import { StoreType } from '@/store';
import Icon from '@/components/ui/icon';

interface DirectorDashboardProps {
  store: StoreType;
}

type PeriodKey = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

function getPeriodDates(period: PeriodKey, customFrom: string, customTo: string): { from: string; to: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const today = fmt(now);
  if (period === 'today') return { from: today, to: today };
  if (period === 'week') {
    const mon = new Date(now); mon.setDate(now.getDate() - now.getDay() + 1); return { from: fmt(mon), to: today };
  }
  if (period === 'month') return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
  if (period === 'quarter') {
    const q = Math.floor(now.getMonth() / 3);
    return { from: fmt(new Date(now.getFullYear(), q * 3, 1)), to: today };
  }
  if (period === 'year') return { from: fmt(new Date(now.getFullYear(), 0, 1)), to: today };
  return { from: customFrom || fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: customTo || today };
}

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

export default function DirectorDashboard({ store }: DirectorDashboardProps) {
  const { state } = store;
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>('all');

  const { from, to } = getPeriodDates(period, customFrom, customTo);

  const inPeriod = (date: string) => date >= from && date <= to;

  // Branch filter
  const branchSales = state.sales.filter(s =>
    inPeriod(s.date) && (branchFilter === 'all' || s.branchId === branchFilter)
  );
  const subSales = branchSales.filter(s => s.type === 'subscription');
  const singleSales = branchSales.filter(s => s.type === 'single');

  const totalSubs = subSales.length;
  const firstTimeSubs = subSales.filter(s => s.isFirstSubscription).length;
  const renewalSubs = subSales.filter(s => s.isRenewal).length;
  const returnSubs = subSales.filter(s => s.isReturn).length;

  const subRevenue = subSales.reduce((s, x) => s + x.finalPrice, 0);
  const singleRevenue = singleSales.reduce((s, x) => s + x.finalPrice, 0);
  const totalRevenue = subRevenue + singleRevenue;

  const branchExpenses = state.expenses.filter(e =>
    inPeriod(e.date) && (branchFilter === 'all' || e.branchId === branchFilter)
  );
  const totalExpenses = branchExpenses.reduce((s, e) => s + e.amount, 0);
  const profit = totalRevenue - totalExpenses;
  const margin = totalRevenue > 0 ? Math.round((profit / totalRevenue) * 100) : 0;
  const totalDiscounts = branchSales.reduce((s, x) => s + (x.price - x.finalPrice), 0);
  const avgCheck = totalSubs > 0 ? Math.round(subRevenue / totalSubs) : 0;

  // Funnel
  const branchInquiries = state.inquiries.filter(i =>
    inPeriod(i.date) && (branchFilter === 'all' || i.branchId === branchFilter)
  ).length;
  const newClients = state.clients.filter(c =>
    inPeriod(c.createdAt) && (branchFilter === 'all' || c.branchId === branchFilter)
  ).length;

  const branchScheduleIds = new Set(state.schedule.filter(e =>
    branchFilter === 'all' || e.branchId === branchFilter
  ).map(e => e.id));
  const attendedVisits = state.visits.filter(v =>
    v.status === 'attended' && inPeriod(v.date) && branchScheduleIds.has(v.scheduleEntryId)
  ).length;

  const funnelSteps = [
    { label: 'Обращений', value: branchInquiries + newClients, color: '#8b5cf6' },
    { label: 'Зарегистрировалось', value: newClients, color: '#3b82f6' },
    { label: 'Дошло до занятий', value: attendedVisits, color: '#10b981' },
    { label: 'Купило (новички)', value: firstTimeSubs, color: '#f59e0b' },
  ];
  const funnelMax = funnelSteps[0].value || 1;

  const PERIODS: { key: PeriodKey; label: string }[] = [
    { key: 'today', label: 'Сегодня' },
    { key: 'week', label: 'Неделя' },
    { key: 'month', label: 'Месяц' },
    { key: 'quarter', label: 'Квартал' },
    { key: 'year', label: 'Год' },
    { key: 'custom', label: 'Период' },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-secondary rounded-xl p-1">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${period === p.key ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {p.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="border border-input rounded-lg px-3 py-1.5 text-sm" />
            <span className="text-muted-foreground text-sm">—</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="border border-input rounded-lg px-3 py-1.5 text-sm" />
          </div>
        )}
        <select className="border border-input rounded-lg px-3 py-1.5 text-sm ml-auto" value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
          <option value="all">Все филиалы</option>
          {state.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {/* Sales counts */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Продаж абонементов', value: totalSubs, sub: 'за период', icon: 'CreditCard', color: 'text-blue-600' },
          { label: 'Продлений', value: renewalSubs, sub: `${totalSubs > 0 ? Math.round(renewalSubs/totalSubs*100) : 0}% от продаж`, icon: 'RefreshCw', color: 'text-emerald-600' },
          { label: 'Новички', value: firstTimeSubs, sub: 'первая покупка', icon: 'UserPlus', color: 'text-violet-600' },
          { label: 'Возвращения', value: returnSubs, sub: 'вернулись после паузы', icon: 'TrendingUp', color: 'text-amber-600' },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide leading-tight">{s.label}</span>
              <Icon name={s.icon} size={16} className={s.color} />
            </div>
            <div className="text-2xl font-semibold">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Revenue + Pie charts */}
      <div className="grid grid-cols-3 gap-4">
        {/* Finance numbers */}
        <div className="bg-white border border-border rounded-xl p-5 space-y-3">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">Финансы</div>
          {[
            { label: 'Общая выручка', value: totalRevenue, color: 'text-foreground', bold: true },
            { label: 'Абонементы', value: subRevenue, color: 'text-blue-600', bold: false },
            { label: 'Доп. продажи', value: singleRevenue, color: 'text-violet-600', bold: false },
            { label: 'Расходы', value: -totalExpenses, color: 'text-red-500', bold: false },
            { label: 'Прибыль', value: profit, color: profit >= 0 ? 'text-emerald-600' : 'text-red-500', bold: true },
            { label: 'Скидки (потери)', value: -totalDiscounts, color: 'text-orange-500', bold: false },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between py-0.5">
              <span className="text-sm text-muted-foreground">{item.label}</span>
              <span className={`text-sm font-${item.bold ? 'bold' : 'medium'} ${item.color}`}>
                {item.value < 0 ? '−' : ''}{Math.abs(item.value).toLocaleString()} ₽
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
            <div className="bg-emerald-50 rounded-lg p-2">
              <div className="text-lg font-bold text-emerald-700">{renewalSubs + returnSubs}</div>
              <div className="text-xs text-emerald-600">Повторные</div>
            </div>
            <div className="bg-violet-50 rounded-lg p-2">
              <div className="text-lg font-bold text-violet-700">{firstTimeSubs}</div>
              <div className="text-xs text-violet-600">Первичные</div>
            </div>
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

      {/* Funnel */}
      <div className="bg-white border border-border rounded-xl p-5">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-5">Воронка продаж</div>
        <div className="space-y-3">
          {funnelSteps.map((step, i) => {
            const pct = funnelMax > 0 ? (step.value / funnelMax) * 100 : 0;
            const conv = i > 0 && funnelSteps[i - 1].value > 0
              ? Math.round((step.value / funnelSteps[i - 1].value) * 100) : null;
            return (
              <div key={step.label}>
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
              </div>
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
                  { label: 'Повторные продажи', value: repeatRev, color: '#10b981', bg: 'bg-emerald-50' },
                  { label: 'Первичные продажи', value: primaryRev, color: '#6366f1', bg: 'bg-violet-50' },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-semibold">{item.value.toLocaleString()} ₽ ({total > 0 ? Math.round(item.value / total * 100) : 0}%)</span>
                    </div>
                    <MiniBar pct={total > 0 ? item.value / total * 100 : 0} color={item.color} />
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

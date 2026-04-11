import { useState } from 'react';
import { StoreType, Client, Inquiry, Sale } from '@/store';
import Icon from '@/components/ui/icon';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface DashboardProps {
  store: StoreType;
  onSell: () => void;
  onNavigate: (page: string) => void;
}

type PeriodKey = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
function getPeriodDates(period: PeriodKey, customFrom: string, customTo: string, browseYear: number, browseMonthIdx: number) {
  const now = new Date();
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = fmt(now);
  if (period === 'today') return { from: today, to: today };
  if (period === 'week') { const m = new Date(now); m.setDate(now.getDate() - now.getDay() + 1); return { from: fmt(m), to: today }; }
  if (period === 'month') {
    const from = fmt(new Date(browseYear, browseMonthIdx, 1));
    const to = fmt(new Date(browseYear, browseMonthIdx + 1, 0));
    return { from, to };
  }
  if (period === 'quarter') { const q = Math.floor(now.getMonth() / 3); return { from: fmt(new Date(now.getFullYear(), q * 3, 1)), to: today }; }
  if (period === 'year') return { from: fmt(new Date(now.getFullYear(), 0, 1)), to: today };
  return { from: customFrom || fmt(new Date(browseYear, browseMonthIdx, 1)), to: customTo || today };
}

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: 'Сегодня' }, { key: 'week', label: 'Неделя' }, { key: 'month', label: 'Месяц' },
  { key: 'quarter', label: 'Квартал' }, { key: 'year', label: 'Год' }, { key: 'custom', label: 'Период' },
];

export default function Dashboard({ store, onSell, onNavigate }: DashboardProps) {
  const { state, getClientCategory, deleteInquiry, hideDashboardItem, restoreDashboardItem, setSaleOverride } = store;
  const now = new Date();

  // Month navigation (only when period === 'month')
  const [browseYear, setBrowseYear] = useState(now.getFullYear());
  const [browseMonthIdx, setBrowseMonthIdx] = useState(now.getMonth());

  const isCurrentMonth = browseYear === now.getFullYear() && browseMonthIdx === now.getMonth();
  const browsedMonth = `${browseYear}-${String(browseMonthIdx + 1).padStart(2, '0')}`;
  const currentMonth = browsedMonth;

  const goPrevMonth = () => {
    if (browseMonthIdx === 0) { setBrowseYear(y => y - 1); setBrowseMonthIdx(11); }
    else setBrowseMonthIdx(m => m - 1);
  };
  const goNextMonth = () => {
    if (isCurrentMonth) return;
    if (browseMonthIdx === 11) { setBrowseYear(y => y + 1); setBrowseMonthIdx(0); }
    else setBrowseMonthIdx(m => m + 1);
  };

  const [period, setPeriod] = useState<PeriodKey>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const { from: periodFrom, to: periodTo } = getPeriodDates(period, customFrom, customTo, browseYear, browseMonthIdx);
  const inPeriod = (date: string) => date >= periodFrom && date <= periodTo;

  // Hidden IDs are stored as "cardKey:id" strings
  const hiddenIds = new Set(state.dashboardHiddenIds || []);
  const hiddenForCard = (cardKey: string, id: string) => hiddenIds.has(`${cardKey}:${id}`);

  // Sale category helper — applies saleOverrides
  const getSaleCategory = (sale: Sale): 'first' | 'renewal' | 'return' | 'other' => {
    const override = (state.saleOverrides || {})[sale.id];
    if (override) return override;
    if (sale.isFirstSubscription) return 'first';
    if (sale.isRenewal) return 'renewal';
    if (sale.isReturn) return 'return';
    return 'other';
  };

  const branchSales = state.sales.filter(s => s.branchId === state.currentBranchId);
  // All subscription sales in period (including hidden) — for detail modal
  const allMonthSubSales = branchSales.filter(s => s.type === 'subscription' && inPeriod(s.date));

  // Refunded sale IDs: for each refund find the original sale
  const refundedSaleIds = new Set<string>();
  branchSales.filter(s => s.isRefund).forEach(refund => {
    const original = branchSales
      .filter(s => !s.isRefund && s.clientId === refund.clientId && s.itemId === refund.itemId && s.date <= refund.date)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (original) refundedSaleIds.add(original.id);
  });

  // Visible sales (not hidden per card, not refunds, not refunded)
  // For totalSubs card — hidden by 'totalSubs' cardKey
  const monthSubSalesTotal = allMonthSubSales.filter(s =>
    !hiddenForCard('totalSubs', s.id) && !s.isRefund && !refundedSaleIds.has(s.id)
  );
  const totalSubs = monthSubSalesTotal.length;

  // firstTimeSubs card — hidden by 'firstTimeSubs' cardKey
  const monthSubSalesFirst = allMonthSubSales.filter(s =>
    !s.isRefund && !refundedSaleIds.has(s.id)
  );
  const firstTimeSubs = monthSubSalesFirst.filter(s =>
    !hiddenForCard('firstTimeSubs', s.id) && getSaleCategory(s) === 'first'
  ).length;

  // renewals card — hidden by 'renewals' cardKey
  const renewalSubSalesCount = allMonthSubSales.filter(s =>
    !hiddenForCard('renewals', s.id) && !s.isRefund && !refundedSaleIds.has(s.id) && getSaleCategory(s) === 'renewal'
  ).length;

  // returns card — hidden by 'returns' cardKey
  const returnSubSalesCount = allMonthSubSales.filter(s =>
    !hiddenForCard('returns', s.id) && !s.isRefund && !refundedSaleIds.has(s.id) && getSaleCategory(s) === 'return'
  ).length;

  const branchClients = state.clients.filter(c => c.branchId === state.currentBranchId && !c.dashboardExclude);
  const newClientsMonth = branchClients.filter(c => inPeriod(c.createdAt) && !hiddenForCard('inquiries', c.id)).length;
  const monthInquiries = state.inquiries.filter(i => i.branchId === state.currentBranchId && inPeriod(i.date) && !hiddenForCard('inquiries', i.id)).length;
  const totalInquiries = monthInquiries + newClientsMonth;

  const todayStr = now.toISOString().split('T')[0];
  const todaySchedule = state.schedule.filter(s => s.branchId === state.currentBranchId && s.date === todayStr);

  const branchScheduleIds = new Set(state.schedule.filter(e => e.branchId === state.currentBranchId).map(e => e.id));
  const monthVisits = state.visits.filter(v => branchScheduleIds.has(v.scheduleEntryId) && inPeriod(v.date));
  const attendedMonth = monthVisits.filter(v => v.status === 'attended').length;
  const missedMonth = monthVisits.filter(v => v.status === 'missed').length;
  const cancelledMonth = monthVisits.filter(v => v.status === 'cancelled').length;

  // First enrollment tracking per branch
  const branchAttendedByClient: Record<string, string[]> = {};
  state.visits.filter(v => v.status === 'attended' && branchScheduleIds.has(v.scheduleEntryId)).forEach(v => {
    if (!branchAttendedByClient[v.clientId]) branchAttendedByClient[v.clientId] = [];
    branchAttendedByClient[v.clientId].push(v.date);
  });

  const clientHasSubAtDate = (clientId: string, visitDate: string): boolean => {
    return branchSales.some(s =>
      s.clientId === clientId &&
      s.type === 'subscription' &&
      !s.isRefund &&
      s.date <= visitDate
    );
  };

  // All first enrollments (including hidden) — for detail modal
  const allFirstEnrollments = new Set<string>();
  // Visible (not hidden per 'firstEnrollments' card) — for card counter
  const firstEnrollments = new Set<string>();
  state.visits.filter(v => {
    if (!['attended', 'enrolled', 'missed'].includes(v.status)) return false;
    if (!inPeriod(v.date)) return false;
    return branchScheduleIds.has(v.scheduleEntryId);
  }).forEach(v => {
    const prevVisits = (branchAttendedByClient[v.clientId] || []).filter(d => d < periodFrom);
    if (prevVisits.length === 0 && !clientHasSubAtDate(v.clientId, v.date)) {
      allFirstEnrollments.add(v.clientId);
      if (!hiddenForCard('firstEnrollments', v.clientId)) firstEnrollments.add(v.clientId);
    }
  });
  const firstEnrollmentsCount = firstEnrollments.size;

  // Attended newbies — first attended visit in period (no subscription)
  const allAttendedNewbies = new Set<string>();
  const attendedNewbies = new Set<string>();
  state.visits.filter(v => v.status === 'attended' && branchScheduleIds.has(v.scheduleEntryId)).forEach(v => {
    const clientAttended = branchAttendedByClient[v.clientId] || [];
    const firstDate = [...clientAttended].sort()[0];
    if (firstDate && inPeriod(firstDate) && firstDate === v.date && !clientHasSubAtDate(v.clientId, v.date)) {
      allAttendedNewbies.add(v.clientId);
      if (!hiddenForCard('attendedNewbies', v.clientId)) attendedNewbies.add(v.clientId);
    }
  });
  const attendedNewbiesCount = attendedNewbies.size;

  // Sales plan
  const currentPlan = state.salesPlans.find(p => p.branchId === state.currentBranchId && p.month === currentMonth);
  // Monthly plan for renewals/returns targets
  const currentMonthlyPlan = state.monthlyPlans?.find(p => p.branchId === state.currentBranchId && p.month === currentMonth);
  const renewalTarget = currentMonthlyPlan?.plan?.renewals ?? 0;
  const returnTarget = currentMonthlyPlan?.plan?.returns ?? 0;

  const branchPlans = (() => {
    if (currentPlan && currentPlan.items.length > 0) {
      return currentPlan.items
        .map(item => state.subscriptionPlans.find(p => p.id === item.planId))
        .filter((p): p is NonNullable<typeof p> => p !== undefined);
    }
    return state.subscriptionPlans.filter(p => !p.branchId || p.branchId === state.currentBranchId);
  })();

  const planRows = branchPlans.map(plan => {
    const target = currentPlan?.items.find(i => i.planId === plan.id)?.target ?? 0;
    const sold = monthSubSalesTotal.filter(s => s.itemId === plan.id).length;
    const left = Math.max(0, target - sold);
    const pct = target > 0 ? Math.min(100, Math.round((sold / target) * 100)) : null;
    return { plan, target, sold, left, pct };
  });

  const totalTarget = planRows.reduce((s, r) => s + r.target, 0);
  const totalSold = planRows.reduce((s, r) => s + r.sold, 0);
  const totalLeft = planRows.reduce((s, r) => s + r.left, 0);
  const totalPct = totalTarget > 0 ? Math.min(100, Math.round((totalSold / totalTarget) * 100)) : null;

  const periodSales = branchSales.filter(s => inPeriod(s.date)).slice().reverse();
  const recentSales = period === 'month' ? periodSales : periodSales.slice(0, 20);

  const monthLabel = new Date(browseYear, browseMonthIdx, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

  // Average check — subscriptions only (not hidden per totalSubs, not refunds, not refunded)
  const periodSubSales = branchSales.filter(s =>
    s.type === 'subscription' && inPeriod(s.date) &&
    !hiddenForCard('totalSubs', s.id) && !s.isRefund && !refundedSaleIds.has(s.id)
  );
  const factAvgCheck = periodSubSales.length > 0 ? Math.round(periodSubSales.reduce((s, x) => s + x.finalPrice, 0) / periodSubSales.length) : 0;
  const planAvgCheck = (() => {
    const plan = state.salesPlans.find(p => p.branchId === state.currentBranchId && p.month === currentMonth);
    if (!plan || plan.items.length === 0) return 0;
    let totalRevenue = 0, totalCount = 0;
    plan.items.forEach(item => {
      const subPlan = state.subscriptionPlans.find(p => p.id === item.planId);
      if (subPlan && item.target > 0) {
        totalRevenue += subPlan.price * item.target;
        totalCount += item.target;
      }
    });
    return totalCount > 0 ? Math.round(totalRevenue / totalCount) : 0;
  })();
  const avgCheckPct = planAvgCheck > 0 ? Math.round((factAvgCheck / planAvgCheck) * 100) : null;

  // Conversions
  const convInquiryToEnroll = totalInquiries > 0 ? Math.round((firstEnrollmentsCount / totalInquiries) * 100) : null;
  const convEnrollToAttend = firstEnrollmentsCount > 0 ? Math.round((attendedNewbiesCount / firstEnrollmentsCount) * 100) : null;
  const convAttendToBuy = attendedNewbiesCount > 0 ? Math.round((firstTimeSubs / attendedNewbiesCount) * 100) : null;

  // Renewal / return % of plan
  const renewalPct = renewalTarget > 0 ? Math.min(100, Math.round((renewalSubSalesCount / renewalTarget) * 100)) : null;
  const returnPct = returnTarget > 0 ? Math.min(100, Math.round((returnSubSalesCount / returnTarget) * 100)) : null;

  // Detail data helpers
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
  const clientName = (c: Client) => [c.lastName, c.firstName].filter(Boolean).join(' ') || c.phone || '—';

  const currentStaff = state.staff.find(s => s.id === state.currentStaffId);
  const canDelete = true;
  const canDeleteInquiriesOnly = currentStaff?.role === 'admin';

  type DetailRow = {
    name: string;
    sub: string;
    id: string;
    cardKey: string;
    saleId?: string;
    deleteType: 'inquiry' | 'sale' | 'client' | 'hide' | null;
  };
  type DetailData = { title: string; rows: DetailRow[] };
  type DetailKey = 'inquiries' | 'firstEnrollments' | 'attendedNewbies' | 'firstTimeSubs' | 'totalSubs' | 'renewals' | 'returns';

  const detailInquiries: DetailData = {
    title: 'Обращения',
    rows: [
      ...state.inquiries.filter(i => i.branchId === state.currentBranchId && inPeriod(i.date)).map((i: Inquiry) => ({
        name: i.channel || '—',
        sub: `${fmtDate(i.date)} · ${i.adSource || 'источник не указан'}${i.note ? ' · ' + i.note : ''}${hiddenForCard('inquiries', i.id) ? ' · скрыто с дашборда' : ''}`,
        id: i.id,
        cardKey: 'inquiries',
        deleteType: 'inquiry' as const,
      })),
      ...branchClients.filter(c => inPeriod(c.createdAt)).map(c => ({
        name: clientName(c),
        sub: `${fmtDate(c.createdAt)} · регистрация клиента${hiddenForCard('inquiries', c.id) ? ' · скрыто с дашборда' : ''}`,
        id: c.id,
        cardKey: 'inquiries',
        deleteType: 'client' as const,
      })),
    ],
  };

  const detailFirstEnrollments: DetailData = {
    title: 'Записи на пробную тренировку',
    rows: Array.from(allFirstEnrollments).map(clientId => {
      const c = state.clients.find(cl => cl.id === clientId);
      const visit = state.visits.find(v => branchScheduleIds.has(v.scheduleEntryId) && v.clientId === clientId && inPeriod(v.date));
      const entry = visit ? state.schedule.find(e => e.id === visit.scheduleEntryId) : null;
      const tt = entry ? state.trainingTypes.find(t => t.id === entry.trainingTypeId) : null;
      const isHidden = hiddenForCard('firstEnrollments', clientId);
      return {
        name: c ? clientName(c) : clientId,
        sub: `${visit ? fmtDate(visit.date) : '—'}${tt ? ' · ' + tt.name : ''}${isHidden ? ' · скрыто с дашборда' : ''}`,
        id: clientId,
        cardKey: 'firstEnrollments',
        deleteType: 'hide' as const,
      };
    }),
  };

  const detailAttendedNewbies: DetailData = {
    title: 'Дошли новички (первый визит)',
    rows: Array.from(allAttendedNewbies).map(clientId => {
      const c = state.clients.find(cl => cl.id === clientId);
      const dates = branchAttendedByClient[clientId] || [];
      const firstDate = [...dates].sort()[0];
      const isHidden = hiddenForCard('attendedNewbies', clientId);
      return {
        name: c ? clientName(c) : clientId,
        sub: `${firstDate ? fmtDate(firstDate) : '—'}${isHidden ? ' · скрыто с дашборда' : ''}`,
        id: clientId,
        cardKey: 'attendedNewbies',
        deleteType: 'hide' as const,
      };
    }),
  };

  // firstTimeSubs detail — all first-subscription sales (not refunds, not refunded)
  const firstTimeSubSales = allMonthSubSales.filter(s => getSaleCategory(s) === 'first' && !s.isRefund && !refundedSaleIds.has(s.id));
  const detailFirstTimeSubs: DetailData = {
    title: 'Купили абонемент (новички)',
    rows: firstTimeSubSales.map(s => {
      const c = state.clients.find(cl => cl.id === s.clientId);
      const isHidden = hiddenForCard('firstTimeSubs', s.id);
      return {
        name: c ? clientName(c) : '—',
        sub: `${fmtDate(s.date)} · ${s.itemName} · ${s.finalPrice.toLocaleString()} ₽${isHidden ? ' · скрыто с дашборда' : ''}`,
        id: s.id,
        cardKey: 'firstTimeSubs',
        saleId: s.id,
        deleteType: 'sale' as const,
      };
    }),
  };

  // totalSubs detail — all sales (not refunds, not refunded) with category tag
  const detailTotalSubsSales = allMonthSubSales.filter(s => !s.isRefund && !refundedSaleIds.has(s.id));
  const detailTotalSubs: DetailData = {
    title: 'Все продажи абонементов',
    rows: detailTotalSubsSales.map(s => {
      const c = state.clients.find(cl => cl.id === s.clientId);
      const cat = getSaleCategory(s);
      const tag = cat === 'first' ? 'новый' : cat === 'renewal' ? 'продление' : cat === 'return' ? 'возвращение' : '';
      const isHidden = hiddenForCard('totalSubs', s.id);
      return {
        name: c ? clientName(c) : '—',
        sub: `${fmtDate(s.date)} · ${s.itemName} · ${s.finalPrice.toLocaleString()} ₽${tag ? ' · ' + tag : ''}${isHidden ? ' · скрыто с дашборда' : ''}`,
        id: s.id,
        cardKey: 'totalSubs',
        saleId: s.id,
        deleteType: 'sale' as const,
      };
    }),
  };

  // renewals detail
  const renewalSalesList = allMonthSubSales.filter(s => !s.isRefund && !refundedSaleIds.has(s.id) && getSaleCategory(s) === 'renewal');
  const detailRenewals: DetailData = {
    title: 'Продления',
    rows: renewalSalesList.map(s => {
      const c = state.clients.find(cl => cl.id === s.clientId);
      const isHidden = hiddenForCard('renewals', s.id);
      return {
        name: c ? clientName(c) : '—',
        sub: `${fmtDate(s.date)} · ${s.itemName} · ${s.finalPrice.toLocaleString()} ₽${isHidden ? ' · скрыто с дашборда' : ''}`,
        id: s.id,
        cardKey: 'renewals',
        saleId: s.id,
        deleteType: 'sale' as const,
      };
    }),
  };

  // returns detail
  const returnSalesList = allMonthSubSales.filter(s => !s.isRefund && !refundedSaleIds.has(s.id) && getSaleCategory(s) === 'return');
  const detailReturns: DetailData = {
    title: 'Возвращения',
    rows: returnSalesList.map(s => {
      const c = state.clients.find(cl => cl.id === s.clientId);
      const isHidden = hiddenForCard('returns', s.id);
      return {
        name: c ? clientName(c) : '—',
        sub: `${fmtDate(s.date)} · ${s.itemName} · ${s.finalPrice.toLocaleString()} ₽${isHidden ? ' · скрыто с дашборда' : ''}`,
        id: s.id,
        cardKey: 'returns',
        saleId: s.id,
        deleteType: 'sale' as const,
      };
    }),
  };

  const [activeDetailKey, setActiveDetailKey] = useState<DetailKey | null>(null);

  const detailMap: Record<DetailKey, DetailData> = {
    inquiries: detailInquiries,
    firstEnrollments: detailFirstEnrollments,
    attendedNewbies: detailAttendedNewbies,
    firstTimeSubs: detailFirstTimeSubs,
    totalSubs: detailTotalSubs,
    renewals: detailRenewals,
    returns: detailReturns,
  };
  const activeDetail = activeDetailKey ? detailMap[activeDetailKey] : null;

  const handleHideRow = (row: DetailRow) => {
    if (!row.deleteType) return;
    if (row.deleteType === 'inquiry') deleteInquiry(row.id);
    else hideDashboardItem(row.cardKey, row.id);
  };

  const handleRestoreRow = (row: DetailRow) => {
    restoreDashboardItem(row.cardKey, row.id);
  };

  // isHidden check per row using cardKey
  const isRowHidden = (row: DetailRow) => {
    if (row.deleteType === 'inquiry') return false;
    return hiddenIds.has(`${row.cardKey}:${row.id}`);
  };

  // Funnel steps definition
  const funnelSteps = [
    {
      key: 'inquiries' as DetailKey,
      label: 'Обращений',
      value: totalInquiries,
      color: 'bg-violet-100 border-violet-300',
      textColor: 'text-violet-700',
      width: '100%',
      conv: convInquiryToEnroll,
    },
    {
      key: 'firstEnrollments' as DetailKey,
      label: 'Записей на пробную',
      value: firstEnrollmentsCount,
      color: 'bg-indigo-100 border-indigo-300',
      textColor: 'text-indigo-700',
      width: '85%',
      conv: convEnrollToAttend,
    },
    {
      key: 'attendedNewbies' as DetailKey,
      label: 'Дошло новичков',
      value: attendedNewbiesCount,
      color: 'bg-blue-100 border-blue-300',
      textColor: 'text-blue-700',
      width: '70%',
      conv: convAttendToBuy,
    },
    {
      key: 'firstTimeSubs' as DetailKey,
      label: 'Купили (новички)',
      value: firstTimeSubs,
      color: 'bg-emerald-100 border-emerald-300',
      textColor: 'text-emerald-700',
      width: '55%',
      conv: null,
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Period selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-secondary rounded-xl p-1">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${period === p.key ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Month navigation */}
        {period === 'month' && (
          <div className="flex items-center gap-1 bg-secondary rounded-xl p-1">
            <button onClick={goPrevMonth} className="px-2 py-1.5 rounded-lg hover:bg-white transition-colors text-muted-foreground hover:text-foreground">
              <Icon name="ChevronLeft" size={16} />
            </button>
            <span className="px-2 text-sm font-medium capitalize min-w-32 text-center">{monthLabel}</span>
            <button onClick={goNextMonth} disabled={isCurrentMonth}
              className="px-2 py-1.5 rounded-lg hover:bg-white transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed">
              <Icon name="ChevronRight" size={16} />
            </button>
          </div>
        )}

        {period === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="border border-input rounded-lg px-3 py-1.5 text-sm" />
            <span className="text-muted-foreground text-sm">—</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="border border-input rounded-lg px-3 py-1.5 text-sm" />
          </div>
        )}
      </div>

      {/* Main stats: left column (35%) + right column funnel (65%) */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '35% 1fr' }}>
        {/* Left column: compact stat cards */}
        <div className="space-y-3">
          {/* Total sales */}
          <button
            onClick={() => setActiveDetailKey('totalSubs')}
            className="stat-card w-full text-left hover:ring-2 hover:ring-border transition-all"
          >
            <div className="flex justify-between items-start mb-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Продаж всего</span>
              <Icon name="CreditCard" size={14} className="text-foreground" />
            </div>
            <div className="text-3xl font-bold">{totalSubs}</div>
            {totalPct !== null && (
              <div className="mt-2 h-1 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${totalPct >= 100 ? 'bg-emerald-500' : totalPct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                  style={{ width: `${Math.min(100, totalPct)}%` }}
                />
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-1">
              {totalTarget > 0 ? `план ${totalTarget} · ${totalPct ?? 0}%` : 'план не задан'}
            </div>
          </button>

          {/* Renewals */}
          <button
            onClick={() => setActiveDetailKey('renewals')}
            className="stat-card w-full text-left hover:ring-2 hover:ring-border transition-all"
          >
            <div className="flex justify-between items-start mb-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Продления</span>
              <Icon name="RefreshCw" size={14} className="text-sky-500" />
            </div>
            <div className="text-3xl font-bold">{renewalSubSalesCount}</div>
            {renewalPct !== null && (
              <div className="mt-2 h-1 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${renewalPct >= 100 ? 'bg-emerald-500' : renewalPct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                  style={{ width: `${Math.min(100, renewalPct)}%` }}
                />
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-1">
              {renewalTarget > 0 ? `план ${renewalTarget} · ${renewalPct ?? 0}%` : 'план не задан'}
            </div>
          </button>

          {/* Returns */}
          <button
            onClick={() => setActiveDetailKey('returns')}
            className="stat-card w-full text-left hover:ring-2 hover:ring-border transition-all"
          >
            <div className="flex justify-between items-start mb-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Возвращения</span>
              <Icon name="UserCheck" size={14} className="text-teal-500" />
            </div>
            <div className="text-3xl font-bold">{returnSubSalesCount}</div>
            {returnPct !== null && (
              <div className="mt-2 h-1 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${returnPct >= 100 ? 'bg-emerald-500' : returnPct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                  style={{ width: `${Math.min(100, returnPct)}%` }}
                />
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-1">
              {returnTarget > 0 ? `план ${returnTarget} · ${returnPct ?? 0}%` : 'план не задан'}
            </div>
          </button>

          {/* Average check */}
          <div className="stat-card">
            <div className="flex justify-between items-start mb-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Средний чек</span>
              <Icon name="Banknote" size={14} className="text-amber-500" />
            </div>
            <div className="text-3xl font-bold">
              {factAvgCheck > 0 ? factAvgCheck.toLocaleString('ru-RU') + ' ₽' : '—'}
            </div>
            {planAvgCheck > 0 ? (
              <div className="text-xs text-muted-foreground mt-1">
                план {planAvgCheck.toLocaleString('ru-RU')} ₽
                {avgCheckPct !== null && (
                  <span className={`ml-1.5 font-medium ${avgCheckPct >= 100 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {avgCheckPct}%
                  </span>
                )}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground mt-1">план не задан</div>
            )}
          </div>
        </div>

        {/* Right column: funnel visualization */}
        <div className="stat-card flex flex-col justify-center">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">Воронка привлечения</div>
          <div className="flex flex-col gap-2">
            {funnelSteps.map((step) => (
              <button
                key={step.key}
                onClick={() => setActiveDetailKey(step.key)}
                className={`mx-auto border rounded-xl px-4 py-3 hover:opacity-80 transition-opacity cursor-pointer flex items-center justify-between ${step.color}`}
                style={{ width: step.width }}
              >
                <div>
                  <div className={`text-2xl font-bold ${step.textColor}`}>{step.value}</div>
                  <div className={`text-xs font-medium ${step.textColor} opacity-80`}>{step.label}</div>
                </div>
                {step.conv !== null && (
                  <div className={`text-sm font-semibold ${step.textColor} opacity-70`}>
                    {step.conv}% →
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sales plan table */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">План продаж</div>
            <div className="text-xs text-muted-foreground mt-0.5 capitalize">{monthLabel}</div>
          </div>
        </div>
        {branchPlans.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Нет абонементов для этого филиала</div>
        ) : (
          <table className="w-full data-table">
            <thead>
              <tr>
                <th>Абонемент</th>
                <th className="text-center">План</th>
                <th className="text-center">Продано</th>
                <th className="text-center">Осталось</th>
                <th className="text-center">Выполнение</th>
              </tr>
            </thead>
            <tbody>
              {planRows.map(({ plan, target, sold, left, pct }) => (
                <tr key={plan.id}>
                  <td className="font-medium">{plan.name}</td>
                  <td className="text-center text-muted-foreground">{target > 0 ? target : '—'}</td>
                  <td className="text-center font-medium">{sold}</td>
                  <td className="text-center">
                    {target > 0 ? (
                      <span className={left === 0 ? 'text-emerald-600 font-medium' : 'text-muted-foreground'}>{left === 0 ? '✓' : left}</span>
                    ) : '—'}
                  </td>
                  <td className="text-center">
                    {pct !== null ? (
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                        <span className={`text-xs font-medium ${pct >= 100 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{pct}%</span>
                      </div>
                    ) : <span className="text-muted-foreground text-xs">нет плана</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-secondary/30 font-semibold">
                <td className="px-4 py-3 text-sm">Итого</td>
                <td className="text-center px-4 py-3 text-sm">{totalTarget > 0 ? totalTarget : '—'}</td>
                <td className="text-center px-4 py-3 text-sm">{totalSold}</td>
                <td className="text-center px-4 py-3 text-sm">
                  {totalTarget > 0 ? (
                    <span className={totalLeft === 0 ? 'text-emerald-600' : ''}>{totalLeft === 0 ? '✓ Выполнен' : totalLeft}</span>
                  ) : '—'}
                </td>
                <td className="text-center px-4 py-3">
                  {totalPct !== null ? (
                    <div className="flex items-center gap-2 justify-center">
                      <div className="w-20 h-2 bg-secondary rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${totalPct >= 100 ? 'bg-emerald-500' : totalPct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                          style={{ width: `${totalPct}%` }} />
                      </div>
                      <span className={`text-sm font-bold ${totalPct >= 100 ? 'text-emerald-600' : totalPct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{totalPct}%</span>
                    </div>
                  ) : null}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Visit stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-border rounded-xl p-5">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">Посещения за период</div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Пришли', value: attendedMonth, color: 'text-emerald-600' },
              { label: 'Пропустили', value: missedMonth, color: 'text-red-500' },
              { label: 'Отменили', value: cancelledMonth, color: 'text-amber-500' },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className={`text-xl font-semibold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Today's schedule */}
        <div className="bg-white border border-border rounded-xl p-5">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Расписание сегодня</div>
          {todaySchedule.length === 0 ? (
            <div className="text-sm text-muted-foreground">Тренировок нет</div>
          ) : (
            <div className="space-y-2">
              {todaySchedule.slice(0, 4).map(entry => {
                const tt = state.trainingTypes.find(t => t.id === entry.trainingTypeId);
                const trainer = state.trainers.find(t => t.id === entry.trainerId);
                return (
                  <div key={entry.id} className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground font-mono text-xs w-10 shrink-0">{entry.time}</span>
                    <span className="font-medium truncate">{tt?.name || '—'}</span>
                    <span className="text-muted-foreground text-xs shrink-0">
                      {entry.enrolledClientIds.length}/{entry.maxCapacity}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <button onClick={() => onNavigate('schedule')} className="text-xs text-muted-foreground hover:text-foreground mt-2 flex items-center gap-1">
            Расписание <Icon name="ArrowRight" size={12} />
          </button>
        </div>
      </div>

      {/* Recent sales */}
      <div className="bg-white border border-border rounded-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {period === 'month' ? `Продажи — ${monthLabel}` : 'Продажи за период'}
          </div>
          <button onClick={() => onNavigate('sales')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            Все <Icon name="ArrowRight" size={12} />
          </button>
        </div>
        <table className="w-full data-table">
          <thead>
            <tr><th>Клиент</th><th>Товар</th><th>Тип</th><th>Оплата</th><th>Сумма</th><th>Сотрудник</th><th>Дата</th></tr>
          </thead>
          <tbody>
            {recentSales.map(sale => {
              const client = state.clients.find(c => c.id === sale.clientId);
              const staff = sale.staffId ? state.staff.find(s => s.id === sale.staffId) : null;
              const staffShort = staff ? staff.name.split(' ').slice(0, 2).join(' ') : '—';
              return (
                <tr key={sale.id}>
                  <td className="font-medium">{client ? `${client.lastName} ${client.firstName}` : '—'}</td>
                  <td className="text-muted-foreground">{sale.itemName}</td>
                  <td>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${sale.type === 'subscription' ? 'badge-loyal' : 'badge-other'}`}>
                      {sale.type === 'subscription' ? 'Абонемент' : 'Разовое'}
                    </span>
                  </td>
                  <td className="text-muted-foreground">{sale.paymentMethod === 'cash' ? 'Нал' : 'Безнал'}</td>
                  <td className="font-medium">{sale.finalPrice.toLocaleString()} ₽</td>
                  <td className="text-muted-foreground text-sm">{staffShort}</td>
                  <td className="text-muted-foreground">{sale.date ? new Date(sale.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {recentSales.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground">Продаж пока нет</div>}
      </div>

      {/* Detail modal */}
      <Dialog open={!!activeDetailKey} onOpenChange={v => { if (!v) setActiveDetailKey(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{activeDetail?.title}</DialogTitle>
          </DialogHeader>
          {(() => {
            const hiddenCount = activeDetail?.rows.filter(r => isRowHidden(r)).length ?? 0;
            return hiddenCount > 0 ? (
              <p className="text-xs text-muted-foreground -mt-1">
                Скрытых: {hiddenCount} — не учитываются в счётчике карточки
              </p>
            ) : null;
          })()}
          <div className="overflow-y-auto flex-1 -mx-6 px-6">
            {activeDetail?.rows.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">Нет данных за выбранный период</div>
            )}
            <div className="divide-y divide-border">
              {activeDetail?.rows.map((row, i) => {
                const isHidden = isRowHidden(row);
                const isFirstTimeSubs = activeDetailKey === 'firstTimeSubs';
                return (
                  <div key={i} className={`py-2.5 flex items-center justify-between gap-2 ${isHidden ? 'opacity-40' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{row.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{row.sub}</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* "Перевести" dropdown for firstTimeSubs rows */}
                      {isFirstTimeSubs && row.saleId && !isHidden && (
                        <MoveOverrideButton
                          saleId={row.saleId}
                          currentOverride={(state.saleOverrides || {})[row.saleId] ?? null}
                          onSetOverride={(cat) => {
                            setSaleOverride(row.saleId!, cat);
                            if (cat !== null) {
                              // Hide from firstTimeSubs card when moved to another category
                              hideDashboardItem('firstTimeSubs', row.saleId!);
                            } else {
                              // Restore to firstTimeSubs when reset
                              restoreDashboardItem('firstTimeSubs', row.saleId!);
                            }
                          }}
                        />
                      )}
                      {(canDelete && row.deleteType || canDeleteInquiriesOnly && row.deleteType === 'inquiry') && (
                        isHidden ? (
                          <button
                            onClick={() => handleRestoreRow(row)}
                            className="text-amber-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors p-1.5 rounded-lg"
                            title="Включить в статистику"
                          >
                            <Icon name="Eye" size={14} />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleHideRow(row)}
                            className="text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors p-1.5 rounded-lg"
                            title={row.deleteType === 'inquiry' ? 'Удалить обращение' : 'Скрыть из статистики'}
                          >
                            <Icon name={row.deleteType === 'inquiry' ? 'Trash2' : 'EyeOff'} size={14} />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="pt-2 border-t border-border text-xs text-muted-foreground flex items-center justify-between gap-2">
            <span>
              {activeDetail?.rows.filter(r => !isRowHidden(r)).length ?? 0} активных
              {' · '}
              {activeDetail?.rows.filter(r => isRowHidden(r)).length ?? 0} скрыто
            </span>
            <span className="text-muted-foreground/60">Скрытые не учитываются в счётчике</span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Small inline component for the override move button in firstTimeSubs modal
function MoveOverrideButton({
  saleId,
  currentOverride,
  onSetOverride,
}: {
  saleId: string;
  currentOverride: 'renewal' | 'return' | null;
  onSetOverride: (cat: 'renewal' | 'return' | null) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors p-1.5 rounded-lg flex items-center gap-1"
        title="Перевести в другую категорию"
      >
        <Icon name="ArrowRightLeft" size={14} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-border rounded-xl shadow-lg py-1 min-w-36">
            {currentOverride !== null && (
              <button
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-secondary transition-colors text-muted-foreground"
                onClick={() => { onSetOverride(null); setOpen(false); }}
              >
                Сбросить (новичок)
              </button>
            )}
            <button
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-secondary transition-colors ${currentOverride === 'renewal' ? 'text-sky-600 font-medium' : ''}`}
              onClick={() => { onSetOverride('renewal'); setOpen(false); }}
            >
              → Продление
            </button>
            <button
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-secondary transition-colors ${currentOverride === 'return' ? 'text-teal-600 font-medium' : ''}`}
              onClick={() => { onSetOverride('return'); setOpen(false); }}
            >
              → Возвращение
            </button>
          </div>
        </>
      )}
    </div>
  );
}

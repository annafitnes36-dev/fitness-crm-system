import { useState } from 'react';
import { StoreType, Client, Inquiry } from '@/store';
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
  const { state, getClientCategory, deleteInquiry, hideDashboardItem, restoreDashboardItem } = store;
  const now = new Date();

  // Навигация по месяцам (только когда period === 'month')
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

  const hiddenIds = new Set(state.dashboardHiddenIds || []);

  const branchSales = state.sales.filter(s => s.branchId === state.currentBranchId);
  // Все продажи за период (включая скрытые) — для детального просмотра в модале
  const allMonthSubSales = branchSales.filter(s => s.type === 'subscription' && inPeriod(s.date));

  // Определяем ID продаж, по которым был сделан возврат:
  // Для каждого возврата (isRefund) находим последнюю оригинальную продажу клиента с тем же itemId
  const refundedSaleIds = new Set<string>();
  branchSales.filter(s => s.isRefund).forEach(refund => {
    // Ищем среди всех продаж (не только за период) оригинальную — это последняя не-возвратная продажа того же абонемента
    const original = branchSales
      .filter(s => !s.isRefund && s.clientId === refund.clientId && s.itemId === refund.itemId && s.date <= refund.date)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (original) refundedSaleIds.add(original.id);
  });

  // Видимые продажи (без скрытых и без возвратов денег) — для счётчиков в карточках
  // Также исключаем продажи, по которым был сделан возврат
  const monthSubSales = allMonthSubSales.filter(s => !hiddenIds.has(s.id) && !s.isRefund && !refundedSaleIds.has(s.id));
  const totalSubs = monthSubSales.length;
  // Исключаем продажи по которым был сделан возврат (refundedSaleIds) из всех счётчиков
  const firstTimeSubs = monthSubSales.filter(s => s.isFirstSubscription).length;
  const renewalSubs = monthSubSales.filter(s => s.isRenewal).length;
  const returnSubs = monthSubSales.filter(s => s.isReturn).length;

  const branchClients = state.clients.filter(c => c.branchId === state.currentBranchId && !c.dashboardExclude);
  const newClientsMonth = branchClients.filter(c => inPeriod(c.createdAt) && !hiddenIds.has(c.id)).length;
  const monthInquiries = state.inquiries.filter(i => i.branchId === state.currentBranchId && inPeriod(i.date) && !hiddenIds.has(i.id)).length;
  const totalInquiries = monthInquiries + newClientsMonth;

  const todayStr = now.toISOString().split('T')[0];
  const todaySchedule = state.schedule.filter(s => s.branchId === state.currentBranchId && s.date === todayStr);

  const branchScheduleIds = new Set(state.schedule.filter(e => e.branchId === state.currentBranchId).map(e => e.id));
  const monthVisits = state.visits.filter(v => branchScheduleIds.has(v.scheduleEntryId) && inPeriod(v.date));
  const attendedMonth = monthVisits.filter(v => v.status === 'attended').length;
  const missedMonth = monthVisits.filter(v => v.status === 'missed').length;
  const cancelledMonth = monthVisits.filter(v => v.status === 'cancelled').length;

  // Записи на первую тренировку — только по текущему филиалу
  const branchAttendedByClient: Record<string, string[]> = {};
  state.visits.filter(v => v.status === 'attended' && branchScheduleIds.has(v.scheduleEntryId)).forEach(v => {
    if (!branchAttendedByClient[v.clientId]) branchAttendedByClient[v.clientId] = [];
    branchAttendedByClient[v.clientId].push(v.date);
  });

  // Клиенты у которых есть абонемент — не считаем как новичков при первой записи
  // Проверяем: если у клиента на момент записи был куплен абонемент, то он не "новичок" в карточке
  const clientHasSubAtDate = (clientId: string, visitDate: string): boolean => {
    return branchSales.some(s =>
      s.clientId === clientId &&
      s.type === 'subscription' &&
      !s.isRefund &&
      s.date <= visitDate
    );
  };

  // Все записи новичков (включая скрытых) — для детального просмотра
  const allFirstEnrollments = new Set<string>();
  // Видимые (без скрытых) — для счётчика карточки
  const firstEnrollments = new Set<string>();
  state.visits.filter(v => {
    if (!['attended', 'enrolled', 'missed'].includes(v.status)) return false;
    if (!inPeriod(v.date)) return false;
    return branchScheduleIds.has(v.scheduleEntryId);
  }).forEach(v => {
    const prevVisits = (branchAttendedByClient[v.clientId] || []).filter(d => d < periodFrom);
    // Если у клиента нет предыдущих посещений И нет абонемента на момент записи — это новичок
    if (prevVisits.length === 0 && !clientHasSubAtDate(v.clientId, v.date)) {
      allFirstEnrollments.add(v.clientId);
      if (!hiddenIds.has(v.clientId)) firstEnrollments.add(v.clientId);
    }
  });
  const firstEnrollmentsCount = firstEnrollments.size;

  // Дошло новичков — только те, у кого первый attended-визит в этом филиале попадает в период
  // Все (включая скрытых) — для детального просмотра
  const allAttendedNewbies = new Set<string>();
  // Видимые (без скрытых) — для счётчика
  const attendedNewbies = new Set<string>();
  state.visits.filter(v => v.status === 'attended' && branchScheduleIds.has(v.scheduleEntryId)).forEach(v => {
    const clientAttended = branchAttendedByClient[v.clientId] || [];
    const firstDate = [...clientAttended].sort()[0];
    // Первый визит в периоде — только если у клиента нет абонемента
    if (firstDate && inPeriod(firstDate) && firstDate === v.date && !clientHasSubAtDate(v.clientId, v.date)) {
      allAttendedNewbies.add(v.clientId);
      if (!hiddenIds.has(v.clientId)) attendedNewbies.add(v.clientId);
    }
  });
  const attendedNewbiesCount = attendedNewbies.size;

  // Sales plan
  const currentPlan = state.salesPlans.find(p => p.branchId === state.currentBranchId && p.month === currentMonth);
  // Если есть план продаж — показываем абонементы из плана; иначе — абонементы филиала (или без привязки к филиалу)
  const branchPlans = (() => {
    if (currentPlan && currentPlan.items.length > 0) {
      // Берём абонементы, которые есть в плане продаж
      return currentPlan.items
        .map(item => state.subscriptionPlans.find(p => p.id === item.planId))
        .filter((p): p is NonNullable<typeof p> => p !== undefined);
    }
    // Fallback: абонементы привязанные к текущему филиалу или без привязки
    return state.subscriptionPlans.filter(p => !p.branchId || p.branchId === state.currentBranchId);
  })();

  const planRows = branchPlans.map(plan => {
    const target = currentPlan?.items.find(i => i.planId === plan.id)?.target ?? 0;
    const sold = monthSubSales.filter(s => s.itemId === plan.id).length;
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

  // Средний чек — только по абонементам (без скрытых и без возвратов, без продаж с возвратами)
  const periodSubSales = branchSales.filter(s => s.type === 'subscription' && inPeriod(s.date) && !hiddenIds.has(s.id) && !s.isRefund && !refundedSaleIds.has(s.id));
  const factAvgCheck = periodSubSales.length > 0 ? Math.round(periodSubSales.reduce((s, x) => s + x.finalPrice, 0) / periodSubSales.length) : 0;
  // Плановый средний чек считаем из плана продаж по абонементам: sum(target * price) / sum(target)
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

  // Конверсии
  const convInquiryToEnroll = totalInquiries > 0 ? Math.round((firstEnrollmentsCount / totalInquiries) * 100) : null;
  const convEnrollToAttend = firstEnrollmentsCount > 0 ? Math.round((attendedNewbiesCount / firstEnrollmentsCount) * 100) : null;
  const convAttendToBuy = attendedNewbiesCount > 0 ? Math.round((firstTimeSubs / attendedNewbiesCount) * 100) : null;

  // Данные для детализации карточек
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
  const clientName = (c: Client) => [c.lastName, c.firstName].filter(Boolean).join(' ') || c.phone || '—';

  const currentStaff = state.staff.find(s => s.id === state.currentStaffId);
  const canDelete = true;
  const canDeleteInquiriesOnly = currentStaff?.role === 'admin';

  type DetailRow = { name: string; sub: string; id: string; deleteType: 'inquiry' | 'sale' | 'client' | 'hide' | null };
  type DetailData = { title: string; rows: DetailRow[] };

  const detailInquiries: DetailData = {
    title: 'Обращения',
    rows: [
      ...state.inquiries.filter(i => i.branchId === state.currentBranchId && inPeriod(i.date)).map((i: Inquiry) => ({
        name: i.name || '—',
        sub: `${fmtDate(i.date)} · ${i.source || 'источник не указан'}${hiddenIds.has(i.id) ? ' · скрыто с дашборда' : ''}`,
        id: i.id,
        deleteType: 'inquiry' as const,
      })),
      ...branchClients.filter(c => inPeriod(c.createdAt)).map(c => ({
        name: clientName(c),
        sub: `${fmtDate(c.createdAt)} · регистрация клиента${hiddenIds.has(c.id) ? ' · скрыто с дашборда' : ''}`,
        id: c.id,
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
      const isHidden = hiddenIds.has(clientId);
      return {
        name: c ? clientName(c) : clientId,
        sub: `${visit ? fmtDate(visit.date) : '—'}${tt ? ' · ' + tt.name : ''}${isHidden ? ' · скрыто с дашборда' : ''}`,
        id: clientId,
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
      const isHidden = hiddenIds.has(clientId);
      return {
        name: c ? clientName(c) : clientId,
        sub: `${firstDate ? fmtDate(firstDate) : '—'}${isHidden ? ' · скрыто с дашборда' : ''}`,
        id: clientId,
        deleteType: 'hide' as const,
      };
    }),
  };

  // Исключаем возвраты (isRefund) и продажи по которым был сделан возврат (refundedSaleIds)
  const firstTimeSubSales = allMonthSubSales.filter(s => s.isFirstSubscription && !s.isRefund && !refundedSaleIds.has(s.id));
  const detailFirstTimeSubs: DetailData = {
    title: 'Купили абонемент (новички)',
    rows: firstTimeSubSales.map(s => {
      const c = state.clients.find(cl => cl.id === s.clientId);
      const isHidden = hiddenIds.has(s.id);
      return {
        name: c ? clientName(c) : '—',
        sub: `${fmtDate(s.date)} · ${s.itemName} · ${s.finalPrice.toLocaleString()} ₽${isHidden ? ' · скрыто с дашборда' : ''}`,
        id: s.id,
        deleteType: 'sale' as const,
      };
    }),
  };

  // В детале "Продаж всего" — только реальные продажи: без возвратов (isRefund) и без продаж по которым был сделан возврат
  const detailTotalSubsSales = allMonthSubSales.filter(s => !s.isRefund && !refundedSaleIds.has(s.id));
  const detailTotalSubs: DetailData = {
    title: 'Все продажи абонементов',
    rows: detailTotalSubsSales.map(s => {
      const c = state.clients.find(cl => cl.id === s.clientId);
      const tag = s.isFirstSubscription ? 'новый' : s.isRenewal ? 'продление' : s.isReturn ? 'возвращение' : '';
      const isHidden = hiddenIds.has(s.id);
      return {
        name: c ? clientName(c) : '—',
        sub: `${fmtDate(s.date)} · ${s.itemName} · ${s.finalPrice.toLocaleString()} ₽${tag ? ' · ' + tag : ''}${isHidden ? ' · скрыто с дашборда' : ''}`,
        id: s.id,
        deleteType: 'sale' as const,
      };
    }),
  };

  type DetailKey = 'inquiries' | 'firstEnrollments' | 'attendedNewbies' | 'firstTimeSubs' | 'totalSubs';
  const [activeDetailKey, setActiveDetailKey] = useState<DetailKey | null>(null);

  const detailMap: Record<DetailKey, DetailData> = {
    inquiries: detailInquiries,
    firstEnrollments: detailFirstEnrollments,
    attendedNewbies: detailAttendedNewbies,
    firstTimeSubs: detailFirstTimeSubs,
    totalSubs: detailTotalSubs,
  };
  const activeDetail = activeDetailKey ? detailMap[activeDetailKey] : null;

  const handleHideRow = (row: DetailRow) => {
    if (!row.deleteType) return;
    if (row.deleteType === 'inquiry') deleteInquiry(row.id);
    else hideDashboardItem(row.id);
    // 'sale', 'client', 'hide' — все через hideDashboardItem (скрывает без удаления)
  };

  const handleRestoreRow = (id: string) => {
    restoreDashboardItem(id);
  };

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

        {/* Навигация по месяцам */}
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

      {/* Key stats */}
      <div className="grid grid-cols-6 gap-4">
        {[
          { label: 'Обращений', value: totalInquiries, sub: `вх. ${monthInquiries} + рег. ${newClientsMonth}`, icon: 'PhoneIncoming', color: 'text-violet-600', conv: convInquiryToEnroll !== null ? `→ запись ${convInquiryToEnroll}%` : null, detailKey: 'inquiries' as DetailKey },
          { label: 'Записей на пробную', value: firstEnrollmentsCount, sub: 'первая тренировка в истории', icon: 'CalendarCheck', color: 'text-indigo-500', conv: convEnrollToAttend !== null ? `→ дошло ${convEnrollToAttend}%` : null, detailKey: 'firstEnrollments' as DetailKey },
          { label: 'Дошло новичков', value: attendedNewbiesCount, sub: 'первый визит отмечен "пришёл"', icon: 'UserRound', color: 'text-blue-500', conv: convAttendToBuy !== null ? `→ купило ${convAttendToBuy}%` : null, detailKey: 'attendedNewbies' as DetailKey },
          { label: 'Купили (новички)', value: firstTimeSubs, sub: 'первая покупка абонемента', icon: 'UserPlus', color: 'text-emerald-600', conv: null, detailKey: 'firstTimeSubs' as DetailKey },
          { label: 'Продаж всего', value: totalSubs, sub: `продл. ${renewalSubs} · возвр. ${returnSubs}`, icon: 'CreditCard', color: 'text-foreground', conv: null, detailKey: 'totalSubs' as DetailKey },
        ].map((s, i) => (
          <button key={i} className="stat-card text-left w-full hover:ring-2 hover:ring-border transition-all cursor-pointer" onClick={() => setActiveDetailKey(s.detailKey)}>
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide leading-tight">{s.label}</span>
              <Icon name={s.icon} size={16} className={s.color} />
            </div>
            <div className="text-2xl font-semibold">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.sub}</div>
            {s.conv && <div className="text-[10px] text-muted-foreground/70 mt-0.5 font-medium">{s.conv}</div>}
          </button>
        ))}
        {/* Средний чек */}
        <div className="stat-card">
          <div className="flex items-start justify-between mb-3">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide leading-tight">Средний чек</span>
            <Icon name="Banknote" size={16} className="text-amber-500" />
          </div>
          <div className="text-2xl font-semibold">{factAvgCheck > 0 ? factAvgCheck.toLocaleString('ru-RU') + ' ₽' : '—'}</div>
          {planAvgCheck > 0 ? (
            <div className="text-xs text-muted-foreground mt-1">
              план {planAvgCheck.toLocaleString('ru-RU')} ₽
              {avgCheckPct !== null && (
                <span className={`ml-1.5 font-medium ${avgCheckPct >= 100 ? 'text-green-600' : 'text-red-500'}`}>
                  {avgCheckPct}%
                </span>
              )}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground mt-1">план не задан</div>
          )}
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

      {/* Visit stats + sales breakdown + client base + schedule */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-border rounded-xl p-5">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">Посещаемость</div>
          <div className="space-y-3">
            {[
              { label: 'Пришли', value: attendedMonth, color: 'bg-emerald-500', textColor: 'text-emerald-600' },
              { label: 'Не пришли', value: missedMonth, color: 'bg-red-400', textColor: 'text-red-500' },
              { label: 'Отменили', value: cancelledMonth, color: 'bg-orange-400', textColor: 'text-orange-500' },
            ].map(item => {
              const total = attendedMonth + missedMonth + cancelledMonth;
              return (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className={`font-semibold ${item.textColor}`}>{item.value}</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full`} style={{ width: total ? `${(item.value / total) * 100}%` : '0%' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-border rounded-xl p-5">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">Структура продаж</div>
          <div className="space-y-3">
            {[
              { label: 'Первая покупка', value: firstTimeSubs, color: 'bg-blue-500' },
              { label: 'Продление', value: renewalSubs, color: 'bg-emerald-500' },
              { label: 'Возвращение', value: returnSubs, color: 'bg-amber-500' },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium">{item.value}</span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full`} style={{ width: totalSubs ? `${(item.value / totalSubs) * 100}%` : '0%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-border rounded-xl p-5">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">База клиентов</div>
          <div className="space-y-2">
            {[
              { label: 'Новички', count: branchClients.filter(c => getClientCategory(c) === 'new').length, badge: 'badge-new' },
              { label: 'Лояльные', count: branchClients.filter(c => getClientCategory(c) === 'loyal').length, badge: 'badge-loyal' },
              { label: 'Уснувшие', count: branchClients.filter(c => getClientCategory(c) === 'sleeping').length, badge: 'badge-sleeping' },
              { label: 'Потерянные', count: branchClients.filter(c => getClientCategory(c) === 'lost').length, badge: 'badge-lost' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-1">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.badge}`}>{item.count}</span>
              </div>
            ))}
            <button onClick={() => onNavigate('clients')} className="text-xs text-muted-foreground hover:text-foreground mt-2 flex items-center gap-1">
              Все клиенты <Icon name="ArrowRight" size={12} />
            </button>
          </div>
        </div>

        <div className="bg-white border border-border rounded-xl p-5">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">Сегодня</div>
          <div className="space-y-2">
            {todaySchedule.length === 0 && <p className="text-sm text-muted-foreground">Занятий нет</p>}
            {todaySchedule.map(entry => {
              const tt = state.trainingTypes.find(t => t.id === entry.trainingTypeId);
              const cat = tt?.categoryId ? state.trainingCategories.find(c => c.id === tt.categoryId) : null;
              const color = cat?.color || tt?.color || '#888';
              return (
                <div key={entry.id} className="flex items-center gap-3 py-1">
                  <div className="w-1 h-8 rounded-full shrink-0" style={{ background: color }} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{entry.time} — {tt?.name}</div>
                    <div className="text-xs text-muted-foreground">{entry.enrolledClientIds.length} / {entry.maxCapacity}</div>
                  </div>
                </div>
              );
            })}
            <button onClick={() => onNavigate('schedule')} className="text-xs text-muted-foreground hover:text-foreground mt-2 flex items-center gap-1">
              Расписание <Icon name="ArrowRight" size={12} />
            </button>
          </div>
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
          <div className="overflow-y-auto flex-1 -mx-6 px-6">
            {activeDetail?.rows.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">Нет данных за выбранный период</div>
            )}
            <div className="divide-y divide-border">
              {activeDetail?.rows.map((row, i) => {
                const isHidden = hiddenIds.has(row.id) && row.deleteType !== 'inquiry';
                return (
                <div key={i} className={`py-2.5 flex items-start justify-between gap-2 ${isHidden ? 'opacity-50' : ''}`}>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{row.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{row.sub}</div>
                  </div>
                  {(canDelete && row.deleteType || canDeleteInquiriesOnly && row.deleteType === 'inquiry') && (
                    hiddenIds.has(row.id) && row.deleteType !== 'inquiry' ? (
                      <button
                        onClick={() => handleRestoreRow(row.id)}
                        className="shrink-0 text-amber-500 hover:text-emerald-600 transition-colors p-1 rounded"
                        title="Вернуть в статистику дашборда"
                      >
                        <Icon name="Eye" size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleHideRow(row)}
                        className="shrink-0 text-muted-foreground hover:text-red-500 transition-colors p-1 rounded"
                        title={row.deleteType === 'inquiry' ? 'Удалить обращение' : 'Исключить из статистики дашборда'}
                      >
                        <Icon name={row.deleteType === 'inquiry' ? 'Trash2' : 'EyeOff'} size={14} />
                      </button>
                    )
                  )}
                </div>
                );
              })}
            </div>
          </div>
          <div className="pt-2 border-t border-border text-xs text-muted-foreground flex items-center justify-between gap-2">
            <span>Всего: {activeDetail?.rows.length ?? 0}</span>
            {canDelete && <span className="text-muted-foreground/60">Скрытые позиции исключаются из счётчика, но сохраняются в системе</span>}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
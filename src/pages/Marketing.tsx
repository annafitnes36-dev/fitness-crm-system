import { useMemo, useState } from 'react';
import type { StoreType as AppStore } from '@/store';
import Icon from '@/components/ui/icon';

interface MarketingProps {
  store: AppStore;
}

const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  phone: 'Телефон',
  instagram: 'Instagram',
  vk: 'VK',
};

export default function Marketing({ store }: MarketingProps) {
  const { state } = store;

  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');

  const hiddenIds = useMemo(() => new Set(state.dashboardHiddenIds || []), [state.dashboardHiddenIds]);

  const monthFrom = `${selectedMonth}-01`;
  const monthTo = (() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    return `${selectedMonth}-${String(last).padStart(2, '0')}`;
  })();

  const inMonth = (date: string) => date >= monthFrom && date <= monthTo;

  // Фильтрация по филиалу
  const targetBranches = selectedBranchId === 'all'
    ? state.branches.map(b => b.id)
    : [selectedBranchId];

  const branchClients = useMemo(() =>
    state.clients.filter(c => targetBranches.includes(c.branchId) && !c.dashboardExclude),
    [state.clients, selectedBranchId, state.branches]
  );

  // --- МЕТРИКА 1: Средняя стоимость тренировки ---
  // Считаем раздельно по лимитным и безлимитным абонементам
  const avgTrainingCost = useMemo(() => {
    // Берём все активные абонементы на текущий момент
    const activeSubs = state.subscriptions.filter(sub =>
      targetBranches.includes(sub.branchId) &&
      sub.status === 'active'
    );

    if (activeSubs.length === 0) return null;

    // Лимитные абонементы: sessionsLimit — число
    // Стоимость одной тренировки = цена абонемента / количество тренировок в абонементе
    const limitedSubs = activeSubs.filter(sub => {
      const plan = state.subscriptionPlans.find(p => p.id === sub.planId);
      return plan && typeof plan.sessionsLimit === 'number' && plan.sessionsLimit > 0;
    });

    let limitedCostPerTraining: number | null = null;
    if (limitedSubs.length > 0) {
      const costs: number[] = [];
      limitedSubs.forEach(sub => {
        const plan = state.subscriptionPlans.find(p => p.id === sub.planId);
        if (!plan || typeof plan.sessionsLimit !== 'number' || plan.sessionsLimit <= 0) return;
        const sale = state.sales.find(s => s.clientId === sub.clientId && s.type === 'subscription' && s.date === sub.purchaseDate);
        const price = sale ? sale.finalPrice : sub.price;
        costs.push(price / plan.sessionsLimit);
      });
      if (costs.length > 0) limitedCostPerTraining = Math.round(costs.reduce((a, b) => a + b, 0) / costs.length);
    }

    // Безлимитные абонементы: sessionsLimit === 'unlimited'
    // 1. Цена абонемента / количество месяцев = стоимость 1 месяца
    // 2. Стоимость месяца / фактические посещения (attended) = стоимость 1 тренировки
    const unlimitedSubs = activeSubs.filter(sub => {
      const plan = state.subscriptionPlans.find(p => p.id === sub.planId);
      return plan && plan.sessionsLimit === 'unlimited';
    });

    let unlimitedCostPerTraining: number | null = null;
    if (unlimitedSubs.length > 0) {
      const costs: number[] = [];
      unlimitedSubs.forEach(sub => {
        const plan = state.subscriptionPlans.find(p => p.id === sub.planId);
        if (!plan || plan.sessionsLimit !== 'unlimited') return;
        const sale = state.sales.find(s => s.clientId === sub.clientId && s.type === 'subscription' && s.date === sub.purchaseDate);
        const price = sale ? sale.finalPrice : sub.price;
        // Количество месяцев = durationDays / 30
        const months = Math.max(1, plan.durationDays / 30);
        const pricePerMonth = price / months;
        // Фактические посещения по этому абонементу
        const actualVisits = state.visits.filter(v =>
          v.subscriptionId === sub.id && v.status === 'attended'
        ).length;
        if (actualVisits > 0) {
          costs.push(pricePerMonth / actualVisits);
        }
      });
      if (costs.length > 0) unlimitedCostPerTraining = Math.round(costs.reduce((a, b) => a + b, 0) / costs.length);
    }

    // Общая средняя: по всем активным абонементам (лимитные через sessionsLimit, безлимитные через факт)
    const allCosts: number[] = [];
    activeSubs.forEach(sub => {
      const plan = state.subscriptionPlans.find(p => p.id === sub.planId);
      if (!plan) return;
      const sale = state.sales.find(s => s.clientId === sub.clientId && s.type === 'subscription' && s.date === sub.purchaseDate);
      const price = sale ? sale.finalPrice : sub.price;
      if (typeof plan.sessionsLimit === 'number' && plan.sessionsLimit > 0) {
        allCosts.push(price / plan.sessionsLimit);
      } else if (plan.sessionsLimit === 'unlimited') {
        const months = Math.max(1, plan.durationDays / 30);
        const pricePerMonth = price / months;
        const actualVisits = state.visits.filter(v => v.subscriptionId === sub.id && v.status === 'attended').length;
        if (actualVisits > 0) allCosts.push(pricePerMonth / actualVisits);
      }
    });
    const avgTotal = allCosts.length > 0 ? Math.round(allCosts.reduce((a, b) => a + b, 0) / allCosts.length) : null;

    return {
      limitedCount: limitedSubs.length,
      limitedCostPerTraining,
      unlimitedCount: unlimitedSubs.length,
      unlimitedCostPerTraining,
      avgTotal,
      totalCount: activeSubs.length,
    };
  }, [state, selectedMonth, selectedBranchId]);

  // --- МЕТРИКА 2: LTV ---
  const ltv = useMemo(() => {
    const clientTotals: Record<string, number> = {};
    state.sales
      .filter(s => targetBranches.includes(s.branchId) && !s.isRefund)
      .forEach(s => {
        clientTotals[s.clientId] = (clientTotals[s.clientId] || 0) + s.finalPrice;
      });

    const clientIds = Object.keys(clientTotals);
    if (clientIds.length === 0) return null;

    const total = Object.values(clientTotals).reduce((a, b) => a + b, 0);
    return Math.round(total / clientIds.length);
  }, [state.sales, selectedBranchId]);

  // --- МЕТРИКА 3: Срок жизни клиента (месяцев в статусе лояльный) ---
  const avgLoyalMonths = useMemo(() => {
    // Считаем по всем подпискам: сколько месяцев клиент имел активный абонемент
    const clientMonths: Record<string, Set<string>> = {};

    state.subscriptions
      .filter(sub => targetBranches.includes(sub.branchId) && sub.activatedAt && sub.status !== 'returned')
      .forEach(sub => {
        const start = new Date(sub.activatedAt || sub.purchaseDate);
        const end = new Date(sub.endDate);
        const current = new Date(start);

        while (current <= end) {
          const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
          if (!clientMonths[sub.clientId]) clientMonths[sub.clientId] = new Set();
          clientMonths[sub.clientId].add(key);
          current.setMonth(current.getMonth() + 1);
        }
      });

    const clientIds = Object.keys(clientMonths);
    if (clientIds.length === 0) return null;

    const totalMonths = clientIds.reduce((sum, id) => sum + clientMonths[id].size, 0);
    return Math.round((totalMonths / clientIds.length) * 10) / 10;
  }, [state.subscriptions, selectedBranchId]);

  // --- ТАБЛИЦА: Рекламные источники ---
  const adSourcesTable = useMemo(() => {
    const sources = state.adSources.filter(Boolean);

    // Общие структуры для всех источников
    const branchScheduleIds = new Set(
      state.schedule.filter(e => targetBranches.includes(e.branchId)).map(e => e.id)
    );

    // Все визиты (attended/enrolled/missed) по филиалу за всё время
    const clientAllVisits: Record<string, string[]> = {};
    state.visits.filter(v =>
      (v.status === 'attended' || v.status === 'enrolled' || v.status === 'missed') &&
      branchScheduleIds.has(v.scheduleEntryId)
    ).forEach(v => {
      if (!clientAllVisits[v.clientId]) clientAllVisits[v.clientId] = [];
      clientAllVisits[v.clientId].push(v.date);
    });

    // Только attended — для доходимости
    const branchAttendedByClient: Record<string, string[]> = {};
    state.visits.filter(v =>
      v.status === 'attended' && branchScheduleIds.has(v.scheduleEntryId)
    ).forEach(v => {
      if (!branchAttendedByClient[v.clientId]) branchAttendedByClient[v.clientId] = [];
      branchAttendedByClient[v.clientId].push(v.date);
    });

    const refundedSaleIds = new Set<string>();
    state.sales.filter(s => s.isRefund && targetBranches.includes(s.branchId)).forEach(refund => {
      const original = state.sales
        .filter(s => !s.isRefund && s.clientId === refund.clientId && s.itemId === refund.itemId && s.date <= refund.date && targetBranches.includes(s.branchId))
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      if (original) refundedSaleIds.add(original.id);
    });

    return sources.map(src => {
      // Обращения: inquiries + новые клиенты (не скрытые), за выбранный месяц
      const inquiriesCount = state.inquiries.filter(i =>
        targetBranches.includes(i.branchId) &&
        inMonth(i.date) &&
        !hiddenIds.has(i.id) &&
        i.adSource === src
      ).length;

      const newClientsCount = branchClients.filter(c =>
        inMonth(c.createdAt) &&
        !hiddenIds.has(c.id) &&
        c.adSource === src
      ).length;

      const totalInquiries = inquiriesCount + newClientsCount;

      const firstEnrollsCount = new Set(
        state.visits
          .filter(v =>
            (v.status === 'attended' || v.status === 'enrolled' || v.status === 'missed') &&
            inMonth(v.date) &&
            branchScheduleIds.has(v.scheduleEntryId) &&
            !hiddenIds.has(v.clientId)
          )
          .filter(v => {
            const client = state.clients.find(c => c.id === v.clientId);
            if (!client || client.adSource !== src) return false;
            const prevVisits = (clientAllVisits[v.clientId] || []).filter(d => d < monthFrom);
            const hasSub = state.sales.some(s =>
              s.clientId === v.clientId && s.type === 'subscription' && !s.isRefund && s.date <= v.date
            );
            return prevVisits.length === 0 && !hasSub;
          })
          .map(v => v.clientId)
      ).size;

      // Продажи (купили новички) — isFirstSubscription, не скрытые, этот месяц, этот источник
      const salesCount = state.sales.filter(s =>
        targetBranches.includes(s.branchId) &&
        s.type === 'subscription' &&
        s.isFirstSubscription &&
        !s.isRefund &&
        !refundedSaleIds.has(s.id) &&
        inMonth(s.date) &&
        !hiddenIds.has(s.id) &&
        (() => {
          const c = state.clients.find(cl => cl.id === s.clientId);
          return c?.adSource === src;
        })()
      ).length;

      // Доходимость: дошло новичков — первый attended-визит в периоде, без абонемента, не скрытые, этот источник
      const attendedNewbies = new Set(
        state.visits
          .filter(v => v.status === 'attended' && branchScheduleIds.has(v.scheduleEntryId))
          .filter(v => {
            const client = state.clients.find(c => c.id === v.clientId);
            if (!client || client.adSource !== src) return false;
            if (hiddenIds.has(v.clientId)) return false;
            const allAttended = (branchAttendedByClient[v.clientId] || []).sort();
            const firstDate = allAttended[0];
            if (!firstDate || !inMonth(firstDate) || firstDate !== v.date) return false;
            return !state.sales.some(s =>
              s.clientId === v.clientId && s.type === 'subscription' && !s.isRefund && s.date <= v.date
            );
          })
          .map(v => v.clientId)
      ).size;

      return { src, totalInquiries, firstEnrollsCount, attendedNewbies, salesCount };
    }).filter(row => row.totalInquiries > 0 || row.firstEnrollsCount > 0 || row.attendedNewbies > 0 || row.salesCount > 0);
  }, [state, selectedMonth, selectedBranchId, hiddenIds]);

  // --- АНАЛИЗ ПО КАНАЛАМ СВЯЗИ ---
  const channelsTable = useMemo(() => {
    // Уникальные каналы из клиентов + inquiries
    const allChannels = new Set<string>();
    branchClients.forEach(c => { if (c.contactChannel) allChannels.add(c.contactChannel); });
    state.inquiries.filter(i => targetBranches.includes(i.branchId)).forEach(i => { if (i.channel) allChannels.add(i.channel); });

    return [...allChannels].map(ch => {
      const inquiriesCount = state.inquiries.filter(i =>
        targetBranches.includes(i.branchId) &&
        inMonth(i.date) &&
        !hiddenIds.has(i.id) &&
        i.channel === ch
      ).length;

      const newClientsCount = branchClients.filter(c =>
        inMonth(c.createdAt) &&
        !hiddenIds.has(c.id) &&
        c.contactChannel === ch
      ).length;

      const total = inquiriesCount + newClientsCount;
      return { ch, total, inquiriesCount, newClientsCount };
    }).filter(r => r.total > 0).sort((a, b) => b.total - a.total);
  }, [state, selectedMonth, selectedBranchId, hiddenIds]);

  // Список месяцев для фильтра (последние 12 + будущие 2)
  const monthOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    for (let i = -11; i <= 2; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      opts.push({ value: val, label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` });
    }
    return opts.reverse();
  }, []);

  const convRate = (a: number, b: number) => b > 0 ? Math.round((a / b) * 100) : 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Фильтры */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="border border-border rounded-lg px-3 py-1.5 text-sm bg-white"
        >
          {monthOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={selectedBranchId}
          onChange={e => setSelectedBranchId(e.target.value)}
          className="border border-border rounded-lg px-3 py-1.5 text-sm bg-white"
        >
          <option value="all">Все филиалы</option>
          {state.branches.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {/* Карточки метрик */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Средняя стоимость тренировки */}
        <div className="bg-white border border-border rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Icon name="Dumbbell" size={15} />
            Средняя стоимость тренировки
          </div>
          {avgTrainingCost ? (
            <div className="space-y-3">
              <div>
                <div className="text-2xl font-bold">
                  {avgTrainingCost.avgTotal !== null ? `${avgTrainingCost.avgTotal.toLocaleString()} ₽` : '—'}
                </div>
                <div className="text-xs text-muted-foreground">Общая средняя · {avgTrainingCost.totalCount} активных абонементов</div>
              </div>
              <div className="border-t border-border pt-2 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Лимитные ({avgTrainingCost.limitedCount} абон.)</span>
                  <span className="text-sm font-semibold">
                    {avgTrainingCost.limitedCostPerTraining !== null ? `${avgTrainingCost.limitedCostPerTraining.toLocaleString()} ₽` : '—'}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground -mt-1">цена ÷ кол-во тренировок в абонементе</div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Безлимитные ({avgTrainingCost.unlimitedCount} абон.)</span>
                  <span className="text-sm font-semibold">
                    {avgTrainingCost.unlimitedCostPerTraining !== null ? `${avgTrainingCost.unlimitedCostPerTraining.toLocaleString()} ₽` : '—'}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground -mt-1">цена за месяц ÷ факт. посещений</div>
              </div>
            </div>
          ) : (
            <div className="text-2xl font-bold text-muted-foreground">—</div>
          )}
        </div>

        {/* LTV */}
        <div className="bg-white border border-border rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Icon name="TrendingUp" size={15} />
            LTV клиента
          </div>
          <div className="text-2xl font-bold">
            {ltv !== null ? `${ltv.toLocaleString()} ₽` : '—'}
          </div>
          <div className="text-xs text-muted-foreground">Средние расходы одного клиента за всё время</div>
        </div>

        {/* Срок жизни */}
        <div className="bg-white border border-border rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Icon name="Clock" size={15} />
            Срок жизни клиента
          </div>
          <div className="text-2xl font-bold">
            {avgLoyalMonths !== null ? `${avgLoyalMonths} мес.` : '—'}
          </div>
          <div className="text-xs text-muted-foreground">Среднее время активного абонемента на клиента</div>
        </div>
      </div>

      {/* Таблица рекламных источников */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <div className="font-semibold text-sm">Эффективность рекламных источников</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {MONTH_NAMES[parseInt(selectedMonth.split('-')[1]) - 1]} {selectedMonth.split('-')[0]}
          </div>
        </div>
        {adSourcesTable.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            Нет данных за выбранный период
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Источник</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Обращения</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Записи</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Доходимость</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Продажи</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Конверсия<br/><span className="text-[10px] font-normal">обр → продажа</span></th>
                </tr>
              </thead>
              <tbody>
                {adSourcesTable.map((row, i) => (
                  <tr key={row.src} className={`border-b border-border/50 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                    <td className="px-5 py-3 font-medium">{row.src || '—'}</td>
                    <td className="px-4 py-3 text-center">{row.totalInquiries}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={row.firstEnrollsCount > 0 ? 'text-blue-600 font-medium' : ''}>
                        {row.firstEnrollsCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={row.attendedNewbies > 0 ? 'text-violet-600 font-medium' : ''}>
                        {row.attendedNewbies}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={row.salesCount > 0 ? 'text-emerald-600 font-medium' : ''}>
                        {row.salesCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.totalInquiries > 0 ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          convRate(row.salesCount, row.totalInquiries) >= 20
                            ? 'bg-emerald-50 text-emerald-700'
                            : convRate(row.salesCount, row.totalInquiries) >= 10
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-red-50 text-red-700'
                        }`}>
                          {convRate(row.salesCount, row.totalInquiries)}%
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border bg-secondary/20 font-semibold">
                  <td className="px-5 py-3">Итого</td>
                  <td className="px-4 py-3 text-center">{adSourcesTable.reduce((s, r) => s + r.totalInquiries, 0)}</td>
                  <td className="px-4 py-3 text-center">{adSourcesTable.reduce((s, r) => s + r.firstEnrollsCount, 0)}</td>
                  <td className="px-4 py-3 text-center">{adSourcesTable.reduce((s, r) => s + r.attendedNewbies, 0)}</td>
                  <td className="px-4 py-3 text-center">{adSourcesTable.reduce((s, r) => s + r.salesCount, 0)}</td>
                  <td className="px-4 py-3 text-center">
                    {adSourcesTable.reduce((s, r) => s + r.totalInquiries, 0) > 0 ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        convRate(adSourcesTable.reduce((s, r) => s + r.salesCount, 0), adSourcesTable.reduce((s, r) => s + r.totalInquiries, 0)) >= 20
                          ? 'bg-emerald-50 text-emerald-700'
                          : convRate(adSourcesTable.reduce((s, r) => s + r.salesCount, 0), adSourcesTable.reduce((s, r) => s + r.totalInquiries, 0)) >= 10
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-red-50 text-red-700'
                      }`}>
                        {convRate(adSourcesTable.reduce((s, r) => s + r.salesCount, 0), adSourcesTable.reduce((s, r) => s + r.totalInquiries, 0))}%
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Анализ по каналам связи */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <div className="font-semibold text-sm">Обращения по каналам связи</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {MONTH_NAMES[parseInt(selectedMonth.split('-')[1]) - 1]} {selectedMonth.split('-')[0]}
          </div>
        </div>
        {channelsTable.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            Нет данных за выбранный период
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Канал</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Всего обращений</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Из карточек клиентов</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Из кнопки «Обращение»</th>
                </tr>
              </thead>
              <tbody>
                {channelsTable.map((row, i) => (
                  <tr key={row.ch} className={`border-b border-border/50 last:border-0 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                    <td className="px-5 py-3 font-medium">
                      {CHANNEL_LABELS[row.ch] || row.ch}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold">{row.total}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{row.newClientsCount}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{row.inquiriesCount}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border bg-secondary/20">
                  <td className="px-5 py-3 font-semibold">Итого</td>
                  <td className="px-4 py-3 text-center font-semibold">
                    {channelsTable.reduce((s, r) => s + r.total, 0)}
                  </td>
                  <td className="px-4 py-3 text-center font-medium">
                    {channelsTable.reduce((s, r) => s + r.newClientsCount, 0)}
                  </td>
                  <td className="px-4 py-3 text-center font-medium">
                    {channelsTable.reduce((s, r) => s + r.inquiriesCount, 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
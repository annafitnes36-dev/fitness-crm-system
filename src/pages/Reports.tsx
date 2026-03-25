import { useState, useMemo } from 'react';
import { StoreType, MonthlyPlanRow } from '@/store';
import Icon from '@/components/ui/icon';

interface ReportsProps {
  store: StoreType;
}

const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

const COLUMNS: { key: keyof MonthlyPlanRow; label: string; format: 'money' | 'count' | 'pct' }[] = [
  { key: 'revenue', label: 'Выручка', format: 'money' },
  { key: 'expenses', label: 'Расход', format: 'money' },
  { key: 'profit', label: 'Прибыль', format: 'money' },
  { key: 'additionalSales', label: 'Доп. продажи', format: 'money' },
  { key: 'subscriptionSales', label: 'Абонементы (сумма)', format: 'money' },
  { key: 'avgCheck', label: 'Средний чек', format: 'money' },
  { key: 'inquiries', label: 'Обращений', format: 'count' },
  { key: 'newbieEnrollments', label: 'Записей новичков', format: 'count' },
  { key: 'newbieAttended', label: 'Дошло новичков', format: 'count' },
  { key: 'newbieSales', label: 'Продаж новичкам', format: 'count' },
  { key: 'convInquiryToEnroll', label: 'Конв. обращение→запись', format: 'pct' },
  { key: 'convEnrollToAttend', label: 'Конв. запись→приход', format: 'pct' },
  { key: 'convAttendToSale', label: 'Конв. приход→продажа', format: 'pct' },
  { key: 'totalSubscriptionSales', label: 'Всего продаж абон.', format: 'count' },
  { key: 'renewalPotential', label: 'Потенциал продлений', format: 'count' },
  { key: 'renewals', label: 'Продлений', format: 'count' },
  { key: 'convRenewal', label: 'Конв. продления', format: 'pct' },
  { key: 'returns', label: 'Возвращений', format: 'count' },
  { key: 'profitability', label: 'Рентабельность', format: 'pct' },
];

function fmt(val: number | undefined, format: 'money' | 'count' | 'pct'): string {
  if (val === undefined || val === null || isNaN(val)) return '—';
  if (format === 'money') return val.toLocaleString('ru-RU') + ' ₽';
  if (format === 'pct') return val.toFixed(1) + '%';
  return String(Math.round(val));
}

function diff(fact: number | undefined, plan: number | undefined): { val: number; pct: number } | null {
  if (fact === undefined || plan === undefined || plan === 0) return null;
  const val = fact - plan;
  const pct = (val / plan) * 100;
  return { val, pct };
}

function computeFact(
  branchIds: string[],
  month: string, // YYYY-MM
  state: StoreType['state']
): MonthlyPlanRow {
  const [year, mon] = month.split('-').map(Number);
  const inMonth = (date: string) => {
    const d = new Date(date);
    return d.getFullYear() === year && d.getMonth() + 1 === mon;
  };

  const branchFilter = (bId: string) => branchIds.length === 0 || branchIds.includes(bId);

  // Продажи за месяц
  const monthSales = state.sales.filter(s => inMonth(s.date) && branchFilter(s.branchId));
  const subSales = monthSales.filter(s => s.type === 'subscription');
  const singleSales = monthSales.filter(s => s.type === 'single');

  const revenue = monthSales.reduce((sum, s) => sum + s.finalPrice, 0);
  const subscriptionSales = subSales.reduce((sum, s) => sum + s.finalPrice, 0);
  const additionalSales = singleSales.reduce((sum, s) => sum + s.finalPrice, 0);
  const avgCheck = monthSales.length > 0 ? revenue / monthSales.length : 0;

  // Расходы
  const expenses = state.expenses
    .filter(e => inMonth(e.date) && branchFilter(e.branchId))
    .reduce((sum, e) => sum + e.amount, 0);

  const profit = revenue - expenses;
  const profitability = revenue > 0 ? (profit / revenue) * 100 : 0;

  // Обращения
  const inquiries = state.inquiries.filter(i => inMonth(i.date) && branchFilter(i.branchId)).length;

  // Новички: клиенты, у которых первое посещение (тренировка) было в этом месяце
  // Посещения за месяц со статусом attended
  const monthVisits = state.visits.filter(v => {
    if (v.status !== 'attended') return false;
    if (!inMonth(v.date)) return false;
    const entry = state.schedule.find(e => e.id === v.scheduleEntryId);
    return entry ? branchFilter(entry.branchId) : true;
  });

  // Все посещения клиентов (исторически), сортированные
  const allAttendedByClient: Record<string, string[]> = {};
  state.visits.filter(v => v.status === 'attended').forEach(v => {
    if (!allAttendedByClient[v.clientId]) allAttendedByClient[v.clientId] = [];
    allAttendedByClient[v.clientId].push(v.date);
  });

  // Записи новичков: клиент записан (enrolled/attended) на пробную в этом месяце И это первая запись
  const monthEnrolledVisits = state.visits.filter(v => {
    if (!inMonth(v.date)) return false;
    if (!['attended', 'enrolled', 'missed'].includes(v.status)) return false;
    const entry = state.schedule.find(e => e.id === v.scheduleEntryId);
    return entry ? branchFilter(entry.branchId) : false;
  });

  // Уникальные клиенты среди записей этого месяца, у которых до этого месяца не было посещений
  const monthStart = new Date(year, mon - 1, 1).toISOString().split('T')[0];
  const newbieEnrollmentClients = new Set<string>();
  monthEnrolledVisits.forEach(v => {
    const prevVisits = (allAttendedByClient[v.clientId] || []).filter(d => d < monthStart);
    if (prevVisits.length === 0) newbieEnrollmentClients.add(v.clientId);
  });
  const newbieEnrollments = newbieEnrollmentClients.size;

  // Дошедших новичков: attended в этом месяце И первое посещение вообще в этом месяце
  const newbieAttendedClients = new Set<string>();
  monthVisits.forEach(v => {
    const allDates = (allAttendedByClient[v.clientId] || []).sort();
    if (allDates.length > 0 && inMonth(allDates[0])) {
      newbieAttendedClients.add(v.clientId);
    }
  });
  const newbieAttended = newbieAttendedClients.size;

  // Продажи новичкам: первая покупка абонемента в этом месяце
  const newbieSales = subSales.filter(s => s.isFirstSubscription).length;

  // Конверсии
  const convInquiryToEnroll = inquiries > 0 ? (newbieEnrollments / inquiries) * 100 : 0;
  const convEnrollToAttend = newbieEnrollments > 0 ? (newbieAttended / newbieEnrollments) * 100 : 0;
  const convAttendToSale = newbieAttended > 0 ? (newbieSales / newbieAttended) * 100 : 0;

  // Всего продаж абонементов
  const totalSubscriptionSales = subSales.length;

  // Потенциал продлений: клиенты, у которых абонемент заканчивается в этом месяце
  const monthEnd = new Date(year, mon, 0).toISOString().split('T')[0];
  const renewalPotential = state.subscriptions.filter(s => {
    if (!branchFilter(s.branchId)) return false;
    return s.endDate >= monthStart && s.endDate <= monthEnd;
  }).length;

  // Продления: покупка абонемента повторно менее чем через 30 дней после предыдущего
  const renewals = subSales.filter(s => s.isRenewal).length;
  const convRenewal = renewalPotential > 0 ? (renewals / renewalPotential) * 100 : 0;

  // Возвращения: покупка более чем через 30 дней после предыдущего абонемента
  const returns = subSales.filter(s => s.isReturn).length;

  return {
    revenue, expenses, profit, additionalSales, subscriptionSales, avgCheck,
    inquiries, newbieEnrollments, newbieAttended, newbieSales,
    convInquiryToEnroll, convEnrollToAttend, convAttendToSale,
    totalSubscriptionSales, renewalPotential, renewals, convRenewal, returns, profitability,
  };
}

function generateMonths(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return `${year}-${String(m).padStart(2, '0')}`;
  });
}

export default function Reports({ store }: ReportsProps) {
  const { state } = store;
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [filterBranchIds, setFilterBranchIds] = useState<string[]>([state.currentBranchId]);

  const months = generateMonths(selectedYear);

  const toggleBranch = (id: string) => {
    setFilterBranchIds(prev =>
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    );
  };

  const factsMap = useMemo(() => {
    const map: Record<string, MonthlyPlanRow> = {};
    months.forEach(month => {
      map[month] = computeFact(filterBranchIds, month, state);
    });
    return map;
  }, [months, filterBranchIds, state]);

  const plansMap = useMemo(() => {
    const map: Record<string, Partial<MonthlyPlanRow>> = {};
    months.forEach(month => {
      const found = state.monthlyPlans.find(
        p => p.month === month && filterBranchIds.some(bid => p.branchId === bid)
      ) || state.monthlyPlans.find(p => p.month === month && filterBranchIds.includes(p.branchId));
      // Если несколько филиалов — берём первый найденный план для первого выбранного филиала
      const planForBranch = filterBranchIds.length === 1
        ? state.monthlyPlans.find(p => p.month === month && p.branchId === filterBranchIds[0])
        : found;
      map[month] = planForBranch?.plan || {};
    });
    return map;
  }, [months, filterBranchIds, state.monthlyPlans]);

  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="space-y-6">
      {/* Заголовок и фильтры */}
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Год</label>
          <select
            className="border border-input rounded-lg px-3 py-2 text-sm"
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Филиалы</label>
          <div className="flex flex-wrap gap-2">
            {state.branches.map(b => (
              <button
                key={b.id}
                onClick={() => toggleBranch(b.id)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  filterBranchIds.includes(b.id)
                    ? 'bg-foreground text-primary-foreground border-foreground'
                    : 'bg-white text-foreground border-border hover:bg-secondary'
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Легенда */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-50 border border-blue-200 inline-block" />План</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-white border border-border inline-block" />Факт</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-50 border border-green-200 inline-block" />Отклонение</span>
      </div>

      {/* Таблица */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground sticky left-0 bg-secondary/50 min-w-[180px] z-10">
                  Показатель
                </th>
                {months.map((month, i) => (
                  <th key={month} className="px-3 py-3 font-medium text-center min-w-[140px]">
                    {MONTH_NAMES[i]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COLUMNS.map((col, ci) => (
                <tr key={col.key} className={`border-b border-border/50 ${ci % 2 === 0 ? 'bg-white' : 'bg-secondary/20'}`}>
                  <td className="px-4 py-1.5 font-medium sticky left-0 z-10 text-muted-foreground"
                    style={{ background: ci % 2 === 0 ? 'white' : 'rgb(248 248 248)' }}>
                    {col.label}
                  </td>
                  {months.map(month => {
                    const factVal = factsMap[month]?.[col.key] as number | undefined;
                    const planVal = plansMap[month]?.[col.key] as number | undefined;
                    const d = diff(factVal, planVal);
                    return (
                      <td key={month} className="px-3 py-1.5">
                        <div className="space-y-0.5">
                          {/* План */}
                          <div className="bg-blue-50 border border-blue-100 rounded px-2 py-0.5 text-center text-blue-700">
                            {planVal !== undefined ? fmt(planVal, col.format) : '—'}
                          </div>
                          {/* Факт */}
                          <div className="bg-white border border-border rounded px-2 py-0.5 text-center font-medium">
                            {fmt(factVal, col.format)}
                          </div>
                          {/* Отклонение */}
                          {d !== null && (
                            <div className={`rounded px-2 py-0.5 text-center text-xs ${
                              d.val >= 0
                                ? 'bg-green-50 border border-green-100 text-green-700'
                                : 'bg-red-50 border border-red-100 text-red-700'
                            }`}>
                              {d.val >= 0 ? '+' : ''}{fmt(d.val, col.format)}
                              {' '}({d.pct >= 0 ? '+' : ''}{d.pct.toFixed(0)}%)
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Зелёное отклонение = факт превышает план. Красное = не выполнено.
        Для заполнения плановых значений — раздел «Настройки» → «Планирование».
      </p>
    </div>
  );
}

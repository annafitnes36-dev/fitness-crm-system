import { useState, useMemo } from 'react';
import { StoreType, MonthlyPlanRow } from '@/store';
import Icon from '@/components/ui/icon';

function fmtMoney(val: number | undefined): string {
  if (val === undefined || val === null || isNaN(val)) return '—';
  return val.toLocaleString('ru-RU') + ' ₽';
}

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

      {/* Таблица ПЛАН */}
      <div>
        <h2 className="text-base font-semibold mb-3">План</h2>
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-blue-50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground sticky left-0 bg-blue-50 min-w-[110px] z-10">
                    Месяц
                  </th>
                  {COLUMNS.map(col => (
                    <th key={col.key} className="px-3 py-3 font-medium text-center min-w-[110px] whitespace-nowrap">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {months.map((month, i) => (
                  <tr key={month} className={`border-b border-border/50 ${i % 2 === 0 ? 'bg-white' : 'bg-secondary/20'}`}>
                    <td className="px-4 py-2 font-medium sticky left-0 z-10 text-muted-foreground"
                      style={{ background: i % 2 === 0 ? 'white' : 'rgb(248 248 248)' }}>
                      {MONTH_NAMES[i]}
                    </td>
                    {COLUMNS.map(col => {
                      const planVal = plansMap[month]?.[col.key] as number | undefined;
                      return (
                        <td key={col.key} className="px-3 py-2 text-center text-blue-700">
                          {planVal !== undefined ? fmt(planVal, col.format) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {/* Итого за год */}
                <tr className="border-t-2 border-border bg-blue-50 font-semibold">
                  <td className="px-4 py-2 sticky left-0 z-10 bg-blue-50 text-blue-900 whitespace-nowrap">Итого год</td>
                  {COLUMNS.map(col => {
                    const vals = months.map(m => plansMap[m]?.[col.key] as number | undefined).filter(v => v !== undefined) as number[];
                    const total = col.format === 'pct' || col.key === 'avgCheck'
                      ? (vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : undefined)
                      : vals.reduce((a, b) => a + b, 0);
                    return (
                      <td key={col.key} className="px-3 py-2 text-center text-blue-900">
                        {total !== undefined && !isNaN(total) && total !== 0 ? fmt(total, col.format) : '—'}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Таблица ФАКТ */}
      <div>
        <h2 className="text-base font-semibold mb-3">Факт</h2>
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground sticky left-0 bg-secondary/50 min-w-[110px] z-10">
                    Месяц
                  </th>
                  {COLUMNS.map(col => (
                    <th key={col.key} className="px-3 py-3 font-medium text-center min-w-[110px] whitespace-nowrap">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {months.map((month, i) => (
                  <tr key={month} className={`border-b border-border/50 ${i % 2 === 0 ? 'bg-white' : 'bg-secondary/20'}`}>
                    <td className="px-4 py-2 font-medium sticky left-0 z-10 text-muted-foreground"
                      style={{ background: i % 2 === 0 ? 'white' : 'rgb(248 248 248)' }}>
                      {MONTH_NAMES[i]}
                    </td>
                    {COLUMNS.map(col => {
                      const factVal = factsMap[month]?.[col.key] as number | undefined;
                      const planVal = plansMap[month]?.[col.key] as number | undefined;
                      const d = diff(factVal, planVal);
                      return (
                        <td key={col.key} className="px-3 py-2 text-center">
                          <div className="font-medium">{fmt(factVal, col.format)}</div>
                          {d !== null && (
                            <div className={`text-[10px] mt-0.5 ${d.val >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {d.val >= 0 ? '+' : ''}{d.pct.toFixed(0)}%
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {/* Итого за год */}
                <tr className="border-t-2 border-border bg-secondary/50 font-semibold">
                  <td className="px-4 py-2 sticky left-0 z-10 bg-secondary/50 whitespace-nowrap" style={{ background: 'rgb(243 244 246)' }}>Итого год</td>
                  {COLUMNS.map(col => {
                    const factVals = months.map(m => factsMap[m]?.[col.key] as number).filter(v => !isNaN(v));
                    const planVals = months.map(m => plansMap[m]?.[col.key] as number | undefined).filter(v => v !== undefined) as number[];
                    const factTotal = col.format === 'pct' || col.key === 'avgCheck'
                      ? (factVals.length > 0 ? factVals.reduce((a, b) => a + b, 0) / factVals.length : 0)
                      : factVals.reduce((a, b) => a + b, 0);
                    const planTotal = col.format === 'pct' || col.key === 'avgCheck'
                      ? (planVals.length > 0 ? planVals.reduce((a, b) => a + b, 0) / planVals.length : undefined)
                      : planVals.reduce((a, b) => a + b, 0);
                    const d = diff(factTotal, planTotal);
                    return (
                      <td key={col.key} className="px-3 py-2 text-center">
                        <div>{fmt(factTotal, col.format)}</div>
                        {d !== null && (
                          <div className={`text-[10px] mt-0.5 ${d.val >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {d.val >= 0 ? '+' : ''}{d.pct.toFixed(0)}%
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        В таблице «Факт» под значением — % отклонения от плана. Зелёный = план выполнен, красный = не выполнен.
        Плановые значения задаются в «Настройки» → «Планирование».
      </p>

      {/* РАЗДЕЛ: РАСХОДЫ */}
      <ExpensesReport state={state} months={months} filterBranchIds={filterBranchIds} />

      {/* РАЗДЕЛ: ПРОДАЖИ */}
      <SalesReport state={state} months={months} filterBranchIds={filterBranchIds} />
    </div>
  );
}

type SalesMetric = 'count' | 'avgCheck' | 'sum';

function SalesReport({ state, months, filterBranchIds }: {
  state: StoreType['state'];
  months: string[];
  filterBranchIds: string[];
}) {
  const [metric, setMetric] = useState<SalesMetric>('sum');

  const salesData = useMemo(() => {
    const result: Record<string, { subCount: number; subSum: number; addCount: number; addSum: number }> = {};
    months.forEach(month => {
      const [year, mon] = month.split('-').map(Number);
      const inMonth = (date: string) => {
        const d = new Date(date);
        return d.getFullYear() === year && d.getMonth() + 1 === mon;
      };
      const branchFilter = (bId: string) => filterBranchIds.length === 0 || filterBranchIds.includes(bId);
      const monthSales = state.sales.filter(s => inMonth(s.date) && branchFilter(s.branchId));
      const subSales = monthSales.filter(s => s.type === 'subscription');
      const addSales = monthSales.filter(s => s.type === 'single');
      result[month] = {
        subCount: subSales.length,
        subSum: subSales.reduce((s, x) => s + x.finalPrice, 0),
        addCount: addSales.length,
        addSum: addSales.reduce((s, x) => s + x.finalPrice, 0),
      };
    });
    return result;
  }, [months, filterBranchIds, state.sales]);

  const getValue = (month: string, type: 'sub' | 'add'): number => {
    const d = salesData[month];
    if (!d) return 0;
    if (type === 'sub') {
      if (metric === 'count') return d.subCount;
      if (metric === 'avgCheck') return d.subCount > 0 ? d.subSum / d.subCount : 0;
      return d.subSum;
    } else {
      if (metric === 'count') return d.addCount;
      if (metric === 'avgCheck') return d.addCount > 0 ? d.addSum / d.addCount : 0;
      return d.addSum;
    }
  };

  const fmtVal = (val: number): string => {
    if (val === 0) return '—';
    if (metric === 'count') return String(Math.round(val));
    return val.toLocaleString('ru-RU') + ' ₽';
  };

  const yearSub = {
    count: months.reduce((s, m) => s + salesData[m].subCount, 0),
    sum: months.reduce((s, m) => s + salesData[m].subSum, 0),
  };
  const yearAdd = {
    count: months.reduce((s, m) => s + salesData[m].addCount, 0),
    sum: months.reduce((s, m) => s + salesData[m].addSum, 0),
  };
  const yearSubVal = metric === 'count' ? yearSub.count : metric === 'avgCheck' ? (yearSub.count > 0 ? yearSub.sum / yearSub.count : 0) : yearSub.sum;
  const yearAddVal = metric === 'count' ? yearAdd.count : metric === 'avgCheck' ? (yearAdd.count > 0 ? yearAdd.sum / yearAdd.count : 0) : yearAdd.sum;

  return (
    <div className="pt-4 border-t border-border space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="text-lg font-semibold">Продажи</h2>
        <div className="flex gap-1 bg-secondary rounded-lg p-1">
          {([['sum', 'Сумма'], ['count', 'Количество'], ['avgCheck', 'Средний чек']] as [SalesMetric, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setMetric(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${metric === key ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground sticky left-0 bg-secondary/50 min-w-[100px] z-10">Месяц</th>
                <th className="px-3 py-3 font-medium text-center whitespace-nowrap min-w-[130px]">Абонементы</th>
                <th className="px-3 py-3 font-medium text-center whitespace-nowrap min-w-[130px]">Доп. продажи</th>
                <th className="px-3 py-3 font-medium text-center whitespace-nowrap min-w-[130px]">Итого</th>
              </tr>
            </thead>
            <tbody>
              {months.map((month, i) => {
                const subVal = getValue(month, 'sub');
                const addVal = getValue(month, 'add');
                const totalVal = metric === 'avgCheck'
                  ? 0
                  : (metric === 'count'
                    ? salesData[month].subCount + salesData[month].addCount
                    : salesData[month].subSum + salesData[month].addSum);
                return (
                  <tr key={month} className={`border-b border-border/50 ${i % 2 === 0 ? 'bg-white' : 'bg-secondary/20'}`}>
                    <td className="px-4 py-2 font-medium sticky left-0 z-10 whitespace-nowrap"
                      style={{ background: i % 2 === 0 ? 'white' : 'rgb(248 248 248)' }}>
                      {MONTH_NAMES[i]}
                    </td>
                    <td className="px-3 py-2 text-center">{fmtVal(subVal)}</td>
                    <td className="px-3 py-2 text-center">{fmtVal(addVal)}</td>
                    <td className="px-3 py-2 text-center font-semibold">
                      {metric === 'avgCheck' ? '—' : fmtVal(totalVal)}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-border bg-secondary/50 font-semibold">
                <td className="px-4 py-2 sticky left-0 z-10 whitespace-nowrap" style={{ background: 'rgb(243 244 246)' }}>Итого год</td>
                <td className="px-3 py-2 text-center">{fmtVal(yearSubVal)}</td>
                <td className="px-3 py-2 text-center">{fmtVal(yearAddVal)}</td>
                <td className="px-3 py-2 text-center">
                  {metric === 'avgCheck' ? '—' : fmtVal(metric === 'count' ? yearSub.count + yearAdd.count : yearSub.sum + yearAdd.sum)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ExpensesReport({ state, months, filterBranchIds }: {
  state: StoreType['state'];
  months: string[];
  filterBranchIds: string[];
}) {
  const branchCategories = useMemo(() =>
    state.expenseCategories.filter(c => filterBranchIds.length === 0 || filterBranchIds.includes(c.branchId)),
    [state.expenseCategories, filterBranchIds]
  );

  // Факт: расходы по категории и месяцу
  const factMap = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    months.forEach(month => {
      const [year, mon] = month.split('-').map(Number);
      map[month] = {};
      branchCategories.forEach(cat => {
        const sum = state.expenses
          .filter(e => {
            const d = new Date(e.date);
            return d.getFullYear() === year && d.getMonth() + 1 === mon &&
              e.categoryId === cat.id &&
              (filterBranchIds.length === 0 || filterBranchIds.includes(e.branchId));
          })
          .reduce((s, e) => s + e.amount, 0);
        map[month][cat.id] = sum;
      });
    });
    return map;
  }, [months, branchCategories, state.expenses, filterBranchIds]);

  // План: expensePlans по категории и месяцу
  const planMap = useMemo(() => {
    const map: Record<string, Record<string, number | undefined>> = {};
    months.forEach(month => {
      map[month] = {};
      branchCategories.forEach(cat => {
        const p = state.expensePlans.find(ep =>
          ep.month === month && ep.categoryId === cat.id &&
          (filterBranchIds.length === 0 || filterBranchIds.includes(ep.branchId))
        );
        map[month][cat.id] = p?.planAmount;
      });
    });
    return map;
  }, [months, branchCategories, state.expensePlans, filterBranchIds]);

  if (branchCategories.length === 0) {
    return (
      <div className="pt-4 border-t border-border">
        <h2 className="text-lg font-semibold mb-1">Расходы</h2>
        <p className="text-sm text-muted-foreground">Нет категорий расходов для выбранных филиалов.</p>
      </div>
    );
  }

  return (
    <div className="pt-4 border-t border-border space-y-6">
      <h2 className="text-lg font-semibold">Расходы по категориям</h2>

      {/* ПЛАН расходов */}
      <div>
        <h3 className="text-base font-semibold mb-3">План</h3>
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-blue-50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground sticky left-0 bg-blue-50 min-w-[100px] z-10">Месяц</th>
                  {branchCategories.map(cat => (
                    <th key={cat.id} className="px-3 py-3 font-medium text-center whitespace-nowrap text-blue-800">{cat.name}</th>
                  ))}
                  <th className="px-3 py-3 font-medium text-center whitespace-nowrap text-blue-800">Итого</th>
                </tr>
              </thead>
              <tbody>
                {months.map((month, i) => {
                  const total = branchCategories.reduce((sum, cat) => sum + (planMap[month][cat.id] ?? 0), 0);
                  return (
                    <tr key={month} className={`border-b border-border/50 ${i % 2 === 0 ? 'bg-white' : 'bg-blue-50/30'}`}>
                      <td className="px-4 py-2 font-medium sticky left-0 z-10 whitespace-nowrap"
                        style={{ background: i % 2 === 0 ? 'white' : 'rgb(239 246 255 / 0.5)' }}>
                        {MONTH_NAMES[i]}
                      </td>
                      {branchCategories.map(cat => (
                        <td key={cat.id} className="px-3 py-2 text-center text-blue-700">
                          {fmtMoney(planMap[month][cat.id])}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-center font-semibold text-blue-800">
                        {total > 0 ? fmtMoney(total) : '—'}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-border bg-blue-50 font-semibold">
                  <td className="px-4 py-2 sticky left-0 z-10 bg-blue-50 text-blue-900 whitespace-nowrap">Итого год</td>
                  {branchCategories.map(cat => {
                    const yearTotal = months.reduce((s, m) => s + (planMap[m][cat.id] ?? 0), 0);
                    return <td key={cat.id} className="px-3 py-2 text-center text-blue-900">{yearTotal > 0 ? fmtMoney(yearTotal) : '—'}</td>;
                  })}
                  <td className="px-3 py-2 text-center text-blue-900">
                    {fmtMoney(months.reduce((s, m) => s + branchCategories.reduce((ss, cat) => ss + (planMap[m][cat.id] ?? 0), 0), 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ФАКТ расходов */}
      <div>
        <h3 className="text-base font-semibold mb-3">Факт</h3>
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground sticky left-0 bg-secondary/50 min-w-[100px] z-10">Месяц</th>
                  {branchCategories.map(cat => (
                    <th key={cat.id} className="px-3 py-3 font-medium text-center whitespace-nowrap">{cat.name}</th>
                  ))}
                  <th className="px-3 py-3 font-medium text-center whitespace-nowrap">Итого</th>
                </tr>
              </thead>
              <tbody>
                {months.map((month, i) => {
                  const total = branchCategories.reduce((sum, cat) => sum + (factMap[month][cat.id] ?? 0), 0);
                  return (
                    <tr key={month} className={`border-b border-border/50 ${i % 2 === 0 ? 'bg-white' : 'bg-secondary/20'}`}>
                      <td className="px-4 py-2 font-medium sticky left-0 z-10 whitespace-nowrap"
                        style={{ background: i % 2 === 0 ? 'white' : 'rgb(248 248 248)' }}>
                        {MONTH_NAMES[i]}
                      </td>
                      {branchCategories.map(cat => {
                        const fact = factMap[month][cat.id] ?? 0;
                        const plan = planMap[month][cat.id];
                        const pct = plan && plan > 0 ? ((fact - plan) / plan) * 100 : null;
                        return (
                          <td key={cat.id} className="px-3 py-2 text-center">
                            <span className="font-medium">{fmtMoney(fact)}</span>
                            {pct !== null && (
                              <span className={`ml-1 text-[10px] ${pct <= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {pct >= 0 ? '+' : ''}{pct.toFixed(0)}%
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-center font-semibold">{fmtMoney(total)}</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-border bg-secondary/50 font-semibold">
                  <td className="px-4 py-2 sticky left-0 z-10 whitespace-nowrap" style={{ background: 'rgb(243 244 246)' }}>Итого год</td>
                  {branchCategories.map(cat => {
                    const yearFact = months.reduce((s, m) => s + (factMap[m][cat.id] ?? 0), 0);
                    const yearPlan = months.reduce((s, m) => s + (planMap[m][cat.id] ?? 0), 0);
                    const pct = yearPlan > 0 ? ((yearFact - yearPlan) / yearPlan) * 100 : null;
                    return (
                      <td key={cat.id} className="px-3 py-2 text-center">
                        <span>{fmtMoney(yearFact)}</span>
                        {pct !== null && (
                          <span className={`ml-1 text-[10px] ${pct <= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {pct >= 0 ? '+' : ''}{pct.toFixed(0)}%
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center">
                    {fmtMoney(months.reduce((s, m) => s + branchCategories.reduce((ss, cat) => ss + (factMap[m][cat.id] ?? 0), 0), 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          В таблице «Факт» для расходов: зелёный % = потратили меньше плана (хорошо), красный % = превысили план.
          Плановые значения по категориям задаются в «Настройки» → «Расходы (план)».
        </p>
      </div>
    </div>
  );
}
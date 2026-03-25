import { useState, useMemo } from 'react';
import { StoreType, MonthlyPlanRow } from '@/store';
import Icon from '@/components/ui/icon';

function fmtMoney(val: number | undefined): string {
  if (val === undefined || val === null || isNaN(val)) return '—';
  return val.toLocaleString('ru-RU') + ' ₽';
}

function downloadCSV(filename: string, rows: string[][]) {
  const bom = '\uFEFF';
  const csv = bom + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
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
  const branchLabel = filterBranchIds.length === state.branches.length ? 'все филиалы'
    : state.branches.filter(b => filterBranchIds.includes(b.id)).map(b => b.name).join(', ');

  const exportPlanFact = (type: 'plan' | 'fact') => {
    const header = ['Месяц', ...COLUMNS.map(c => c.label), 'Итого год (справка)'];
    const rows: string[][] = [header];
    months.forEach((month, i) => {
      const row = [MONTH_NAMES[i]];
      COLUMNS.forEach(col => {
        const val = type === 'plan'
          ? plansMap[month]?.[col.key] as number | undefined
          : factsMap[month]?.[col.key] as number;
        row.push(val !== undefined && !isNaN(val as number) ? String(val) : '');
      });
      row.push('');
      rows.push(row);
    });
    const totRow = ['Итого год'];
    COLUMNS.forEach(col => {
      const vals = months.map(m => (type === 'plan' ? plansMap[m]?.[col.key] : factsMap[m]?.[col.key]) as number).filter(v => v !== undefined && !isNaN(v));
      const total = col.format === 'pct' || col.key === 'avgCheck'
        ? (vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0)
        : vals.reduce((a, b) => a + b, 0);
      totRow.push(String(Math.round(total * 100) / 100));
    });
    totRow.push('');
    rows.push(totRow);
    downloadCSV(`plan-fact-${type}-${selectedYear}-${branchLabel}.csv`, rows);
  };

  const exportExpenses = (type: 'plan' | 'fact') => {
    const branchCats = state.expenseCategories.filter(c => filterBranchIds.length === 0 || filterBranchIds.includes(c.branchId));
    const header = ['Категория', ...MONTH_NAMES, 'Итого год'];
    const rows: string[][] = [header];
    branchCats.forEach(cat => {
      const row = [cat.name];
      let yearTotal = 0;
      months.forEach(month => {
        const [year, mon] = month.split('-').map(Number);
        let val = 0;
        if (type === 'fact') {
          val = state.expenses.filter(e => {
            const d = new Date(e.date);
            return d.getFullYear() === year && d.getMonth() + 1 === mon && e.categoryId === cat.id && (filterBranchIds.length === 0 || filterBranchIds.includes(e.branchId));
          }).reduce((s, e) => s + e.amount, 0);
        } else {
          val = state.expensePlans.find(ep => ep.month === month && ep.categoryId === cat.id && (filterBranchIds.length === 0 || filterBranchIds.includes(ep.branchId)))?.planAmount ?? 0;
        }
        yearTotal += val;
        row.push(val > 0 ? String(val) : '');
      });
      row.push(String(yearTotal));
      rows.push(row);
    });
    downloadCSV(`expenses-${type}-${selectedYear}-${branchLabel}.csv`, rows);
  };

  const exportSales = () => {
    const bf = (b: string) => filterBranchIds.length === 0 || filterBranchIds.includes(b);
    const subPlans = state.subscriptionPlans.filter(p => bf(p.branchId));
    const addPlans = state.singleVisitPlans.filter(p => bf(p.branchId));
    const inM = (date: string, month: string) => {
      const [y, mo] = month.split('-').map(Number);
      const d = new Date(date);
      return d.getFullYear() === y && d.getMonth() + 1 === mo;
    };
    // Абонементы
    const subHeader = ['Месяц', ...subPlans.map(p => p.name + ' (кол-во)'), ...subPlans.map(p => p.name + ' (сумма)'), 'Итого кол-во', 'Итого сумма'];
    const subRows: string[][] = [subHeader];
    months.forEach((month, i) => {
      const row = [MONTH_NAMES[i]];
      let totalCnt = 0, totalSum = 0;
      subPlans.forEach(plan => {
        const sales = state.sales.filter(s => s.type === 'subscription' && s.itemId === plan.id && inM(s.date, month) && bf(s.branchId));
        row.push(String(sales.length));
        totalCnt += sales.length;
      });
      subPlans.forEach(plan => {
        const sales = state.sales.filter(s => s.type === 'subscription' && s.itemId === plan.id && inM(s.date, month) && bf(s.branchId));
        const sum = sales.reduce((s, x) => s + x.finalPrice, 0);
        row.push(String(sum));
        totalSum += sum;
      });
      row.push(String(totalCnt), String(totalSum));
      subRows.push(row);
    });
    downloadCSV(`sales-subscriptions-${selectedYear}-${branchLabel}.csv`, subRows);
    // Доп продажи
    const addHeader = ['Месяц', ...addPlans.map(p => p.name + ' (кол-во)'), ...addPlans.map(p => p.name + ' (сумма)'), 'Итого кол-во', 'Итого сумма'];
    const addRows: string[][] = [addHeader];
    months.forEach((month, i) => {
      const row = [MONTH_NAMES[i]];
      let totalCnt = 0, totalSum = 0;
      addPlans.forEach(plan => {
        const sales = state.sales.filter(s => s.type === 'single' && s.itemId === plan.id && inM(s.date, month) && bf(s.branchId));
        row.push(String(sales.length));
        totalCnt += sales.length;
      });
      addPlans.forEach(plan => {
        const sales = state.sales.filter(s => s.type === 'single' && s.itemId === plan.id && inM(s.date, month) && bf(s.branchId));
        const sum = sales.reduce((s, x) => s + x.finalPrice, 0);
        row.push(String(sum));
        totalSum += sum;
      });
      row.push(String(totalCnt), String(totalSum));
      addRows.push(row);
    });
    setTimeout(() => downloadCSV(`sales-single-${selectedYear}-${branchLabel}.csv`, addRows), 300);
  };

  const exportAll = () => {
    exportPlanFact('plan');
    setTimeout(() => exportPlanFact('fact'), 300);
    setTimeout(() => exportExpenses('plan'), 600);
    setTimeout(() => exportExpenses('fact'), 900);
    setTimeout(() => exportSales(), 1200);
  };

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
        <div className="ml-auto flex flex-wrap gap-2">
          <button onClick={exportAll} className="flex items-center gap-1.5 px-3 py-2 bg-foreground text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
            <Icon name="Download" size={14} /> Выгрузить всё
          </button>
        </div>
      </div>

      {/* Таблица ПЛАН */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">План / Факт — план</h2>
          <button onClick={() => exportPlanFact('plan')} className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border rounded-lg text-xs text-muted-foreground hover:bg-secondary transition-colors">
            <Icon name="Download" size={12} /> CSV
          </button>
        </div>
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">План / Факт — факт</h2>
          <button onClick={() => exportPlanFact('fact')} className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border rounded-lg text-xs text-muted-foreground hover:bg-secondary transition-colors">
            <Icon name="Download" size={12} /> CSV
          </button>
        </div>
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
      <ExpensesReport state={state} months={months} filterBranchIds={filterBranchIds}
        onExportPlan={() => exportExpenses('plan')} onExportFact={() => exportExpenses('fact')} />

      {/* РАЗДЕЛ: ПРОДАЖИ */}
      <SalesReport state={state} months={months} filterBranchIds={filterBranchIds} onExport={exportSales} />
    </div>
  );
}

type SalesTableMetric = 'count' | 'sum';

function SalesTable({
  title, headerBg, items, months, salesType, metric, state, filterBranchIds, plansMap, onExport,
}: {
  title: string; headerBg: string;
  items: { id: string; name: string }[];
  months: string[];
  salesType: 'subscription' | 'single';
  metric: SalesTableMetric;
  state: StoreType['state'];
  filterBranchIds: string[];
  plansMap: Record<string, Record<string, number>>;
  onExport: () => void;
}) {
  const bf = (b: string) => filterBranchIds.length === 0 || filterBranchIds.includes(b);
  const inM = (date: string, month: string) => {
    const [y, mo] = month.split('-').map(Number);
    const d = new Date(date);
    return d.getFullYear() === y && d.getMonth() + 1 === mo;
  };

  // fact[month][itemId] = {count, sum}
  const factMap = useMemo(() => {
    const map: Record<string, Record<string, { count: number; sum: number }>> = {};
    months.forEach(month => {
      map[month] = {};
      items.forEach(item => {
        const sales = state.sales.filter(s => s.type === salesType && s.itemId === item.id && inM(s.date, month) && bf(s.branchId));
        map[month][item.id] = { count: sales.length, sum: sales.reduce((a, s) => a + s.finalPrice, 0) };
      });
    });
    return map;
  }, [months, items, state.sales, filterBranchIds]);

  const getVal = (month: string, itemId: string): number => {
    const f = factMap[month]?.[itemId];
    if (!f) return 0;
    return metric === 'count' ? f.count : f.sum;
  };

  const getPlan = (month: string, itemId: string): number | undefined =>
    plansMap[month]?.[itemId];

  const fmtV = (v: number) => metric === 'count' ? (v === 0 ? '—' : String(v)) : (v === 0 ? '—' : v.toLocaleString('ru-RU') + ' ₽');

  // Итоги по столбцу (за год)
  const yearFact = items.map(item => ({
    id: item.id,
    count: months.reduce((s, m) => s + (factMap[m]?.[item.id]?.count ?? 0), 0),
    sum: months.reduce((s, m) => s + (factMap[m]?.[item.id]?.sum ?? 0), 0),
  }));
  const yearPlan = items.map(item => ({
    id: item.id,
    count: months.reduce((s, m) => s + (plansMap[m]?.[item.id] ?? 0), 0),
  }));
  const totalYearCount = yearFact.reduce((s, x) => s + x.count, 0);
  const totalYearSum = yearFact.reduce((s, x) => s + x.sum, 0);
  const totalYearAvg = totalYearCount > 0 ? totalYearSum / totalYearCount : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold">{title}</h3>
        <button onClick={onExport} className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border rounded-lg text-xs text-muted-foreground hover:bg-secondary transition-colors">
          <Icon name="Download" size={12} /> CSV
        </button>
      </div>
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className={`border-b border-border ${headerBg}`}>
                <th className={`text-left px-4 py-3 font-medium text-muted-foreground sticky left-0 ${headerBg} min-w-[110px] z-10`}>Месяц</th>
                {items.map(item => (
                  <th key={item.id} className="px-3 py-3 font-medium text-center whitespace-nowrap min-w-[120px]">{item.name}</th>
                ))}
                <th className="px-3 py-3 font-medium text-center whitespace-nowrap min-w-[100px]">Итого</th>
              </tr>
            </thead>
            <tbody>
              {months.map((month, i) => {
                const rowTotal = items.reduce((s, item) => {
                  const f = factMap[month]?.[item.id];
                  return s + (metric === 'count' ? (f?.count ?? 0) : (f?.sum ?? 0));
                }, 0);
                return (
                  <tr key={month} className={`border-b border-border/50 ${i % 2 === 0 ? 'bg-white' : 'bg-secondary/20'}`}>
                    <td className="px-4 py-2 font-medium sticky left-0 z-10 whitespace-nowrap"
                      style={{ background: i % 2 === 0 ? 'white' : 'rgb(248 248 248)' }}>
                      {MONTH_NAMES[i]}
                    </td>
                    {items.map(item => {
                      const val = getVal(month, item.id);
                      const plan = metric === 'count' ? getPlan(month, item.id) : undefined;
                      const pct = plan !== undefined && plan > 0 ? ((val - plan) / plan) * 100 : null;
                      return (
                        <td key={item.id} className="px-3 py-2 text-center">
                          <span className="font-medium">{fmtV(val)}</span>
                          {pct !== null && (
                            <span className={`ml-1 text-[10px] ${pct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {pct >= 0 ? '+' : ''}{pct.toFixed(0)}%
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center font-semibold">{fmtV(rowTotal)}</td>
                  </tr>
                );
              })}
              {/* Итого год */}
              <tr className="border-t-2 border-border bg-secondary/50 font-semibold">
                <td className="px-4 py-2 sticky left-0 z-10 whitespace-nowrap" style={{ background: 'rgb(243 244 246)' }}>Итого год</td>
                {yearFact.map((yf, idx) => {
                  const val = metric === 'count' ? yf.count : yf.sum;
                  const planTotal = yearPlan[idx]?.count;
                  const pct = metric === 'count' && planTotal && planTotal > 0 ? ((yf.count - planTotal) / planTotal) * 100 : null;
                  return (
                    <td key={yf.id} className="px-3 py-2 text-center">
                      <span>{fmtV(val)}</span>
                      {pct !== null && (
                        <span className={`ml-1 text-[10px] ${pct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {pct >= 0 ? '+' : ''}{pct.toFixed(0)}%
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-center">{fmtV(metric === 'count' ? totalYearCount : totalYearSum)}</td>
              </tr>
              {/* Средний чек */}
              <tr className="border-t border-border/50 bg-secondary/30 text-muted-foreground">
                <td className="px-4 py-2 sticky left-0 z-10 italic whitespace-nowrap" style={{ background: 'rgb(248 249 250)' }}>Ср. чек (год)</td>
                {yearFact.map(yf => {
                  const avg = yf.count > 0 ? yf.sum / yf.count : 0;
                  return (
                    <td key={yf.id} className="px-3 py-2 text-center italic">
                      {avg > 0 ? avg.toLocaleString('ru-RU') + ' ₽' : '—'}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-center italic">{totalYearAvg > 0 ? totalYearAvg.toLocaleString('ru-RU') + ' ₽' : '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SalesReport({ state, months, filterBranchIds, onExport }: {
  state: StoreType['state'];
  months: string[];
  filterBranchIds: string[];
  onExport: () => void;
}) {
  const [metric, setMetric] = useState<SalesTableMetric>('count');

  const bf = (b: string) => filterBranchIds.length === 0 || filterBranchIds.includes(b);
  const subItems = useMemo(() => state.subscriptionPlans.filter(p => bf(p.branchId)), [state.subscriptionPlans, filterBranchIds]);
  const addItems = useMemo(() => state.singleVisitPlans.filter(p => bf(p.branchId)), [state.singleVisitPlans, filterBranchIds]);

  // Планы продаж по количеству: plansMap[month][itemId] = target
  const salesPlansMap = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    months.forEach(month => {
      map[month] = {};
      const plan = state.salesPlans.find(p => p.month === month && (filterBranchIds.length === 0 || filterBranchIds.includes(p.branchId)));
      if (plan) {
        plan.items.forEach(item => { map[month][item.planId] = item.target; });
      }
    });
    return map;
  }, [months, state.salesPlans, filterBranchIds]);

  const exportTable = (type: 'sub-plan' | 'sub-fact' | 'add-plan' | 'add-fact') => {
    const isSub = type.startsWith('sub');
    const isPlan = type.endsWith('plan');
    const items = isSub ? subItems : addItems;
    const salesType = isSub ? 'subscription' : 'single';
    const inM = (date: string, month: string) => {
      const [y, mo] = month.split('-').map(Number);
      const d = new Date(date);
      return d.getFullYear() === y && d.getMonth() + 1 === mo;
    };
    const header = ['Месяц', ...items.map(p => p.name), 'Итого'];
    const rows: string[][] = [header];
    months.forEach((month, i) => {
      const row = [MONTH_NAMES[i]];
      let total = 0;
      items.forEach(item => {
        let val = 0;
        if (isPlan) {
          val = salesPlansMap[month]?.[item.id] ?? 0;
        } else {
          const sales = state.sales.filter(s => s.type === salesType && s.itemId === item.id && inM(s.date, month) && bf(s.branchId));
          val = metric === 'count' ? sales.length : sales.reduce((a, s) => a + s.finalPrice, 0);
        }
        total += val;
        row.push(val > 0 ? String(val) : '');
      });
      row.push(String(total));
      rows.push(row);
    });
    const suffix = isSub ? 'subscriptions' : 'single';
    const typeSuffix = isPlan ? 'plan' : `fact-${metric}`;
    onExport();
    downloadCSV(`sales-${suffix}-${typeSuffix}-${state.currentBranchId}.csv`, rows);
  };

  return (
    <div className="pt-4 border-t border-border space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="text-lg font-semibold">Продажи</h2>
        <div className="flex gap-1 bg-secondary rounded-lg p-1">
          {([['count', 'Количество'], ['sum', 'Сумма']] as [SalesTableMetric, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setMetric(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${metric === key ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Средний чек — в последней строке каждой таблицы</p>
      </div>

      <SalesTable title="Абонементы — план (количество)" headerBg="bg-blue-50"
        items={subItems} months={months} salesType="subscription" metric="count"
        state={state} filterBranchIds={filterBranchIds} plansMap={salesPlansMap}
        onExport={() => exportTable('sub-plan')} />

      <SalesTable title={`Абонементы — факт (${metric === 'count' ? 'количество' : 'сумма'})`} headerBg="bg-secondary/50"
        items={subItems} months={months} salesType="subscription" metric={metric}
        state={state} filterBranchIds={filterBranchIds} plansMap={salesPlansMap}
        onExport={() => exportTable('sub-fact')} />

      <SalesTable title="Доп. продажи — план (количество)" headerBg="bg-blue-50"
        items={addItems} months={months} salesType="single" metric="count"
        state={state} filterBranchIds={filterBranchIds} plansMap={salesPlansMap}
        onExport={() => exportTable('add-plan')} />

      <SalesTable title={`Доп. продажи — факт (${metric === 'count' ? 'количество' : 'сумма'})`} headerBg="bg-secondary/50"
        items={addItems} months={months} salesType="single" metric={metric}
        state={state} filterBranchIds={filterBranchIds} plansMap={salesPlansMap}
        onExport={() => exportTable('add-fact')} />
    </div>
  );
}

function ExpensesReport({ state, months, filterBranchIds, onExportPlan, onExportFact }: {
  state: StoreType['state'];
  months: string[];
  filterBranchIds: string[];
  onExportPlan: () => void;
  onExportFact: () => void;
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

      {/* ПЛАН расходов: категории в строках, месяцы в столбцах */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">План</h3>
          <button onClick={onExportPlan} className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border rounded-lg text-xs text-muted-foreground hover:bg-secondary transition-colors">
            <Icon name="Download" size={12} /> CSV
          </button>
        </div>
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-blue-50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground sticky left-0 bg-blue-50 min-w-[150px] z-10">Категория</th>
                  {months.map((_, i) => (
                    <th key={i} className="px-3 py-3 font-medium text-center whitespace-nowrap min-w-[90px] text-blue-800">{MONTH_NAMES[i]}</th>
                  ))}
                  <th className="px-3 py-3 font-medium text-center whitespace-nowrap text-blue-800 bg-blue-100/60">Итого год</th>
                </tr>
              </thead>
              <tbody>
                {branchCategories.map((cat, ci) => {
                  const yearTotal = months.reduce((s, m) => s + (planMap[m][cat.id] ?? 0), 0);
                  return (
                    <tr key={cat.id} className={`border-b border-border/50 ${ci % 2 === 0 ? 'bg-white' : 'bg-blue-50/30'}`}>
                      <td className="px-4 py-2 font-medium sticky left-0 z-10 whitespace-nowrap"
                        style={{ background: ci % 2 === 0 ? 'white' : 'rgb(239 246 255 / 0.5)' }}>
                        {cat.name}
                      </td>
                      {months.map(month => (
                        <td key={month} className="px-3 py-2 text-center text-blue-700">
                          {fmtMoney(planMap[month][cat.id])}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-center font-semibold text-blue-900 bg-blue-50/60">
                        {yearTotal > 0 ? fmtMoney(yearTotal) : '—'}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-border bg-blue-50 font-semibold">
                  <td className="px-4 py-2 sticky left-0 z-10 bg-blue-50 text-blue-900 whitespace-nowrap">Итого</td>
                  {months.map(month => {
                    const total = branchCategories.reduce((s, cat) => s + (planMap[month][cat.id] ?? 0), 0);
                    return <td key={month} className="px-3 py-2 text-center text-blue-900">{total > 0 ? fmtMoney(total) : '—'}</td>;
                  })}
                  <td className="px-3 py-2 text-center text-blue-900 bg-blue-100/60">
                    {fmtMoney(months.reduce((s, m) => s + branchCategories.reduce((ss, cat) => ss + (planMap[m][cat.id] ?? 0), 0), 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ФАКТ расходов: категории в строках, месяцы в столбцах */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">Факт</h3>
          <button onClick={onExportFact} className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border rounded-lg text-xs text-muted-foreground hover:bg-secondary transition-colors">
            <Icon name="Download" size={12} /> CSV
          </button>
        </div>
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground sticky left-0 bg-secondary/50 min-w-[150px] z-10">Категория</th>
                  {months.map((_, i) => (
                    <th key={i} className="px-3 py-3 font-medium text-center whitespace-nowrap min-w-[90px]">{MONTH_NAMES[i]}</th>
                  ))}
                  <th className="px-3 py-3 font-medium text-center whitespace-nowrap bg-secondary/80">Итого год</th>
                </tr>
              </thead>
              <tbody>
                {branchCategories.map((cat, ci) => {
                  const yearFact = months.reduce((s, m) => s + (factMap[m][cat.id] ?? 0), 0);
                  const yearPlan = months.reduce((s, m) => s + (planMap[m][cat.id] ?? 0), 0);
                  const yearPct = yearPlan > 0 ? ((yearFact - yearPlan) / yearPlan) * 100 : null;
                  return (
                    <tr key={cat.id} className={`border-b border-border/50 ${ci % 2 === 0 ? 'bg-white' : 'bg-secondary/20'}`}>
                      <td className="px-4 py-2 font-medium sticky left-0 z-10 whitespace-nowrap"
                        style={{ background: ci % 2 === 0 ? 'white' : 'rgb(248 248 248)' }}>
                        {cat.name}
                      </td>
                      {months.map(month => {
                        const fact = factMap[month][cat.id] ?? 0;
                        const plan = planMap[month][cat.id];
                        const pct = plan && plan > 0 ? ((fact - plan) / plan) * 100 : null;
                        return (
                          <td key={month} className="px-3 py-2 text-center">
                            <span className="font-medium">{fmtMoney(fact)}</span>
                            {pct !== null && (
                              <span className={`ml-1 text-[10px] ${pct <= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {pct >= 0 ? '+' : ''}{pct.toFixed(0)}%
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-center bg-secondary/30">
                        <span className="font-semibold">{fmtMoney(yearFact)}</span>
                        {yearPct !== null && (
                          <span className={`ml-1 text-[10px] ${yearPct <= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {yearPct >= 0 ? '+' : ''}{yearPct.toFixed(0)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-border bg-secondary/50 font-semibold">
                  <td className="px-4 py-2 sticky left-0 z-10 whitespace-nowrap" style={{ background: 'rgb(243 244 246)' }}>Итого</td>
                  {months.map(month => {
                    const total = branchCategories.reduce((s, cat) => s + (factMap[month][cat.id] ?? 0), 0);
                    return <td key={month} className="px-3 py-2 text-center">{fmtMoney(total)}</td>;
                  })}
                  <td className="px-3 py-2 text-center bg-secondary/80">
                    {fmtMoney(months.reduce((s, m) => s + branchCategories.reduce((ss, cat) => ss + (factMap[m][cat.id] ?? 0), 0), 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Зелёный % = потратили меньше плана, красный % = превысили план.
        </p>
      </div>
    </div>
  );
}
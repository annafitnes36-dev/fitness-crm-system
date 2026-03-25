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

function SalesReport({ state, months, filterBranchIds, onExport }: {
  state: StoreType['state'];
  months: string[];
  filterBranchIds: string[];
  onExport: () => void;
}) {
  const bf = (b: string) => filterBranchIds.length === 0 || filterBranchIds.includes(b);
  const inM = (date: string, month: string) => {
    const [y, mo] = month.split('-').map(Number);
    const d = new Date(date);
    return d.getFullYear() === y && d.getMonth() + 1 === mo;
  };

  const subItems = useMemo(() => state.subscriptionPlans.filter(p => bf(p.branchId)), [state.subscriptionPlans, filterBranchIds]);
  const addItems = useMemo(() => state.singleVisitPlans.filter(p => bf(p.branchId)), [state.singleVisitPlans, filterBranchIds]);

  // fact[itemId][month] = {count, sum}
  const factData = useMemo(() => {
    const map: Record<string, Record<string, { count: number; sum: number }>> = {};
    [...subItems, ...addItems].forEach(item => {
      map[item.id] = {};
      months.forEach(month => {
        const salesType = subItems.find(s => s.id === item.id) ? 'subscription' : 'single';
        const sales = state.sales.filter(s => s.type === salesType && s.itemId === item.id && inM(s.date, month) && bf(s.branchId));
        map[item.id][month] = { count: sales.length, sum: sales.reduce((a, s) => a + s.finalPrice, 0) };
      });
    });
    return map;
  }, [subItems, addItems, months, state.sales, filterBranchIds]);

  // plan[itemId][month] = target
  const planData = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    [...subItems, ...addItems].forEach(item => { map[item.id] = {}; });
    months.forEach(month => {
      const plan = state.salesPlans.find(p => p.month === month && (filterBranchIds.length === 0 || filterBranchIds.includes(p.branchId)));
      if (plan) {
        plan.items.forEach(pi => { if (map[pi.planId]) map[pi.planId][month] = pi.target; });
      }
    });
    return map;
  }, [subItems, addItems, months, state.salesPlans, filterBranchIds]);

  const renderSalesBlock = (
    title: string,
    items: { id: string; name: string }[],
    accentBg: string,
  ) => {
    if (items.length === 0) return (
      <div>
        <h3 className="text-base font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground">Нет позиций для выбранных филиалов.</p>
      </div>
    );

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
                <tr className={`border-b border-border ${accentBg}`}>
                  <th className={`text-left px-4 py-3 font-medium text-muted-foreground sticky left-0 ${accentBg} min-w-[160px] z-10`}>Позиция</th>
                  {months.map((_, i) => (
                    <th key={i} className="px-3 py-3 font-medium text-center whitespace-nowrap min-w-[80px]">{MONTH_NAMES[i]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, ri) => {
                  const yearCount = months.reduce((s, m) => s + (factData[item.id]?.[m]?.count ?? 0), 0);
                  const yearSum = months.reduce((s, m) => s + (factData[item.id]?.[m]?.sum ?? 0), 0);
                  return (
                    <tr key={item.id} className={`border-b border-border/50 ${ri % 2 === 0 ? 'bg-white' : 'bg-secondary/20'}`}>
                      <td className="px-4 py-1.5 font-medium sticky left-0 z-10 whitespace-nowrap"
                        style={{ background: ri % 2 === 0 ? 'white' : 'rgb(248 248 248)' }}>
                        <div>{item.name}</div>
                        {yearCount > 0 && (
                          <div className="text-[10px] text-muted-foreground font-normal">
                            за год: {yearCount} шт · {yearSum.toLocaleString('ru-RU')} ₽
                          </div>
                        )}
                      </td>
                      {months.map(month => {
                        const f = factData[item.id]?.[month] ?? { count: 0, sum: 0 };
                        const plan = planData[item.id]?.[month];
                        const pct = plan && plan > 0 ? ((f.count - plan) / plan) * 100 : null;
                        return (
                          <td key={month} className="px-2 py-1.5 text-center">
                            <div className="font-medium">{f.count > 0 ? f.count : '—'}</div>
                            {plan !== undefined && plan > 0 && (
                              <div className="text-[10px] text-blue-600">пл: {plan}</div>
                            )}
                            {pct !== null && (
                              <div className={`text-[10px] ${pct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {pct >= 0 ? '+' : ''}{pct.toFixed(0)}%
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {/* Итого кол-во за месяц */}
                <tr className="border-t-2 border-border bg-secondary/50 font-semibold">
                  <td className="px-4 py-2 sticky left-0 z-10 whitespace-nowrap" style={{ background: 'rgb(243 244 246)' }}>Итого шт.</td>
                  {months.map(month => {
                    const total = items.reduce((s, item) => s + (factData[item.id]?.[month]?.count ?? 0), 0);
                    const planTotal = items.reduce((s, item) => s + (planData[item.id]?.[month] ?? 0), 0);
                    const pct = planTotal > 0 ? ((total - planTotal) / planTotal) * 100 : null;
                    return (
                      <td key={month} className="px-2 py-2 text-center">
                        <div>{total > 0 ? total : '—'}</div>
                        {planTotal > 0 && <div className="text-[10px] text-blue-600">пл: {planTotal}</div>}
                        {pct !== null && (
                          <div className={`text-[10px] ${pct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {pct >= 0 ? '+' : ''}{pct.toFixed(0)}%
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
                {/* Средний чек за месяц */}
                <tr className="border-t border-border/30 bg-secondary/20 text-muted-foreground italic">
                  <td className="px-4 py-2 sticky left-0 z-10 whitespace-nowrap text-xs" style={{ background: 'rgb(250 250 250)' }}>Ср. чек</td>
                  {months.map(month => {
                    const totalCount = items.reduce((s, item) => s + (factData[item.id]?.[month]?.count ?? 0), 0);
                    const totalSum = items.reduce((s, item) => s + (factData[item.id]?.[month]?.sum ?? 0), 0);
                    const avg = totalCount > 0 ? Math.round(totalSum / totalCount) : 0;
                    return (
                      <td key={month} className="px-2 py-2 text-center text-xs">
                        {avg > 0 ? avg.toLocaleString('ru-RU') + ' ₽' : '—'}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="pt-4 border-t border-border space-y-6">
      <h2 className="text-lg font-semibold">Продажи</h2>
      {renderSalesBlock('Абонементы', subItems, 'bg-secondary/50')}
      {renderSalesBlock('Доп. продажи', addItems, 'bg-secondary/50')}
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
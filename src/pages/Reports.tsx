import { useState, useMemo } from 'react';
import { StoreType, MonthlyPlanRow } from '@/store';
import Icon from '@/components/ui/icon';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

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
const MONTH_NAMES_SHORT = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

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
  month: string,
  state: StoreType['state']
): MonthlyPlanRow {
  const [year, mon] = month.split('-').map(Number);
  const monthStart = `${year}-${String(mon).padStart(2, '0')}-01`;
  const nextY = mon === 12 ? year + 1 : year;
  const nextM = mon === 12 ? 1 : mon + 1;
  const monthEnd = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
  const inMonth = (date: string) => date >= monthStart && date < monthEnd;
  const branchFilter = (bId: string) => branchIds.length === 0 || branchIds.includes(bId);

  // Продажи за месяц
  const monthSales = state.sales.filter(s => inMonth(s.date) && branchFilter(s.branchId));
  const subSales = monthSales.filter(s => s.type === 'subscription');
  const addSales = monthSales.filter(s => s.type === 'single' || s.type === 'extra');

  const revenue = monthSales.reduce((sum, s) => sum + s.finalPrice, 0);
  const subscriptionSales = subSales.reduce((sum, s) => sum + s.finalPrice, 0);
  const additionalSales = addSales.reduce((sum, s) => sum + s.finalPrice, 0);
  // Средний чек — только по абонементам
  const avgCheck = subSales.length > 0 ? subscriptionSales / subSales.length : 0;

  // Расходы
  const expenses = state.expenses
    .filter(e => inMonth(e.date) && branchFilter(e.branchId))
    .reduce((sum, e) => sum + e.amount, 0);

  const profit = revenue - expenses;
  const profitability = revenue > 0 ? (profit / revenue) * 100 : 0;

  // Обращения = inquiry + новые клиенты (как на дашборде)
  const monthInquiries = state.inquiries.filter(i => inMonth(i.date) && branchFilter(i.branchId)).length;
  const newClients = state.clients.filter(c => branchFilter(c.branchId) && inMonth(c.createdAt)).length;
  const inquiries = monthInquiries + newClients;

  // Все attended-визиты по клиентам (история)
  const branchScheduleIds = new Set(
    state.schedule.filter(e => branchFilter(e.branchId)).map(e => e.id)
  );
  const allAttendedByClient: Record<string, string[]> = {};
  state.visits.filter(v => v.status === 'attended' && branchScheduleIds.has(v.scheduleEntryId)).forEach(v => {
    if (!allAttendedByClient[v.clientId]) allAttendedByClient[v.clientId] = [];
    allAttendedByClient[v.clientId].push(v.date);
  });

  // Записи новичков: записался в этом месяце, до этого ни разу не был
  const monthEnrolledVisits = state.visits.filter(v => {
    if (!['attended', 'enrolled', 'missed'].includes(v.status)) return false;
    if (!inMonth(v.date)) return false;
    return branchScheduleIds.has(v.scheduleEntryId);
  });
  const newbieEnrollmentSet = new Set<string>();
  monthEnrolledVisits.forEach(v => {
    const prev = (allAttendedByClient[v.clientId] || []).filter(d => d < monthStart);
    if (prev.length === 0) newbieEnrollmentSet.add(v.clientId);
  });
  const newbieEnrollments = newbieEnrollmentSet.size;

  // Дошло новичков: первый attended-визит в жизни — в этом месяце
  const newbieAttendedSet = new Set<string>();
  state.visits.filter(v => v.status === 'attended' && branchScheduleIds.has(v.scheduleEntryId)).forEach(v => {
    const all = (allAttendedByClient[v.clientId] || []).sort();
    if (all.length > 0 && all[0] >= monthStart && all[0] < monthEnd) newbieAttendedSet.add(v.clientId);
  });
  const newbieAttended = newbieAttendedSet.size;

  // Продажи новичкам: первая покупка абонемента
  const newbieSales = subSales.filter(s => s.isFirstSubscription).length;

  // Конверсии — автоматически в %
  const convInquiryToEnroll = inquiries > 0 ? (newbieEnrollments / inquiries) * 100 : 0;
  const convEnrollToAttend = newbieEnrollments > 0 ? (newbieAttended / newbieEnrollments) * 100 : 0;
  const convAttendToSale = newbieAttended > 0 ? (newbieSales / newbieAttended) * 100 : 0;

  const totalSubscriptionSales = subSales.length;

  // Потенциал продлений: абонементы, срок которых закончился в этом месяце
  const renewalPotential = state.subscriptions.filter(s => {
    if (!branchFilter(s.branchId)) return false;
    return s.endDate >= monthStart && s.endDate < monthEnd;
  }).length;

  const renewals = subSales.filter(s => s.isRenewal).length;
  const convRenewal = renewalPotential > 0 ? (renewals / renewalPotential) * 100 : 0;
  const returns = subSales.filter(s => s.isReturn).length;

  return {
    revenue, expenses, profit, additionalSales, subscriptionSales, avgCheck,
    inquiries, newbieEnrollments, newbieAttended, newbieSales,
    convInquiryToEnroll, convEnrollToAttend, convAttendToSale,
    totalSubscriptionSales, renewalPotential, renewals, convRenewal, returns, profitability,
  };
}

function computePlan(
  branchId: string,
  month: string,
  state: StoreType['state']
): Partial<MonthlyPlanRow> {
  // Берём сохранённый план из раздела Планирование
  const saved = state.monthlyPlans.find(p => p.branchId === branchId && p.month === month);
  if (saved?.plan && Object.keys(saved.plan).length > 0) return saved.plan;

  // Если нет сохранённого — вычисляем автоматически из плана продаж и плана расходов
  const subPlans = state.subscriptionPlans.filter(p => p.branchId === branchId);
  const addPlans = state.singleVisitPlans.filter(p => p.branchId === branchId);
  const extraItems = state.trainingTypes.filter(tt => tt.extraPrice && tt.extraPrice > 0 && tt.branchIds.includes(branchId));
  const branchCats = state.expenseCategories.filter(c => c.branchId === branchId);
  const sp = state.salesPlans.find(p => p.branchId === branchId && p.month === month);

  const subRevenue = subPlans.reduce((s, p) => s + (sp?.items.find(i => i.planId === p.id)?.target ?? 0) * p.price, 0);
  const subQty = subPlans.reduce((s, p) => s + (sp?.items.find(i => i.planId === p.id)?.target ?? 0), 0);
  const addRevenue = addPlans.reduce((s, p) => s + (sp?.items.find(i => i.planId === p.id)?.target ?? 0) * p.price, 0);
  const extraRev = extraItems.reduce((s, tt) => s + (sp?.items.find(i => i.planId === tt.id)?.target ?? 0) * (tt.extraPrice ?? 0), 0);

  const revenue = subRevenue + addRevenue + extraRev;
  const expenses = branchCats.reduce((s, cat) => {
    const ep = state.expensePlans.find((p: { branchId: string; month: string; categoryId: string; planAmount: number }) =>
      p.branchId === branchId && p.month === month && p.categoryId === cat.id
    );
    return s + (ep?.planAmount ?? 0);
  }, 0);
  const profit = revenue - expenses;

  return {
    revenue,
    expenses,
    profit,
    profitability: revenue > 0 ? Math.round((profit / revenue) * 100) : 0,
    subscriptionSales: subRevenue,
    additionalSales: addRevenue + extraRev,
    avgCheck: subQty > 0 ? Math.round(subRevenue / subQty) : 0,
  };
}

function generateMonths(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return `${year}-${String(m).padStart(2, '0')}`;
  });
}

type ReportSection = 'planfact' | 'expenses' | 'sales';

const REPORT_NAV: { id: ReportSection; label: string; icon: string }[] = [
  { id: 'planfact', label: 'План / Факт', icon: 'BarChart2' },
  { id: 'expenses', label: 'Расходы', icon: 'Receipt' },
  { id: 'sales', label: 'Продажи', icon: 'ShoppingBag' },
];

export default function Reports({ store }: ReportsProps) {
  const { state } = store;
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [filterBranchIds, setFilterBranchIds] = useState<string[]>([state.currentBranchId]);
  const [activeSection, setActiveSection] = useState<ReportSection>('planfact');
  const [comments, setComments] = useState<Record<string, string>>({
    planfact: '', expenses: '', sales: '',
  });
  const [showExportMenu, setShowExportMenu] = useState(false);

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
    const branchId = filterBranchIds[0] || state.currentBranchId;
    months.forEach(month => {
      map[month] = computePlan(branchId, month, state);
    });
    return map;
  }, [months, filterBranchIds, state]);

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
    const bf = (b: string) => filterBranchIds.length === 0 || filterBranchIds.includes(b);
    const inM = (date: string, month: string) => {
      const [y, mo] = month.split('-').map(Number);
      const d = new Date(date);
      return d.getFullYear() === y && d.getMonth() + 1 === mo;
    };

    const allRows: string[][] = [];
    const sep = () => { allRows.push([]); };

    // === ПЛАН/ФАКТ — ПЛАН ===
    allRows.push([`=== ПЛАН / ФАКТ — ПЛАН (${selectedYear}, ${branchLabel}) ===`]);
    allRows.push(['Месяц', ...COLUMNS.map(c => c.label)]);
    months.forEach((month, i) => {
      const row = [MONTH_NAMES[i]];
      COLUMNS.forEach(col => {
        const val = plansMap[month]?.[col.key] as number | undefined;
        row.push(val !== undefined && !isNaN(val as number) ? String(val) : '');
      });
      allRows.push(row);
    });
    const pTotRow = ['Итого год'];
    COLUMNS.forEach(col => {
      const vals = months.map(m => plansMap[m]?.[col.key] as number | undefined).filter(v => v !== undefined) as number[];
      const total = col.format === 'pct' || col.key === 'avgCheck'
        ? (vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0)
        : vals.reduce((a, b) => a + b, 0);
      pTotRow.push(vals.length > 0 ? String(Math.round(total * 100) / 100) : '');
    });
    allRows.push(pTotRow);
    if (comments.planfact) { sep(); allRows.push(['Комментарий:', comments.planfact]); }
    sep(); sep();

    // === ПЛАН/ФАКТ — ФАКТ ===
    allRows.push([`=== ПЛАН / ФАКТ — ФАКТ (${selectedYear}, ${branchLabel}) ===`]);
    allRows.push(['Месяц', ...COLUMNS.map(c => c.label)]);
    months.forEach((month, i) => {
      const row = [MONTH_NAMES[i]];
      COLUMNS.forEach(col => {
        const val = factsMap[month]?.[col.key] as number | undefined;
        row.push(val !== undefined && !isNaN(val as number) ? String(val) : '');
      });
      allRows.push(row);
    });
    const fTotRow = ['Итого год'];
    COLUMNS.forEach(col => {
      const vals = months.map(m => factsMap[m]?.[col.key] as number).filter(v => !isNaN(v));
      const total = col.format === 'pct' || col.key === 'avgCheck'
        ? (vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0)
        : vals.reduce((a, b) => a + b, 0);
      fTotRow.push(String(Math.round(total * 100) / 100));
    });
    allRows.push(fTotRow);
    sep(); sep();

    // === РАСХОДЫ — ПЛАН ===
    const branchCats = state.expenseCategories.filter(c => filterBranchIds.length === 0 || filterBranchIds.includes(c.branchId));
    allRows.push([`=== РАСХОДЫ — ПЛАН (${selectedYear}, ${branchLabel}) ===`]);
    allRows.push(['Категория', ...MONTH_NAMES, 'Итого год']);
    branchCats.forEach(cat => {
      const row = [cat.name];
      let yearTotal = 0;
      months.forEach(month => {
        const val = state.expensePlans.find(ep => ep.month === month && ep.categoryId === cat.id && (filterBranchIds.length === 0 || filterBranchIds.includes(ep.branchId)))?.planAmount ?? 0;
        yearTotal += val;
        row.push(val > 0 ? String(val) : '');
      });
      row.push(String(yearTotal));
      allRows.push(row);
    });
    if (comments.expenses) { sep(); allRows.push(['Комментарий:', comments.expenses]); }
    sep(); sep();

    // === РАСХОДЫ — ФАКТ ===
    allRows.push([`=== РАСХОДЫ — ФАКТ (${selectedYear}, ${branchLabel}) ===`]);
    allRows.push(['Категория', ...MONTH_NAMES, 'Итого год']);
    branchCats.forEach(cat => {
      const row = [cat.name];
      let yearTotal = 0;
      months.forEach(month => {
        const [year, mon] = month.split('-').map(Number);
        const val = state.expenses.filter(e => {
          const d = new Date(e.date);
          return d.getFullYear() === year && d.getMonth() + 1 === mon && e.categoryId === cat.id && (filterBranchIds.length === 0 || filterBranchIds.includes(e.branchId));
        }).reduce((s, e) => s + e.amount, 0);
        yearTotal += val;
        row.push(val > 0 ? String(val) : '');
      });
      row.push(String(yearTotal));
      allRows.push(row);
    });
    sep(); sep();

    // === ПРОДАЖИ — АБОНЕМЕНТЫ ===
    const subPlans = state.subscriptionPlans.filter(p => bf(p.branchId));
    const addPlans = state.singleVisitPlans.filter(p => bf(p.branchId));
    allRows.push([`=== ПРОДАЖИ — АБОНЕМЕНТЫ (${selectedYear}, ${branchLabel}) ===`]);
    allRows.push(['Месяц', ...subPlans.map(p => p.name + ' (кол-во)'), ...subPlans.map(p => p.name + ' (сумма)'), 'Итого кол-во', 'Итого сумма']);
    months.forEach((month, i) => {
      const row = [MONTH_NAMES[i]];
      let totalCnt = 0, totalSum = 0;
      subPlans.forEach(plan => {
        const sales = state.sales.filter(s => s.type === 'subscription' && s.itemId === plan.id && inM(s.date, month) && bf(s.branchId));
        row.push(String(sales.length)); totalCnt += sales.length;
      });
      subPlans.forEach(plan => {
        const sum = state.sales.filter(s => s.type === 'subscription' && s.itemId === plan.id && inM(s.date, month) && bf(s.branchId)).reduce((s, x) => s + x.finalPrice, 0);
        row.push(String(sum)); totalSum += sum;
      });
      row.push(String(totalCnt), String(totalSum));
      allRows.push(row);
    });
    sep(); sep();

    // === ПРОДАЖИ — ДОП. ПРОДАЖИ ===
    allRows.push([`=== ПРОДАЖИ — ДОП. ПРОДАЖИ (${selectedYear}, ${branchLabel}) ===`]);
    allRows.push(['Месяц', ...addPlans.map(p => p.name + ' (кол-во)'), ...addPlans.map(p => p.name + ' (сумма)'), 'Итого кол-во', 'Итого сумма']);
    months.forEach((month, i) => {
      const row = [MONTH_NAMES[i]];
      let totalCnt = 0, totalSum = 0;
      addPlans.forEach(plan => {
        const sales = state.sales.filter(s => s.type === 'single' && s.itemId === plan.id && inM(s.date, month) && bf(s.branchId));
        row.push(String(sales.length)); totalCnt += sales.length;
      });
      addPlans.forEach(plan => {
        const sum = state.sales.filter(s => s.type === 'single' && s.itemId === plan.id && inM(s.date, month) && bf(s.branchId)).reduce((s, x) => s + x.finalPrice, 0);
        row.push(String(sum)); totalSum += sum;
      });
      row.push(String(totalCnt), String(totalSum));
      allRows.push(row);
    });
    if (comments.sales) { sep(); allRows.push(['Комментарий:', comments.sales]); }

    downloadCSV(`otchety-${selectedYear}-${branchLabel}.csv`, allRows);
  };

  // Общий сборщик секций (возвращает массив {title, rows})
  const buildSections = () => {
    const bf = (b: string) => filterBranchIds.length === 0 || filterBranchIds.includes(b);
    const inM = (date: string, month: string) => {
      const [y, mo] = month.split('-').map(Number);
      const d = new Date(date);
      return d.getFullYear() === y && d.getMonth() + 1 === mo;
    };
    const branchCats = state.expenseCategories.filter(c => filterBranchIds.length === 0 || filterBranchIds.includes(c.branchId));
    const subPlans = state.subscriptionPlans.filter(p => bf(p.branchId));
    const addPlans = state.singleVisitPlans.filter(p => bf(p.branchId));

    const sections: { title: string; rows: string[][] }[] = [];

    // План/Факт — план
    const pfPlanRows: string[][] = [['Месяц', ...COLUMNS.map(c => c.label)]];
    months.forEach((month, i) => {
      const row = [MONTH_NAMES[i]];
      COLUMNS.forEach(col => {
        const val = plansMap[month]?.[col.key] as number | undefined;
        row.push(val !== undefined && !isNaN(val as number) ? String(val) : '');
      });
      pfPlanRows.push(row);
    });
    const pTot = ['Итого год'];
    COLUMNS.forEach(col => {
      const vals = months.map(m => plansMap[m]?.[col.key] as number | undefined).filter(v => v !== undefined) as number[];
      const total = col.format === 'pct' || col.key === 'avgCheck' ? (vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0) : vals.reduce((a, b) => a + b, 0);
      pTot.push(vals.length > 0 ? String(Math.round(total * 100) / 100) : '');
    });
    pfPlanRows.push(pTot);
    if (comments.planfact) pfPlanRows.push(['Комментарий:', comments.planfact]);
    sections.push({ title: `План/Факт — план (${selectedYear})`, rows: pfPlanRows });

    // План/Факт — факт
    const pfFactRows: string[][] = [['Месяц', ...COLUMNS.map(c => c.label)]];
    months.forEach((month, i) => {
      const row = [MONTH_NAMES[i]];
      COLUMNS.forEach(col => {
        const val = factsMap[month]?.[col.key] as number | undefined;
        row.push(val !== undefined && !isNaN(val as number) ? String(val) : '');
      });
      pfFactRows.push(row);
    });
    const fTot = ['Итого год'];
    COLUMNS.forEach(col => {
      const vals = months.map(m => factsMap[m]?.[col.key] as number).filter(v => !isNaN(v));
      const total = col.format === 'pct' || col.key === 'avgCheck' ? (vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0) : vals.reduce((a, b) => a + b, 0);
      fTot.push(String(Math.round(total * 100) / 100));
    });
    pfFactRows.push(fTot);
    sections.push({ title: `План/Факт — факт (${selectedYear})`, rows: pfFactRows });

    // Расходы — план
    const expPlanRows: string[][] = [['Категория', ...MONTH_NAMES, 'Итого год']];
    branchCats.forEach(cat => {
      const row = [cat.name]; let yearTotal = 0;
      months.forEach(month => {
        const val = state.expensePlans.find(ep => ep.month === month && ep.categoryId === cat.id && (filterBranchIds.length === 0 || filterBranchIds.includes(ep.branchId)))?.planAmount ?? 0;
        yearTotal += val; row.push(val > 0 ? String(val) : '');
      });
      row.push(String(yearTotal)); expPlanRows.push(row);
    });
    if (comments.expenses) expPlanRows.push(['Комментарий:', comments.expenses]);
    sections.push({ title: `Расходы — план (${selectedYear})`, rows: expPlanRows });

    // Расходы — факт
    const expFactRows: string[][] = [['Категория', ...MONTH_NAMES, 'Итого год']];
    branchCats.forEach(cat => {
      const row = [cat.name]; let yearTotal = 0;
      months.forEach(month => {
        const [year, mon] = month.split('-').map(Number);
        const val = state.expenses.filter(e => { const d = new Date(e.date); return d.getFullYear() === year && d.getMonth() + 1 === mon && e.categoryId === cat.id && (filterBranchIds.length === 0 || filterBranchIds.includes(e.branchId)); }).reduce((s, e) => s + e.amount, 0);
        yearTotal += val; row.push(val > 0 ? String(val) : '');
      });
      row.push(String(yearTotal)); expFactRows.push(row);
    });
    sections.push({ title: `Расходы — факт (${selectedYear})`, rows: expFactRows });

    // Продажи — абонементы
    const subRows: string[][] = [['Месяц', ...subPlans.map(p => p.name + ' (кол-во)'), ...subPlans.map(p => p.name + ' (сумма)'), 'Итого кол-во', 'Итого сумма']];
    months.forEach((month, i) => {
      const row = [MONTH_NAMES[i]]; let totalCnt = 0, totalSum = 0;
      subPlans.forEach(plan => { const s = state.sales.filter(s => s.type === 'subscription' && s.itemId === plan.id && inM(s.date, month) && bf(s.branchId)); row.push(String(s.length)); totalCnt += s.length; });
      subPlans.forEach(plan => { const sum = state.sales.filter(s => s.type === 'subscription' && s.itemId === plan.id && inM(s.date, month) && bf(s.branchId)).reduce((a, x) => a + x.finalPrice, 0); row.push(String(sum)); totalSum += sum; });
      row.push(String(totalCnt), String(totalSum)); subRows.push(row);
    });
    sections.push({ title: `Продажи — абонементы (${selectedYear})`, rows: subRows });

    // Продажи — доп. продажи
    const addRows: string[][] = [['Месяц', ...addPlans.map(p => p.name + ' (кол-во)'), ...addPlans.map(p => p.name + ' (сумма)'), 'Итого кол-во', 'Итого сумма']];
    months.forEach((month, i) => {
      const row = [MONTH_NAMES[i]]; let totalCnt = 0, totalSum = 0;
      addPlans.forEach(plan => { const s = state.sales.filter(s => s.type === 'single' && s.itemId === plan.id && inM(s.date, month) && bf(s.branchId)); row.push(String(s.length)); totalCnt += s.length; });
      addPlans.forEach(plan => { const sum = state.sales.filter(s => s.type === 'single' && s.itemId === plan.id && inM(s.date, month) && bf(s.branchId)).reduce((a, x) => a + x.finalPrice, 0); row.push(String(sum)); totalSum += sum; });
      row.push(String(totalCnt), String(totalSum)); addRows.push(row);
    });
    if (comments.sales) addRows.push(['Комментарий:', comments.sales]);
    sections.push({ title: `Продажи — доп. продажи (${selectedYear})`, rows: addRows });

    return sections;
  };

  const exportAllExcel = () => {
    const wb = XLSX.utils.book_new();
    buildSections().forEach(({ title, rows }) => {
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const sheetName = title.replace(/[:\\/?*[\]]/g, '').slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });
    XLSX.writeFile(wb, `otchety-${selectedYear}-${branchLabel}.xlsx`);
    setShowExportMenu(false);
  };

  const exportAllPDF = async () => {
    const html2canvas = (await import('html2canvas')).default;
    const sections = buildSections();
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 8;
    const usableW = pageW - margin * 2;
    const usableH = pageH - margin * 2;

    const renderSection = async (section: { title: string; rows: string[][] }) => {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;background:#fff;font-family:Arial,sans-serif;padding:8px;';

      // title
      const titleEl = document.createElement('div');
      titleEl.style.cssText = 'font-weight:bold;font-size:14px;margin-bottom:8px;padding-bottom:4px;border-bottom:2px solid #1a1a1a;color:#1a1a1a;';
      titleEl.textContent = section.title;
      wrapper.appendChild(titleEl);

      // meta line
      const meta = document.createElement('div');
      meta.style.cssText = 'font-size:11px;color:#666;margin-bottom:6px;';
      meta.textContent = `Год: ${selectedYear}  |  Филиалы: ${branchLabel}  |  Дата выгрузки: ${new Date().toLocaleDateString('ru-RU')}`;
      wrapper.appendChild(meta);

      const table = document.createElement('table');
      table.style.cssText = 'border-collapse:collapse;width:100%;font-size:10px;';

      const commentRows: string[][] = [];
      const dataRows: string[][] = [];
      section.rows.forEach(row => {
        if (row[0] === 'Комментарий:') commentRows.push(row);
        else dataRows.push(row);
      });

      dataRows.forEach((row, ri) => {
        const tr = document.createElement('tr');
        const isHeader = ri === 0;
        const isTotalRow = row[0]?.startsWith('Итого');
        tr.style.cssText = `background:${isHeader ? '#1a1a1a' : isTotalRow ? '#e8f4e8' : ri % 2 === 0 ? '#f8f8f8' : '#fff'};`;
        row.forEach((cell, ci) => {
          const td = document.createElement(isHeader ? 'th' : 'td');
          const isNum = !isNaN(Number(cell.replace(/[₽%\s]/g, ''))) && cell !== '' && ci > 0;
          td.style.cssText = [
            'border:1px solid #ddd',
            'padding:4px 6px',
            `text-align:${ci === 0 ? 'left' : 'right'}`,
            `color:${isHeader ? '#fff' : isTotalRow ? '#166534' : '#111'}`,
            `font-weight:${isHeader || isTotalRow ? 'bold' : 'normal'}`,
            'white-space:nowrap',
            `font-size:${isHeader ? '10px' : '9.5px'}`,
          ].join(';');
          // форматируем числа
          if (isNum && !isHeader) {
            const num = Number(cell);
            if (cell.includes('.')) td.textContent = num.toFixed(1);
            else td.textContent = num.toLocaleString('ru-RU');
          } else {
            td.textContent = cell;
          }
          tr.appendChild(td);
        });
        table.appendChild(tr);
      });
      wrapper.appendChild(table);

      // comments
      if (commentRows.length > 0) {
        const commentBox = document.createElement('div');
        commentBox.style.cssText = 'margin-top:10px;padding:8px 12px;background:#fff8e1;border-left:3px solid #f59e0b;font-size:11px;color:#92400e;border-radius:4px;';
        commentBox.innerHTML = `<strong>Комментарий:</strong> ${commentRows.map(r => r[1]).join(' ')}`;
        wrapper.appendChild(commentBox);
      }

      document.body.appendChild(wrapper);
      const canvas = await html2canvas(wrapper, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
      document.body.removeChild(wrapper);
      return canvas;
    };

    let firstPage = true;
    for (const section of sections) {
      const canvas = await renderSection(section);
      const imgRatio = canvas.height / canvas.width;
      const imgW = usableW;
      const imgH = imgRatio * imgW;

      if (imgH <= usableH) {
        // fits on one page
        if (!firstPage) doc.addPage();
        doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, imgW, imgH);
      } else {
        // split across pages
        const scale = usableW / canvas.width;
        const rowH = usableH / scale;
        let offsetPx = 0;
        while (offsetPx < canvas.height) {
          if (!firstPage) doc.addPage();
          const sliceH = Math.min(rowH, canvas.height - offsetPx);
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = sliceH;
          const sCtx = sliceCanvas.getContext('2d')!;
          sCtx.drawImage(canvas, 0, -offsetPx);
          const sliceImgH = sliceH * scale;
          doc.addImage(sliceCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, imgW, sliceImgH);
          offsetPx += sliceH;
          firstPage = false;
        }
        continue;
      }
      firstPage = false;
    }

    doc.save(`otchety-${selectedYear}-${branchLabel}.pdf`);
    setShowExportMenu(false);
  };

  return (
    <div className="space-y-6">
      {/* Фильтры */}
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
        <div className="ml-auto relative">
          <button
            onClick={() => setShowExportMenu(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 bg-foreground text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Icon name="Download" size={14} /> Выгрузить всё <Icon name="ChevronDown" size={13} />
          </button>
          {showExportMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-border rounded-xl shadow-lg overflow-hidden min-w-[160px]">
                <button
                  onClick={exportAllExcel}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-secondary transition-colors text-left"
                >
                  <Icon name="FileSpreadsheet" size={15} className="text-green-600" /> Excel (.xlsx)
                </button>
                <button
                  onClick={exportAllPDF}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-secondary transition-colors text-left border-t border-border"
                >
                  <Icon name="FileText" size={15} className="text-red-500" /> PDF
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Навигация по отчётам */}
      <div className="flex flex-wrap gap-2">
        {REPORT_NAV.map(nav => (
          <button
            key={nav.id}
            onClick={() => setActiveSection(nav.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${
              activeSection === nav.id
                ? 'bg-foreground text-primary-foreground border-foreground'
                : 'bg-white text-foreground border-border hover:bg-secondary'
            }`}
          >
            <Icon name={nav.icon} size={13} />
            {nav.label}
          </button>
        ))}
      </div>

      {/* РАЗДЕЛ: ПЛАН / ФАКТ */}
      {activeSection === 'planfact' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded bg-blue-100 border border-blue-300" />
              <span className="text-blue-700 font-medium">П</span> — план
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded bg-emerald-100 border border-emerald-300" />
              <span className="text-emerald-700 font-medium">Ф</span> — факт
            </span>
            <span className="text-muted-foreground/70">Под фактом — % отклонения от плана</span>
          </div>

          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-border bg-secondary/60">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground sticky left-0 bg-secondary/60 min-w-[200px] z-10">Показатель</th>
                    {months.map((month, i) => (
                      <th key={month} className="px-0 py-0 text-center border-l border-border/40 min-w-[110px]">
                        <div className="px-2 py-2 font-semibold">{MONTH_NAMES_SHORT[i]}</div>
                        <div className="grid grid-cols-2 border-t border-border/30 text-[10px]">
                          <div className="py-1 text-blue-600 font-semibold border-r border-border/30 bg-blue-50/60">П</div>
                          <div className="py-1 text-emerald-600 font-semibold bg-emerald-50/60">Ф</div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COLUMNS.map((col, ri) => {
                    const rowBg = ri % 2 === 0 ? 'bg-white' : 'bg-secondary/20';
                    const stickyBg = ri % 2 === 0 ? 'white' : 'rgb(248 248 248)';
                    return (
                      <tr key={col.key} className={`border-b border-border/40 ${rowBg}`}>
                        <td className="px-4 py-2 font-medium sticky left-0 z-10 text-xs whitespace-nowrap" style={{ background: stickyBg }}>
                          {col.label}
                        </td>
                        {months.map(month => {
                          const planVal = plansMap[month]?.[col.key] as number | undefined;
                          const factVal = factsMap[month]?.[col.key] as number;
                          const d = diff(factVal, planVal);
                          return (
                            <td key={month} className="px-0 py-0 border-l border-border/20">
                              <div className="grid grid-cols-2">
                                <div className="px-1.5 py-2 text-center text-blue-700 font-medium tabular-nums border-r border-border/20 bg-blue-50/20">
                                  {planVal !== undefined && planVal !== 0 ? fmt(planVal, col.format) : <span className="text-muted-foreground/30">—</span>}
                                </div>
                                <div className="px-1.5 py-1.5 text-center bg-emerald-50/20">
                                  <div className="text-emerald-700 font-medium tabular-nums">{factVal !== 0 ? fmt(factVal, col.format) : <span className="text-muted-foreground/30">—</span>}</div>
                                  {d !== null && d.val !== 0 && (
                                    <div className={`text-[10px] leading-tight ${d.val >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                      {d.val >= 0 ? '+' : ''}{d.pct.toFixed(0)}%
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <CommentBox value={comments.planfact} onChange={v => setComments(c => ({ ...c, planfact: v }))} />
        </div>
      )}

      {/* РАЗДЕЛ: РАСХОДЫ */}
      {activeSection === 'expenses' && (
        <div className="space-y-4">
          <ExpensesReport state={state} months={months} filterBranchIds={filterBranchIds}
            onExportPlan={() => exportExpenses('plan')} onExportFact={() => exportExpenses('fact')} />
          <CommentBox value={comments.expenses} onChange={v => setComments(c => ({ ...c, expenses: v }))} />
        </div>
      )}

      {/* РАЗДЕЛ: ПРОДАЖИ (4 таблицы) */}
      {activeSection === 'sales' && (
        <div className="space-y-6">
          <SalesReport
            state={state}
            months={months}
            filterBranchIds={filterBranchIds}
            onExport={exportSales}
          />
          <CommentBox value={comments.sales} onChange={v => setComments(c => ({ ...c, sales: v }))} />
        </div>
      )}
    </div>
  );
}

function CommentBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="bg-white border border-border rounded-xl p-4">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-2">Комментарий к отчёту</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Добавьте заметки, выводы или пояснения к данному разделу..."
        rows={3}
        className="w-full text-sm border border-input rounded-lg px-3 py-2 resize-none outline-none focus:ring-1 focus:ring-ring"
      />
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
  // Типы тренировок с доплатой (мини-группы, фан-группы и т.п.)
  const extraItems = useMemo(() => state.trainingTypes.filter(tt =>
    tt.extraPrice && tt.extraPrice > 0 && (filterBranchIds.length === 0 || tt.branchIds.some(b => filterBranchIds.includes(b)))
  ), [state.trainingTypes, filterBranchIds]);

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
    // Факт по доплатам: sales.type === 'extra', матчим по extraPriceName
    extraItems.forEach(tt => {
      map[tt.id] = {};
      months.forEach(month => {
        const sales = state.sales.filter(s =>
          s.type === 'extra' &&
          s.itemName === (tt.extraPriceName || tt.name) &&
          inM(s.date, month) && bf(s.branchId)
        );
        map[tt.id][month] = { count: sales.length, sum: sales.reduce((a, s) => a + s.finalPrice, 0) };
      });
    });
    return map;
  }, [subItems, addItems, extraItems, months, state.sales, filterBranchIds]);

  const planData = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    [...subItems, ...addItems, ...extraItems].forEach(item => { map[item.id] = {}; });
    months.forEach(month => {
      const plansForMonth = state.salesPlans.filter(p => p.month === month && (filterBranchIds.length === 0 || filterBranchIds.includes(p.branchId)));
      plansForMonth.forEach(plan => {
        plan.items.forEach(pi => { if (map[pi.planId] !== undefined) map[pi.planId][month] = (map[pi.planId][month] ?? 0) + pi.target; });
      });
    });
    return map;
  }, [subItems, addItems, extraItems, months, state.salesPlans, filterBranchIds]);

  const renderPlanTable = (title: string, items: { id: string; name: string }[]) => {
    if (items.length === 0) return <p className="text-sm text-muted-foreground">Нет позиций для выбранных филиалов.</p>;
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onExport} className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border rounded-lg text-xs text-muted-foreground hover:bg-secondary transition-colors">
            <Icon name="Download" size={12} /> CSV
          </button>
        </div>
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-blue-50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground sticky left-0 bg-blue-50 min-w-[160px] z-10">Позиция</th>
                  {months.map((_, i) => <th key={i} className="px-3 py-3 font-medium text-center whitespace-nowrap min-w-[80px]">{MONTH_NAMES[i]}</th>)}
                  <th className="px-3 py-3 font-medium text-center whitespace-nowrap min-w-[80px]">Итого год</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, ri) => {
                  const yearPlan = months.reduce((s, m) => s + (planData[item.id]?.[m] ?? 0), 0);
                  return (
                    <tr key={item.id} className={`border-b border-border/50 ${ri % 2 === 0 ? 'bg-white' : 'bg-secondary/20'}`}>
                      <td className="px-4 py-2 font-medium sticky left-0 z-10 whitespace-nowrap" style={{ background: ri % 2 === 0 ? 'white' : 'rgb(248 248 248)' }}>{item.name}</td>
                      {months.map(month => {
                        const plan = planData[item.id]?.[month];
                        return (
                          <td key={month} className="px-2 py-2 text-center text-blue-700 font-medium">
                            {plan !== undefined && plan > 0 ? plan : '—'}
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-center text-blue-900 font-semibold">{yearPlan > 0 ? yearPlan : '—'}</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-border bg-blue-50 font-semibold">
                  <td className="px-4 py-2 sticky left-0 z-10 text-blue-900" style={{ background: 'rgb(239 246 255)' }}>Итого шт.</td>
                  {months.map(month => {
                    const total = items.reduce((s, item) => s + (planData[item.id]?.[month] ?? 0), 0);
                    return <td key={month} className="px-2 py-2 text-center text-blue-900">{total > 0 ? total : '—'}</td>;
                  })}
                  <td className="px-2 py-2 text-center text-blue-900">{months.reduce((s, m) => s + items.reduce((ss, it) => ss + (planData[it.id]?.[m] ?? 0), 0), 0) || '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderFactTable = (title: string, items: { id: string; name: string }[]) => {
    if (items.length === 0) return <p className="text-sm text-muted-foreground">Нет позиций для выбранных филиалов.</p>;
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onExport} className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border rounded-lg text-xs text-muted-foreground hover:bg-secondary transition-colors">
            <Icon name="Download" size={12} /> CSV
          </button>
        </div>
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground sticky left-0 bg-secondary/50 min-w-[160px] z-10">Позиция</th>
                  {months.map((_, i) => <th key={i} className="px-3 py-3 font-medium text-center whitespace-nowrap min-w-[90px]">{MONTH_NAMES[i]}</th>)}
                </tr>
              </thead>
              <tbody>
                {items.map((item, ri) => {
                  const yearCount = months.reduce((s, m) => s + (factData[item.id]?.[m]?.count ?? 0), 0);
                  const yearSum = months.reduce((s, m) => s + (factData[item.id]?.[m]?.sum ?? 0), 0);
                  return (
                    <tr key={item.id} className={`border-b border-border/50 ${ri % 2 === 0 ? 'bg-white' : 'bg-secondary/20'}`}>
                      <td className="px-4 py-1.5 font-medium sticky left-0 z-10 whitespace-nowrap" style={{ background: ri % 2 === 0 ? 'white' : 'rgb(248 248 248)' }}>
                        <div>{item.name}</div>
                        {yearCount > 0 && (
                          <div className="text-[10px] text-muted-foreground font-normal">за год: {yearCount} шт · {yearSum.toLocaleString('ru-RU')} ₽</div>
                        )}
                      </td>
                      {months.map(month => {
                        const f = factData[item.id]?.[month] ?? { count: 0, sum: 0 };
                        const plan = planData[item.id]?.[month];
                        const pct = plan && plan > 0 ? ((f.count - plan) / plan) * 100 : null;
                        return (
                          <td key={month} className="px-2 py-1.5 text-center">
                            <div className="font-medium">{f.count > 0 ? f.count : '—'}</div>
                            {plan !== undefined && plan > 0 && <div className="text-[10px] text-blue-600">пл: {plan}</div>}
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
                <tr className="border-t border-border/30 bg-secondary/20 text-muted-foreground italic">
                  <td className="px-4 py-2 sticky left-0 z-10 whitespace-nowrap text-xs" style={{ background: 'rgb(250 250 250)' }}>Ср. чек</td>
                  {months.map(month => {
                    const totalCount = items.reduce((s, item) => s + (factData[item.id]?.[month]?.count ?? 0), 0);
                    const totalSum = items.reduce((s, item) => s + (factData[item.id]?.[month]?.sum ?? 0), 0);
                    const avg = totalCount > 0 ? Math.round(totalSum / totalCount) : 0;
                    return <td key={month} className="px-2 py-2 text-center text-xs">{avg > 0 ? avg.toLocaleString('ru-RU') + ' ₽' : '—'}</td>;
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
    <div className="space-y-8">
      {renderPlanTable('Абонементы — план', subItems)}
      {renderFactTable('Абонементы — факт', subItems)}
      {renderPlanTable('Доп. продажи — план', addItems)}
      {renderFactTable('Доп. продажи — факт', addItems)}
      {extraItems.length > 0 && renderPlanTable('Доплаты (мини/фан-группы) — план', extraItems)}
      {extraItems.length > 0 && renderFactTable('Доплаты (мини/фан-группы) — факт', extraItems)}
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
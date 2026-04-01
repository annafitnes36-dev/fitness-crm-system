import { useState, useEffect, Fragment } from 'react';
import { StoreType, TrainingCategory, Hall, Trainer, TrainingType, SubscriptionPlan, SingleVisitPlan, ExpenseCategory, MonthlyPlanRow, NotificationCategory, DEFAULT_NOTIFICATION_CATEGORIES } from '@/store';
import type { ExpensePlan } from '@/store';
import Icon from '@/components/ui/icon';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface SettingsProps {
  store: StoreType;
}

type Tab = 'trainings' | 'training-cats' | 'trainers' | 'halls' | 'plans' | 'single' | 'sources' | 'expense-cats' | 'expense-plan' | 'sales-plan' | 'planning' | 'notifications' | 'project' | 'bonus';

const COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6',
  '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16',
  '#a8e6cf', '#d4b8e0', '#f4c2c2', '#fff0a0', '#b7f5b8',
];

const COLOR_LABELS: Record<string, string> = {
  '#a8e6cf': 'Фисташковый',
  '#d4b8e0': 'Лавандовый',
  '#f4c2c2': 'Розово-пудровый',
  '#fff0a0': 'Пастельно-жёлтый',
  '#b7f5b8': 'Светло-зелёный',
};

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {COLORS.map(c => (
        <button key={c} title={COLOR_LABELS[c]} onClick={() => onChange(c)}
          className={`w-7 h-7 rounded-full border-2 transition-transform ${value === c ? 'scale-125 border-foreground' : 'border-transparent hover:scale-110'}`}
          style={{ background: c, boxShadow: value === c ? '0 0 0 2px white inset' : undefined }}
        />
      ))}
    </div>
  );
}


const MONTH_NAMES_SHORT = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

type SalesPlanItem = { planId: string; target: number };

interface SalesPlanTabProps {
  state: StoreType['state'];
  setSalesPlan: (branchId: string, month: string, items: SalesPlanItem[]) => void;
}

function SalesPlanTab({ state, setSalesPlan }: SalesPlanTabProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedBranchId, setSelectedBranchId] = useState(state.currentBranchId);
  const [savedVersion, setSavedVersion] = useState(0);

  const months = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return `${selectedYear}-${String(m).padStart(2, '0')}`;
  });

  const subPlans = state.subscriptionPlans;
  const addPlans = state.singleVisitPlans;
  // Типы тренировок с доплатой (мини-группы, фан-группы и т.п.) для данного филиала
  const extraItems = state.trainingTypes.filter(tt => tt.extraPrice && tt.extraPrice > 0 && tt.branchIds.includes(selectedBranchId));
  const allItems = [
    ...subPlans.map(p => ({ ...p, kind: 'sub' as const })),
    ...addPlans.map(p => ({ ...p, kind: 'add' as const })),
    ...extraItems.map(tt => ({ ...tt, kind: 'extra' as const })),
  ];

  type ValMap = Record<string, Record<string, string>>;
  const [values, setValues] = useState<ValMap>({});

  // Загружаем данные только при смене года/филиала или после явного сохранения (savedVersion)
  useEffect(() => {
    const initial: ValMap = {};
    months.forEach(month => {
      initial[month] = {};
      const plan = state.salesPlans.find(p => p.branchId === selectedBranchId && p.month === month);
      allItems.forEach(item => {
        const found = plan?.items.find(i => i.planId === item.id);
        initial[month][item.id] = found ? String(found.target) : '';
      });
    });
    setValues(initial);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedBranchId, savedVersion]);

  const handleChange = (month: string, itemId: string, val: string) => {
    setValues(prev => ({ ...prev, [month]: { ...(prev[month] || {}), [itemId]: val } }));
  };

  const handleSaveAll = () => {
    months.forEach(month => {
      const items: SalesPlanItem[] = [];
      allItems.forEach(item => {
        const v = values[month]?.[item.id];
        if (v !== undefined && v !== '') {
          items.push({ planId: item.id, target: parseInt(v) || 0 });
        }
      });
      // Сохраняем план для всех месяцев (даже если items пустой — это значит план обнулён)
      setSalesPlan(selectedBranchId, month, items);
    });
    setSavedVersion(v => v + 1);
  };

  const years = [currentYear - 1, currentYear, currentYear + 1];

  // Для получения цены позиции по id
  const getPlanPrice = (itemId: string) => {
    const sp = state.subscriptionPlans.find(p => p.id === itemId);
    if (sp) return sp.price;
    const svp = state.singleVisitPlans.find(p => p.id === itemId);
    if (svp) return svp.price;
    const tt = state.trainingTypes.find(t => t.id === itemId);
    return tt?.extraPrice ?? 0;
  };

  const renderSection = (title: string, items: typeof allItems, showSum = false) => (
    <div>
      <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground mb-4">Нет позиций для этого филиала.</p>
      ) : (
        <div className="bg-white border border-border rounded-xl overflow-hidden mb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground sticky left-0 bg-secondary/50 min-w-[160px] z-10">Позиция</th>
                  {months.map((_, i) => (
                    <th key={i} className="px-3 py-3 font-medium text-center whitespace-nowrap min-w-[70px]">{MONTH_NAMES_SHORT[i]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, ri) => (
                  <tr key={item.id} className={`border-b border-border/50 ${ri % 2 === 0 ? 'bg-white' : 'bg-secondary/20'}`}>
                    <td className="px-4 py-2 font-medium sticky left-0 z-10 whitespace-nowrap text-xs"
                      style={{ background: ri % 2 === 0 ? 'white' : 'rgb(248 248 248)' }}>
                      {item.name}
                    </td>
                    {months.map((month) => (
                      <td key={month} className="px-1.5 py-1.5">
                        <Input
                          type="number" min={0} placeholder="0"
                          value={values[month]?.[item.id] ?? ''}
                          onChange={e => handleChange(month, item.id, e.target.value)}
                          className="text-center text-xs h-7 px-1"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
                {/* Итого */}
                <tr className="border-t-2 border-border bg-secondary/50 font-semibold">
                  <td className="px-4 py-2 sticky left-0 z-10 whitespace-nowrap text-muted-foreground text-xs" style={{ background: 'rgb(243 244 246)' }}>
                    {showSum ? 'Итого, ₽' : 'Итого, шт.'}
                  </td>
                  {months.map(month => {
                    if (showSum) {
                      const totalSum = items.reduce((sum, item) => {
                        const qty = parseInt(values[month]?.[item.id] ?? '0') || 0;
                        return sum + qty * getPlanPrice(item.id);
                      }, 0);
                      return (
                        <td key={month} className="px-2 py-2 text-center text-xs font-semibold">
                          {totalSum > 0 ? `${totalSum.toLocaleString()} ₽` : '—'}
                        </td>
                      );
                    }
                    const total = items.reduce((sum, item) => sum + (parseInt(values[month]?.[item.id] ?? '0') || 0), 0);
                    return (
                      <td key={month} className="px-2 py-2 text-center text-xs font-semibold">
                        {total > 0 ? total : '—'}
                      </td>
                    );
                  })}
                </tr>
                {/* Средний чек — только для абонементов */}
                {!showSum && (
                <tr className="border-t border-border/30 bg-secondary/20 text-muted-foreground text-xs">
                  <td className="px-4 py-2 sticky left-0 z-10 whitespace-nowrap" style={{ background: 'rgb(250 250 250)' }}>Средний чек</td>
                  {months.map(month => {
                    const totalQty = items.reduce((sum, item) => sum + (parseInt(values[month]?.[item.id] ?? '0') || 0), 0);
                    const totalRev = items.reduce((sum, item) => {
                      const qty = parseInt(values[month]?.[item.id] ?? '0') || 0;
                      return sum + qty * getPlanPrice(item.id);
                    }, 0);
                    const avg = totalQty > 0 ? Math.round(totalRev / totalQty) : 0;
                    return (
                      <td key={month} className="px-2 py-2 text-center">
                        {avg > 0 ? `${avg.toLocaleString()} ₽` : '—'}
                      </td>
                    );
                  })}
                </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Год</label>
          <select className="border border-input rounded-lg px-3 py-2 text-sm" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Филиал</label>
          <select className="border border-input rounded-lg px-3 py-2 text-sm" value={selectedBranchId} onChange={e => setSelectedBranchId(e.target.value)}>
            {state.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <Button onClick={handleSaveAll} className="bg-foreground text-primary-foreground hover:opacity-90">Сохранить всё</Button>
      </div>
      <p className="text-xs text-muted-foreground">Вводите плановое количество продаж по каждой позиции на каждый месяц.</p>
      {renderSection('Абонементы', subPlans.map(p => ({ ...p, kind: 'sub' as const })))}
      {renderSection('Доп. продажи', addPlans.map(p => ({ ...p, kind: 'add' as const })), true)}
      {renderSection('Доплаты (мини-группы, фан-группы)', extraItems.map(tt => ({ ...tt, kind: 'extra' as const })), true)}
    </div>
  );
}

interface ExpensePlanTabProps {
  state: StoreType['state'];
  setExpensePlan: (branchId: string, month: string, categoryId: string, planAmount: number) => void;
}

function ExpensePlanTab({ state, setExpensePlan }: ExpensePlanTabProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedBranchId, setSelectedBranchId] = useState(state.currentBranchId);

  const months = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return `${selectedYear}-${String(m).padStart(2, '0')}`;
  });

  const branchCats = state.expenseCategories.filter(c => c.branchId === selectedBranchId);

  type ValMap = Record<string, Record<string, string>>;
  const [values, setValues] = useState<ValMap>({});

  useEffect(() => {
    const initial: ValMap = {};
    months.forEach(month => {
      initial[month] = {};
      branchCats.forEach(cat => {
        const found = state.expensePlans.find(
          (ep: ExpensePlan) => ep.branchId === selectedBranchId && ep.month === month && ep.categoryId === cat.id
        );
        initial[month][cat.id] = found ? String(found.planAmount) : '';
      });
    });
    setValues(initial);
  }, [selectedYear, selectedBranchId, state.expensePlans, state.expenseCategories]);

  const handleChange = (month: string, catId: string, val: string) => {
    setValues(prev => ({ ...prev, [month]: { ...(prev[month] || {}), [catId]: val } }));
  };

  const handleSaveAll = () => {
    months.forEach(month => {
      branchCats.forEach(cat => {
        const v = values[month]?.[cat.id];
        if (v !== undefined && v !== '') {
          setExpensePlan(selectedBranchId, month, cat.id, parseFloat(v) || 0);
        }
      });
    });
  };

  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Год</label>
          <select className="border border-input rounded-lg px-3 py-2 text-sm" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Филиал</label>
          <select className="border border-input rounded-lg px-3 py-2 text-sm" value={selectedBranchId} onChange={e => setSelectedBranchId(e.target.value)}>
            {state.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <Button onClick={handleSaveAll} className="bg-foreground text-primary-foreground hover:opacity-90">Сохранить всё</Button>
      </div>

      {branchCats.length === 0 ? (
        <p className="text-sm text-muted-foreground">Нет категорий расходов для этого филиала. Добавьте их во вкладке «Расходы».</p>
      ) : (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground sticky left-0 bg-secondary/50 min-w-[160px] z-10">Категория</th>
                  {months.map((_, i) => (
                    <th key={i} className="px-3 py-3 font-medium text-center whitespace-nowrap min-w-[70px]">{MONTH_NAMES_SHORT[i]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {branchCats.map((cat, ri) => (
                  <tr key={cat.id} className={`border-b border-border/50 ${ri % 2 === 0 ? 'bg-white' : 'bg-secondary/20'}`}>
                    <td className="px-4 py-2 font-medium sticky left-0 z-10 whitespace-nowrap text-xs"
                      style={{ background: ri % 2 === 0 ? 'white' : 'rgb(248 248 248)' }}>
                      {cat.name}
                    </td>
                    {months.map(month => (
                      <td key={month} className="px-1.5 py-1.5">
                        <Input
                          type="number"
                          min={0}
                          placeholder="0"
                          value={values[month]?.[cat.id] ?? ''}
                          onChange={e => handleChange(month, cat.id, e.target.value)}
                          className="text-center text-xs h-7 px-1"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t-2 border-border bg-secondary/50 font-semibold">
                  <td className="px-4 py-2 sticky left-0 z-10 whitespace-nowrap text-muted-foreground text-xs" style={{ background: 'rgb(243 244 246)' }}>Итого, ₽</td>
                  {months.map(month => {
                    const total = branchCats.reduce((sum, cat) => sum + (parseFloat(values[month]?.[cat.id] ?? '0') || 0), 0);
                    return (
                      <td key={month} className="px-2 py-2 text-center text-xs font-semibold">
                        {total > 0 ? total.toLocaleString() : '—'}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// Ручные поля плана (вводятся вручную, не вычисляются)
const PLAN_MANUAL_KEYS = new Set<keyof MonthlyPlanRow>([
  'convInquiryToEnroll', 'convEnrollToAttend', 'convAttendToSale',
  'totalSubscriptionSales', 'convRenewal', 'returns',
]);

// Строки таблицы планирования
type PlanRow = { key: keyof MonthlyPlanRow; label: string; isPercent?: boolean; isCurrency?: boolean; divider?: boolean };
const PLANNING_ROWS: PlanRow[] = [
  { key: 'revenue',               label: 'Выручка, ₽',                    isCurrency: true },
  { key: 'expenses',              label: 'Расходы, ₽',                    isCurrency: true },
  { key: 'profit',                label: 'Прибыль, ₽',                    isCurrency: true },
  { key: 'profitability',         label: 'Рентабельность, %',             isPercent: true, divider: true },
  { key: 'subscriptionSales',     label: 'Сумма абонементов, ₽',          isCurrency: true },
  { key: 'additionalSales',       label: 'Доп. продажи, ₽',               isCurrency: true },
  { key: 'avgCheck',              label: 'Средний чек, ₽',                isCurrency: true, divider: true },
  { key: 'totalSubscriptionSales',label: 'Всего продаж абон.' },
  { key: 'renewalPotential',      label: 'Потенциал продлений' },
  { key: 'convRenewal',           label: 'Конв. продления, %',            isPercent: true },
  { key: 'renewals',              label: 'Продлений' },
  { key: 'returns',               label: 'Возвращений' },
  { key: 'newbieSales',           label: 'Продаж новичкам',               divider: true },
  { key: 'convAttendToSale',      label: 'Конв. приход→продажа, %',       isPercent: true },
  { key: 'newbieAttended',        label: 'Дошло новичков' },
  { key: 'convEnrollToAttend',    label: 'Конв. запись→доходимость, %',   isPercent: true },
  { key: 'newbieEnrollments',     label: 'Записей новичков' },
  { key: 'convInquiryToEnroll',   label: 'Конв. обращение→запись, %',     isPercent: true },
  { key: 'inquiries',             label: 'Обращений' },
];

interface PlanningTabProps {
  state: StoreType['state'];
  setMonthlyPlan: (branchId: string, month: string, plan: Partial<MonthlyPlanRow>) => void;
}

function PlanningTab({ state, setMonthlyPlan }: PlanningTabProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedBranchId, setSelectedBranchId] = useState(state.currentBranchId);

  const months = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return `${selectedYear}-${String(m).padStart(2, '0')}`;
  });

  type ManualValues = Record<string, Partial<Record<keyof MonthlyPlanRow, string>>>;
  const [manual, setManual] = useState<ManualValues>({});

  useEffect(() => {
    const init: ManualValues = {};
    months.forEach(month => {
      const saved = state.monthlyPlans.find(p => p.branchId === selectedBranchId && p.month === month);
      const row: Partial<Record<keyof MonthlyPlanRow, string>> = {};
      PLAN_MANUAL_KEYS.forEach(key => {
        const v = saved?.plan?.[key];
        row[key] = v !== undefined ? String(v) : '';
      });
      init[month] = row;
    });
    setManual(init);
  }, [selectedYear, selectedBranchId, state.monthlyPlans]);

  const handleChange = (month: string, key: keyof MonthlyPlanRow, val: string) => {
    setManual(prev => ({ ...prev, [month]: { ...prev[month], [key]: val } }));
  };

  // ── Источники данных ───────────────────────────────────────────────
  const subPlans  = state.subscriptionPlans.filter(p => p.branchId === selectedBranchId);
  const addPlans  = state.singleVisitPlans.filter(p => p.branchId === selectedBranchId);
  const extraItems = state.trainingTypes.filter(tt => tt.extraPrice && tt.extraPrice > 0 && tt.branchIds.includes(selectedBranchId));
  const branchCats = state.expenseCategories.filter(c => c.branchId === selectedBranchId);

  // ── Вычисление плановых значений для месяца ────────────────────────
  const compute = (month: string): Record<keyof MonthlyPlanRow, number> => {
    const sp = state.salesPlans.find(p => p.branchId === selectedBranchId && p.month === month);

    const subRevenue = subPlans.reduce((s, p) => s + (sp?.items.find(i => i.planId === p.id)?.target ?? 0) * p.price, 0);
    const subQty     = subPlans.reduce((s, p) => s + (sp?.items.find(i => i.planId === p.id)?.target ?? 0), 0);
    const addRevenue = addPlans.reduce((s, p) => s + (sp?.items.find(i => i.planId === p.id)?.target ?? 0) * p.price, 0);
    const extraRev   = extraItems.reduce((s, tt) => s + (sp?.items.find(i => i.planId === tt.id)?.target ?? 0) * (tt.extraPrice ?? 0), 0);

    const revenue          = subRevenue + addRevenue + extraRev;
    const subscriptionSales = subRevenue;
    const additionalSales  = addRevenue + extraRev;
    const avgCheck         = subQty > 0 ? Math.round(subRevenue / subQty) : 0;

    const expenses = branchCats.reduce((s, cat) => {
      const ep = state.expensePlans.find((p: ExpensePlan) => p.branchId === selectedBranchId && p.month === month && p.categoryId === cat.id);
      return s + (ep?.planAmount ?? 0);
    }, 0);

    const profit       = revenue - expenses;
    const profitability = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

    // Ручные
    const m = manual[month] || {};
    const convInquiryToEnroll  = parseFloat(m.convInquiryToEnroll  ?? '0') || 0;
    const convEnrollToAttend   = parseFloat(m.convEnrollToAttend   ?? '0') || 0;
    const convAttendToSale     = parseFloat(m.convAttendToSale     ?? '0') || 0;
    const convRenewal          = parseFloat(m.convRenewal          ?? '0') || 0;
    const totalSubscriptionSales = parseFloat(m.totalSubscriptionSales ?? '0') || 0;
    const returns              = parseFloat(m.returns              ?? '0') || 0;

    // Потенциал продлений — абонементы, которые должны закончиться в этом месяце
    const monthStart = `${month}-01`;
    const mm = parseInt(month.slice(5, 7));
    const yy = parseInt(month.slice(0, 4));
    const nextY = mm === 12 ? yy + 1 : yy;
    const nextM = mm === 12 ? 1 : mm + 1;
    const monthEnd = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
    const renewalPotential = state.subscriptions.filter(sub =>
      sub.branchId === selectedBranchId &&
      sub.endDate >= monthStart && sub.endDate < monthEnd
    ).length;

    const renewals         = convRenewal > 0 ? Math.round(renewalPotential * convRenewal / 100) : 0;
    const newbieSales      = Math.max(0, totalSubscriptionSales - renewals - returns);
    const newbieAttended   = convAttendToSale > 0 ? Math.round(newbieSales / (convAttendToSale / 100)) : 0;
    const newbieEnrollments = convEnrollToAttend > 0 ? Math.round(newbieAttended / (convEnrollToAttend / 100)) : 0;
    const inquiries        = convInquiryToEnroll > 0 ? Math.round(newbieEnrollments / (convInquiryToEnroll / 100)) : 0;

    return {
      revenue, expenses, profit, profitability,
      subscriptionSales, additionalSales, avgCheck,
      totalSubscriptionSales, renewalPotential, convRenewal, renewals, returns,
      newbieSales, convAttendToSale, newbieAttended,
      convEnrollToAttend, newbieEnrollments, convInquiryToEnroll, inquiries,
    };
  };

  const handleSaveAll = () => {
    months.forEach(month => {
      const computed = compute(month);
      const plan: Partial<MonthlyPlanRow> = { ...computed };
      PLAN_MANUAL_KEYS.forEach(key => {
        const v = manual[month]?.[key];
        (plan as Record<string, number>)[key] = v !== undefined && v !== '' ? parseFloat(v) || 0 : 0;
      });
      setMonthlyPlan(selectedBranchId, month, plan);
    });
  };

  const fmt = (row: PlanRow, v: number) => {
    if (v === 0) return <span className="text-muted-foreground/35">—</span>;
    if (row.isPercent) return `${v}%`;
    if (row.isCurrency) return v.toLocaleString();
    return String(v);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Год</label>
          <select className="border border-input rounded-lg px-3 py-2 text-sm" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
            {[currentYear - 1, currentYear, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Филиал</label>
          <select className="border border-input rounded-lg px-3 py-2 text-sm" value={selectedBranchId} onChange={e => setSelectedBranchId(e.target.value)}>
            {state.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <Button onClick={handleSaveAll} className="bg-foreground text-primary-foreground hover:opacity-90">
          <Icon name="Save" size={14} className="mr-1.5" />
          Сохранить всё
        </Button>
      </div>

      <div className="flex items-center gap-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs">
        <span className="flex items-center gap-2 font-medium text-amber-800">
          <span className="inline-block w-4 h-4 rounded bg-amber-200 border-2 border-amber-400" />
          Ячейки с оранжевой рамкой — вводятся вручную
        </span>
        <span className="flex items-center gap-2 text-muted-foreground">
          <span className="inline-block w-4 h-4 rounded bg-white border border-border" />
          Белые — рассчитываются автоматически
        </span>
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-border bg-secondary/60">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground sticky left-0 bg-secondary/60 min-w-[100px] z-10">
                  Месяц
                </th>
                {PLANNING_ROWS.map(row => {
                  const isManual = PLAN_MANUAL_KEYS.has(row.key);
                  return (
                    <th key={row.key} className={`px-2 py-3 font-medium text-center w-[110px] min-w-[110px] max-w-[110px] border-l leading-tight ${isManual ? 'border-amber-200 bg-amber-50/60 text-amber-800' : 'border-border/40'}`}>
                      {isManual && <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 mr-1 mb-0.5" />}
                      {row.label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {months.map((month, i) => (
                <tr key={month} className={`border-b border-border/40 ${i % 2 === 0 ? 'bg-white' : 'bg-secondary/20'}`}>
                  <td
                    className="px-4 py-2 font-semibold sticky left-0 z-10 text-xs whitespace-nowrap"
                    style={{ background: i % 2 === 0 ? 'white' : 'rgb(248 248 248)' }}
                  >
                    {MONTH_NAMES_SHORT[i]}
                  </td>
                  {PLANNING_ROWS.map(row => {
                    const isManual = PLAN_MANUAL_KEYS.has(row.key);
                    const vals = compute(month);
                    const computedVal = vals[row.key] ?? 0;
                    const manualVal = manual[month]?.[row.key] ?? '';

                    if (isManual) {
                      return (
                        <td key={row.key} className="px-1.5 py-1 border-l border-amber-200 bg-amber-50/40">
                          <input
                            type="number"
                            min={0}
                            className="w-full bg-white border border-amber-300 rounded text-center text-xs font-medium text-amber-900 focus:outline-none focus:border-amber-400 focus:bg-amber-50 py-1 placeholder:text-amber-200"
                            value={manualVal}
                            onChange={e => handleChange(month, row.key, e.target.value)}
                            placeholder="—"
                          />
                        </td>
                      );
                    }

                    return (
                      <td key={row.key} className="px-2 py-2 text-center border-l border-border/20 font-medium tabular-nums">
                        {fmt(row, computedVal)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* Итого за год */}
              <tr className="border-t-2 border-border bg-secondary/60 font-semibold">
                <td className="px-4 py-2 sticky left-0 z-10 whitespace-nowrap text-xs" style={{ background: 'rgb(243 244 246)' }}>
                  Итого / среднее
                </td>
                {PLANNING_ROWS.map(row => {
                  const isManual = PLAN_MANUAL_KEYS.has(row.key);
                  if (isManual) {
                    const vals = months.map(m => parseFloat(manual[m]?.[row.key] ?? '0') || 0).filter(v => v > 0);
                    const total = row.isPercent
                      ? (vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0)
                      : vals.reduce((a, b) => a + b, 0);
                    return (
                      <td key={row.key} className="px-2 py-2 text-center border-l border-amber-200 tabular-nums bg-amber-50/30">
                        {total > 0 ? (row.isPercent ? `${total}%` : total) : <span className="text-muted-foreground/30">—</span>}
                      </td>
                    );
                  }
                  const vals = months.map(m => compute(m)[row.key] ?? 0).filter(v => v > 0);
                  const total = row.isPercent || row.key === 'avgCheck'
                    ? (vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0)
                    : vals.reduce((a, b) => a + b, 0);
                  return (
                    <td key={row.key} className="px-2 py-2 text-center border-l border-border/20 tabular-nums">
                      {fmt(row, total)}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-border flex justify-between items-center bg-secondary/20">
          <span className="text-xs text-muted-foreground">Ячейки с оранжевой рамкой вводятся вручную — остальные считаются из плана продаж и плана расходов</span>
          <Button onClick={handleSaveAll} size="sm" className="bg-foreground text-primary-foreground hover:opacity-90">
            <Icon name="Save" size={13} className="mr-1" />
            Сохранить
          </Button>
        </div>
      </div>
    </div>
  );
}

const NOTIF_ICONS = ['Bell', 'Cake', 'CalendarX', 'AlertCircle', 'ShoppingBag', 'Star', 'UserX', 'CreditCard', 'Clock', 'Mail', 'Phone', 'Heart', 'Flag', 'Zap'];
const NOTIF_COLORS = ['text-pink-500', 'text-orange-500', 'text-amber-500', 'text-blue-500', 'text-violet-500', 'text-indigo-500', 'text-red-500', 'text-emerald-600', 'text-cyan-500', 'text-gray-500'];

function NotificationCategoriesTab({
  categories,
  onAdd,
  onUpdate,
  onRemove,
}: {
  categories: NotificationCategory[];
  onAdd: (cat: Omit<NotificationCategory, 'id'>) => void;
  onUpdate: (id: string, data: Partial<NotificationCategory>) => void;
  onRemove: (id: string) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<NotificationCategory | null>(null);
  const [form, setForm] = useState<Omit<NotificationCategory, 'id'>>({
    key: '', label: '', icon: 'Bell', color: 'text-blue-500', enabled: true,
  });

  const openAdd = () => {
    setEditing(null);
    setForm({ key: '', label: '', icon: 'Bell', color: 'text-blue-500', enabled: true });
    setShowAdd(true);
  };
  const openEdit = (cat: NotificationCategory) => {
    setEditing(cat);
    setForm({ key: cat.key, label: cat.label, icon: cat.icon, color: cat.color, enabled: cat.enabled, daysAhead: cat.daysAhead, daysAgo: cat.daysAgo });
    setShowAdd(true);
  };
  const handleSave = () => {
    if (!form.label || !form.key) return;
    if (editing) onUpdate(editing.id, form);
    else onAdd(form);
    setShowAdd(false);
  };

  const isDefault = (cat: NotificationCategory) => DEFAULT_NOTIFICATION_CATEGORIES.some(d => d.key === cat.key);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Управляйте типами уведомлений и их условиями срабатывания</p>
        <Button onClick={openAdd} className="bg-foreground text-primary-foreground hover:opacity-90">
          <Icon name="Plus" size={14} className="mr-1.5" /> Добавить категорию
        </Button>
      </div>
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="divide-y divide-border">
          {categories.map(cat => (
            <div key={cat.id} className="flex items-center gap-3 px-4 py-3">
              <Icon name={cat.icon} size={16} className={cat.color} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{cat.label}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span>ключ: {cat.key}</span>
                  {cat.daysAhead !== undefined && <span>· за {cat.daysAhead} дн.</span>}
                  {cat.daysAgo !== undefined && <span>· {cat.daysAgo} дней назад</span>}
                </div>
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cat.enabled}
                  onChange={e => onUpdate(cat.id, { enabled: e.target.checked })}
                  className="accent-foreground cursor-pointer"
                />
                <span className="text-xs text-muted-foreground">{cat.enabled ? 'Вкл' : 'Выкл'}</span>
              </label>
              <button onClick={() => openEdit(cat)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground">
                <Icon name="Pencil" size={13} />
              </button>
              {!isDefault(cat) && (
                <button onClick={() => { if (confirm('Удалить категорию?')) onRemove(cat.id); }} className="p-1.5 rounded hover:bg-red-50 text-red-400">
                  <Icon name="Trash2" size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editing ? 'Редактировать категорию' : 'Новая категория уведомлений'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Название *</Label>
              <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Например: Пришёл второй раз" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Ключ (уникальный, латиница) *</Label>
              <Input value={form.key} onChange={e => setForm(f => ({ ...f, key: e.target.value.replace(/[^a-z0-9_]/g, '') }))} placeholder="my_notification" disabled={!!editing && isDefault(editing)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Иконка</Label>
              <div className="flex flex-wrap gap-1.5">
                {NOTIF_ICONS.map(ic => (
                  <button key={ic} onClick={() => setForm(f => ({ ...f, icon: ic }))}
                    className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${form.icon === ic ? 'border-foreground bg-secondary' : 'border-border hover:bg-secondary'}`}>
                    <Icon name={ic} size={14} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Цвет иконки</Label>
              <div className="flex flex-wrap gap-1.5">
                {NOTIF_COLORS.map(c => {
                  const dot = c.replace('text-', 'bg-');
                  return (
                    <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${form.color === c ? 'scale-125 border-foreground' : 'border-transparent hover:scale-110'}`}>
                      <div className={`w-full h-full rounded-full ${dot}`} />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">За N дней (daysAhead)</Label>
                <Input type="number" min={0} value={form.daysAhead ?? ''} onChange={e => setForm(f => ({ ...f, daysAhead: e.target.value ? Number(e.target.value) : undefined }))} placeholder="Пусто = не используется" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">N дней назад (daysAgo)</Label>
                <Input type="number" min={0} value={form.daysAgo ?? ''} onChange={e => setForm(f => ({ ...f, daysAgo: e.target.value ? Number(e.target.value) : undefined }))} placeholder="Пусто = не используется" />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} className="accent-foreground cursor-pointer" />
              <span className="text-sm">Включена</span>
            </label>
            <Button onClick={handleSave} disabled={!form.label || !form.key} className="w-full bg-foreground text-primary-foreground">
              {editing ? 'Сохранить' : 'Добавить'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Settings({ store }: SettingsProps) {
  const {
    state,
    addTrainingType, updateTrainingType, removeTrainingType,
    addTrainingCategory, updateTrainingCategory, removeTrainingCategory,
    addTrainer, updateTrainer, removeTrainer,
    addHall, updateHall, removeHall,
    addSubscriptionPlan, updateSubscriptionPlan, removeSubscriptionPlan,
    addSingleVisitPlan, updateSingleVisitPlan, removeSingleVisitPlan,
    addContactChannel, updateContactChannel, removeContactChannel,
    addAdSource, updateAdSource, removeAdSource,
    addExpenseCategory, updateExpenseCategory, removeExpenseCategory,
    setMonthlyPlan, setExpensePlan, setSalesPlan,
    addNotificationCategory, updateNotificationCategory, removeNotificationCategory,
    updateProjectCode, updateBonusSettings,
  } = store;

  const [tab, setTab] = useState<Tab>('trainings');

  const [showAddTraining, setShowAddTraining] = useState(false);
  const [editingTT, setEditingTT] = useState<TrainingType | null>(null);
  const [ttForm, setTtForm] = useState({ name: '', duration: 60, description: '', color: '#6366f1', categoryId: '', extraPrice: '' as string | number, extraPriceName: '' });

  const [showAddTC, setShowAddTC] = useState(false);
  const [editingTC, setEditingTC] = useState<TrainingCategory | null>(null);
  const [tcForm, setTcForm] = useState({ name: '', color: '#6366f1' });

  const [showAddTrainer, setShowAddTrainer] = useState(false);
  const [editingTrainer, setEditingTrainer] = useState<Trainer | null>(null);
  const [trainerForm, setTrainerForm] = useState({ name: '', specialty: '', branchId: state.currentBranchId, branchIds: [state.currentBranchId] });

  const [showAddHall, setShowAddHall] = useState(false);
  const [editingHall, setEditingHall] = useState<Hall | null>(null);
  const [hallForm, setHallForm] = useState({ name: '', capacity: 20 });

  const [showAddPlan, setShowAddPlan] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [planForm, setPlanForm] = useState({
    name: '', price: 0, durationDays: 30, sessionsLimit: 8 as number | 'unlimited',
    trainingTypeIds: [] as string[], allDirections: false, freezeDays: 7,
    autoActivateDays: '' as string | number,
  });

  const [showAddSingle, setShowAddSingle] = useState(false);
  const [editingSingle, setEditingSingle] = useState<SingleVisitPlan | null>(null);
  const [singleForm, setSingleForm] = useState({ name: '', price: 0, trainingTypeIds: [] as string[], autoActivateDays: '' as string | number, noExtraCharge: false });

  const [newChannel, setNewChannel] = useState('');
  const [editChannel, setEditChannel] = useState<{ old: string; val: string } | null>(null);
  const [newSource, setNewSource] = useState('');
  const [editSource, setEditSource] = useState<{ old: string; val: string } | null>(null);
  const [projectCodeInput, setProjectCodeInput] = useState(state.projectCode);
  const [projectCodeSaved, setProjectCodeSaved] = useState(false);

  const [showAddExpCat, setShowAddExpCat] = useState(false);
  const [editingExpCat, setEditingExpCat] = useState<ExpenseCategory | null>(null);
  const [expCatForm, setExpCatForm] = useState({ name: '' });

  // Проверка — является ли текущий сотрудник директором (должна быть ДО allTabs)
  const currentStaff = state.staff.find(s => s.id === state.currentStaffId);
  const isDirector = currentStaff?.role === 'director' || currentStaff?.role === 'manager';

  const allTabs: { id: Tab; label: string; icon: string; directorOnly?: boolean }[] = [
    { id: 'trainings', label: 'Тренировки', icon: 'Dumbbell' },
    { id: 'training-cats', label: 'Категории', icon: 'Tag' },
    { id: 'trainers', label: 'Тренеры', icon: 'User' },
    { id: 'halls', label: 'Залы', icon: 'DoorOpen' },
    { id: 'plans', label: 'Абонементы', icon: 'CreditCard', directorOnly: true },
    { id: 'single', label: 'Разовые', icon: 'Ticket', directorOnly: true },
    { id: 'sources', label: 'Источники', icon: 'Megaphone', directorOnly: true },
    { id: 'expense-cats', label: 'Расходы', icon: 'TrendingDown', directorOnly: true },
    { id: 'expense-plan', label: 'Расходы (план)', icon: 'ClipboardList' },
    { id: 'sales-plan', label: 'Продажи (план)', icon: 'ShoppingCart' },
    { id: 'planning', label: 'Планирование', icon: 'Target' },
    { id: 'notifications', label: 'Уведомления', icon: 'Bell' },
    { id: 'bonus', label: 'Бонусы', icon: 'Gift', directorOnly: true },
    { id: 'project', label: 'Проект', icon: 'Key', directorOnly: true },
  ];
  const tabs = allTabs.filter(t => !t.directorOnly || isDirector);

  const toggleTT = (ids: string[], id: string, setter: (v: string[]) => void) => {
    setter(ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]);
  };

  const branchHalls = state.halls.filter(h => h.branchId === state.currentBranchId);
  const branchExpCats = state.expenseCategories.filter(c => c.branchId === state.currentBranchId);

  const openAddTT = () => { setEditingTT(null); setTtForm({ name: '', duration: 60, description: '', color: '#6366f1', categoryId: '', extraPrice: '', extraPriceName: '' }); setShowAddTraining(true); };
  const openEditTT = (tt: TrainingType) => { setEditingTT(tt); setTtForm({ name: tt.name, duration: tt.duration, description: tt.description, color: tt.color, categoryId: tt.categoryId || '', extraPrice: tt.extraPrice ?? '', extraPriceName: tt.extraPriceName ?? '' }); setShowAddTraining(true); };
  const handleSaveTT = () => {
    if (!ttForm.name) return;
    const extraPrice = ttForm.extraPrice !== '' ? Number(ttForm.extraPrice) : null;
    const data = { name: ttForm.name, duration: ttForm.duration, description: ttForm.description, color: ttForm.color, categoryId: ttForm.categoryId || undefined, extraPrice, extraPriceName: ttForm.extraPriceName || null };
    if (editingTT) updateTrainingType(editingTT.id, data);
    else addTrainingType({ ...data, trainerIds: [], branchIds: [state.currentBranchId] });
    setShowAddTraining(false);
  };

  const openAddTC = () => { setEditingTC(null); setTcForm({ name: '', color: '#6366f1' }); setShowAddTC(true); };
  const openEditTC = (cat: TrainingCategory) => { setEditingTC(cat); setTcForm({ name: cat.name, color: cat.color }); setShowAddTC(true); };
  const handleSaveTC = () => {
    if (!tcForm.name) return;
    if (editingTC) updateTrainingCategory(editingTC.id, tcForm);
    else addTrainingCategory(tcForm);
    setShowAddTC(false);
  };

  const openAddTrainer = () => { setEditingTrainer(null); setTrainerForm({ name: '', specialty: '', branchId: state.currentBranchId, branchIds: [state.currentBranchId] }); setShowAddTrainer(true); };
  const openEditTrainer = (t: Trainer) => { setEditingTrainer(t); setTrainerForm({ name: t.name, specialty: t.specialty, branchId: t.branchId, branchIds: t.branchIds ?? [t.branchId] }); setShowAddTrainer(true); };
  const handleSaveTrainer = () => {
    if (!trainerForm.name) return;
    if (editingTrainer) updateTrainer(editingTrainer.id, { ...trainerForm, branchIds: trainerForm.branchIds });
    else addTrainer({ ...trainerForm, branchIds: trainerForm.branchIds });
    setShowAddTrainer(false);
  };

  const toggleTrainerBranch = (branchId: string) => {
    setTrainerForm(f => ({
      ...f,
      branchIds: f.branchIds.includes(branchId)
        ? f.branchIds.filter(id => id !== branchId)
        : [...f.branchIds, branchId],
    }));
  };

  const openAddHall = () => { setEditingHall(null); setHallForm({ name: '', capacity: 20 }); setShowAddHall(true); };
  const openEditHall = (h: Hall) => { setEditingHall(h); setHallForm({ name: h.name, capacity: h.capacity }); setShowAddHall(true); };
  const handleSaveHall = () => {
    if (!hallForm.name) return;
    if (editingHall) updateHall(editingHall.id, hallForm);
    else addHall({ ...hallForm, branchId: state.currentBranchId });
    setShowAddHall(false);
  };

  const openAddPlan = () => { setEditingPlan(null); setPlanForm({ name: '', price: 0, durationDays: 30, sessionsLimit: 8, trainingTypeIds: [], allDirections: false, freezeDays: 7, autoActivateDays: '' }); setShowAddPlan(true); };
  const openEditPlan = (p: SubscriptionPlan) => { setEditingPlan(p); setPlanForm({ name: p.name, price: p.price, durationDays: p.durationDays, sessionsLimit: p.sessionsLimit, trainingTypeIds: p.trainingTypeIds, allDirections: p.allDirections, freezeDays: p.freezeDays, autoActivateDays: p.autoActivateDays ?? '' }); setShowAddPlan(true); };
  const handleSavePlan = () => {
    if (!planForm.name || planForm.price <= 0) return;
    const autoActivateDays = planForm.autoActivateDays !== '' && planForm.autoActivateDays !== null ? Number(planForm.autoActivateDays) : null;
    const baseData = { name: planForm.name, price: planForm.price, durationDays: planForm.durationDays, sessionsLimit: planForm.sessionsLimit, trainingTypeIds: planForm.allDirections ? [] : planForm.trainingTypeIds, allDirections: planForm.allDirections, freezeDays: planForm.freezeDays, autoActivateDays };
    if (editingPlan) {
      updateSubscriptionPlan(editingPlan.id, baseData);
    } else {
      addSubscriptionPlan(baseData);
    }
    setShowAddPlan(false);
  };

  const openAddSingle = () => { setEditingSingle(null); setSingleForm({ name: '', price: 0, trainingTypeIds: [], autoActivateDays: '', noExtraCharge: false }); setShowAddSingle(true); };
  const openEditSingle = (p: SingleVisitPlan) => { setEditingSingle(p); setSingleForm({ name: p.name, price: p.price, trainingTypeIds: p.trainingTypeIds, autoActivateDays: p.autoActivateDays ?? '', noExtraCharge: p.noExtraCharge ?? false }); setShowAddSingle(true); };
  const handleSaveSingle = () => {
    if (!singleForm.name || singleForm.price <= 0) return;
    const autoActivateDays = singleForm.autoActivateDays !== '' && singleForm.autoActivateDays !== null ? Number(singleForm.autoActivateDays) : null;
    const baseData = { name: singleForm.name, price: singleForm.price, trainingTypeIds: singleForm.trainingTypeIds, autoActivateDays, noExtraCharge: singleForm.noExtraCharge };
    if (editingSingle) {
      updateSingleVisitPlan(editingSingle.id, baseData);
    } else {
      addSingleVisitPlan({ ...baseData, branchId: state.currentBranchId });
    }
    setShowAddSingle(false);
  };

  const openAddExpCat = () => { setEditingExpCat(null); setExpCatForm({ name: '' }); setShowAddExpCat(true); };
  const openEditExpCat = (c: ExpenseCategory) => { setEditingExpCat(c); setExpCatForm({ name: c.name }); setShowAddExpCat(true); };
  const handleSaveExpCat = () => {
    if (!expCatForm.name) return;
    if (editingExpCat) {
      updateExpenseCategory(editingExpCat.id, { name: expCatForm.name });
    } else {
      // Дублируем на все филиалы
      state.branches.forEach(branch => addExpenseCategory({ name: expCatForm.name, branchId: branch.id }));
    }
    setShowAddExpCat(false);
  };



  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex gap-1 bg-secondary rounded-xl p-1 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Icon name={t.icon} size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'trainings' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-end">
            <Button onClick={openAddTT} className="bg-foreground text-primary-foreground hover:opacity-90">
              <Icon name="Plus" size={14} className="mr-1.5" /> Добавить тренировку
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {state.trainingTypes.map(tt => {
              const cat = tt.categoryId ? state.trainingCategories.find(c => c.id === tt.categoryId) : null;
              const color = cat?.color || tt.color;
              return (
                <div key={tt.id} className="bg-white border border-border rounded-xl p-4 flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ background: color }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{tt.name}</div>
                    <div className="text-sm text-muted-foreground">{tt.duration} мин</div>
                    {cat && <span className="text-xs px-2 py-0.5 rounded-full mt-1 inline-block" style={{ background: cat.color + '22', color: cat.color }}>{cat.name}</span>}
                    {tt.description && <div className="text-xs text-muted-foreground mt-1 truncate">{tt.description}</div>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEditTT(tt)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Icon name="Pencil" size={13} /></button>
                    <button onClick={() => removeTrainingType(tt.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"><Icon name="Trash2" size={13} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'training-cats' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-end">
            <Button onClick={openAddTC} className="bg-foreground text-primary-foreground hover:opacity-90">
              <Icon name="Plus" size={14} className="mr-1.5" /> Добавить категорию
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {state.trainingCategories.map(cat => (
              <div key={cat.id} className="bg-white border border-border rounded-xl p-4 flex items-center gap-3">
                <div className="w-5 h-5 rounded-full shrink-0 border border-border/30" style={{ background: cat.color }} />
                <div className="flex-1 font-medium">{cat.name}</div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEditTC(cat)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Icon name="Pencil" size={13} /></button>
                  <button onClick={() => removeTrainingCategory(cat.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"><Icon name="Trash2" size={13} /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            Цвет категории окрашивает тренировки в расписании. Тип тренировки наследует цвет своей категории.
          </div>
        </div>
      )}

      {tab === 'trainers' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-end">
            <Button onClick={openAddTrainer} className="bg-foreground text-primary-foreground hover:opacity-90">
              <Icon name="Plus" size={14} className="mr-1.5" /> Добавить тренера
            </Button>
          </div>
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <table className="w-full data-table">
              <thead><tr><th>Имя</th><th>Специализация</th><th>Филиалы</th><th></th></tr></thead>
              <tbody>
                {state.trainers.filter(t => (t.branchIds ?? [t.branchId]).includes(state.currentBranchId)).map(t => (
                  <tr key={t.id}>
                    <td className="font-medium">{t.name}</td>
                    <td className="text-muted-foreground">{t.specialty}</td>
                    <td className="text-muted-foreground text-xs">{(t.branchIds ?? [t.branchId]).map(id => state.branches.find(b => b.id === id)?.name).filter(Boolean).join(', ')}</td>
                    <td>
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => openEditTrainer(t)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Icon name="Pencil" size={13} /></button>
                        <button onClick={() => removeTrainer(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"><Icon name="Trash2" size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'halls' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-end">
            <Button onClick={openAddHall} className="bg-foreground text-primary-foreground hover:opacity-90">
              <Icon name="Plus" size={14} className="mr-1.5" /> Добавить зал
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {branchHalls.length === 0 && <div className="col-span-3 text-center py-12 text-muted-foreground text-sm">Нет залов</div>}
            {branchHalls.map(hall => (
              <div key={hall.id} className="bg-white border border-border rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
                      <Icon name="DoorOpen" size={16} className="text-muted-foreground" />
                    </div>
                    <div>
                      <div className="font-medium">{hall.name}</div>
                      <div className="text-sm text-muted-foreground">{hall.capacity} мест</div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEditHall(hall)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Icon name="Pencil" size={13} /></button>
                    <button onClick={() => removeHall(hall.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"><Icon name="Trash2" size={13} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'plans' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-end">
            <Button onClick={openAddPlan} className="bg-foreground text-primary-foreground hover:opacity-90">
              <Icon name="Plus" size={14} className="mr-1.5" /> Добавить абонемент
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {state.subscriptionPlans.map(p => (
              <div key={p.id} className="bg-white border border-border rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-xl font-bold mt-1">{p.price.toLocaleString()} ₽</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEditPlan(p)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Icon name="Pencil" size={13} /></button>
                    <button onClick={() => removeSubscriptionPlan(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"><Icon name="Trash2" size={13} /></button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground mb-2">
                  <div><span className="block font-medium text-foreground">{p.durationDays} дн.</span>срок</div>
                  <div><span className="block font-medium text-foreground">{p.sessionsLimit === 'unlimited' ? '∞' : p.sessionsLimit}</span>занятий</div>
                  <div><span className="block font-medium text-foreground">{p.freezeDays} дн.</span>заморозки</div>
                </div>
                {p.allDirections ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">Все направления</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {p.trainingTypeIds.map(id => {
                      const tt = state.trainingTypes.find(t => t.id === id);
                      return tt ? <span key={id} className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{tt.name}</span> : null;
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'single' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-end">
            <Button onClick={openAddSingle} className="bg-foreground text-primary-foreground hover:opacity-90">
              <Icon name="Plus" size={14} className="mr-1.5" /> Добавить разовое
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {state.singleVisitPlans.map(p => (
              <div key={p.id} className="bg-white border border-border rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xl font-bold mt-1">{p.price.toLocaleString()} ₽</div>
                    {p.noExtraCharge && (
                      <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Без доплат</span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEditSingle(p)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Icon name="Pencil" size={13} /></button>
                    <button onClick={() => removeSingleVisitPlan(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"><Icon name="Trash2" size={13} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'sources' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white border border-border rounded-xl p-5">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">Каналы связи</div>
              <div className="space-y-2 mb-4">
                {state.contactChannels.map(ch => (
                  <div key={ch} className="flex items-center gap-2">
                    {editChannel?.old === ch ? (
                      <>
                        <Input value={editChannel.val} onChange={e => setEditChannel({ old: ch, val: e.target.value })} className="text-sm flex-1 h-8" autoFocus
                          onKeyDown={e => { if (e.key === 'Enter' && editChannel.val) { updateContactChannel(ch, editChannel.val); setEditChannel(null); } if (e.key === 'Escape') setEditChannel(null); }} />
                        <button onClick={() => { if (editChannel.val) { updateContactChannel(ch, editChannel.val); setEditChannel(null); } }} className="text-xs px-2 py-1 bg-foreground text-primary-foreground rounded-lg">OK</button>
                        <button onClick={() => setEditChannel(null)} className="text-xs px-2 py-1 bg-secondary rounded-lg">✕</button>
                      </>
                    ) : (
                      <>
                        <span className="text-sm flex-1 px-3 py-1.5 rounded-full bg-secondary border border-border">{ch}</span>
                        <button onClick={() => setEditChannel({ old: ch, val: ch })} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Icon name="Pencil" size={13} /></button>
                        <button onClick={() => removeContactChannel(ch)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"><Icon name="Trash2" size={13} /></button>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={newChannel} onChange={e => setNewChannel(e.target.value)} placeholder="Новый канал..." className="text-sm"
                  onKeyDown={e => { if (e.key === 'Enter' && newChannel) { addContactChannel(newChannel); setNewChannel(''); } }} />
                <Button onClick={() => { if (newChannel) { addContactChannel(newChannel); setNewChannel(''); } }} disabled={!newChannel} className="bg-foreground text-primary-foreground shrink-0">
                  <Icon name="Plus" size={14} />
                </Button>
              </div>
            </div>

            <div className="bg-white border border-border rounded-xl p-5">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">Рекламные источники</div>
              <div className="space-y-2 mb-4">
                {state.adSources.map(src => (
                  <div key={src} className="flex items-center gap-2">
                    {editSource?.old === src ? (
                      <>
                        <Input value={editSource.val} onChange={e => setEditSource({ old: src, val: e.target.value })} className="text-sm flex-1 h-8" autoFocus
                          onKeyDown={e => { if (e.key === 'Enter' && editSource.val) { updateAdSource(src, editSource.val); setEditSource(null); } if (e.key === 'Escape') setEditSource(null); }} />
                        <button onClick={() => { if (editSource.val) { updateAdSource(src, editSource.val); setEditSource(null); } }} className="text-xs px-2 py-1 bg-foreground text-primary-foreground rounded-lg">OK</button>
                        <button onClick={() => setEditSource(null)} className="text-xs px-2 py-1 bg-secondary rounded-lg">✕</button>
                      </>
                    ) : (
                      <>
                        <span className="text-sm flex-1 px-3 py-1.5 rounded-full bg-secondary border border-border">{src}</span>
                        <button onClick={() => setEditSource({ old: src, val: src })} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Icon name="Pencil" size={13} /></button>
                        <button onClick={() => removeAdSource(src)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"><Icon name="Trash2" size={13} /></button>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={newSource} onChange={e => setNewSource(e.target.value)} placeholder="Новый источник..." className="text-sm"
                  onKeyDown={e => { if (e.key === 'Enter' && newSource) { addAdSource(newSource); setNewSource(''); } }} />
                <Button onClick={() => { if (newSource) { addAdSource(newSource); setNewSource(''); } }} disabled={!newSource} className="bg-foreground text-primary-foreground shrink-0">
                  <Icon name="Plus" size={14} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'expense-cats' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-end">
            <Button onClick={openAddExpCat} className="bg-foreground text-primary-foreground hover:opacity-90">
              <Icon name="Plus" size={14} className="mr-1.5" /> Добавить категорию
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {branchExpCats.length === 0 && <div className="col-span-3 text-center py-12 text-muted-foreground text-sm">Нет категорий расходов</div>}
            {branchExpCats.map(cat => (
              <div key={cat.id} className="bg-white border border-border rounded-xl p-4 flex items-center gap-3">
                <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center shrink-0">
                  <Icon name="TrendingDown" size={16} className="text-red-500" />
                </div>
                <div className="flex-1 font-medium">{cat.name}</div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEditExpCat(cat)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Icon name="Pencil" size={13} /></button>
                  <button onClick={() => removeExpenseCategory(cat.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"><Icon name="Trash2" size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Расходы план по категориям */}
      {tab === 'expense-plan' && (
        <ExpensePlanTab state={state} setExpensePlan={setExpensePlan} />
      )}

      {/* Продажи план */}
      {tab === 'sales-plan' && (
        <SalesPlanTab state={state} setSalesPlan={setSalesPlan} />
      )}

      {/* Планирование */}
      {tab === 'planning' && (
        <PlanningTab state={state} setMonthlyPlan={setMonthlyPlan} />
      )}

      {/* Уведомления */}
      {tab === 'notifications' && (
        <NotificationCategoriesTab
          categories={state.notificationCategories}
          onAdd={addNotificationCategory}
          onUpdate={updateNotificationCategory}
          onRemove={removeNotificationCategory}
        />
      )}

      {tab === 'project' && (
        <div className="space-y-4 animate-fade-in max-w-md">
          <div className="bg-white border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-foreground flex items-center justify-center">
                <Icon name="Key" size={16} className="text-primary-foreground" />
              </div>
              <div>
                <div className="font-semibold">Код проекта</div>
                <div className="text-xs text-muted-foreground">Сотрудники вводят этот код при входе</div>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Код проекта</Label>
              <Input
                value={projectCodeInput}
                onChange={e => { setProjectCodeInput(e.target.value.toUpperCase()); setProjectCodeSaved(false); }}
                placeholder="FIT-XXXX"
                className="font-mono text-lg tracking-widest"
              />
              <p className="text-xs text-muted-foreground mt-1.5">Используйте латинские буквы и цифры. Например: FIT-7842</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => { if (projectCodeInput.trim()) { updateProjectCode(projectCodeInput.trim()); setProjectCodeSaved(true); } }}
                disabled={!projectCodeInput.trim() || projectCodeInput.trim() === state.projectCode}
                className="bg-foreground text-primary-foreground hover:opacity-90"
              >
                <Icon name="Save" size={14} className="mr-1.5" />
                Сохранить
              </Button>
              {projectCodeSaved && (
                <span className="text-xs text-emerald-600 flex items-center gap-1">
                  <Icon name="CheckCircle" size={13} />
                  Сохранено
                </span>
              )}
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <Icon name="AlertTriangle" size={15} className="text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800">
                Если сменить код — сотрудники не смогут войти со старым кодом. Сообщите всем сотрудникам новый код проекта.
              </p>
            </div>
          </div>
        </div>
      )}

      {tab === 'bonus' && (() => {
        const bs = state.bonusSettings || { enabled: false, accrualPercent: 5, expiryDays: 365 };
        return (
          <div className="space-y-4 animate-fade-in max-w-md">
            <div className="bg-white border border-border rounded-xl p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-foreground flex items-center justify-center">
                  <Icon name="Gift" size={16} className="text-primary-foreground" />
                </div>
                <div>
                  <div className="font-semibold">Бонусная программа</div>
                  <div className="text-xs text-muted-foreground">Клиенты накапливают бонусы с каждой покупки</div>
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => updateBonusSettings({ ...bs, enabled: !bs.enabled })}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${bs.enabled ? 'bg-foreground' : 'bg-border'}`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${bs.enabled ? 'translate-x-5' : ''}`} />
                </div>
                <span className="text-sm font-medium">{bs.enabled ? 'Включена' : 'Выключена'}</span>
              </label>

              {bs.enabled && (
                <>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">% начисления от суммы покупки</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number" min={1} max={50}
                        value={bs.accrualPercent}
                        onChange={e => updateBonusSettings({ ...bs, accrualPercent: Number(e.target.value) })}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">% → бонусы</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Пример: при покупке на 3 000 ₽ клиент получит {Math.round(3000 * bs.accrualPercent / 100)} бонусов
                    </p>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Срок действия бонусов (дней)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number" min={0}
                        value={bs.expiryDays ?? ''}
                        onChange={e => updateBonusSettings({ ...bs, expiryDays: e.target.value ? Number(e.target.value) : null })}
                        placeholder="Не сгорают"
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground">дней</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Оставьте пустым — бонусы не сгорают</p>
                  </div>

                  <div className="bg-secondary rounded-xl p-4 space-y-1 text-sm">
                    <div className="font-medium mb-2">Как работает:</div>
                    <div className="text-muted-foreground">• Покупка на 5 000 ₽ → +{Math.round(5000 * bs.accrualPercent / 100)} бонусов</div>
                    <div className="text-muted-foreground">• 1 бонус = 1 рубль при оплате</div>
                    <div className="text-muted-foreground">• Бонусы не начисляются на ту часть, что оплачена бонусами</div>
                    {bs.expiryDays && <div className="text-muted-foreground">• Бонусы сгорают через {bs.expiryDays} дней</div>}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* Modals */}
      <Dialog open={showAddTraining} onOpenChange={setShowAddTraining}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingTT ? 'Редактировать тренировку' : 'Новая тренировка'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-xs text-muted-foreground mb-1 block">Название *</Label><Input value={ttForm.name} onChange={e => setTtForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Категория</Label>
              <select className="w-full border border-input rounded-lg px-3 py-2 text-sm" value={ttForm.categoryId} onChange={e => setTtForm(f => ({ ...f, categoryId: e.target.value }))}>
                <option value="">Без категории</option>
                {state.trainingCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><Label className="text-xs text-muted-foreground mb-1 block">Длительность (мин)</Label><Input type="number" value={ttForm.duration} onChange={e => setTtForm(f => ({ ...f, duration: Number(e.target.value) }))} /></div>
            <div><Label className="text-xs text-muted-foreground mb-1 block">Описание</Label><Textarea value={ttForm.description} onChange={e => setTtForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div><Label className="text-xs text-muted-foreground mb-1 block">Цвет (если нет категории)</Label><ColorPicker value={ttForm.color} onChange={c => setTtForm(f => ({ ...f, color: c }))} /></div>
            <div className="border border-border rounded-xl p-3 space-y-2 bg-secondary/30">
              <Label className="text-xs font-medium block">Доплата (необязательно)</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Сумма ₽</Label>
                  <Input type="number" min={0} placeholder="0 — без доплаты" value={ttForm.extraPrice} onChange={e => setTtForm(f => ({ ...f, extraPrice: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Название доплаты</Label>
                  <Input placeholder="Аренда зала..." value={ttForm.extraPriceName} onChange={e => setTtForm(f => ({ ...f, extraPriceName: e.target.value }))} className="h-8 text-sm" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Если указана — при отметке «Пришёл» потребуется дополнительная оплата</p>
            </div>
            <Button onClick={handleSaveTT} disabled={!ttForm.name} className="w-full bg-foreground text-primary-foreground">{editingTT ? 'Сохранить' : 'Добавить'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddTC} onOpenChange={setShowAddTC}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingTC ? 'Редактировать категорию' : 'Новая категория тренировок'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-xs text-muted-foreground mb-1 block">Название *</Label><Input value={tcForm.name} onChange={e => setTcForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label className="text-xs text-muted-foreground mb-1 block">Цвет в расписании</Label><ColorPicker value={tcForm.color} onChange={c => setTcForm(f => ({ ...f, color: c }))} /></div>
            <Button onClick={handleSaveTC} disabled={!tcForm.name} className="w-full bg-foreground text-primary-foreground">{editingTC ? 'Сохранить' : 'Создать'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddTrainer} onOpenChange={setShowAddTrainer}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingTrainer ? 'Редактировать тренера' : 'Новый тренер'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-xs text-muted-foreground mb-1 block">ФИО *</Label><Input value={trainerForm.name} onChange={e => setTrainerForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label className="text-xs text-muted-foreground mb-1 block">Специализация</Label><Input value={trainerForm.specialty} onChange={e => setTrainerForm(f => ({ ...f, specialty: e.target.value }))} /></div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Основной филиал</Label>
              <select className="w-full border border-input rounded-lg px-3 py-2 text-sm" value={trainerForm.branchId} onChange={e => setTrainerForm(f => ({ ...f, branchId: e.target.value, branchIds: [...new Set([...f.branchIds, e.target.value])] }))}>
                {(currentStaff?.role === 'director' ? state.branches : state.branches.filter(b => currentStaff?.branchIds?.includes(b.id))).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Доступен в филиалах</Label>
              <div className="flex flex-wrap gap-2">
                {(currentStaff?.role === 'director' ? state.branches : state.branches.filter(b => currentStaff?.branchIds?.includes(b.id))).map(b => (
                  <button key={b.id} type="button"
                    onClick={() => toggleTrainerBranch(b.id)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${trainerForm.branchIds.includes(b.id) ? 'bg-foreground text-primary-foreground border-foreground' : 'border-border hover:bg-secondary'}`}>
                    {b.name}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={handleSaveTrainer} disabled={!trainerForm.name} className="w-full bg-foreground text-primary-foreground">{editingTrainer ? 'Сохранить' : 'Добавить'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddHall} onOpenChange={setShowAddHall}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingHall ? 'Редактировать зал' : 'Новый зал'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-xs text-muted-foreground mb-1 block">Название *</Label><Input value={hallForm.name} onChange={e => setHallForm(f => ({ ...f, name: e.target.value }))} placeholder="Зал 1, Танцевальный..." /></div>
            <div><Label className="text-xs text-muted-foreground mb-1 block">Вместимость (чел.)</Label><Input type="number" value={hallForm.capacity} onChange={e => setHallForm(f => ({ ...f, capacity: Number(e.target.value) }))} /></div>
            <Button onClick={handleSaveHall} disabled={!hallForm.name} className="w-full bg-foreground text-primary-foreground">{editingHall ? 'Сохранить' : 'Добавить зал'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddPlan} onOpenChange={setShowAddPlan}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingPlan ? 'Редактировать абонемент' : 'Новый абонемент'}</DialogTitle></DialogHeader>

          <div className="space-y-4">
            <div><Label className="text-xs text-muted-foreground mb-1 block">Название *</Label><Input value={planForm.name} onChange={e => setPlanForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-muted-foreground mb-1 block">Цена ₽ *</Label><Input type="number" value={planForm.price} onChange={e => setPlanForm(f => ({ ...f, price: Number(e.target.value) }))} /></div>
              <div><Label className="text-xs text-muted-foreground mb-1 block">Срок (дней)</Label><Input type="number" value={planForm.durationDays} onChange={e => setPlanForm(f => ({ ...f, durationDays: Number(e.target.value) }))} /></div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Занятий</Label>
                <div className="flex gap-2 items-center">
                  <Input type="number" disabled={planForm.sessionsLimit === 'unlimited'} value={planForm.sessionsLimit === 'unlimited' ? '' : planForm.sessionsLimit} onChange={e => setPlanForm(f => ({ ...f, sessionsLimit: Number(e.target.value) }))} />
                  <label className="flex items-center gap-1 text-xs text-muted-foreground shrink-0 cursor-pointer">
                    <input type="checkbox" checked={planForm.sessionsLimit === 'unlimited'} onChange={e => setPlanForm(f => ({ ...f, sessionsLimit: e.target.checked ? 'unlimited' : 8 }))} />∞
                  </label>
                </div>
              </div>
              <div><Label className="text-xs text-muted-foreground mb-1 block">Дней заморозки</Label><Input type="number" value={planForm.freezeDays} onChange={e => setPlanForm(f => ({ ...f, freezeDays: Number(e.target.value) }))} /></div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Срок до автоактивации (дней)</Label>
              <Input
                type="number"
                placeholder="Не задан (активируется сразу)"
                value={planForm.autoActivateDays}
                onChange={e => setPlanForm(f => ({ ...f, autoActivateDays: e.target.value }))}
                min={1}
              />
              <p className="text-xs text-muted-foreground mt-1">Если задать — абонемент начнёт действовать с первой тренировки. Если клиент не пришёл в течение этого срока — активируется автоматически.</p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs text-muted-foreground">Направления</Label>
                <button onClick={() => setPlanForm(f => ({ ...f, allDirections: !f.allDirections, trainingTypeIds: [] }))}
                  className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${planForm.allDirections ? 'bg-emerald-500 text-white border-emerald-500' : 'border-border hover:bg-secondary'}`}>
                  {planForm.allDirections ? '✓ Все направления' : 'Выбрать все'}
                </button>
              </div>
              {!planForm.allDirections ? (
                <div className="flex flex-wrap gap-2">
                  {state.trainingTypes.map(tt => (
                    <button key={tt.id}
                      onClick={() => toggleTT(planForm.trainingTypeIds, tt.id, ids => setPlanForm(f => ({ ...f, trainingTypeIds: ids })))}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${planForm.trainingTypeIds.includes(tt.id) ? 'bg-foreground text-primary-foreground border-foreground' : 'border-border hover:bg-secondary'}`}>
                      {tt.name}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  Доступны все существующие и будущие направления
                </div>
              )}
            </div>
            <Button onClick={handleSavePlan} disabled={!planForm.name || planForm.price <= 0} className="w-full bg-foreground text-primary-foreground">{editingPlan ? 'Сохранить' : 'Создать абонемент'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddSingle} onOpenChange={setShowAddSingle}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingSingle ? 'Редактировать разовое' : 'Новое разовое посещение'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-xs text-muted-foreground mb-1 block">Название *</Label><Input value={singleForm.name} onChange={e => setSingleForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label className="text-xs text-muted-foreground mb-1 block">Цена ₽ *</Label><Input type="number" value={singleForm.price} onChange={e => setSingleForm(f => ({ ...f, price: Number(e.target.value) }))} /></div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Срок до автоактивации (дней)</Label>
              <Input
                type="number"
                placeholder="Не задан (действует сразу)"
                value={singleForm.autoActivateDays}
                onChange={e => setSingleForm(f => ({ ...f, autoActivateDays: e.target.value }))}
                min={1}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs text-muted-foreground">Направления</Label>
                <button type="button" onClick={() => setSingleForm(f => ({ ...f, trainingTypeIds: [] }))}
                  className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${singleForm.trainingTypeIds.length === 0 ? 'bg-emerald-500 text-white border-emerald-500' : 'border-border hover:bg-secondary'}`}>
                  {singleForm.trainingTypeIds.length === 0 ? '✓ Все направления' : 'Выбрать все'}
                </button>
              </div>
              {singleForm.trainingTypeIds.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {state.trainingTypes.map(tt => (
                    <button key={tt.id}
                      onClick={() => toggleTT(singleForm.trainingTypeIds, tt.id, ids => setSingleForm(f => ({ ...f, trainingTypeIds: ids })))}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${singleForm.trainingTypeIds.includes(tt.id) ? 'bg-foreground text-primary-foreground border-foreground' : 'border-border hover:bg-secondary'}`}>
                      {tt.name}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  Доступны все существующие и будущие направления
                </div>
              )}
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-secondary/30">
              <input type="checkbox" id="noExtraCharge" checked={singleForm.noExtraCharge}
                onChange={e => setSingleForm(f => ({ ...f, noExtraCharge: e.target.checked }))}
                className="mt-0.5 accent-foreground cursor-pointer" />
              <div>
                <label htmlFor="noExtraCharge" className="text-sm font-medium cursor-pointer">Без доплат</label>
                <p className="text-xs text-muted-foreground mt-0.5">Клиент с этим разовым посещением сможет посещать тренировки с доплатой без её оплаты</p>
              </div>
            </div>
            <Button onClick={handleSaveSingle} disabled={!singleForm.name || singleForm.price <= 0} className="w-full bg-foreground text-primary-foreground">{editingSingle ? 'Сохранить' : 'Добавить'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddExpCat} onOpenChange={setShowAddExpCat}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingExpCat ? 'Редактировать категорию' : 'Новая категория расходов'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-xs text-muted-foreground mb-1 block">Название *</Label><Input value={expCatForm.name} onChange={e => setExpCatForm({ name: e.target.value })} placeholder="Аренда, Зарплата, Реклама..." /></div>
            <Button onClick={handleSaveExpCat} disabled={!expCatForm.name} className="w-full bg-foreground text-primary-foreground">{editingExpCat ? 'Сохранить' : 'Добавить'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
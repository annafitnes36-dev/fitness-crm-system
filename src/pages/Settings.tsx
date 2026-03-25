import { useState, useEffect } from 'react';
import { StoreType, TrainingCategory, Hall, Trainer, TrainingType, SubscriptionPlan, SingleVisitPlan, ExpenseCategory, MonthlyPlanRow } from '@/store';
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

type Tab = 'trainings' | 'training-cats' | 'trainers' | 'halls' | 'plans' | 'single' | 'sources' | 'expense-cats' | 'expense-plan' | 'sales-plan' | 'planning';

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

const PLANNING_COLUMNS: { key: keyof MonthlyPlanRow; label: string; hint?: string }[] = [
  { key: 'revenue', label: 'Выручка, ₽' },
  { key: 'expenses', label: 'Расход, ₽' },
  { key: 'profit', label: 'Прибыль, ₽' },
  { key: 'additionalSales', label: 'Доп. продажи, ₽' },
  { key: 'subscriptionSales', label: 'Сумма абонементов, ₽' },
  { key: 'avgCheck', label: 'Средний чек, ₽' },
  { key: 'inquiries', label: 'Обращений' },
  { key: 'newbieEnrollments', label: 'Записей новичков' },
  { key: 'newbieAttended', label: 'Дошло новичков' },
  { key: 'newbieSales', label: 'Продаж новичкам' },
  { key: 'convInquiryToEnroll', label: 'Конв. обращение→запись, %' },
  { key: 'convEnrollToAttend', label: 'Конв. запись→приход, %' },
  { key: 'convAttendToSale', label: 'Конв. приход→продажа, %' },
  { key: 'totalSubscriptionSales', label: 'Всего продаж абон.' },
  { key: 'renewalPotential', label: 'Потенциал продлений' },
  { key: 'renewals', label: 'Продлений' },
  { key: 'convRenewal', label: 'Конв. продления, %' },
  { key: 'returns', label: 'Возвращений' },
  { key: 'profitability', label: 'Рентабельность, %' },
];

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

  const months = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return `${selectedYear}-${String(m).padStart(2, '0')}`;
  });

  const subPlans = state.subscriptionPlans.filter(p => p.branchId === selectedBranchId);
  const addPlans = state.singleVisitPlans.filter(p => p.branchId === selectedBranchId);
  const allItems = [...subPlans.map(p => ({ ...p, kind: 'sub' as const })), ...addPlans.map(p => ({ ...p, kind: 'add' as const }))];

  type ValMap = Record<string, Record<string, string>>;
  const [values, setValues] = useState<ValMap>({});

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
  }, [selectedYear, selectedBranchId, state.salesPlans, state.subscriptionPlans, state.singleVisitPlans]);

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
      if (items.length > 0) setSalesPlan(selectedBranchId, month, items);
    });
  };

  const years = [currentYear - 1, currentYear, currentYear + 1];

  const renderSection = (title: string, items: typeof allItems) => (
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
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground sticky left-0 bg-secondary/50 min-w-[100px] z-10">Месяц</th>
                  {items.map(item => (
                    <th key={item.id} className="px-3 py-3 font-medium text-center whitespace-nowrap min-w-[130px]">{item.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {months.map((month, i) => (
                  <tr key={month} className={`border-b border-border/50 ${i % 2 === 0 ? 'bg-white' : 'bg-secondary/20'}`}>
                    <td className="px-4 py-2 font-medium sticky left-0 z-10 whitespace-nowrap"
                      style={{ background: i % 2 === 0 ? 'white' : 'rgb(248 248 248)' }}>
                      {MONTH_NAMES_SHORT[i]}
                    </td>
                    {items.map(item => (
                      <td key={item.id} className="px-2 py-1.5">
                        <Input
                          type="number" min={0} placeholder="0"
                          value={values[month]?.[item.id] ?? ''}
                          onChange={e => handleChange(month, item.id, e.target.value)}
                          className="text-center text-xs h-8"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
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
      {renderSection('Доп. продажи', addPlans.map(p => ({ ...p, kind: 'add' as const })))}
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
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground sticky left-0 bg-secondary/50 min-w-[100px] z-10">Месяц</th>
                  {branchCats.map(cat => (
                    <th key={cat.id} className="px-3 py-3 font-medium text-center whitespace-nowrap min-w-[130px]">{cat.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {months.map((month, i) => (
                  <tr key={month} className={`border-b border-border/50 ${i % 2 === 0 ? 'bg-white' : 'bg-secondary/20'}`}>
                    <td className="px-4 py-2 font-medium sticky left-0 z-10 whitespace-nowrap"
                      style={{ background: i % 2 === 0 ? 'white' : 'rgb(248 248 248)' }}>
                      {MONTH_NAMES_SHORT[i]}
                    </td>
                    {branchCats.map(cat => (
                      <td key={cat.id} className="px-2 py-1.5">
                        <Input
                          type="number"
                          min={0}
                          placeholder="0"
                          value={values[month]?.[cat.id] ?? ''}
                          onChange={e => handleChange(month, cat.id, e.target.value)}
                          className="text-center text-xs h-8"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

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

  // Локальное состояние значений для редактирования
  const [values, setValues] = useState<Record<string, Record<keyof MonthlyPlanRow, string>>>({});

  // Инициализируем значения из store при смене года/филиала
  useEffect(() => {
    const initial: Record<string, Record<keyof MonthlyPlanRow, string>> = {};
    months.forEach(month => {
      const plan = state.monthlyPlans.find(p => p.branchId === selectedBranchId && p.month === month);
      const row: Partial<Record<keyof MonthlyPlanRow, string>> = {};
      PLANNING_COLUMNS.forEach(col => {
        const v = plan?.plan?.[col.key];
        row[col.key] = v !== undefined ? String(v) : '';
      });
      initial[month] = row as Record<keyof MonthlyPlanRow, string>;
    });
    setValues(initial);
  }, [selectedYear, selectedBranchId, state.monthlyPlans]);

  const handleChange = (month: string, key: keyof MonthlyPlanRow, val: string) => {
    setValues(prev => ({
      ...prev,
      [month]: { ...prev[month], [key]: val },
    }));
  };

  const handleSaveMonth = (month: string) => {
    const row = values[month] || {};
    const plan: Partial<MonthlyPlanRow> = {};
    PLANNING_COLUMNS.forEach(col => {
      const v = row[col.key];
      if (v !== '' && v !== undefined) {
        (plan as Record<string, number>)[col.key] = parseFloat(v) || 0;
      }
    });
    setMonthlyPlan(selectedBranchId, month, plan);
  };

  const handleSaveAll = () => {
    months.forEach(month => handleSaveMonth(month));
  };

  return (
    <div className="space-y-4">
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
        <div className="flex items-end">
          <Button onClick={handleSaveAll} className="bg-foreground text-primary-foreground hover:opacity-90">
            <Icon name="Save" size={14} className="mr-1.5" />
            Сохранить всё
          </Button>
        </div>
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground sticky left-0 bg-secondary/50 min-w-[200px] z-10">Показатель</th>
                {months.map((month, i) => (
                  <th key={month} className="px-2 py-3 font-medium text-center min-w-[90px]">{MONTH_NAMES_SHORT[i]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLANNING_COLUMNS.map((col, ci) => (
                <tr key={col.key} className={`border-b border-border/50 ${ci % 2 === 0 ? 'bg-white' : 'bg-secondary/20'}`}>
                  <td className="px-4 py-1.5 font-medium sticky left-0 z-10 text-muted-foreground text-xs"
                    style={{ background: ci % 2 === 0 ? 'white' : 'rgb(248 248 248)' }}>
                    {col.label}
                  </td>
                  {months.map(month => (
                    <td key={month} className="px-2 py-1">
                      <input
                        type="number"
                        className="w-full border border-input rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-foreground/30"
                        value={values[month]?.[col.key] ?? ''}
                        onChange={e => handleChange(month, col.key, e.target.value)}
                        placeholder="—"
                        min={0}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-border flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Изменения применяются после нажатия «Сохранить»</span>
          <Button onClick={handleSaveAll} size="sm" className="bg-foreground text-primary-foreground hover:opacity-90">
            <Icon name="Save" size={13} className="mr-1" />
            Сохранить всё
          </Button>
        </div>
      </div>
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
  } = store;

  const [tab, setTab] = useState<Tab>('trainings');

  const [showAddTraining, setShowAddTraining] = useState(false);
  const [editingTT, setEditingTT] = useState<TrainingType | null>(null);
  const [ttForm, setTtForm] = useState({ name: '', duration: 60, description: '', color: '#6366f1', categoryId: '' });

  const [showAddTC, setShowAddTC] = useState(false);
  const [editingTC, setEditingTC] = useState<TrainingCategory | null>(null);
  const [tcForm, setTcForm] = useState({ name: '', color: '#6366f1' });

  const [showAddTrainer, setShowAddTrainer] = useState(false);
  const [editingTrainer, setEditingTrainer] = useState<Trainer | null>(null);
  const [trainerForm, setTrainerForm] = useState({ name: '', specialty: '', branchId: state.currentBranchId });

  const [showAddHall, setShowAddHall] = useState(false);
  const [editingHall, setEditingHall] = useState<Hall | null>(null);
  const [hallForm, setHallForm] = useState({ name: '', capacity: 20 });

  const [showAddPlan, setShowAddPlan] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [planForm, setPlanForm] = useState({
    name: '', price: 0, durationDays: 30, sessionsLimit: 8 as number | 'unlimited',
    trainingTypeIds: [] as string[], allDirections: false, freezeDays: 7
  });

  const [showAddSingle, setShowAddSingle] = useState(false);
  const [editingSingle, setEditingSingle] = useState<SingleVisitPlan | null>(null);
  const [singleForm, setSingleForm] = useState({ name: '', price: 0, trainingTypeIds: [] as string[] });

  const [newChannel, setNewChannel] = useState('');
  const [editChannel, setEditChannel] = useState<{ old: string; val: string } | null>(null);
  const [newSource, setNewSource] = useState('');
  const [editSource, setEditSource] = useState<{ old: string; val: string } | null>(null);

  const [showAddExpCat, setShowAddExpCat] = useState(false);
  const [editingExpCat, setEditingExpCat] = useState<ExpenseCategory | null>(null);
  const [expCatForm, setExpCatForm] = useState({ name: '' });

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'trainings', label: 'Тренировки', icon: 'Dumbbell' },
    { id: 'training-cats', label: 'Категории', icon: 'Tag' },
    { id: 'trainers', label: 'Тренеры', icon: 'User' },
    { id: 'halls', label: 'Залы', icon: 'DoorOpen' },
    { id: 'plans', label: 'Абонементы', icon: 'CreditCard' },
    { id: 'single', label: 'Разовые', icon: 'Ticket' },
    { id: 'sources', label: 'Источники', icon: 'Megaphone' },
    { id: 'expense-cats', label: 'Расходы', icon: 'TrendingDown' },
    { id: 'expense-plan', label: 'Расходы (план)', icon: 'ClipboardList' },
    { id: 'sales-plan', label: 'Продажи (план)', icon: 'ShoppingCart' },
    { id: 'planning', label: 'Планирование', icon: 'Target' },
  ];

  const toggleTT = (ids: string[], id: string, setter: (v: string[]) => void) => {
    setter(ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]);
  };

  const branchHalls = state.halls.filter(h => h.branchId === state.currentBranchId);
  const branchExpCats = state.expenseCategories.filter(c => c.branchId === state.currentBranchId);

  const openAddTT = () => { setEditingTT(null); setTtForm({ name: '', duration: 60, description: '', color: '#6366f1', categoryId: '' }); setShowAddTraining(true); };
  const openEditTT = (tt: TrainingType) => { setEditingTT(tt); setTtForm({ name: tt.name, duration: tt.duration, description: tt.description, color: tt.color, categoryId: tt.categoryId || '' }); setShowAddTraining(true); };
  const handleSaveTT = () => {
    if (!ttForm.name) return;
    if (editingTT) updateTrainingType(editingTT.id, { name: ttForm.name, duration: ttForm.duration, description: ttForm.description, color: ttForm.color, categoryId: ttForm.categoryId || undefined });
    else addTrainingType({ name: ttForm.name, duration: ttForm.duration, description: ttForm.description, trainerIds: [], branchIds: [state.currentBranchId], color: ttForm.color, categoryId: ttForm.categoryId || undefined });
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

  const openAddTrainer = () => { setEditingTrainer(null); setTrainerForm({ name: '', specialty: '', branchId: state.currentBranchId }); setShowAddTrainer(true); };
  const openEditTrainer = (t: Trainer) => { setEditingTrainer(t); setTrainerForm({ name: t.name, specialty: t.specialty, branchId: t.branchId }); setShowAddTrainer(true); };
  const handleSaveTrainer = () => {
    if (!trainerForm.name) return;
    if (editingTrainer) updateTrainer(editingTrainer.id, trainerForm);
    else addTrainer(trainerForm);
    setShowAddTrainer(false);
  };

  const openAddHall = () => { setEditingHall(null); setHallForm({ name: '', capacity: 20 }); setShowAddHall(true); };
  const openEditHall = (h: Hall) => { setEditingHall(h); setHallForm({ name: h.name, capacity: h.capacity }); setShowAddHall(true); };
  const handleSaveHall = () => {
    if (!hallForm.name) return;
    if (editingHall) updateHall(editingHall.id, hallForm);
    else addHall({ ...hallForm, branchId: state.currentBranchId });
    setShowAddHall(false);
  };

  const openAddPlan = () => { setEditingPlan(null); setPlanForm({ name: '', price: 0, durationDays: 30, sessionsLimit: 8, trainingTypeIds: [], allDirections: false, freezeDays: 7 }); setShowAddPlan(true); };
  const openEditPlan = (p: SubscriptionPlan) => { setEditingPlan(p); setPlanForm({ name: p.name, price: p.price, durationDays: p.durationDays, sessionsLimit: p.sessionsLimit, trainingTypeIds: p.trainingTypeIds, allDirections: p.allDirections, freezeDays: p.freezeDays }); setShowAddPlan(true); };
  const handleSavePlan = () => {
    if (!planForm.name || planForm.price <= 0) return;
    const data = { name: planForm.name, price: planForm.price, durationDays: planForm.durationDays, sessionsLimit: planForm.sessionsLimit, trainingTypeIds: planForm.allDirections ? [] : planForm.trainingTypeIds, allDirections: planForm.allDirections, freezeDays: planForm.freezeDays, branchId: state.currentBranchId };
    if (editingPlan) updateSubscriptionPlan(editingPlan.id, data);
    else addSubscriptionPlan(data);
    setShowAddPlan(false);
  };

  const openAddSingle = () => { setEditingSingle(null); setSingleForm({ name: '', price: 0, trainingTypeIds: [] }); setShowAddSingle(true); };
  const openEditSingle = (p: SingleVisitPlan) => { setEditingSingle(p); setSingleForm({ name: p.name, price: p.price, trainingTypeIds: p.trainingTypeIds }); setShowAddSingle(true); };
  const handleSaveSingle = () => {
    if (!singleForm.name || singleForm.price <= 0) return;
    const data = { name: singleForm.name, price: singleForm.price, trainingTypeIds: singleForm.trainingTypeIds, branchId: state.currentBranchId };
    if (editingSingle) updateSingleVisitPlan(editingSingle.id, data);
    else addSingleVisitPlan(data);
    setShowAddSingle(false);
  };

  const openAddExpCat = () => { setEditingExpCat(null); setExpCatForm({ name: '' }); setShowAddExpCat(true); };
  const openEditExpCat = (c: ExpenseCategory) => { setEditingExpCat(c); setExpCatForm({ name: c.name }); setShowAddExpCat(true); };
  const handleSaveExpCat = () => {
    if (!expCatForm.name) return;
    if (editingExpCat) updateExpenseCategory(editingExpCat.id, { name: expCatForm.name });
    else addExpenseCategory({ name: expCatForm.name, branchId: state.currentBranchId });
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
              <thead><tr><th>Имя</th><th>Специализация</th><th>Филиал</th><th></th></tr></thead>
              <tbody>
                {state.trainers.map(t => (
                  <tr key={t.id}>
                    <td className="font-medium">{t.name}</td>
                    <td className="text-muted-foreground">{t.specialty}</td>
                    <td className="text-muted-foreground">{state.branches.find(b => b.id === t.branchId)?.name}</td>
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
                    <span className="text-xs badge-other px-2 py-1 rounded-full">{state.branches.find(b => b.id === p.branchId)?.name}</span>
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
                    <div className="text-xs text-muted-foreground mt-1">{state.branches.find(b => b.id === p.branchId)?.name}</div>
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
              <Label className="text-xs text-muted-foreground mb-1 block">Филиал</Label>
              <select className="w-full border border-input rounded-lg px-3 py-2 text-sm" value={trainerForm.branchId} onChange={e => setTrainerForm(f => ({ ...f, branchId: e.target.value }))}>
                {state.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
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
        <DialogContent className="max-w-md">
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
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingSingle ? 'Редактировать разовое' : 'Новое разовое посещение'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-xs text-muted-foreground mb-1 block">Название *</Label><Input value={singleForm.name} onChange={e => setSingleForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label className="text-xs text-muted-foreground mb-1 block">Цена ₽ *</Label><Input type="number" value={singleForm.price} onChange={e => setSingleForm(f => ({ ...f, price: Number(e.target.value) }))} /></div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Направления</Label>
              <div className="flex flex-wrap gap-2">
                {state.trainingTypes.map(tt => (
                  <button key={tt.id}
                    onClick={() => toggleTT(singleForm.trainingTypeIds, tt.id, ids => setSingleForm(f => ({ ...f, trainingTypeIds: ids })))}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${singleForm.trainingTypeIds.includes(tt.id) ? 'bg-foreground text-primary-foreground border-foreground' : 'border-border hover:bg-secondary'}`}>
                    {tt.name}
                  </button>
                ))}
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
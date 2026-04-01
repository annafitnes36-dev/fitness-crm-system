import { useState } from 'react';
import { StoreType } from '@/store';
import Icon from '@/components/ui/icon';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface FinanceProps {
  store: StoreType;
}

type FinanceTab = 'operations' | 'expenses';
type OpPeriodKey = 'month' | 'quarter' | 'year' | 'all' | 'custom';

const OP_PERIODS: { key: OpPeriodKey; label: string }[] = [
  { key: 'month', label: 'Месяц' },
  { key: 'quarter', label: 'Квартал' },
  { key: 'year', label: 'Год' },
  { key: 'all', label: 'Всё время' },
  { key: 'custom', label: 'Период' },
];

function getOpDates(period: OpPeriodKey, browseYear: number, browseMonthIdx: number, customFrom: string, customTo: string) {
  const now = new Date();
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const today = fmt(now);
  if (period === 'month') {
    return {
      from: fmt(new Date(browseYear, browseMonthIdx, 1)),
      to: fmt(new Date(browseYear, browseMonthIdx + 1, 0)),
    };
  }
  if (period === 'quarter') {
    const q = Math.floor(now.getMonth() / 3);
    return { from: fmt(new Date(now.getFullYear(), q * 3, 1)), to: today };
  }
  if (period === 'year') return { from: fmt(new Date(now.getFullYear(), 0, 1)), to: today };
  if (period === 'all') return { from: '2000-01-01', to: '2099-12-31' };
  return { from: customFrom || fmt(new Date(browseYear, browseMonthIdx, 1)), to: customTo || today };
}

export default function Finance({ store }: FinanceProps) {
  const { state, addExpense, updateExpense, deleteExpense, deleteSale, deleteVisit } = store;
  const [tab, setTab] = useState<FinanceTab>('operations');

  // ── Период для операций ───────────────────────────────────────────────
  const now = new Date();
  const [opPeriod, setOpPeriod] = useState<OpPeriodKey>('month');
  const [browseYear, setBrowseYear] = useState(now.getFullYear());
  const [browseMonthIdx, setBrowseMonthIdx] = useState(now.getMonth());
  const [opCustomFrom, setOpCustomFrom] = useState('');
  const [opCustomTo, setOpCustomTo] = useState('');

  const isCurrentMonth = browseYear === now.getFullYear() && browseMonthIdx === now.getMonth();
  const goPrevMonth = () => {
    if (browseMonthIdx === 0) { setBrowseYear(y => y - 1); setBrowseMonthIdx(11); }
    else setBrowseMonthIdx(m => m - 1);
  };
  const goNextMonth = () => {
    if (isCurrentMonth) return;
    if (browseMonthIdx === 11) { setBrowseYear(y => y + 1); setBrowseMonthIdx(0); }
    else setBrowseMonthIdx(m => m + 1);
  };
  const monthLabel = new Date(browseYear, browseMonthIdx, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

  const { from: opFrom, to: opTo } = getOpDates(opPeriod, browseYear, browseMonthIdx, opCustomFrom, opCustomTo);
  const inOpPeriod = (date: string) => date >= opFrom && date <= opTo;

  // ── Данные операций с фильтрацией ─────────────────────────────────────
  const branchSales = state.sales.filter(s => s.branchId === state.currentBranchId);
  const branchVisits = state.visits.filter(v => {
    const entry = state.schedule.find(e => e.id === v.scheduleEntryId);
    return entry?.branchId === state.currentBranchId;
  });

  const filteredSales = branchSales.filter(s => inOpPeriod(s.date));
  const filteredVisits = branchVisits.filter(v => v.isSingleVisit && v.status === 'attended' && inOpPeriod(v.date));

  const subRevenue = filteredSales.filter(s => s.type === 'subscription' && !s.isRefund).reduce((sum, s) => sum + s.finalPrice, 0);
  const singleVisitRevenue = filteredVisits.reduce((sum, v) => sum + v.price, 0);
  // finalPrice у возврата может быть отрицательным (хранится как -price), берём абсолютное значение
  const returnsTotal = filteredSales.filter(s => s.isRefund).reduce((sum, s) => sum + Math.abs(s.finalPrice), 0);
  const totalRevenue = subRevenue + singleVisitRevenue - returnsTotal;

  // Расходы за тот же период для расчёта прибыли
  const periodExpenses = state.expenses.filter(e =>
    e.branchId === state.currentBranchId && inOpPeriod(e.date)
  ).reduce((sum, e) => sum + e.amount, 0);
  const profit = totalRevenue - periodExpenses;

  // Права на удаление операций
  const currentStaff = state.staff.find(m => m.id === state.currentStaffId);
  const canDeleteOperations = currentStaff?.role === 'director' || currentStaff?.role === 'manager';

  const byMonth: Record<string, { sub: number; single: number; cash: number; card: number }> = {};
  filteredSales.forEach(s => {
    const month = s.date.slice(0, 7);
    if (!byMonth[month]) byMonth[month] = { sub: 0, single: 0, cash: 0, card: 0 };
    const sign = s.isRefund ? -1 : 1;
    if (s.type === 'subscription') byMonth[month].sub += sign * Math.abs(s.finalPrice);
    else byMonth[month].single += sign * Math.abs(s.finalPrice);
    if (s.paymentMethod === 'cash') byMonth[month].cash += sign * Math.abs(s.finalPrice);
    else byMonth[month].card += sign * Math.abs(s.finalPrice);
  });
  const months = Object.keys(byMonth).sort().reverse();

  const allTransactions = [
    ...filteredSales.map(s => ({
      id: s.id,
      date: s.date,
      type: s.isRefund ? 'Возврат' : s.type === 'subscription' ? 'Абонемент' : 'Разовое',
      client: state.clients.find(c => c.id === s.clientId),
      item: s.itemName,
      amount: s.finalPrice,
      method: s.paymentMethod,
      isIncome: !s.isRefund,
      isReturn: s.isRefund,
    })),
    ...filteredVisits.map(v => {
      const entry = state.schedule.find(e => e.id === v.scheduleEntryId);
      const tt = entry ? state.trainingTypes.find(t => t.id === entry.trainingTypeId) : null;
      return {
        id: v.id,
        date: v.date,
        type: 'Разовый визит',
        client: state.clients.find(c => c.id === v.clientId),
        item: tt?.name || 'Тренировка',
        amount: v.price,
        method: 'cash' as const,
        isIncome: true,
        isReturn: false,
      };
    }),
  ].sort((a, b) => b.date.localeCompare(a.date));

  // ── Вкладка расходов ─────────────────────────────────────────────────
  const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const [expDateFrom, setExpDateFrom] = useState(currentMonthStart);
  const [expDateTo, setExpDateTo] = useState(currentMonthEnd);
  const expBranchId = state.currentBranchId;
  const [expCategoryId, setExpCategoryId] = useState('');

  const [editingExpense, setEditingExpense] = useState<typeof state.expenses[0] | null>(null);
  const [editForm, setEditForm] = useState({ amount: '', comment: '', date: '', categoryId: '', paymentMethod: 'cash' as 'cash' | 'card' });
  const [showEdit, setShowEdit] = useState(false);

  const openEdit = (exp: typeof state.expenses[0]) => {
    setEditingExpense(exp);
    setEditForm({ amount: String(exp.amount), comment: exp.comment, date: exp.date, categoryId: exp.categoryId, paymentMethod: exp.paymentMethod });
    setShowEdit(true);
  };

  const handleEditSave = () => {
    if (!editingExpense) return;
    updateExpense(editingExpense.id, {
      amount: parseFloat(editForm.amount) || 0,
      comment: editForm.comment,
      date: editForm.date,
      categoryId: editForm.categoryId,
      paymentMethod: editForm.paymentMethod,
    });
    setShowEdit(false);
    setEditingExpense(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('Удалить расход?')) deleteExpense(id);
  };

  const filteredExpenses = state.expenses.filter(e => {
    const matchBranch = !expBranchId || e.branchId === expBranchId;
    const matchCat = !expCategoryId || e.categoryId === expCategoryId;
    const matchFrom = !expDateFrom || e.date >= expDateFrom;
    const matchTo = !expDateTo || e.date <= expDateTo;
    return matchBranch && matchCat && matchFrom && matchTo;
  }).sort((a, b) => b.date.localeCompare(a.date));

  const totalFiltered = filteredExpenses.reduce((s, e) => s + e.amount, 0);

  const byCategory: Record<string, number> = {};
  filteredExpenses.forEach(e => {
    byCategory[e.categoryId] = (byCategory[e.categoryId] || 0) + e.amount;
  });

  const branchCategories = state.expenseCategories.filter(c => !expBranchId || c.branchId === expBranchId);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Tabs */}
      <div className="flex gap-1 bg-secondary rounded-xl p-1 w-fit">
        {([['operations', 'Операции'], ['expenses', 'Расходы']] as [FinanceTab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === key ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'operations' && (
        <>
          {/* Период */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-1 bg-secondary rounded-xl p-1">
              {OP_PERIODS.map(p => (
                <button key={p.key} onClick={() => setOpPeriod(p.key)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${opPeriod === p.key ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                  {p.label}
                </button>
              ))}
            </div>

            {opPeriod === 'month' && (
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

            {opPeriod === 'custom' && (
              <div className="flex items-center gap-2">
                <input type="date" value={opCustomFrom} onChange={e => setOpCustomFrom(e.target.value)}
                  className="border border-input rounded-lg px-3 py-1.5 text-sm" />
                <span className="text-muted-foreground text-sm">—</span>
                <input type="date" value={opCustomTo} onChange={e => setOpCustomTo(e.target.value)}
                  className="border border-input rounded-lg px-3 py-1.5 text-sm" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="stat-card">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Выручка</div>
              <div className="text-2xl font-semibold">{totalRevenue.toLocaleString()} ₽</div>
              <div className="text-xs text-muted-foreground mt-1 capitalize">{opPeriod === 'month' ? monthLabel : opPeriod === 'all' ? 'За всё время' : 'За период'}</div>
            </div>
            <div className="stat-card">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Прибыль</div>
              <div className={`text-2xl font-semibold ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{profit >= 0 ? '' : '−'}{Math.abs(profit).toLocaleString()} ₽</div>
              <div className="text-xs text-muted-foreground mt-1">Выручка − расходы ({periodExpenses.toLocaleString()} ₽)</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="stat-card">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Абонементы</div>
              <div className="text-2xl font-semibold">{subRevenue.toLocaleString()} ₽</div>
              <div className="text-xs text-muted-foreground mt-1">{filteredSales.filter(s => s.type === 'subscription' && !s.isRefund).length} продаж</div>
            </div>
            <div className="stat-card">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Разовые визиты</div>
              <div className="text-2xl font-semibold">{singleVisitRevenue.toLocaleString()} ₽</div>
              <div className="text-xs text-muted-foreground mt-1">{filteredVisits.length} посещений</div>
            </div>
          </div>

          {months.length > 0 && opPeriod !== 'month' && (
            <div className="bg-white border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wide">По месяцам</div>
              <table className="w-full data-table">
                <thead>
                  <tr>
                    <th>Месяц</th>
                    <th>Абонементы</th>
                    <th>Разовые</th>
                    <th>Наличные</th>
                    <th>Безналичные</th>
                    <th>Итого</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map(m => {
                    const d = byMonth[m];
                    const [year, month] = m.split('-');
                    const lbl = new Date(Number(year), Number(month) - 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
                    return (
                      <tr key={m}>
                        <td className="font-medium capitalize">{lbl}</td>
                        <td>{d.sub.toLocaleString()} ₽</td>
                        <td className="text-muted-foreground">{d.single.toLocaleString()} ₽</td>
                        <td className="text-muted-foreground">{d.cash.toLocaleString()} ₽</td>
                        <td className="text-muted-foreground">{d.card.toLocaleString()} ₽</td>
                        <td className="font-semibold">{(d.sub + d.single).toLocaleString()} ₽</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wide">
              История операций
            </div>
            <table className="w-full data-table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Клиент</th>
                  <th>Позиция</th>
                  <th>Тип</th>
                  <th>Оплата</th>
                  <th>Сумма</th>
                  {canDeleteOperations && <th></th>}
                </tr>
              </thead>
              <tbody>
                {allTransactions.map(t => (
                  <tr key={t.id}>
                    <td className="text-muted-foreground text-sm">{t.date ? new Date(t.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}</td>
                    <td className="font-medium text-sm">
                      {t.client ? `${t.client.lastName} ${t.client.firstName}` : '—'}
                    </td>
                    <td className="text-sm text-muted-foreground">{t.item}</td>
                    <td>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${t.isReturn ? 'bg-red-100 text-red-700' : t.type === 'Абонемент' ? 'badge-loyal' : 'badge-other'}`}>
                        {t.type}
                      </span>
                    </td>
                    <td className="text-sm">{t.method === 'cash' ? 'Нал' : 'Безнал'}</td>
                    <td className={`font-semibold ${t.isReturn ? 'text-red-600' : 'text-green-600'}`}>
                      {t.isReturn ? '' : '+'}{Math.abs(t.amount).toLocaleString()} ₽
                    </td>
                    {canDeleteOperations && (
                      <td>
                        <button
                          onClick={() => {
                            if (!confirm('Удалить операцию? Это действие нельзя отменить.')) return;
                            if (t.type === 'Разовый визит') {
                              deleteVisit(t.id);
                            } else {
                              deleteSale(t.id);
                            }
                          }}
                          className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors"
                          title="Удалить операцию"
                        >
                          <Icon name="Trash2" size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {allTransactions.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">Операций за выбранный период нет</div>
            )}
          </div>
        </>
      )}

      {tab === 'expenses' && (
        <>
          {/* Фильтры */}
          <div className="bg-white border border-border rounded-xl p-4 flex flex-wrap items-end gap-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Дата с</label>
              <input type="date" value={expDateFrom} onChange={e => setExpDateFrom(e.target.value)}
                className="border border-input rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Дата по</label>
              <input type="date" value={expDateTo} onChange={e => setExpDateTo(e.target.value)}
                className="border border-input rounded-lg px-3 py-2 text-sm" />
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Категория</label>
              <select className="border border-input rounded-lg px-3 py-2 text-sm" value={expCategoryId} onChange={e => setExpCategoryId(e.target.value)}>
                <option value="">Все категории</option>
                {branchCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="ml-auto text-right">
              <div className="text-xs text-muted-foreground">Итого за период</div>
              <div className="text-xl font-semibold text-red-600">{totalFiltered.toLocaleString()} ₽</div>
            </div>
          </div>

          {/* По категориям */}
          {Object.keys(byCategory).length > 0 && (
            <div className="bg-white border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wide">По категориям</div>
              <table className="w-full data-table">
                <thead>
                  <tr>
                    <th>Категория</th>
                    <th>Сумма</th>
                    <th>% от итога</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(byCategory)
                    .sort((a, b) => b[1] - a[1])
                    .map(([catId, amount]) => {
                      const cat = state.expenseCategories.find(c => c.id === catId);
                      const pct = totalFiltered > 0 ? Math.round((amount / totalFiltered) * 100) : 0;
                      return (
                        <tr key={catId}>
                          <td className="font-medium">{cat?.name || 'Без категории'}</td>
                          <td className="font-semibold text-red-600">{amount.toLocaleString()} ₽</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-secondary rounded-full h-1.5">
                                <div className="bg-red-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  <tr className="border-t-2 border-border font-semibold">
                    <td>Итого</td>
                    <td className="text-red-600">{totalFiltered.toLocaleString()} ₽</td>
                    <td>100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Список транзакций расходов */}
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Транзакции расходов
            </div>
            <table className="w-full data-table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Категория</th>
                  <th>Комментарий</th>
                  <th>Оплата</th>
                  <th>Сумма</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map(exp => {
                  const cat = state.expenseCategories.find(c => c.id === exp.categoryId);
                  return (
                    <tr key={exp.id}>
                      <td className="text-muted-foreground text-sm">{exp.date ? new Date(exp.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}</td>
                      <td className="text-sm font-medium">{cat?.name || '—'}</td>
                      <td className="text-sm text-muted-foreground">{exp.comment || '—'}</td>
                      <td className="text-sm">{exp.paymentMethod === 'cash' ? 'Нал' : 'Безнал'}</td>
                      <td className="font-semibold text-red-600">−{exp.amount.toLocaleString()} ₽</td>
                      <td>
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => openEdit(exp)} className="text-muted-foreground hover:text-foreground transition-colors">
                            <Icon name="Pencil" size={14} />
                          </button>
                          <button onClick={() => handleDelete(exp.id)} className="text-muted-foreground hover:text-red-500 transition-colors">
                            <Icon name="Trash2" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredExpenses.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">Расходов за выбранный период нет</div>
            )}
          </div>
        </>
      )}

      {/* Модал редактирования расхода */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать расход</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Сумма</Label>
              <Input type="number" value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <Label>Дата</Label>
              <Input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <Label>Категория</Label>
              <select className="w-full border border-input rounded-lg px-3 py-2 text-sm"
                value={editForm.categoryId} onChange={e => setEditForm(f => ({ ...f, categoryId: e.target.value }))}>
                <option value="">Без категории</option>
                {branchCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Способ оплаты</Label>
              <select className="w-full border border-input rounded-lg px-3 py-2 text-sm"
                value={editForm.paymentMethod} onChange={e => setEditForm(f => ({ ...f, paymentMethod: e.target.value as 'cash' | 'card' }))}>
                <option value="cash">Наличные</option>
                <option value="card">Безналичные</option>
              </select>
            </div>
            <div>
              <Label>Комментарий</Label>
              <Textarea value={editForm.comment} onChange={e => setEditForm(f => ({ ...f, comment: e.target.value }))} />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowEdit(false)} className="px-4 py-2 text-sm border border-input rounded-lg hover:bg-secondary transition-colors">Отмена</button>
              <button onClick={handleEditSave} className="px-4 py-2 text-sm bg-foreground text-primary-foreground rounded-lg hover:opacity-90 transition-opacity">Сохранить</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
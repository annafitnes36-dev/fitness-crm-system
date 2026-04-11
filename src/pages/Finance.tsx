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

type FinanceTab = 'income' | 'expenses';

export default function Finance({ store }: FinanceProps) {
  const { state, addExpense, updateExpense, deleteExpense, deleteSale, deleteVisit } = store;
  const [tab, setTab] = useState<FinanceTab>('income');

  // ── Единый переключатель месяцев ─────────────────────────────────────
  const now = new Date();
  const [browseYear, setBrowseYear] = useState(now.getFullYear());
  const [browseMonthIdx, setBrowseMonthIdx] = useState(now.getMonth());

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

  const monthFrom = `${browseYear}-${String(browseMonthIdx + 1).padStart(2, '0')}-01`;
  const monthTo = new Date(browseYear, browseMonthIdx + 1, 0).toISOString().split('T')[0];
  const inMonth = (date: string) => date >= monthFrom && date <= monthTo;

  // ── Данные доходов ────────────────────────────────────────────────────
  const branchSales = state.sales.filter(s => s.branchId === state.currentBranchId);
  const branchVisits = state.visits.filter(v => {
    const entry = state.schedule.find(e => e.id === v.scheduleEntryId);
    return entry?.branchId === state.currentBranchId;
  });

  const filteredSales = branchSales.filter(s => inMonth(s.date));
  const filteredVisits = branchVisits.filter(v => v.isSingleVisit && v.status === 'attended' && inMonth(v.date));

  const subRevenue = filteredSales.filter(s => s.type === 'subscription' && !s.isRefund).reduce((sum, s) => sum + s.finalPrice, 0);
  const singleVisitRevenue = filteredVisits.reduce((sum, v) => sum + v.price, 0);
  const returnsTotal = filteredSales.filter(s => s.isRefund).reduce((sum, s) => sum + Math.abs(s.finalPrice), 0);
  const totalRevenue = subRevenue + singleVisitRevenue - returnsTotal;

  const currentStaff = state.staff.find(m => m.id === state.currentStaffId);
  const canDeleteOperations = currentStaff?.role === 'director' || currentStaff?.role === 'manager';

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
      isSingleVisit: false,
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
        isSingleVisit: true,
      };
    }),
  ].sort((a, b) => b.date.localeCompare(a.date));

  // ── Данные расходов ───────────────────────────────────────────────────
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

  const handleDeleteExpense = (id: string) => {
    if (confirm('Удалить расход?')) deleteExpense(id);
  };

  const filteredExpenses = state.expenses.filter(e => {
    const matchBranch = e.branchId === state.currentBranchId;
    const matchCat = !expCategoryId || e.categoryId === expCategoryId;
    return matchBranch && matchCat && inMonth(e.date);
  }).sort((a, b) => b.date.localeCompare(a.date));

  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0);

  const byCategory: Record<string, number> = {};
  filteredExpenses.forEach(e => {
    byCategory[e.categoryId] = (byCategory[e.categoryId] || 0) + e.amount;
  });

  const branchCategories = state.expenseCategories.filter(c => c.branchId === state.currentBranchId);

  // ── Общая шапка ───────────────────────────────────────────────────────
  const currentTotal = tab === 'income' ? totalRevenue : totalExpenses;

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Шапка: вкладки + переключатель месяцев + итого */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Вкладки */}
        <div className="flex gap-1 bg-secondary rounded-xl p-1">
          {([['income', 'Доходы'], ['expenses', 'Расходы']] as [FinanceTab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === key ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Переключатель месяцев */}
        <div className="flex items-center gap-1 bg-secondary rounded-xl p-1">
          <button onClick={goPrevMonth} className="px-2 py-1.5 rounded-lg hover:bg-white transition-colors text-muted-foreground hover:text-foreground">
            <Icon name="ChevronLeft" size={16} />
          </button>
          <span className="px-2 text-sm font-medium capitalize min-w-36 text-center">{monthLabel}</span>
          <button onClick={goNextMonth} disabled={isCurrentMonth}
            className="px-2 py-1.5 rounded-lg hover:bg-white transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed">
            <Icon name="ChevronRight" size={16} />
          </button>
        </div>

        {/* Итого */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Итого за месяц:</span>
          <span className={`text-lg font-bold ${tab === 'expenses' ? 'text-red-600' : 'text-emerald-600'}`}>
            {tab === 'expenses' ? '−' : ''}{currentTotal.toLocaleString()} ₽
          </span>
        </div>
      </div>

      {/* ── Доходы ───────────────────────────────────────────────────── */}
      {tab === 'income' && (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Все продажи — <span className="capitalize">{monthLabel}</span>
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
                  <td className="text-muted-foreground text-sm">
                    {t.date ? new Date(t.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                  </td>
                  <td className="font-medium text-sm">
                    {t.client ? `${t.client.lastName} ${t.client.firstName}`.trim() : '—'}
                  </td>
                  <td className="text-sm text-muted-foreground">{t.item}</td>
                  <td>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      t.isReturn ? 'bg-red-100 text-red-700' :
                      t.type === 'Абонемент' ? 'bg-blue-100 text-blue-700' :
                      t.type === 'Разовый визит' ? 'bg-purple-100 text-purple-700' :
                      'bg-secondary text-muted-foreground'
                    }`}>
                      {t.type}
                    </span>
                  </td>
                  <td className="text-sm text-muted-foreground">
                    {t.method === 'card' ? 'Безнал' : t.method === 'bonus' ? 'Бонусы' : 'Нал'}
                  </td>
                  <td className={`font-semibold ${t.isReturn ? 'text-red-600' : 'text-emerald-700'}`}>
                    {t.isReturn ? '−' : '+'}{Math.abs(t.amount).toLocaleString()} ₽
                  </td>
                  {canDeleteOperations && (
                    <td>
                      <button
                        onClick={() => {
                          if (!confirm('Удалить операцию? Это действие нельзя отменить.')) return;
                          if (t.isSingleVisit) deleteVisit(t.id);
                          else deleteSale(t.id);
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
            <div className="py-10 text-center text-sm text-muted-foreground">Продаж за выбранный месяц нет</div>
          )}
        </div>
      )}

      {/* ── Расходы ───────────────────────────────────────────────────── */}
      {tab === 'expenses' && (
        <>
          {/* Фильтр по категории */}
          <div className="flex items-center gap-3">
            <select
              className="border border-input rounded-lg px-3 py-2 text-sm"
              value={expCategoryId}
              onChange={e => setExpCategoryId(e.target.value)}
            >
              <option value="">Все категории</option>
              {branchCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
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
                      const pct = totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0;
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
                    <td className="text-red-600">{totalExpenses.toLocaleString()} ₽</td>
                    <td>100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Список расходов */}
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
                      <td className="text-muted-foreground text-sm">
                        {exp.date ? new Date(exp.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                      </td>
                      <td className="text-sm font-medium">{cat?.name || '—'}</td>
                      <td className="text-sm text-muted-foreground">{exp.comment || '—'}</td>
                      <td className="text-sm">{exp.paymentMethod === 'cash' ? 'Нал' : 'Безнал'}</td>
                      <td className="font-semibold text-red-600">−{exp.amount.toLocaleString()} ₽</td>
                      <td>
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => openEdit(exp)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                            <Icon name="Pencil" size={14} />
                          </button>
                          <button onClick={() => handleDeleteExpense(exp.id)} className="text-muted-foreground hover:text-red-500 transition-colors p-1">
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
              <div className="py-10 text-center text-sm text-muted-foreground">Расходов за выбранный месяц нет</div>
            )}
          </div>
        </>
      )}

      {/* Модал редактирования расхода */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent aria-describedby={undefined}>
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
              <Textarea value={editForm.comment} onChange={e => setEditForm(f => ({ ...f, comment: e.target.value }))} rows={2} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleEditSave} className="flex-1 bg-foreground text-primary-foreground rounded-lg py-2 text-sm font-medium hover:opacity-90 transition-opacity">
                Сохранить
              </button>
              <button onClick={() => setShowEdit(false)} className="flex-1 border border-input rounded-lg py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                Отмена
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

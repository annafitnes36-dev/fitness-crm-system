import { useState } from 'react';
import { StoreType } from '@/store';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface CashProps {
  store: StoreType;
}

const fmt = (n: number) => n.toLocaleString('ru-RU') + ' ₽';
const fmtDate = (d: string) => new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function Cash({ store }: CashProps) {
  const { state, addCashOperation, deleteCashOperation } = store;
  const branchId = state.currentBranchId;

  const [showModal, setShowModal] = useState(false);
  const [opType, setOpType] = useState<'deposit' | 'collection'>('deposit');
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // Продажи наличными (без возвратов денег) и возвраты денег наличными
  const cashSales = state.sales.filter(s => s.branchId === branchId && s.paymentMethod === 'cash' && !s.isRefund);
  const cashSalesTotal = cashSales.reduce((sum, s) => sum + s.finalPrice, 0);

  const cashReturns = state.sales.filter(s => s.branchId === branchId && s.paymentMethod === 'cash' && s.isRefund);
  const cashReturnsTotal = cashReturns.reduce((sum, s) => sum + Math.abs(s.finalPrice), 0);

  // Расходы наличными по филиалу
  const cashExpenses = state.expenses.filter(e => e.branchId === branchId && e.paymentMethod === 'cash');
  const cashExpensesTotal = cashExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Кассовые операции по филиалу
  const cashOps = state.cashOperations.filter(o => o.branchId === branchId);
  const depositsTotal = cashOps.filter(o => o.type === 'deposit').reduce((sum, o) => sum + o.amount, 0);
  // Инкассации из операций (не считаем возвраты абонементов — они уже через Sale)
  const manualCollectionsTotal = cashOps
    .filter(o => o.type === 'collection' && !o.comment.startsWith('Возврат абонемента:'))
    .reduce((sum, o) => sum + o.amount, 0);

  // Баланс: продажи нал + внесения - расходы нал - возвраты нал - инкассации (ручные)
  const balance = cashSalesTotal + depositsTotal - cashExpensesTotal - cashReturnsTotal - manualCollectionsTotal;

  const openModal = (type: 'deposit' | 'collection') => {
    setOpType(type);
    setAmount('');
    setComment('');
    setShowModal(true);
  };

  const handleSubmit = () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) return;
    if (opType === 'collection' && !comment.trim()) return;
    addCashOperation({
      branchId,
      type: opType,
      amount: n,
      comment: comment.trim(),
      date: new Date().toISOString(),
      staffId: state.currentStaffId,
    });
    setShowModal(false);
  };

  const getStaffName = (staffId: string) => {
    const s = state.staff.find(m => m.id === staffId);
    if (!s) return '—';
    const parts = s.name.trim().split(' ');
    return parts.length >= 2 ? `${parts[0]} ${parts[1][0]}.` : s.name;
  };

  // История: объединяем все события
  type HistoryItem =
    | { kind: 'sale'; id: string; date: string; amount: number; label: string; staffId?: string }
    | { kind: 'return'; id: string; date: string; amount: number; label: string; staffId?: string }
    | { kind: 'expense'; id: string; date: string; amount: number; label: string; staffId?: string }
    | { kind: 'deposit'; id: string; date: string; amount: number; comment: string; staffId: string }
    | { kind: 'collection'; id: string; date: string; amount: number; comment: string; staffId: string };

  const history: HistoryItem[] = [
    ...cashSales.map(s => ({
      kind: 'sale' as const,
      id: s.id,
      date: s.date + 'T00:00:00',
      amount: s.finalPrice,
      label: s.itemName,
    })),
    ...cashReturns.map(s => ({
      kind: 'return' as const,
      id: s.id,
      date: s.date + 'T00:00:00',
      amount: Math.abs(s.finalPrice),
      label: s.itemName,
    })),
    ...cashExpenses.map(e => {
      const cat = state.expenseCategories.find(c => c.id === e.categoryId);
      return {
        kind: 'expense' as const,
        id: e.id,
        date: e.date + 'T00:00:00',
        amount: e.amount,
        label: cat?.name || 'Расход',
      };
    }),
    ...cashOps
      .filter(o => !o.comment.startsWith('Возврат абонемента:'))
      .map(o => ({
        kind: o.type as 'deposit' | 'collection',
        id: o.id,
        date: o.date,
        amount: o.amount,
        comment: o.comment,
        staffId: o.staffId,
      })),
  ]
    .filter(item => !filterDate || item.date.startsWith(filterDate))
    .sort((a, b) => b.date.localeCompare(a.date));

  const currentStaff = state.staff.find(s => s.id === state.currentStaffId);
  const canDelete = currentStaff?.role === 'director' || currentStaff?.role === 'manager';

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Баланс */}
      <div className={`rounded-2xl p-6 text-white ${balance >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}>
        <div className="text-sm font-medium opacity-80 mb-1">Остаток в кассе</div>
        <div className="text-4xl font-bold tracking-tight">{fmt(balance)}</div>
        <div className="flex flex-wrap gap-5 mt-4 text-sm opacity-90">
          <div>
            <div className="opacity-70 text-xs">Продажи нал.</div>
            <div className="font-medium">+{fmt(cashSalesTotal)}</div>
          </div>
          <div>
            <div className="opacity-70 text-xs">Внесения</div>
            <div className="font-medium">+{fmt(depositsTotal)}</div>
          </div>
          <div>
            <div className="opacity-70 text-xs">Расходы нал.</div>
            <div className="font-medium">−{fmt(cashExpensesTotal)}</div>
          </div>
          {cashReturnsTotal > 0 && (
            <div>
              <div className="opacity-70 text-xs">Возвраты нал.</div>
              <div className="font-medium">−{fmt(cashReturnsTotal)}</div>
            </div>
          )}
          <div>
            <div className="opacity-70 text-xs">Инкассации</div>
            <div className="font-medium">−{fmt(manualCollectionsTotal)}</div>
          </div>
        </div>
      </div>

      {/* Кнопки действий */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={() => openModal('deposit')}
          className="h-14 bg-white border border-border text-foreground hover:bg-secondary flex flex-col gap-0.5 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Icon name="ArrowDownLeft" size={16} className="text-emerald-600" />
            <span className="font-semibold">Внесение</span>
          </div>
          <span className="text-xs text-muted-foreground font-normal">Добавить деньги в кассу</span>
        </Button>
        <Button
          onClick={() => openModal('collection')}
          className="h-14 bg-white border border-border text-foreground hover:bg-secondary flex flex-col gap-0.5 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Icon name="ArrowUpRight" size={16} className="text-blue-600" />
            <span className="font-semibold">Инкассация</span>
          </div>
          <span className="text-xs text-muted-foreground font-normal">Изъять деньги из кассы</span>
        </Button>
      </div>

      {/* История операций */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="font-semibold text-sm">История операций</div>
          <Input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            className="w-40 h-8 text-xs"
          />
        </div>

        {history.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            <Icon name="Inbox" size={32} className="mx-auto mb-2 opacity-30" />
            Нет операций
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {history.map(item => {
              const isSale = item.kind === 'sale';
              const isReturn = item.kind === 'return';
              const isExpense = item.kind === 'expense';
              const isDeposit = item.kind === 'deposit';
              const isCollection = item.kind === 'collection';

              const icon = isSale ? 'ShoppingBag' : isReturn ? 'RotateCcw' : isExpense ? 'TrendingDown' : isDeposit ? 'ArrowDownLeft' : 'ArrowUpRight';
              const iconColor = isSale ? 'text-emerald-600' : isReturn ? 'text-red-500' : isExpense ? 'text-red-500' : isDeposit ? 'text-emerald-600' : 'text-blue-600';
              const sign = isSale || isDeposit ? '+' : '−';
              const amtColor = isSale || isDeposit ? 'text-emerald-600' : 'text-red-500';
              const label = (isSale || isReturn || isExpense)
                ? (item as { label: string }).label
                : (item as { comment: string }).comment || (isDeposit ? 'Внесение' : 'Инкассация');
              const badge = isSale ? 'Продажа' : isReturn ? 'Возврат' : isExpense ? 'Расход' : isDeposit ? 'Внесение' : 'Инкассация';
              const badgeColor = isSale ? 'bg-emerald-50 text-emerald-700' : isReturn ? 'bg-red-50 text-red-700' : isExpense ? 'bg-red-50 text-red-700' : isDeposit ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700';
              const staffId = (item as { staffId?: string }).staffId;

              return (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors">
                  <div className={`w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 ${iconColor}`}>
                    <Icon name={icon} size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{label || badge}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${badgeColor}`}>{badge}</span>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <span>{fmtDate(item.date)}</span>
                      {staffId && (
                        <span className="flex items-center gap-0.5">
                          <Icon name="User" size={10} />
                          {getStaffName(staffId)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`font-semibold text-sm tabular-nums shrink-0 ${amtColor}`}>
                    {sign}{fmt(item.amount)}
                  </div>
                  {(isDeposit || isCollection) && canDelete && (
                    <button
                      onClick={() => deleteCashOperation(item.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                    >
                      <Icon name="Trash2" size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Модал внесения/инкассации */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name={opType === 'deposit' ? 'ArrowDownLeft' : 'ArrowUpRight'} size={16} className={opType === 'deposit' ? 'text-emerald-600' : 'text-blue-600'} />
              {opType === 'deposit' ? 'Внесение в кассу' : 'Инкассация'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Сумма ₽ *</Label>
              <Input
                type="number"
                min={1}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                Причина / комментарий {opType === 'collection' && <span className="text-red-500">*</span>}
              </Label>
              <Input
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder={opType === 'deposit' ? 'Размен, начало смены...' : 'Укажите причину инкассации'}
              />
              {opType === 'collection' && !comment.trim() && amount && (
                <p className="text-xs text-red-500 mt-1">Укажите причину инкассации</p>
              )}
            </div>
            <Button
              onClick={handleSubmit}
              disabled={!amount || parseFloat(amount) <= 0 || (opType === 'collection' && !comment.trim())}
              className={`w-full text-white ${opType === 'deposit' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-blue-500 hover:bg-blue-600'}`}
            >
              {opType === 'deposit' ? 'Внести' : 'Инкассировать'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
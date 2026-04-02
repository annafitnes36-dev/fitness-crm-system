import { StoreType, Shift } from '@/store';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface ShiftReportProps {
  open: boolean;
  store: StoreType;
  shift: Shift;
  onOpenShift: () => void;
}

const fmt = (n: number) => n.toLocaleString('ru-RU') + ' ₽';

export default function ShiftReport({ open, store, shift, onOpenShift }: ShiftReportProps) {
  const { state } = store;

  const from = shift.openedAt;
  const to = shift.closedAt || new Date().toISOString();
  const inShift = (date: string) => date >= from && date <= to;

  // Продажи этого сотрудника за смену (по staffId если есть, иначе по branchId+дата)
  const shiftSales = state.sales.filter(s =>
    s.branchId === shift.branchId &&
    inShift(s.date) &&
    (s.staffId ? s.staffId === shift.staffId : true)
  );
  const subSales = shiftSales.filter(s => s.type === 'subscription' && !s.isRefund);

  // Новые клиенты, добавленные в этот филиал за смену
  const newClients = state.clients.filter(c =>
    c.branchId === shift.branchId && inShift(c.createdAt)
  ).length;

  const newClientsWithPurchase = subSales.filter(s => s.isFirstSubscription).length;
  const renewals = subSales.filter(s => s.isRenewal).length;
  const returns = shiftSales.filter(s => s.isRefund).length;

  const totalRevenue = shiftSales.filter(s => !s.isRefund).reduce((sum, s) => sum + s.finalPrice, 0);
  const cashRevenue = shiftSales.filter(s => !s.isRefund && s.paymentMethod === 'cash').reduce((sum, s) => sum + s.finalPrice, 0);
  const cardRevenue = shiftSales.filter(s => !s.isRefund && s.paymentMethod === 'card').reduce((sum, s) => sum + s.finalPrice, 0);
  const returnAmount = shiftSales.filter(s => s.isRefund).reduce((sum, s) => sum + Math.abs(s.finalPrice), 0);

  // Остаток в кассе на конец смены — по всему филиалу (общая касса)
  const allCashSales = state.sales.filter(s => s.branchId === shift.branchId && s.paymentMethod === 'cash' && !s.isRefund && inShift(s.date)).reduce((sum, s) => sum + s.finalPrice, 0);
  const allCashReturns = state.sales.filter(s => s.branchId === shift.branchId && s.paymentMethod === 'cash' && s.isRefund && inShift(s.date)).reduce((sum, s) => sum + Math.abs(s.finalPrice), 0);
  const allCashExpenses = state.expenses.filter(e => e.branchId === shift.branchId && e.paymentMethod === 'cash' && inShift(e.date)).reduce((sum, e) => sum + e.amount, 0);
  const cashOps = state.cashOperations.filter(o => o.branchId === shift.branchId && inShift(o.date));
  const depositsTotal = cashOps.filter(o => o.type === 'deposit').reduce((sum, o) => sum + o.amount, 0);
  const manualCollectionsTotal = cashOps.filter(o => o.type === 'collection' && !o.comment.startsWith('Возврат абонемента:')).reduce((sum, o) => sum + o.amount, 0);
  const cashBalance = allCashSales + depositsTotal - allCashExpenses - allCashReturns - manualCollectionsTotal;

  const shiftStaff = state.staff.find(s => s.id === shift.staffId);
  const branch = state.branches.find(b => b.id === shift.branchId);

  const openedTime = new Date(shift.openedAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const closedTime = shift.closedAt ? new Date(shift.closedAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-md" onPointerDownOutside={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="CheckCircle" size={18} className="text-emerald-500" />
            Смена закрыта
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-xs text-muted-foreground space-y-0.5">
            {branch && <div>Филиал: <span className="font-medium text-foreground">{branch.name}</span></div>}
            {shiftStaff && <div>Администратор: <span className="font-medium text-foreground">{shiftStaff.name}</span></div>}
            <div>Открыта: <span className="font-medium text-foreground">{openedTime}</span></div>
            {closedTime && <div>Закрыта: <span className="font-medium text-foreground">{closedTime}</span></div>}
          </div>

          <div className="bg-secondary/40 rounded-xl p-4 space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Клиенты</div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Новых пришло" value={newClients} icon="UserPlus" color="text-blue-600" />
              <Stat label="Из них купили" value={newClientsWithPurchase} icon="ShoppingBag" color="text-emerald-600" />
              <Stat label="Продлений" value={renewals} icon="RefreshCw" color="text-violet-600" />
              <Stat label="Возвратов" value={returns} icon="Undo2" color="text-orange-500" />
            </div>
          </div>

          <div className="bg-secondary/40 rounded-xl p-4 space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Продажи</div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Icon name="Banknote" size={14} className="text-green-600" /> Наличные
                </span>
                <span className="font-semibold tabular-nums">{fmt(cashRevenue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Icon name="CreditCard" size={14} className="text-blue-600" /> Безналичные
                </span>
                <span className="font-semibold tabular-nums">{fmt(cardRevenue)}</span>
              </div>
              {returnAmount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Icon name="Undo2" size={14} className="text-orange-500" /> Возвраты
                  </span>
                  <span className="font-semibold tabular-nums text-orange-500">−{fmt(returnAmount)}</span>
                </div>
              )}
              <div className="border-t border-border pt-2 flex items-center justify-between">
                <span className="text-sm font-semibold">Итого</span>
                <span className="text-lg font-bold tabular-nums">{fmt(totalRevenue - returnAmount)}</span>
              </div>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
            <span className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
              <Icon name="Banknote" size={16} className="text-emerald-600" />
              Остаток в кассе
            </span>
            <span className="text-xl font-bold text-emerald-700 tabular-nums">{fmt(Math.max(0, cashBalance))}</span>
          </div>

          <Button onClick={onOpenShift} className="w-full bg-foreground text-primary-foreground hover:opacity-90" size="lg">
            <Icon name="LogIn" size={16} className="mr-2" />
            Открыть новую смену
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div className="bg-white rounded-lg p-3 flex items-center gap-2.5">
      <div className={`p-1.5 rounded-lg bg-secondary`}>
        <Icon name={icon} size={14} className={color} />
      </div>
      <div>
        <div className="text-lg font-bold leading-none">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      </div>
    </div>
  );
}
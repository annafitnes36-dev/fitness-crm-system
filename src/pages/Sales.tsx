import { useState } from 'react';
import { StoreType } from '@/store';
import Icon from '@/components/ui/icon';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface SalesProps {
  store: StoreType;
  onSell: () => void;
}

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

type CardKey = 'revenue' | 'subs' | 'cash' | 'card';

interface CardModal {
  key: CardKey;
  title: string;
}

export default function Sales({ store, onSell }: SalesProps) {
  const { state, hideDashboardItem, restoreDashboardItem, deleteSale } = store;
  const now = new Date();

  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [openCard, setOpenCard] = useState<CardModal | null>(null);

  const branches = state.branches || [];
  const hiddenIds = new Set(state.dashboardHiddenIds || []);
  const SALES_CARD_KEY = 'sales';
  const isSaleHidden = (id: string) => hiddenIds.has(`${SALES_CARD_KEY}:${id}`);

  const branchSales = state.sales.filter(s => {
    if (selectedBranchId === 'all') return true;
    return s.branchId === selectedBranchId;
  });

  const availableMonths = new Set<string>();
  availableMonths.add(`${now.getFullYear()}-${now.getMonth()}`);
  branchSales.forEach(s => {
    if (s.date) {
      const parts = s.date.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0]);
        const m = parseInt(parts[1]) - 1;
        availableMonths.add(`${y}-${m}`);
      }
    }
  });

  const monthList = Array.from(availableMonths)
    .map(key => {
      const [y, m] = key.split('-').map(Number);
      return { year: y, month: m };
    })
    .sort((a, b) => b.year - a.year || b.month - a.month);

  const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
  // Все продажи месяца (включая скрытые) — для таблицы истории
  const monthSalesAll = branchSales.filter(s => s.date && s.date.startsWith(monthPrefix));
  // Видимые продажи — для счётчиков карточек
  const monthSales = monthSalesAll.filter(s => !isSaleHidden(s.id));

  const staffMap = new Map(state.staff.map(s => [s.id, s.name]));

  const subSales = monthSales.filter(s => s.type === 'subscription' && !s.isRefund);
  const refunds = monthSales.filter(s => s.isRefund);
  const refundsTotal = refunds.reduce((sum, s) => sum + Math.abs(s.finalPrice), 0);
  const totalRevenue = monthSales.filter(s => !s.isRefund).reduce((sum, s) => sum + s.finalPrice, 0) - refundsTotal;
  const cashTotal = monthSales.filter(s => s.paymentMethod === 'cash' && !s.isRefund).reduce((sum, s) => sum + s.finalPrice, 0)
    - refunds.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + Math.abs(s.finalPrice), 0);
  const cardTotal = monthSales.filter(s => s.paymentMethod === 'card' && !s.isRefund).reduce((sum, s) => sum + s.finalPrice, 0)
    - refunds.filter(s => s.paymentMethod === 'card').reduce((sum, s) => sum + Math.abs(s.finalPrice), 0);

  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();

  const currentStaff = state.staff.find(s => s.id === state.currentStaffId);
  const canDeleteSales = currentStaff?.role === 'director' || currentStaff?.role === 'manager' ||
    currentStaff?.permissions?.editDeleteOperations === true;

  const handlePrev = () => {
    const idx = monthList.findIndex(m => m.year === selectedYear && m.month === selectedMonth);
    if (idx < monthList.length - 1) {
      setSelectedYear(monthList[idx + 1].year);
      setSelectedMonth(monthList[idx + 1].month);
    }
  };

  const handleNext = () => {
    const idx = monthList.findIndex(m => m.year === selectedYear && m.month === selectedMonth);
    if (idx > 0) {
      setSelectedYear(monthList[idx - 1].year);
      setSelectedMonth(monthList[idx - 1].month);
    }
  };

  const currentIdx = monthList.findIndex(m => m.year === selectedYear && m.month === selectedMonth);
  const canGoPrev = currentIdx < monthList.length - 1;
  const canGoNext = currentIdx > 0;

  // Модал показывает ВСЕ операции (включая скрытые, чтобы можно было восстановить)
  const getCardSales = (key: CardKey) => {
    switch (key) {
      case 'revenue': return monthSalesAll.slice().reverse();
      case 'subs':    return monthSalesAll.filter(s => s.type === 'subscription' && !s.isRefund).slice().reverse();
      case 'cash':    return monthSalesAll.filter(s => s.paymentMethod === 'cash').slice().reverse();
      case 'card':    return monthSalesAll.filter(s => s.paymentMethod === 'card').slice().reverse();
    }
  };

  const modalSales = openCard ? getCardSales(openCard.key) : [];
  const modalHiddenCount = modalSales.filter(s => isSaleHidden(s.id)).length;

  const fmtSaleTag = (sale: typeof monthSalesAll[0]) => {
    if (sale.isRefund) return <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Возврат</span>;
    if (sale.isFirstSubscription) return <span className="text-xs badge-new px-2 py-0.5 rounded-full">Первый</span>;
    if (sale.isRenewal) return <span className="text-xs badge-loyal px-2 py-0.5 rounded-full">Продление</span>;
    if (sale.isReturn) return <span className="text-xs badge-other px-2 py-0.5 rounded-full">Возврат кл.</span>;
    return null;
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-border rounded-xl px-4 py-2.5 shadow-sm">
            <button
              onClick={handlePrev}
              disabled={!canGoPrev}
              className="p-1 rounded-lg hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Icon name="ChevronLeft" size={16} />
            </button>
            <span className="text-sm font-medium min-w-[140px] text-center">
              {MONTH_NAMES[selectedMonth]} {selectedYear}
              {isCurrentMonth && (
                <span className="ml-2 text-xs text-muted-foreground font-normal">(текущий)</span>
              )}
            </span>
            <button
              onClick={handleNext}
              disabled={!canGoNext}
              className="p-1 rounded-lg hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Icon name="ChevronRight" size={16} />
            </button>
          </div>

          {!isCurrentMonth && (
            <button
              onClick={() => { setSelectedYear(now.getFullYear()); setSelectedMonth(now.getMonth()); }}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              Текущий месяц
            </button>
          )}
        </div>

        {branches.length > 1 && (
          <div className="flex items-center gap-1.5 bg-white border border-border rounded-xl px-2 py-1.5 shadow-sm">
            <Icon name="MapPin" size={14} className="text-muted-foreground ml-1" />
            <button
              onClick={() => setSelectedBranchId('all')}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors font-medium ${
                selectedBranchId === 'all'
                  ? 'bg-foreground text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              Все
            </button>
            {branches.map(branch => (
              <button
                key={branch.id}
                onClick={() => setSelectedBranchId(branch.id)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors font-medium ${
                  selectedBranchId === branch.id
                    ? 'bg-foreground text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {branch.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4">
        <button
          className="stat-card text-left w-full hover:ring-2 hover:ring-border transition-all cursor-pointer"
          onClick={() => setOpenCard({ key: 'revenue', title: 'Все операции за месяц' })}
        >
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Выручка за месяц</div>
          <div className="text-2xl font-semibold">{totalRevenue.toLocaleString()} ₽</div>
        </button>
        <button
          className="stat-card text-left w-full hover:ring-2 hover:ring-border transition-all cursor-pointer"
          onClick={() => setOpenCard({ key: 'subs', title: 'Продажи абонементов' })}
        >
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Абонементов</div>
          <div className="text-2xl font-semibold">{subSales.length}</div>
        </button>
        <button
          className="stat-card text-left w-full hover:ring-2 hover:ring-border transition-all cursor-pointer"
          onClick={() => setOpenCard({ key: 'cash', title: 'Операции наличными' })}
        >
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Наличные</div>
          <div className="text-2xl font-semibold">{cashTotal.toLocaleString()} ₽</div>
        </button>
        <button
          className="stat-card text-left w-full hover:ring-2 hover:ring-border transition-all cursor-pointer"
          onClick={() => setOpenCard({ key: 'card', title: 'Операции безналичными' })}
        >
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Безналичные</div>
          <div className="text-2xl font-semibold">{cardTotal.toLocaleString()} ₽</div>
        </button>
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            История продаж
            {monthSalesAll.length > 0 && (
              <span className="ml-2 normal-case font-normal">— {monthSalesAll.length} шт.</span>
            )}
            {selectedBranchId !== 'all' && (
              <span className="ml-2 normal-case font-normal text-foreground">
                · {branches.find(b => b.id === selectedBranchId)?.name}
              </span>
            )}
          </div>
          <button onClick={onSell} className="flex items-center gap-1.5 text-sm bg-foreground text-primary-foreground px-3 py-1.5 rounded-lg hover:opacity-90">
            <Icon name="Plus" size={14} /> Новая продажа
          </button>
        </div>
        <table className="w-full data-table">
          <thead>
            <tr>
              <th>Клиент</th>
              <th>Товар</th>
              <th>Тип</th>
              <th>Цена</th>
              <th>Скидка</th>
              <th>Итог</th>
              <th>Оплата</th>
              <th>Метка</th>
              <th>Сотрудник</th>
              <th>Дата</th>
              {canDeleteSales && <th></th>}
            </tr>
          </thead>
          <tbody>
            {monthSalesAll.slice().reverse().map(sale => {
              const client = state.clients.find(c => c.id === sale.clientId);
              const staffName = sale.staffId ? staffMap.get(sale.staffId) : null;
              const isHidden = isSaleHidden(sale.id);
              return (
                <tr key={sale.id} className={isHidden ? 'opacity-40' : ''}>
                  <td className="font-medium">{client ? `${client.lastName} ${client.firstName}` : '—'}</td>
                  <td className="text-sm text-muted-foreground">{sale.itemName}</td>
                  <td>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${sale.type === 'subscription' ? 'badge-loyal' : 'badge-other'}`}>
                      {sale.type === 'subscription' ? 'Абонемент' : 'Разовое'}
                    </span>
                  </td>
                  <td className="text-sm text-muted-foreground">{sale.price.toLocaleString()} ₽</td>
                  <td className="text-sm">{sale.discount > 0 ? `-${sale.discount}%` : '—'}</td>
                  <td className="font-medium">{sale.finalPrice.toLocaleString()} ₽</td>
                  <td>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${sale.paymentMethod === 'card' ? 'badge-new' : 'badge-other'}`}>
                      {sale.paymentMethod === 'card' ? 'Безнал' : sale.paymentMethod === 'bonus' ? 'Бонусы' : 'Нал'}
                    </span>
                  </td>
                  <td>
                    {sale.isRefund && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Возврат</span>}
                    {!sale.isRefund && sale.isFirstSubscription && <span className="text-xs badge-new px-2 py-0.5 rounded-full">Первый</span>}
                    {!sale.isRefund && sale.isRenewal && <span className="text-xs badge-loyal px-2 py-0.5 rounded-full">Продление</span>}
                    {!sale.isRefund && sale.isReturn && <span className="text-xs badge-other px-2 py-0.5 rounded-full">Возврат кл.</span>}
                    {!sale.isRefund && !sale.isFirstSubscription && !sale.isRenewal && !sale.isReturn && '—'}
                  </td>
                  <td className="text-sm text-muted-foreground">{staffName || '—'}</td>
                  <td className="text-sm text-muted-foreground">{sale.date}</td>
                  {canDeleteSales && (
                    <td className="text-right pr-2">
                      <button
                        onClick={() => {
                          if (window.confirm(`Удалить продажу "${sale.itemName}" для ${client ? `${client.lastName} ${client.firstName}` : 'клиента'}? Это действие нельзя отменить.`)) {
                            deleteSale(sale.id);
                          }
                        }}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Удалить продажу"
                      >
                        <Icon name="Trash2" size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {monthSalesAll.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Продаж в {MONTH_NAMES[selectedMonth].toLowerCase()} {selectedYear} нет
          </div>
        )}
      </div>

      {/* Модал детализации карточки */}
      <Dialog open={!!openCard} onOpenChange={() => setOpenCard(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{openCard?.title}</DialogTitle>
          </DialogHeader>

          {modalHiddenCount > 0 && (
            <p className="text-xs text-muted-foreground -mt-1">
              Скрытых операций: {modalHiddenCount} — они не учитываются в счётчике карточки
            </p>
          )}

          <div className="overflow-y-auto flex-1 -mx-6 px-6">
            {modalSales.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Нет операций</div>
            ) : (
              <div className="divide-y divide-border">
                {modalSales.map(sale => {
                  const client = state.clients.find(c => c.id === sale.clientId);
                  const staffName = sale.staffId ? staffMap.get(sale.staffId) : null;
                  const clientName = client ? `${client.lastName} ${client.firstName}`.trim() : '—';
                  const isHidden = isSaleHidden(sale.id);
                  return (
                    <div key={sale.id} className={`py-3 flex items-center gap-3 ${isHidden ? 'opacity-40' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{clientName}</span>
                          {fmtSaleTag(sale)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {sale.itemName}
                          {staffName && <span> · {staffName}</span>}
                          <span> · {sale.date}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 mr-1">
                        <div className={`font-semibold text-sm ${sale.isRefund ? 'text-red-600' : ''}`}>
                          {sale.isRefund ? '−' : ''}{Math.abs(sale.finalPrice).toLocaleString()} ₽
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {sale.paymentMethod === 'card' ? 'Безнал' : sale.paymentMethod === 'bonus' ? 'Бонусы' : 'Нал'}
                        </div>
                      </div>
                      <button
                        onClick={() => isHidden ? restoreDashboardItem(SALES_CARD_KEY, sale.id) : hideDashboardItem(SALES_CARD_KEY, sale.id)}
                        className={`shrink-0 p-1.5 rounded-lg transition-colors ${isHidden ? 'text-amber-500 hover:text-emerald-600 hover:bg-emerald-50' : 'text-muted-foreground hover:text-red-500 hover:bg-red-50'}`}
                        title={isHidden ? 'Включить в статистику' : 'Скрыть из статистики'}
                      >
                        <Icon name={isHidden ? 'Eye' : 'EyeOff'} size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {openCard && (
            <div className="pt-3 border-t border-border text-sm text-muted-foreground flex justify-between">
              <span>{modalSales.filter(s => !isSaleHidden(s.id)).length} активных · {modalHiddenCount} скрыто</span>
              <span className="font-medium text-foreground">
                {modalSales.filter(s => !isSaleHidden(s.id)).reduce((s, x) => s + (x.isRefund ? -Math.abs(x.finalPrice) : x.finalPrice), 0).toLocaleString()} ₽
              </span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
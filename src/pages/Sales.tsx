import { useState } from 'react';
import { StoreType } from '@/store';
import Icon from '@/components/ui/icon';

interface SalesProps {
  store: StoreType;
  onSell: () => void;
}

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

export default function Sales({ store, onSell }: SalesProps) {
  const { state, getClientFullName } = store;
  const now = new Date();

  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth()); // 0-indexed

  const branchSales = state.sales.filter(s => s.branchId === state.currentBranchId);

  // Определяем доступные месяцы (из реальных продаж + текущий)
  const availableMonths = new Set<string>();
  availableMonths.add(`${now.getFullYear()}-${now.getMonth()}`);
  branchSales.forEach(s => {
    if (s.date) {
      const d = new Date(s.date);
      availableMonths.add(`${d.getFullYear()}-${d.getMonth()}`);
    }
  });

  // Собираем список месяцев для переключателя, сортируем по дате desc
  const monthList = Array.from(availableMonths)
    .map(key => {
      const [y, m] = key.split('-').map(Number);
      return { year: y, month: m };
    })
    .sort((a, b) => b.year - a.year || b.month - a.month);

  const monthStart = new Date(selectedYear, selectedMonth, 1).toISOString().split('T')[0];
  const monthEnd = new Date(selectedYear, selectedMonth + 1, 1).toISOString().split('T')[0];

  const monthSales = branchSales.filter(s => s.date >= monthStart && s.date < monthEnd);
  const staffMap = new Map(state.staff.map(s => [s.id, s.name]));

  const totalRevenue = monthSales.reduce((sum, s) => sum + s.finalPrice, 0);
  const subSales = monthSales.filter(s => s.type === 'subscription' && !s.isRefund);
  const cashTotal = monthSales.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.finalPrice, 0);
  const cardTotal = monthSales.filter(s => s.paymentMethod === 'card').reduce((sum, s) => sum + s.finalPrice, 0);

  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();

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

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Переключатель месяцев */}
      <div className="flex items-center justify-between">
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

      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Выручка за месяц</div>
          <div className="text-2xl font-semibold">{totalRevenue.toLocaleString()} ₽</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Абонементов</div>
          <div className="text-2xl font-semibold">{subSales.length}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Наличные</div>
          <div className="text-2xl font-semibold">{cashTotal.toLocaleString()} ₽</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Безналичные</div>
          <div className="text-2xl font-semibold">{cardTotal.toLocaleString()} ₽</div>
        </div>
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            История продаж
            {monthSales.length > 0 && (
              <span className="ml-2 normal-case font-normal">— {monthSales.length} шт.</span>
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
            </tr>
          </thead>
          <tbody>
            {monthSales.slice().reverse().map(sale => {
              const client = state.clients.find(c => c.id === sale.clientId);
              const staffName = sale.staffId ? staffMap.get(sale.staffId) : null;
              return (
                <tr key={sale.id}>
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
                    {sale.isFirstSubscription && <span className="text-xs badge-new px-2 py-0.5 rounded-full">Первый</span>}
                    {sale.isRenewal && <span className="text-xs badge-loyal px-2 py-0.5 rounded-full">Продление</span>}
                    {sale.isReturn && <span className="text-xs badge-sleeping px-2 py-0.5 rounded-full">Возвращение</span>}
                    {sale.isRefund && <span className="text-xs badge-churn px-2 py-0.5 rounded-full">Возврат</span>}
                  </td>
                  <td className="text-sm text-muted-foreground">{staffName ? staffName.split(' ').slice(0, 2).join(' ') : '—'}</td>
                  <td className="text-sm text-muted-foreground">{sale.date ? new Date(sale.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {monthSales.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Продаж в {MONTH_NAMES[selectedMonth].toLowerCase()} {selectedYear} нет
          </div>
        )}
      </div>
    </div>
  );
}
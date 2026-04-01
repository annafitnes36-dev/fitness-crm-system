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

// Локальная дата без сдвига часового пояса
function getLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function Sales({ store, onSell }: SalesProps) {
  const { state, getClientFullName } = store;
  const now = new Date();

  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth()); // 0-indexed
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');

  const branches = state.branches || [];

  // Фильтр по филиалу
  const branchSales = state.sales.filter(s => {
    if (selectedBranchId === 'all') return true;
    return s.branchId === selectedBranchId;
  });

  // Определяем доступные месяцы (из реальных продаж + текущий)
  const availableMonths = new Set<string>();
  availableMonths.add(`${now.getFullYear()}-${now.getMonth()}`);
  branchSales.forEach(s => {
    if (s.date) {
      // Парсим дату локально, без UTC-сдвига
      const parts = s.date.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0]);
        const m = parseInt(parts[1]) - 1; // 0-indexed
        availableMonths.add(`${y}-${m}`);
      }
    }
  });

  // Собираем список месяцев для переключателя, сортируем по дате desc
  const monthList = Array.from(availableMonths)
    .map(key => {
      const [y, m] = key.split('-').map(Number);
      return { year: y, month: m };
    })
    .sort((a, b) => b.year - a.year || b.month - a.month);

  // Фильтр по месяцу: используем строковое сравнение YYYY-MM-DD
  const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
  const monthSales = branchSales.filter(s => s.date && s.date.startsWith(monthPrefix));

  const staffMap = new Map(state.staff.map(s => [s.id, s.name]));

  const subSales = monthSales.filter(s => s.type === 'subscription' && !s.isRefund);
  const refunds = monthSales.filter(s => s.isRefund);
  const refundsTotal = refunds.reduce((sum, s) => sum + Math.abs(s.finalPrice), 0);
  // Выручка: все поступления минус возвраты
  const totalRevenue = monthSales.filter(s => !s.isRefund).reduce((sum, s) => sum + s.finalPrice, 0) - refundsTotal;
  const cashTotal = monthSales.filter(s => s.paymentMethod === 'cash' && !s.isRefund).reduce((sum, s) => sum + s.finalPrice, 0)
    - refunds.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + Math.abs(s.finalPrice), 0);
  const cardTotal = monthSales.filter(s => s.paymentMethod === 'card' && !s.isRefund).reduce((sum, s) => sum + s.finalPrice, 0)
    - refunds.filter(s => s.paymentMethod === 'card').reduce((sum, s) => sum + Math.abs(s.finalPrice), 0);

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
      {/* Верхняя панель: переключатель месяцев + филиалы */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Переключатель месяцев */}
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

        {/* Переключатель по филиалам */}
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
                    {sale.isRefund && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Возврат</span>}
                    {!sale.isRefund && sale.isFirstSubscription && <span className="text-xs badge-new px-2 py-0.5 rounded-full">Первый</span>}
                    {!sale.isRefund && sale.isRenewal && <span className="text-xs badge-loyal px-2 py-0.5 rounded-full">Продление</span>}
                    {!sale.isRefund && sale.isReturn && <span className="text-xs badge-other px-2 py-0.5 rounded-full">Возврат кл.</span>}
                    {!sale.isRefund && !sale.isFirstSubscription && !sale.isRenewal && !sale.isReturn && '—'}
                  </td>
                  <td className="text-sm text-muted-foreground">{staffName || '—'}</td>
                  <td className="text-sm text-muted-foreground">{sale.date}</td>
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

import { StoreType } from '@/store';
import Icon from '@/components/ui/icon';

interface SalesProps {
  store: StoreType;
  onSell: () => void;
}

export default function Sales({ store, onSell }: SalesProps) {
  const { state, getClientFullName } = store;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

  const branchSales = state.sales.filter(s => s.branchId === state.currentBranchId);
  const monthSales = branchSales.filter(s => s.date >= monthStart);

  const totalRevenue = monthSales.reduce((sum, s) => sum + s.finalPrice, 0);
  const subSales = monthSales.filter(s => s.type === 'subscription');
  const singleSales = monthSales.filter(s => s.type === 'single');
  const cashTotal = monthSales.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.finalPrice, 0);
  const cardTotal = monthSales.filter(s => s.paymentMethod === 'card').reduce((sum, s) => sum + s.finalPrice, 0);

  return (
    <div className="space-y-5 animate-fade-in">
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
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">История продаж</div>
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
              <th>Дата</th>
            </tr>
          </thead>
          <tbody>
            {branchSales.slice().reverse().map(sale => {
              const client = state.clients.find(c => c.id === sale.clientId);
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
                      {sale.paymentMethod === 'card' ? 'Безнал' : 'Нал'}
                    </span>
                  </td>
                  <td>
                    {sale.isFirstSubscription && <span className="text-xs badge-new px-2 py-0.5 rounded-full">Первый</span>}
                    {sale.isRenewal && <span className="text-xs badge-loyal px-2 py-0.5 rounded-full">Продление</span>}
                    {sale.isReturn && <span className="text-xs badge-sleeping px-2 py-0.5 rounded-full">Возврат</span>}
                  </td>
                  <td className="text-sm text-muted-foreground">{sale.date}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {branchSales.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">Продаж пока нет</div>
        )}
      </div>
    </div>
  );
}

import { StoreType } from '@/store';
import Icon from '@/components/ui/icon';

interface DashboardProps {
  store: StoreType;
  onSell: () => void;
  onNavigate: (page: string) => void;
}

export default function Dashboard({ store, onSell, onNavigate }: DashboardProps) {
  const { state, getClientCategory } = store;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

  const branchSales = state.sales.filter(s => s.branchId === state.currentBranchId);
  const monthSubSales = branchSales.filter(s => s.type === 'subscription' && s.date >= monthStart);

  const totalSubs = monthSubSales.length;
  const firstTimeSubs = monthSubSales.filter(s => s.isFirstSubscription).length;
  const renewalSubs = monthSubSales.filter(s => s.isRenewal).length;
  const returnSubs = monthSubSales.filter(s => s.isReturn).length;

  const avgCheck = totalSubs > 0
    ? Math.round(monthSubSales.reduce((sum, s) => sum + s.finalPrice, 0) / totalSubs)
    : 0;

  const branchClients = state.clients.filter(c => c.branchId === state.currentBranchId);

  const newbiesEnrolled = state.visits.filter(v => {
    const client = state.clients.find(c => c.id === v.clientId);
    if (!client) return false;
    const cat = getClientCategory(client);
    return cat === 'new' && v.status === 'enrolled';
  }).length;

  const newbiesAttended = state.visits.filter(v => {
    const client = state.clients.find(c => c.id === v.clientId);
    if (!client) return false;
    const cat = getClientCategory(client);
    return cat === 'new' && v.status === 'attended';
  }).length;

  const todayStr = now.toISOString().split('T')[0];
  const todaySchedule = state.schedule.filter(s => s.branchId === state.currentBranchId && s.date === todayStr);

  const recentSales = branchSales.slice(-5).reverse();

  const stats = [
    { label: 'Продаж абонементов', value: totalSubs, sub: 'за месяц', icon: 'CreditCard', color: 'text-blue-600' },
    { label: 'Средний чек', value: `${avgCheck.toLocaleString()} ₽`, sub: 'по абонементам', icon: 'TrendingUp', color: 'text-green-600' },
    { label: 'Новички записались', value: newbiesEnrolled, sub: 'первичные', icon: 'UserPlus', color: 'text-violet-600' },
    { label: 'Новички дошли', value: newbiesAttended, sub: 'посетили занятие', icon: 'CheckCircle2', color: 'text-emerald-600' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={i} className="stat-card">
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{s.label}</span>
              <Icon name={s.icon} size={16} className={s.color} />
            </div>
            <div className="text-2xl font-semibold">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Sales breakdown */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-border rounded-xl p-5">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">Структура продаж</div>
          <div className="space-y-3">
            {[
              { label: 'Первая покупка', value: firstTimeSubs, color: 'bg-blue-500', total: totalSubs },
              { label: 'Продление', value: renewalSubs, color: 'bg-emerald-500', total: totalSubs },
              { label: 'Возвращение', value: returnSubs, color: 'bg-amber-500', total: totalSubs },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium">{item.value}</span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full ${item.color} rounded-full transition-all duration-500`}
                    style={{ width: item.total ? `${(item.value / item.total) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-border rounded-xl p-5">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">База клиентов</div>
          <div className="space-y-2">
            {[
              { label: 'Новички', count: branchClients.filter(c => getClientCategory(c) === 'new').length, badge: 'badge-new' },
              { label: 'Лояльные', count: branchClients.filter(c => getClientCategory(c) === 'loyal').length, badge: 'badge-loyal' },
              { label: 'Уснувшие', count: branchClients.filter(c => getClientCategory(c) === 'sleeping').length, badge: 'badge-sleeping' },
              { label: 'Потерянные', count: branchClients.filter(c => getClientCategory(c) === 'lost').length, badge: 'badge-lost' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.badge}`}>{item.count}</span>
              </div>
            ))}
            <button onClick={() => onNavigate('clients')} className="text-xs text-muted-foreground hover:text-foreground mt-2 flex items-center gap-1">
              Все клиенты <Icon name="ArrowRight" size={12} />
            </button>
          </div>
        </div>

        <div className="bg-white border border-border rounded-xl p-5">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">Сегодня в расписании</div>
          <div className="space-y-2">
            {todaySchedule.length === 0 && <p className="text-sm text-muted-foreground">Занятий нет</p>}
            {todaySchedule.map(entry => {
              const tt = state.trainingTypes.find(t => t.id === entry.trainingTypeId);
              return (
                <div key={entry.id} className="flex items-center gap-3 py-1.5">
                  <div className="w-1 h-8 rounded-full" style={{ background: tt?.color || '#888' }} />
                  <div>
                    <div className="text-sm font-medium">{entry.time} — {tt?.name}</div>
                    <div className="text-xs text-muted-foreground">{entry.enrolledClientIds.length} / {entry.maxCapacity} записей</div>
                  </div>
                </div>
              );
            })}
            <button onClick={() => onNavigate('schedule')} className="text-xs text-muted-foreground hover:text-foreground mt-2 flex items-center gap-1">
              Расписание <Icon name="ArrowRight" size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Recent sales */}
      <div className="bg-white border border-border rounded-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Последние продажи</div>
          <button onClick={() => onNavigate('sales')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            Все <Icon name="ArrowRight" size={12} />
          </button>
        </div>
        <table className="w-full data-table">
          <thead>
            <tr>
              <th>Клиент</th>
              <th>Товар</th>
              <th>Тип</th>
              <th>Оплата</th>
              <th>Сумма</th>
              <th>Дата</th>
            </tr>
          </thead>
          <tbody>
            {recentSales.map(sale => {
              const client = state.clients.find(c => c.id === sale.clientId);
              return (
                <tr key={sale.id} className="cursor-pointer">
                  <td className="font-medium">{client ? `${client.lastName} ${client.firstName}` : '—'}</td>
                  <td className="text-muted-foreground">{sale.itemName}</td>
                  <td>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${sale.type === 'subscription' ? 'badge-loyal' : 'badge-other'}`}>
                      {sale.type === 'subscription' ? 'Абонемент' : 'Разовое'}
                    </span>
                  </td>
                  <td className="text-muted-foreground">{sale.paymentMethod === 'cash' ? 'Нал' : 'Безнал'}</td>
                  <td className="font-medium">{sale.finalPrice.toLocaleString()} ₽</td>
                  <td className="text-muted-foreground">{sale.date}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {recentSales.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">Продаж пока нет</div>
        )}
      </div>
    </div>
  );
}

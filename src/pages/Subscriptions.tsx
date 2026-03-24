import { StoreType } from '@/store';
import Icon from '@/components/ui/icon';

interface SubscriptionsProps {
  store: StoreType;
  onSell: (clientId?: string) => void;
}

export default function Subscriptions({ store, onSell }: SubscriptionsProps) {
  const { state, getClientFullName } = store;
  const branchSubs = state.subscriptions.filter(s => s.branchId === state.currentBranchId);

  const active = branchSubs.filter(s => s.status === 'active');
  const frozen = branchSubs.filter(s => s.status === 'frozen');
  const expired = branchSubs.filter(s => s.status === 'expired' || (s.status === 'active' && s.endDate < new Date().toISOString().split('T')[0]));

  const statusColor = (status: string, endDate: string) => {
    if (status === 'frozen') return 'text-blue-600 bg-blue-50 border-blue-200';
    if (status === 'returned') return 'text-muted-foreground bg-secondary border-border';
    if (endDate < new Date().toISOString().split('T')[0]) return 'text-red-600 bg-red-50 border-red-200';
    const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days <= 7) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  const statusLabel = (status: string, endDate: string) => {
    if (status === 'frozen') return '❄️ Заморожен';
    if (status === 'returned') return '↩ Возврат';
    if (endDate < new Date().toISOString().split('T')[0]) return 'Истёк';
    const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days <= 7) return `${days} дн.`;
    return 'Активен';
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Активных</div>
          <div className="text-2xl font-semibold text-green-600">{active.length}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Заморожено</div>
          <div className="text-2xl font-semibold text-blue-600">{frozen.length}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Истекших</div>
          <div className="text-2xl font-semibold text-red-600">{expired.length}</div>
        </div>
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Все абонементы</div>
          <button onClick={() => onSell()} className="flex items-center gap-1.5 text-sm bg-foreground text-primary-foreground px-3 py-1.5 rounded-lg hover:opacity-90">
            <Icon name="Plus" size={14} /> Продать абонемент
          </button>
        </div>
        <table className="w-full data-table">
          <thead>
            <tr>
              <th>Клиент</th>
              <th>Абонемент</th>
              <th>Куплен</th>
              <th>До</th>
              <th>Занятий</th>
              <th>Заморозок</th>
              <th>Оплата</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {branchSubs.map(sub => {
              const client = state.clients.find(c => c.id === sub.clientId);
              const sc = statusColor(sub.status, sub.endDate);
              const sl = statusLabel(sub.status, sub.endDate);
              return (
                <tr key={sub.id}>
                  <td className="font-medium">{client ? `${client.lastName} ${client.firstName}` : '—'}</td>
                  <td className="text-muted-foreground text-sm">{sub.planName}</td>
                  <td className="text-muted-foreground text-sm">{sub.purchaseDate}</td>
                  <td className="text-sm">{sub.endDate}</td>
                  <td className="text-sm">{sub.sessionsLeft === 'unlimited' ? '∞' : sub.sessionsLeft}</td>
                  <td className="text-sm">{sub.freezeDaysLeft} дн.</td>
                  <td className="text-sm">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${sub.paymentMethod === 'card' ? 'badge-loyal' : 'badge-other'}`}>
                      {sub.paymentMethod === 'card' ? 'Безнал' : 'Нал'}
                    </span>
                  </td>
                  <td>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${sc}`}>{sl}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {branchSubs.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">Абонементов пока нет</div>
        )}
      </div>
    </div>
  );
}

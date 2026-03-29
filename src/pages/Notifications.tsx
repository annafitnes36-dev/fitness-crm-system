import { StoreType } from '@/store';
import Icon from '@/components/ui/icon';

interface NotificationsProps {
  store: StoreType;
}

interface NotificationItem {
  clientId: string;
  name: string;
  phone: string;
  reason: string;
  detail?: string;
  icon: string;
  color: string;
  badge: string;
}

export default function Notifications({ store }: NotificationsProps) {
  const { state, getClientCategory, getClientFullName } = store;

  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const todayStr = fmt(today);
  const tomorrowStr = fmt(new Date(today.getTime() + 86400000));
  const yesterdayStr = fmt(new Date(today.getTime() - 86400000));
  const in3Days = fmt(new Date(today.getTime() + 3 * 86400000));
  const ago14Days = fmt(new Date(today.getTime() - 14 * 86400000));

  const branchClients = state.clients.filter(c => c.branchId === state.currentBranchId);

  // Все посещения в рамках текущего филиала
  const branchScheduleIds = new Set(state.schedule.filter(e => e.branchId === state.currentBranchId).map(e => e.id));

  // Первая тренировка клиента (первый enrolled/attended visit)
  const clientFirstVisitDate: Record<string, string> = {};
  state.visits
    .filter(v => branchScheduleIds.has(v.scheduleEntryId))
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach(v => {
      if (!clientFirstVisitDate[v.clientId]) clientFirstVisitDate[v.clientId] = v.date;
    });

  // Все attended визиты клиента
  const clientAttendedDates: Record<string, string[]> = {};
  state.visits.filter(v => v.status === 'attended' && branchScheduleIds.has(v.scheduleEntryId)).forEach(v => {
    if (!clientAttendedDates[v.clientId]) clientAttendedDates[v.clientId] = [];
    clientAttendedDates[v.clientId].push(v.date);
  });

  const notifications: NotificationItem[] = [];

  for (const client of branchClients) {
    const fullName = getClientFullName(client);
    const phone = client.phone;
    const sub = client.activeSubscriptionId
      ? state.subscriptions.find(s => s.id === client.activeSubscriptionId)
      : null;

    // 1. День рождения сегодня
    if (client.birthDate && client.birthDate.slice(5) === todayStr.slice(5)) {
      notifications.push({
        clientId: client.id, name: fullName, phone,
        reason: 'День рождения сегодня',
        detail: `Дата рождения: ${client.birthDate}`,
        icon: 'Cake', color: 'text-pink-500', badge: 'bg-pink-100 text-pink-700',
      });
    }

    // 2. Через 3 дня заканчивается абонемент
    if (sub && sub.status === 'active' && sub.endDate === in3Days) {
      notifications.push({
        clientId: client.id, name: fullName, phone,
        reason: 'Абонемент заканчивается через 3 дня',
        detail: `«${sub.planName}» до ${sub.endDate}`,
        icon: 'CalendarX', color: 'text-orange-500', badge: 'bg-orange-100 text-orange-700',
      });
    }

    // 3. В абонементе осталась 1 тренировка
    if (sub && sub.sessionsLeft === 1) {
      notifications.push({
        clientId: client.id, name: fullName, phone,
        reason: 'Осталась 1 тренировка в абонементе',
        detail: `«${sub.planName}»`,
        icon: 'AlertCircle', color: 'text-amber-500', badge: 'bg-amber-100 text-amber-700',
      });
    }

    // 4. Купил абонемент 2 недели назад (ровно 14 дней)
    const sales = state.sales.filter(s => s.clientId === client.id && s.type === 'subscription');
    const recentSale = sales.find(s => s.date === ago14Days);
    if (recentSale) {
      notifications.push({
        clientId: client.id, name: fullName, phone,
        reason: 'Купил абонемент 2 недели назад',
        detail: `«${recentSale.itemName}» от ${recentSale.date}`,
        icon: 'ShoppingBag', color: 'text-blue-500', badge: 'bg-blue-100 text-blue-700',
      });
    }

    // 5. Первая тренировка в истории — сегодня
    const firstDate = clientFirstVisitDate[client.id];
    const hasAttendedBefore = (clientAttendedDates[client.id] || []).some(d => d < todayStr);

    if (firstDate === todayStr && !hasAttendedBefore) {
      // Проверим что у клиента нет attended до сегодня
      const todayVisit = state.visits.find(v =>
        v.clientId === client.id && v.date === todayStr && branchScheduleIds.has(v.scheduleEntryId)
      );
      if (todayVisit) {
        notifications.push({
          clientId: client.id, name: fullName, phone,
          reason: 'Первая тренировка сегодня',
          detail: `Статус: ${todayVisit.status === 'enrolled' ? 'Записан' : todayVisit.status === 'attended' ? 'Пришёл' : todayVisit.status === 'missed' ? 'Не пришёл' : 'Отменил'}`,
          icon: 'Star', color: 'text-violet-500', badge: 'bg-violet-100 text-violet-700',
        });
      }
    }

    // 6. Первая тренировка в истории — завтра
    if (firstDate === tomorrowStr) {
      notifications.push({
        clientId: client.id, name: fullName, phone,
        reason: 'Первая тренировка завтра',
        detail: `Напомните о занятии`,
        icon: 'Bell', color: 'text-indigo-500', badge: 'bg-indigo-100 text-indigo-700',
      });
    }

    // 7. Вчера была первая тренировка, но не пришёл / отменил
    if (firstDate === yesterdayStr) {
      const yesterdayVisit = state.visits.find(v =>
        v.clientId === client.id && v.date === yesterdayStr && branchScheduleIds.has(v.scheduleEntryId)
      );
      if (yesterdayVisit && (yesterdayVisit.status === 'missed' || yesterdayVisit.status === 'cancelled')) {
        notifications.push({
          clientId: client.id, name: fullName, phone,
          reason: 'Вчера не пришёл на первую тренировку',
          detail: `Статус: ${yesterdayVisit.status === 'missed' ? 'Не пришёл' : 'Отменил'}`,
          icon: 'UserX', color: 'text-red-500', badge: 'bg-red-100 text-red-700',
        });
      }
    }

    // 8. Вчера была первая тренировка, пришёл, но нет абонемента
    if (firstDate === yesterdayStr) {
      const yesterdayVisit = state.visits.find(v =>
        v.clientId === client.id && v.date === yesterdayStr && branchScheduleIds.has(v.scheduleEntryId)
      );
      if (yesterdayVisit && yesterdayVisit.status === 'attended') {
        // Есть ли хоть один абонемент?
        const hasSub = state.subscriptions.some(s => s.clientId === client.id);
        if (!hasSub) {
          notifications.push({
            clientId: client.id, name: fullName, phone,
            reason: 'Пришёл вчера первый раз, абонемента нет',
            detail: `Пора предложить абонемент!`,
            icon: 'CreditCard', color: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700',
          });
        }
      }
    }
  }

  const groupedReasons = [
    { key: 'birthday', label: 'Дни рождения', icon: 'Cake', items: notifications.filter(n => n.reason.includes('рождения')) },
    { key: 'sub_end', label: 'Абонемент заканчивается', icon: 'CalendarX', items: notifications.filter(n => n.reason.includes('заканчивается')) },
    { key: 'last_session', label: 'Последняя тренировка', icon: 'AlertCircle', items: notifications.filter(n => n.reason.includes('1 тренировка')) },
    { key: 'two_weeks', label: 'Куплено 2 недели назад', icon: 'ShoppingBag', items: notifications.filter(n => n.reason.includes('2 недели')) },
    { key: 'first_today', label: 'Первая тренировка сегодня', icon: 'Star', items: notifications.filter(n => n.reason.includes('сегодня')) },
    { key: 'first_tomorrow', label: 'Первая тренировка завтра', icon: 'Bell', items: notifications.filter(n => n.reason.includes('завтра')) },
    { key: 'missed_first', label: 'Не пришёл на первую', icon: 'UserX', items: notifications.filter(n => n.reason.includes('не пришёл')) },
    { key: 'no_sub_after_first', label: 'После первой — нет абонемента', icon: 'CreditCard', items: notifications.filter(n => n.reason.includes('абонемента нет')) },
  ];

  const totalCount = notifications.length;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Уведомления</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Клиенты, требующие внимания сегодня
          </p>
        </div>
        {totalCount > 0 && (
          <span className="bg-red-500 text-white text-sm font-semibold px-3 py-1 rounded-full">{totalCount}</span>
        )}
      </div>

      {totalCount === 0 && (
        <div className="bg-white border border-border rounded-xl py-16 text-center">
          <Icon name="CheckCircle" size={40} className="text-emerald-400 mx-auto mb-3" />
          <div className="text-muted-foreground">Всё спокойно — уведомлений нет</div>
        </div>
      )}

      {groupedReasons.map(group => {
        if (group.items.length === 0) return null;
        return (
          <div key={group.key} className="bg-white border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center gap-2">
              <Icon name={group.icon} size={16} className="text-muted-foreground" />
              <span className="text-sm font-medium">{group.label}</span>
              <span className="ml-auto text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">{group.items.length}</span>
            </div>
            <div className="divide-y divide-border">
              {group.items.map((item, i) => (
                <div key={`${item.clientId}-${i}`} className="px-5 py-3 flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${item.badge.split(' ').slice(0, 1).join('')}`}>
                    <Icon name={item.icon} size={16} className={item.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{item.name}</div>
                    {item.detail && <div className="text-xs text-muted-foreground mt-0.5">{item.detail}</div>}
                  </div>
                  <a href={`tel:${item.phone.replace(/\D/g, '')}`}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0">
                    {item.phone}
                  </a>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${item.badge}`}>
                    {item.reason}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

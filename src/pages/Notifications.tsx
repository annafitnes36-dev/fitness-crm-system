import { useState, useEffect, useMemo } from 'react';
import { StoreType } from '@/store';
import Icon from '@/components/ui/icon';

interface NotificationsProps {
  store: StoreType;
}

interface NotificationItem {
  key: string;
  clientId: string;
  name: string;
  phone: string;
  reason: string;
  detail?: string;
  icon: string;
  color: string;
  badge: string;
  categoryKey: string;
}

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return now;
}

export default function Notifications({ store }: NotificationsProps) {
  const { state, getClientCategory: _gc, getClientFullName, dismissNotification, restoreNotification } = store;
  const now = useNow();

  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const todayStr = fmt(now);

  const catMap = useMemo(() => {
    const m: Record<string, typeof state.notificationCategories[0]> = {};
    state.notificationCategories.forEach(c => { m[c.key] = c; });
    return m;
  }, [state.notificationCategories]);

  const daysAheadSub = catMap['sub_end']?.daysAhead ?? 3;
  const daysAgoSale = catMap['two_weeks']?.daysAgo ?? 14;

  const tomorrowStr = fmt(new Date(now.getTime() + 86400000));
  const yesterdayStr = fmt(new Date(now.getTime() - 86400000));
  const inNDays = fmt(new Date(now.getTime() + daysAheadSub * 86400000));
  const agoNDays = fmt(new Date(now.getTime() - daysAgoSale * 86400000));

  const branchClients = state.clients.filter(c => c.branchId === state.currentBranchId);
  const branchSchedule = state.schedule.filter(e => e.branchId === state.currentBranchId);
  const branchScheduleIds = new Set(branchSchedule.map(e => e.id));

  const clientFirstVisitDate: Record<string, string> = {};
  state.visits
    .filter(v => branchScheduleIds.has(v.scheduleEntryId))
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach(v => {
      if (!clientFirstVisitDate[v.clientId]) clientFirstVisitDate[v.clientId] = v.date;
    });

  const clientAttendedDates: Record<string, string[]> = {};
  state.visits.filter(v => v.status === 'attended' && branchScheduleIds.has(v.scheduleEntryId)).forEach(v => {
    if (!clientAttendedDates[v.clientId]) clientAttendedDates[v.clientId] = [];
    clientAttendedDates[v.clientId].push(v.date);
  });

  // Получить имя тренировки и время по scheduleEntryId
  const getTrainingInfo = (scheduleEntryId: string) => {
    const entry = branchSchedule.find(e => e.id === scheduleEntryId);
    if (!entry) return null;
    const tt = state.trainingTypes.find(t => t.id === entry.trainingTypeId);
    return { name: tt?.name ?? 'Тренировка', time: entry.time };
  };

  const notifications: NotificationItem[] = useMemo(() => {
    const result: NotificationItem[] = [];

    for (const client of branchClients) {
      const fullName = getClientFullName(client);
      const phone = client.phone;
      const sub = client.activeSubscriptionId
        ? state.subscriptions.find(s => s.id === client.activeSubscriptionId)
        : null;

      // 1. День рождения сегодня
      if (catMap['birthday']?.enabled && client.birthDate && client.birthDate.slice(5) === todayStr.slice(5)) {
        result.push({
          key: `birthday:${client.id}:${todayStr}`,
          clientId: client.id, name: fullName, phone,
          reason: 'День рождения сегодня',
          detail: `Дата рождения: ${client.birthDate}`,
          icon: 'Cake', color: 'text-pink-500', badge: 'bg-pink-100 text-pink-700',
          categoryKey: 'birthday',
        });
      }

      // 2. Абонемент заканчивается через N дней
      if (catMap['sub_end']?.enabled && sub && sub.status === 'active' && sub.endDate === inNDays) {
        result.push({
          key: `sub_end:${client.id}:${sub.endDate}`,
          clientId: client.id, name: fullName, phone,
          reason: `Абонемент заканчивается через ${daysAheadSub} дн.`,
          detail: `«${sub.planName}» до ${sub.endDate}`,
          icon: 'CalendarX', color: 'text-orange-500', badge: 'bg-orange-100 text-orange-700',
          categoryKey: 'sub_end',
        });
      }

      // 3. Осталась 1 тренировка
      if (catMap['last_session']?.enabled && sub && sub.sessionsLeft === 1) {
        result.push({
          key: `last_session:${client.id}:${sub.id}`,
          clientId: client.id, name: fullName, phone,
          reason: 'Осталась 1 тренировка в абонементе',
          detail: `«${sub.planName}»`,
          icon: 'AlertCircle', color: 'text-amber-500', badge: 'bg-amber-100 text-amber-700',
          categoryKey: 'last_session',
        });
      }

      // 4. Купил N дней назад
      if (catMap['two_weeks']?.enabled) {
        const sales = state.sales.filter(s => s.clientId === client.id && s.type === 'subscription');
        const recentSale = sales.find(s => s.date === agoNDays);
        if (recentSale) {
          result.push({
            key: `two_weeks:${client.id}:${recentSale.date}`,
            clientId: client.id, name: fullName, phone,
            reason: `Купил абонемент ${daysAgoSale} дней назад`,
            detail: `«${recentSale.itemName}» от ${recentSale.date}`,
            icon: 'ShoppingBag', color: 'text-blue-500', badge: 'bg-blue-100 text-blue-700',
            categoryKey: 'two_weeks',
          });
        }
      }

      // 5. Первая тренировка сегодня
      const firstDate = clientFirstVisitDate[client.id];
      if (catMap['first_today']?.enabled && firstDate === todayStr) {
        const todayVisit = state.visits.find(v =>
          v.clientId === client.id && v.date === todayStr && branchScheduleIds.has(v.scheduleEntryId)
        );
        if (todayVisit) {
          const trainingInfo = getTrainingInfo(todayVisit.scheduleEntryId);
          const statusLabel = todayVisit.status === 'enrolled' ? 'Записан'
            : todayVisit.status === 'attended' ? 'Пришёл'
            : todayVisit.status === 'missed' ? 'Не пришёл' : 'Отменил';
          result.push({
            key: `first_today:${client.id}:${todayStr}`,
            clientId: client.id, name: fullName, phone,
            reason: 'Первая тренировка сегодня',
            detail: trainingInfo
              ? `${trainingInfo.time} — ${trainingInfo.name} · ${statusLabel}`
              : statusLabel,
            icon: 'Star', color: 'text-violet-500', badge: 'bg-violet-100 text-violet-700',
            categoryKey: 'first_today',
          });
        }
      }

      // 6. Первая тренировка завтра
      if (catMap['first_tomorrow']?.enabled && firstDate === tomorrowStr) {
        const tomorrowVisit = state.visits.find(v =>
          v.clientId === client.id && v.date === tomorrowStr && branchScheduleIds.has(v.scheduleEntryId)
        );
        const trainingInfo = tomorrowVisit ? getTrainingInfo(tomorrowVisit.scheduleEntryId) : null;
        result.push({
          key: `first_tomorrow:${client.id}:${tomorrowStr}`,
          clientId: client.id, name: fullName, phone,
          reason: 'Первая тренировка завтра',
          detail: trainingInfo
            ? `${trainingInfo.time} — ${trainingInfo.name}`
            : 'Напомните о занятии',
          icon: 'Bell', color: 'text-indigo-500', badge: 'bg-indigo-100 text-indigo-700',
          categoryKey: 'first_tomorrow',
        });
      }

      // 7. Вчера не пришёл на первую
      if (catMap['missed_first']?.enabled && firstDate === yesterdayStr) {
        const yesterdayVisit = state.visits.find(v =>
          v.clientId === client.id && v.date === yesterdayStr && branchScheduleIds.has(v.scheduleEntryId)
        );
        if (yesterdayVisit && (yesterdayVisit.status === 'missed' || yesterdayVisit.status === 'cancelled')) {
          const trainingInfo = getTrainingInfo(yesterdayVisit.scheduleEntryId);
          result.push({
            key: `missed_first:${client.id}:${yesterdayStr}`,
            clientId: client.id, name: fullName, phone,
            reason: 'Вчера не пришёл на первую тренировку',
            detail: trainingInfo
              ? `${trainingInfo.time} — ${trainingInfo.name}`
              : `Статус: ${yesterdayVisit.status === 'missed' ? 'Не пришёл' : 'Отменил'}`,
            icon: 'UserX', color: 'text-red-500', badge: 'bg-red-100 text-red-700',
            categoryKey: 'missed_first',
          });
        }
      }

      // 8. Пришёл вчера первый раз, нет абонемента
      if (catMap['no_sub_after_first']?.enabled && firstDate === yesterdayStr) {
        const yesterdayVisit = state.visits.find(v =>
          v.clientId === client.id && v.date === yesterdayStr && branchScheduleIds.has(v.scheduleEntryId)
        );
        if (yesterdayVisit && yesterdayVisit.status === 'attended') {
          const hasSub = state.subscriptions.some(s => s.clientId === client.id);
          if (!hasSub) {
            const trainingInfo = getTrainingInfo(yesterdayVisit.scheduleEntryId);
            result.push({
              key: `no_sub_after_first:${client.id}:${yesterdayStr}`,
              clientId: client.id, name: fullName, phone,
              reason: 'Пришёл вчера первый раз, абонемента нет',
              detail: trainingInfo
                ? `${trainingInfo.time} — ${trainingInfo.name} · Пора предложить абонемент!`
                : 'Пора предложить абонемент!',
              icon: 'CreditCard', color: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700',
              categoryKey: 'no_sub_after_first',
            });
          }
        }
      }
    }

    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, state.clients, state.subscriptions, state.visits, state.sales, state.schedule, state.notificationCategories, state.currentBranchId]);

  const dismissed = new Set(state.dismissedNotifications);
  const activeNotifications = notifications.filter(n => !dismissed.has(n.key));
  const doneNotifications = notifications.filter(n => dismissed.has(n.key));

  const groupedReasons = state.notificationCategories.map(cat => ({
    cat,
    items: activeNotifications.filter(n => n.categoryKey === cat.key),
  })).filter(g => g.items.length > 0);

  const totalCount = activeNotifications.length;
  const [showDone, setShowDone] = useState(false);

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

      {totalCount === 0 && doneNotifications.length === 0 && (
        <div className="bg-white border border-border rounded-xl py-16 text-center">
          <Icon name="CheckCircle" size={40} className="text-emerald-400 mx-auto mb-3" />
          <div className="text-muted-foreground">Всё спокойно — уведомлений нет</div>
        </div>
      )}

      {groupedReasons.map(({ cat, items }) => (
        <div key={cat.id} className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/30">
            <Icon name={cat.icon} size={15} className={cat.color} />
            <span className="text-sm font-semibold">{cat.label}</span>
            <span className="ml-auto text-xs font-semibold bg-foreground text-primary-foreground px-2 py-0.5 rounded-full">{items.length}</span>
          </div>
          <div className="divide-y divide-border/60">
            {items.map(item => (
              <div key={item.key} className="flex items-start gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{item.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{item.phone}</div>
                  {item.detail && (
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Icon name="Info" size={11} />
                      {item.detail}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => dismissNotification(item.key)}
                  title="Отметить выполненным"
                  className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full border-2 border-border hover:border-emerald-500 hover:bg-emerald-50 transition-colors flex items-center justify-center"
                >
                  <Icon name="Check" size={12} className="text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {doneNotifications.length > 0 && (
        <div>
          <button
            onClick={() => setShowDone(v => !v)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon name={showDone ? 'ChevronUp' : 'ChevronDown'} size={14} />
            Выполнено ({doneNotifications.length})
          </button>
          {showDone && (
            <div className="mt-2 bg-white border border-border rounded-xl overflow-hidden opacity-60">
              <div className="divide-y divide-border/60">
                {doneNotifications.map(item => (
                  <div key={item.key} className="flex items-start gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium line-through text-muted-foreground">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.reason}</div>
                    </div>
                    <button
                      onClick={() => restoreNotification(item.key)}
                      title="Вернуть в список"
                      className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-emerald-100 border-2 border-emerald-400 flex items-center justify-center hover:bg-emerald-200 transition-colors"
                    >
                      <Icon name="Check" size={12} className="text-emerald-600" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
import { useState, useEffect, useMemo } from 'react';
import { StoreType } from '@/store';
import Icon from '@/components/ui/icon';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import ClientCard from '@/components/ClientCard';

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

export default function Notifications({ store, onSell }: NotificationsProps & { onSell?: (clientId: string) => void }) {
  const { state, getClientCategory, getClientFullName, dismissNotification, restoreNotification, failNotification } = store;
  const now = useNow();
  const [openClientId, setOpenClientId] = useState<string | null>(null);

  // Фильтр по периоду
  const fmtDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const monthStart = fmtDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = fmtDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const [periodFrom, setPeriodFrom] = useState(monthStart);
  const [periodTo, setPeriodTo] = useState(monthEnd);

  // "Не выполнено" диалог
  const [failDialog, setFailDialog] = useState<{ key: string; name: string } | null>(null);
  const [failReason, setFailReason] = useState('');

  const [showDone, setShowDone] = useState(false);
  const [showFailed, setShowFailed] = useState(false);

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

  // Первая тренировка = первая запись/посещение (не отменённая)
  const clientFirstVisitDate: Record<string, string> = {};
  state.visits
    .filter(v => branchScheduleIds.has(v.scheduleEntryId) && v.status !== 'cancelled')
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
      // Лояльный клиент без реальных посещений — это перенесённый клиент, "первые" уведомления не нужны
      const hasRealVisits = state.visits.some(v => v.clientId === client.id && v.status === 'attended');
      const isLoyalWithoutVisits = getClientCategory(client) === 'loyal' && !hasRealVisits;
      // Если у клиента есть абонемент купленный до первой тренировки — не показываем уведомления о "первой записи новичка"
      const clientSubSales = state.sales.filter(s => s.clientId === client.id && s.type === 'subscription' && !s.isRefund);
      const hasSubBeforeFirstVisit = firstDate
        ? clientSubSales.some(s => s.date <= firstDate)
        : clientSubSales.length > 0;
      if (!isLoyalWithoutVisits && !hasSubBeforeFirstVisit && catMap['first_today']?.enabled && firstDate === todayStr) {
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
      if (!isLoyalWithoutVisits && !hasSubBeforeFirstVisit && catMap['first_tomorrow']?.enabled && firstDate === tomorrowStr) {
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
      if (!isLoyalWithoutVisits && !hasSubBeforeFirstVisit && catMap['missed_first']?.enabled && firstDate === yesterdayStr) {
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

      // 9. Новичок отменил первую и перезаписался на другую
      if (!isLoyalWithoutVisits && !hasSubBeforeFirstVisit && catMap['newcomer_rescheduled']?.enabled) {
        const allSubs = state.sales.filter(s => s.clientId === client.id && s.type === 'subscription');
        if (allSubs.length === 0) {
          // Есть отменённая запись на первую тренировку
          const cancelledVisit = state.visits.find(v =>
            v.clientId === client.id && v.status === 'cancelled' && branchScheduleIds.has(v.scheduleEntryId)
          );
          if (cancelledVisit) {
            // Есть новая активная запись после отмены
            const newVisit = state.visits.find(v =>
              v.clientId === client.id && v.status === 'enrolled' &&
              branchScheduleIds.has(v.scheduleEntryId) && v.date >= todayStr
            );
            if (newVisit) {
              const cancelInfo = getTrainingInfo(cancelledVisit.scheduleEntryId);
              const newInfo = getTrainingInfo(newVisit.scheduleEntryId);
              result.push({
                key: `newcomer_rescheduled:${client.id}:${newVisit.scheduleEntryId}`,
                clientId: client.id, name: fullName, phone,
                reason: 'Новичок отменил и перезаписался',
                detail: newInfo
                  ? `Новая запись: ${newInfo.time} — ${newInfo.name} (${newVisit.date})${cancelInfo ? ` · Отменил: ${cancelInfo.name}` : ''}`
                  : 'Перезаписался на новую тренировку',
                icon: 'RefreshCw', color: 'text-teal-500', badge: 'bg-teal-100 text-teal-700',
                categoryKey: 'newcomer_rescheduled',
              });
            }
          }
        }
      }

      // 8. Пришёл вчера первый раз, нет абонемента
      if (!isLoyalWithoutVisits && catMap['no_sub_after_first']?.enabled && firstDate === yesterdayStr) {
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
  const failedMap: Record<string, string> = state.failedNotifications ?? {};
  const activeNotifications = notifications.filter(n => !dismissed.has(n.key));
  const doneNotifications = notifications.filter(n => dismissed.has(n.key) && !failedMap[n.key]);
  const failedNotifications = notifications.filter(n => dismissed.has(n.key) && failedMap[n.key]);

  const groupedReasons = state.notificationCategories.map(cat => ({
    cat,
    items: activeNotifications.filter(n => n.categoryKey === cat.key),
  })).filter(g => g.items.length > 0);

  const totalCount = activeNotifications.length;
  const totalProcessed = doneNotifications.length + failedNotifications.length;
  const donePercent = totalProcessed > 0 ? Math.round(doneNotifications.length / totalProcessed * 100) : 0;
  const failedPercent = totalProcessed > 0 ? Math.round(failedNotifications.length / totalProcessed * 100) : 0;

  const handleFail = () => {
    if (!failDialog || !failReason.trim()) return;
    failNotification(failDialog.key, failReason.trim());
    setFailDialog(null);
    setFailReason('');
  };

  const renderItem = (item: NotificationItem, isDone = false) => (
    <div key={item.key} className="flex items-start gap-3 px-4 py-3">
      <div className="flex-1 min-w-0">
        <button
          onClick={() => setOpenClientId(item.clientId)}
          className={`text-sm font-medium text-left hover:underline ${isDone ? 'line-through text-muted-foreground' : ''}`}
        >
          {item.name}
        </button>
        <div className="text-xs text-muted-foreground mt-0.5">{item.phone}</div>
        {isDone && failedMap[item.key] && (
          <div className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
            <Icon name="AlertCircle" size={11} />
            Причина: {failedMap[item.key]}
          </div>
        )}
        {!isDone && item.detail && (
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <Icon name="Info" size={11} />
            {item.detail}
          </div>
        )}
      </div>
      {isDone ? (
        <button
          onClick={() => restoreNotification(item.key)}
          title="Вернуть в список"
          className={`flex-shrink-0 mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center hover:opacity-80 transition-colors ${failedMap[item.key] ? 'bg-red-100 border-red-400' : 'bg-emerald-100 border-emerald-400'}`}
        >
          <Icon name={failedMap[item.key] ? 'X' : 'Check'} size={12} className={failedMap[item.key] ? 'text-red-600' : 'text-emerald-600'} />
        </button>
      ) : (
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          <button
            onClick={() => dismissNotification(item.key)}
            title="Выполнено"
            className="w-6 h-6 rounded-full border-2 border-border hover:border-emerald-500 hover:bg-emerald-50 transition-colors flex items-center justify-center"
          >
            <Icon name="Check" size={12} className="text-muted-foreground" />
          </button>
          <button
            onClick={() => { setFailDialog({ key: item.key, name: item.name }); setFailReason(''); }}
            title="Не выполнено"
            className="w-6 h-6 rounded-full border-2 border-border hover:border-red-400 hover:bg-red-50 transition-colors flex items-center justify-center"
          >
            <Icon name="X" size={12} className="text-muted-foreground" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Заголовок + период */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold">Уведомления</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Клиенты, требующие внимания</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} className="h-8 text-xs w-36" />
            <span className="text-muted-foreground text-xs">—</span>
            <Input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)} className="h-8 text-xs w-36" />
          </div>
          {totalCount > 0 && (
            <span className="bg-red-500 text-white text-sm font-semibold px-3 py-1 rounded-full">{totalCount}</span>
          )}
        </div>
      </div>

      {/* Счётчик выполнено/не выполнено */}
      {totalProcessed > 0 && (
        <div className="bg-white border border-border rounded-xl px-4 py-3 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-400" />
            <span className="text-sm">Выполнено: <strong>{doneNotifications.length}</strong> <span className="text-muted-foreground text-xs">({donePercent}%)</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <span className="text-sm">Не выполнено: <strong>{failedNotifications.length}</strong> <span className="text-muted-foreground text-xs">({failedPercent}%)</span></span>
          </div>
          <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden ml-2">
            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${donePercent}%` }} />
          </div>
        </div>
      )}

      {totalCount === 0 && totalProcessed === 0 && (
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
            {items.map(item => renderItem(item))}
          </div>
        </div>
      ))}

      {/* Карточка клиента */}
      {openClientId && (() => {
        const client = state.clients.find(c => c.id === openClientId);
        if (!client) return null;
        return (
          <Dialog open onOpenChange={v => { if (!v) setOpenClientId(null); }}>
            <DialogContent className="max-w-md p-0 overflow-hidden">
              <ClientCard
                client={client}
                store={store}
                onClose={() => setOpenClientId(null)}
                onSell={() => { setOpenClientId(null); onSell?.(client.id); }}
              />
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Диалог "не выполнено" */}
      <Dialog open={!!failDialog} onOpenChange={v => { if (!v) { setFailDialog(null); setFailReason(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Не выполнено — укажите причину</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">{failDialog?.name}</div>
            <div>
              <Label className="text-xs mb-1 block">Причина *</Label>
              <Textarea
                value={failReason}
                onChange={e => setFailReason(e.target.value)}
                placeholder="Не дозвонился, клиент отказался и т.д."
                rows={3}
                className="resize-none"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setFailDialog(null); setFailReason(''); }} className="flex-1">Отмена</Button>
              <Button onClick={handleFail} disabled={!failReason.trim()} className="flex-1 bg-red-500 hover:bg-red-600 text-white">Сохранить</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Выполнено */}
      {doneNotifications.length > 0 && (
        <div>
          <button onClick={() => setShowDone(v => !v)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Icon name={showDone ? 'ChevronUp' : 'ChevronDown'} size={14} />
            Выполнено ({doneNotifications.length})
          </button>
          {showDone && (
            <div className="mt-2 bg-white border border-border rounded-xl overflow-hidden opacity-70">
              <div className="divide-y divide-border/60">
                {doneNotifications.map(item => renderItem(item, true))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Не выполнено */}
      {failedNotifications.length > 0 && (
        <div>
          <button onClick={() => setShowFailed(v => !v)} className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 transition-colors">
            <Icon name={showFailed ? 'ChevronUp' : 'ChevronDown'} size={14} />
            Не выполнено ({failedNotifications.length})
          </button>
          {showFailed && (
            <div className="mt-2 bg-white border border-red-200 rounded-xl overflow-hidden opacity-70">
              <div className="divide-y divide-border/60">
                {failedNotifications.map(item => renderItem(item, true))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
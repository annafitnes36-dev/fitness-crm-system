import { useState } from 'react';
import { StoreType, Client } from '@/store';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ClientCardProps {
  client: Client;
  store: StoreType;
  onClose: () => void;
  onSell: () => void;
}

const CHANNEL_ICONS: Record<string, string> = {
  whatsapp: '📱', telegram: '✈️', phone: '📞', instagram: '📸', vk: '💬'
};

export default function ClientCard({ client, store, onClose, onSell }: ClientCardProps) {
  const { state, getClientCategory, getClientFullName, freezeSubscription, returnSubscription, updateSubscription, enrollClient } = store;
  const [showFreeze, setShowFreeze] = useState(false);
  const [showExtend, setShowExtend] = useState(false);
  const [freezeDays, setFreezeDays] = useState(7);
  const [extendDays, setExtendDays] = useState(0);
  const [extendSessions, setExtendSessions] = useState(0);
  const [showEnroll, setShowEnroll] = useState(false);

  const cat = getClientCategory(client);
  const sub = client.activeSubscriptionId ? state.subscriptions.find(s => s.id === client.activeSubscriptionId) : null;
  const allSubs = state.subscriptions.filter(s => s.clientId === client.id);
  const visits = state.visits.filter(v => v.clientId === client.id);
  const sales = state.sales.filter(s => s.clientId === client.id);
  const branch = state.branches.find(b => b.id === client.branchId);

  const catLabel = { new: 'Новичок', loyal: 'Лояльный', sleeping: 'Уснувший', lost: 'Потерянный' }[cat];
  const badgeClass = { new: 'badge-new', loyal: 'badge-loyal', sleeping: 'badge-sleeping', lost: 'badge-lost' }[cat];

  const todaySchedule = state.schedule.filter(e => e.branchId === state.currentBranchId && e.date >= new Date().toISOString().split('T')[0]);

  const daysUntilEnd = sub ? Math.ceil((new Date(sub.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  const handleFreeze = () => {
    if (!sub) return;
    freezeSubscription(sub.id, freezeDays);
    setShowFreeze(false);
  };

  const handleExtend = () => {
    if (!sub) return;
    const addDays = (d: string, n: number) => {
      const dt = new Date(d);
      dt.setDate(dt.getDate() + n);
      return dt.toISOString().split('T')[0];
    };
    const updates: Partial<typeof sub> = {};
    if (extendDays > 0) updates.endDate = addDays(sub.endDate, extendDays);
    if (extendSessions > 0 && sub.sessionsLeft !== 'unlimited') {
      updates.sessionsLeft = (sub.sessionsLeft as number) + extendSessions;
    }
    updateSubscription(sub.id, updates);
    setShowExtend(false);
  };

  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-start justify-between">
        <div>
          <div className="font-semibold text-base">{getClientFullName(client)}</div>
          <div className="text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
            <span>{CHANNEL_ICONS[client.contactChannel]}</span>
            <span>{client.phone}</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${badgeClass}`}>{catLabel}</span>
            {branch && <span className="text-xs text-muted-foreground">{branch.name}</span>}
            {client.fromBranchId && <span className="text-xs text-amber-600">другой филиал</span>}
          </div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
          <Icon name="X" size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Info */}
        <div className="px-5 py-4 border-b border-border">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {client.birthDate && (
              <div><span className="text-muted-foreground">День рождения: </span>{client.birthDate}</div>
            )}
            {client.referralSource && (
              <div><span className="text-muted-foreground">Источник: </span>{client.referralSource}</div>
            )}
            {client.adSource && (
              <div><span className="text-muted-foreground">Реклама: </span>{client.adSource}</div>
            )}
          </div>
          {client.comment && (
            <div className="mt-2 text-sm bg-secondary rounded-lg px-3 py-2 text-muted-foreground">{client.comment}</div>
          )}
        </div>

        {/* Active subscription */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Активный абонемент</span>
            <button onClick={onSell} className="text-xs bg-foreground text-primary-foreground px-3 py-1.5 rounded-lg hover:opacity-90 flex items-center gap-1">
              <Icon name="Plus" size={12} /> Продать
            </button>
          </div>

          {sub ? (
            <div className="space-y-3">
              <div className="bg-secondary rounded-xl p-3">
                <div className="font-medium text-sm">{sub.planName}</div>
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-muted-foreground">
                  <div>Куплен: {sub.purchaseDate}</div>
                  <div>До: {sub.endDate}</div>
                  <div>
                    Занятий: {sub.sessionsLeft === 'unlimited' ? '∞' : sub.sessionsLeft}
                  </div>
                  <div>Заморозок: {sub.freezeDaysLeft} дн.</div>
                </div>
                {daysUntilEnd !== null && (
                  <div className={`mt-2 text-xs font-medium ${daysUntilEnd <= 3 ? 'text-red-600' : daysUntilEnd <= 7 ? 'text-amber-600' : 'text-green-600'}`}>
                    {daysUntilEnd > 0 ? `Осталось ${daysUntilEnd} дн.` : 'Истёк'}
                  </div>
                )}
                {sub.status === 'frozen' && (
                  <div className="mt-2 text-xs text-blue-600">❄️ Заморожен до {sub.frozenTo}</div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowFreeze(true)}
                  disabled={sub.status === 'frozen' || sub.freezeDaysLeft <= 0}
                  className="flex-1 text-xs border border-border rounded-lg py-2 hover:bg-secondary disabled:opacity-40 transition-colors"
                >
                  ❄️ Заморозить
                </button>
                <button
                  onClick={() => setShowExtend(true)}
                  className="flex-1 text-xs border border-border rounded-lg py-2 hover:bg-secondary transition-colors"
                >
                  ⏱ Изменить срок
                </button>
                <button
                  onClick={() => { if (confirm('Сделать возврат?')) returnSubscription(sub.id); }}
                  className="flex-1 text-xs border border-red-200 text-red-600 rounded-lg py-2 hover:bg-red-50 transition-colors"
                >
                  ↩ Возврат
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground py-2">Нет активного абонемента</div>
          )}
        </div>

        {/* Visits history */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">История посещений</span>
            <button onClick={() => setShowEnroll(true)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <Icon name="Plus" size={12} /> Записать
            </button>
          </div>
          <div className="space-y-1.5">
            {visits.slice(-5).reverse().map(v => {
              const entry = state.schedule.find(e => e.id === v.scheduleEntryId);
              const tt = entry ? state.trainingTypes.find(t => t.id === entry.trainingTypeId) : null;
              return (
                <div key={v.id} className="flex items-center justify-between text-sm py-1">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: tt?.color || '#888' }} />
                    <span className="text-muted-foreground">{v.date}</span>
                    <span>{tt?.name || '—'}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    v.status === 'attended' ? 'badge-loyal' : v.status === 'missed' ? 'badge-lost' : 'badge-other'
                  }`}>
                    {v.status === 'attended' ? 'Пришёл' : v.status === 'missed' ? 'Прогул' : 'Записан'}
                  </span>
                </div>
              );
            })}
            {visits.length === 0 && <div className="text-sm text-muted-foreground">Посещений нет</div>}
          </div>
        </div>

        {/* Purchase history */}
        <div className="px-5 py-4">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">История покупок</div>
          <div className="space-y-1.5">
            {sales.slice(-5).reverse().map(s => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{s.itemName}</div>
                  <div className="text-xs text-muted-foreground">{s.date} · {s.paymentMethod === 'cash' ? 'Нал' : 'Безнал'}</div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{s.finalPrice.toLocaleString()} ₽</div>
                  {s.discount > 0 && <div className="text-xs text-muted-foreground">-{s.discount}%</div>}
                </div>
              </div>
            ))}
            {sales.length === 0 && <div className="text-sm text-muted-foreground">Покупок нет</div>}
          </div>
        </div>
      </div>

      {/* Freeze modal */}
      <Dialog open={showFreeze} onOpenChange={setShowFreeze}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Заморозить абонемент</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Количество дней (макс. {sub?.freezeDaysLeft})</Label>
              <Input type="number" value={freezeDays} min={1} max={sub?.freezeDaysLeft || 30}
                onChange={e => setFreezeDays(Number(e.target.value))} />
            </div>
            <p className="text-sm text-muted-foreground">Срок абонемента будет продлён на {freezeDays} дней.</p>
            <Button onClick={handleFreeze} className="w-full bg-foreground text-primary-foreground">Заморозить</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Extend modal */}
      <Dialog open={showExtend} onOpenChange={setShowExtend}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Изменить срок / лимит</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Добавить дней</Label>
              <Input type="number" value={extendDays} min={0} onChange={e => setExtendDays(Number(e.target.value))} />
            </div>
            {sub && sub.sessionsLeft !== 'unlimited' && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Добавить занятий</Label>
                <Input type="number" value={extendSessions} min={0} onChange={e => setExtendSessions(Number(e.target.value))} />
              </div>
            )}
            <Button onClick={handleExtend} className="w-full bg-foreground text-primary-foreground">Применить</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Enroll modal */}
      <Dialog open={showEnroll} onOpenChange={setShowEnroll}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Записать на тренировку</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {todaySchedule.map(entry => {
              const tt = state.trainingTypes.find(t => t.id === entry.trainingTypeId);
              const already = entry.enrolledClientIds.includes(client.id);
              const full = entry.enrolledClientIds.length >= entry.maxCapacity;
              return (
                <button
                  key={entry.id}
                  disabled={already || full}
                  onClick={() => { enrollClient(entry.id, client.id); setShowEnroll(false); }}
                  className={`w-full flex items-center justify-between px-3 py-3 rounded-lg border text-sm transition-colors ${already ? 'border-green-200 bg-green-50' : full ? 'opacity-50 cursor-not-allowed border-border' : 'border-border hover:bg-secondary'}`}
                >
                  <div className="text-left">
                    <div className="font-medium">{entry.time} — {tt?.name}</div>
                    <div className="text-xs text-muted-foreground">{entry.date}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {already ? '✓ Записан' : `${entry.enrolledClientIds.length}/${entry.maxCapacity}`}
                  </div>
                </button>
              );
            })}
            {todaySchedule.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Нет доступных тренировок</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

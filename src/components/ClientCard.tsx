import { useState, useRef, useEffect } from 'react';
import { StoreType, Client, ClientCategory } from '@/store';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const CHANNELS = ['whatsapp', 'telegram', 'phone', 'instagram', 'vk'];
const REFERRALS = ['Друзья', 'Интернет', 'Мимо проходил(а)', 'Блогер', 'Реклама', 'Другое'];
const AD_SOURCES = ['Instagram', 'VK', 'Яндекс', 'Google', 'Листовка', 'Сарафанное радио', 'Другое'];

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
  const { state, getClientCategory, getClientFullName, freezeSubscription, returnSubscription, updateSubscription, enrollClient, updateClient, deleteClient, getClientBonusBalance } = store;
  const [showFreeze, setShowFreeze] = useState(false);
  const [showExtend, setShowExtend] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [returnPayMethod, setReturnPayMethod] = useState<'cash' | 'card'>('cash');
  const [freezeDays, setFreezeDays] = useState(7);
  const [extendDays, setExtendDays] = useState(0);
  const [extendSessions, setExtendSessions] = useState(0);
  const [extendTargetDate, setExtendTargetDate] = useState('');
  const [showEnroll, setShowEnroll] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: client.firstName, lastName: client.lastName, middleName: client.middleName,
    phone: client.phone, contactChannel: client.contactChannel,
    referralSource: client.referralSource, adSource: client.adSource,
    birthDate: client.birthDate, comment: client.comment,
  });

  const currentStaff = state.staff.find(m => m.id === state.currentStaffId);
  const canEditStatus = currentStaff?.role === 'director' || currentStaff?.role === 'manager';
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setShowStatusMenu(false);
      }
    };
    if (showStatusMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showStatusMenu]);

  const cat = getClientCategory(client);
  const allSubs = state.subscriptions.filter(s => s.clientId === client.id);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Активные абонементы: active, pending, frozen (не истёк срок, не возврат, не 0 занятий)
  const activeSubs = allSubs.filter(s => {
    if (s.status === 'returned') return false;
    if (s.status === 'expired') return false;
    if (s.status !== 'active' && s.status !== 'pending' && s.status !== 'frozen') return false;
    // Проверяем срок
    const endDate = new Date(s.endDate);
    endDate.setHours(0, 0, 0, 0);
    if (endDate < today) return false;
    // Проверяем лимит занятий
    if (s.sessionsLeft !== 'unlimited' && (s.sessionsLeft as number) <= 0) return false;
    return true;
  });

  // Для обратной совместимости с freeze/extend/return — берём первый активный абонемент
  const sub = activeSubs[0] || null;
  const visits = state.visits.filter(v => v.clientId === client.id);
  const sales = state.sales.filter(s => s.clientId === client.id);
  const branch = state.branches.find(b => b.id === client.branchId);

  // Metrics
  const totalSpent = sales.reduce((sum, s) => sum + s.finalPrice, 0) + (client.importedSpent || 0);
  const attendedVisits = visits.filter(v => v.status === 'attended');
  // Visits per week: count last 4 weeks
  const fourWeeksAgo = new Date(); fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const recentAttended = attendedVisits.filter(v => new Date(v.date) >= fourWeeksAgo);
  const visitsPerWeek = recentAttended.length > 0 ? (recentAttended.length / 4).toFixed(1) : '0';
  // Стоимость за тренировку: цена последнего активного абонемента / кол-во занятий
  // Если безлимит — делить на (среднее посещений/нед с момента активации × 4)
  const avgTrainingCost = (() => {
    if (!sub) return null;
    const plan = state.subscriptionPlans.find(p => p.id === sub.planId);
    const subPrice = sub.price || plan?.price || 0;
    if (subPrice === 0) return null;
    if (sub.sessionsLimit !== 'unlimited' && plan && (plan.sessionsLimit as number) > 0) {
      return Math.round(subPrice / (plan.sessionsLimit as number));
    }
    // безлимит — считаем среднее посещений/нед с момента активации
    const activatedAt = new Date(sub.purchaseDate);
    const now = new Date();
    const weeksElapsed = Math.max(1, (now.getTime() - activatedAt.getTime()) / (1000 * 60 * 60 * 24 * 7));
    const attendedSinceActivation = attendedVisits.filter(v => new Date(v.date) >= activatedAt).length;
    const avgPerWeek = attendedSinceActivation / weeksElapsed;
    const monthlyVisits = avgPerWeek * 4;
    if (monthlyVisits < 0.5) return null;
    return Math.round(subPrice / monthlyVisits);
  })();

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
    const addDaysToDate = (d: string, n: number) => {
      const dt = new Date(d);
      dt.setDate(dt.getDate() + n);
      return dt.toISOString().split('T')[0];
    };
    const updates: Partial<typeof sub> = {};
    if (extendTargetDate) {
      updates.endDate = extendTargetDate;
    } else if (extendDays > 0) {
      updates.endDate = addDaysToDate(sub.endDate, extendDays);
    }
    if (extendSessions > 0 && sub.sessionsLeft !== 'unlimited') {
      updates.sessionsLeft = (sub.sessionsLeft as number) + extendSessions;
    }
    updateSubscription(sub.id, updates);
    setExtendDays(0);
    setExtendTargetDate('');
    setExtendSessions(0);
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
            {canEditStatus ? (
              <div className="relative" ref={statusMenuRef}>
                <button
                  onClick={() => setShowStatusMenu(v => !v)}
                  className={`text-xs px-2 py-0.5 rounded-full ${badgeClass} flex items-center gap-1 hover:opacity-80 transition-opacity`}
                >
                  {catLabel}
                  <Icon name="ChevronDown" size={10} />
                </button>
                {showStatusMenu && (
                  <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-border rounded-lg shadow-lg py-1 min-w-[140px]">
                    {([
                      { value: 'new', label: 'Новичок', cls: 'badge-new' },
                      { value: 'loyal', label: 'Лояльный', cls: 'badge-loyal' },
                      { value: 'sleeping', label: 'Уснувший', cls: 'badge-sleeping' },
                      { value: 'lost', label: 'Потерянный', cls: 'badge-lost' },
                    ] as { value: ClientCategory; label: string; cls: string }[]).map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          updateClient(client.id, { manualStatus: opt.value });
                          setShowStatusMenu(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex items-center gap-2 ${cat === opt.value ? 'font-semibold' : ''}`}
                      >
                        <span className={`inline-block w-2 h-2 rounded-full ${opt.cls}`} />
                        {opt.label}
                        {cat === opt.value && <Icon name="Check" size={10} className="ml-auto" />}
                      </button>
                    ))}
                    {client.manualStatus && (
                      <button
                        onClick={() => {
                          updateClient(client.id, { manualStatus: undefined });
                          setShowStatusMenu(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted border-t border-border mt-1 pt-1"
                      >
                        Сбросить (авто)
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <span className={`text-xs px-2 py-0.5 rounded-full ${badgeClass}`}>{catLabel}</span>
            )}
            {branch && <span className="text-xs text-muted-foreground">{branch.name}</span>}
            {client.fromBranchId && <span className="text-xs text-amber-600">другой филиал</span>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowEdit(true)} className="text-muted-foreground hover:text-foreground p-1" title="Редактировать">
            <Icon name="Pencil" size={15} />
          </button>
          <button onClick={() => setShowDeleteConfirm(true)} className="text-muted-foreground hover:text-destructive p-1" title="Удалить клиента">
            <Icon name="Trash2" size={15} />
          </button>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <Icon name="X" size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Stats metrics */}
        <div className="px-5 py-4 border-b border-border">
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-secondary rounded-xl px-2 py-2.5 text-center">
              <div className="text-lg font-bold leading-tight">{attendedVisits.length}</div>
              <div className="text-xs text-muted-foreground mt-0.5">визитов всего</div>
            </div>
            <div className="bg-secondary rounded-xl px-2 py-2.5 text-center">
              <div className="text-lg font-bold leading-tight">{visitsPerWeek}</div>
              <div className="text-xs text-muted-foreground mt-0.5">раз/неделю</div>
            </div>
            <div className="bg-secondary rounded-xl px-2 py-2.5 text-center">
              <div className="text-lg font-bold leading-tight">{totalSpent > 0 ? `${(totalSpent / 1000).toFixed(1)}к` : '—'}</div>
              <div className="text-xs text-muted-foreground mt-0.5">потрачено ₽</div>
            </div>
            <div className="bg-secondary rounded-xl px-2 py-2.5 text-center">
              <div className="text-lg font-bold leading-tight">{avgTrainingCost ? `${avgTrainingCost}₽` : '—'}</div>
              <div className="text-xs text-muted-foreground mt-0.5">за тренировку</div>
            </div>
          </div>
          {state.bonusSettings?.enabled && (() => {
            const balance = getClientBonusBalance(client.id, client.branchId);
            const txs = (state.bonusTransactions || []).filter(t => t.clientId === client.id && t.branchId === client.branchId);
            const totalAccrued = txs.filter(t => t.type === 'accrual').reduce((s, t) => s + t.amount, 0);
            const totalSpentBonus = txs.filter(t => t.type === 'spend').reduce((s, t) => s + t.amount, 0);
            return (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎁</span>
                  <div>
                    <div className="text-sm font-semibold text-amber-800">{balance} бонусов</div>
                    <div className="text-xs text-amber-600">начислено {totalAccrued} · потрачено {totalSpentBonus}</div>
                  </div>
                </div>
                {state.bonusSettings.expiryDays && totalAccrued > 0 && (
                  <div className="text-xs text-amber-600 text-right">
                    срок действия<br/>{state.bonusSettings.expiryDays} дн.
                  </div>
                )}
              </div>
            );
          })()}
        </div>

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
            <div className="mt-2 text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-800 flex gap-2 items-start">
              <span className="mt-0.5 shrink-0">💬</span>
              <span>{client.comment}</span>
            </div>
          )}
        </div>

        {/* Active subscriptions */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Активные абонементы{activeSubs.length > 1 ? ` (${activeSubs.length})` : ''}
            </span>
            <button onClick={onSell} className="text-xs bg-foreground text-primary-foreground px-3 py-1.5 rounded-lg hover:opacity-90 flex items-center gap-1">
              <Icon name="Plus" size={12} /> Продать
            </button>
          </div>

          {activeSubs.length > 0 ? (
            <div className="space-y-3">
              {activeSubs.map((activeSub, idx) => {
                const daysLeft = Math.ceil((new Date(activeSub.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={activeSub.id} className="space-y-2">
                    <div className="bg-secondary rounded-xl p-3">
                      <div className="font-medium text-sm">{activeSub.planName}</div>
                      {activeSub.status === 'pending' && (
                        <div className="mt-1 text-xs text-amber-600 font-medium">⏳ Ожидает активации</div>
                      )}
                      <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-muted-foreground">
                        <div>Куплен: {activeSub.purchaseDate ? new Date(activeSub.purchaseDate).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}</div>
                        <div>До: {activeSub.endDate ? new Date(activeSub.endDate).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}</div>
                        {activeSub.activatedAt && (
                          <div className="col-span-2">Активирован: {new Date(activeSub.activatedAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
                        )}
                        <div>
                          Занятий: {activeSub.sessionsLeft === 'unlimited' ? '∞' : activeSub.sessionsLeft}
                        </div>
                        <div>Заморозок: {activeSub.freezeDaysLeft} дн.</div>
                      </div>
                      <div className={`mt-2 text-xs font-medium ${daysLeft <= 3 ? 'text-red-600' : daysLeft <= 7 ? 'text-amber-600' : 'text-green-600'}`}>
                        {daysLeft > 0 ? `Осталось ${daysLeft} дн.` : 'Истёк'}
                      </div>
                      {activeSub.status === 'frozen' && (
                        <div className="mt-1 text-xs text-blue-600">❄️ Заморожен до {activeSub.frozenTo}</div>
                      )}
                    </div>
                    {idx === 0 && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowFreeze(true)}
                          disabled={activeSub.status === 'frozen' || activeSub.freezeDaysLeft <= 0}
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
                          onClick={() => { setReturnPayMethod('cash'); setShowReturn(true); }}
                          className="flex-1 text-xs border border-red-200 text-red-600 rounded-lg py-2 hover:bg-red-50 transition-colors"
                        >
                          ↩ Возврат
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
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
          <div className="space-y-2">
            {sales.slice().reverse().map(s => {
              // Определяем причину неактивности для абонементов
              let inactiveReason: string | null = null;
              if (s.type === 'subscription' && !s.isRefund) {
                const relatedSub = allSubs.find(sub => {
                  // Ищем абонемент, проданный в эту дату с таким же планом
                  return sub.planId === s.itemId && sub.purchaseDate === s.date && sub.clientId === client.id;
                }) || allSubs.find(sub => sub.planId === s.itemId && sub.clientId === client.id && Math.abs(new Date(sub.purchaseDate).getTime() - new Date(s.date).getTime()) < 86400000);

                if (relatedSub) {
                  if (relatedSub.status === 'returned') {
                    inactiveReason = 'Возврат';
                  } else {
                    const endDate = new Date(relatedSub.endDate);
                    endDate.setHours(0, 0, 0, 0);
                    const todayCheck = new Date();
                    todayCheck.setHours(0, 0, 0, 0);
                    const sessionsOut = relatedSub.sessionsLeft !== 'unlimited' && (relatedSub.sessionsLeft as number) <= 0;
                    const expired = endDate < todayCheck;
                    if (sessionsOut && expired) {
                      inactiveReason = 'Занятия закончились · Срок истёк';
                    } else if (sessionsOut) {
                      inactiveReason = 'Занятия закончились';
                    } else if (expired) {
                      inactiveReason = 'Срок истёк';
                    }
                  }
                }
              }

              return (
                <div key={s.id} className="flex items-start justify-between text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{s.itemName}</div>
                    <div className="text-xs text-muted-foreground">{s.date} · {s.paymentMethod === 'cash' ? 'Нал' : s.paymentMethod === 'bonus' ? 'Бонусы' : 'Безнал'}</div>
                    {s.isRefund && (
                      <div className="text-xs text-red-500 font-medium mt-0.5">↩ Возврат</div>
                    )}
                    {!s.isRefund && inactiveReason && (
                      <div className="text-xs text-orange-500 mt-0.5">⚠ {inactiveReason}</div>
                    )}
                  </div>
                  <div className="text-right ml-3 shrink-0">
                    <div className={`font-medium ${s.isRefund ? 'text-red-500' : ''}`}>{s.isRefund ? '−' : ''}{s.finalPrice.toLocaleString()} ₽</div>
                    {s.discount > 0 && <div className="text-xs text-muted-foreground">-{s.discount}%</div>}
                  </div>
                </div>
              );
            })}
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
      <Dialog open={showExtend} onOpenChange={v => { setShowExtend(v); if (!v) { setExtendDays(0); setExtendTargetDate(''); setExtendSessions(0); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Изменить срок / лимит</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {sub && (
              <div className="text-xs text-muted-foreground bg-secondary rounded-lg px-3 py-2">
                Текущая дата окончания: <span className="font-medium text-foreground">{sub.endDate ? new Date(sub.endDate).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}</span>
              </div>
            )}
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Добавить дней</Label>
              <Input
                type="number"
                value={extendDays || ''}
                min={0}
                placeholder="0"
                disabled={!!extendTargetDate}
                onChange={e => setExtendDays(Number(e.target.value))}
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="flex-1 h-px bg-border" />
              <span>или укажите дату напрямую</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Итоговая дата окончания</Label>
              <Input
                type="date"
                value={extendTargetDate}
                disabled={extendDays > 0}
                onChange={e => setExtendTargetDate(e.target.value)}
              />
            </div>
            {sub && sub.sessionsLeft !== 'unlimited' && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Добавить занятий</Label>
                <Input type="number" value={extendSessions || ''} min={0} placeholder="0" onChange={e => setExtendSessions(Number(e.target.value))} />
              </div>
            )}
            <Button onClick={handleExtend} disabled={!extendDays && !extendTargetDate && !extendSessions} className="w-full bg-foreground text-primary-foreground">Применить</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit client modal */}
      <Dialog open={showEdit} onOpenChange={v => { if (!v) setShowEdit(false); }}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Редактировать клиента</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Фамилия</Label>
                <Input value={editForm.lastName} onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Имя</Label>
                <Input value={editForm.firstName} onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Отчество</Label>
              <Input value={editForm.middleName} onChange={e => setEditForm(f => ({ ...f, middleName: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Телефон</Label>
              <Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Канал связи</Label>
              <select value={editForm.contactChannel} onChange={e => setEditForm(f => ({ ...f, contactChannel: e.target.value as Client['contactChannel'] }))}
                className="w-full h-9 text-sm border border-input rounded-md px-2 bg-white">
                {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Дата рождения</Label>
              <Input type="date" value={editForm.birthDate} onChange={e => setEditForm(f => ({ ...f, birthDate: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Источник (откуда узнал)</Label>
              <select value={editForm.referralSource} onChange={e => setEditForm(f => ({ ...f, referralSource: e.target.value }))}
                className="w-full h-9 text-sm border border-input rounded-md px-2 bg-white">
                <option value="">—</option>
                {REFERRALS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Рекламный канал</Label>
              <select value={editForm.adSource} onChange={e => setEditForm(f => ({ ...f, adSource: e.target.value }))}
                className="w-full h-9 text-sm border border-input rounded-md px-2 bg-white">
                <option value="">—</option>
                {AD_SOURCES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Комментарий</Label>
              <Textarea value={editForm.comment} onChange={e => setEditForm(f => ({ ...f, comment: e.target.value }))} rows={2} />
            </div>
            <Button
              onClick={() => { updateClient(client.id, editForm); setShowEdit(false); }}
              className="w-full bg-foreground text-primary-foreground"
            >
              Сохранить
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Return modal */}
      <Dialog open={showReturn} onOpenChange={setShowReturn}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-600"><span>↩</span> Возврат абонемента</DialogTitle></DialogHeader>
          {(() => {
            const sub = state.subscriptions.find(s => s.id === client.activeSubscriptionId);
            if (!sub) return null;
            return (
              <div className="space-y-4">
                <div className="bg-secondary/50 rounded-lg px-4 py-3 text-sm">
                  <div className="font-medium">{sub.planName}</div>
                  <div className="text-muted-foreground">Сумма возврата: <span className="font-semibold text-foreground">{sub.price.toLocaleString('ru-RU')} ₽</span></div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Способ возврата</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['cash', 'card'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setReturnPayMethod(m)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${returnPayMethod === m ? 'border-red-400 bg-red-50 text-red-700' : 'border-border hover:bg-secondary'}`}
                      >
                        <Icon name={m === 'cash' ? 'Banknote' : 'CreditCard'} size={15} />
                        {m === 'cash' ? 'Наличными' : 'Безналичными'}
                      </button>
                    ))}
                  </div>
                  {returnPayMethod === 'cash' && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
                      Сумма будет учтена как инкассация из кассы
                    </p>
                  )}
                </div>
                <Button
                  onClick={() => { returnSubscription(sub.id, returnPayMethod, state.currentStaffId); setShowReturn(false); }}
                  className="w-full bg-red-500 hover:bg-red-600 text-white"
                >
                  Подтвердить возврат {sub.price.toLocaleString('ru-RU')} ₽
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation modal */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-destructive">Удалить клиента?</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Клиент <span className="font-semibold text-foreground">{getClientFullName(client)}</span> и все связанные данные (абонементы, посещения, продажи) будут удалены без возможности восстановления.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>Отмена</Button>
              <Button
                className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => { deleteClient(client.id); setShowDeleteConfirm(false); onClose(); }}
              >
                Удалить
              </Button>
            </div>
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
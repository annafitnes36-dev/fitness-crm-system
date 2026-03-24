import { useState } from 'react';
import { StoreType } from '@/store';
import Icon from '@/components/ui/icon';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ClientCard from '@/components/ClientCard';

interface ScheduleProps {
  store: StoreType;
  onSell?: (clientId?: string) => void;
}

interface AttendModalState {
  clientId: string;
  entryId: string;
  visitId: string;
}

export default function Schedule({ store, onSell }: ScheduleProps) {
  const { state, addScheduleEntry, enrollClient, markVisit } = store;
  const [weekOffset, setWeekOffset] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [addForDate, setAddForDate] = useState('');
  const [form, setForm] = useState({ trainingTypeId: '', trainerId: '', time: '09:00', maxCapacity: 15, hallId: '' });
  const [enrollSearch, setEnrollSearch] = useState('');
  const [openClientId, setOpenClientId] = useState<string | null>(null);
  const [attendModal, setAttendModal] = useState<AttendModalState | null>(null);
  const [selectedBasis, setSelectedBasis] = useState<{ type: 'subscription'; subId: string } | { type: 'single'; planId: string } | null>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  const getWeekDays = () => {
    const days: string[] = [];
    const monday = new Date(today);
    const dow = today.getDay();
    const diff = (dow === 0 ? -6 : 1 - dow) + weekOffset * 7;
    monday.setDate(today.getDate() + diff);
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d.toISOString().split('T')[0]);
    }
    return days;
  };

  const weekDays = getWeekDays();

  const formatDayHeader = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return {
      weekday: d.toLocaleDateString('ru-RU', { weekday: 'short' }),
      date: d.getDate(),
      month: d.toLocaleDateString('ru-RU', { month: 'short' }),
      isToday: dateStr === todayStr,
    };
  };

  const getEntryColor = (trainingTypeId: string) => {
    const tt = state.trainingTypes.find(t => t.id === trainingTypeId);
    if (!tt) return '#888';
    if (tt.categoryId) {
      const cat = state.trainingCategories.find(c => c.id === tt.categoryId);
      if (cat) return cat.color;
    }
    return tt.color;
  };

  const selectedEntry = selectedEntryId ? state.schedule.find(e => e.id === selectedEntryId) : null;

  const handleAddEntry = () => {
    if (!form.trainingTypeId || !form.trainerId) return;
    addScheduleEntry({
      trainingTypeId: form.trainingTypeId,
      trainerId: form.trainerId,
      branchId: state.currentBranchId,
      date: addForDate,
      time: form.time,
      maxCapacity: form.maxCapacity,
      hallId: form.hallId || undefined,
    });
    setShowAdd(false);
    setForm({ trainingTypeId: '', trainerId: '', time: '09:00', maxCapacity: 15, hallId: '' });
  };

  const openAddFor = (date: string) => {
    setAddForDate(date);
    setShowAdd(true);
  };

  const filteredClients = state.clients.filter(c =>
    c.branchId === state.currentBranchId &&
    selectedEntry && !selectedEntry.enrolledClientIds.includes(c.id) &&
    `${c.lastName} ${c.firstName} ${c.phone}`.toLowerCase().includes(enrollSearch.toLowerCase())
  );

  // Open "attended" modal with available bases
  const openAttendModal = (clientId: string, entryId: string) => {
    const visit = state.visits.find(v => v.clientId === clientId && v.scheduleEntryId === entryId);
    if (!visit) return;
    setAttendModal({ clientId, entryId, visitId: visit.id });
    setSelectedBasis(null);
  };

  const handleConfirmAttend = () => {
    if (!attendModal || !selectedBasis) return;
    const isSingle = selectedBasis.type === 'single';
    const subId = selectedBasis.type === 'subscription' ? selectedBasis.subId : null;
    const singlePlan = isSingle && selectedBasis.type === 'single' ? state.singleVisitPlans.find(p => p.id === selectedBasis.planId) : null;
    markVisit(attendModal.visitId, 'attended', subId, isSingle, singlePlan?.price || 0);
    setAttendModal(null);
    setSelectedBasis(null);
  };

  // Handle missed/cancelled directly
  const handleMarkVisit = (clientId: string, entryId: string, status: 'missed' | 'cancelled') => {
    const visit = state.visits.find(v => v.clientId === clientId && v.scheduleEntryId === entryId);
    if (!visit) return;
    markVisit(visit.id, status, null, false, 0);
  };

  const isFirstEverTraining = (clientId: string) => {
    const clientVisits = state.visits.filter(v => v.clientId === clientId && v.status !== 'enrolled');
    return clientVisits.length === 0;
  };

  const isSubEndingToday = (clientId: string) => {
    const client = state.clients.find(c => c.id === clientId);
    if (!client?.activeSubscriptionId) return false;
    const sub = state.subscriptions.find(s => s.id === client.activeSubscriptionId);
    if (!sub) return false;
    return sub.endDate <= todayStr;
  };

  const openClientCard = state.clients.find(c => c.id === openClientId);

  // Get available bases for attendance for a client
  const getAttendBases = (clientId: string, entryId: string) => {
    const entry = state.schedule.find(e => e.id === entryId);
    const client = state.clients.find(c => c.id === clientId);
    if (!entry || !client) return { subscriptions: [], singles: [] };

    const tt = state.trainingTypes.find(t => t.id === entry.trainingTypeId);

    const activeSubs = state.subscriptions.filter(s =>
      s.clientId === clientId &&
      s.status === 'active' &&
      (s.sessionsLeft === 'unlimited' || (s.sessionsLeft as number) > 0)
    ).filter(s => {
      const plan = state.subscriptionPlans.find(p => p.id === s.planId);
      if (!plan) return false;
      if (plan.allDirections) return true;
      return tt ? plan.trainingTypeIds.includes(tt.id) : false;
    });

    const singles = state.singleVisitPlans.filter(p =>
      p.branchId === state.currentBranchId &&
      (tt ? p.trainingTypeIds.includes(tt.id) || p.trainingTypeIds.length === 0 : true)
    );

    return { subscriptions: activeSubs, singles };
  };

  if (openClientCard) {
    return (
      <div className="animate-fade-in">
        <button onClick={() => setOpenClientId(null)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <Icon name="ArrowLeft" size={14} /> Назад в расписание
        </button>
        <ClientCard client={openClientCard} store={store} onClose={() => setOpenClientId(null)} onSell={() => onSell?.(openClientCard.id)} />
      </div>
    );
  }

  return (
    <div className="flex gap-5 h-full animate-fade-in min-h-0">
      {/* Left: week grid */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Week navigation */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <button onClick={() => setWeekOffset(w => w - 1)} className="p-2 rounded-lg hover:bg-secondary transition-colors">
            <Icon name="ChevronLeft" size={18} />
          </button>
          <div className="text-sm font-medium">
            {new Date(weekDays[0] + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
            {' — '}
            {new Date(weekDays[6] + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <div className="flex items-center gap-2">
            {weekOffset !== 0 && (
              <button onClick={() => setWeekOffset(0)} className="text-xs px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/70 transition-colors">
                Сегодня
              </button>
            )}
            <button onClick={() => setWeekOffset(w => w + 1)} className="p-2 rounded-lg hover:bg-secondary transition-colors">
              <Icon name="ChevronRight" size={18} />
            </button>
          </div>
        </div>

        {/* Week grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map(dateStr => {
              const { weekday, date, month, isToday } = formatDayHeader(dateStr);
              const dayEntries = state.schedule
                .filter(e => e.branchId === state.currentBranchId && e.date === dateStr)
                .sort((a, b) => a.time.localeCompare(b.time));
              return (
                <div key={dateStr} className="flex flex-col">
                  <div className={`text-center py-2 px-1 rounded-xl mb-2 shrink-0 ${isToday ? 'bg-foreground text-primary-foreground' : 'bg-white border border-border'}`}>
                    <div className="text-xs capitalize opacity-70">{weekday}</div>
                    <div className="text-lg font-bold leading-tight">{date}</div>
                    <div className="text-xs opacity-60">{month}</div>
                  </div>
                  <div className="space-y-1.5">
                    {dayEntries.map(entry => {
                      const tt = state.trainingTypes.find(t => t.id === entry.trainingTypeId);
                      const color = getEntryColor(entry.trainingTypeId);
                      const isSelected = selectedEntryId === entry.id;
                      const fillPct = (entry.enrolledClientIds.length / entry.maxCapacity) * 100;
                      return (
                        <div key={entry.id} onClick={() => setSelectedEntryId(entry.id === selectedEntryId ? null : entry.id)}
                          className={`rounded-lg p-2 cursor-pointer transition-all border ${isSelected ? 'border-foreground shadow-sm' : 'border-transparent hover:border-border'}`}
                          style={{ background: color + '18', borderLeftColor: color, borderLeftWidth: 3 }}
                        >
                          <div className="text-xs font-semibold" style={{ color }}>{entry.time}</div>
                          <div className="text-xs font-medium text-foreground leading-tight mt-0.5 truncate">{tt?.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{entry.enrolledClientIds.length}/{entry.maxCapacity}</div>
                          <div className="w-full h-1 bg-white/50 rounded-full mt-1 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${fillPct}%`, background: color }} />
                          </div>
                        </div>
                      );
                    })}
                    <button onClick={() => openAddFor(dateStr)} className="w-full py-1.5 rounded-lg border border-dashed border-border hover:bg-secondary transition-colors">
                      <Icon name="Plus" size={14} className="mx-auto text-muted-foreground" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right: entry detail */}
      {selectedEntry && (() => {
        const tt = state.trainingTypes.find(t => t.id === selectedEntry.trainingTypeId);
        const trainer = state.trainers.find(t => t.id === selectedEntry.trainerId);
        const hall = selectedEntry.hallId ? state.halls.find(h => h.id === selectedEntry.hallId) : null;
        const color = getEntryColor(selectedEntry.trainingTypeId);
        const entryDate = new Date(selectedEntry.date + 'T12:00:00').toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
        return (
          <div className="w-96 shrink-0 bg-white border border-border rounded-xl overflow-hidden flex flex-col animate-slide-in-right">
            <div className="px-4 py-4 border-b border-border" style={{ borderTop: `3px solid ${color}` }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{tt?.name}</div>
                  <div className="text-sm text-muted-foreground">{selectedEntry.time} · {tt?.duration} мин</div>
                  <div className="text-xs text-muted-foreground mt-0.5 capitalize">{entryDate}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{trainer?.name}</div>
                  {hall && <div className="text-xs text-muted-foreground mt-0.5">Зал: {hall.name}</div>}
                </div>
                <button onClick={() => setSelectedEntryId(null)} className="text-muted-foreground hover:text-foreground">
                  <Icon name="X" size={15} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="px-4 py-3 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Записанные ({selectedEntry.enrolledClientIds.length})
              </div>
              {selectedEntry.enrolledClientIds.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">Никто не записан</div>
              )}
              {selectedEntry.enrolledClientIds.map(clientId => {
                const client = state.clients.find(c => c.id === clientId);
                const visit = state.visits.find(v => v.clientId === clientId && v.scheduleEntryId === selectedEntry.id);
                if (!client) return null;

                const isFirst = isFirstEverTraining(clientId);
                const subEnding = isSubEndingToday(clientId);
                const clientSub = client.activeSubscriptionId ? state.subscriptions.find(s => s.id === client.activeSubscriptionId) : null;

                const statusMap: Record<string, { label: string; color: string }> = {
                  attended: { label: 'Пришёл', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
                  missed: { label: 'Не пришёл', color: 'text-red-600 bg-red-50 border-red-200' },
                  cancelled: { label: 'Отменил', color: 'text-orange-600 bg-orange-50 border-orange-200' },
                  enrolled: { label: 'Записан', color: 'text-blue-600 bg-blue-50 border-blue-200' },
                };
                const currentStatus = visit?.status || 'enrolled';
                const statusInfo = statusMap[currentStatus] || statusMap.enrolled;

                return (
                  <div key={clientId} className="px-4 py-3 border-b border-border last:border-0">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button onClick={() => setOpenClientId(clientId)} className="text-sm font-medium hover:underline text-left">
                            {client.lastName} {client.firstName}
                          </button>
                          {isFirst && <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium">1-й раз</span>}
                          {subEnding && <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">⚠ абон. кончается</span>}
                        </div>
                        {client.comment && (
                          <div className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                            <span>💬</span><span className="truncate">{client.comment}</span>
                          </div>
                        )}
                        {clientSub && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {clientSub.planName} · {clientSub.sessionsLeft === 'unlimited' ? '∞' : `${clientSub.sessionsLeft} зан.`}
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 flex flex-col gap-1 items-end">
                        {currentStatus === 'enrolled' ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => openAttendModal(clientId, selectedEntry.id)}
                              className="text-xs px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors font-medium"
                            >
                              ✓ Пришёл
                            </button>
                            <button
                              onClick={() => handleMarkVisit(clientId, selectedEntry.id, 'missed')}
                              className="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors font-medium"
                            >
                              ✗ Нет
                            </button>
                            <button
                              onClick={() => handleMarkVisit(clientId, selectedEntry.id, 'cancelled')}
                              className="text-xs px-2 py-1 rounded-lg bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 transition-colors font-medium"
                            >
                              Отменил
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className={`text-xs px-2 py-1 rounded-lg border font-medium ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                            {currentStatus !== 'enrolled' && (
                              <button
                                onClick={() => { const v = state.visits.find(vi => vi.clientId === clientId && vi.scheduleEntryId === selectedEntry.id); if (v) markVisit(v.id, 'enrolled', null, false, 0); }}
                                className="text-xs p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                                title="Сбросить статус"
                              >
                                <Icon name="RotateCcw" size={12} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Enroll new client */}
            <div className="px-4 py-3 border-t border-border bg-secondary/30">
              <div className="text-xs font-medium text-muted-foreground mb-2">Записать клиента</div>
              <Input value={enrollSearch} onChange={e => setEnrollSearch(e.target.value)} placeholder="Поиск по имени или телефону..." className="text-sm mb-2" />
              {enrollSearch && (
                <div className="max-h-36 overflow-y-auto space-y-1">
                  {filteredClients.slice(0, 8).map(c => (
                    <button key={c.id} onClick={() => { enrollClient(selectedEntry.id, c.id); setEnrollSearch(''); }}
                      className="w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-white border border-transparent hover:border-border transition-colors">
                      <span className="font-medium">{c.lastName} {c.firstName}</span>
                      <span className="text-muted-foreground ml-2">{c.phone}</span>
                    </button>
                  ))}
                  {filteredClients.length === 0 && <div className="text-sm text-muted-foreground px-3 py-2">Клиент не найден</div>}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Add entry modal */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Добавить занятие —{' '}
              {addForDate ? new Date(addForDate + 'T12:00:00').toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Тип тренировки *</Label>
              <select className="w-full border border-input rounded-lg px-3 py-2 text-sm" value={form.trainingTypeId} onChange={e => setForm(f => ({ ...f, trainingTypeId: e.target.value }))}>
                <option value="">Выбрать...</option>
                {state.trainingTypes.filter(t => t.branchIds.includes(state.currentBranchId)).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Тренер *</Label>
              <select className="w-full border border-input rounded-lg px-3 py-2 text-sm" value={form.trainerId} onChange={e => setForm(f => ({ ...f, trainerId: e.target.value }))}>
                <option value="">Выбрать...</option>
                {state.trainers.filter(t => t.branchId === state.currentBranchId).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Зал</Label>
              <select className="w-full border border-input rounded-lg px-3 py-2 text-sm" value={form.hallId} onChange={e => setForm(f => ({ ...f, hallId: e.target.value }))}>
                <option value="">Без зала</option>
                {state.halls.filter(h => h.branchId === state.currentBranchId).map(h => (
                  <option key={h.id} value={h.id}>{h.name} ({h.capacity} мест)</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Время</Label>
                <Input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Мест</Label>
                <Input type="number" value={form.maxCapacity} onChange={e => setForm(f => ({ ...f, maxCapacity: Number(e.target.value) }))} />
              </div>
            </div>
            <Button onClick={handleAddEntry} disabled={!form.trainingTypeId || !form.trainerId} className="w-full bg-foreground text-primary-foreground">
              Добавить занятие
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Attend basis modal */}
      {attendModal && (() => {
        const { clientId, entryId } = attendModal;
        const client = state.clients.find(c => c.id === clientId);
        const { subscriptions: availSubs, singles: availSingles } = getAttendBases(clientId, entryId);
        const hasAnyBasis = availSubs.length > 0 || availSingles.length > 0;

        return (
          <Dialog open={true} onOpenChange={() => { setAttendModal(null); setSelectedBasis(null); }}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Отметить приход — {client?.lastName} {client?.firstName}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {!hasAnyBasis ? (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                    У клиента нет доступных абонементов или разовых посещений для этой тренировки.
                    <button onClick={() => { setAttendModal(null); onSell?.(clientId); }} className="block mt-2 text-xs underline">
                      Продать абонемент или разовое
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">Выберите, откуда списать тренировку:</p>

                    {availSubs.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Абонементы</div>
                        <div className="space-y-2">
                          {availSubs.map(sub => (
                            <button key={sub.id} onClick={() => setSelectedBasis({ type: 'subscription', subId: sub.id })}
                              className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${selectedBasis?.type === 'subscription' && selectedBasis.subId === sub.id ? 'border-foreground bg-foreground/5' : 'border-border hover:bg-secondary'}`}
                            >
                              <div className="text-sm font-medium">{sub.planName}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {sub.sessionsLeft === 'unlimited' ? 'Безлимит' : `Осталось ${sub.sessionsLeft} занятий`} · до {new Date(sub.endDate + 'T12:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {availSingles.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Разовые визиты</div>
                        <div className="space-y-2">
                          {availSingles.map(plan => (
                            <button key={plan.id} onClick={() => setSelectedBasis({ type: 'single', planId: plan.id })}
                              className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${selectedBasis?.type === 'single' && selectedBasis.planId === plan.id ? 'border-foreground bg-foreground/5' : 'border-border hover:bg-secondary'}`}
                            >
                              <div className="text-sm font-medium">{plan.name}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">{plan.price.toLocaleString()} ₽</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <Button onClick={handleConfirmAttend} disabled={!selectedBasis} className="w-full bg-emerald-600 text-white hover:bg-emerald-700">
                      Подтвердить приход
                    </Button>
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}

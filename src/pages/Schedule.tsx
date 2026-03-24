import { useState } from 'react';
import { StoreType } from '@/store';
import Icon from '@/components/ui/icon';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ScheduleProps {
  store: StoreType;
}

export default function Schedule({ store }: ScheduleProps) {
  const { state, addScheduleEntry, enrollClient, markVisit } = store;
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [form, setForm] = useState({ trainingTypeId: '', trainerId: '', time: '09:00', maxCapacity: 15 });
  const [enrollSearch, setEnrollSearch] = useState('');
  const [markingVisit, setMarkingVisit] = useState<{ visitId: string; clientId: string; entryId: string } | null>(null);

  const branchEntries = state.schedule.filter(e => e.branchId === state.currentBranchId && e.date === selectedDate);
  const branchTrainingTypes = state.trainingTypes.filter(t => t.branchIds.includes(state.currentBranchId));
  const branchTrainers = state.trainers.filter(t => t.branchId === state.currentBranchId);

  const selectedEntry = selectedEntryId ? state.schedule.find(e => e.id === selectedEntryId) : null;

  const getDates = () => {
    const dates = [];
    for (let i = -1; i <= 6; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return { day: d.toLocaleDateString('ru-RU', { weekday: 'short' }), date: d.getDate() };
  };

  const handleAddEntry = () => {
    if (!form.trainingTypeId || !form.trainerId) return;
    addScheduleEntry({
      trainingTypeId: form.trainingTypeId,
      trainerId: form.trainerId,
      branchId: state.currentBranchId,
      date: selectedDate,
      time: form.time,
      maxCapacity: form.maxCapacity,
    });
    setShowAdd(false);
  };

  const filteredClients = state.clients.filter(c =>
    c.branchId === state.currentBranchId &&
    `${c.lastName} ${c.firstName} ${c.phone}`.toLowerCase().includes(enrollSearch.toLowerCase())
  );

  const handleMarkVisit = (status: 'attended' | 'missed') => {
    if (!markingVisit) return;
    const sub = state.clients.find(c => c.id === markingVisit.clientId)?.activeSubscriptionId || null;
    markVisit(markingVisit.visitId, status, sub, false, 0);
    setMarkingVisit(null);
  };

  return (
    <div className="flex gap-5 h-full animate-fade-in">
      {/* Left: schedule */}
      <div className="flex-1 flex flex-col">
        {/* Date strip */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {getDates().map(d => {
            const { day, date } = formatDate(d);
            const isToday = d === new Date().toISOString().split('T')[0];
            const isSelected = d === selectedDate;
            return (
              <button
                key={d}
                onClick={() => setSelectedDate(d)}
                className={`flex flex-col items-center px-3 py-2.5 rounded-xl shrink-0 transition-colors ${isSelected ? 'bg-foreground text-primary-foreground' : 'bg-white border border-border hover:bg-secondary'}`}
              >
                <span className="text-xs capitalize">{day}</span>
                <span className={`text-lg font-semibold leading-tight ${isToday && !isSelected ? 'text-blue-600' : ''}`}>{date}</span>
              </button>
            );
          })}
          <button
            onClick={() => setShowAdd(true)}
            className="flex flex-col items-center px-3 py-2.5 rounded-xl shrink-0 border border-dashed border-border hover:bg-secondary transition-colors"
          >
            <Icon name="Plus" size={20} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground mt-0.5">Добавить</span>
          </button>
        </div>

        {/* Entries */}
        <div className="space-y-3 flex-1 overflow-y-auto">
          {branchEntries.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Icon name="Calendar" size={32} className="mx-auto mb-3 opacity-30" />
              <div className="text-sm">Нет занятий на этот день</div>
            </div>
          )}
          {branchEntries.sort((a, b) => a.time.localeCompare(b.time)).map(entry => {
            const tt = state.trainingTypes.find(t => t.id === entry.trainingTypeId);
            const trainer = state.trainers.find(t => t.id === entry.trainerId);
            const enrolledCount = entry.enrolledClientIds.length;
            const fillPct = (enrolledCount / entry.maxCapacity) * 100;
            return (
              <div
                key={entry.id}
                onClick={() => setSelectedEntryId(entry.id === selectedEntryId ? null : entry.id)}
                className={`bg-white border rounded-xl p-4 cursor-pointer transition-all ${selectedEntryId === entry.id ? 'border-foreground shadow-sm' : 'border-border hover:shadow-sm'}`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-1 h-12 rounded-full shrink-0 mt-0.5" style={{ background: tt?.color || '#888' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{entry.time}</span>
                      <span className="font-medium">{tt?.name}</span>
                      <span className="text-sm text-muted-foreground">{tt?.duration} мин</span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5">{trainer?.name}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-medium">{enrolledCount} / {entry.maxCapacity}</div>
                    <div className="w-16 h-1.5 bg-secondary rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full bg-foreground rounded-full" style={{ width: `${fillPct}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: entry detail */}
      {selectedEntry && (
        <div className="w-80 shrink-0 bg-white border border-border rounded-xl overflow-hidden flex flex-col animate-slide-in-right">
          {(() => {
            const tt = state.trainingTypes.find(t => t.id === selectedEntry.trainingTypeId);
            const trainer = state.trainers.find(t => t.id === selectedEntry.trainerId);
            return (
              <>
                <div className="px-4 py-4 border-b border-border" style={{ borderTop: `3px solid ${tt?.color || '#888'}` }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{tt?.name}</div>
                      <div className="text-sm text-muted-foreground">{selectedEntry.time} · {tt?.duration} мин</div>
                      <div className="text-xs text-muted-foreground mt-1">{trainer?.name}</div>
                    </div>
                    <button onClick={() => setSelectedEntryId(null)} className="text-muted-foreground hover:text-foreground">
                      <Icon name="X" size={15} />
                    </button>
                  </div>
                </div>

                {/* Enrolled list */}
                <div className="flex-1 overflow-y-auto">
                  <div className="px-4 py-3 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center justify-between">
                    <span>Записанные ({selectedEntry.enrolledClientIds.length})</span>
                  </div>
                  {selectedEntry.enrolledClientIds.map(clientId => {
                    const client = state.clients.find(c => c.id === clientId);
                    const visit = state.visits.find(v => v.clientId === clientId && v.scheduleEntryId === selectedEntry.id);
                    if (!client) return null;
                    return (
                      <div key={clientId} className="px-4 py-3 border-b border-border last:border-0 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">{client.lastName} {client.firstName}</div>
                          <div className="text-xs text-muted-foreground">{client.phone}</div>
                        </div>
                        {visit && (
                          <div className="flex gap-1">
                            {visit.status === 'enrolled' ? (
                              <>
                                <button
                                  onClick={() => setMarkingVisit({ visitId: visit.id, clientId, entryId: selectedEntry.id })}
                                  className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-lg hover:bg-green-100"
                                >✓</button>
                                <button
                                  onClick={() => markVisit(visit.id, 'missed', null, false, 0)}
                                  className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-100"
                                >✗</button>
                              </>
                            ) : (
                              <span className={`text-xs px-2 py-0.5 rounded-full ${visit.status === 'attended' ? 'badge-loyal' : 'badge-lost'}`}>
                                {visit.status === 'attended' ? 'Пришёл' : 'Прогул'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {selectedEntry.enrolledClientIds.length === 0 && (
                    <div className="px-4 py-6 text-sm text-muted-foreground text-center">Никто не записан</div>
                  )}
                </div>

                {/* Enroll */}
                <div className="px-4 py-3 border-t border-border">
                  <div className="text-xs font-medium text-muted-foreground mb-2">Добавить клиента</div>
                  <Input
                    placeholder="Поиск клиента..."
                    value={enrollSearch}
                    onChange={e => setEnrollSearch(e.target.value)}
                    className="mb-2 text-sm"
                  />
                  {enrollSearch && (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {filteredClients.filter(c => !selectedEntry.enrolledClientIds.includes(c.id)).slice(0, 5).map(c => (
                        <button
                          key={c.id}
                          onClick={() => { enrollClient(selectedEntry.id, c.id); setEnrollSearch(''); }}
                          className="w-full text-left px-2 py-1.5 text-sm rounded-lg hover:bg-secondary transition-colors"
                        >
                          {c.lastName} {c.firstName}
                          <span className="text-muted-foreground text-xs ml-2">{c.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Add entry modal */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Добавить занятие</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Тип тренировки</Label>
              <select className="w-full border border-input rounded-lg px-3 py-2 text-sm"
                value={form.trainingTypeId} onChange={e => setForm(f => ({ ...f, trainingTypeId: e.target.value }))}>
                <option value="">Выберите...</option>
                {branchTrainingTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Тренер</Label>
              <select className="w-full border border-input rounded-lg px-3 py-2 text-sm"
                value={form.trainerId} onChange={e => setForm(f => ({ ...f, trainerId: e.target.value }))}>
                <option value="">Выберите...</option>
                {branchTrainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground mb-1 block">Время</Label>
                <Input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
              </div>
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground mb-1 block">Вместимость</Label>
                <Input type="number" min={1} value={form.maxCapacity}
                  onChange={e => setForm(f => ({ ...f, maxCapacity: Number(e.target.value) }))} />
              </div>
            </div>
            <Button onClick={handleAddEntry} disabled={!form.trainingTypeId || !form.trainerId}
              className="w-full bg-foreground text-primary-foreground">
              Добавить
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mark visit modal */}
      <Dialog open={!!markingVisit} onOpenChange={() => setMarkingVisit(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Отметить посещение</DialogTitle></DialogHeader>
          {markingVisit && (() => {
            const client = state.clients.find(c => c.id === markingVisit.clientId);
            const sub = client?.activeSubscriptionId ? state.subscriptions.find(s => s.id === client.activeSubscriptionId) : null;
            return (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {client?.lastName} {client?.firstName}
                </p>
                {sub ? (
                  <div className="bg-secondary rounded-lg p-3 text-sm">
                    <div className="font-medium">{sub.planName}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Осталось: {sub.sessionsLeft === 'unlimited' ? '∞' : sub.sessionsLeft} занятий
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    Нет активного абонемента. Посещение будет разовым.
                  </div>
                )}
                <div className="flex gap-2">
                  <Button onClick={() => handleMarkVisit('attended')} className="flex-1 bg-green-600 text-white hover:bg-green-700">
                    ✓ Пришёл
                  </Button>
                  <Button onClick={() => handleMarkVisit('missed')} variant="outline" className="flex-1 border-red-200 text-red-600 hover:bg-red-50">
                    ✗ Прогул
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useRef } from 'react';
import { StoreType, ScheduleEntry } from '@/store';
import Icon from '@/components/ui/icon';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ClientCard from '@/components/ClientCard';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ScheduleProps {
  store: StoreType;
  onSell?: (clientId?: string) => void;
}

interface AttendModalState {
  clientId: string;
  entryId: string;
  visitId: string;
}

type AddMode = 'group' | 'personal';

const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export default function Schedule({ store, onSell }: ScheduleProps) {
  const { state, addScheduleEntry, updateScheduleEntry, removeScheduleEntry, enrollClient, markVisit } = store;

  const [weekOffset, setWeekOffset] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForDate, setAddForDate] = useState('');
  const [addMode, setAddMode] = useState<AddMode>('group');
  const [form, setForm] = useState({
    trainingTypeId: '', trainerId: '', time: '09:00',
    maxCapacity: 15, hallId: '', personalClientId: '',
  });

  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [editEntryId, setEditEntryId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ScheduleEntry>>({});

  const [enrollSearch, setEnrollSearch] = useState('');
  const [openClientId, setOpenClientId] = useState<string | null>(null);
  const [attendModal, setAttendModal] = useState<AttendModalState | null>(null);
  const [selectedBasis, setSelectedBasis] = useState<
    { type: 'subscription'; subId: string } | { type: 'single'; planId: string } | null
  >(null);

  const tableRef = useRef<HTMLDivElement>(null);

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
    if (!trainingTypeId) return '#888';
    const tt = state.trainingTypes.find(t => t.id === trainingTypeId);
    if (!tt) return '#888';
    if (tt.categoryId) {
      const cat = state.trainingCategories.find(c => c.id === tt.categoryId);
      if (cat) return cat.color;
    }
    return tt.color;
  };

  const branchHalls = state.halls.filter(h => h.branchId === state.currentBranchId);
  const NO_HALL_ID = '__no_hall__';

  // All unique times from schedule this week for current branch
  const weekEntries = state.schedule.filter(
    e => e.branchId === state.currentBranchId && weekDays.includes(e.date)
  );
  const allTimes = [...new Set(weekEntries.map(e => e.time))].sort();

  // halls shown: all branch halls + "no hall" if any entries lack hallId
  const hallsToShow = branchHalls.length > 0 ? branchHalls : [];
  const hasHalllessEntries = weekEntries.some(e => !e.hallId || !branchHalls.find(h => h.id === e.hallId));
  const effectiveHalls = hasHalllessEntries
    ? [...hallsToShow, { id: NO_HALL_ID, name: 'Без зала', capacity: 0, branchId: state.currentBranchId }]
    : hallsToShow.length > 0 ? hallsToShow : [{ id: NO_HALL_ID, name: 'Без зала', capacity: 0, branchId: state.currentBranchId }];

  const getEntriesForCell = (dateStr: string, time: string, hallId: string) => {
    return weekEntries.filter(e => {
      const eHall = e.hallId || NO_HALL_ID;
      if (hallId === NO_HALL_ID) return e.date === dateStr && e.time === time && (!e.hallId || !branchHalls.find(h => h.id === e.hallId));
      return e.date === dateStr && e.time === time && eHall === hallId;
    });
  };

  const selectedEntry = selectedEntryId ? state.schedule.find(e => e.id === selectedEntryId) : null;

  // Add modal
  const openAddFor = (date: string) => {
    setAddForDate(date);
    setAddMode('group');
    setForm({ trainingTypeId: '', trainerId: '', time: '09:00', maxCapacity: 15, hallId: '', personalClientId: '' });
    setShowAddModal(true);
  };

  const handleAddEntry = () => {
    if (addMode === 'group' && (!form.trainingTypeId || !form.trainerId)) return;
    if (addMode === 'personal' && (!form.trainerId || !form.personalClientId)) return;
    addScheduleEntry({
      trainingTypeId: form.trainingTypeId,
      trainerId: form.trainerId,
      branchId: state.currentBranchId,
      date: addForDate,
      time: form.time,
      maxCapacity: addMode === 'personal' ? 1 : form.maxCapacity,
      hallId: form.hallId || undefined,
      isPersonal: addMode === 'personal',
      personalClientId: addMode === 'personal' ? form.personalClientId : undefined,
      enrolledClientIds: addMode === 'personal' && form.personalClientId ? [form.personalClientId] : [],
    });
    setShowAddModal(false);
  };

  // Edit entry
  const openEdit = (entry: ScheduleEntry) => {
    setEditEntryId(entry.id);
    setEditForm({ ...entry });
    setSelectedEntryId(null);
  };

  const saveEdit = () => {
    if (!editEntryId || !editForm) return;
    updateScheduleEntry(editEntryId, editForm);
    setEditEntryId(null);
    setEditForm({});
  };

  // Attend modal
  const filteredClients = state.clients.filter(c =>
    c.branchId === state.currentBranchId &&
    selectedEntry && !selectedEntry.enrolledClientIds.includes(c.id) &&
    !selectedEntry.isPersonal &&
    `${c.lastName} ${c.firstName} ${c.phone}`.toLowerCase().includes(enrollSearch.toLowerCase())
  );

  const openAttendModal = (clientId: string, entryId: string) => {
    const visit = state.visits.find(v => v.clientId === clientId && v.scheduleEntryId === entryId);
    const visitId = visit?.id;
    if (!visitId) {
      enrollClient(entryId, clientId);
      setTimeout(() => {
        const newVisit = state.visits.find(v => v.clientId === clientId && v.scheduleEntryId === entryId);
        if (newVisit) {
          setAttendModal({ clientId, entryId, visitId: newVisit.id });
          setSelectedBasis(null);
        }
      }, 50);
      return;
    }
    setAttendModal({ clientId, entryId, visitId });
    setSelectedBasis(null);
  };

  const handleConfirmAttend = () => {
    if (!attendModal || !selectedBasis) return;
    const isSingle = selectedBasis.type === 'single';
    const subId = selectedBasis.type === 'subscription' ? selectedBasis.subId : null;
    const singlePlan = isSingle && selectedBasis.type === 'single'
      ? state.singleVisitPlans.find(p => p.id === selectedBasis.planId) : null;
    const visit = state.visits.find(v => v.clientId === attendModal.clientId && v.scheduleEntryId === attendModal.entryId);
    const visitId = visit?.id || attendModal.visitId;
    markVisit(visitId, 'attended', subId, isSingle, singlePlan?.price || 0);
    setAttendModal(null);
    setSelectedBasis(null);
  };

  const handleMarkVisit = (clientId: string, entryId: string, status: 'missed' | 'cancelled') => {
    const visit = state.visits.find(v => v.clientId === clientId && v.scheduleEntryId === entryId);
    if (visit) {
      markVisit(visit.id, status, null, false, 0);
    } else {
      enrollClient(entryId, clientId);
      setTimeout(() => {
        const newVisit = state.visits.find(v => v.clientId === clientId && v.scheduleEntryId === entryId);
        if (newVisit) markVisit(newVisit.id, status, null, false, 0);
      }, 50);
    }
  };

  const isFirstEverTraining = (clientId: string) =>
    state.visits.filter(v => v.clientId === clientId && v.status !== 'enrolled').length === 0;

  const isSubEndingToday = (clientId: string) => {
    const client = state.clients.find(c => c.id === clientId);
    if (!client?.activeSubscriptionId) return false;
    const sub = state.subscriptions.find(s => s.id === client.activeSubscriptionId);
    return sub ? sub.endDate <= todayStr : false;
  };

  const getAttendBases = (clientId: string, entryId: string) => {
    const entry = state.schedule.find(e => e.id === entryId);
    const client = state.clients.find(c => c.id === clientId);
    if (!entry || !client) return { subscriptions: [], singles: [] };
    const tt = state.trainingTypes.find(t => t.id === entry.trainingTypeId);
    const activeSubs = state.subscriptions.filter(s =>
      s.clientId === clientId && s.status === 'active' &&
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

  // --- Export ---
  const exportPNG = async () => {
    const el = tableRef.current;
    if (!el) return;
    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
    const link = document.createElement('a');
    link.download = `raspisanie-${weekDays[0]}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const branch = state.branches.find(b => b.id === state.currentBranchId);
    doc.setFontSize(12);
    doc.text(`Расписание: ${branch?.name || ''} | ${weekDays[0]} — ${weekDays[6]}`, 14, 14);

    const dayHeaders = weekDays.map((d, i) => {
      const info = formatDayHeader(d);
      return `${DAY_NAMES[i]} ${info.date}.${String(new Date(d + 'T12:00:00').getMonth() + 1).padStart(2, '0')}`;
    });

    const head = [['Время', 'Зал', ...dayHeaders]];
    const body: string[][] = [];

    allTimes.forEach(time => {
      effectiveHalls.forEach((hall, hi) => {
        const row: string[] = hi === 0 ? [time, hall.name] : ['', hall.name];
        weekDays.forEach(dateStr => {
          const entries = getEntriesForCell(dateStr, time, hall.id);
          const cell = entries.map(e => {
            const tt = state.trainingTypes.find(t => t.id === e.trainingTypeId);
            const tr = state.trainers.find(t => t.id === e.trainerId);
            const client = e.isPersonal && e.personalClientId
              ? state.clients.find(c => c.id === e.personalClientId) : null;
            if (e.isPersonal) return `[Перс] ${client ? client.lastName + ' ' + client.firstName : '?'}\n${tr?.name || ''}`;
            return `${tt?.name || '?'}\n${tr?.name || ''}`;
          }).join('\n—\n');
          row.push(cell);
        });
        body.push(row);
      });
    });

    if (body.length === 0) {
      body.push(['Нет тренировок', '', ...weekDays.map(() => '')]);
    }

    autoTable(doc, {
      head,
      body,
      startY: 20,
      styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
      headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 14 }, 1: { cellWidth: 22 } },
      margin: { left: 10, right: 10 },
    });

    doc.save(`raspisanie-${weekDays[0]}.pdf`);
  };

  const openClientCard = state.clients.find(c => c.id === openClientId);
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

  const branchTrainers = state.trainers.filter(t => t.branchId === state.currentBranchId);

  return (
    <div className="flex gap-4 h-full animate-fade-in min-h-0">
      {/* Main table */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4 shrink-0 flex-wrap">
          <button onClick={() => setWeekOffset(w => w - 1)} className="p-2 rounded-lg hover:bg-secondary transition-colors">
            <Icon name="ChevronLeft" size={18} />
          </button>
          <div className="text-sm font-medium flex-1 text-center">
            {new Date(weekDays[0] + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
            {' — '}
            {new Date(weekDays[6] + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)} className="text-xs px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/70 transition-colors">
              Сегодня
            </button>
          )}
          <button onClick={() => setWeekOffset(w => w + 1)} className="p-2 rounded-lg hover:bg-secondary transition-colors">
            <Icon name="ChevronRight" size={18} />
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={exportPNG} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-secondary hover:bg-secondary/70 transition-colors">
              <Icon name="Image" size={13} /> PNG
            </button>
            <button onClick={exportPDF} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-secondary hover:bg-secondary/70 transition-colors">
              <Icon name="FileText" size={13} /> PDF
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <div ref={tableRef} className="inline-block min-w-full">
            <table className="border-collapse text-xs bg-white" style={{ minWidth: '900px' }}>
              <thead>
                <tr>
                  <th className="border border-border bg-secondary px-2 py-2 text-left font-semibold sticky left-0 z-10" style={{ minWidth: 56 }}>
                    Время
                  </th>
                  <th className="border border-border bg-secondary px-2 py-2 text-left font-semibold sticky left-14 z-10" style={{ minWidth: 80 }}>
                    Зал
                  </th>
                  {weekDays.map((dateStr, i) => {
                    const { date, month, isToday } = formatDayHeader(dateStr);
                    return (
                      <th key={dateStr}
                        className={`border border-border px-2 py-2 text-center font-semibold ${isToday ? 'bg-foreground text-primary-foreground' : 'bg-secondary'}`}
                        style={{ minWidth: 110 }}
                      >
                        <div>{DAY_NAMES[i]}</div>
                        <div className="font-normal text-xs opacity-75">{date} {month}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {allTimes.length === 0 && (
                  <tr>
                    <td colSpan={2 + 7} className="text-center text-muted-foreground py-12 border border-border">
                      На этой неделе тренировок нет. Нажми «+» ниже чтобы добавить.
                    </td>
                  </tr>
                )}
                {allTimes.map((time, ti) =>
                  effectiveHalls.map((hall, hi) => (
                    <tr key={`${time}-${hall.id}`} className={hi === 0 && ti > 0 ? 'border-t-2 border-border' : ''}>
                      {hi === 0 && (
                        <td
                          rowSpan={effectiveHalls.length}
                          className="border border-border px-2 py-2 font-mono font-semibold text-center align-top sticky left-0 bg-white z-10 text-sm"
                          style={{ minWidth: 56 }}
                        >
                          {time}
                        </td>
                      )}
                      <td className="border border-border px-2 py-1 text-muted-foreground font-medium sticky left-14 bg-white z-10 whitespace-nowrap">
                        {hall.name}
                      </td>
                      {weekDays.map(dateStr => {
                        const entries = getEntriesForCell(dateStr, time, hall.id);
                        return (
                          <td key={dateStr} className="border border-border px-1 py-1 align-top" style={{ minWidth: 110 }}>
                            {entries.map(entry => {
                              const tt = state.trainingTypes.find(t => t.id === entry.trainingTypeId);
                              const trainer = state.trainers.find(t => t.id === entry.trainerId);
                              const color = getEntryColor(entry.trainingTypeId);
                              const personalClient = entry.isPersonal && entry.personalClientId
                                ? state.clients.find(c => c.id === entry.personalClientId) : null;
                              const isSelected = selectedEntryId === entry.id;
                              const fillPct = entry.maxCapacity > 0 ? (entry.enrolledClientIds.length / entry.maxCapacity) * 100 : 0;
                              return (
                                <div
                                  key={entry.id}
                                  onClick={() => setSelectedEntryId(entry.id === selectedEntryId ? null : entry.id)}
                                  className={`rounded p-1.5 mb-1 cursor-pointer transition-all border ${isSelected ? 'border-foreground shadow-sm' : 'border-transparent hover:border-border'}`}
                                  style={{ background: (entry.isPersonal ? '#8b5cf6' : color) + '18', borderLeftColor: entry.isPersonal ? '#8b5cf6' : color, borderLeftWidth: 3 }}
                                >
                                  {entry.isPersonal && (
                                    <div className="text-xs font-bold text-violet-600 mb-0.5">Персональная</div>
                                  )}
                                  <div className="font-semibold leading-tight truncate" style={{ color: entry.isPersonal ? '#8b5cf6' : color }}>
                                    {entry.isPersonal
                                      ? (personalClient ? `${personalClient.lastName} ${personalClient.firstName}` : 'Клиент')
                                      : (tt?.name || '?')}
                                  </div>
                                  <div className="text-muted-foreground truncate">{trainer?.name || '?'}</div>
                                  {!entry.isPersonal && (
                                    <>
                                      <div className="text-muted-foreground">{entry.enrolledClientIds.length}/{entry.maxCapacity}</div>
                                      <div className="w-full h-0.5 bg-black/10 rounded-full mt-1 overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${fillPct}%`, background: color }} />
                                      </div>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
                {/* Add row */}
                <tr>
                  <td colSpan={2} className="border border-border px-2 py-1 sticky left-0 bg-white z-10">
                    <span className="text-xs text-muted-foreground">Добавить</span>
                  </td>
                  {weekDays.map(dateStr => (
                    <td key={dateStr} className="border border-border px-1 py-1">
                      <button
                        onClick={() => openAddFor(dateStr)}
                        className="w-full py-1 rounded border border-dashed border-border hover:bg-secondary transition-colors flex items-center justify-center"
                      >
                        <Icon name="Plus" size={13} className="text-muted-foreground" />
                      </button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right panel: entry detail */}
      {selectedEntry && (() => {
        const tt = state.trainingTypes.find(t => t.id === selectedEntry.trainingTypeId);
        const trainer = state.trainers.find(t => t.id === selectedEntry.trainerId);
        const hall = selectedEntry.hallId ? state.halls.find(h => h.id === selectedEntry.hallId) : null;
        const color = getEntryColor(selectedEntry.trainingTypeId);
        const entryDate = new Date(selectedEntry.date + 'T12:00:00').toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
        const personalClient = selectedEntry.isPersonal && selectedEntry.personalClientId
          ? state.clients.find(c => c.id === selectedEntry.personalClientId) : null;
        return (
          <div className="w-96 shrink-0 bg-white border border-border rounded-xl overflow-hidden flex flex-col animate-slide-in-right">
            <div className="px-4 py-4 border-b border-border" style={{ borderTop: `3px solid ${selectedEntry.isPersonal ? '#8b5cf6' : color}` }}>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  {selectedEntry.isPersonal
                    ? <div className="font-semibold text-violet-700">Персональная тренировка</div>
                    : <div className="font-semibold">{tt?.name}</div>
                  }
                  <div className="text-sm text-muted-foreground">{selectedEntry.time} · {tt?.duration || '—'} мин</div>
                  <div className="text-xs text-muted-foreground mt-0.5 capitalize">{entryDate}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{trainer?.name}</div>
                  {hall && <div className="text-xs text-muted-foreground">Зал: {hall.name}</div>}
                  {personalClient && (
                    <div className="text-xs text-violet-700 mt-0.5">Клиент: {personalClient.lastName} {personalClient.firstName}</div>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-2 shrink-0">
                  <button onClick={() => openEdit(selectedEntry)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground" title="Редактировать">
                    <Icon name="Pencil" size={14} />
                  </button>
                  <button onClick={() => { if (confirm('Удалить тренировку?')) { removeScheduleEntry(selectedEntry.id); setSelectedEntryId(null); } }}
                    className="p-1.5 rounded hover:bg-red-50 text-red-400" title="Удалить">
                    <Icon name="Trash2" size={14} />
                  </button>
                  <button onClick={() => setSelectedEntryId(null)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground">
                    <Icon name="X" size={14} />
                  </button>
                </div>
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
                        {clientSub && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {clientSub.planName} · до {clientSub.endDate}
                            {clientSub.sessionsLeft !== 'unlimited' && ` · ост. ${clientSub.sessionsLeft}`}
                          </div>
                        )}
                        <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full border font-medium ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      {currentStatus === 'enrolled' && (
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => openAttendModal(clientId, selectedEntry.id)}
                            className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors font-medium">
                            Пришёл
                          </button>
                          <button onClick={() => handleMarkVisit(clientId, selectedEntry.id, 'missed')}
                            className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium">
                            Не пришёл
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {!selectedEntry.isPersonal && (
                <>
                  <div className="px-4 py-3 border-t border-border text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Записать клиента
                  </div>
                  <div className="px-4 pb-3">
                    <Input
                      placeholder="Поиск клиента..."
                      value={enrollSearch}
                      onChange={e => setEnrollSearch(e.target.value)}
                      className="h-8 text-sm"
                    />
                    <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                      {filteredClients.slice(0, 20).map(c => (
                        <button key={c.id} onClick={() => enrollClient(selectedEntry.id, c.id)}
                          className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-secondary transition-colors">
                          {c.lastName} {c.firstName} · <span className="text-muted-foreground">{c.phone}</span>
                        </button>
                      ))}
                      {filteredClients.length === 0 && enrollSearch && (
                        <div className="text-xs text-muted-foreground px-2 py-2">Клиент не найден</div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* Add modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Добавить тренировку</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Mode selector */}
            <div className="flex gap-2">
              <button
                onClick={() => setAddMode('group')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${addMode === 'group' ? 'bg-foreground text-primary-foreground border-foreground' : 'bg-white border-border hover:bg-secondary'}`}
              >
                Групповая
              </button>
              <button
                onClick={() => setAddMode('personal')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${addMode === 'personal' ? 'bg-violet-600 text-white border-violet-600' : 'bg-white border-border hover:bg-secondary'}`}
              >
                Персональная
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Время</Label>
                <Input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Зал</Label>
                <select
                  value={form.hallId}
                  onChange={e => setForm(f => ({ ...f, hallId: e.target.value }))}
                  className="w-full h-8 text-sm border border-input rounded-md px-2 bg-white"
                >
                  <option value="">Без зала</option>
                  {branchHalls.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
            </div>

            {addMode === 'group' && (
              <div>
                <Label className="text-xs">Вид тренировки</Label>
                <select
                  value={form.trainingTypeId}
                  onChange={e => setForm(f => ({ ...f, trainingTypeId: e.target.value }))}
                  className="w-full h-8 text-sm border border-input rounded-md px-2 bg-white"
                >
                  <option value="">Выберите...</option>
                  {state.trainingTypes.filter(tt => tt.branchIds.includes(state.currentBranchId)).map(tt => (
                    <option key={tt.id} value={tt.id}>{tt.name}</option>
                  ))}
                </select>
              </div>
            )}

            {addMode === 'personal' && (
              <div>
                <Label className="text-xs">Клиент</Label>
                <select
                  value={form.personalClientId}
                  onChange={e => setForm(f => ({ ...f, personalClientId: e.target.value }))}
                  className="w-full h-8 text-sm border border-input rounded-md px-2 bg-white"
                >
                  <option value="">Выберите клиента...</option>
                  {state.clients.filter(c => c.branchId === state.currentBranchId).map(c => (
                    <option key={c.id} value={c.id}>{c.lastName} {c.firstName}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <Label className="text-xs">Тренер</Label>
              <select
                value={form.trainerId}
                onChange={e => setForm(f => ({ ...f, trainerId: e.target.value }))}
                className="w-full h-8 text-sm border border-input rounded-md px-2 bg-white"
              >
                <option value="">Выберите тренера...</option>
                {branchTrainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            {addMode === 'group' && (
              <div>
                <Label className="text-xs">Макс. мест</Label>
                <Input
                  type="number" min={1} value={form.maxCapacity}
                  onChange={e => setForm(f => ({ ...f, maxCapacity: +e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setShowAddModal(false)} className="flex-1">Отмена</Button>
              <Button onClick={handleAddEntry} className="flex-1">Добавить</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      <Dialog open={!!editEntryId} onOpenChange={v => { if (!v) setEditEntryId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Редактировать тренировку</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Время</Label>
                  <Input type="time" value={editForm.time || ''} onChange={e => setEditForm(f => ({ ...f, time: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Зал</Label>
                  <select value={editForm.hallId || ''} onChange={e => setEditForm(f => ({ ...f, hallId: e.target.value || undefined }))}
                    className="w-full h-8 text-sm border border-input rounded-md px-2 bg-white">
                    <option value="">Без зала</option>
                    {branchHalls.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </div>
              </div>
              {!editForm.isPersonal && (
                <div>
                  <Label className="text-xs">Вид тренировки</Label>
                  <select value={editForm.trainingTypeId || ''} onChange={e => setEditForm(f => ({ ...f, trainingTypeId: e.target.value }))}
                    className="w-full h-8 text-sm border border-input rounded-md px-2 bg-white">
                    <option value="">Выберите...</option>
                    {state.trainingTypes.map(tt => <option key={tt.id} value={tt.id}>{tt.name}</option>)}
                  </select>
                </div>
              )}
              {editForm.isPersonal && (
                <div>
                  <Label className="text-xs">Клиент</Label>
                  <select value={editForm.personalClientId || ''} onChange={e => setEditForm(f => ({ ...f, personalClientId: e.target.value }))}
                    className="w-full h-8 text-sm border border-input rounded-md px-2 bg-white">
                    <option value="">Выберите клиента...</option>
                    {state.clients.filter(c => c.branchId === state.currentBranchId).map(c => (
                      <option key={c.id} value={c.id}>{c.lastName} {c.firstName}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <Label className="text-xs">Тренер</Label>
                <select value={editForm.trainerId || ''} onChange={e => setEditForm(f => ({ ...f, trainerId: e.target.value }))}
                  className="w-full h-8 text-sm border border-input rounded-md px-2 bg-white">
                  <option value="">Выберите тренера...</option>
                  {branchTrainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              {!editForm.isPersonal && (
                <div>
                  <Label className="text-xs">Макс. мест</Label>
                  <Input type="number" min={1} value={editForm.maxCapacity || 1}
                    onChange={e => setEditForm(f => ({ ...f, maxCapacity: +e.target.value }))} className="h-8 text-sm" />
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => setEditEntryId(null)} className="flex-1">Отмена</Button>
                <Button onClick={saveEdit} className="flex-1">Сохранить</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Attend modal */}
      <Dialog open={!!attendModal} onOpenChange={v => { if (!v) { setAttendModal(null); setSelectedBasis(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Отметить приход</DialogTitle>
          </DialogHeader>
          {attendModal && (() => {
            const { subscriptions, singles } = getAttendBases(attendModal.clientId, attendModal.entryId);
            const client = state.clients.find(c => c.id === attendModal.clientId);
            return (
              <div className="space-y-3">
                <div className="text-sm font-medium">{client?.lastName} {client?.firstName}</div>
                <div className="text-xs text-muted-foreground mb-2">Выберите основание для прохода:</div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {subscriptions.map(sub => (
                    <label key={sub.id} className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${selectedBasis?.type === 'subscription' && (selectedBasis as { type: 'subscription'; subId: string }).subId === sub.id ? 'border-foreground bg-secondary' : 'border-border hover:bg-secondary'}`}>
                      <input type="radio" className="mt-0.5 accent-foreground"
                        checked={selectedBasis?.type === 'subscription' && (selectedBasis as { type: 'subscription'; subId: string }).subId === sub.id}
                        onChange={() => setSelectedBasis({ type: 'subscription', subId: sub.id })} />
                      <div>
                        <div className="text-sm font-medium">{sub.planName}</div>
                        <div className="text-xs text-muted-foreground">
                          до {sub.endDate} · {sub.sessionsLeft === 'unlimited' ? '∞' : `ост. ${sub.sessionsLeft}`}
                        </div>
                      </div>
                    </label>
                  ))}
                  {singles.map(plan => (
                    <label key={plan.id} className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${selectedBasis?.type === 'single' && (selectedBasis as { type: 'single'; planId: string }).planId === plan.id ? 'border-foreground bg-secondary' : 'border-border hover:bg-secondary'}`}>
                      <input type="radio" className="mt-0.5 accent-foreground"
                        checked={selectedBasis?.type === 'single' && (selectedBasis as { type: 'single'; planId: string }).planId === plan.id}
                        onChange={() => setSelectedBasis({ type: 'single', planId: plan.id })} />
                      <div>
                        <div className="text-sm font-medium">{plan.name}</div>
                        <div className="text-xs text-muted-foreground">{plan.price} ₽ · разовое</div>
                      </div>
                    </label>
                  ))}
                  {subscriptions.length === 0 && singles.length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-4">Нет доступных абонементов</div>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" onClick={() => { setAttendModal(null); setSelectedBasis(null); }} className="flex-1">Отмена</Button>
                  <Button onClick={handleConfirmAttend} disabled={!selectedBasis} className="flex-1">Подтвердить</Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
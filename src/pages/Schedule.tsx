import { useState } from 'react';
import { StoreType, ScheduleEntry, Client } from '@/store';
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

const NO_HALL_ID = '__no_hall__';

export default function Schedule({ store, onSell }: ScheduleProps) {
  const { state, addScheduleEntry, updateScheduleEntry, removeScheduleEntry, enrollClient, markVisit, resetVisit, copyWeekSchedule, addClientToBranch, sellExtra, unfreezeSubscription } = store;

  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedHallId, setSelectedHallId] = useState<string>(NO_HALL_ID);

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

  // Модал доплаты (extra): показывается после выбора основания если у тренировки есть extraPrice
  const [extraModal, setExtraModal] = useState<{
    clientId: string; entryId: string; visitId: string;
    subscriptionId: string | null; isSingleVisit: boolean; singlePrice: number;
    singlePlanId?: string | null; extraPrice: number; extraPriceName: string;
  } | null>(null);
  const [extraPaymentMethod, setExtraPaymentMethod] = useState<'cash' | 'card'>('card');



  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const toLocalDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const todayStr = toLocalDateStr(today);

  const getWeekDays = () => {
    const days: string[] = [];
    const monday = new Date(today);
    const dow = today.getDay();
    const diff = (dow === 0 ? -6 : 1 - dow) + weekOffset * 7;
    monday.setDate(today.getDate() + diff);
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(toLocalDateStr(d));
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
    if (!trainingTypeId) return '#8b5cf6';
    const tt = state.trainingTypes.find(t => t.id === trainingTypeId);
    if (!tt) return '#888';
    if (tt.categoryId) {
      const cat = state.trainingCategories.find(c => c.id === tt.categoryId);
      if (cat) return cat.color;
    }
    return tt.color;
  };

  const branchHalls = state.halls.filter(h => h.branchId === state.currentBranchId);

  // Tabs: "Все залы" + каждый зал
  const hallTabs = [
    { id: NO_HALL_ID, name: 'Все залы' },
    ...branchHalls,
  ];

  // Initialise selected hall tab to first if not set yet
  const activeHallId = selectedHallId;

  // Filter entries by current hall tab
  const filterEntry = (e: ScheduleEntry) => {
    if (activeHallId === NO_HALL_ID) return true;
    return (e.hallId || NO_HALL_ID) === activeHallId;
  };

  const selectedEntry = selectedEntryId ? state.schedule.find(e => e.id === selectedEntryId) : null;

  const openAddFor = (date: string) => {
    setAddForDate(date);
    setAddMode('group');
    setForm({
      trainingTypeId: '', trainerId: '', time: '09:00', maxCapacity: 15,
      hallId: activeHallId !== NO_HALL_ID ? activeHallId : '',
      personalClientId: '',
    });
    setShowAddModal(true);
  };

  const handleAddEntry = () => {
    if (addMode === 'group' && (!form.trainingTypeId || !form.trainerId || !form.hallId)) return;
    if (addMode === 'personal' && (!form.trainerId || !form.personalClientId || !form.hallId)) return;
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

  const openEdit = (entry: ScheduleEntry) => {
    setEditEntryId(entry.id);
    setEditForm({ ...entry });
    setSelectedEntryId(null);
  };

  const saveEdit = () => {
    if (!editEntryId) return;
    updateScheduleEntry(editEntryId, editForm);
    setEditEntryId(null);
    setEditForm({});
  };

  // Поиск клиента: по телефону (5+ цифр) — все филиалы, иначе — только текущий
  const enrollIsPhoneSearch = enrollSearch.replace(/\D/g, '').length >= 5;
  const filteredClients: (Client & { isOtherBranch?: boolean })[] = selectedEntry && !selectedEntry.isPersonal
    ? (enrollIsPhoneSearch
        ? state.clients
            .filter(c => c.phone.replace(/\D/g, '').includes(enrollSearch.replace(/\D/g, '')) && !selectedEntry.enrolledClientIds.includes(c.id))
            .map(c => ({ ...c, isOtherBranch: c.branchId !== state.currentBranchId }))
        : state.clients.filter(c =>
            c.branchId === state.currentBranchId &&
            !selectedEntry.enrolledClientIds.includes(c.id) &&
            `${c.lastName} ${c.firstName} ${c.phone}`.toLowerCase().includes(enrollSearch.toLowerCase())
          )
      )
    : [];

  // Записать клиента (возможно из другого филиала) на тренировку
  const enrollClientMaybeOtherBranch = (entryId: string, clientId: string) => {
    const client = state.clients.find(c => c.id === clientId);
    if (client && client.branchId !== state.currentBranchId) {
      // Клиент из другого филиала — добавляем в текущий (синхронно через store не получить новый id, поэтому добавляем и сразу ищем)
      addClientToBranch(clientId, state.currentBranchId);
      setTimeout(() => {
        const newClient = state.clients.find(c =>
          c.phone.replace(/\D/g, '') === client.phone.replace(/\D/g, '') &&
          c.branchId === state.currentBranchId
        );
        if (newClient) enrollClient(entryId, newClient.id);
        else enrollClient(entryId, clientId);
      }, 30);
    } else {
      enrollClient(entryId, clientId);
    }
  };

  const openAttendModal = (clientId: string, entryId: string) => {
    const visit = state.visits.find(v => v.clientId === clientId && v.scheduleEntryId === entryId);
    if (!visit?.id) {
      enrollClient(entryId, clientId);
      setTimeout(() => {
        const nv = state.visits.find(v => v.clientId === clientId && v.scheduleEntryId === entryId);
        if (nv) { setAttendModal({ clientId, entryId, visitId: nv.id }); setSelectedBasis(null); }
      }, 50);
      return;
    }
    setAttendModal({ clientId, entryId, visitId: visit.id });
    setSelectedBasis(null);
  };

  const handleConfirmAttend = () => {
    if (!attendModal || !selectedBasis) return;
    const isSingle = selectedBasis.type === 'single';
    const subId = selectedBasis.type === 'subscription' ? selectedBasis.subId : null;
    const singlePlan = isSingle && selectedBasis.type === 'single'
      ? state.singleVisitPlans.find(p => p.id === selectedBasis.planId) : null;
    const visit = state.visits.find(v => v.clientId === attendModal.clientId && v.scheduleEntryId === attendModal.entryId);
    const entry = state.schedule.find(e => e.id === attendModal.entryId);
    const tt = entry ? state.trainingTypes.find(t => t.id === entry.trainingTypeId) : null;
    const extraPrice = tt?.extraPrice ?? null;
    // Проверяем: если разовое посещение помечено "без доплат" — доплата не нужна
    const singlePlanNoExtra = isSingle && singlePlan?.noExtraCharge === true;

    if (extraPrice && extraPrice > 0 && !singlePlanNoExtra) {
      // Требуется доплата — показываем модал оплаты
      setExtraModal({
        clientId: attendModal.clientId,
        entryId: attendModal.entryId,
        visitId: visit?.id || attendModal.visitId,
        subscriptionId: subId,
        isSingleVisit: isSingle,
        singlePrice: singlePlan?.price || 0,
        singlePlanId: singlePlan?.id ?? null,
        extraPrice,
        extraPriceName: tt?.extraPriceName || 'Доплата',
      });
      setAttendModal(null);
      setSelectedBasis(null);
      return;
    }

    markVisit(visit?.id || attendModal.visitId, 'attended', subId, isSingle, singlePlan?.price || 0, singlePlan?.id ?? null);
    setAttendModal(null);
    setSelectedBasis(null);
  };

  const handleConfirmExtra = () => {
    if (!extraModal) return;
    // Сначала отмечаем посещение
    markVisit(extraModal.visitId, 'attended', extraModal.subscriptionId, extraModal.isSingleVisit, extraModal.singlePrice, extraModal.singlePlanId);
    // Потом проводим доплату
    sellExtra(extraModal.clientId, extraModal.extraPriceName, extraModal.extraPrice, extraPaymentMethod, state.currentBranchId);
    setExtraModal(null);
    setExtraPaymentMethod('card');
  };

  const handleMarkVisit = (clientId: string, entryId: string, status: 'missed' | 'cancelled') => {
    const visit = state.visits.find(v => v.clientId === clientId && v.scheduleEntryId === entryId);
    if (visit) {
      markVisit(visit.id, status, null, false, 0);
    } else {
      enrollClient(entryId, clientId);
      setTimeout(() => {
        const nv = state.visits.find(v => v.clientId === clientId && v.scheduleEntryId === entryId);
        if (nv) markVisit(nv.id, status, null, false, 0);
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
      s.clientId === clientId && (s.status === 'active' || s.status === 'pending' || s.status === 'frozen') &&
      (s.sessionsLeft === 'unlimited' || (s.sessionsLeft as number) > 0)
    ).filter(s => {
      const plan = state.subscriptionPlans.find(p => p.id === s.planId);
      if (!plan) return false;
      return plan.allDirections || (tt ? plan.trainingTypeIds.includes(tt.id) : false);
    });
    const singles = state.singleVisitPlans.filter(p => {
      if (tt && p.trainingTypeIds.length > 0 && !p.trainingTypeIds.includes(tt.id)) return false;
      const purchasedCount = state.sales.filter(s => s.clientId === clientId && s.type === 'single' && s.itemId === p.id).length;
      const usedCount = state.visits.filter(v => v.clientId === clientId && v.isSingleVisit && v.status === 'attended' && (v.singlePlanId != null ? v.singlePlanId === p.id : v.price === p.price)).length;
      return purchasedCount > usedCount;
    });
    return { subscriptions: activeSubs, singles };
  };

  // Export PDF расписания
  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const branch = state.branches.find(b => b.id === state.currentBranchId);
    doc.setFontSize(11);
    doc.text(`Raspisanie: ${branch?.name || ''} | ${weekDays[0]} - ${weekDays[6]}`, 14, 14);
    const dayHeaders = weekDays.map((d, i) => {
      const info = formatDayHeader(d);
      return `${DAY_NAMES[i]} ${info.date}`;
    });
    const allEntries = state.schedule.filter(e => e.branchId === state.currentBranchId && weekDays.includes(e.date));
    const times = [...new Set(allEntries.map(e => e.time))].sort();
    const halls = branchHalls.length > 0 ? branchHalls : [{ id: NO_HALL_ID, name: 'Bez zala', capacity: 0, branchId: '' }];
    const head = [['Vremya', 'Zal', ...dayHeaders]];
    const body: string[][] = [];
    times.forEach(time => {
      halls.forEach((hall, hi) => {
        const row = [hi === 0 ? time : '', hall.name];
        weekDays.forEach(dateStr => {
          const entries = allEntries.filter(e => e.date === dateStr && e.time === time && (e.hallId || NO_HALL_ID) === hall.id);
          row.push(entries.map(e => {
            const tt = state.trainingTypes.find(t => t.id === e.trainingTypeId);
            const tr = state.trainers.find(t => t.id === e.trainerId);
            if (e.isPersonal) {
              const cl = state.clients.find(c => c.id === e.personalClientId);
              return `[Pers] ${cl ? cl.lastName : '?'} / ${tr?.name || ''}`;
            }
            return `${tt?.name || '?'} / ${tr?.name || ''}`;
          }).join('; '));
        });
        body.push(row);
      });
    });
    if (body.length === 0) body.push(['Net trenirovok', '', ...weekDays.map(() => '')]);
    autoTable(doc, {
      head, body, startY: 20,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [30, 30, 30], textColor: 255 },
      margin: { left: 10, right: 10 },
    });
    doc.save(`raspisanie-${weekDays[0]}.pdf`);
  };

  // Export PNG — рисуем таблицу на canvas: время × дни недели
  const exportPNG = async () => {
    const allEntries = state.schedule.filter(e => e.branchId === state.currentBranchId && weekDays.includes(e.date) && filterEntry(e));
    const times = [...new Set(allEntries.map(e => e.time))].sort();
    if (times.length === 0) { alert('Нет тренировок для выгрузки'); return; }
    const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const colW = 160, rowH = 70, timeColW = 60, headerH = 36, padding = 8;
    const totalW = timeColW + colW * 7;
    const totalH = headerH + rowH * times.length;
    const canvas = document.createElement('canvas');
    const scale = 2;
    canvas.width = totalW * scale;
    canvas.height = totalH * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, totalW, totalH);
    // header bg
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, totalW, headerH);
    // day headers
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    dayNames.forEach((d, i) => {
      ctx.fillText(d, timeColW + colW * i + colW / 2, headerH / 2);
    });
    // time column header
    ctx.fillStyle = '#888';
    ctx.font = '11px sans-serif';
    ctx.fillText('Время', timeColW / 2, headerH / 2);
    // rows
    times.forEach((time, ri) => {
      const y = headerH + rowH * ri;
      // alternating row bg
      ctx.fillStyle = ri % 2 === 0 ? '#f8f8f8' : '#ffffff';
      ctx.fillRect(0, y, totalW, rowH);
      // time cell
      ctx.fillStyle = '#333';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(time, timeColW / 2, y + rowH / 2);
      // cells
      weekDays.forEach((dateStr, di) => {
        const x = timeColW + colW * di;
        const cellEntries = allEntries.filter(e => e.date === dateStr && e.time === time);
        let textY = y + padding + 12;
        cellEntries.forEach(entry => {
          const tt = state.trainingTypes.find(t => t.id === entry.trainingTypeId);
          const tr = state.trainers.find(t => t.id === entry.trainerId);
          const name = entry.isPersonal ? 'Персональная' : (tt?.name || '');
          const trainerName = tr?.name || '';
          const color = entry.isPersonal ? '#ef4444' : getEntryColor(entry.trainingTypeId);
          // colored dot
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x + padding + 4, textY - 3, 4, 0, Math.PI * 2);
          ctx.fill();
          // name
          ctx.fillStyle = '#111';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(name, x + padding + 12, textY);
          textY += 14;
          // trainer
          ctx.fillStyle = '#666';
          ctx.font = '10px sans-serif';
          ctx.fillText(trainerName, x + padding + 12, textY);
          textY += 18;
        });
      });
      // grid lines
      ctx.strokeStyle = '#e5e5e5';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(totalW, y);
      ctx.stroke();
      // vertical lines
      [timeColW, ...weekDays.map((_, i) => timeColW + colW * i)].forEach(x => {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, totalH);
        ctx.stroke();
      });
    });
    const link = document.createElement('a');
    link.download = `raspisanie-${weekDays[0]}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // Копировать расписание на следующую неделю
  const copyToNextWeek = () => {
    const nextWeekDays = weekDays.map(d => {
      const dt = new Date(d + 'T12:00:00');
      dt.setDate(dt.getDate() + 7);
      return dt.toISOString().split('T')[0];
    });
    const entriesThisWeek = state.schedule.filter(e => e.branchId === state.currentBranchId && weekDays.includes(e.date));
    if (entriesThisWeek.length === 0) { alert('На этой неделе нет тренировок'); return; }
    if (confirm(`Скопировать ${entriesThisWeek.length} тренировок на следующую неделю?`)) {
      copyWeekSchedule(weekDays, nextWeekDays);
      setWeekOffset(w => w + 1);
    }
  };

  const branchTrainers = state.trainers.filter(t => (t.branchIds ?? [t.branchId]).includes(state.currentBranchId));

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

  return (
    <div className="flex gap-5 h-full animate-fade-in min-h-0">
      {/* Left: week grid */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">

        {/* Week navigation */}
        <div className="flex items-center justify-between mb-3 shrink-0">
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

        {/* Hall tabs + export */}
        <div className="flex items-center justify-between mb-3 shrink-0 gap-3">
          <div className="flex items-center gap-1 bg-secondary rounded-xl p-1 flex-wrap">
            {hallTabs.map(hall => (
              <button
                key={hall.id}
                onClick={() => setSelectedHallId(hall.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeHallId === hall.id
                    ? 'bg-white shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {hall.name}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={copyToNextWeek} className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-secondary hover:bg-secondary/70 transition-colors text-muted-foreground">
              <Icon name="Copy" size={13} /> Копировать
            </button>
            <button onClick={exportPNG} className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-secondary hover:bg-secondary/70 transition-colors text-muted-foreground">
              <Icon name="Image" size={13} /> PNG
            </button>
            <button onClick={exportPDF} className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-secondary hover:bg-secondary/70 transition-colors text-muted-foreground">
              <Icon name="FileText" size={13} /> PDF
            </button>
          </div>
        </div>

        {/* Week grid — time rows × day columns */}
        <div className="flex-1 overflow-auto">
          {(() => {
            const allWeekEntries = state.schedule.filter(e =>
              e.branchId === state.currentBranchId &&
              weekDays.includes(e.date) &&
              filterEntry(e)
            );
            const uniqueTimes = [...new Set(allWeekEntries.map(e => e.time))].sort();
            return (
              <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: 52 }} />
                  {weekDays.map(d => <col key={d} />)}
                </colgroup>
                <thead>
                  <tr>
                    <th className="sticky top-0 z-20 bg-secondary/90 border-b border-border" style={{ width: 52 }} />
                    {weekDays.map(dateStr => {
                      const { weekday, date, month, isToday } = formatDayHeader(dateStr);
                      return (
                        <th key={dateStr} className="sticky top-0 z-20 bg-secondary/90 border-b border-border px-1 pb-2 pt-1">
                          <div className={`text-center py-1.5 px-1 rounded-xl ${isToday ? 'bg-foreground text-primary-foreground' : ''}`}>
                            <div className="text-xs capitalize opacity-70">{weekday}</div>
                            <div className="text-sm font-bold leading-tight">{date}</div>
                            <div className="text-xs opacity-60">{month}</div>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {uniqueTimes.map(time => (
                    <tr key={time} className="group border-b border-border/50 hover:bg-secondary/20 transition-colors">
                      <td className="text-center align-top pt-2 pb-1 text-xs font-semibold text-muted-foreground select-none sticky left-0 bg-background group-hover:bg-secondary/20 z-10 border-r border-border/30" style={{ width: 52 }}>
                        {time}
                      </td>
                      {weekDays.map(dateStr => {
                        const cellEntries = allWeekEntries.filter(e => e.date === dateStr && e.time === time);
                        return (
                          <td key={dateStr} className="align-top px-1 py-1 min-w-0">
                            <div className="space-y-1">
                              {cellEntries.map(entry => {
                                const tt = state.trainingTypes.find(t => t.id === entry.trainingTypeId);
                                const color = entry.isPersonal ? '#ef4444' : getEntryColor(entry.trainingTypeId);
                                const isSelected = selectedEntryId === entry.id;
                                const totalEnrolled = entry.enrolledClientIds.length + (entry.guestCount || 0);
                                const fillPct = entry.maxCapacity > 0 ? (totalEnrolled / entry.maxCapacity) * 100 : 0;
                                const personalClient = entry.isPersonal && entry.personalClientId
                                  ? state.clients.find(c => c.id === entry.personalClientId) : null;
                                const trainerName = state.trainers.find(t => t.id === entry.trainerId)?.name || '';
                                return (
                                  <div
                                    key={entry.id}
                                    onClick={() => setSelectedEntryId(entry.id === selectedEntryId ? null : entry.id)}
                                    className={`rounded-lg p-1.5 cursor-pointer transition-all border ${isSelected ? 'border-foreground shadow-sm' : 'border-transparent hover:border-border'}`}
                                    style={{ background: color + '18', borderLeftColor: color, borderLeftWidth: 3 }}
                                  >
                                    {entry.isPersonal ? (
                                      <>
                                        <div className="text-xs font-medium text-foreground leading-tight truncate">
                                          {personalClient ? `${personalClient.lastName} ${personalClient.firstName}` : 'Персональная'}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-0.5 truncate">{trainerName}</div>
                                      </>
                                    ) : (
                                      <>
                                        <div className="text-xs font-medium text-foreground leading-tight truncate">{tt?.name}</div>
                                        <div className="text-xs text-muted-foreground mt-0.5 truncate">{trainerName}</div>
                                        <div className="text-xs text-muted-foreground">{totalEnrolled}/{entry.maxCapacity}</div>
                                        <div className="w-full h-0.5 bg-white/50 rounded-full mt-1 overflow-hidden">
                                          <div className="h-full rounded-full" style={{ width: `${fillPct}%`, background: color }} />
                                        </div>
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                              <button
                                onClick={() => openAddFor(dateStr)}
                                className="w-full py-1 rounded border border-dashed border-transparent hover:border-border hover:bg-secondary transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Icon name="Plus" size={12} className="mx-auto text-muted-foreground" />
                              </button>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {/* Пустая строка для добавления — всегда видна */}
                  <tr className="border-b border-border/30">
                    <td className="py-2 text-center text-muted-foreground text-xs sticky left-0 bg-background border-r border-border/30" style={{ width: 52 }}>
                      <Icon name="Clock" size={13} className="mx-auto opacity-40" />
                    </td>
                    {weekDays.map(dateStr => (
                      <td key={dateStr} className="px-1 py-1">
                        <button
                          onClick={() => openAddFor(dateStr)}
                          className="w-full py-2 rounded-lg border border-dashed border-border hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                        >
                          <Icon name="Plus" size={13} className="mx-auto" />
                        </button>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            );
          })()}
        </div>
      </div>

      {/* Right: entry detail panel */}
      {selectedEntry && (() => {
        const tt = state.trainingTypes.find(t => t.id === selectedEntry.trainingTypeId);
        const trainer = state.trainers.find(t => t.id === selectedEntry.trainerId);
        const hall = selectedEntry.hallId ? state.halls.find(h => h.id === selectedEntry.hallId) : null;
        const color = selectedEntry.isPersonal ? '#8b5cf6' : getEntryColor(selectedEntry.trainingTypeId);
        const entryDate = new Date(selectedEntry.date + 'T12:00:00').toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
        const personalClient = selectedEntry.isPersonal && selectedEntry.personalClientId
          ? state.clients.find(c => c.id === selectedEntry.personalClientId) : null;
        return (
          <div className="w-96 shrink-0 bg-white border border-border rounded-xl overflow-hidden flex flex-col animate-slide-in-right">
            <div className="px-4 py-4 border-b border-border" style={{ borderTop: `3px solid ${color}` }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
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
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(selectedEntry)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground">
                    <Icon name="Pencil" size={14} />
                  </button>
                  <button
                    onClick={() => { if (confirm('Удалить тренировку?')) { removeScheduleEntry(selectedEntry.id); setSelectedEntryId(null); } }}
                    className="p-1.5 rounded hover:bg-red-50 text-red-400"
                  >
                    <Icon name="Trash2" size={14} />
                  </button>
                  <button onClick={() => setSelectedEntryId(null)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground">
                    <Icon name="X" size={15} />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {!selectedEntry.isPersonal && (
                <>
                  <div className="px-4 py-3 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Записать клиента
                  </div>
                  <div className="px-4 pb-3 border-b border-border">
                    <Input
                      placeholder="Поиск клиента..."
                      value={enrollSearch}
                      onChange={e => setEnrollSearch(e.target.value)}
                      className="h-8 text-sm mt-2"
                    />
                    {enrollSearch.trim().length > 0 && (
                      <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                        {filteredClients.slice(0, 20).map(c => {
                          const clientSub = c.activeSubscriptionId
                            ? state.subscriptions.find(s => s.id === c.activeSubscriptionId)
                            : null;
                          const hasActiveSub = !!clientSub;
                          return (
                          <button
                            key={c.id}
                            onClick={() => enrollClientMaybeOtherBranch(selectedEntry.id, c.id)}
                            className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-secondary transition-colors"
                          >
                            <div className="flex items-center justify-between gap-1 flex-wrap">
                              <div className="flex items-center gap-1 flex-wrap">
                                <span>{c.lastName} {c.firstName}</span>
                                {c.isOtherBranch && (
                                  <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                    {state.branches.find(b => b.id === c.branchId)?.name}
                                  </span>
                                )}
                                <span className="text-muted-foreground">· {c.phone}</span>
                              </div>
                              {hasActiveSub && (
                                <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                  {clientSub!.sessionsLeft === 'unlimited'
                                    ? '∞ абонемент'
                                    : `абонемент ${clientSub!.sessionsLeft} зан.`}
                                </span>
                              )}
                            </div>
                          </button>
                          );
                        })}
                        {filteredClients.length === 0 && (
                          <div className="text-xs text-muted-foreground px-2 py-2">Клиент не найден</div>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => {
                        const guestCount = (selectedEntry.guestCount || 0) + 1;
                        const total = selectedEntry.enrolledClientIds.length + guestCount;
                        if (total > selectedEntry.maxCapacity) return;
                        updateScheduleEntry(selectedEntry.id, { guestCount });
                      }}
                      disabled={(selectedEntry.enrolledClientIds.length + (selectedEntry.guestCount || 0)) >= selectedEntry.maxCapacity}
                      className="mt-2 w-full py-1.5 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:bg-secondary transition-colors disabled:opacity-40"
                    >
                      + Гость (без клиента в базе)
                    </button>
                  </div>
                </>
              )}
              <div className="px-4 py-3 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Записанные ({selectedEntry.enrolledClientIds.length + (selectedEntry.guestCount || 0)} / {selectedEntry.maxCapacity})
              </div>
              {selectedEntry.enrolledClientIds.length === 0 && !selectedEntry.guestCount && (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">Никто не записан</div>
              )}
              {/* Гости без клиента */}
              {(selectedEntry.guestCount || 0) > 0 && Array.from({ length: selectedEntry.guestCount || 0 }).map((_, i) => (
                <div key={`guest-${i}`} className="px-4 py-2 border-b border-border/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name="UserX" size={14} className="text-muted-foreground" />
                    <span className="text-sm text-muted-foreground italic">Гость #{i + 1}</span>
                  </div>
                  <button
                    onClick={() => updateScheduleEntry(selectedEntry.id, { guestCount: Math.max(0, (selectedEntry.guestCount || 0) - 1) })}
                    className="text-xs text-red-400 hover:text-red-600 px-1.5 py-0.5 rounded"
                  >
                    Удалить
                  </button>
                </div>
              ))}
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
                          {!client.activeSubscriptionId && !state.subscriptions.some(s => s.clientId === client.id) && <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">новичок</span>}
                          {subEnding && <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">⚠ абон. кончается</span>}
                        </div>
                        {client.comment && (
                          <div className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                            <span>💬</span><span className="truncate">{client.comment}</span>
                          </div>
                        )}
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
                        <div className="flex flex-col gap-1 shrink-0">
                          <button
                            onClick={() => openAttendModal(clientId, selectedEntry.id)}
                            className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors font-medium"
                          >
                            Пришёл
                          </button>
                          <button
                            onClick={() => handleMarkVisit(clientId, selectedEntry.id, 'missed')}
                            className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium"
                          >
                            Не пришёл
                          </button>
                          <button
                            onClick={() => handleMarkVisit(clientId, selectedEntry.id, 'cancelled')}
                            className="text-xs px-2 py-1 rounded bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors font-medium"
                          >
                            Отменил
                          </button>
                        </div>
                      )}
                      {currentStatus === 'attended' && (
                        <div className="flex flex-col gap-1 shrink-0">
                          <button
                            onClick={() => { if (visit?.id) resetVisit(visit.id); }}
                            className="text-xs px-2 py-1 rounded bg-secondary text-muted-foreground hover:bg-secondary/70 transition-colors font-medium"
                          >
                            Сбросить
                          </button>
                        </div>
                      )}
                      {(currentStatus === 'missed' || currentStatus === 'cancelled') && (
                        <div className="flex flex-col gap-1 shrink-0">
                          <button
                            onClick={() => openAttendModal(clientId, selectedEntry.id)}
                            className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors font-medium"
                          >
                            Пришёл
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

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
            <div className="flex gap-2">
              <button
                onClick={() => setAddMode('group')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${addMode === 'group' ? 'bg-foreground text-primary-foreground border-foreground' : 'bg-white border-border hover:bg-secondary'}`}
              >
                Групповая
              </button>
              <button
                onClick={() => setAddMode('personal')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${addMode === 'personal' ? 'bg-red-500 text-white border-red-500' : 'bg-white border-border hover:bg-secondary'}`}
              >
                Персональная
              </button>
            </div>
            {addMode === 'personal' && (
              <div>
                <Label className="text-xs">Клиент</Label>
                <select value={form.personalClientId} onChange={e => setForm(f => ({ ...f, personalClientId: e.target.value }))}
                  className="w-full h-8 text-sm border border-input rounded-md px-2 bg-white">
                  <option value="">Выберите клиента...</option>
                  {state.clients.filter(c => c.branchId === state.currentBranchId).map(c => (
                    <option key={c.id} value={c.id}>{c.lastName} {c.firstName}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Время</Label>
                <Input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Зал <span className="text-red-500">*</span></Label>
                <select value={form.hallId} onChange={e => setForm(f => ({ ...f, hallId: e.target.value }))}
                  className={`w-full h-8 text-sm border rounded-md px-2 bg-white ${!form.hallId ? 'border-red-300' : 'border-input'}`}>
                  <option value="">— выберите зал —</option>
                  {branchHalls.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
            </div>
            {addMode === 'group' && (
              <div>
                <Label className="text-xs">Вид тренировки</Label>
                <select value={form.trainingTypeId} onChange={e => setForm(f => ({ ...f, trainingTypeId: e.target.value }))}
                  className="w-full h-8 text-sm border border-input rounded-md px-2 bg-white">
                  <option value="">Выберите...</option>
                  {state.trainingTypes.map(tt => (
                    <option key={tt.id} value={tt.id}>{tt.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <Label className="text-xs">Тренер</Label>
              <select value={form.trainerId} onChange={e => setForm(f => ({ ...f, trainerId: e.target.value }))}
                className="w-full h-8 text-sm border border-input rounded-md px-2 bg-white">
                <option value="">Выберите тренера...</option>
                {branchTrainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            {addMode === 'group' && (
              <div>
                <Label className="text-xs">Макс. мест</Label>
                <Input type="number" min={1} value={form.maxCapacity}
                  onChange={e => setForm(f => ({ ...f, maxCapacity: +e.target.value }))} className="h-8 text-sm" />
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
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Время</Label>
                <Input type="time" value={editForm.time || ''} onChange={e => setEditForm(f => ({ ...f, time: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Зал <span className="text-red-500">*</span></Label>
                <select value={editForm.hallId || ''} onChange={e => setEditForm(f => ({ ...f, hallId: e.target.value || undefined }))}
                  className="w-full h-8 text-sm border border-input rounded-md px-2 bg-white">
                  <option value="">— выберите зал —</option>
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
                <div className="text-xs text-muted-foreground">Выберите основание для прохода:</div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {subscriptions.map(sub => (
                    <div key={sub.id} className={`p-2.5 rounded-lg border transition-colors ${sub.status === 'frozen' ? 'border-blue-200 bg-blue-50/50' : selectedBasis?.type === 'subscription' && (selectedBasis as { type: 'subscription'; subId: string }).subId === sub.id ? 'border-foreground bg-secondary' : 'border-border hover:bg-secondary'}`}>
                      {sub.status === 'frozen' ? (
                        <div>
                          <div className="text-sm font-medium flex items-center gap-1.5">
                            {sub.planName}
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">❄️ Заморожен до {sub.frozenTo}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mb-2">
                            до {sub.endDate} · {sub.sessionsLeft === 'unlimited' ? '∞' : `ост. ${sub.sessionsLeft}`}
                          </div>
                          <button
                            onClick={() => { unfreezeSubscription(sub.id); setSelectedBasis({ type: 'subscription', subId: sub.id }); }}
                            className="text-xs px-2.5 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                          >
                            Разморозить и использовать
                          </button>
                        </div>
                      ) : (
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input type="radio" className="mt-0.5"
                            checked={selectedBasis?.type === 'subscription' && (selectedBasis as { type: 'subscription'; subId: string }).subId === sub.id}
                            onChange={() => setSelectedBasis({ type: 'subscription', subId: sub.id })} />
                          <div>
                            <div className="text-sm font-medium flex items-center gap-1.5">
                              {sub.planName}
                              {sub.status === 'pending' && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">активируется сейчас</span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {sub.status === 'pending' ? `Начнёт действовать с сегодня · ${sub.sessionsLeft === 'unlimited' ? '∞' : `ост. ${sub.sessionsLeft}`}` : `до ${sub.endDate} · ${sub.sessionsLeft === 'unlimited' ? '∞' : `ост. ${sub.sessionsLeft}`}`}
                            </div>
                          </div>
                        </label>
                      )}
                    </div>
                  ))}
                  {singles.map(plan => (
                    <label key={plan.id} className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${selectedBasis?.type === 'single' && (selectedBasis as { type: 'single'; planId: string }).planId === plan.id ? 'border-foreground bg-secondary' : 'border-border hover:bg-secondary'}`}>
                      <input type="radio" className="mt-0.5"
                        checked={selectedBasis?.type === 'single' && (selectedBasis as { type: 'single'; planId: string }).planId === plan.id}
                        onChange={() => setSelectedBasis({ type: 'single', planId: plan.id })} />
                      <div>
                        <div className="text-sm font-medium">{plan.name}</div>
                        <div className="text-xs text-muted-foreground">{plan.price} ₽ · разовое</div>
                      </div>
                    </label>
                  ))}
                  {subscriptions.length === 0 && singles.length === 0 && (
                    <div className="text-center py-4">
                      <div className="text-sm text-muted-foreground mb-3">Нет доступных абонементов или разовых</div>
                      <Button
                        onClick={() => {
                          setAttendModal(null);
                          setSelectedBasis(null);
                          onSell?.(attendModal?.clientId);
                        }}
                        className="bg-foreground text-primary-foreground hover:opacity-90"
                        size="sm"
                      >
                        <Icon name="ShoppingCart" size={14} className="mr-1.5" />
                        Продать абонемент
                      </Button>
                    </div>
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

      {/* Модал доплаты */}
      <Dialog open={!!extraModal} onOpenChange={v => { if (!v) setExtraModal(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Доплата за тренировку</DialogTitle>
          </DialogHeader>
          {extraModal && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="text-sm font-medium text-amber-800">{extraModal.extraPriceName}</div>
                <div className="text-xl font-bold text-amber-900 mt-1">{extraModal.extraPrice.toLocaleString()} ₽</div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Способ оплаты</Label>
                <div className="flex gap-2">
                  {(['cash', 'card'] as const).map(m => (
                    <button key={m} onClick={() => setExtraPaymentMethod(m)}
                      className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${extraPaymentMethod === m ? 'bg-foreground text-primary-foreground border-foreground' : 'border-border hover:bg-secondary'}`}>
                      {m === 'cash' ? '💵 Наличные' : '💳 Безнал'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setExtraModal(null)} className="flex-1">Отмена</Button>
                <Button onClick={handleConfirmExtra} className="flex-1 bg-foreground text-primary-foreground">Оплатить и отметить</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
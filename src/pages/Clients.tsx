import { useState } from 'react';
import { StoreType, Client, ClientCategory } from '@/store';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import ClientCard from '@/components/ClientCard';

interface ClientsProps {
  store: StoreType;
  onSell: (clientId?: string) => void;
}

const categories: { id: ClientCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'new', label: 'Новички' },
  { id: 'loyal', label: 'Лояльные' },
  { id: 'sleeping', label: 'Уснувшие' },
  { id: 'lost', label: 'Потерянные' },
];

const CHANNELS = ['whatsapp', 'telegram', 'phone', 'instagram', 'vk'];
const REFERRALS = ['Друзья', 'Интернет', 'Мимо проходил(а)', 'Блогер', 'Реклама', 'Другое'];
const AD_SOURCES = ['Instagram', 'VK', 'Яндекс', 'Google', 'Листовка', 'Сарафанное радио', 'Другое'];

export default function Clients({ store, onSell }: ClientsProps) {
  const { state, addClient, getClientCategory, getClientFullName, findClientByPhone } = store;
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ClientCategory | 'all'>('all');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [form, setForm] = useState({
    firstName: '', lastName: '', middleName: '', phone: '',
    contactChannel: 'whatsapp' as Client['contactChannel'],
    referralSource: '', adSource: '', birthDate: '', comment: ''
  });

  // Advanced filters
  const [filterPlanId, setFilterPlanId] = useState('');
  const [filterBranchId, setFilterBranchId] = useState('');
  const [filterSubPurchaseDate, setFilterSubPurchaseDate] = useState('');
  const [filterSubEndDate, setFilterSubEndDate] = useState('');
  const [filterBirthDate, setFilterBirthDate] = useState(''); // YYYY-MM-DD or MM-DD for month-day

  const activeFiltersCount = [filterPlanId, filterBranchId, filterSubPurchaseDate, filterSubEndDate, filterBirthDate].filter(Boolean).length;

  const clearFilters = () => {
    setFilterPlanId(''); setFilterBranchId(''); setFilterSubPurchaseDate('');
    setFilterSubEndDate(''); setFilterBirthDate('');
  };

  // Фильтр по филиалу — по месту регистрации клиента (branchId в карточке)
  const allBranchClients = filterBranchId === '__all__'
    ? state.clients
    : filterBranchId
      ? state.clients.filter(c => c.branchId === filterBranchId)
      : state.clients.filter(c => c.branchId === state.currentBranchId);

  const filtered = allBranchClients.filter(c => {
    const matchSearch = !search || getClientFullName(c).toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search);
    const matchCat = category === 'all' || getClientCategory(c) === category;

    const sub = c.activeSubscriptionId ? state.subscriptions.find(s => s.id === c.activeSubscriptionId) : null;

    const matchPlan = !filterPlanId || (sub?.planId === filterPlanId);
    // Конкретная дата покупки абонемента
    const matchSubPurchase = !filterSubPurchaseDate || (sub?.purchaseDate === filterSubPurchaseDate);
    // Конкретная дата истечения абонемента
    const matchSubEnd = !filterSubEndDate || (sub?.endDate === filterSubEndDate);
    // День рождения: конкретная дата (сравниваем MM-DD)
    const matchBirth = !filterBirthDate || (c.birthDate && c.birthDate.slice(5) === filterBirthDate.slice(5));

    return matchSearch && matchCat && matchPlan && matchSubPurchase && matchSubEnd && matchBirth;
  });

  // Global search by phone (other branches)
  const otherBranchResults = search && search.replace(/\D/g, '').length >= 5
    ? state.clients.filter(c => c.branchId !== state.currentBranchId && c.phone.replace(/\D/g, '').includes(search.replace(/\D/g, '')))
    : [];

  const handleAddClient = () => {
    if (!form.firstName || !form.lastName || !form.phone) return;
    const existing = findClientByPhone(form.phone);
    if (existing) {
      alert(`Клиент с таким номером уже есть: ${getClientFullName(existing)}`);
      return;
    }
    const c = addClient({ ...form, branchId: state.currentBranchId });
    setShowNew(false);
    setForm({ firstName: '', lastName: '', middleName: '', phone: '', contactChannel: 'whatsapp', referralSource: '', adSource: '', birthDate: '', comment: '' });
    setSelectedClientId(c.id);
  };

  const selectedClient = selectedClientId ? state.clients.find(c => c.id === selectedClientId) : null;

  // Счётчики по категориям
  const categoryCounts = allBranchClients.reduce<Record<string, number>>((acc, c) => {
    const cat = getClientCategory(c);
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});
  const totalCount = allBranchClients.length;

  return (
    <div className="flex gap-5 h-full animate-fade-in">
      {/* Left panel */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Icon name="Search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Поиск по имени или телефону"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`relative flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${showFilters || activeFiltersCount > 0 ? 'bg-foreground text-primary-foreground border-foreground' : 'bg-white border-border hover:bg-secondary'}`}
          >
            <Icon name="SlidersHorizontal" size={15} />
            Фильтры
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">{activeFiltersCount}</span>
            )}
          </button>
          <Button onClick={() => setShowNew(true)} className="bg-foreground text-primary-foreground hover:opacity-90 shrink-0">
            <Icon name="UserPlus" size={15} className="mr-1.5" />
            Новый клиент
          </Button>
        </div>

        {showFilters && (
          <div className="bg-white border border-border rounded-xl p-4 mb-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Фильтры</span>
              {activeFiltersCount > 0 && (
                <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700">Сбросить все</button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Абонемент</label>
                <select className="w-full border border-input rounded-lg px-3 py-2 text-sm" value={filterPlanId} onChange={e => setFilterPlanId(e.target.value)}>
                  <option value="">Все абонементы</option>
                  {state.subscriptionPlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Филиал регистрации</label>
                <select className="w-full border border-input rounded-lg px-3 py-2 text-sm" value={filterBranchId} onChange={e => setFilterBranchId(e.target.value)}>
                  <option value="">Текущий филиал</option>
                  {state.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  <option value="__all__">Все филиалы</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Дата покупки абонемента</label>
                <input type="date" className="w-full border border-input rounded-lg px-3 py-2 text-sm" value={filterSubPurchaseDate} onChange={e => setFilterSubPurchaseDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Дата истечения абонемента</label>
                <input type="date" className="w-full border border-input rounded-lg px-3 py-2 text-sm" value={filterSubEndDate} onChange={e => setFilterSubEndDate(e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">День рождения (конкретная дата)</label>
                <div className="flex items-center gap-2">
                  <input type="date" className="flex-1 border border-input rounded-lg px-3 py-2 text-sm" value={filterBirthDate} onChange={e => setFilterBirthDate(e.target.value)} />
                  <button
                    onClick={() => setFilterBirthDate(new Date().toISOString().split('T')[0])}
                    className="text-xs px-3 py-2 border border-border rounded-lg hover:bg-secondary transition-colors whitespace-nowrap"
                  >
                    Сегодня
                  </button>
                  {filterBirthDate && <button onClick={() => setFilterBirthDate('')} className="text-xs text-muted-foreground hover:text-foreground">✕</button>}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Сравниваются только день и месяц (год не учитывается)</div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground font-medium">Найдено: {filtered.length} клиентов</div>
          </div>
        )}

        <div className="flex gap-1 mb-4">
          {categories.map(cat => {
            const count = cat.id === 'all' ? totalCount : (categoryCounts[cat.id] || 0);
            return (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${category === cat.id ? 'bg-foreground text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}
              >
                {cat.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-normal ${category === cat.id ? 'bg-white/20 text-white' : 'bg-secondary text-muted-foreground'}`}>{count}</span>
              </button>
            );
          })}
        </div>

        <div className="bg-white border border-border rounded-xl overflow-hidden flex-1 overflow-y-auto">
          <table className="w-full data-table">
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Телефон</th>
                <th>Категория</th>
                <th>Абонемент</th>
                <th>Филиал</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const cat = getClientCategory(c);
                const sub = c.activeSubscriptionId ? state.subscriptions.find(s => s.id === c.activeSubscriptionId) : null;
                const branch = state.branches.find(b => b.id === c.branchId);
                const badgeClass = { new: 'badge-new', loyal: 'badge-loyal', sleeping: 'badge-sleeping', lost: 'badge-lost' }[cat];
                const catLabel = { new: 'Новичок', loyal: 'Лояльный', sleeping: 'Уснувший', lost: 'Потерянный' }[cat];
                return (
                  <tr key={c.id} className="cursor-pointer" onClick={() => setSelectedClientId(c.id)}>
                    <td>
                      <div className="font-medium">{getClientFullName(c)}</div>
                      {c.fromBranchId && <div className="text-xs text-amber-600">из другого филиала</div>}
                    </td>
                    <td className="text-muted-foreground">{c.phone}</td>
                    <td>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${badgeClass}`}>{catLabel}</span>
                    </td>
                    <td className="text-sm">
                      {sub ? (
                        <div>
                          <div className="font-medium text-green-700">{sub.planName}</div>
                          <div className="text-xs text-muted-foreground">до {sub.endDate}</div>
                        </div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="text-muted-foreground text-sm">{branch?.name}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">Клиенты не найдены</td></tr>
              )}
            </tbody>
          </table>

          {otherBranchResults.length > 0 && (
            <div className="border-t border-border px-5 py-3">
              <div className="text-xs text-muted-foreground mb-2">Найдено в других филиалах:</div>
              {otherBranchResults.map(c => {
                const branch = state.branches.find(b => b.id === c.branchId);
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between py-2 cursor-pointer hover:bg-secondary rounded-lg px-2"
                    onClick={() => setSelectedClientId(c.id)}
                  >
                    <div>
                      <span className="text-sm font-medium">{getClientFullName(c)}</span>
                      <span className="text-xs text-muted-foreground ml-2">{c.phone}</span>
                    </div>
                    <span className="text-xs text-amber-600">{branch?.name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right panel: client card */}
      {selectedClient && (
        <div className="w-96 shrink-0 animate-slide-in-right">
          <ClientCard
            client={selectedClient}
            store={store}
            onClose={() => setSelectedClientId(null)}
            onSell={() => onSell(selectedClient.id)}
          />
        </div>
      )}

      {/* New client modal */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Новый клиент</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Фамилия *</Label>
                <Input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Имя *</Label>
                <Input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Отчество</Label>
                <Input value={form.middleName} onChange={e => setForm(f => ({ ...f, middleName: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Телефон *</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+7 (999) 000-00-00" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Дата рождения</Label>
              <Input type="date" value={form.birthDate} onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Канал связи</Label>
              <select
                value={form.contactChannel}
                onChange={e => setForm(f => ({ ...f, contactChannel: e.target.value as Client['contactChannel'] }))}
                className="w-full border border-input rounded-lg px-3 py-2 text-sm"
              >
                {CHANNELS.map(ch => <option key={ch} value={ch}>{ch}</option>)}
              </select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Рекламный источник</Label>
              <select
                value={form.adSource}
                onChange={e => setForm(f => ({ ...f, adSource: e.target.value }))}
                className="w-full border border-input rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Выберите...</option>
                {AD_SOURCES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground mb-1 block">Комментарий</Label>
              <Textarea
                value={form.comment}
                onChange={e => setForm(f => ({ ...f, comment: e.target.value }))}
                rows={2}
                placeholder="Особенности, пожелания..."
              />
            </div>
          </div>
          <Button
            onClick={handleAddClient}
            disabled={!form.firstName || !form.lastName || !form.phone}
            className="w-full mt-2 bg-foreground text-primary-foreground hover:opacity-90"
          >
            Создать клиента
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
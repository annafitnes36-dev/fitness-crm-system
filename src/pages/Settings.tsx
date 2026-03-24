import { useState } from 'react';
import { StoreType } from '@/store';
import Icon from '@/components/ui/icon';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface SettingsProps {
  store: StoreType;
}

type Tab = 'trainings' | 'trainers' | 'plans' | 'single';

export default function Settings({ store }: SettingsProps) {
  const { state, addTrainingType, addTrainer, addSubscriptionPlan, addSingleVisitPlan } = store;
  const [tab, setTab] = useState<Tab>('trainings');
  const [showAddTraining, setShowAddTraining] = useState(false);
  const [showAddTrainer, setShowAddTrainer] = useState(false);
  const [showAddPlan, setShowAddPlan] = useState(false);
  const [showAddSingle, setShowAddSingle] = useState(false);

  const [ttForm, setTtForm] = useState({ name: '', duration: 60, description: '', color: '#6366f1' });
  const [trainerForm, setTrainerForm] = useState({ name: '', specialty: '', branchId: state.currentBranchId });
  const [planForm, setPlanForm] = useState({
    name: '', price: 0, durationDays: 30, sessionsLimit: 8 as number | 'unlimited',
    trainingTypeIds: [] as string[], freezeDays: 7
  });
  const [singleForm, setSingleForm] = useState({ name: '', price: 0, trainingTypeIds: [] as string[] });

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#ef4444', '#8b5cf6', '#06b6d4'];

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'trainings', label: 'Тренировки', icon: 'Dumbbell' },
    { id: 'trainers', label: 'Тренеры', icon: 'User' },
    { id: 'plans', label: 'Абонементы', icon: 'CreditCard' },
    { id: 'single', label: 'Разовые визиты', icon: 'Ticket' },
  ];

  const handleAddTraining = () => {
    if (!ttForm.name) return;
    addTrainingType({
      name: ttForm.name, duration: ttForm.duration, description: ttForm.description,
      trainerIds: [], branchIds: [state.currentBranchId], color: ttForm.color
    });
    setShowAddTraining(false);
    setTtForm({ name: '', duration: 60, description: '', color: '#6366f1' });
  };

  const handleAddTrainer = () => {
    if (!trainerForm.name) return;
    addTrainer({ name: trainerForm.name, specialty: trainerForm.specialty, branchId: trainerForm.branchId });
    setShowAddTrainer(false);
    setTrainerForm({ name: '', specialty: '', branchId: state.currentBranchId });
  };

  const handleAddPlan = () => {
    if (!planForm.name || planForm.price <= 0) return;
    addSubscriptionPlan({
      name: planForm.name, price: planForm.price, durationDays: planForm.durationDays,
      sessionsLimit: planForm.sessionsLimit, trainingTypeIds: planForm.trainingTypeIds,
      freezeDays: planForm.freezeDays, branchId: state.currentBranchId
    });
    setShowAddPlan(false);
    setPlanForm({ name: '', price: 0, durationDays: 30, sessionsLimit: 8, trainingTypeIds: [], freezeDays: 7 });
  };

  const handleAddSingle = () => {
    if (!singleForm.name || singleForm.price <= 0) return;
    addSingleVisitPlan({ name: singleForm.name, price: singleForm.price, trainingTypeIds: singleForm.trainingTypeIds, branchId: state.currentBranchId });
    setShowAddSingle(false);
    setSingleForm({ name: '', price: 0, trainingTypeIds: [] });
  };

  const toggleTT = (ids: string[], id: string, setter: (v: string[]) => void) => {
    setter(ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]);
  };

  const branchTTs = state.trainingTypes.filter(t => t.branchIds.includes(state.currentBranchId));

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex gap-1 bg-secondary rounded-xl p-1 w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Icon name={t.icon} size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Training types */}
      {tab === 'trainings' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-end">
            <Button onClick={() => setShowAddTraining(true)} className="bg-foreground text-primary-foreground hover:opacity-90">
              <Icon name="Plus" size={14} className="mr-1.5" /> Добавить тренировку
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {state.trainingTypes.map(tt => (
              <div key={tt.id} className="bg-white border border-border rounded-xl p-4 flex items-start gap-3">
                <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ background: tt.color }} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{tt.name}</div>
                  <div className="text-sm text-muted-foreground">{tt.duration} мин</div>
                  {tt.description && <div className="text-sm text-muted-foreground mt-1 truncate">{tt.description}</div>}
                  <div className="text-xs text-muted-foreground mt-2">
                    {tt.branchIds.map(id => state.branches.find(b => b.id === id)?.name).join(', ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trainers */}
      {tab === 'trainers' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-end">
            <Button onClick={() => setShowAddTrainer(true)} className="bg-foreground text-primary-foreground hover:opacity-90">
              <Icon name="Plus" size={14} className="mr-1.5" /> Добавить тренера
            </Button>
          </div>
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <table className="w-full data-table">
              <thead>
                <tr>
                  <th>Имя</th>
                  <th>Специализация</th>
                  <th>Филиал</th>
                </tr>
              </thead>
              <tbody>
                {state.trainers.map(t => {
                  const branch = state.branches.find(b => b.id === t.branchId);
                  return (
                    <tr key={t.id}>
                      <td className="font-medium">{t.name}</td>
                      <td className="text-muted-foreground">{t.specialty}</td>
                      <td className="text-muted-foreground">{branch?.name}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subscription plans */}
      {tab === 'plans' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-end">
            <Button onClick={() => setShowAddPlan(true)} className="bg-foreground text-primary-foreground hover:opacity-90">
              <Icon name="Plus" size={14} className="mr-1.5" /> Добавить абонемент
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {state.subscriptionPlans.map(p => (
              <div key={p.id} className="bg-white border border-border rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-xl font-bold mt-1">{p.price.toLocaleString()} ₽</div>
                  </div>
                  <span className="text-xs badge-other px-2 py-1 rounded-full">
                    {state.branches.find(b => b.id === p.branchId)?.name}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div><span className="block font-medium text-foreground">{p.durationDays} дн.</span>срок</div>
                  <div><span className="block font-medium text-foreground">{p.sessionsLimit === 'unlimited' ? '∞' : p.sessionsLimit}</span>занятий</div>
                  <div><span className="block font-medium text-foreground">{p.freezeDays} дн.</span>заморозки</div>
                </div>
                {p.trainingTypeIds.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.trainingTypeIds.map(id => {
                      const tt = state.trainingTypes.find(t => t.id === id);
                      return tt ? (
                        <span key={id} className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{tt.name}</span>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Single visits */}
      {tab === 'single' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-end">
            <Button onClick={() => setShowAddSingle(true)} className="bg-foreground text-primary-foreground hover:opacity-90">
              <Icon name="Plus" size={14} className="mr-1.5" /> Добавить разовое
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {state.singleVisitPlans.map(p => (
              <div key={p.id} className="bg-white border border-border rounded-xl p-4">
                <div className="font-medium">{p.name}</div>
                <div className="text-xl font-bold mt-1">{p.price.toLocaleString()} ₽</div>
                <div className="text-xs text-muted-foreground mt-2">
                  {state.branches.find(b => b.id === p.branchId)?.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add training modal */}
      <Dialog open={showAddTraining} onOpenChange={setShowAddTraining}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Новая тренировка</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Название *</Label>
              <Input value={ttForm.name} onChange={e => setTtForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Длительность (мин)</Label>
              <Input type="number" value={ttForm.duration} onChange={e => setTtForm(f => ({ ...f, duration: Number(e.target.value) }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Описание</Label>
              <Textarea value={ttForm.description} onChange={e => setTtForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Цвет</Label>
              <div className="flex gap-2">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setTtForm(f => ({ ...f, color: c }))}
                    className={`w-6 h-6 rounded-full transition-transform ${ttForm.color === c ? 'scale-125 ring-2 ring-offset-1 ring-foreground' : ''}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
            <Button onClick={handleAddTraining} disabled={!ttForm.name} className="w-full bg-foreground text-primary-foreground">
              Добавить
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add trainer modal */}
      <Dialog open={showAddTrainer} onOpenChange={setShowAddTrainer}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Новый тренер</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">ФИО *</Label>
              <Input value={trainerForm.name} onChange={e => setTrainerForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Специализация</Label>
              <Input value={trainerForm.specialty} onChange={e => setTrainerForm(f => ({ ...f, specialty: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Филиал</Label>
              <select className="w-full border border-input rounded-lg px-3 py-2 text-sm"
                value={trainerForm.branchId} onChange={e => setTrainerForm(f => ({ ...f, branchId: e.target.value }))}>
                {state.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <Button onClick={handleAddTrainer} disabled={!trainerForm.name} className="w-full bg-foreground text-primary-foreground">
              Добавить
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add plan modal */}
      <Dialog open={showAddPlan} onOpenChange={setShowAddPlan}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Новый абонемент</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Название *</Label>
              <Input value={planForm.name} onChange={e => setPlanForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Цена ₽ *</Label>
                <Input type="number" value={planForm.price} onChange={e => setPlanForm(f => ({ ...f, price: Number(e.target.value) }))} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Срок (дней)</Label>
                <Input type="number" value={planForm.durationDays} onChange={e => setPlanForm(f => ({ ...f, durationDays: Number(e.target.value) }))} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Занятий</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    disabled={planForm.sessionsLimit === 'unlimited'}
                    value={planForm.sessionsLimit === 'unlimited' ? '' : planForm.sessionsLimit}
                    onChange={e => setPlanForm(f => ({ ...f, sessionsLimit: Number(e.target.value) }))}
                  />
                  <label className="flex items-center gap-1 text-xs text-muted-foreground shrink-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={planForm.sessionsLimit === 'unlimited'}
                      onChange={e => setPlanForm(f => ({ ...f, sessionsLimit: e.target.checked ? 'unlimited' : 8 }))}
                    />
                    ∞
                  </label>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Дней заморозки</Label>
                <Input type="number" value={planForm.freezeDays} onChange={e => setPlanForm(f => ({ ...f, freezeDays: Number(e.target.value) }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Направления</Label>
              <div className="flex flex-wrap gap-2">
                {state.trainingTypes.map(tt => (
                  <button
                    key={tt.id}
                    onClick={() => toggleTT(planForm.trainingTypeIds, tt.id, ids => setPlanForm(f => ({ ...f, trainingTypeIds: ids })))}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${planForm.trainingTypeIds.includes(tt.id) ? 'bg-foreground text-primary-foreground border-foreground' : 'border-border hover:bg-secondary'}`}
                  >
                    {tt.name}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={handleAddPlan} disabled={!planForm.name || planForm.price <= 0} className="w-full bg-foreground text-primary-foreground">
              Создать абонемент
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add single visit modal */}
      <Dialog open={showAddSingle} onOpenChange={setShowAddSingle}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Новое разовое посещение</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Название *</Label>
              <Input value={singleForm.name} onChange={e => setSingleForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Цена ₽ *</Label>
              <Input type="number" value={singleForm.price} onChange={e => setSingleForm(f => ({ ...f, price: Number(e.target.value) }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Направления</Label>
              <div className="flex flex-wrap gap-2">
                {state.trainingTypes.map(tt => (
                  <button
                    key={tt.id}
                    onClick={() => toggleTT(singleForm.trainingTypeIds, tt.id, ids => setSingleForm(f => ({ ...f, trainingTypeIds: ids })))}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${singleForm.trainingTypeIds.includes(tt.id) ? 'bg-foreground text-primary-foreground border-foreground' : 'border-border hover:bg-secondary'}`}
                  >
                    {tt.name}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={handleAddSingle} disabled={!singleForm.name || singleForm.price <= 0} className="w-full bg-foreground text-primary-foreground">
              Добавить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

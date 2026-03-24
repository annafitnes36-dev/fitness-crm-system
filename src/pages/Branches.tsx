import { useState } from 'react';
import { StoreType } from '@/store';
import Icon from '@/components/ui/icon';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface BranchesProps {
  store: StoreType;
}

export default function Branches({ store }: BranchesProps) {
  const { state, addBranch, setCurrentBranch } = store;
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', phone: '' });

  const handleAdd = () => {
    if (!form.name) return;
    addBranch(form);
    setShowAdd(false);
    setForm({ name: '', address: '', phone: '' });
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Филиалы</h2>
          <p className="text-sm text-muted-foreground">Управление сетью студий</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="bg-foreground text-primary-foreground hover:opacity-90">
          <Icon name="Plus" size={15} className="mr-1.5" /> Добавить филиал
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {state.branches.map(branch => {
          const clients = state.clients.filter(c => c.branchId === branch.id);
          const activeSubs = state.subscriptions.filter(s => s.branchId === branch.id && s.status === 'active');
          const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
          const monthRevenue = state.sales
            .filter(s => s.branchId === branch.id && s.date >= monthStart)
            .reduce((sum, s) => sum + s.finalPrice, 0);
          const isCurrent = branch.id === state.currentBranchId;

          return (
            <div
              key={branch.id}
              className={`bg-white border rounded-xl p-5 ${isCurrent ? 'border-foreground shadow-sm' : 'border-border'}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isCurrent ? 'bg-foreground' : 'bg-secondary'}`}>
                    <Icon name="Building2" size={18} className={isCurrent ? 'text-primary-foreground' : 'text-muted-foreground'} />
                  </div>
                  <div>
                    <div className="font-semibold">{branch.name}</div>
                    {isCurrent && <span className="text-xs text-green-600 font-medium">Текущий</span>}
                  </div>
                </div>
                {!isCurrent && (
                  <button
                    onClick={() => setCurrentBranch(branch.id)}
                    className="text-xs text-muted-foreground border border-border px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors"
                  >
                    Переключить
                  </button>
                )}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Icon name="MapPin" size={14} />
                  <span>{branch.address || 'Адрес не указан'}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Icon name="Phone" size={14} />
                  <span>{branch.phone || 'Телефон не указан'}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
                <div className="text-center">
                  <div className="text-lg font-semibold">{clients.length}</div>
                  <div className="text-xs text-muted-foreground">Клиентов</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold">{activeSubs.length}</div>
                  <div className="text-xs text-muted-foreground">Абонементов</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold">{monthRevenue.toLocaleString()} ₽</div>
                  <div className="text-xs text-muted-foreground">За месяц</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Новый филиал</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Название *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Центральный" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Адрес</Label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="ул. Ленина, 1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Телефон</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+7 (999) 000-00-00" />
            </div>
            <Button onClick={handleAdd} disabled={!form.name} className="w-full bg-foreground text-primary-foreground">
              Создать филиал
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

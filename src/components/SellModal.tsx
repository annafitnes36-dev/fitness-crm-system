import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StoreType } from '@/store';
import Icon from '@/components/ui/icon';

interface SellModalProps {
  open: boolean;
  onClose: () => void;
  store: StoreType;
  preselectedClientId?: string;
}

const fmt = (d: Date) => d.toISOString().split('T')[0];

export default function SellModal({ open, onClose, store, preselectedClientId }: SellModalProps) {
  const { state, sellSubscription, sellSingleVisit, getClientFullName, addClientToBranch } = store;
  const [step, setStep] = useState<'client' | 'product' | 'confirm'>('client');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState(preselectedClientId || '');
  const [selectedType, setSelectedType] = useState<'subscription' | 'single'>('subscription');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('card');

  // Дата продажи
  const [saleDate, setSaleDate] = useState(fmt(new Date()));
  const isBackDate = saleDate < fmt(new Date());

  // Поля для задним числом (абонемент)
  const [activationDate, setActivationDate] = useState('');
  const [sessionsSpent, setSessionsSpent] = useState(0);

  const branchClients = state.clients.filter(c => c.branchId === state.currentBranchId);
  const isPhoneSearch = clientSearch.replace(/\D/g, '').length >= 5;
  const filteredClients = clientSearch
    ? (isPhoneSearch
        ? state.clients.filter(c => c.phone.replace(/\D/g, '').includes(clientSearch.replace(/\D/g, '')))
        : branchClients.filter(c => getClientFullName(c).toLowerCase().includes(clientSearch.toLowerCase()))
      )
    : branchClients.slice(0, 8);

  const selectedClient = state.clients.find(c => c.id === selectedClientId);
  const branchPlans = state.subscriptionPlans.filter(p => p.branchId === state.currentBranchId);
  const branchSinglePlans = state.singleVisitPlans.filter(p => p.branchId === state.currentBranchId);
  const items = selectedType === 'subscription' ? branchPlans : branchSinglePlans;
  const selectedItem = items.find(i => i.id === selectedItemId);
  const price = selectedItem?.price || 0;
  const finalPrice = Math.round(price * (1 - discount / 100));

  const selectedPlan = selectedType === 'subscription'
    ? state.subscriptionPlans.find(p => p.id === selectedItemId)
    : null;
  const hasSessionsLimit = selectedPlan && selectedPlan.sessionsLimit !== 'unlimited';

  const handleConfirm = () => {
    if (!selectedClientId || !selectedItemId) return;
    const client = state.clients.find(c => c.id === selectedClientId);
    if (client && client.branchId !== state.currentBranchId) {
      addClientToBranch(selectedClientId, state.currentBranchId);
    }
    if (selectedType === 'subscription') {
      sellSubscription(selectedClientId, selectedItemId, discount, paymentMethod, {
        saleDate,
        activationDate: isBackDate && activationDate ? activationDate : undefined,
        sessionsSpent: isBackDate && hasSessionsLimit && sessionsSpent > 0 ? sessionsSpent : undefined,
      });
    } else {
      sellSingleVisit(selectedClientId, selectedItemId, paymentMethod, {
        discount,
        saleDate,
      });
    }
    handleClose();
  };

  const handleClose = () => {
    onClose();
    setStep('client');
    setSelectedClientId(preselectedClientId || '');
    setSelectedItemId('');
    setDiscount(0);
    setSaleDate(fmt(new Date()));
    setActivationDate('');
    setSessionsSpent(0);
    setClientSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Продажа</DialogTitle>
        </DialogHeader>

        {step === 'client' && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Поиск клиента</Label>
              <Input
                placeholder="Имя или номер телефона"
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {filteredClients.map(c => {
                const isOtherBranch = c.branchId !== state.currentBranchId;
                return (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedClientId(c.id); setStep('product'); }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm hover:bg-secondary transition-colors text-left ${selectedClientId === c.id ? 'bg-secondary' : ''}`}
                  >
                    <div>
                      <div className="font-medium flex items-center gap-1.5">
                        {getClientFullName(c)}
                        {isOtherBranch && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            {state.branches.find(b => b.id === c.branchId)?.name}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{c.phone}</div>
                    </div>
                    {c.activeSubscriptionId && (
                      <span className="text-xs badge-loyal px-2 py-0.5 rounded-full">абонемент</span>
                    )}
                  </button>
                );
              })}
              {filteredClients.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Клиент не найден</p>
              )}
            </div>
          </div>
        )}

        {step === 'product' && selectedClient && (
          <div className="space-y-4 animate-fade-in">
            <button onClick={() => setStep('client')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <Icon name="ChevronLeft" size={14} /> {getClientFullName(selectedClient)}
            </button>

            <div className="flex gap-2">
              <button
                onClick={() => { setSelectedType('subscription'); setSelectedItemId(''); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${selectedType === 'subscription' ? 'bg-foreground text-primary-foreground border-foreground' : 'border-border hover:bg-secondary'}`}
              >Абонемент</button>
              <button
                onClick={() => { setSelectedType('single'); setSelectedItemId(''); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${selectedType === 'single' ? 'bg-foreground text-primary-foreground border-foreground' : 'border-border hover:bg-secondary'}`}
              >Разовое</button>
            </div>

            <div className="space-y-1.5">
              {items.map(item => (
                <button
                  key={item.id}
                  onClick={() => setSelectedItemId(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors ${selectedItemId === item.id ? 'border-foreground bg-secondary' : 'border-border hover:bg-secondary'}`}
                >
                  <span className="font-medium">{item.name}</span>
                  <span className="text-muted-foreground">{item.price.toLocaleString()} ₽</span>
                </button>
              ))}
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Скидка (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={discount}
                onChange={e => setDiscount(Number(e.target.value))}
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Дата продажи</Label>
              <Input
                type="date"
                value={saleDate}
                max={fmt(new Date())}
                onChange={e => {
                  setSaleDate(e.target.value);
                  if (e.target.value >= fmt(new Date())) {
                    setActivationDate('');
                    setSessionsSpent(0);
                  }
                }}
              />
            </div>

            {isBackDate && selectedType === 'subscription' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-3">
                <div className="flex items-center gap-1.5 text-amber-700 text-xs font-medium">
                  <Icon name="Clock" size={13} />
                  Продажа задним числом — заполните данные активации
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Дата активации абонемента</Label>
                  <Input
                    type="date"
                    value={activationDate}
                    max={fmt(new Date())}
                    onChange={e => setActivationDate(e.target.value)}
                    placeholder="Когда клиент начал ходить"
                  />
                </div>
                {hasSessionsLimit && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">
                      Уже потрачено тренировок (из {selectedPlan!.sessionsLimit})
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={selectedPlan!.sessionsLimit as number}
                      value={sessionsSpent}
                      onChange={e => setSessionsSpent(Number(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Останется: {Math.max(0, (selectedPlan!.sessionsLimit as number) - sessionsSpent)} тренировок
                    </p>
                  </div>
                )}
              </div>
            )}

            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Способ оплаты</Label>
              <div className="flex gap-2">
                {(['cash', 'card'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setPaymentMethod(m)}
                    className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${paymentMethod === m ? 'bg-foreground text-primary-foreground border-foreground' : 'border-border hover:bg-secondary'}`}
                  >
                    {m === 'cash' ? '💵 Наличные' : '💳 Безналичные'}
                  </button>
                ))}
              </div>
            </div>

            {selectedItemId && (
              <div className="bg-secondary rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">К оплате</span>
                <div className="text-right">
                  {discount > 0 && <div className="text-xs text-muted-foreground line-through">{price.toLocaleString()} ₽</div>}
                  <div className="text-base font-semibold">{finalPrice.toLocaleString()} ₽</div>
                  {discount > 0 && <div className="text-xs text-emerald-600">скидка {discount}%</div>}
                </div>
              </div>
            )}

            <Button
              onClick={handleConfirm}
              disabled={!selectedItemId}
              className="w-full"
            >
              Провести продажу
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

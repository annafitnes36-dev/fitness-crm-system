import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StoreType, Client } from '@/store';
import Icon from '@/components/ui/icon';

interface SellModalProps {
  open: boolean;
  onClose: () => void;
  store: StoreType;
  preselectedClientId?: string;
}

export default function SellModal({ open, onClose, store, preselectedClientId }: SellModalProps) {
  const { state, sellSubscription, sellSingleVisit, getClientFullName } = store;
  const [step, setStep] = useState<'client' | 'product' | 'confirm'>('client');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState(preselectedClientId || '');
  const [selectedType, setSelectedType] = useState<'subscription' | 'single'>('subscription');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('card');

  const branchClients = state.clients.filter(c => c.branchId === state.currentBranchId);
  const filteredClients = clientSearch
    ? branchClients.filter(c => getClientFullName(c).toLowerCase().includes(clientSearch.toLowerCase()) || c.phone.includes(clientSearch))
    : branchClients.slice(0, 8);

  const selectedClient = state.clients.find(c => c.id === selectedClientId);
  const branchPlans = state.subscriptionPlans.filter(p => p.branchId === state.currentBranchId);
  const branchSinglePlans = state.singleVisitPlans.filter(p => p.branchId === state.currentBranchId);
  const items = selectedType === 'subscription' ? branchPlans : branchSinglePlans;
  const selectedItem = items.find(i => i.id === selectedItemId);
  const price = selectedItem?.price || 0;
  const finalPrice = Math.round(price * (1 - discount / 100));

  const handleConfirm = () => {
    if (!selectedClientId || !selectedItemId) return;
    if (selectedType === 'subscription') {
      sellSubscription(selectedClientId, selectedItemId, discount, paymentMethod);
    } else {
      sellSingleVisit(selectedClientId, selectedItemId, paymentMethod);
    }
    onClose();
    setStep('client');
    setSelectedClientId('');
    setSelectedItemId('');
    setDiscount(0);
  };

  const handleClose = () => {
    onClose();
    setStep('client');
    setSelectedClientId('');
    setSelectedItemId('');
    setDiscount(0);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
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
              {filteredClients.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedClientId(c.id); setStep('product'); }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm hover:bg-secondary transition-colors text-left ${selectedClientId === c.id ? 'bg-secondary' : ''}`}
                >
                  <div>
                    <div className="font-medium">{getClientFullName(c)}</div>
                    <div className="text-xs text-muted-foreground">{c.phone}</div>
                  </div>
                  {c.activeSubscriptionId && (
                    <span className="text-xs badge-loyal px-2 py-0.5 rounded-full">абонемент</span>
                  )}
                </button>
              ))}
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

            {selectedType === 'subscription' && (
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
                  <div className="font-semibold">{finalPrice.toLocaleString()} ₽</div>
                </div>
              </div>
            )}

            <Button
              onClick={handleConfirm}
              disabled={!selectedItemId}
              className="w-full bg-foreground text-primary-foreground hover:opacity-90"
            >
              Подтвердить продажу
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

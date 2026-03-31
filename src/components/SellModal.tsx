import { useState, useEffect } from 'react';
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
  const { state, sellSubscription, sellSingleVisit, getClientFullName, addClientToBranch, getClientBonusBalance } = store;
  const [step, setStep] = useState<'client' | 'product'>(preselectedClientId ? 'product' : 'client');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState(preselectedClientId || '');
  const [selectedType, setSelectedType] = useState<'subscription' | 'single'>('subscription');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('card');
  const [saleDate, setSaleDate] = useState(fmt(new Date()));
  const isBackDate = saleDate < fmt(new Date());
  const [activationDate, setActivationDate] = useState('');
  const [sessionsSpent, setSessionsSpent] = useState(0);

  // Бонусы
  const [useBonus, setUseBonus] = useState(false);
  const [bonusAmount, setBonusAmount] = useState(0);

  const bonusSettings = state.bonusSettings;
  const bonusEnabled = bonusSettings?.enabled;

  const branchClients = state.clients.filter(c => c.branchId === state.currentBranchId);
  const isPhoneSearch = clientSearch.replace(/\D/g, '').length >= 5;
  const filteredClients = clientSearch
    ? (isPhoneSearch
        ? state.clients.filter(c => c.phone.replace(/\D/g, '').includes(clientSearch.replace(/\D/g, '')))
        : branchClients.filter(c => getClientFullName(c).toLowerCase().includes(clientSearch.toLowerCase()))
      )
    : branchClients.slice(0, 8);

  const selectedClient = state.clients.find(c => c.id === selectedClientId);
  const clientBonusBalance = selectedClientId ? getClientBonusBalance(selectedClientId, state.currentBranchId) : 0;

  const branchPlans = state.subscriptionPlans;
  const branchSinglePlans = state.singleVisitPlans;
  const items = selectedType === 'subscription' ? branchPlans : branchSinglePlans;
  const selectedItem = items.find(i => i.id === selectedItemId);
  const price = selectedItem?.price || 0;
  const priceAfterDiscount = Math.round(price * (1 - discount / 100));

  const maxBonus = Math.min(clientBonusBalance, priceAfterDiscount);
  const effectiveBonusAmount = useBonus ? Math.min(bonusAmount, maxBonus) : 0;
  const remainingAfterBonus = priceAfterDiscount - effectiveBonusAmount;
  const paidByBonus = effectiveBonusAmount === priceAfterDiscount;

  // Начисление бонусов с суммы остатка (не с бонусной части)
  const bonusAccrual = bonusEnabled && bonusSettings.accrualPercent
    ? Math.round(remainingAfterBonus * bonusSettings.accrualPercent / 100)
    : 0;

  const selectedPlan = selectedType === 'subscription'
    ? state.subscriptionPlans.find(p => p.id === selectedItemId)
    : null;
  const hasSessionsLimit = selectedPlan && selectedPlan.sessionsLimit !== 'unlimited';

  // Когда модал открывается с предвыбранным клиентом — сразу шаг product
  useEffect(() => {
    if (open) {
      if (preselectedClientId) {
        setSelectedClientId(preselectedClientId);
        setStep('product');
      } else {
        setStep('client');
        setSelectedClientId('');
      }
    }
  }, [open, preselectedClientId]);

  // При смене клиента — сбросить бонус
  useEffect(() => {
    setUseBonus(false);
    setBonusAmount(0);
  }, [selectedClientId]);

  // При изменении суммы — корректировать бонус
  useEffect(() => {
    if (useBonus) setBonusAmount(Math.min(bonusAmount, maxBonus));
  }, [priceAfterDiscount, maxBonus]);

  const handleConfirm = () => {
    if (!selectedClientId || !selectedItemId) return;
    const client = state.clients.find(c => c.id === selectedClientId);
    if (client && client.branchId !== state.currentBranchId) {
      addClientToBranch(selectedClientId, state.currentBranchId);
    }
    const finalPaymentMethod = effectiveBonusAmount > 0
      ? (paidByBonus ? 'bonus' : paymentMethod)
      : paymentMethod;

    if (selectedType === 'subscription') {
      sellSubscription(selectedClientId, selectedItemId, discount, finalPaymentMethod, {
        saleDate,
        activationDate: isBackDate && activationDate ? activationDate : undefined,
        sessionsSpent: isBackDate && hasSessionsLimit && sessionsSpent > 0 ? sessionsSpent : undefined,
        bonusUsed: effectiveBonusAmount || undefined,
        bonusPaymentMethod: effectiveBonusAmount > 0 && !paidByBonus ? paymentMethod : undefined,
      });
    } else {
      sellSingleVisit(selectedClientId, selectedItemId, finalPaymentMethod, {
        discount,
        saleDate,
        bonusUsed: effectiveBonusAmount || undefined,
        bonusPaymentMethod: effectiveBonusAmount > 0 && !paidByBonus ? paymentMethod : undefined,
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
    setUseBonus(false);
    setBonusAmount(0);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md flex flex-col max-h-[90vh]">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Продажа</DialogTitle>
        </DialogHeader>

        {step === 'client' && (
          <div className="space-y-4 animate-fade-in overflow-y-auto flex-1 pr-1">
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
                const bal = getClientBonusBalance(c.id, state.currentBranchId);
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
                    <div className="flex items-center gap-2">
                      {bonusEnabled && bal > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                          {bal} бонусов
                        </span>
                      )}
                      {c.activeSubscriptionId && (
                        <span className="text-xs badge-loyal px-2 py-0.5 rounded-full">абонемент</span>
                      )}
                    </div>
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
          <div className="flex flex-col flex-1 min-h-0 animate-fade-in gap-4">
            <div className="overflow-y-auto flex-1 space-y-4 pr-1">
              <button onClick={() => setStep('client')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <Icon name="ChevronLeft" size={14} /> {getClientFullName(selectedClient)}
                {bonusEnabled && clientBonusBalance > 0 && (
                  <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    {clientBonusBalance} бонусов
                  </span>
                )}
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
                <Input type="number" min={0} max={100} value={discount} onChange={e => setDiscount(Number(e.target.value))} />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Дата продажи</Label>
                <Input
                  type="date"
                  value={saleDate}
                  max={fmt(new Date())}
                  onChange={e => {
                    setSaleDate(e.target.value);
                    if (e.target.value >= fmt(new Date())) { setActivationDate(''); setSessionsSpent(0); }
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
                    <Input type="date" value={activationDate} max={fmt(new Date())} onChange={e => setActivationDate(e.target.value)} />
                  </div>
                  {hasSessionsLimit && (
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">
                        Уже потрачено тренировок (из {selectedPlan!.sessionsLimit})
                      </Label>
                      <Input
                        type="number" min={0} max={selectedPlan!.sessionsLimit as number}
                        value={sessionsSpent} onChange={e => setSessionsSpent(Number(e.target.value))}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Останется: {Math.max(0, (selectedPlan!.sessionsLimit as number) - sessionsSpent)} тренировок
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Бонусы */}
              {bonusEnabled && selectedItemId && clientBonusBalance > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useBonus}
                      onChange={e => {
                        setUseBonus(e.target.checked);
                        if (e.target.checked) setBonusAmount(maxBonus);
                        else setBonusAmount(0);
                      }}
                      className="accent-amber-500"
                    />
                    <span className="text-sm font-medium text-amber-800">
                      Оплатить бонусами (доступно: {clientBonusBalance})
                    </span>
                  </label>
                  {useBonus && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={maxBonus}
                          value={bonusAmount}
                          onChange={e => setBonusAmount(Math.min(Number(e.target.value), maxBonus))}
                          className="w-32 bg-white"
                        />
                        <span className="text-xs text-amber-700">из {maxBonus} возможных</span>
                        <button onClick={() => setBonusAmount(maxBonus)} className="text-xs text-amber-700 underline">всё</button>
                      </div>
                      {!paidByBonus && (
                        <p className="text-xs text-amber-700">
                          Остаток {remainingAfterBonus.toLocaleString()} ₽ — выберите способ оплаты ниже
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Способ оплаты остатка */}
              {(!useBonus || !paidByBonus) && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">
                    {useBonus && !paidByBonus ? 'Способ оплаты остатка' : 'Способ оплаты'}
                  </Label>
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
              )}
            </div>

            <div className="flex-shrink-0 space-y-3">
              {selectedItemId && (
                <div className="bg-secondary rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Стоимость</span>
                    <div className="text-right">
                      {discount > 0 && <div className="text-xs text-muted-foreground line-through">{price.toLocaleString()} ₽</div>}
                      <div className="text-sm font-medium">{priceAfterDiscount.toLocaleString()} ₽</div>
                    </div>
                  </div>
                  {effectiveBonusAmount > 0 && (
                    <div className="flex items-center justify-between text-amber-700">
                      <span className="text-sm">Бонусами</span>
                      <span className="text-sm font-medium">−{effectiveBonusAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-border pt-1.5">
                    <span className="text-sm font-semibold">К оплате</span>
                    <span className="text-base font-bold">
                      {remainingAfterBonus > 0 ? `${remainingAfterBonus.toLocaleString()} ₽` : 'Бесплатно 🎉'}
                    </span>
                  </div>
                  {bonusEnabled && bonusAccrual > 0 && (
                    <div className="flex items-center justify-between text-emerald-600 text-xs">
                      <span>Начислим бонусов</span>
                      <span>+{bonusAccrual}</span>
                    </div>
                  )}
                </div>
              )}
              <Button onClick={handleConfirm} disabled={!selectedItemId} className="w-full">
                Провести продажу
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
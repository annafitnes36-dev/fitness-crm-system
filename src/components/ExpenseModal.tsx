import { useState } from 'react';
import { StoreType } from '@/store';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ExpenseModalProps {
  open: boolean;
  onClose: () => void;
  store: StoreType;
}

export default function ExpenseModal({ open, onClose, store }: ExpenseModalProps) {
  const { state, addExpense } = store;
  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    categoryId: '',
    amount: '',
    date: today,
    comment: '',
    paymentMethod: 'cash' as 'cash' | 'card',
  });

  const branchCategories = state.expenseCategories.filter(c => c.branchId === state.currentBranchId);

  const handleSubmit = () => {
    if (!form.categoryId || !form.amount || Number(form.amount) <= 0) return;
    addExpense({
      branchId: state.currentBranchId,
      categoryId: form.categoryId,
      amount: Number(form.amount),
      date: form.date,
      comment: form.comment,
      paymentMethod: form.paymentMethod,
    });
    setForm({ categoryId: '', amount: '', date: today, comment: '', paymentMethod: 'cash' });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Внести расход</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Категория *</Label>
            <select
              className="w-full border border-input rounded-lg px-3 py-2 text-sm"
              value={form.categoryId}
              onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
            >
              <option value="">Выбрать...</option>
              {branchCategories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Сумма ₽ *</Label>
              <Input
                type="number"
                placeholder="0"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Дата</Label>
              <Input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Способ оплаты</Label>
            <div className="flex gap-2">
              {(['cash', 'card'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setForm(f => ({ ...f, paymentMethod: m }))}
                  className={`flex-1 text-sm py-2 rounded-lg border transition-colors font-medium ${form.paymentMethod === m ? 'bg-foreground text-primary-foreground border-foreground' : 'border-border hover:bg-secondary'}`}
                >
                  {m === 'cash' ? 'Наличные' : 'Карта'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Комментарий</Label>
            <Textarea
              placeholder="Заметка..."
              value={form.comment}
              onChange={e => setForm(f => ({ ...f, comment: e.target.value }))}
              rows={2}
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!form.categoryId || !form.amount || Number(form.amount) <= 0}
            className="w-full bg-foreground text-primary-foreground"
          >
            Записать расход
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

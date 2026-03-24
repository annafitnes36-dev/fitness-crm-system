import { StoreType } from '@/store';

interface FinanceProps {
  store: StoreType;
}

export default function Finance({ store }: FinanceProps) {
  const { state } = store;

  const branchSales = state.sales.filter(s => s.branchId === state.currentBranchId);
  const branchVisits = state.visits.filter(v => {
    const entry = state.schedule.find(e => e.id === v.scheduleEntryId);
    return entry?.branchId === state.currentBranchId;
  });

  const singleVisitRevenue = branchVisits.filter(v => v.isSingleVisit && v.status === 'attended').reduce((sum, v) => sum + v.price, 0);
  const subRevenue = branchSales.filter(s => s.type === 'subscription').reduce((sum, s) => sum + s.finalPrice, 0);
  const totalRevenue = subRevenue + singleVisitRevenue;

  const byMonth: Record<string, { sub: number; single: number; cash: number; card: number }> = {};
  branchSales.forEach(s => {
    const month = s.date.slice(0, 7);
    if (!byMonth[month]) byMonth[month] = { sub: 0, single: 0, cash: 0, card: 0 };
    if (s.type === 'subscription') byMonth[month].sub += s.finalPrice;
    else byMonth[month].single += s.finalPrice;
    if (s.paymentMethod === 'cash') byMonth[month].cash += s.finalPrice;
    else byMonth[month].card += s.finalPrice;
  });

  const months = Object.keys(byMonth).sort().reverse();

  const allTransactions = [
    ...branchSales.map(s => ({
      id: s.id,
      date: s.date,
      type: s.type === 'subscription' ? 'Абонемент' : 'Разовое',
      client: state.clients.find(c => c.id === s.clientId),
      item: s.itemName,
      amount: s.finalPrice,
      method: s.paymentMethod,
      isIncome: true,
    })),
    ...branchVisits.filter(v => v.isSingleVisit && v.status === 'attended').map(v => {
      const entry = state.schedule.find(e => e.id === v.scheduleEntryId);
      const tt = entry ? state.trainingTypes.find(t => t.id === entry.trainingTypeId) : null;
      return {
        id: v.id,
        date: v.date,
        type: 'Разовый визит',
        client: state.clients.find(c => c.id === v.clientId),
        item: tt?.name || 'Тренировка',
        amount: v.price,
        method: 'cash' as const,
        isIncome: true,
      };
    }),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Общая выручка</div>
          <div className="text-2xl font-semibold">{totalRevenue.toLocaleString()} ₽</div>
          <div className="text-xs text-muted-foreground mt-1">за всё время</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Абонементы</div>
          <div className="text-2xl font-semibold">{subRevenue.toLocaleString()} ₽</div>
          <div className="text-xs text-muted-foreground mt-1">{branchSales.filter(s => s.type === 'subscription').length} продаж</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Разовые визиты</div>
          <div className="text-2xl font-semibold">{singleVisitRevenue.toLocaleString()} ₽</div>
          <div className="text-xs text-muted-foreground mt-1">{branchVisits.filter(v => v.isSingleVisit).length} посещений</div>
        </div>
      </div>

      {/* Monthly breakdown */}
      {months.length > 0 && (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wide">По месяцам</div>
          <table className="w-full data-table">
            <thead>
              <tr>
                <th>Месяц</th>
                <th>Абонементы</th>
                <th>Разовые</th>
                <th>Наличные</th>
                <th>Безналичные</th>
                <th>Итого</th>
              </tr>
            </thead>
            <tbody>
              {months.map(m => {
                const d = byMonth[m];
                const [year, month] = m.split('-');
                const label = new Date(Number(year), Number(month) - 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
                return (
                  <tr key={m}>
                    <td className="font-medium capitalize">{label}</td>
                    <td>{d.sub.toLocaleString()} ₽</td>
                    <td className="text-muted-foreground">{d.single.toLocaleString()} ₽</td>
                    <td className="text-muted-foreground">{d.cash.toLocaleString()} ₽</td>
                    <td className="text-muted-foreground">{d.card.toLocaleString()} ₽</td>
                    <td className="font-semibold">{(d.sub + d.single).toLocaleString()} ₽</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Transactions */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wide">
          История операций
        </div>
        <table className="w-full data-table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Клиент</th>
              <th>Позиция</th>
              <th>Тип</th>
              <th>Оплата</th>
              <th>Сумма</th>
            </tr>
          </thead>
          <tbody>
            {allTransactions.map(t => (
              <tr key={t.id}>
                <td className="text-muted-foreground text-sm">{t.date}</td>
                <td className="font-medium text-sm">
                  {t.client ? `${t.client.lastName} ${t.client.firstName}` : '—'}
                </td>
                <td className="text-sm text-muted-foreground">{t.item}</td>
                <td>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${t.type === 'Абонемент' ? 'badge-loyal' : 'badge-other'}`}>
                    {t.type}
                  </span>
                </td>
                <td className="text-sm">
                  {t.method === 'cash' ? 'Нал' : 'Безнал'}
                </td>
                <td className="font-semibold text-green-600">+{t.amount.toLocaleString()} ₽</td>
              </tr>
            ))}
          </tbody>
        </table>
        {allTransactions.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">Операций пока нет</div>
        )}
      </div>
    </div>
  );
}

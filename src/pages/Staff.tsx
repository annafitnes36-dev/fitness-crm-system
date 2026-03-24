import { useState } from 'react';
import { StoreType, StaffMember, StaffRole, Permission, ROLE_LABELS, DEFAULT_PERMISSIONS } from '@/store';
import Icon from '@/components/ui/icon';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface StaffProps {
  store: StoreType;
}

const PERMISSION_GROUPS: { label: string; icon: string; keys: (keyof Permission)[] }[] = [
  {
    label: 'Аналитика и отчёты',
    icon: 'BarChart3',
    keys: ['viewDirectorDashboard', 'viewAdminDashboard', 'viewFinanceHistory', 'editDeleteOperations', 'exportData'],
  },
  {
    label: 'Клиенты',
    icon: 'Users',
    keys: ['addClients', 'viewClientCards', 'viewPhoneNumbers'],
  },
  {
    label: 'Расписание и продажи',
    icon: 'Calendar',
    keys: ['viewSchedule', 'enrollClients', 'sellSubscriptions', 'addExpenses'],
  },
  {
    label: 'Настройки и управление',
    icon: 'Settings',
    keys: ['manageTrainings', 'manageSubscriptionPlans', 'manageStaff', 'manageSettings', 'manageSalesPlan'],
  },
];

const PERMISSION_LABELS: Record<keyof Permission, string> = {
  viewDirectorDashboard: 'Дашборд директора/управляющего',
  viewAdminDashboard: 'Дашборд администратора',
  viewFinanceHistory: 'История финансовых операций',
  editDeleteOperations: 'Изменение и удаление операций',
  exportData: 'Выгрузка данных',
  addClients: 'Добавление клиентов',
  viewClientCards: 'Просмотр карточек клиентов',
  viewPhoneNumbers: 'Видимость телефонных номеров',
  viewSchedule: 'Просмотр расписания',
  enrollClients: 'Запись клиентов на занятия',
  sellSubscriptions: 'Продажа абонементов',
  addExpenses: 'Внесение расходов',
  manageTrainings: 'Управление тренировками',
  manageSubscriptionPlans: 'Управление абонементами',
  manageStaff: 'Управление сотрудниками',
  manageSettings: 'Настройки системы',
  manageSalesPlan: 'Установка плана продаж',
};

const ROLE_COLORS: Record<StaffRole, string> = {
  director: 'bg-violet-100 text-violet-700',
  manager: 'bg-blue-100 text-blue-700',
  admin: 'bg-emerald-100 text-emerald-700',
  trainer: 'bg-amber-100 text-amber-700',
  marketer: 'bg-pink-100 text-pink-700',
};

const emptyForm = {
  name: '', role: 'admin' as StaffRole, phone: '', email: '',
  branchIds: [] as string[],
};

export default function Staff({ store }: StaffProps) {
  const { state, addStaff, updateStaff, removeStaff } = store;
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editPermsId, setEditPermsId] = useState<string | null>(null);
  const [permsForm, setPermsForm] = useState<Permission | null>(null);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm, branchIds: [state.currentBranchId] });
    setShowModal(true);
  };

  const openEdit = (m: StaffMember) => {
    setEditingId(m.id);
    setForm({ name: m.name, role: m.role, phone: m.phone, email: m.email, branchIds: m.branchIds });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.name || !form.role) return;
    if (editingId) {
      updateStaff(editingId, { name: form.name, role: form.role, phone: form.phone, email: form.email, branchIds: form.branchIds });
    } else {
      addStaff({ name: form.name, role: form.role, phone: form.phone, email: form.email, branchIds: form.branchIds, permissions: { ...DEFAULT_PERMISSIONS[form.role] } });
    }
    setShowModal(false);
  };

  const openPerms = (m: StaffMember) => {
    setEditPermsId(m.id);
    setPermsForm({ ...m.permissions });
  };

  const savePerms = () => {
    if (!editPermsId || !permsForm) return;
    updateStaff(editPermsId, { permissions: permsForm });
    setEditPermsId(null);
    setPermsForm(null);
  };

  const resetPermsToRole = (role: StaffRole) => {
    setPermsForm({ ...DEFAULT_PERMISSIONS[role] });
  };

  const toggleBranch = (branchId: string) => {
    setForm(f => ({
      ...f,
      branchIds: f.branchIds.includes(branchId) ? f.branchIds.filter(id => id !== branchId) : [...f.branchIds, branchId],
    }));
  };

  const editingMember = editPermsId ? state.staff.find(m => m.id === editPermsId) : null;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex justify-end">
        <Button onClick={openAdd} className="bg-foreground text-primary-foreground hover:opacity-90">
          <Icon name="UserPlus" size={14} className="mr-1.5" /> Добавить сотрудника
        </Button>
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <table className="w-full data-table">
          <thead>
            <tr>
              <th>Сотрудник</th>
              <th>Роль</th>
              <th>Телефон</th>
              <th>Филиалы</th>
              <th>Права</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {state.staff.map(m => (
              <tr key={m.id}>
                <td>
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs text-muted-foreground">{m.email}</div>
                </td>
                <td>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${ROLE_COLORS[m.role]}`}>
                    {ROLE_LABELS[m.role]}
                  </span>
                </td>
                <td className="text-muted-foreground">{m.phone}</td>
                <td className="text-muted-foreground text-sm">
                  {m.branchIds.map(id => state.branches.find(b => b.id === id)?.name).filter(Boolean).join(', ')}
                </td>
                <td>
                  <button onClick={() => openPerms(m)} className="text-xs px-2 py-1 rounded-lg bg-secondary hover:bg-secondary/70 border border-border transition-colors">
                    <Icon name="Shield" size={13} className="inline mr-1" />
                    Настроить
                  </button>
                </td>
                <td>
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                      <Icon name="Pencil" size={13} />
                    </button>
                    <button onClick={() => removeStaff(m.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
                      <Icon name="Trash2" size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/edit staff modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Редактировать сотрудника' : 'Новый сотрудник'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">ФИО *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Роль</Label>
              <select className="w-full border border-input rounded-lg px-3 py-2 text-sm"
                value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as StaffRole }))}>
                {(Object.entries(ROLE_LABELS) as [StaffRole, string][]).map(([role, label]) => (
                  <option key={role} value={role}>{label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Телефон</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+7 (999) 000-00-00" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Email</Label>
                <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="mail@example.com" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Доступные филиалы</Label>
              <div className="flex flex-wrap gap-2">
                {state.branches.map(b => (
                  <button key={b.id} onClick={() => toggleBranch(b.id)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${form.branchIds.includes(b.id) ? 'bg-foreground text-primary-foreground border-foreground' : 'border-border hover:bg-secondary'}`}>
                    {b.name}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={handleSave} disabled={!form.name} className="w-full bg-foreground text-primary-foreground">
              {editingId ? 'Сохранить' : 'Добавить'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Permissions editor */}
      {editingMember && permsForm && (
        <Dialog open={true} onOpenChange={() => { setEditPermsId(null); setPermsForm(null); }}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Права доступа — {editingMember.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-1 mb-4">
              <p className="text-xs text-muted-foreground">Быстрый сброс до стандартных прав роли:</p>
              <div className="flex gap-2 flex-wrap">
                {(Object.entries(ROLE_LABELS) as [StaffRole, string][]).map(([role, label]) => (
                  <button key={role} onClick={() => resetPermsToRole(role)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${editingMember.role === role ? 'bg-foreground text-primary-foreground border-foreground' : 'border-border hover:bg-secondary'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-5">
              {PERMISSION_GROUPS.map(group => (
                <div key={group.label}>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon name={group.icon} size={15} className="text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{group.label}</span>
                  </div>
                  <div className="space-y-2 pl-5">
                    {group.keys.map(key => (
                      <label key={key} className="flex items-center gap-3 cursor-pointer group">
                        <div
                          onClick={() => setPermsForm(p => p ? { ...p, [key]: !p[key] } : p)}
                          className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer shrink-0 ${permsForm[key] ? 'bg-emerald-500' : 'bg-secondary border border-border'}`}
                        >
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${permsForm[key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </div>
                        <span className="text-sm">{PERMISSION_LABELS[key]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={savePerms} className="w-full mt-4 bg-foreground text-primary-foreground">
              Сохранить права
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

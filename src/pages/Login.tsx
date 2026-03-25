import { useState } from 'react';
import { StoreType } from '@/store';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface LoginProps {
  store: StoreType;
  onLogin: (staffId: string) => void;
}

export default function Login({ store, onLogin }: LoginProps) {
  const { state } = store;
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!login || !password) { setError('Введите логин и пароль'); return; }
    const member = state.staff.find(m => {
      const loginMatch = m.login ? m.login === login : m.email === login;
      return loginMatch && m.password === password;
    });
    if (!member) { setError('Неверный логин или пароль'); return; }
    setError('');
    onLogin(member.id);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-foreground rounded-xl flex items-center justify-center mx-auto mb-4">
            <Icon name="Dumbbell" size={22} className="text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-semibold">FitCRM</h1>
          <p className="text-sm text-muted-foreground mt-1">Войдите в свой аккаунт</p>
        </div>

        <div className="bg-white border border-border rounded-2xl p-6 space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Логин или Email</Label>
            <Input
              value={login}
              onChange={e => { setLogin(e.target.value); setError(''); }}
              placeholder="admin@fitcrm.ru"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Пароль</Label>
            <div className="relative">
              <Input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="••••••••"
                className="pr-9"
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <Icon name={showPwd ? 'EyeOff' : 'Eye'} size={15} />
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <Icon name="AlertCircle" size={13} />
              {error}
            </p>
          )}

          <Button
            onClick={handleSubmit}
            disabled={!login || !password}
            className="w-full bg-foreground text-primary-foreground hover:opacity-90"
          >
            Войти
          </Button>

          <p className="text-xs text-center text-muted-foreground pt-1">
            Логин — email сотрудника или установленный логин.<br />
            Пароль задаётся в разделе «Сотрудники».
          </p>
        </div>
      </div>
    </div>
  );
}

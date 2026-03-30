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
  const { state, dbLoaded } = store;
  const [step, setStep] = useState<'code' | 'credentials'>('code');
  const [projectCode, setProjectCode] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');

  const handleCodeSubmit = () => {
    if (!projectCode.trim()) { setError('Введите код проекта'); return; }
    if (projectCode.trim().toUpperCase() !== state.projectCode.toUpperCase()) {
      setError('Неверный код проекта');
      return;
    }
    setError('');
    setStep('credentials');
  };

  const handleLoginSubmit = () => {
    if (!dbLoaded) { setError('Подождите, данные ещё загружаются...'); return; }
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
          <p className="text-sm text-muted-foreground mt-1">
            {step === 'code' ? 'Введите код проекта' : 'Войдите в свой аккаунт'}
          </p>
        </div>

        <div className="bg-white border border-border rounded-2xl p-6 space-y-4">
          {step === 'code' ? (
            <>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Код проекта</Label>
                <Input
                  value={projectCode}
                  onChange={e => { setProjectCode(e.target.value); setError(''); }}
                  placeholder="FIT-XXXX"
                  onKeyDown={e => e.key === 'Enter' && handleCodeSubmit()}
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <Icon name="AlertCircle" size={13} />
                  {error}
                </p>
              )}

              <Button
                onClick={handleCodeSubmit}
                disabled={!projectCode.trim()}
                className="w-full bg-foreground text-primary-foreground hover:opacity-90"
              >
                Продолжить
              </Button>

              <div className="bg-secondary/60 rounded-lg px-3 py-2.5 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] text-muted-foreground">Код этого проекта</p>
                  <p className="text-sm font-semibold tracking-widest">{state.projectCode}</p>
                </div>
                <Icon name="KeyRound" size={16} className="text-muted-foreground shrink-0" />
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => { setStep('code'); setError(''); setLogin(''); setPassword(''); }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors -mb-1"
              >
                <Icon name="ChevronLeft" size={13} />
                Назад
              </button>

              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Логин или Email</Label>
                <Input
                  value={login}
                  onChange={e => { setLogin(e.target.value); setError(''); }}
                  placeholder="login"
                  onKeyDown={e => e.key === 'Enter' && handleLoginSubmit()}
                  autoFocus
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
                    onKeyDown={e => e.key === 'Enter' && handleLoginSubmit()}
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
                onClick={handleLoginSubmit}
                disabled={!login || !password}
                className="w-full bg-foreground text-primary-foreground hover:opacity-90"
              >
                {!dbLoaded ? 'Загрузка данных...' : 'Войти'}
              </Button>

              <p className="text-xs text-center text-muted-foreground pt-1">
                Логин и пароль задаются в разделе «Сотрудники»
              </p>

              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
                className="w-full text-xs text-muted-foreground underline pt-1"
              >
                Не получается войти? Сбросить данные
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
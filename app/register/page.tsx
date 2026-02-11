'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signUp } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useI18n } from '@/components/i18n/I18nProvider';

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const rules = useMemo(() => {
    const lengthOk = password.length >= 8;
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    return { lengthOk, hasLower, hasUpper, hasNumber };
  }, [password]);

  const score = (Number(rules.lengthOk) + Number(rules.hasLower) + Number(rules.hasUpper) + Number(rules.hasNumber));
  const strength = useMemo(() => {
    if (score <= 1) return { label: t('auth.password.weak'), color: 'bg-red-500' };
    if (score === 2) return { label: t('auth.password.fair'), color: 'bg-orange-500' };
    if (score === 3) return { label: t('auth.password.medium'), color: 'bg-amber-500' };
    return { label: t('auth.password.strong'), color: 'bg-emerald-600' };
  }, [score]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('auth.register.mismatch'));
      return;
    }

    if (!(rules.lengthOk && rules.hasLower && rules.hasUpper && rules.hasNumber)) {
      setError(t('auth.register.passwordRules'));
      return;
    }

    setLoading(true);

    try {
      const result = await signUp(email, password);

      if (result.error) {
        setError(t('auth.register.error'));
        setLoading(false);
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setError(t('auth.register.error'));
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-gray-900">Wayfa</h1>
          <p className="mt-2 text-sm text-gray-600">{t('auth.register.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              {t('auth.email')}
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              placeholder={t('auth.email.placeholder')}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              {t('auth.password')}
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              placeholder={t('auth.password.placeholder')}
            />
            <div className="mt-2">
              <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${strength.color} transition-all`}
                  style={{ width: `${(score / 4) * 100}%` }}
                />
              </div>
              <div className="mt-1 text-xs text-gray-600">{strength.label}</div>
            </div>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <li className={rules.lengthOk ? 'text-emerald-700' : 'text-gray-500'}>• {t('auth.password.rule.length')}</li>
              <li className={rules.hasUpper ? 'text-emerald-700' : 'text-gray-500'}>• {t('auth.password.rule.upper')}</li>
              <li className={rules.hasLower ? 'text-emerald-700' : 'text-gray-500'}>• {t('auth.password.rule.lower')}</li>
              <li className={rules.hasNumber ? 'text-emerald-700' : 'text-gray-500'}>• {t('auth.password.rule.number')}</li>
            </ul>
          </div>

          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              {t('auth.register.confirm')}
            </label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
              placeholder={t('auth.password.placeholder')}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading || !(rules.lengthOk && rules.hasLower && rules.hasUpper && rules.hasNumber) || password !== confirmPassword}>
            {loading ? t('auth.register.loading') : t('auth.register.submit')}
          </Button>
        </form>

        <p className="text-sm text-center text-gray-600">
          {t('auth.register.hasAccount')}{' '}
          <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
            {t('auth.register.signin')}
          </Link>
        </p>
      </Card>
    </div>
  );
}

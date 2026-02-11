'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { AuthGuard } from '@/components/AuthGuard';
import { NavBar } from '@/components/NavBar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useI18n } from '@/components/i18n/I18nProvider';

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [edit, setEdit] = useState(false);
  const { t, locale, setLocale } = useI18n();
  const [language, setLanguage] = useState<string>(locale);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      setEmail(user.email || '');

      // fetch profile; if not exists, create a minimal one
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('display_name, language')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile) {
        await supabase.from('user_profiles').insert({
          user_id: user.id,
          email: user.email,
          display_name: null,
          language: language || null,
        } as any);
        setDisplayName('');
      } else {
        setDisplayName((profile as any).display_name || '');
        const dbLang = (profile as any).language as string | null;
        if (dbLang) {
          const normalized = dbLang === 'profile.lang.spanish' ? 'es' : dbLang === 'profile.lang.english' ? 'en' : dbLang;
          const finalLang = (normalized === 'en' || normalized === 'es') ? normalized : 'en';
          setLanguage(finalLang);
          setLocale(finalLang);
        }
      }

      setLoading(false);
    })();
  }, [router]);

  const initials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const saveProfile = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('user_profiles')
      .upsert({
        user_id: user.id,
        email: user.email,
        display_name: displayName || null,
        language: language || null,
      } as any);

    if (language) setLocale(language);

    setSaving(false);
    setEdit(false);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-background">
          <NavBar />
          <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-muted-foreground">{t('profile.loading')}</div>
          </main>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <NavBar />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-end mb-4">
            <Link href="/dashboard" className="inline-flex items-center px-4 py-2 rounded-md bg-primary text-primary-foreground shadow-[0_6px_0_rgba(0,0,0,0.2)]">
              {t('profile.back')}
            </Link>
          </div>

          <div className="flex flex-col items-center text-center mb-6">
            <Avatar className="w-24 h-24">
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-2xl">
                {initials(displayName || email)}
              </AvatarFallback>
            </Avatar>
            <h1 className="mt-4 text-2xl font-bold text-foreground">{displayName || t('profile.subtitle')}</h1>
            <p className="text-muted-foreground">{email}</p>
            <Button onClick={() => setEdit(true)} variant="secondary" className="mt-3" disabled={edit}>
              {t('profile.edit')}
            </Button>
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="divide-y">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">👤</div>
                  <div>
                    <div className="font-medium text-foreground">{t('profile.title')}</div>
                    <div className="text-sm text-muted-foreground">{t('profile.subtitle')}</div>
                  </div>
                </div>
                <div className="w-1/2 max-w-sm">
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={!edit}
                    placeholder={t('profile.name.placeholder')}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">🌐</div>
                  <div>
                    <div className="font-medium text-foreground">{t('profile.language')}</div>
                    <div className="text-sm text-muted-foreground">{t('profile.language.sub')}</div>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {edit ? (
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="border rounded-md px-2 py-1 bg-card"
                    >
                      <option value="en">{t('profile.lang.english')}</option>
                      <option value="es">{t('profile.lang.spanish')}</option>
                    </select>
                  ) : (
                    <span>{language === 'es' ? t('profile.lang.spanish') : t('profile.lang.english')}</span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setEdit(false)} disabled={!edit}>{t('profile.cancel')}</Button>
            <Button onClick={saveProfile} disabled={!edit || saving}>{saving ? t('profile.saving') : t('profile.save')}</Button>
          </div>

          <div className="mt-8">
            <Button variant="destructive" className="w-full" onClick={logout}>{t('profile.logout')}</Button>
            <div className="text-center text-xs text-muted-foreground mt-2">{t('profile.deleteAccount')}</div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}

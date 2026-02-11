'use client';

import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { NavBar } from '@/components/NavBar';
import { TripList } from '@/components/TripList';
import { CreateTripModal } from '@/components/CreateTripModal';
import { InvitationsList } from '@/components/InvitationsList';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useI18n } from '@/components/i18n/I18nProvider';
import { Reveal } from '@/components/motion/Reveal';
import { FullPageLoader } from '@/components/FullPageLoader';

export default function DashboardPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [sectionsLoaded, setSectionsLoaded] = useState<{ trips: boolean; invitations: boolean }>({ trips: false, invitations: false });
  const { t } = useI18n();

  useEffect(() => {
    let mounted = true;
    const onSectionLoaded = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (!mounted) return;
      if (detail === 'trips') setSectionsLoaded((s) => ({ ...s, trips: true }));
      if (detail === 'invitations') setSectionsLoaded((s) => ({ ...s, invitations: true }));
    };
    try { window.addEventListener('dashboard-section-loaded', onSectionLoaded as any); } catch { }
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!mounted) return;
        const meta = (user?.user_metadata || {}) as any;
        const full = (meta.full_name || meta.name || '') as string;
        const fallback = user?.email ? user.email.split('@')[0] : '';
        setUserName(full || fallback || '');
      } catch { }
    })();
    return () => { mounted = false; try { window.removeEventListener('dashboard-section-loaded', onSectionLoaded as any); } catch { } };
  }, []);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background relative">
        {!(sectionsLoaded.trips && sectionsLoaded.invitations) && (
          <FullPageLoader />
        )}
        <NavBar />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-start justify-between mb-8">
            <div>
              <Reveal variant="slideUp"><h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">{t('dashboard.welcome', { commaName: userName ? `, ${userName}` : '' })}</h1></Reveal>
              <Reveal variant="fade" delayMs={70}><p className="text-muted-foreground mt-3">{t('dashboard.ready')}</p></Reveal>
            </div>
            <Reveal variant="slideIn" delayMs={120}>
              <Button onClick={() => setShowCreateModal(true)} className="mt-2 flex items-center gap-2 shadow-[0_6px_0_rgba(0,0,0,0.2)]">
                <Plus className="h-4 w-4" />
                {t('dashboard.create')}
              </Button>
            </Reveal>
          </div>

          <div className="space-y-6">
            <Reveal><InvitationsList /></Reveal>
            <Reveal delayMs={80}><TripList onCreateTrip={() => setShowCreateModal(true)} /></Reveal>
          </div>
        </main>

        <CreateTripModal open={showCreateModal} onOpenChange={setShowCreateModal} />
      </div>
    </AuthGuard>
  );
}

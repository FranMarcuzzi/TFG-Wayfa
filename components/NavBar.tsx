'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { LogOut, User, Globe } from 'lucide-react';
import { useI18n } from '@/components/i18n/I18nProvider';

import { ModeToggle } from '@/components/mode-toggle';

export function NavBar() {
  const router = useRouter();
  const { t } = useI18n();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <nav className="border-b bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/dashboard" className="text-2xl font-semibold text-foreground">
            Wayfa
          </Link>

          <div className="flex items-center gap-2">
            <Link href="/travel-requirements" className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground">
              <Globe className="h-4 w-4" />
              {t('nav.travel')}
            </Link>
            <Link href="/profile" className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground">
              <User className="h-4 w-4" />
              {t('nav.profile')}
            </Link>
            <ModeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              {t('nav.signOut')}
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}

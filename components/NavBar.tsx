'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { LogOut, User, Globe, Menu, X } from 'lucide-react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { useState } from 'react';

export function NavBar() {
  const router = useRouter();
  const { t } = useI18n();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <nav className="border-b bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/dashboard" className="text-xl sm:text-2xl font-semibold text-gray-900">
            Wayfa
          </Link>

          {/* Desktop menu */}
          <div className="hidden md:flex items-center gap-2">
            <Link href="/travel-requirements" className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-gray-100">
              <Globe className="h-4 w-4" />
              {t('nav.travel')}
            </Link>
            <Link href="/profile" className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-gray-100">
              <User className="h-4 w-4" />
              {t('nav.profile')}
            </Link>
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

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-md hover:bg-gray-100"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t py-4 space-y-2">
            <Link
              href="/travel-requirements"
              className="flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-gray-100"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Globe className="h-5 w-5" />
              {t('nav.travel')}
            </Link>
            <Link
              href="/profile"
              className="flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-gray-100"
              onClick={() => setMobileMenuOpen(false)}
            >
              <User className="h-5 w-5" />
              {t('nav.profile')}
            </Link>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleSignOut();
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-gray-100 text-left"
            >
              <LogOut className="h-5 w-5" />
              {t('nav.signOut')}
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

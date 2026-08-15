'use client';

import { Menu, Moon, Sun, Languages } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useAuth } from '@/components/providers/auth-provider';
import { useTheme } from '@/components/providers/theme-provider';
import { SearchBox } from '@/components/search/search-box';
import { Button } from '@/components/ui/button';
import { Dropdown } from '@/components/ui/misc';
import { Skeleton } from '@/components/ui/skeletons';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

export function SiteHeader() {
  const t = useTranslations('nav');
  const localeT = useTranslations('locale');
  const { user, logout, ready } = useAuth();
  const { toggle, theme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-canvas/90 backdrop-blur">
      <div className="container-page flex items-center gap-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight">
          GameScore
        </Link>
        <nav className="hidden items-center gap-4 text-sm md:flex">
          <Link href="/games">{t('games')}</Link>
          <Link href="/rankings">{t('rankings')}</Link>
        </nav>
        <SearchBox className="hidden min-w-0 flex-1 md:block" />
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={toggle} aria-label={t('toggleTheme')}>
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Dropdown
            trigger={
              <Button variant="ghost" size="sm" aria-label={t('changeLanguage')}>
                <Languages className="h-4 w-4" />
              </Button>
            }
          >
            {routing.locales.map((locale) => (
              <button
                key={locale}
                type="button"
                className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-hover"
                onClick={() => router.replace(pathname, { locale })}
              >
                {localeT(locale)}
              </button>
            ))}
          </Dropdown>
          {!ready ? (
            <Skeleton className="hidden h-8 w-24 rounded-lg sm:block" />
          ) : user ? (
            <Dropdown
              trigger={
                <Button variant="ghost" size="sm">
                  {user.username}
                </Button>
              }
            >
              <Link href={`/profile/${user.username}`} className="block rounded-lg px-3 py-2 text-sm hover:bg-surface-hover">
                {t('profile')}
              </Link>
              {user.role !== 'USER' ? (
                <Link href="/admin" className="block rounded-lg px-3 py-2 text-sm hover:bg-surface-hover">
                  {t('admin')}
                </Link>
              ) : null}
              <button
                type="button"
                className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-hover"
                onClick={() => void logout()}
              >
                {t('logout')}
              </button>
            </Dropdown>
          ) : (
            <div className="hidden gap-2 sm:flex">
              <Link href="/login" className="rounded-lg px-3 py-2 text-sm hover:bg-surface-hover">
                {t('login')}
              </Link>
              <Link href="/register" className="rounded-lg bg-brand px-3 py-2 text-sm text-brand-contrast">
                {t('register')}
              </Link>
            </div>
          )}
          <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setMenuOpen((value) => !value)} aria-label={t('openMenu')}>
            <Menu className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {menuOpen ? (
        <div className="border-t border-border-subtle px-4 py-3 md:hidden">
          <SearchBox />
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <Link href="/games">{t('games')}</Link>
            <Link href="/rankings">{t('rankings')}</Link>
            {!user ? (
              <>
                <Link href="/login">{t('login')}</Link>
                <Link href="/register">{t('register')}</Link>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}

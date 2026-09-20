'use client';

import { Menu, Moon, Sun, Languages, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { useAuth } from '@/components/providers/auth-provider';
import { useTheme } from '@/components/providers/theme-provider';
import { SearchBox } from '@/components/search/search-box';
import { Button } from '@/components/ui/button';
import { Dropdown } from '@/components/ui/misc';
import { Skeleton } from '@/components/ui/skeletons';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { cn } from '@/lib/cn';

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== '/' && pathname.startsWith(href));
  return (
    <Link
      href={href}
      className={cn(
        'rounded-md px-2 py-1.5 text-sm transition-colors duration-100 hover:text-content',
        active ? 'font-semibold text-content' : 'text-content-muted',
      )}
      aria-current={active ? 'page' : undefined}
    >
      {children}
    </Link>
  );
}

export function SiteHeader() {
  const t = useTranslations('nav');
  const localeT = useTranslations('locale');
  const { user, logout, ready } = useAuth();
  const { toggle, theme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-canvas">
      <div className="container-page flex items-center gap-3 py-2.5">
        <Link href="/" className="font-display text-lg font-bold tracking-tight text-content shrink-0">
          GameScore
        </Link>
        <nav className="hidden items-center gap-0.5 md:flex">
          <NavLink href="/games">{t('games')}</NavLink>
          <NavLink href="/rankings">{t('rankings')}</NavLink>
          <NavLink href="/scoring">{t('scoring')}</NavLink>
        </nav>
        <SearchBox className="hidden min-w-0 flex-1 md:block" />
        <div className="ml-auto flex items-center gap-0.5">
          <Button variant="ghost" size="sm" onClick={toggle} aria-label={t('toggleTheme')} className="min-h-10 w-10 px-0">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Dropdown
            trigger={
              <Button variant="ghost" size="sm" aria-label={t('changeLanguage')} className="min-h-10 w-10 px-0">
                <Languages className="h-4 w-4" />
              </Button>
            }
          >
            {routing.locales.map((locale) => (
              <button
                key={locale}
                type="button"
                className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-surface-hover"
                onClick={() => router.replace(pathname, { locale })}
              >
                {localeT(locale)}
              </button>
            ))}
          </Dropdown>
          {!ready ? (
            <Skeleton className="hidden h-8 w-24 rounded-md sm:block" />
          ) : user ? (
            <Dropdown
              trigger={
                <Button variant="ghost" size="sm">
                  {user.username}
                </Button>
              }
            >
              <Link
                href={`/profile/${user.username}`}
                className="block rounded-md px-3 py-2 text-sm hover:bg-surface-hover"
              >
                {t('profile')}
              </Link>
              <Link href="/settings" className="block rounded-md px-3 py-2 text-sm hover:bg-surface-hover">
                {t('settings')}
              </Link>
              {user.role !== 'USER' ? (
                <Link href="/admin" className="block rounded-md px-3 py-2 text-sm hover:bg-surface-hover">
                  {t('admin')}
                </Link>
              ) : null}
              <button
                type="button"
                className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-surface-hover"
                onClick={() => void logout()}
              >
                {t('logout')}
              </button>
            </Dropdown>
          ) : (
            <div className="hidden gap-1.5 sm:flex">
              <Link
                href="/login"
                className="inline-flex min-h-10 items-center rounded-md px-3 text-sm hover:bg-surface-hover"
              >
                {t('login')}
              </Link>
              <Link
                href="/register"
                className="inline-flex min-h-10 items-center rounded-md bg-brand px-3 text-sm font-medium text-brand-contrast hover:bg-brand-hover"
              >
                {t('register')}
              </Link>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="min-h-10 w-10 px-0 md:hidden"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label={menuOpen ? t('closeMenu') : t('openMenu')}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      {menuOpen ? (
        <div className="border-t border-border-subtle px-4 py-3 md:hidden">
          <SearchBox />
          <nav className="mt-3 flex flex-col gap-0.5 text-sm">
            <NavLink href="/games">{t('games')}</NavLink>
            <NavLink href="/rankings">{t('rankings')}</NavLink>
            <NavLink href="/scoring">{t('scoring')}</NavLink>
            {!user ? (
              <>
                <Link href="/login" className="rounded-md px-2 py-2 text-content-muted">
                  {t('login')}
                </Link>
                <Link href="/register" className="rounded-md px-2 py-2 font-medium text-brand">
                  {t('register')}
                </Link>
              </>
            ) : (
              <>
                <Link href={`/profile/${user.username}`} className="rounded-md px-2 py-2 text-content-muted">
                  {t('profile')}
                </Link>
                <Link href="/settings" className="rounded-md px-2 py-2 text-content-muted">
                  {t('settings')}
                </Link>
                {user.role !== 'USER' ? (
                  <Link href="/admin" className="rounded-md px-2 py-2 text-content-muted">
                    {t('admin')}
                  </Link>
                ) : null}
                <button
                  type="button"
                  className="rounded-md px-2 py-2 text-left text-content-muted"
                  onClick={() => void logout()}
                >
                  {t('logout')}
                </button>
              </>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
}

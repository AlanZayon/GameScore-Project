'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { Link } from '@/i18n/navigation';

export function ProfileEditLink({ username, label }: { username: string; label: string }) {
  const { user } = useAuth();
  if (!user || user.username !== username) return null;
  return (
    <Link href="/settings" className="text-sm text-brand hover:underline">
      {label}
    </Link>
  );
}

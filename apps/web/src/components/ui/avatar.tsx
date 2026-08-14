import { cn } from '@/lib/cn';

export function Avatar({
  name,
  src,
  size = 'md',
}: {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center overflow-hidden rounded-full bg-brand-soft font-semibold text-brand',
        size === 'sm' && 'h-7 w-7 text-[10px]',
        size === 'md' && 'h-9 w-9 text-xs',
        size === 'lg' && 'h-14 w-14 text-lg',
      )}
    >
      {src ? (
        // External avatars are optional; initials are the reliable fallback.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}

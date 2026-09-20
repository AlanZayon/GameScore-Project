'use client';

export function AdminFilterChips({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`min-h-8 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors duration-100 ${
            value === option.id
              ? 'bg-brand text-brand-contrast'
              : 'border border-border-subtle text-content-muted hover:bg-surface-hover'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'green' | 'blue' | 'amber' | 'red' | 'gray' | 'purple';
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  dot?: boolean;
}

const variantStyles: Record<string, React.CSSProperties> = {
  green:  { background: 'rgba(82,183,136,0.12)',  color: 'var(--primary)',  border: '1px solid rgba(82,183,136,0.25)' },
  blue:   { background: 'rgba(82,179,217,0.12)',  color: '#52b3d9',         border: '1px solid rgba(82,179,217,0.25)' },
  amber:  { background: 'rgba(233,196,106,0.12)', color: 'var(--accent)',   border: '1px solid rgba(233,196,106,0.25)' },
  red:    { background: 'rgba(193,68,14,0.10)',   color: 'var(--danger)',   border: '1px solid rgba(193,68,14,0.25)' },
  gray:   { background: 'var(--input-bg)',        color: 'var(--muted)',    border: '1px solid var(--border)' },
  purple: { background: 'rgba(147,51,234,0.10)',  color: '#a855f7',         border: '1px solid rgba(147,51,234,0.25)' },
};

const dotColors: Record<string, string> = {
  green: 'var(--primary)',  blue: '#52b3d9',  amber: 'var(--accent)',
  red: 'var(--danger)',     gray: 'var(--muted)', purple: '#a855f7',
};

const sizes = {
  xs: 'px-1.5 py-0.5 text-[10px]',
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

export default function Badge({ children, variant = 'green', size = 'sm', className, dot = false }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full font-semibold', sizes[size], className)}
      style={variantStyles[variant]}
    >
      {dot && (
        <span
          className="h-1.5 w-1.5 rounded-full flex-shrink-0"
          style={{ background: dotColors[variant] }}
        />
      )}
      {children}
    </span>
  );
}

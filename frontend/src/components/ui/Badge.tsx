import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'green' | 'blue' | 'amber' | 'red' | 'gray' | 'purple';
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  dot?: boolean;
}

const variants = {
  green: 'bg-forest-950 text-forest-300 border-forest-500/25',
  blue: 'bg-blue-950 text-blue-300 border-blue-500/25',
  amber: 'bg-amber-950 text-amber-300 border-amber-500/25',
  red: 'bg-red-950 text-red-300 border-red-500/25',
  gray: 'bg-dark-100 text-gray-400 border-dark-50',
  purple: 'bg-purple-950 text-purple-300 border-purple-500/25',
};

const dotColors = {
  green: 'bg-forest-400',
  blue: 'bg-blue-400',
  amber: 'bg-amber-400',
  red: 'bg-red-400',
  gray: 'bg-gray-500',
  purple: 'bg-purple-400',
};

const sizes = {
  xs: 'px-1.5 py-0.5 text-[10px]',
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

export default function Badge({
  children,
  variant = 'green',
  size = 'sm',
  className,
  dot = false,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', dotColors[variant])} />}
      {children}
    </span>
  );
}

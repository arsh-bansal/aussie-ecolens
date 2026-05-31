import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<string, React.CSSProperties> = {
  primary:   { background: 'var(--primary)',   color: '#fff' },
  secondary: { background: 'var(--nav-active-bg)', color: 'var(--primary)', border: '1px solid var(--border)' },
  ghost:     { background: 'transparent',      color: 'var(--muted)' },
  danger:    { background: 'rgba(193,68,14,0.1)', color: 'var(--danger)', border: '1px solid rgba(193,68,14,0.3)' },
  outline:   { background: 'transparent',      color: 'var(--primary)', border: '1px solid var(--border)' },
};

const variantHoverClass: Record<string, string> = {
  primary:   'hover:opacity-90 active:scale-[0.98]',
  secondary: 'hover:opacity-80',
  ghost:     'hover:opacity-80',
  danger:    'hover:opacity-90 active:scale-[0.98]',
  outline:   'hover:opacity-80 active:scale-[0.98]',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, leftIcon, rightIcon, children, className, disabled, style, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 ' +
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ' +
      'disabled:cursor-not-allowed disabled:opacity-50 select-none whitespace-nowrap';

    const sizes = {
      sm: 'px-3 py-1.5 text-xs h-8',
      md: 'px-4 py-2 text-sm h-9',
      lg: 'px-5 py-2.5 text-sm h-10',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(base, variantHoverClass[variant], sizes[size], className)}
        style={{ ...variantStyles[variant], ...style }}
        {...props}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : leftIcon}
        {children}
        {!loading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;

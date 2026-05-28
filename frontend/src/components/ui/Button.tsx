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

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, leftIcon, rightIcon, children, className, disabled, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200 ' +
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-400/50 ' +
      'disabled:cursor-not-allowed disabled:opacity-50 select-none whitespace-nowrap';

    const variants = {
      primary:
        'bg-forest-500 hover:bg-forest-400 active:bg-forest-600 text-black shadow-glow-sm hover:shadow-glow active:scale-[0.98]',
      secondary:
        'bg-dark-100 hover:bg-dark-50 text-forest-300 border border-forest-500/20 hover:border-forest-500/40',
      ghost: 'hover:bg-white/5 text-gray-400 hover:text-gray-100',
      danger:
        'bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 hover:border-red-500/50 active:scale-[0.98]',
      outline:
        'border border-forest-500/30 hover:border-forest-500/60 text-forest-400 hover:bg-forest-500/10 active:scale-[0.98]',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-xs h-8',
      md: 'px-4 py-2 text-sm h-9',
      lg: 'px-6 py-3 text-base h-11',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(base, variants[variant], sizes[size], className)}
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

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftAddon, rightAddon, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            {label}
            {props.required && <span className="ml-1" style={{ color: 'var(--danger)' }}>*</span>}
          </label>
        )}
        <div className="relative flex items-center">
          {leftAddon && (
            <div className="absolute left-3.5 flex items-center pointer-events-none z-10" style={{ color: 'var(--muted)' }}>
              {leftAddon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full rounded-xl py-2.5 text-sm transition-all duration-200',
              'placeholder:opacity-40',
              'focus:outline-none focus:ring-2',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              leftAddon  ? 'pl-10' : 'px-3.5',
              rightAddon ? 'pr-10' : 'px-3.5',
              className
            )}
            style={{
              background:   'var(--input-bg)',
              border:       error ? '1.5px solid var(--danger)' : '1.5px solid var(--input-border)',
              color:        'var(--text)',
              boxShadow:    error ? undefined : 'none',
              // @ts-ignore
              '--tw-ring-color': 'rgba(82,183,136,0.25)',
            } as React.CSSProperties}
            {...props}
          />
          {rightAddon && (
            <div className="absolute right-3.5 flex items-center z-10" style={{ color: 'var(--muted)' }}>
              {rightAddon}
            </div>
          )}
        </div>
        {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
        {hint && !error && <p className="text-xs opacity-60" style={{ color: 'var(--muted)' }}>{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;

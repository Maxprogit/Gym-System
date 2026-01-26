import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="w-full space-y-2">
        {label && (
          <label className="text-xs font-mono text-text-[#a1a1aa] uppercase tracking-wider">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            "flex h-11 w-full rounded-lg border border-[#27272a] bg-bg-[#18181b] px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#D4FF00] focus:ring-1 focus:ring-[#D4FF00]/50 transition-all font-mono disabled:opacity-50",
            error && "border-red-500 focus:border-red-500 focus:ring-red-500/50",
            className
          )}
          {...props}
        />
        {error && <span className="text-xs text-red-500 font-mono">{error}</span>}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
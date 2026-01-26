import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'outline' | 'ghost';
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', isLoading, children, ...props }, ref) => {
    
    const variants = {
      primary: "bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90 shadow-[0_0_15px_rgba(212,255,0,0.3)] hover:shadow-[0_0_25px_rgba(212,255,0,0.5)] border-transparent",
      danger: "bg-red-600 text-white hover:bg-red-700 shadow-[0_0_15px_rgba(220,38,38,0.3)] border-transparent",
      outline: "bg-transparent border border-[#27272a] text-[#e4e4e7] hover:border-[#D4FF00] hover:text-[#D4FF00]",
      ghost: "bg-transparent text-text-[#a1a1aa] hover:text-white hover:bg-white/5 border-transparent"
    };

    return (
      <button
        ref={ref}
        className={cn(
          "relative inline-flex items-center justify-center rounded-lg px-6 py-2.5 font-heading font-bold uppercase tracking-wide text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed border",
          variants[variant],
          className
        )}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button };
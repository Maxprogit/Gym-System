import { LoaderCircle } from 'lucide-react';
import { useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { gsap, useGSAP } from '../../lib/motion';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({ className, variant = 'primary', loading, icon, children, disabled, ...props }: ButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { contextSafe } = useGSAP({ scope: buttonRef });
  const enter = contextSafe(() => {
    if (disabled || loading) return;
    gsap.to(buttonRef.current, { y: -2, scale: 1.015, duration: 0.28, ease: 'power2.out', overwrite: 'auto' });
    const iconNode = buttonRef.current?.querySelector('svg');
    if (iconNode) gsap.to(iconNode, { rotate: 8, scale: 1.08, duration: 0.28, overwrite: 'auto' });
  });
  const leave = contextSafe(() => {
    gsap.to(buttonRef.current, { y: 0, scale: 1, duration: 0.38, ease: 'expo.out', overwrite: 'auto' });
    const iconNode = buttonRef.current?.querySelector('svg');
    if (iconNode) gsap.to(iconNode, { rotate: 0, scale: 1, duration: 0.38, overwrite: 'auto' });
  });

  return (
    <button
      ref={buttonRef}
      className={cn('button', `button--${variant}`, className)}
      disabled={disabled || loading}
      onPointerEnter={enter}
      onPointerLeave={leave}
      {...props}
    >
      {loading ? <LoaderCircle size={17} className="animate-spin" /> : icon}
      <span>{children}</span>
    </button>
  );
}

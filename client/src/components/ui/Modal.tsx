import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { gsap, useGSAP } from '../../lib/motion';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ open, onClose, title, description, children, size = 'md' }: ModalProps) {
  const [mounted, setMounted] = useState(open);
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useGSAP(() => {
    if (!mounted || !backdropRef.current || !panelRef.current) return;
    if (open) {
      const reveals = backdropRef.current.querySelectorAll('[data-modal-reveal]');
      gsap.timeline({ defaults: { ease: 'expo.out' } })
        .fromTo(backdropRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.28 })
        .fromTo(panelRef.current, { autoAlpha: 0, y: 64, scale: 0.965, clipPath: 'inset(0 0 100% 0)' }, { autoAlpha: 1, y: 0, scale: 1, clipPath: 'inset(0 0 0% 0)', duration: 0.72 }, '-=.12')
        .from(reveals, { autoAlpha: 0, y: 20, duration: 0.45, stagger: 0.07 }, '-=.38');
      return;
    }
    gsap.timeline({ onComplete: () => setMounted(false) })
      .to(panelRef.current, { autoAlpha: 0, y: 30, scale: 0.98, duration: 0.24, ease: 'power3.in' })
      .to(backdropRef.current, { autoAlpha: 0, duration: 0.18 }, '-=.08');
  }, { dependencies: [mounted, open], revertOnUpdate: true });

  useEffect(() => {
    if (!mounted) return undefined;
    const handleKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [mounted, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div ref={backdropRef} className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="modal-title" className={`modal-panel modal-panel--${size}`}>
        <header className="modal-header" data-modal-reveal>
          <div><p className="eyebrow">Goliat / Workspace</p><h2 id="modal-title">{title}</h2>{description && <p>{description}</p>}</div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </header>
        <div className="modal-body" data-modal-reveal>{children}</div>
      </section>
    </div>,
    document.body,
  );
}

import { useLayoutEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent } from 'react';
import { Building2, Check, Copy, CreditCard, LockKeyhole, Radio, ShieldCheck, Smartphone } from 'lucide-react';
import { currency } from '../../lib/format';
import { getErrorMessage } from '../../lib/api';
import { gsap, reduceMotion, selectAll, selectOne, SplitText, useGSAP } from '../../lib/motion';
import { notify } from '../../lib/notify';
import { processPayment } from '../../services/payments/PaymentService';
import { Button } from './Button';
import { Modal } from './Modal';

interface CardForm { number: string; name: string; expiry: string; cvv: string }
const emptyCard: CardForm = { number: '', name: '', expiry: '', cvv: '' };

export function PaymentCheckoutDialog({ open, method, amount, onClose, onSuccess }: {
  open: boolean;
  method: 'Tarjeta' | 'Transferencia';
  amount: number;
  onClose: () => void;
  onSuccess: (transactionId: string) => Promise<void> | void;
}) {
  const rootRef = useRef<HTMLFormElement>(null);
  const [card, setCard] = useState<CardForm>(emptyCard);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const reference = useMemo(() => `GOL-${String(Date.now()).slice(-8)}`, [open]);
  const bank = import.meta.env.VITE_TRANSFER_BANK || 'BBVA · DEMOSTRACIÓN';
  const clabe = import.meta.env.VITE_TRANSFER_CLABE || '012345678901234567';
  const beneficiary = import.meta.env.VITE_TRANSFER_BENEFICIARY || 'GOLIAT GYM';

  useLayoutEffect(() => {
    if (!open) return;
    setCard(emptyCard);
    setConfirmed(false);
    setLoading(false);
    setError('');
  }, [method, open]);

  useGSAP(() => {
    const root = rootRef.current;
    if (!open || !root || reduceMotion()) return;
    const heading = selectOne<HTMLElement>(root, '.checkout-heading');
    const steps = selectAll<HTMLElement>(root, '[data-checkout-step]');
    const scanPath = selectOne<SVGPathElement>(root, '.checkout-scan-path');
    const visual = selectOne<HTMLElement>(root, '.checkout-visual');
    if (!heading || !visual) return;
    const split = SplitText.create(heading, { type: 'words', aria: 'auto' });
    const timeline = gsap.timeline({ defaults: { ease: 'goliat-in' } });
    timeline
      .from(split.words, { yPercent: 120, rotateX: -34, autoAlpha: 0, duration: 0.85, stagger: 0.06 })
      .from(visual, { rotateY: method === 'Tarjeta' ? -32 : 32, rotateX: 12, z: -180, autoAlpha: 0, duration: 1 }, '-=.62');
    if (steps.length) timeline.from(steps, { x: 28, autoAlpha: 0, duration: 0.58, stagger: 0.08 }, '-=.62');
    if (scanPath) timeline.from(scanPath, { drawSVG: '0%', duration: 0.9 }, '-=.72');
    return () => split.revert();
  }, { dependencies: [open, method], revertOnUpdate: true });

  const tilt = (event: PointerEvent<HTMLDivElement>) => {
    if (reduceMotion()) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    gsap.to(event.currentTarget, { rotateY: x * 12, rotateX: y * -10, transformPerspective: 900, duration: 0.35, ease: 'power2.out', overwrite: 'auto' });
  };

  const resetTilt = (event: PointerEvent<HTMLDivElement>) => {
    gsap.to(event.currentTarget, { rotateY: 0, rotateX: 0, duration: 0.65, ease: 'elastic.out(1, .5)', overwrite: 'auto' });
  };

  const copyClabe = async () => {
    await navigator.clipboard.writeText(clabe);
    notify.success('CLABE copiada', 'La cuenta simulada está en el portapapeles.');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const result = await processPayment({
        amount,
        method,
        cardNumber: card.number,
        cardName: card.name,
        cardExpiry: card.expiry,
        cardCvv: card.cvv,
        transferReference: reference,
        transferConfirmed: confirmed,
      });
      if (!result.success || !result.transactionId) throw new Error(result.error || 'El pago simulado no fue aprobado.');
      notify.success('Pago simulado aprobado', `Transacción ${result.transactionId}`);
      await onSuccess(result.transactionId);
    } catch (requestError) {
      const message = getErrorMessage(requestError, 'No fue posible procesar el pago simulado.');
      setError(message);
      notify.error('Pago rechazado', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" title={method === 'Tarjeta' ? 'Terminal de tarjeta' : 'Transferencia SPEI'} description="El cobro se valida primero; el atleta se registra únicamente después de la aprobación simulada.">
      <form className="checkout-shell" onSubmit={submit} ref={rootRef}>
        <section className="checkout-stage">
          <div className="checkout-stage__copy">
            <p className="eyebrow">Simulates / secure flow</p>
            <h3 className="checkout-heading">{method === 'Tarjeta' ? 'Autoriza el cobro.' : 'Prepara la transferencia.'}</h3>
            <p>{method === 'Tarjeta' ? 'Los datos se validan localmente y nunca se almacenan en Goliat.' : 'Esta cuenta es de demostración. Confirma el movimiento para continuar con el alta.'}</p>
          </div>

          {method === 'Tarjeta' ? (
            <div className="checkout-visual checkout-card" onPointerMove={tilt} onPointerLeave={resetTilt}>
              <header><span>GOLIAT / SIM</span><Radio size={20} /></header>
              <strong>{card.number || '0000 0000 0000 0000'}</strong>
              <footer><span><small>TITULAR</small>{card.name || 'NOMBRE DEL ATLETA'}</span><span><small>VENCE</small>{card.expiry || 'MM/AA'}</span><CreditCard size={27} /></footer>
              <svg viewBox="0 0 360 120" aria-hidden="true"><path className="checkout-scan-path" d="M0 86C55 18 110 112 170 48s112 46 190-24" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
            </div>
          ) : (
            <div className="checkout-visual checkout-transfer" onPointerMove={tilt} onPointerLeave={resetTilt}>
              <span><Building2 size={24} /> SPEI / CUENTA SIMULADA</span>
              <strong>{currency.format(amount)}</strong>
              <dl><div><dt>Banco</dt><dd>{bank}</dd></div><div><dt>CLABE</dt><dd>{clabe}<button type="button" onClick={() => void copyClabe()} aria-label="Copiar CLABE"><Copy size={14} /></button></dd></div><div><dt>Beneficiario</dt><dd>{beneficiary}</dd></div><div><dt>Referencia</dt><dd>{reference}</dd></div></dl>
              <svg viewBox="0 0 360 90" aria-hidden="true"><path className="checkout-scan-path" d="M0 65h70l18-42 31 62 30-45 27 25h184" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
            </div>
          )}
        </section>

        <section className="checkout-form">
          <header data-checkout-step><span><LockKeyhole size={16} /> Canal simulado</span><strong>{currency.format(amount)}</strong></header>
          {method === 'Tarjeta' ? <div className="checkout-fields">
            <label className="field field--wide" data-checkout-step><span>Número de tarjeta</span><input inputMode="numeric" maxLength={19} placeholder="4242 4242 4242 4242" value={card.number} onChange={(event) => { const number = event.target.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim(); setCard((current) => ({ ...current, number })); }} /></label>
            <label className="field field--wide" data-checkout-step><span>Nombre en la tarjeta</span><input value={card.name} placeholder="MAXIMILIANO GONZÁLEZ" onChange={(event) => { const name = event.target.value.toUpperCase(); setCard((current) => ({ ...current, name })); }} /></label>
            <label className="field" data-checkout-step><span>Vigencia</span><input inputMode="numeric" maxLength={5} placeholder="MM/AA" value={card.expiry} onChange={(event) => { const digits = event.target.value.replace(/\D/g, '').slice(0, 4); const expiry = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits; setCard((current) => ({ ...current, expiry })); }} /></label>
            <label className="field" data-checkout-step><span>CVV</span><input type="password" inputMode="numeric" maxLength={4} placeholder="•••" value={card.cvv} onChange={(event) => { const cvv = event.target.value.replace(/\D/g, ''); setCard((current) => ({ ...current, cvv })); }} /></label>
          </div> : <div className="transfer-confirm" data-checkout-step><Smartphone size={24} /><div><strong>Confirma el movimiento</strong><p>En producción este punto se conectaría con el proveedor bancario configurado.</p></div><label><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span><Check size={14} /></span></label></div>}
          <div className="checkout-security" data-checkout-step><ShieldCheck size={17} /><p><strong>Datos efímeros</strong><small>El número, nombre y CVV desaparecen al cerrar esta ventana.</small></p></div>
          {error && <p className="form-error">{error}</p>}
          <div className="form-actions" data-checkout-step><Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" loading={loading}>{method === 'Tarjeta' ? 'Autorizar pago' : 'Confirmar transferencia'}</Button></div>
        </section>
      </form>
    </Modal>
  );
}

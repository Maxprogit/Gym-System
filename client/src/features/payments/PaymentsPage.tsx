import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { FileSearch, Search, WalletCards } from 'lucide-react';
import { api, getErrorMessage } from '../../lib/api';
import { notify } from '../../lib/notify';
import { Draggable, ScrollTrigger, gsap, reduceMotion, selectAll, selectOne, useGSAP } from '../../lib/motion';
import { currency, shortDate } from '../../lib/format';
import type { Payment } from '../../types';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';

const methodCode: Record<string, string> = { Efectivo: 'EF', Tarjeta: 'TC', Transferencia: 'SP' };

export function PaymentsPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const beltViewportRef = useRef<HTMLDivElement>(null);
  const beltTrackRef = useRef<HTMLDivElement>(null);
  const routeRef = useRef<SVGPathElement>(null);
  const routeMarkerRef = useRef<SVGCircleElement>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.get<Payment[]>('/payments')
      .then(({ data }) => active && setPayments(data))
      .catch((error) => notify.error('No pudimos cargar la caja', getErrorMessage(error)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => payments.filter((payment) => `${payment.PaymentID} ${payment.FullName} ${payment.PlanName} ${payment.PaymentMethod}`.toLowerCase().includes(search.toLowerCase())), [payments, search]);
  const metrics = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const thirtyDaysAgo = now.getTime() - 30 * 86_400_000;
    const lifetime = payments.reduce((sum, payment) => sum + Number(payment.Amount), 0);
    const lastThirty = payments.filter((payment) => new Date(payment.PaymentDate).getTime() >= thirtyDaysAgo).reduce((sum, payment) => sum + Number(payment.Amount), 0);
    const today = payments.filter((payment) => new Date(payment.PaymentDate).getTime() >= startToday).reduce((sum, payment) => sum + Number(payment.Amount), 0);
    return { lifetime, lastThirty, today, average: payments.length ? lifetime / payments.length : 0 };
  }, [payments]);
  const visibleTotal = filtered.reduce((sum, payment) => sum + Number(payment.Amount), 0);
  const methods = useMemo(() => ['Efectivo', 'Tarjeta', 'Transferencia'].map((method) => {
    const entries = payments.filter((payment) => payment.PaymentMethod === method);
    return { method, count: entries.length, total: entries.reduce((sum, payment) => sum + Number(payment.Amount), 0) };
  }), [payments]);

  useGSAP(() => {
    const root = rootRef.current;
    if (!root || loading || reduceMotion()) return;
    const reveals = selectAll<HTMLElement>(root, '[data-till-reveal]');
    const digits = selectAll<HTMLElement>(root, '.till-odometer__digits > i');
    const status = selectOne<HTMLElement>(root, '[data-till-status]');
    const timeline = gsap.timeline({ defaults: { ease: 'goliat-in' } });
    timeline
      .from(reveals, { clipPath: 'inset(0 0 100% 0)', y: 45, autoAlpha: 0, duration: .86, stagger: .12 })
      .from(digits, { yPercent: 130, rotateX: -80, autoAlpha: 0, duration: .72, stagger: .045, ease: 'back.out(1.5)' }, '-=.55');
    if (status) timeline.to(status, { duration: .9, scrambleText: { text: 'CAJA ABIERTA', chars: '01/$', speed: .72 } }, '-=.6');

    const path = routeRef.current;
    const marker = routeMarkerRef.current;
    if (path) timeline.from(path, { drawSVG: '0%', duration: 1.4, ease: 'power3.inOut' }, '-=.75');
    if (path && marker) gsap.to(marker, { motionPath: { path, align: path, alignOrigin: [.5, .5] }, duration: 6, repeat: -1, ease: 'none' });

    selectAll<HTMLElement>(root, '[data-till-counter]').forEach((element) => {
      const counter = { value: 0 };
      gsap.to(counter, {
        value: Number(element.dataset.value || 0), duration: 1.45, ease: 'expo.out',
        onUpdate: () => { element.textContent = currency.format(Math.round(counter.value)); },
      });
    });
  }, { dependencies: [loading, payments.length], revertOnUpdate: true });

  useGSAP(() => {
    const viewport = beltViewportRef.current;
    const track = beltTrackRef.current;
    if (!viewport || !track || reduceMotion() || track.scrollWidth <= viewport.clientWidth + 2) return;
    const instances = Draggable.create(track, {
      type: 'x', bounds: viewport, inertia: true, edgeResistance: .86,
      cursor: 'grab', activeCursor: 'grabbing', allowNativeTouchScrolling: true,
      snap: (value) => Math.round(value / 154) * 154,
    });
    return () => instances.forEach((instance) => instance.kill());
  }, { dependencies: [payments.length], revertOnUpdate: true });

  useGSAP(() => {
    const root = rootRef.current;
    if (!root || loading || reduceMotion()) return;
    const rows = selectAll<HTMLElement>(root, '.till-journal__rows > article');
    if (!rows.length) return;
    ScrollTrigger.batch(rows, {
      start: 'top 94%', once: true,
      onEnter: (batch) => gsap.fromTo(batch, { autoAlpha: 0, x: 32 }, { autoAlpha: 1, x: 0, duration: .62, stagger: .035, ease: 'expo.out' }),
    });
  }, { dependencies: [filtered.length, loading], revertOnUpdate: true });

  return (
    <div className="till-page" ref={rootRef}>
      {loading ? <Skeleton className="h-96" /> : (
        <section className="till-machine">
          <header className="till-machine__head" data-till-reveal>
            <div><span>GOLIAT / CAJA</span><h1>Caja</h1></div>
            <p><i /><strong data-till-status>INICIANDO</strong></p>
            <time>{new Date().toLocaleDateString('es-MX')}</time>
          </header>

          <div className="till-machine__body">
            <section className="till-odometer" data-till-reveal>
              <span>ACUMULADO</span>
              <CashDigits value={metrics.lifetime} />
              <small>{payments.length} movimientos</small>
              <dl>
                <div><dt>30 días</dt><dd data-till-counter data-value={metrics.lastThirty}>$0</dd></div>
                <div><dt>Hoy</dt><dd data-till-counter data-value={metrics.today}>$0</dd></div>
                <div><dt>Promedio</dt><dd data-till-counter data-value={metrics.average}>$0</dd></div>
              </dl>
              <svg viewBox="0 0 620 112" aria-hidden="true"><path ref={routeRef} d="M16 70C92 15 158 100 236 51S388 17 461 64s101 29 143-25" /><circle ref={routeMarkerRef} r="7" /></svg>
            </section>

            <section className="till-belt" data-till-reveal>
              <header><span>ÚLTIMOS COBROS</span><small>Arrastra la banda</small></header>
              <div className="till-belt__viewport" ref={beltViewportRef}>
                <div className="till-belt__track" ref={beltTrackRef}>
                  {payments.slice(0, 10).map((payment, index) => (
                    <article key={payment.PaymentID}>
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <b>{methodCode[payment.PaymentMethod] || 'MX'}</b>
                      <strong>{currency.format(Number(payment.Amount))}</strong>
                      <p>{payment.FullName || 'Registro histórico'}</p>
                      <time>{shortDate(payment.PaymentDate)}</time>
                    </article>
                  ))}
                </div>
              </div>
              <div className="till-methods">
                {methods.map((item) => {
                  const share = payments.length ? item.count / payments.length : 0;
                  return <article key={item.method} style={{ '--share': share } as CSSProperties}><span>{item.method}</span><strong>{item.count}</strong><small>{currency.format(item.total)}</small><i><b /></i></article>;
                })}
              </div>
            </section>
          </div>
        </section>
      )}

      <section className="till-query" data-till-reveal>
        <div><span>VISIBLE</span><strong>{currency.format(visibleTotal)}</strong><small>{filtered.length} / {payments.length}</small></div>
        <label><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Recibo, atleta, plan o método" /></label>
      </section>

      {!loading && (filtered.length ? (
        <section className="till-journal" data-till-reveal>
          <header><span>REGISTRO</span><h2>Movimientos</h2><small>Más reciente</small></header>
          <div className="till-journal__rows">{filtered.map((payment, index) => (
            <article key={payment.PaymentID}>
              <span className="till-journal__index">{String(index + 1).padStart(2, '0')}</span>
              <b className="till-journal__method">{methodCode[payment.PaymentMethod] || 'MX'}</b>
              <span className="till-journal__folio">#{String(payment.PaymentID).padStart(6, '0')}</span>
              <div><strong>{payment.FullName || 'Registro histórico'}</strong><small>{payment.PlanName || 'Membresía'} · {payment.PaymentMethod}</small></div>
              <time>{shortDate(payment.PaymentDate)}</time>
              <strong className="till-journal__amount">+{currency.format(Number(payment.Amount))}</strong>
            </article>
          ))}</div>
        </section>
      ) : <EmptyState icon={search ? FileSearch : WalletCards} title="Sin movimientos" description={search ? 'No hay coincidencias.' : 'Los pagos aparecerán aquí.'} />)}
    </div>
  );
}

function CashDigits({ value }: { value: number }) {
  return <strong className="till-odometer__digits" aria-label={currency.format(value)}>{currency.format(Math.round(value)).split('').map((character, index) => <i key={`${character}-${index}`} className={/\d/.test(character) ? '' : 'is-symbol'}>{character}</i>)}</strong>;
}

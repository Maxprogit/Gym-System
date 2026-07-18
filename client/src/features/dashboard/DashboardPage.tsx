import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowUpRight, CalendarClock, Radio, ReceiptText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Skeleton } from '../../components/ui/Skeleton';
import { api, getErrorMessage } from '../../lib/api';
import { currency, monthLabel } from '../../lib/format';
import { Draggable, Observer, SplitText, gsap, reduceMotion, selectAll, selectOne, useGSAP } from '../../lib/motion';
import { notify } from '../../lib/notify';
import type { DashboardStats } from '../../types';

type RevenuePoint = { key: string; label: string; total: number };

const completeHistory = (source: DashboardStats['revenueHistory'] = []): RevenuePoint[] => {
  const totals = new Map(source.map((item) => [item.MonthKey, Number(item.Total)]));
  return Array.from({ length: 6 }, (_, offset) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (5 - offset));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return { key, label: monthLabel(key), total: totals.get(key) || 0 };
  });
};

export function DashboardPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const circuitPathRef = useRef<SVGPathElement>(null);
  const circuitMarkerRef = useRef<SVGGElement>(null);
  const circuitGlowRef = useRef<HTMLDivElement>(null);
  const tickerTrackRef = useRef<HTMLDivElement>(null);
  const historyViewportRef = useRef<HTMLDivElement>(null);
  const historyTrackRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.get<DashboardStats>('/dashboard/stats')
      .then(({ data }) => active && setStats(data))
      .catch((requestError) => {
        if (!active) return;
        const message = getErrorMessage(requestError, 'No pudimos cargar Control');
        setError(message);
        notify.error('Control sin datos', message);
      });
    return () => { active = false; };
  }, []);

  const history = useMemo(() => completeHistory(stats?.revenueHistory), [stats]);
  const maximumRevenue = Math.max(...history.map((point) => point.total), 1);
  const ticker = stats
    ? `HOY ${currency.format(stats.todayRevenue)} · MES ${currency.format(stats.monthlyRevenue)} · HISTÓRICO ${currency.format(stats.lifetimeRevenue)} · ${stats.paymentsCount} COBROS · `
    : 'SINCRONIZANDO DATOS · ';

  useGSAP(() => {
    const root = rootRef.current;
    const title = titleRef.current;
    if (!root || !title || reduceMotion()) return;

    const split = SplitText.create(title, { type: 'chars', aria: 'auto' });
    const reveals = selectAll<HTMLElement>(root, '[data-command-reveal]');
    const drawables = selectAll<SVGGeometryElement>(root, '[data-command-draw]');
    const status = selectOne<HTMLElement>(root, '[data-command-status]');
    const faders = selectAll<HTMLElement>(root, '.command-month__level b');
    const timeline = gsap.timeline({ defaults: { ease: 'goliat-in' } });

    if (split.chars.length) {
      timeline.from(split.chars, {
        yPercent: 120,
        rotateX: -70,
        autoAlpha: 0,
        duration: .72,
        stagger: .035,
      });
    }
    if (reveals.length) {
      timeline.from(reveals, {
        clipPath: 'inset(0 100% 0 0)',
        x: -30,
        autoAlpha: 0,
        duration: .82,
        stagger: .09,
      }, '-=.48');
    }
    if (drawables.length) {
      timeline.from(drawables, {
        drawSVG: '0%',
        duration: 1.35,
        stagger: .1,
        ease: 'power3.inOut',
      }, '-=.72');
    }
    if (faders.length) {
      timeline.from(faders, {
        scaleY: 0,
        transformOrigin: '50% 100%',
        duration: .9,
        stagger: .075,
        ease: 'expo.out',
      }, '-=.9');
    }
    if (status) {
      timeline.to(status, {
        duration: .9,
        scrambleText: { text: 'OPERACIÓN ESTABLE', chars: '01/GOLIAT', speed: .72 },
      }, '-=.7');
    }

    const path = circuitPathRef.current;
    const marker = circuitMarkerRef.current;
    if (path && marker) {
      gsap.to(marker, {
        motionPath: { path, align: path, alignOrigin: [.5, .5], autoRotate: true },
        duration: 8.5,
        repeat: -1,
        ease: 'none',
      });
    }

    const tickerTrack = tickerTrackRef.current;
    if (tickerTrack) {
      gsap.to(tickerTrack, { xPercent: -50, duration: 17, repeat: -1, ease: 'none' });
    }

    const glow = circuitGlowRef.current;
    const observer = glow ? Observer.create({
      target: root,
      type: 'pointer,touch',
      onMove: (self) => gsap.to(glow, {
        x: Math.max(-180, Math.min(180, self.deltaX * 1.8)),
        y: Math.max(-90, Math.min(90, self.deltaY * 1.4)),
        duration: 1.2,
        ease: 'power3.out',
        overwrite: 'auto',
      }),
    }) : null;

    return () => {
      observer?.kill();
      split.revert();
    };
  }, { dependencies: [Boolean(stats)], revertOnUpdate: true });

  useGSAP(() => {
    const root = rootRef.current;
    if (!root || !stats || reduceMotion()) return;
    const counters = selectAll<HTMLElement>(root, '[data-command-counter]');
    if (!counters.length) return;

    counters.forEach((element) => {
      const target = Number(element.dataset.value || 0);
      const counter = { value: 0 };
      gsap.to(counter, {
        value: target,
        duration: 1.45,
        ease: 'expo.out',
        onUpdate: () => {
          element.textContent = element.dataset.currency === 'true'
            ? currency.format(Math.round(counter.value))
            : Math.round(counter.value).toLocaleString('es-MX');
        },
      });
    });
  }, { dependencies: [stats], revertOnUpdate: true });

  useGSAP(() => {
    const viewport = historyViewportRef.current;
    const track = historyTrackRef.current;
    if (!viewport || !track || reduceMotion() || track.scrollWidth <= viewport.clientWidth + 2) return;
    const instances = Draggable.create(track, {
      type: 'x',
      bounds: viewport,
      inertia: true,
      edgeResistance: .88,
      cursor: 'grab',
      activeCursor: 'grabbing',
      allowNativeTouchScrolling: true,
      snap: (value) => Math.round(value / 164) * 164,
    });
    return () => instances.forEach((instance) => instance.kill());
  }, { dependencies: [history.length], revertOnUpdate: true });

  return (
    <div className="command-control" ref={rootRef}>
      {error && <div className="notice notice--error">{error}</div>}
      <section className="command-deck">
        <header className="command-deck__head" data-command-reveal>
          <div><span>GOLIAT / CONTROL</span><h1 ref={titleRef}>Control de piso</h1></div>
          <p><i /><strong data-command-status>SINCRONIZANDO</strong></p>
          <time>{new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date())}</time>
        </header>

        <section className="command-live" data-command-reveal>
          <div className="command-live__glow" ref={circuitGlowRef} aria-hidden="true" />
          <div className="command-primary">
            <span>MEMBRESÍAS HABILITADAS</span>
            {stats ? <strong data-command-counter data-value={stats.activeMembers}>0</strong> : <Skeleton className="h-24 w-40" />}
            <p>ACCESOS<br />LISTOS</p>
            <Link to="/members">Gestionar atletas <ArrowUpRight size={17} /></Link>
          </div>

          <div className="command-circuit">
            <header><span>FLUJO / HOY</span><small>{stats?.paymentsCount ?? '—'} MOVIMIENTOS</small></header>
            <svg viewBox="0 0 760 320" aria-hidden="true">
              <path className="command-circuit__ghost" d="M40 244H152V78h176v154h148V62h244" />
              <path ref={circuitPathRef} data-command-draw d="M40 244H152V78h176v154h148V62h244" />
              <path data-command-draw d="M40 278h248M378 278h342M75 36h202M370 36h294" />
              <circle cx="152" cy="78" r="9" />
              <circle cx="328" cy="232" r="9" />
              <circle cx="476" cy="62" r="9" />
              <g ref={circuitMarkerRef} className="command-circuit__marker"><circle r="12" /><path d="M-4 0h8M0-4v8" /></g>
            </svg>
            <div className="command-circuit__value">
              <span>COBRADO HOY</span>
              {stats ? <strong data-command-counter data-value={stats.todayRevenue} data-currency="true">$0</strong> : <b>—</b>}
              <small>Registro financiero confirmado</small>
            </div>
          </div>
        </section>

        <dl className="command-snapshot" data-command-reveal>
          <Readout index="01" label="Histórico" value={stats?.lifetimeRevenue} currencyValue />
          <Readout index="02" label="Por vencer" value={stats?.expiringSoon} />
          <Readout index="03" label="Mes actual" value={stats?.monthlyRevenue} currencyValue />
          <Readout index="04" label="Ticket promedio" value={stats?.averageTicket} currencyValue />
        </dl>

        <div className="command-ticker" data-command-reveal aria-label={ticker}>
          <div ref={tickerTrackRef}><span>{ticker}</span><span aria-hidden="true">{ticker}</span></div>
        </div>

        <section className="command-history" data-command-reveal>
          <header>
            <div><span>RITMO FINANCIERO</span><h2>Seis meses</h2></div>
            <p><strong>{stats ? currency.format(stats.monthlyRevenue) : '—'}</strong><small>MES ACTUAL</small></p>
          </header>
          <div className="command-history__viewport" ref={historyViewportRef}>
            <div className="command-history__track" ref={historyTrackRef}>
              {history.map((point, index) => (
                <article className="command-month" key={point.key} style={{ '--level': Math.max(.08, point.total / maximumRevenue) } as CSSProperties}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <b>{point.label}</b>
                  <strong>{currency.format(point.total)}</strong>
                  <i className="command-month__level"><b /></i>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="command-agenda" data-command-reveal>
          <header><CalendarClock size={20} /><span>PRÓXIMA ACCIÓN</span><h2>Renovaciones</h2><Link to="/members">Abrir directorio <ArrowUpRight size={16} /></Link></header>
          <div>
            {!stats ? <Skeleton className="h-28" /> : stats.expiringList.length ? stats.expiringList.slice(0, 4).map((member, index) => (
              <Link to="/members" key={member.MemberID}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <p><strong>{member.FullName}</strong><small>{member.PlanName || 'Sin plan'}</small></p>
                <b>{member.DaysLeft}D</b>
              </Link>
            )) : <p className="command-agenda__empty">Sin vencimientos próximos</p>}
          </div>
        </section>

        <footer className="command-deck__foot" data-command-reveal>
          <Radio size={16} /><span>SERVIDOR SINCRONIZADO</span><ReceiptText size={16} /><span>{stats ? `${stats.paymentsCount} COBROS REGISTRADOS` : 'CARGANDO REGISTROS'}</span>
        </footer>
      </section>
    </div>
  );
}

function Readout({ index, label, value, currencyValue = false }: { index: string; label: string; value: number | undefined; currencyValue?: boolean }) {
  return (
    <div>
      <span>{index}</span>
      <dt>{label}</dt>
      <dd>{value === undefined ? '—' : <b data-command-counter data-value={value} data-currency={currencyValue}>0</b>}</dd>
    </div>
  );
}

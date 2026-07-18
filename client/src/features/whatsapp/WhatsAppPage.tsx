import { useEffect, useRef, useState } from 'react';
import { Check, Link2, LoaderCircle, LogOut, MessageCircle, QrCode, RadioTower, RefreshCw, Server, ShieldCheck, Smartphone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { io } from 'socket.io-client';
import { api, SOCKET_ORIGIN } from '../../lib/api';
import { notify } from '../../lib/notify';
import { Observer, SplitText, gsap, reduceMotion, selectAll, selectOne, useGSAP } from '../../lib/motion';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../stores/authStore';

interface WhatsAppState {
  status: 'disabled' | 'starting' | 'awaiting_qr' | 'connected' | 'disconnected' | 'error';
  qr?: string | null;
  enabled?: boolean;
}

const stateCopy: Record<WhatsAppState['status'], { label: string; title: string; detail: string }> = {
  disabled: { label: 'Fuera de servicio', title: 'WhatsApp está desactivado', detail: 'Activa ENABLE_WHATSAPP en el entorno existente del servidor para iniciar el canal.' },
  starting: { label: 'Iniciando motor', title: 'Preparando un canal seguro', detail: 'El servidor está restaurando la sesión o solicitando un código nuevo.' },
  awaiting_qr: { label: 'Escaneo requerido', title: 'Vincula el teléfono del gimnasio', detail: 'En WhatsApp abre Dispositivos vinculados, toca Vincular dispositivo y escanea el código.' },
  connected: { label: 'Canal en línea', title: 'Canal verificado', detail: '' },
  disconnected: { label: 'Sin sesión', title: 'El canal está desvinculado', detail: 'Inicia una sesión nueva para generar otro código QR.' },
  error: { label: 'Recuperando canal', title: 'WhatsApp Web no respondió', detail: 'Goliat reintentará automáticamente; también puedes forzar un nuevo intento.' },
};

export function WhatsAppPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const token = useAuthStore((store) => store.token);
  const [state, setState] = useState<WhatsAppState>({ status: 'starting', qr: null, enabled: true });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    api.get<WhatsAppState>('/whatsapp/status').then(async (statusResponse) => {
      if (!active) return;
      const next = statusResponse.data;
      setState(next);
      if (next.enabled !== false && (next.status === 'disconnected' || next.status === 'error')) {
        const response = await api.post<WhatsAppState>('/whatsapp/initialize');
        if (active) setState(response.data);
      }
    }).catch(() => active && setState({ status: 'error', enabled: true }));

    const socket = io(SOCKET_ORIGIN, { auth: { token } });
    socket.on('whatsapp_status', (next: WhatsAppState | WhatsAppState['status']) => setState((current) => ({ ...current, ...(typeof next === 'string' ? { status: next } : next) })));
    socket.on('qr_code', (qr: string) => setState((current) => ({ ...current, status: 'awaiting_qr', qr, enabled: true })));
    socket.emit('get_status');
    return () => { active = false; socket.disconnect(); };
  }, [token]);

  const initialize = async () => {
    setLoading(true);
    try {
      const { data } = await notify.promise(api.post<WhatsAppState>('/whatsapp/initialize'), {
        loading: 'Preparando WhatsApp Web', success: 'Conexión iniciada', error: 'No pudimos iniciar WhatsApp',
      });
      setState(data);
    } catch (_error) {
      setState((current) => ({ ...current, status: 'error' }));
    } finally { setLoading(false); }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await notify.promise(api.post('/whatsapp/logout'), { loading: 'Desvinculando sesión', success: 'WhatsApp desvinculado', error: 'No pudimos desvincular WhatsApp' });
      setState((current) => ({ ...current, status: 'disconnected', qr: null }));
    } catch (_error) {
      setState((current) => ({ ...current, status: 'error' }));
    } finally { setLoading(false); }
  };

  const copy = stateCopy[state.status];

  useGSAP(() => {
    const root = rootRef.current;
    if (!root || reduceMotion()) return;
    const workbench = selectOne<HTMLElement>(root, '.wa-workbench');
    const title = selectOne<HTMLElement>(root, '[data-wa-title]');
    const panels = selectAll<HTMLElement>(root, '[data-wa-reveal]');
    const flash = selectOne<HTMLElement>(root, '.wa-link-flash');
    if (!workbench || !title) return;
    const split = SplitText.create(title, { type: 'lines,words', mask: 'lines', aria: 'auto' });
    const timeline = gsap.timeline({ defaults: { ease: 'goliat-in' } });
    if (state.status === 'connected' && flash) {
      gsap.timeline().fromTo(flash, { scaleY: 0, transformOrigin: 'bottom' }, { scaleY: 1, duration: .32, ease: 'power4.in' }).to(flash, { scaleY: 0, transformOrigin: 'top', duration: .46, ease: 'power4.out' });
    }
    timeline
      .fromTo(split.words, { yPercent: 130, rotateX: -28, autoAlpha: 0 }, { yPercent: 0, rotateX: 0, autoAlpha: 1, duration: .75, stagger: .04 })
      .fromTo(panels, { y: 35, rotateX: -6, autoAlpha: 0 }, { y: 0, rotateX: 0, autoAlpha: 1, duration: .62, stagger: .06, clearProps: 'transform,opacity,visibility' }, '-=.52');
    if (state.status === 'connected') {
      const checkPaths = selectAll<SVGGeometryElement>(root, '.wa-verify-seal [data-draw]');
      const label = selectOne<HTMLElement>(root, '[data-wa-verify-status]');
      if (checkPaths.length) timeline.from(checkPaths, { drawSVG: '0%', duration: .9, stagger: .13 }, '-=.5');
      if (label) timeline.to(label, { duration: 1, scrambleText: { text: 'CANAL / 3 DE 3', chars: '01/WA', speed: .7 } }, '-=.75');
    }
    if (state.status === 'awaiting_qr') {
      const qr = selectOne<HTMLElement>(root, '.wa-qr');
      const frame = selectOne<HTMLElement>(root, '.wa-qr > i');
      if (qr) timeline.fromTo(qr, { rotateY: -28, z: -160, scale: .82, autoAlpha: 0, transformPerspective: 1000 }, { rotateY: 0, z: 0, scale: 1, autoAlpha: 1, duration: .78, clearProps: 'transform,opacity,visibility' }, '-=.42');
      if (frame) gsap.fromTo(frame, { clipPath: 'polygon(0 0, 0 0, 0 0, 0 0)' }, { clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)', duration: 1.1, ease: 'power3.inOut', clearProps: 'clipPath' });
    }
    const channel = selectOne<HTMLElement>(root, '.wa-verification-board');
    const observer = channel ? Observer.create({ target: channel, type: 'pointer,touch', onMove: (self) => gsap.to(channel, { rotateY: self.deltaX * .025, rotateX: self.deltaY * -.018, transformPerspective: 1300, duration: 1.1, ease: 'power3.out', overwrite: 'auto' }) }) : null;
    return () => { split.revert(); observer?.kill(); };
  }, { dependencies: [state.status, state.qr], revertOnUpdate: true });

  return (
    <div ref={rootRef}>
      <PageHeader eyebrow="CHANNEL" title="WhatsApp" />
      <section className={`wa-workbench wa-workbench--${state.status}`}>
        <div className="wa-link-flash" aria-hidden="true" />
        {state.status === 'connected' ? (
          <article className="wa-verification-board" data-wa-reveal>
            <header><span>WA / SESSION 01</span><span className="wa-state"><i />{copy.label}</span></header>
            <div className="wa-verification-board__hero">
              <svg className="wa-verify-seal" viewBox="0 0 160 160" aria-hidden="true"><circle data-draw cx="80" cy="80" r="67" fill="none" stroke="currentColor" strokeWidth="2" /><circle data-draw cx="80" cy="80" r="50" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 8" /><path data-draw d="m48 82 20 20 45-49" fill="none" stroke="currentColor" strokeWidth="7" /></svg>
              <div><span data-wa-verify-status>VERIFICANDO</span><h2 data-wa-title>{copy.title}</h2>{copy.detail && <p>{copy.detail}</p>}</div>
            </div>
            <div className="wa-checkpoint-line">
              <VerificationStep index="01" icon={Server} title="Servidor" detail="Motor iniciado y disponible" />
              <VerificationStep index="02" icon={Link2} title="Vinculación" detail="Sesión restaurable con LocalAuth" />
              <VerificationStep index="03" icon={RadioTower} title="Canal" detail="Mensajería lista para operar" />
            </div>
            <footer><p><ShieldCheck size={17} /><span><strong>3 / 3 verificaciones</strong></span></p><Button variant="secondary" loading={loading} icon={<LogOut size={16} />} onClick={logout}>Desvincular</Button></footer>
          </article>
        ) : (<>
        <article className="wa-session">
          <header><span>WA / SESSION 01</span><span className="wa-state"><i />{copy.label}</span></header>
          <div className="wa-session__copy" data-wa-reveal><small>Estado actual</small><h2 data-wa-title key={state.status}>{copy.title}</h2>{copy.detail && <p>{copy.detail}</p>}</div>
          <div className="wa-session__steps" data-wa-reveal>
            <span className={state.status !== 'disabled' ? 'is-done' : ''}><b>01</b><p><strong>Servidor</strong><small>Motor iniciado automáticamente</small></p><Check size={15} /></span>
            <span className={state.status === 'awaiting_qr' ? 'is-done' : ''}><b>02</b><p><strong>Dispositivo</strong><small>Vinculación por código QR</small></p><Check size={15} /></span>
            <span><b>03</b><p><strong>Canal</strong><small>Mensajería lista para operar</small></p><Check size={15} /></span>
          </div>
          <footer data-wa-reveal><Button loading={loading} disabled={state.status === 'disabled'} icon={<RefreshCw size={16} />} onClick={initialize}>Reintentar conexión</Button></footer>
        </article>

        <article className="wa-device">
          <header><Smartphone size={17} /><span>Dispositivo por vincular</span><small>cifrado de extremo a extremo</small></header>
          <div className="wa-qr-stage" data-wa-reveal>
              {state.qr && state.status === 'awaiting_qr' ? <div className="wa-qr"><i /><QRCodeSVG value={state.qr} size={250} level="M" /><small><ShieldCheck size={15} /> QR temporal</small></div> : <div className="wa-waiting"><span><QrCode size={70} strokeWidth={1.1} />{state.status === 'starting' && <LoaderCircle size={25} className="animate-spin" />}</span><strong>Esperando código</strong><small>La restauración o generación puede tardar algunos segundos.</small></div>}
          </div>
        </article>
        </>)}
      </section>

      {state.status !== 'connected' && <section className="wa-capabilities"><div data-wa-reveal><span>08:00</span><p><strong>Renovaciones</strong><small>Aviso automático tres días antes.</small></p></div><div data-wa-reveal><span>PDF</span><p><strong>Coach IA</strong><small>Entrega directa del plan terminado.</small></p></div><div data-wa-reveal><span>LIVE</span><p><strong>Estado real</strong><small>QR y conexión actualizados por socket.</small></p></div><div data-wa-reveal><MessageCircle size={19} /><p><strong>Un solo canal</strong><small>Sesión persistente sin pasos repetidos.</small></p></div></section>}
    </div>
  );
}

function VerificationStep({ index, icon: Icon, title, detail }: { index: string; icon: typeof Server; title: string; detail: string }) {
  return <article data-wa-reveal><header><span>{index}</span><Check size={15} /></header><Icon size={22} /><p><strong>{title}</strong><small>{detail}</small></p><i /></article>;
}

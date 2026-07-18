import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Activity, ArrowUpRight, Fingerprint, KeyRound, Radio, UserRound } from 'lucide-react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api, getErrorMessage } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import type { User } from '../../types';
import { Button } from '../../components/ui/Button';
import { Observer, SplitText, gsap, reduceMotion, selectAll, selectOne, useGSAP } from '../../lib/motion';
import { notify } from '../../lib/notify';

type ServerState = 'checking' | 'online' | 'degraded' | 'offline';

export function LoginPage() {
  const rootRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const trajectoryRef = useRef<SVGPathElement>(null);
  const runnerRef = useRef<SVGGElement>(null);
  const token = useAuthStore((state) => state.token);
  const setSession = useAuthStore((state) => state.setSession);
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverState, setServerState] = useState<ServerState>('checking');

  useEffect(() => {
    let active = true;
    api.get<{ sqlServer: string }>('/healthz')
      .then(({ data }) => active && setServerState(data.sqlServer === 'connected' ? 'online' : 'degraded'))
      .catch(() => active && setServerState('offline'));
    return () => { active = false; };
  }, []);

  useGSAP(() => {
    const root = rootRef.current;
    const title = titleRef.current;
    const trajectory = trajectoryRef.current;
    const runner = runnerRef.current;
    if (!root || !title || reduceMotion()) return;
    const split = SplitText.create(title, { type: 'lines,words', mask: 'lines', aria: 'auto' });
    const brand = selectOne<HTMLElement>(root, '.portal-brand');
    const consolePanel = selectOne<HTMLElement>(root, '.portal-console');
    const labels = selectAll<HTMLElement>(root, '[data-portal-reveal]');
    const systemCopy = selectOne<HTMLElement>(root, '[data-portal-system]');
    const layers = selectAll<HTMLElement>(root, '[data-depth]');

    const timeline = gsap.timeline({ defaults: { ease: 'goliat-in' } });
    timeline
      .from(brand, { x: -35, rotate: -9, autoAlpha: 0, duration: 0.8 })
      .from(split.words, { yPercent: 132, rotateX: -45, rotateZ: 2, transformOrigin: '50% 100%', autoAlpha: 0, duration: 1.12, stagger: 0.06 }, '-=.42')
      .from(labels, { y: 38, autoAlpha: 0, duration: 0.68, stagger: 0.08 }, '-=.64')
      .from(consolePanel, { xPercent: 112, rotateY: -18, transformPerspective: 1300, clipPath: 'inset(0 0 0 100%)', autoAlpha: 0, duration: 1.15 }, '-=.94');
    if (systemCopy) timeline.to(systemCopy, { duration: 1.25, scrambleText: { text: 'FIELD SYSTEM / READY', chars: 'XO01/', speed: .65 } }, '-=.88');
    if (trajectory && runner) {
      timeline.from(trajectory, { drawSVG: '0%', duration: 1.65, ease: 'power3.inOut' }, '-=1.1');
      gsap.to(runner, { motionPath: { path: trajectory, align: trajectory, alignOrigin: [0.5, 0.5], autoRotate: true }, duration: 11, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    }

    const quick = layers.map((layer) => ({ x: gsap.quickTo(layer, 'x', { duration: 1.5, ease: 'power3.out' }), y: gsap.quickTo(layer, 'y', { duration: 1.5, ease: 'power3.out' }), depth: Number(layer.dataset.depth || 1) }));
    const observer = Observer.create({ target: root, type: 'pointer,touch', onMove: (self) => quick.forEach((layer) => { layer.x(self.deltaX * layer.depth * .12); layer.y(self.deltaY * layer.depth * .12); }) });
    return () => { split.revert(); observer.kill(); };
  }, { revertOnUpdate: true });

  useGSAP(() => {
    const root = rootRef.current;
    const label = selectOne<HTMLElement>(root, '[data-server-label]');
    if (!label || reduceMotion()) return;
    const stateLabel = { checking: 'BUSCANDO SERVIDOR', online: 'SISTEMA DISPONIBLE', degraded: 'SERVIDOR / REVISAR .ENV', offline: 'SERVIDOR SIN CONEXIÓN' }[serverState];
    gsap.to(label, { duration: .8, scrambleText: { text: stateLabel, chars: '01/_', speed: .8 } });
  }, { dependencies: [serverState], revertOnUpdate: true });

  if (token) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (form.username.trim().length < 3 || !form.password) {
      setError('Ingresa tu usuario y contraseña.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post<{ token: string; user: User }>('/login', form);
      setSession(data.token, data.user);
      navigate((location.state as { from?: string } | null)?.from || '/', { replace: true });
    } catch (requestError) {
      const message = getErrorMessage(requestError, 'No pudimos iniciar sesión');
      setError(message);
      notify.error('Acceso rechazado', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="portal" ref={rootRef}>
      <div className="portal-noise" aria-hidden="true" />
      <header className="portal-topline" data-portal-reveal><div className="portal-brand"><span>G</span><strong>GOLIAT<br /><small>GYM COMMAND</small></strong></div><div><span data-portal-system>BOOT / 000</span><b>MX / {new Date().getFullYear()}</b></div></header>

      <section className="portal-stage">
        <div className="portal-copy">
          <p data-portal-reveal><Radio size={14} /> Goliat System</p>
          <h1 ref={titleRef}>Donde el<br />esfuerzo se<br /><em>vuelve señal.</em></h1>
          <div className="portal-manifest" data-portal-reveal><span>Administración</span><p>Atletas · Caja · Atlas · Coach · WhatsApp</p></div>
        </div>

        <div className="portal-kinetic" data-depth="1.2" aria-hidden="true">
          <svg viewBox="0 0 880 720">
            <defs><filter id="portal-glow"><feGaussianBlur stdDeviation="7" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
            <circle className="portal-ring portal-ring--a" cx="440" cy="360" r="274" />
            <circle className="portal-ring portal-ring--b" cx="440" cy="360" r="205" />
            <path ref={trajectoryRef} className="portal-trajectory" d="M72 544C181 531 173 193 378 219S555 597 808 153" />
            <g ref={runnerRef} className="portal-runner"><circle r="17" /><path d="M-7 0h14M0-7v14" /></g>
            <path className="portal-pulse" d="M239 371h73l22-48 35 94 47-143 44 97h85" />
            <text x="440" y="438">G / ACTIVE FIELD</text>
          </svg>
        </div>
        <div className="portal-coordinate portal-coordinate--a" data-depth=".5">LAT 20.5234 / LNG -100.814</div>
        <div className="portal-coordinate portal-coordinate--b" data-depth=".8">1324 MOVEMENTS / 09 LANG</div>
      </section>

      <aside className="portal-console">
        <header><span><Fingerprint size={17} /> Operator gate</span><b>01</b></header>
        <form onSubmit={submit}>
          <div className={`portal-server portal-server--${serverState}`}><i /><span data-server-label>BUSCANDO SERVIDOR</span></div>
          <div className="portal-console__title"><p>Acceso administrativo</p><h2>Entra al<br />campo.</h2></div>
          <label><span>01 / Usuario</span><div><UserRound size={17} /><input autoFocus autoComplete="username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="Tu usuario" /></div></label>
          <label><span>02 / Contraseña</span><div><KeyRound size={17} /><input type="password" autoComplete="current-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="••••••••" /></div></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button type="submit" loading={loading} icon={<ArrowUpRight size={18} />} className="portal-submit">Iniciar operación</Button>
        </form>
        <footer><Activity size={15} /><span>La sesión permanece local en este navegador.</span></footer>
      </aside>
    </main>
  );
}

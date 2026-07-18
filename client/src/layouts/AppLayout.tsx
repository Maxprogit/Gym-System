import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Activity, BarChart3, BookOpen, CreditCard, LogOut, MessageCircle, Users } from 'lucide-react';
import { io } from 'socket.io-client';
import { cn } from '../lib/cn';
import { SOCKET_ORIGIN } from '../lib/api';
import { notify } from '../lib/notify';
import { gsap, reduceMotion, selectAll, selectOne, useGSAP } from '../lib/motion';
import { useAuthStore } from '../stores/authStore';

const navigation = [
  { to: '/', label: 'Control', icon: BarChart3 },
  { to: '/members', label: 'Atletas', icon: Users },
  { to: '/exercises', label: 'Biblioteca', icon: BookOpen },
  { to: '/payments', label: 'Caja', icon: CreditCard },
  { to: '/whatsapp', label: 'WhatsApp', icon: MessageCircle },
];

export function AppLayout() {
  const shellRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const currentModule = navigation.find((item) => item.to === location.pathname)?.label || 'Goliat';

  useEffect(() => {
    const socket = io(SOCKET_ORIGIN, { auth: { token } });
    socket.on('expiring_alert', ({ name, daysLeft }: { name: string; daysLeft: number }) => {
      notify.warning('Renovación próxima', `${name} tiene ${daysLeft} día${daysLeft === 1 ? '' : 's'} para renovar`);
    });
    return () => {
      socket.disconnect();
    };
  }, [token]);

  useGSAP(() => {
    const root = shellRef.current;
    if (!root || reduceMotion()) return;
    const brand = selectOne<HTMLElement>(root, '.brand-mark');
    const introductions = selectAll<HTMLElement>(root, '[data-shell-intro]');
    const commandItems = selectAll<HTMLElement>(root, '.command-bar > div');
    const timeline = gsap.timeline({ defaults: { ease: 'expo.out' } });
    if (brand) timeline.from(brand, { rotate: -180, scale: 0, duration: 0.8 });
    if (introductions.length) timeline.from(introductions, { autoAlpha: 0, x: -34, duration: 0.65, stagger: 0.07 }, '-=.5');
    if (commandItems.length) timeline.from(commandItems, { autoAlpha: 0, y: -16, duration: 0.5, stagger: 0.08 }, '-=.35');
  });

  useGSAP(() => {
    const root = pageRef.current;
    if (!root || reduceMotion()) return;
    const wipe = selectOne<HTMLElement>(root, '.route-wipe');
    const page = selectOne<HTMLElement>(root, '[data-gsap-page]');
    if (!wipe || !page) return;
    gsap.timeline({ defaults: { ease: 'expo.inOut' } })
      .set(wipe, { scaleX: 0, skewX: -18, transformOrigin: 'left' })
      .to(wipe, { scaleX: 1, duration: 0.38 })
      .fromTo(page, { autoAlpha: 0, y: 34, rotateX: -3, transformOrigin: '50% 0%' }, { autoAlpha: 1, y: 0, rotateX: 0, duration: 0.72, ease: 'expo.out' }, '-=.08')
      .to(wipe, { scaleX: 0, skewX: 18, duration: 0.42, transformOrigin: 'right' }, '-=.32');
  }, { dependencies: [location.pathname], revertOnUpdate: true });

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-frame" ref={shellRef}>
      <aside className="sidebar" aria-label="Navegación de Goliat">
        <div className="brand-lockup" data-shell-intro>
          <span className="brand-mark">G</span>
          <strong>Goliat</strong>
        </div>

        <nav className="desktop-nav" aria-label="Navegación principal">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => cn('nav-link', isActive && 'nav-link--active')} data-shell-intro>
              <Icon size={19} strokeWidth={2.2} />
              <span>{label}</span><i />
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer" data-shell-intro>
          <button type="button" className="logout-button" onClick={handleLogout} aria-label="Cerrar sesión">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <main className="main-content" ref={pageRef}>
        <header className="command-bar">
          <div><Activity size={15} /><span>Operación</span><b>/</b><strong>{currentModule}</strong></div>
          <div className="command-user"><span className="live-dot" /> <small>Sistema activo</small><i>{user?.username.slice(0, 2).toUpperCase()}</i><strong>{user?.username}</strong></div>
        </header>
        <div className="route-wipe" aria-hidden="true" />
        <div
          key={location.pathname}
          className="page-container"
          data-gsap-page
        >
          <Outlet />
        </div>
      </main>

      <nav className="mobile-nav" aria-label="Navegación móvil">
        {navigation.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => cn(isActive && 'mobile-nav--active')}>
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { Archive, Bot, CalendarPlus, ChevronLeft, ChevronRight, Edit3, Phone, Plus, Search, UserRoundX, Users, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { Skeleton } from '../../components/ui/Skeleton';
import { cn } from '../../lib/cn';
import { getErrorMessage } from '../../lib/api';
import { notify } from '../../lib/notify';
import { Flip, Observer, gsap, reduceMotion, selectAll, useGSAP } from '../../lib/motion';
import { shortDate } from '../../lib/format';
import { useMemberStore } from '../../stores/memberStore';
import type { Member } from '../../types';
import { MemberDialog } from './MemberDialog';
import { RenewalDialog } from './RenewalDialog';
import { AiCoachDialog } from './AiCoachDialog';

type Filter = 'all' | 'active' | 'due' | 'expired';
type Sort = 'name' | 'expiry' | 'id';
const statusOf = (member: Member): Exclude<Filter, 'all'> => member.DaysLeft === null || member.DaysLeft < 0 ? 'expired' : member.DaysLeft <= 5 ? 'due' : 'active';
const statusLabel = { active: 'Activo', due: 'Por vencer', expired: 'Vencido' };

export function MembersPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const filterHeightTimersRef = useRef<number[]>([]);
  const { members, loading, fetchAll, archive } = useMemberStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('name');
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Member | null>(null);
  const [inspectorAnchor, setInspectorAnchor] = useState<HTMLButtonElement | null>(null);
  const [editor, setEditor] = useState<{ open: boolean; member: Member | null }>({ open: false, member: null });
  const [renewal, setRenewal] = useState<Member | null>(null);
  const [coach, setCoach] = useState<Member | null>(null);
  const [archiving, setArchiving] = useState<Member | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [gridHeightLock, setGridHeightLock] = useState<number | null>(null);

  useEffect(() => {
    fetchAll().catch((error) => notify.error('No pudimos cargar los atletas', getErrorMessage(error)));
  }, [fetchAll]);

  useEffect(() => () => {
    filterHeightTimersRef.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const filteredMembers = useMemo(() => {
    const source = members.filter((member) => {
      const matchesSearch = (member.FullName + ' ' + member.Phone).toLowerCase().includes(search.toLowerCase());
      return matchesSearch && (filter === 'all' || statusOf(member) === filter);
    });
    return [...source].sort((left, right) => {
      if (sort === 'id') return left.MemberID - right.MemberID;
      if (sort === 'expiry') return (left.DaysLeft ?? -9999) - (right.DaysLeft ?? -9999);
      return left.FullName.localeCompare(right.FullName, 'es');
    });
  }, [filter, members, search, sort]);

  const counts = useMemo(() => members.reduce((result, member) => {
    result[statusOf(member)] += 1;
    return result;
  }, { active: 0, due: 0, expired: 0 }), [members]);
  const pages = Math.max(1, Math.ceil(filteredMembers.length / pageSize));
  const visibleMembers = filteredMembers.slice((page - 1) * pageSize, page * pageSize);
  const selectedOnPage = selected && visibleMembers.some((member) => member.MemberID === selected.MemberID) ? selected : null;

  useEffect(() => { setPage(1); }, [search, filter, sort, pageSize]);
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);
  useEffect(() => {
    if (selected && !selectedOnPage) {
      setSelected(null);
      setInspectorAnchor(null);
    }
  }, [selected, selectedOnPage]);

  const { contextSafe } = useGSAP({ scope: rootRef });
  const selectFilter = contextSafe((value: Filter) => {
    if (value === filter) return;
    const root = rootRef.current;
    const nodes = root ? selectAll<HTMLElement>(root, '.athlete-node') : [];
    const grid = root?.querySelector<HTMLElement>('.roster-grid') ?? null;
    const startGridHeight = grid?.getBoundingClientRect().height ?? 0;
    filterHeightTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    filterHeightTimersRef.current = [];
    gsap.killTweensOf(nodes);
    gsap.set(nodes, { clearProps: 'opacity,visibility,transform,clipPath' });
    const state = nodes.length && !reduceMotion() ? Flip.getState(nodes) : null;

    flushSync(() => {
      setSelected(null);
      setInspectorAnchor(null);
      setGridHeightLock(startGridHeight > 0 ? startGridHeight : null);
      setFilter(value);
    });

    const nextNodes = root ? selectAll<HTMLElement>(root, '.athlete-node') : [];
    const nextGrid = root?.querySelector<HTMLElement>('.roster-grid') ?? null;
    let targetGridHeight = 0;
    let heldGridHeight = 0;
    if (nextGrid && nextNodes.length) {
      const gridStyle = window.getComputedStyle(nextGrid);
      const columnCount = gridStyle.gridTemplateColumns.split(/\s+/).filter(Boolean).length || 1;
      const rowCount = Math.ceil(nextNodes.length / columnCount);
      const cardHeight = nextNodes[0].getBoundingClientRect().height;
      const rowGap = Number.parseFloat(gridStyle.rowGap) || 0;
      targetGridHeight = (rowCount * cardHeight) + (Math.max(0, rowCount - 1) * rowGap);
      heldGridHeight = Math.max(startGridHeight, targetGridHeight);
      if (heldGridHeight > 0) setGridHeightLock(heldGridHeight);
    }
    gsap.set(nextNodes, { autoAlpha: 1 });
    if (!state || !nextNodes.length) {
      gsap.set(nextNodes, { clearProps: 'opacity,visibility,transform' });
      setGridHeightLock(null);
      return;
    }

    filterHeightTimersRef.current = [
      window.setTimeout(() => setGridHeightLock(targetGridHeight || null), 620),
      window.setTimeout(() => setGridHeightLock(null), 920),
    ];

    const finishTransition = () => {
      gsap.set(nextNodes, { clearProps: 'opacity,visibility,transform,zIndex,width,height,position,left,top' });
    };

    Flip.from(state, {
      duration: .62,
      ease: 'goliat-snap',
      prune: true,
      stagger: { amount: .22, from: 'center' },
      onEnter: (elements) => gsap.fromTo(elements,
        { autoAlpha: 0, y: 18, scale: .86 },
        { autoAlpha: 1, y: 0, scale: 1, duration: .48, ease: 'back.out(1.35)', clearProps: 'opacity,visibility,transform' },
      ),
      onComplete: finishTransition,
    });
  });

  useGSAP(() => {
    const root = rootRef.current;
    if (!root || loading || reduceMotion()) return;
    const nodes = selectAll<HTMLElement>(root, '.athlete-node');
    if (!nodes.length) return;
    gsap.fromTo(nodes,
      { autoAlpha: 0, scale: .72, rotateZ: -3, clipPath: 'circle(12% at 50% 50%)' },
      { autoAlpha: 1, scale: 1, rotateZ: 0, clipPath: 'circle(75% at 50% 50%)', duration: .72, stagger: { grid: 'auto', from: 'center', amount: .55 }, ease: 'back.out(1.35)', clearProps: 'clipPath,transform,opacity,visibility' },
    );
  }, { dependencies: [loading, page], revertOnUpdate: true });

  useGSAP(() => {
    const field = rootRef.current?.querySelector<HTMLElement>('.roster-field');
    const halo = rootRef.current?.querySelector<HTMLElement>('.roster-field__halo');
    if (!field || !halo || reduceMotion()) return;
    const observer = Observer.create({
      target: field,
      type: 'pointer,touch',
      onMove: (self) => gsap.to(halo, { x: (self.x ?? 0) - field.clientWidth * .5, y: (self.y ?? 0) - field.clientHeight * .5, duration: 1.4, ease: 'power3.out', overwrite: 'auto' }),
    });
    return () => observer.kill();
  }, { dependencies: [loading], revertOnUpdate: true });

  const confirmArchive = async () => {
    if (!archiving) return;
    setArchiveLoading(true);
    try {
      await notify.promise(archive(archiving.MemberID), {
        loading: 'Archivando atleta', success: 'Atleta archivado', error: 'No pudimos archivar al atleta',
      });
      if (selected?.MemberID === archiving.MemberID) {
        setSelected(null);
        setInspectorAnchor(null);
      }
      setArchiving(null);
    } finally { setArchiveLoading(false); }
  };

  return (
    <div className="roster-page" ref={rootRef}>
      <section className="roster-console">
        <header className="roster-console__head">
          <div><span>GOLIAT / ROSTER</span><h1>Atletas</h1><small>{members.length.toLocaleString('es-MX')} registrados</small></div>
          <Button icon={<Plus size={17} />} onClick={() => setEditor({ open: true, member: null })}>Nuevo</Button>
        </header>

        <div className="roster-command">
          <label><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar atleta o WhatsApp" /></label>
          <nav>
            {(['all', 'active', 'due', 'expired'] as Filter[]).map((value) => (
              <button key={value} type="button" onClick={() => selectFilter(value)} className={filter === value ? 'is-active' : ''}>
                <span>{({ all: 'Todos', active: 'Activos', due: 'Por vencer', expired: 'Vencidos' })[value]}</span>
                <b>{value === 'all' ? members.length : counts[value]}</b>
              </button>
            ))}
          </nav>
        </div>

        {loading ? <Skeleton className="h-96" /> : visibleMembers.length ? (
          <section className="roster-field">
            <i className="roster-field__halo" aria-hidden="true" />
            <div className="roster-grid" style={gridHeightLock === null ? undefined : { minHeight: gridHeightLock }}>
              {visibleMembers.map((member) => {
                const status = statusOf(member);
                const initials = member.FullName.split(' ').map((part) => part[0]).slice(0, 2).join('');
                const pace = Math.max(0, Math.min(1, (member.DaysLeft ?? 0) / 30));
                const isSelected = selectedOnPage?.MemberID === member.MemberID;
                return (
                  <button
                    key={member.MemberID}
                    type="button"
                    className={cn('athlete-node', 'is-' + status, isSelected && 'is-selected')}
                    onClick={(event) => {
                      const closing = selected?.MemberID === member.MemberID;
                      setSelected(closing ? null : member);
                      setInspectorAnchor(closing ? null : event.currentTarget);
                    }}
                    style={{ '--pace': pace } as CSSProperties}
                    aria-expanded={isSelected}
                    aria-controls={isSelected ? `member-actions-${member.MemberID}` : undefined}
                  >
                    <span className="athlete-node__number">{String(member.MemberID).padStart(4, '0')}</span>
                    <span className="athlete-node__identity"><i>{initials}</i><span><strong>{member.FullName}</strong><small>{member.PlanName || 'Sin plan'}</small></span></span>
                    <span className="athlete-node__signal"><small><i />{statusLabel[status]}</small><b>{member.DaysLeft === null ? '—' : member.DaysLeft + 'D'}</b></span>
                    <i className="athlete-node__pace"><b /></i>
                  </button>
                );
              })}
            </div>
          </section>
        ) : <EmptyState icon={search || filter !== 'all' ? UserRoundX : Users} title="Sin resultados" description={search || filter !== 'all' ? 'Ajusta la búsqueda o el filtro.' : 'Registra al primer atleta.'} />}

        <footer className="roster-footer">
          <span>{filteredMembers.length ? `${((page - 1) * pageSize) + 1}–${Math.min(page * pageSize, filteredMembers.length)} / ${filteredMembers.length}` : '0 / 0'}</span>
          <label><span>Orden</span><select value={sort} onChange={(event) => setSort(event.target.value as Sort)}><option value="name">Nombre</option><option value="expiry">Vigencia</option><option value="id">ID</option></select></label>
          <label><span>Vista</span><select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option>25</option><option>50</option><option>100</option></select></label>
          <nav aria-label="Paginación de atletas"><button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)} aria-label="Página anterior"><ChevronLeft size={17} /></button><b>{page} / {pages}</b><button type="button" disabled={page === pages} onClick={() => setPage((value) => value + 1)} aria-label="Página siguiente"><ChevronRight size={17} /></button></nav>
        </footer>
      </section>

      {selectedOnPage && inspectorAnchor && (
        <FloatingMemberInspector
          anchor={inspectorAnchor}
          id={`member-actions-${selectedOnPage.MemberID}`}
          member={selectedOnPage}
          onClose={() => { setSelected(null); setInspectorAnchor(null); }}
          onRenew={() => { setRenewal(selectedOnPage); setSelected(null); setInspectorAnchor(null); }}
          onCoach={() => { setCoach(selectedOnPage); setSelected(null); setInspectorAnchor(null); }}
          onEdit={() => { setEditor({ open: true, member: selectedOnPage }); setSelected(null); setInspectorAnchor(null); }}
          onArchive={() => { setArchiving(selectedOnPage); setSelected(null); setInspectorAnchor(null); }}
        />
      )}

      <MemberDialog open={editor.open} member={editor.member} onClose={() => setEditor({ open: false, member: null })} />
      <RenewalDialog member={renewal} onClose={() => setRenewal(null)} />
      <AiCoachDialog member={coach} onClose={() => setCoach(null)} />
      <Modal open={Boolean(archiving)} onClose={() => setArchiving(null)} title="Archivar atleta" description="Se desactiva el acceso; los cobros permanecen." size="sm">
        <div className="confirm-content"><Archive size={26} /><p><strong>{archiving?.FullName}</strong> dejará de aparecer entre los atletas activos.</p><div className="form-actions"><Button variant="ghost" onClick={() => setArchiving(null)}>Cancelar</Button><Button variant="danger" loading={archiveLoading} onClick={confirmArchive}>Archivar</Button></div></div>
      </Modal>
    </div>
  );
}

type FloatingPosition = { top: number; left: number; width: number; ready: boolean };

function FloatingMemberInspector({ anchor, id, member, onClose, onRenew, onCoach, onEdit, onArchive }: { anchor: HTMLButtonElement; id: string; member: Member; onClose: () => void; onRenew: () => void; onCoach: () => void; onEdit: () => void; onArchive: () => void }) {
  const panelRef = useRef<HTMLElement>(null);
  const [position, setPosition] = useState<FloatingPosition>(() => ({
    top: -1000,
    left: -1000,
    width: typeof window === 'undefined' ? 620 : Math.max(0, Math.min(620, window.innerWidth - 24)),
    ready: false,
  }));
  const status = statusOf(member);
  const initials = member.FullName.split(' ').map((part) => part[0]).slice(0, 2).join('');

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || !anchor.isConnected) return;

    let animationFrame = 0;
    const place = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const compact = viewportWidth <= 760;
      const margin = compact ? 12 : 16;
      const gap = compact ? 10 : 12;
      const width = Math.max(0, Math.min(620, viewportWidth - (margin * 2)));
      panel.style.width = `${width}px`;

      const anchorRect = anchor.getBoundingClientRect();
      const panelHeight = panel.getBoundingClientRect().height;
      let left = Math.min(Math.max(margin, anchorRect.left), viewportWidth - width - margin);
      let top = anchorRect.bottom + gap;

      if (compact) {
        top = Math.max(margin, viewportHeight - panelHeight - 78);
      } else if (top + panelHeight > viewportHeight - margin) {
        const above = anchorRect.top - panelHeight - gap;
        if (above >= margin) top = above;
        else if (viewportWidth - anchorRect.right >= width + gap) {
          left = anchorRect.right + gap;
          top = Math.min(Math.max(margin, anchorRect.top), viewportHeight - panelHeight - margin);
        } else if (anchorRect.left >= width + gap) {
          left = anchorRect.left - width - gap;
          top = Math.min(Math.max(margin, anchorRect.top), viewportHeight - panelHeight - margin);
        } else {
          top = Math.max(margin, viewportHeight - panelHeight - margin);
        }
      }

      setPosition({ top, left, width, ready: true });
    };

    place();
    animationFrame = window.requestAnimationFrame(place);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor, member.MemberID]);

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !anchor.contains(target)) onClose();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [anchor, onClose]);

  useGSAP(() => {
    const panel = panelRef.current;
    if (!panel || !position.ready || reduceMotion()) return;
    const contents = selectAll<HTMLElement>(panel, ':scope > *');
    const timeline = gsap.timeline();
    timeline.fromTo(panel,
      { autoAlpha: 0, y: 14, scale: .96, clipPath: 'inset(0 0 100% 0)', transformOrigin: 'top center' },
      { autoAlpha: 1, y: 0, scale: 1, clipPath: 'inset(0 0 0% 0)', duration: .48, ease: 'goliat-in', clearProps: 'opacity,visibility,transform,clipPath' },
    );
    if (contents.length) timeline.from(contents, { y: 8, autoAlpha: 0, duration: .28, stagger: .04, ease: 'power2.out', clearProps: 'opacity,visibility,transform' }, '-=.2');
  }, { scope: panelRef, dependencies: [member.MemberID, position.ready], revertOnUpdate: true });

  return createPortal(
    <aside
      ref={panelRef}
      className="member-inspector member-inspector--floating"
      id={id}
      role="dialog"
      aria-label={`Acciones para ${member.FullName}`}
      style={{ top: position.top, left: position.left, width: position.width, visibility: position.ready ? 'visible' : 'hidden' }}
    >
      <header><span>ATLETA {String(member.MemberID).padStart(4, '0')}</span><button type="button" onClick={onClose} aria-label="Cerrar detalle"><X size={17} /></button></header>
      <div className="member-inspector__identity"><i>{initials}</i><h2>{member.FullName}</h2><a href={'tel:+' + member.Phone}><Phone size={14} />{member.Phone ? '+' + member.Phone : 'Sin teléfono'}</a></div>
      <dl>
        <div><dt>Estado</dt><dd className={'is-' + status}>{statusLabel[status]}</dd></div>
        <div><dt>Plan</dt><dd>{member.PlanName || 'Sin plan'}</dd></div>
        <div><dt>Vigencia</dt><dd>{shortDate(member.EndDate)}</dd></div>
        <div><dt>Días</dt><dd>{member.DaysLeft ?? '—'}</dd></div>
      </dl>
      <nav>
        <button type="button" onClick={onRenew}><CalendarPlus size={17} />Renovar</button>
        <button type="button" onClick={onCoach}><Bot size={17} />Coach</button>
        <button type="button" onClick={onEdit}><Edit3 size={17} />Editar</button>
        <button type="button" className="danger" onClick={onArchive}><Archive size={17} />Archivar</button>
      </nav>
    </aside>,
    document.body,
  );
}

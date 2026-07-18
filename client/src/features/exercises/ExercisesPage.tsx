import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { ArrowUpRight, BookOpen, ChevronLeft, ChevronRight, Dumbbell, RotateCcw, Search, SlidersHorizontal, Target } from 'lucide-react';
import { api, assetUrl, getErrorMessage } from '../../lib/api';
import { notify } from '../../lib/notify';
import { ScrollTrigger, gsap, useGSAP, useSectionMotion } from '../../lib/motion';
import { fitnessLabel, titleCase } from '../../lib/format';
import type { Exercise, ExerciseMeta, ExerciseResponse } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';

const initialMeta: ExerciseMeta = { total: 0, categories: [], equipment: [], targets: [], languages: [] };
const emptyFilters = { search: '', category: '', equipment: '', target: '' };

export function ExercisesPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [meta, setMeta] = useState<ExerciseMeta>(initialMeta);
  const [data, setData] = useState<ExerciseResponse | null>(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Exercise | null>(null);

  useEffect(() => {
    api.get<ExerciseMeta>('/exercises/meta').then(({ data: response }) => setMeta(response)).catch((error) => notify.error('No pudimos indexar la biblioteca', getErrorMessage(error)));
  }, []);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', focusSearch);
    return () => {
      window.removeEventListener('keydown', focusSearch);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true);
      api.get<ExerciseResponse>('/exercises', { params: { ...filters, page, limit: 24 } })
        .then(({ data: response }) => setData(response))
        .catch((error) => notify.error('No pudimos cargar el catálogo', getErrorMessage(error)))
        .finally(() => setLoading(false));
    }, filters.search ? 320 : 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [filters, page]);

  const changeFilter = (key: keyof typeof filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };
  const hasFilters = Object.values(filters).some(Boolean);

  useSectionMotion(rootRef, [data?.pagination.page]);

  useGSAP(() => {
    if (loading || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cards = gsap.utils.toArray<HTMLElement>('.exercise-tile');
    ScrollTrigger.batch(cards, {
      start: 'top 92%',
      once: true,
      onEnter: (batch) => gsap.fromTo(batch, { autoAlpha: 0, y: 46, rotateX: -9 }, { autoAlpha: 1, y: 0, rotateX: 0, duration: 0.72, stagger: 0.055, ease: 'expo.out' }),
    });
  }, { scope: rootRef, dependencies: [data, loading], revertOnUpdate: true });

  const { contextSafe } = useGSAP({ scope: rootRef });
  const tiltCard = contextSafe((event: PointerEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    gsap.to(event.currentTarget, { rotateY: x * 5, rotateX: y * -5, transformPerspective: 900, duration: 0.35, ease: 'power2.out', overwrite: 'auto' });
  });
  const resetCard = contextSafe((event: PointerEvent<HTMLButtonElement>) => {
    gsap.to(event.currentTarget, { rotateY: 0, rotateX: 0, duration: 0.5, ease: 'expo.out', overwrite: 'auto' });
  });

  return (
    <div ref={rootRef}>
      <PageHeader eyebrow="EXERCISES DATASET" title="Atlas" description={meta.total.toLocaleString('es-MX') + ' ejercicios'} />

      <section className="library-console" data-motion>
        <label className="library-search"><Search size={20} /><input ref={searchRef} value={filters.search} onChange={(event) => changeFilter('search', event.target.value)} placeholder="Buscar movimiento, músculo u objetivo" /><kbd>/</kbd></label>
        <div className="library-filters">
          <label><SlidersHorizontal size={15} /><select value={filters.category} onChange={(event) => changeFilter('category', event.target.value)}><option value="">Zona / todas</option>{meta.categories.map((item) => <option key={item} value={item}>{fitnessLabel(item)}</option>)}</select></label>
          <label><Dumbbell size={15} /><select value={filters.equipment} onChange={(event) => changeFilter('equipment', event.target.value)}><option value="">Equipo / todo</option>{meta.equipment.map((item) => <option key={item} value={item}>{fitnessLabel(item)}</option>)}</select></label>
          <label><Target size={15} /><select value={filters.target} onChange={(event) => changeFilter('target', event.target.value)}><option value="">Objetivo / todos</option>{meta.targets.map((item) => <option key={item} value={item}>{fitnessLabel(item)}</option>)}</select></label>
          {hasFilters && <button type="button" onClick={() => { setFilters(emptyFilters); setPage(1); }}><RotateCcw size={14} /> Limpiar</button>}
        </div>
        <p><span>{loading ? 'INDEXANDO' : `${data?.pagination.total.toLocaleString('es-MX') || 0} RESULTADOS`}</span><b>PÁGINA {page}</b></p>
      </section>

      {loading ? <section className="exercise-gallery">{Array.from({ length: 12 }, (_, index) => <Skeleton key={index} className="h-72" />)}</section> : data?.items.length ? (
        <section className="exercise-gallery" data-motion>
          {data.items.map((exercise, index) => (
            <button type="button" className="exercise-tile" key={exercise.id} onPointerMove={tiltCard} onPointerLeave={resetCard} onClick={() => setSelected(exercise)}>
              <span className="exercise-visual"><img src={assetUrl(exercise.image)} alt="" loading="lazy" /><i>{String((page - 1) * 24 + index + 1).padStart(3, '0')}</i><ArrowUpRight size={19} /></span>
              <span className="exercise-caption"><small>{fitnessLabel(exercise.category)} / {fitnessLabel(exercise.target)}</small><strong>{titleCase(exercise.name)}</strong><em>{fitnessLabel(exercise.equipment)}</em></span>
            </button>
          ))}
        </section>
      ) : <EmptyState icon={BookOpen} title="No hay coincidencias" description="Cambia uno de los filtros o intenta una búsqueda más general." />}

      {data && data.pagination.pages > 1 && <nav className="pagination" aria-label="Paginación"><Button variant="secondary" disabled={page === 1} icon={<ChevronLeft size={17} />} onClick={() => setPage((value) => value - 1)}>Anterior</Button><span><strong>{page}</strong> / {data.pagination.pages}</span><Button variant="secondary" disabled={page === data.pagination.pages} onClick={() => setPage((value) => value + 1)}>Siguiente <ChevronRight size={17} /></Button></nav>}

      <ExerciseDetail exercise={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function ExerciseDetail({ exercise, onClose }: { exercise: Exercise | null; onClose: () => void }) {
  const steps = exercise?.instruction_steps.es?.length ? exercise.instruction_steps.es : exercise?.instructions.es?.split('. ').filter(Boolean) || [];
  return (
    <Modal open={Boolean(exercise)} onClose={onClose} title={exercise ? titleCase(exercise.name) : ''} description={exercise ? `${fitnessLabel(exercise.body_part)} · ${fitnessLabel(exercise.target)}` : ''} size="xl">
      {exercise && <div className="exercise-reader"><figure><img src={assetUrl(exercise.gif_url)} alt={`Demostración de ${exercise.name}`} /><figcaption>{exercise.attribution}</figcaption></figure><div className="exercise-copy"><div className="exercise-facts"><div><span>Equipo</span><strong>{fitnessLabel(exercise.equipment)}</strong></div><div><span>Músculo principal</span><strong>{fitnessLabel(exercise.target)}</strong></div><div><span>Grupo auxiliar</span><strong>{fitnessLabel(exercise.muscle_group)}</strong></div></div><h3>Ejecución</h3><ol>{steps.map((step, index) => <li key={`${exercise.id}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><p>{step.replace(/\.$/, '')}.</p></li>)}</ol>{exercise.secondary_muscles.length > 0 && <div className="muscle-tags"><span>También trabaja</span>{exercise.secondary_muscles.map((muscle) => <b key={muscle}>{fitnessLabel(muscle)}</b>)}</div>}</div></div>}
    </Modal>
  );
}

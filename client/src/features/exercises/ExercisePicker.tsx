import { useEffect, useRef, useState } from 'react';
import { Check, Dumbbell, Search, Target, X } from 'lucide-react';
import { flushSync } from 'react-dom';
import { api, assetUrl, getErrorMessage } from '../../lib/api';
import { fitnessLabel, titleCase } from '../../lib/format';
import { Flip, gsap, reduceMotion, selectAll, useGSAP } from '../../lib/motion';
import { notify } from '../../lib/notify';
import type { Exercise, ExerciseResponse } from '../../types';

export function ExercisePicker({ selected, onToggle }: { selected: Exercise[]; onToggle: (exercise: Exercise) => void }) {
  const rootRef = useRef<HTMLElement>(null);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      api.get<ExerciseResponse>('/exercises', { params: { search, page: 1, limit: 12 }, signal: controller.signal })
        .then(({ data }) => setItems(data.items))
        .catch((error) => {
          if (!controller.signal.aborted) notify.error('No pudimos abrir el Atlas', getErrorMessage(error));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, search ? 260 : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search]);

  const { contextSafe } = useGSAP({ scope: rootRef });

  useGSAP(() => {
    const cards = selectAll<HTMLElement>(rootRef.current, '.coach-atlas-card');
    if (loading || !cards.length || reduceMotion()) return;
    gsap.fromTo(cards, { autoAlpha: 0, y: 22, scale: 0.96 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.55, stagger: 0.045, ease: 'expo.out' });
  }, { dependencies: [items, loading], revertOnUpdate: true });

  const toggleExercise = contextSafe((exercise: Exercise) => {
    const state = rootRef.current ? Flip.getState(rootRef.current.querySelectorAll('.coach-atlas-card, .coach-atlas-chip')) : null;
    flushSync(() => onToggle(exercise));
    if (state) Flip.from(state, { duration: 0.55, ease: 'power3.inOut', absolute: true, nested: true });
  });

  return (
    <section className="coach-atlas" ref={rootRef}>
      <header><div><span>ATLAS</span><h3>Ejercicios</h3></div><label><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ejercicio o músculo" /></label></header>
      <div className="coach-atlas-selected">
        <small>{selected.length} seleccionados</small>
        <div>{selected.map((exercise) => <button className="coach-atlas-chip" type="button" key={exercise.id} onClick={() => toggleExercise(exercise)}>{titleCase(exercise.name)} <X size={12} /></button>)}</div>
      </div>
      <div className="coach-atlas-grid">
        {loading ? Array.from({ length: 8 }, (_, index) => <div className="skeleton h-64" key={index} />) : items.map((exercise) => {
          const isSelected = selected.some((item) => item.id === exercise.id);
          return <button className={`coach-atlas-card${isSelected ? ' is-selected' : ''}`} type="button" key={exercise.id} onClick={() => toggleExercise(exercise)}><span><img src={assetUrl(exercise.image)} alt="" loading="lazy" />{isSelected && <i><Check size={15} /></i>}</span><small>{fitnessLabel(exercise.category)}</small><strong>{titleCase(exercise.name)}</strong><em><Dumbbell size={12} />{fitnessLabel(exercise.equipment)}<Target size={12} />{fitnessLabel(exercise.target)}</em></button>;
        })}
      </div>
    </section>
  );
}

import { useRef, type ReactNode } from 'react';
import { SplitText, gsap, reduceMotion, selectOne, useGSAP } from '../../lib/motion';

export function PageHeader({ eyebrow, title, description, action }: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(() => {
    const root = rootRef.current;
    if (!root || reduceMotion()) return;
    const heading = selectOne<HTMLElement>(root, 'h1');
    if (!heading) return;
    const eyebrowNode = selectOne<HTMLElement>(root, '.eyebrow');
    const descriptionNode = selectOne<HTMLElement>(root, '.page-header-description');
    const actionNode = selectOne<HTMLElement>(root, '.page-header-action');
    const split = SplitText.create(heading, { type: 'words', aria: 'auto' });
    const timeline = gsap.timeline({ defaults: { ease: 'goliat-in' } });
    if (eyebrowNode) timeline.from(eyebrowNode, { autoAlpha: 0, x: -32, letterSpacing: '0.5em', duration: 0.65 });
    timeline.from(split.words, { autoAlpha: 0, yPercent: 125, rotateX: -42, rotateZ: 2, duration: 1.05, stagger: 0.065 }, '-=.32');
    if (descriptionNode) timeline.from(descriptionNode, { autoAlpha: 0, y: 22, clipPath: 'inset(0 0 100% 0)', duration: 0.72 }, '-=.58');
    if (actionNode) timeline.from(actionNode, { autoAlpha: 0, x: 26, rotateY: -18, duration: 0.65 }, '-=.52');
    return () => {
      split.revert();
    };
  }, { dependencies: [title], revertOnUpdate: true });

  return (
    <header className="page-header" ref={rootRef}>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="page-header-description">{description}</p>}
      </div>
      {action && <div className="page-header-action">{action}</div>}
    </header>
  );
}

import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { Draggable } from 'gsap/Draggable';
import { Flip } from 'gsap/Flip';
import { InertiaPlugin } from 'gsap/InertiaPlugin';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { Observer } from 'gsap/Observer';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { TextPlugin } from 'gsap/TextPlugin';
import type { DependencyList, RefObject } from 'react';

gsap.registerPlugin(
  useGSAP,
  CustomEase,
  DrawSVGPlugin,
  Draggable,
  Flip,
  InertiaPlugin,
  MorphSVGPlugin,
  MotionPathPlugin,
  Observer,
  ScrambleTextPlugin,
  ScrollTrigger,
  SplitText,
  TextPlugin,
);

CustomEase.create('goliat-in', 'M0,0 C0.16,0.98 0.22,1 1,1');
CustomEase.create('goliat-snap', 'M0,0 C0.5,0 0.08,1 1,1');

export const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const selectOne = <T extends Element>(root: ParentNode | null, selector: string) =>
  root?.querySelector<T>(selector) ?? null;

export const selectAll = <T extends Element>(root: ParentNode | null, selector: string) =>
  root ? Array.from(root.querySelectorAll<T>(selector)) : [];

export const useSectionMotion = (scope: RefObject<HTMLElement | null>, dependencies: DependencyList = []) => {
  useGSAP(() => {
    const root = scope.current;
    if (!root || reduceMotion()) return;
    const elements = selectAll<HTMLElement>(root, '[data-motion]');
    if (!elements.length) return;

    ScrollTrigger.batch(elements, {
      start: 'top 90%',
      once: true,
      onEnter: (batch) => gsap.fromTo(
        batch,
        { autoAlpha: 0, y: 48, rotateX: -7, clipPath: 'inset(0 0 18% 0)' },
        {
          autoAlpha: 1,
          y: 0,
          rotateX: 0,
          clipPath: 'inset(0 0 0% 0)',
          duration: 0.95,
          stagger: 0.11,
          ease: 'goliat-in',
          overwrite: 'auto',
        },
      ),
    });
  }, { dependencies: [...dependencies], revertOnUpdate: true });
};

export {
  CustomEase,
  DrawSVGPlugin,
  Draggable,
  Flip,
  InertiaPlugin,
  MorphSVGPlugin,
  MotionPathPlugin,
  Observer,
  ScrambleTextPlugin,
  ScrollTrigger,
  SplitText,
  TextPlugin,
  gsap,
  useGSAP,
};

import type { SlideTransition } from '@open-slide/core';

const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
const EASE_IN = 'cubic-bezier(0.4, 0, 1, 1)';
const HOLD: Keyframe[] = [{ opacity: 1 }, { opacity: 1 }];

export const MORPH_MS = 800;

export const riseTransition: SlideTransition = {
  duration: 260,
  exit: { duration: 260, easing: EASE_IN, keyframes: HOLD },
  enter: {
    duration: 260,
    easing: EASE_OUT,
    keyframes: [
      { opacity: 0, transform: 'translateY(8px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ],
  },
};

export const morphTransition: SlideTransition = {
  duration: 280,
  exit: { duration: 308, easing: EASE_IN, keyframes: HOLD },
  enter: { duration: 308, easing: EASE_OUT, keyframes: [{ opacity: 0 }, { opacity: 1 }] },
  morph: { duration: MORPH_MS, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
};

import type { MotionProps, Transition } from "motion/react";

const easeOut = [0.22, 1, 0.36, 1] as const;
const softEase = [0.2, 0.8, 0.2, 1] as const;

const transition = (duration: number, ease: Transition["ease"] = easeOut): Transition => ({
  duration,
  ease,
});

export const paneEnterMotion: MotionProps = {
  initial: { opacity: 0, y: 5 },
  animate: { opacity: 1, y: 0 },
  transition: transition(0.18),
};

export const sidebarRevealTransition: Transition = transition(0.32);

export const contentEnterMotion: MotionProps = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  transition: transition(0.15),
};

export const treeEnterMotion: MotionProps = {
  initial: { opacity: 0, y: -3 },
  animate: { opacity: 1, y: 0 },
  transition: transition(0.16, softEase),
};

export const statusSettleMotion: MotionProps = {
  initial: { opacity: 0.35, scale: 0.88 },
  animate: { opacity: 1, scale: 1 },
  transition: transition(0.2),
};

export const selectionSettleMotion: MotionProps = {
  initial: { opacity: 0, scaleY: 0.35 },
  animate: { opacity: 1, scaleY: 1 },
  transition: transition(0.18),
};

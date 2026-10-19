// Animation helpers built on Motion (https://motion.dev).
// Registered globally in main.js as directives so any template can use them:
//   v-enter            fade + rise in when the element mounts
//   v-enter="0.1"      same, with a delay in seconds
//   v-stagger          fade + rise each direct child in turn (good for lists rendered with v-for)
import { animate, stagger } from 'motion'

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const ease = [0.22, 1, 0.36, 1]

export function enterFrom(el, { delay = 0, y = 8 } = {}) {
  if (reduceMotion()) return
  animate(el, { opacity: [0, 1], y: [y, 0] }, { duration: 0.35, delay, ease })
}

export const vEnter = {
  mounted(el, { value }) {
    enterFrom(el, { delay: Number(value) || 0 })
  },
}

export const vStagger = {
  mounted(el, { value }) {
    if (reduceMotion() || !el.children.length) return
    animate(
      el.children,
      { opacity: [0, 1], y: [8, 0] },
      { duration: 0.3, delay: stagger(0.04, { startDelay: Number(value) || 0 }), ease },
    )
  },
}

// Overlay helpers for <Transition :css="false" @enter @leave>
export function overlayEnter(el, done) {
  if (reduceMotion()) return done()
  const panel = el.querySelector('[data-panel]')
  animate(el, { opacity: [0, 1] }, { duration: 0.18 })
  if (panel) animate(panel, { opacity: [0, 1], scale: [0.96, 1], y: [6, 0] }, { duration: 0.22, ease }).then(done)
  else done()
}

export function overlayLeave(el, done) {
  if (reduceMotion()) return done()
  animate(el, { opacity: 0 }, { duration: 0.14 }).then(done)
}

// Small dropdown menus / listboxes
export function popEnter(el, done) {
  if (reduceMotion()) return done()
  animate(el, { opacity: [0, 1], y: [-4, 0], scale: [0.98, 1] }, { duration: 0.16, ease }).then(done)
}

export function popLeave(el, done) {
  if (reduceMotion()) return done()
  animate(el, { opacity: 0, y: -4 }, { duration: 0.12 }).then(done)
}

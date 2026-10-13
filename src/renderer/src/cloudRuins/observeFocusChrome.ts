import type { CloudRuinsChrome } from './cloudRuinsScene'

/** Follow the actual HUD boxes, including widths changed by activity/timer text. */
export function observeFocusChrome(host: HTMLElement, setChrome: (chrome: CloudRuinsChrome) => void): () => void {
  const root = host.closest('.focus-active') ?? host.parentElement ?? host
  const elements = Array.from(root.querySelectorAll('[data-glass], [data-glass-card], [data-glass-zone]'))
  let frame = 0
  const measure = (): void => {
    const r = host.getBoundingClientRect()
    const top = root.querySelector('[data-glass="top"]')?.getBoundingClientRect()
    const bottom = root.querySelector('[data-glass="bottom"]')?.getBoundingClientRect()
    setChrome({
      top: top ? Math.max(0, top.bottom - r.top) : 0,
      bottom: bottom ? Math.max(0, r.bottom - bottom.top) : 0,
      cards: elements.filter(e => e.hasAttribute('data-glass-card') || e.hasAttribute('data-glass-zone')).map(e => {
        const c = e.getBoundingClientRect()
        return { x: c.left - r.left, y: c.top - r.top, w: c.width, h: c.height, kind: e.hasAttribute('data-glass-zone') ? 'zone' as const : 'pill' as const }
      }).filter(c => c.w > 0 && c.h > 0)
    })
  }
  const sync = (): void => {
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; measure() })
  }
  const observer = new ResizeObserver(sync)
  observer.observe(host)
  elements.forEach(e => observer.observe(e))
  window.addEventListener('resize', sync)
  measure()
  return () => { observer.disconnect(); window.removeEventListener('resize', sync); cancelAnimationFrame(frame) }
}

/**
 * Injects CSS custom properties into a shadow root so all widgets
 * pick up the owner's brand color automatically.
 */
export function applyTheme(root: ShadowRoot | HTMLElement, color: string) {
  const el = root instanceof ShadowRoot ? (root.host as HTMLElement) : root
  el.style.setProperty('--rp-primary', color)
  el.style.setProperty('--rp-primary-light', hexToRgba(color, 0.1))
  el.style.setProperty('--rp-primary-mid',   hexToRgba(color, 0.2))
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

'use client'

import { useLayoutEffect, useRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { ResortData } from '../types'
import { orderSections } from '../_utils/sections'
import { renderMountPoint, isKnownMountPoint } from './widget-map'

/* ── TemplateThemeRenderer ────────────────────────────────────────────────────
   Renders a Tier 2 (TEMPLATE) theme: `html` is already Handlebars-compiled
   with real tenant/website/rooms data (see compile.ts, run server-side in the
   parent Server Component) — this component's only job is client-side:

   1. Hide/reorder sections per the owner's dashboard settings (hiddenSections/
      sectionOrder), same contract every other theme renderer honors.
   2. Find every [data-rp-widget] placeholder the template author left behind
      and mount the matching already-built React widget into it.
──────────────────────────────────────────────────────────────────────────── */

// Section ids a Tier 2 template may use — see plan/theme-contract.md §5.
// `rooms` and `booking` are fixed (never hidden); the rest are owner-toggleable.
const SECTION_IDS = [
  'hero', 'about', 'amenities', 'rooms', 'menu', 'venues', 'vehicles',
  'gallery', 'testimonials', 'availability', 'booking', 'contact',
] as const
const FIXED_SECTIONS = new Set(['hero', 'rooms', 'booking'])

// Node → Root cache, module-level. Calling createRoot() twice on the same
// DOM node throws a React warning ("already passed to createRoot() before")
// — this happens under React StrictMode's dev-only double effect
// invocation (setup → cleanup → setup, synchronously). Caching means a
// second mount attempt on the same node reuses the existing root (an
// idempotent .render() call) instead of creating a conflicting second one.
const rootCache = new WeakMap<Element, Root>()

export interface TemplateThemeRendererProps {
  html: string
  css?: string | null
  data: ResortData
}

export function TemplateThemeRenderer({ html, css, data }: TemplateThemeRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Hide/reorder is plain DOM manipulation — no independent React roots
  // involved, so it's safe to run synchronously before paint (avoids a
  // flash of hidden/misordered content).
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const hidden = new Set(data.website?.hiddenSections ?? [])
    for (const id of SECTION_IDS) {
      if (FIXED_SECTIONS.has(id) || !hidden.has(id)) continue
      container.querySelector(`#${CSS.escape(id)}`)?.remove()
    }

    // Only touch the DOM when the owner actually set a custom order — reorder
    // is a no-op for the default order anyway, and skipping it avoids the
    // bug below entirely for the common case (no custom order set).
    if (data.website?.sectionOrder && data.website.sectionOrder.length > 0) {
      const order = orderSections(SECTION_IDS, data.website.sectionOrder)
      // Anchor-chain via Element.after() instead of parentElement.appendChild():
      // appendChild always moves to the very end of the parent, which would
      // push every section past non-section siblings (e.g. a <footer> placed
      // after all sections) instead of just reordering among themselves.
      let anchor: Element | null = null
      for (const id of order) {
        const el = container.querySelector(`#${CSS.escape(id)}`)
        if (!el) continue
        if (anchor) anchor.after(el)
        anchor = el
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html])

  // Widget mounting creates independent React roots on raw DOM nodes.
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const mountedNodes: HTMLElement[] = []
    const nodes = container.querySelectorAll<HTMLElement>('[data-rp-widget]')
    nodes.forEach((node) => {
      const mount = node.getAttribute('data-rp-widget')
      if (!mount || !isKnownMountPoint(mount)) return
      const element = renderMountPoint(mount, data)
      if (!element) return
      let root = rootCache.get(node)
      if (!root) {
        root = createRoot(node)
        rootCache.set(node, root)
      }
      root.render(element)
      mountedNodes.push(node)
    })

    return () => {
      // Defer past the current synchronous script (React StrictMode's dev
      // double-invoke runs setup → cleanup → setup back-to-back, in one
      // tick) and then check whether each node is still attached to the
      // document. If a later setup already re-rendered into this same
      // still-attached node (the StrictMode "remount"), leave its root
      // alone — only tear down roots whose node was genuinely detached
      // (the real case: `html` changed and dangerouslySetInnerHTML
      // replaced the container's content, orphaning the old nodes).
      setTimeout(() => {
        mountedNodes.forEach((node) => {
          if (node.isConnected) return
          rootCache.get(node)?.unmount()
          rootCache.delete(node)
        })
      }, 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, data])

  return (
    <>
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      <div ref={containerRef} dangerouslySetInnerHTML={{ __html: html }} />
    </>
  )
}

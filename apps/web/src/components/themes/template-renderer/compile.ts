import Handlebars from 'handlebars'
import type { ResortData } from '../types'

/**
 * Compiles a Tier 2 (TEMPLATE) theme's raw HTML against real resort data.
 * Runs server-side inside the [slug]/page.tsx Server Component — pure JS,
 * no DOM dependency, safe in RSC.
 *
 * Handlebars is logic-less (no eval, no arbitrary code execution) and
 * auto-escapes `{{ }}` output by default, which is the primary XSS defense
 * here alongside upload-time validation (see admin.ts /themes/upload).
 * `{{{triple-brace}}}` output is explicitly forbidden by the theme contract
 * and is neutralized below as defense-in-depth, in case a template somehow
 * bypassed the upload-time check.
 */
export function compileTemplate(templateHtml: string, data: ResortData): string {
  // Neutralize any triple-brace (unescaped-output) syntax before compiling —
  // \{{{ tells Handlebars to emit the literal text instead of interpreting it.
  const safeSource = templateHtml.replace(/\{\{\{/g, '\\{{{')

  const template = Handlebars.compile(safeSource, { noEscape: false, strict: false })
  return template(data)
}

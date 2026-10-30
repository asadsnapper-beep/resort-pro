/**
 * Which renderer the preview page actually draws with.
 *
 * The third test in this chain, and the one that closes the same class of gap
 * twice over. WB-004 was not a helper returning the wrong value, it was a line
 * in a component that never asked for the right one — so a test on the helper
 * passed while the owner saw the wrong theme. preview-page-theme.test.tsx
 * covers what the server component hands down; this covers what the client
 * component does with it. Deleting the branch that reads `template` would
 * leave both of those passing.
 *
 * The registry and the config renderer are stubbed on purpose: the question
 * here is only which of the three renderers is chosen. TemplateThemeRenderer
 * stays real, so the compiled HTML has to reach the document.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('@/components/themes/registry', () => ({
  getTheme: () => () => <p>the hardcoded registry theme</p>,
}));
vi.mock('@/components/themes/config-renderer', () => ({
  ConfigThemeRenderer: () => <p>the config renderer</p>,
}));

import { PreviewPage } from '@/app/(public)/[slug]/PreviewPage';
import type { ResortData } from '@/components/themes/types';

const data = {
  tenant: { name: 'Palm Paradise', slug: 'palm-paradise-resort', currency: 'BDT' },
  website: { templateId: 'saved-tier2', heroTitle: 'Your Paradise Awaits' },
  rooms: [],
} as unknown as ResortData;

/** As the server hands it over: already Handlebars-compiled, data baked in. */
const template = {
  html: '<section id="hero"><h1>Palm Paradise — Tier 2</h1></section>',
  css: '#hero { background: #fff200; }',
};

afterEach(cleanup);

describe('a previewed Tier 2 template', () => {
  it('is what gets drawn, not the registry fallback', async () => {
    render(<PreviewPage initialData={data} themeKey="tier-two" configJson={null} template={template} />);
    expect(screen.getByText('Palm Paradise — Tier 2')).toBeTruthy();
    expect(screen.queryByText('the hardcoded registry theme')).toBeNull();
  });

  it('takes its stylesheet with it', async () => {
    const { container } = render(
      <PreviewPage initialData={data} themeKey="tier-two" configJson={null} template={template} />,
    );
    expect(container.querySelector('style')?.innerHTML).toContain('#fff200');
  });

  it('says the content is the saved content', async () => {
    // A compiled HTML string cannot show an edit the owner has not saved. The
    // banner has to say so, because silence reads as the edit being lost.
    render(<PreviewPage initialData={data} themeKey="tier-two" configJson={null} template={template} />);
    expect(screen.getByText(/unsaved edits not shown/i)).toBeTruthy();
  });

  it('does not claim to be live', async () => {
    render(<PreviewPage initialData={data} themeKey="tier-two" configJson={null} template={template} />);
    expect(screen.queryByText('● live')).toBeNull();
  });

  it('still names the theme being previewed', async () => {
    render(<PreviewPage initialData={data} themeKey="tier-two" configJson={null} template={template} />);
    expect(screen.getByText('tier-two')).toBeTruthy();
  });
});

describe('the other two tiers are unchanged', () => {
  it('a config theme still draws through the config renderer', async () => {
    render(<PreviewPage initialData={data} themeKey="brutalist" configJson={{ key: 'brutalist' }} template={null} />);
    expect(screen.getByText('the config renderer')).toBeTruthy();
  });

  it('a hardcoded theme still draws through the registry', async () => {
    render(<PreviewPage initialData={data} themeKey="luxe" configJson={null} template={null} />);
    expect(screen.getByText('the hardcoded registry theme')).toBeTruthy();
  });

  it('neither carries the Tier 2 notice', async () => {
    render(<PreviewPage initialData={data} themeKey="luxe" configJson={null} template={null} />);
    expect(screen.queryByText(/unsaved edits not shown/i)).toBeNull();
  });

  it('works with the prop left off entirely', async () => {
    // `template` is optional, and /theme-preview/[key] builds a preview without
    // it. Requiring it would be a type error there, but a default of undefined
    // reaching the Tier 2 branch would be a blank page.
    render(<PreviewPage initialData={data} themeKey="luxe" configJson={null} />);
    expect(screen.getByText('the hardcoded registry theme')).toBeTruthy();
  });
});

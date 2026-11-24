import { describe, it, expect } from 'vitest';
import { escapeHtml, safeColor, renderTemplate, wrapEmail, SEQUENCE_TEMPLATES } from '../../src/services/email';

const EVIL = '<a href="https://phish.example">Verify payment</a>';

describe('email HTML escaping', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('only lets hex colors through', () => {
    expect(safeColor('#1a6b5e', '#000')).toBe('#1a6b5e');
    expect(safeColor('red;background:url(x)', '#000')).toBe('#000');
    expect(safeColor(undefined, '#000')).toBe('#000');
  });

  it('renderTemplate escapes values but keeps the trusted template', () => {
    const out = renderTemplate('<p>Hi <b>{{guestName}}</b></p>', { guestName: EVIL });
    expect(out).toContain('<p>Hi <b>');
    expect(out).not.toContain('<a href');
    expect(out).toContain('&lt;a href=&quot;https://phish.example&quot;&gt;');
  });

  it('wrapEmail escapes the tenant name and rejects non-hex colors', () => {
    const html = wrapEmail({ body: '<p>ok</p>', tenantName: EVIL, primaryColor: 'red;x:y' });
    expect(html).not.toContain('<a href="https://phish');
    expect(html).toContain('<p>ok</p>');
    expect(html).toContain('background:#1a6b5e;');
  });

  it('sequence templates escape guest and tenant names', () => {
    const html = SEQUENCE_TEMPLATES.WIN_BACK({
      guestName: EVIL, tenantName: 'Sea & Sun', primaryColor: '#123456', accentColor: '#abcdef',
      slug: 'sea-sun', apiUrl: 'https://resortpro.site',
    });
    expect(html).not.toContain('<a href="https://phish');
    expect(html).toContain('Sea &amp; Sun');
    expect(html).toContain('href="https://resortpro.site/sea-sun#booking"');
    expect(html).toContain('#12345615');
  });
});

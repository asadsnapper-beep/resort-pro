/**
 * The name on ImageUpload's clear button.
 *
 * It had none, so a screen reader announced "button" wherever this component
 * is used — and it is used well beyond the Website Builder.
 *
 * The naming is tested here rather than only through a page because the
 * interesting case is a caller that passes no `label`. `label` defaults to
 * "Upload image", so the obvious template reads "Remove Upload image"; the
 * Website Builder never hits that branch — its unlabelled uploader is the
 * gallery adder, which has no value and so renders no clear button — and a
 * mutation that dropped the fix survived the page-level test for that reason.
 *
 * (Website Builder QA 2026-10-28, WB-012.)
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('@/lib/api', () => ({ api: { post: vi.fn() } }));

import { ImageUpload } from '@/components/ui/ImageUpload';

const PHOTO = 'https://cdn.example.com/hero.jpg';

afterEach(cleanup);

describe('the clear button', () => {
  it('is named after the field when the caller named one', () => {
    render(<ImageUpload value={PHOTO} onChange={() => {}} label="Hero Background Image" />);
    expect(screen.getByRole('button', { name: /^Remove Hero Background Image$/i })).toBeTruthy();
  });

  it('reads "Remove image", not "Remove Upload image", with no label', () => {
    // This is the default-label branch, and the only place it is exercised.
    render(<ImageUpload value={PHOTO} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /^Remove image$/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Remove Upload image/i })).toBeNull();
  });

  it('strips the verb wherever a caller wrote one', () => {
    render(<ImageUpload value={PHOTO} onChange={() => {}} label="Upload room photo" />);
    expect(screen.getByRole('button', { name: /^Remove room photo$/i })).toBeTruthy();
  });

  it('clears the value when used', () => {
    // A name that does not do what it says is worse than no name.
    const onChange = vi.fn();
    render(<ImageUpload value={PHOTO} onChange={onChange} label="Hero Background Image" />);
    screen.getByRole('button', { name: /Remove Hero Background Image/i }).click();
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('is absent when there is nothing to clear', () => {
    render(<ImageUpload value={null} onChange={() => {}} label="Hero Background Image" />);
    expect(screen.queryByRole('button', { name: /Remove Hero Background Image/i })).toBeNull();
  });

  it('is absent while the field is disabled', () => {
    render(<ImageUpload value={PHOTO} onChange={() => {}} label="Hero Background Image" disabled />);
    expect(screen.queryByRole('button', { name: /Remove Hero Background Image/i })).toBeNull();
  });
});

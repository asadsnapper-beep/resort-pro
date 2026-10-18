/**
 * Working back from a stored URL to the file it names.
 *
 * Deleting a guest removed every row about them — GuestDocument cascades — and
 * left their passport and ID photographs sitting on disk. The records said the
 * data was gone; the scans were still there, which is the one kind of data that
 * most needs to actually go.
 *
 * A row holds only `imageUrl`, so deleting the file means deriving the storage
 * key from it. Both drivers build the key the same way and differ only in the
 * prefix, so the tenant segment is what locates it.
 *
 * The tenant check is the security half, not a formality. A path derived from a
 * stored string and handed to unlink is how one tenant deletes another's files,
 * or something outside the uploads directory. These tests treat that as the
 * feature rather than an edge case.
 */
import { describe, it, expect } from 'vitest';
import { storageKeyFromUrl } from '../../src/services/storage';

const TENANT = 'a1b2c3d4-tenant';

describe('a URL written by the local driver', () => {
  it('yields the key beneath /uploads/', () => {
    expect(storageKeyFromUrl(
      `https://api.resortpro.site/uploads/${TENANT}/guest-docs/9f8e7d.jpg`, TENANT,
    )).toBe(`${TENANT}/guest-docs/9f8e7d.jpg`);
  });

  it('still yields it for the old rows whose host is localhost', () => {
    // Staging and production both carry documents uploaded before APP_URL was
    // set, whose URLs point at http://localhost:4000. The host is irrelevant to
    // where the file actually sits.
    expect(storageKeyFromUrl(
      `http://localhost:4000/uploads/${TENANT}/guest-docs/9f8e7d.jpg`, TENANT,
    )).toBe(`${TENANT}/guest-docs/9f8e7d.jpg`);
  });
});

describe('a URL written by the S3 driver', () => {
  it('yields the same key, with no /uploads/ segment to strip', () => {
    // The previous code stripped a literal '/uploads/' prefix, so an S3 URL
    // kept its leading slash and the delete quietly matched nothing.
    expect(storageKeyFromUrl(
      `https://cdn.example.com/${TENANT}/guest-docs/9f8e7d.jpg`, TENANT,
    )).toBe(`${TENANT}/guest-docs/9f8e7d.jpg`);
  });

  it('handles a bucket path that repeats the tenant id further up', () => {
    expect(storageKeyFromUrl(
      `https://cdn.example.com/backups/${TENANT}/guest-docs/x.jpg`, TENANT,
    )).toBe(`${TENANT}/guest-docs/x.jpg`);
  });
});

describe('a URL that is not this tenant\'s to delete', () => {
  it('is refused when it names another tenant', () => {
    expect(storageKeyFromUrl(
      'https://api.resortpro.site/uploads/someone-else/guest-docs/x.jpg', TENANT,
    )).toBeNull();
  });

  it('is refused when it climbs out of the uploads directory', () => {
    // As an absolute URL this never reaches the `..` guard: the URL constructor
    // resolves the segments away, leaving /etc/passwd with no tenant in it, and
    // the tenant check refuses it first. Kept because it is the shape an
    // attacker would write, and both defences must hold.
    expect(storageKeyFromUrl(
      `https://api.resortpro.site/uploads/${TENANT}/../../etc/passwd`, TENANT,
    )).toBeNull();
  });

  it('is refused as a bare path, where nothing normalises the segments away', () => {
    // This is the case the `..` guard actually exists for. A bare path skips
    // `new URL`, so `..` survives into the key and would otherwise be handed
    // to unlink as-is.
    expect(storageKeyFromUrl(`/uploads/${TENANT}/../../../etc/passwd`, TENANT)).toBeNull();
  });

  it('is refused when it carries no tenant segment at all', () => {
    expect(storageKeyFromUrl('https://api.resortpro.site/uploads/x.jpg', TENANT)).toBeNull();
  });

  it('is refused when the tenant id appears only as a prefix of another', () => {
    // `${TENANT}-old/` must not satisfy a search for `/${TENANT}/`.
    expect(storageKeyFromUrl(
      `https://api.resortpro.site/uploads/${TENANT}-old/guest-docs/x.jpg`, TENANT,
    )).toBeNull();
  });
});

describe('a value that is not a URL', () => {
  it('accepts a bare path, which some rows hold', () => {
    expect(storageKeyFromUrl(`/uploads/${TENANT}/guest-docs/x.jpg`, TENANT))
      .toBe(`${TENANT}/guest-docs/x.jpg`);
  });

  it('returns null rather than throwing on nonsense', () => {
    expect(storageKeyFromUrl('', TENANT)).toBeNull();
    expect(storageKeyFromUrl('not a url at all', TENANT)).toBeNull();
  });
});

import { z } from 'zod';
import { isHttpUrl, MAX_MEDIA_URL_LENGTH } from '@resort-pro/types';

/**
 * A link to a picture or a video, validated where the request is parsed.
 *
 * Room `images` was `z.array(z.string())` — no length, no shape, no cap — and
 * the eight-photo limit, the four-video limit and the "that is not a URL"
 * refusal lived only in the Add Room modal. A caller with a token could store
 * four hundred photos on one room, or a megabyte of base64 in a column meant
 * to hold a link. (Room Management QA 2026-10-28, RM-012.)
 *
 * `videos` looked safe, because it already had `.url()`. It was not: Zod's
 * `.url()` is `new URL()`, and `new URL('javascript:alert(1))` parses
 * perfectly well, as do `data:` and `file:`. Any check that only asks "is
 * this a URL" admits every scheme there is. The scheme has to be named.
 *
 * Both of the ways the app produces these pass: the upload route returns an
 * absolute `http(s)` URL — the API's own origin plus `/uploads/…`, or the
 * object store's base — and the modal's "Use URL" button takes a pasted
 * `https://` link. Measured against the dev database before this was written:
 * every stored room image is an `https://` URL and the longest is 72
 * characters, so nothing already saved stops being editable.
 */

/**
 * `what` opens the message a caller sees, so write it as a subject:
 * "Each photo" becomes "Each photo must be a http:// or https:// link".
 */
export function mediaUrl(what: string) {
  return z
    .string()
    // Normalised rather than refused: a pasted link often arrives with a
    // trailing space, and storing two spellings of one URL helps nobody.
    .trim()
    .min(1, `${what} cannot be blank`)
    .max(MAX_MEDIA_URL_LENGTH, `${what} must be under ${MAX_MEDIA_URL_LENGTH} characters`)
    .refine(isHttpUrl, `${what} must be a http:// or https:// link`);
}

/*
  `isHttpUrl` and the length live in @resort-pro/types, next to
  ROOM_CAPABILITIES, so the form and this schema cannot come to different
  conclusions about the same string. Only the zod wrapper is here, because
  the form does not parse with zod.
*/

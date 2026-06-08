/* ── Unsplash fallback images ─────────────────────────────────────────────────
   img() — image URL থাকলে সেটা return করে, না থাকলে category-based Unsplash photo।
   সব photo ID curated — always beautiful resort/hotel quality।
────────────────────────────────────────────────────────────────────────────── */

const BASE = 'https://images.unsplash.com'

// Curated Unsplash photo IDs per category
const DEFAULTS: Record<string, string[]> = {
  hero: [
    'photo-1582719508461-905c673771fd', // tropical resort pool
    'photo-1571896349842-33c89424de2d', // luxury resort sunset
    'photo-1540541338287-41700207dee6', // resort aerial
    'photo-1520250497591-112f2f40a3f4', // pool villa
  ],
  room: [
    'photo-1631049307264-da0ec9d70304', // hotel room
    'photo-1590490360182-c33d57733427', // bright bedroom
    'photo-1566665797739-1674de7a421a', // suite
    'photo-1618773928121-c32242e63f39', // resort room
  ],
  food: [
    'photo-1414235077428-338989a2e8c0', // restaurant table
    'photo-1504674900247-0877df9cc836', // food spread
    'photo-1567620905732-2d1ec7ab7445', // breakfast
    'photo-1555396273-367ea4eb4db5', // restaurant interior
    'photo-1512621776951-a57141f2eefd', // salad bowl
    'photo-1482049016688-2d3e1b311543', // eggs breakfast
    'photo-1565299624946-b28f40a0ae38', // pizza
    'photo-1547592180-85f173990554', // pasta
    'photo-1540189549336-e6e99c3679fe', // steak
    'photo-1551024709-8f23befc5b7f', // cocktail drinks
    'photo-1563245372-f21724e3856d', // dessert cake
    'photo-1476224203421-9ac39bcb3df1', // burger
  ],
  gallery: [
    'photo-1507525428034-b723cf961d3e', // beach
    'photo-1455587734955-081b22074882', // resort pool
    'photo-1445019980597-93fa8acb246c', // resort view
    'photo-1476514525535-07fb3b4ae5f1', // ocean view
  ],
  about: [
    'photo-1445019980597-93fa8acb246c', // resort building
    'photo-1506929562872-bb421503ef21', // resort path
    'photo-1439130490301-25e322d88054', // tropical garden
  ],
  avatar: [
    'photo-1535713875002-d1d0cf377fde', // person
    'photo-1494790108377-be9c29b29330', // person
    'photo-1507003211169-0a1dd7228f2d', // person
  ],
  amenity: [
    'photo-1575429198097-0414ec08e8cd', // pool
    'photo-1544161515-4ab6ce6db874', // spa
    'photo-1534438327276-14e5300c3a48', // gym
  ],
}

// Deterministic pick — seed so the same content always picks the same image
function pick(list: string[], seed = 0): string {
  return list[seed % list.length]
}

function unsplash(id: string, w = 1200, h = 800): string {
  return `${BASE}/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`
}

/**
 * Returns `url` if non-empty, otherwise a relevant Unsplash fallback.
 * @param url   — the stored image URL (may be undefined/empty)
 * @param cat   — category key: 'hero' | 'room' | 'food' | 'gallery' | 'about' | 'avatar' | 'amenity'
 * @param seed  — integer to pick a consistent image from the pool (e.g. room index)
 * @param w,h   — desired dimensions
 */
export function img(
  url: string | null | undefined,
  cat: keyof typeof DEFAULTS = 'gallery',
  seed = 0,
  w = 1200,
  h = 800,
): string {
  if (url && url.trim()) return url
  const list = DEFAULTS[cat] ?? DEFAULTS.gallery
  return unsplash(pick(list, seed), w, h)
}

/** Convenience wrappers */
export const heroImg    = (url?: string | null) => img(url, 'hero',    0, 1920, 1080)
export const roomImg    = (url?: string | null, i = 0) => img(url, 'room',    i, 800, 600)
export const foodImg    = (url?: string | null, i = 0) => img(url, 'food',    i, 600, 400)
export const galleryImg = (url?: string | null, i = 0) => img(url, 'gallery', i, 800, 600)
export const aboutImg   = (url?: string | null) => img(url, 'about',   0, 1000, 700)
export const avatarImg  = (url?: string | null, i = 0) => img(url, 'avatar',  i, 200, 200)

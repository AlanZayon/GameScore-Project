/**
 * Slug helpers. Slugs are the public identity of a game (`/games/elden-ring`),
 * so they must be stable, ASCII-safe and readable.
 */

const NON_ALPHANUMERIC = /[^a-z0-9]+/g;
const EDGE_DASHES = /^-+|-+$/g;
const DIACRITICS = /[\u0300-\u036f]/g;

export const SLUG_MAX_LENGTH = 80;

export function slugify(input: string): string {
  const normalised = input
    .normalize('NFKD')
    .replace(DIACRITICS, '')
    // Keep intent of common separators before stripping punctuation.
    .replace(/[&]/g, ' and ')
    .replace(/[’']/g, '')
    .toLowerCase()
    .replace(NON_ALPHANUMERIC, '-')
    .replace(EDGE_DASHES, '');

  return normalised.slice(0, SLUG_MAX_LENGTH).replace(EDGE_DASHES, '');
}

/**
 * Builds a slug that does not collide with existing ones by appending a
 * numeric suffix, e.g. `hades` then `hades-2`.
 */
export function uniqueSlug(input: string, isTaken: (candidate: string) => boolean): string {
  const base = slugify(input) || 'game';
  if (!isTaken(base)) {
    return base;
  }

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base.slice(0, SLUG_MAX_LENGTH - String(suffix).length - 1)}-${suffix}`;
    if (!isTaken(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Unable to derive a unique slug for "${input}"`);
}

export function isValidSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= SLUG_MAX_LENGTH;
}

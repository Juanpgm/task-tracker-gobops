/**
 * Utilities for handling media URLs in the Avanzadas module.
 *
 * `fotos_urls` (on requerimientos) and `informe_url` (on the avanzada) mix
 * two URL shapes with NO discriminator field:
 *   - Migrated data (326 requerimientos): Google Drive share links, e.g.
 *     `https://drive.google.com/file/d/{id}/view?usp=drivesdk`. That /view
 *     URL serves an HTML viewer page, not image bytes — using it directly
 *     as an <img src> renders broken.
 *   - New data (created via the app): plain S3 URLs, already renderable.
 *
 * Every consumer of `fotos_urls` must run each URL through
 * toDisplayableImageUrl() before using it as an <img src>, and should pair
 * it with an on:error fallback (the migrated files may not be publicly
 * shared, so even the Drive thumbnail endpoint can 403).
 */

/** Accepted sizes for the Drive thumbnail endpoint (`?sz={size}`). */
export type DriveThumbnailSize = 'w200' | 'w400' | 'w600' | 'w1200';

/** Default size for grid/thumbnail rendering — keep payloads small on mobile data. */
const DEFAULT_THUMBNAIL_SIZE: DriveThumbnailSize = 'w400';

const DRIVE_HOSTS = new Set(['drive.google.com', 'docs.google.com']);

/**
 * Extracts the Drive file ID from any of the common share-link shapes:
 *  - https://drive.google.com/file/d/{id}/view?usp=drivesdk
 *  - https://drive.google.com/open?id={id}
 *  - https://drive.google.com/uc?id={id}&export=download
 *  - any Drive URL carrying an `?id={id}` query param
 * Returns null when the URL is not a recognizable Drive file link (wrong
 * host, a folder link, missing id, empty/null input, or unparseable string).
 */
export function extractDriveFileId(url: string | null | undefined): string | null {
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (!DRIVE_HOSTS.has(parsed.hostname)) return null;

  const pathMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/);
  if (pathMatch) return pathMatch[1];

  const idParam = parsed.searchParams.get('id');
  if (idParam) return idParam;

  return null;
}

/** True when the URL is a Google Drive file share link (any recognized shape). */
export function isDriveUrl(url: string | null | undefined): boolean {
  return extractDriveFileId(url) !== null;
}

/**
 * Returns a URL that actually serves image bytes for <img src>.
 * Drive links are rewritten to the `thumbnail` endpoint (serves real image
 * bytes for link-shared files); everything else (S3, http, malformed
 * strings) is returned unchanged. `size` only affects Drive URLs — use the
 * smaller default for grids/lists and a larger size for the lightbox.
 */
export function toDisplayableImageUrl(
  url: string | null | undefined,
  size: DriveThumbnailSize = DEFAULT_THUMBNAIL_SIZE
): string {
  if (!url) return '';
  const fileId = extractDriveFileId(url);
  if (!fileId) return url;
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=${size}`;
}

/**
 * Returns the human-openable original link for an "Abrir original ↗" /
 * "Abrir en Drive ↗" affordance. Drive links are normalized to the
 * canonical /view form; everything else is returned unchanged.
 */
export function toOriginalUrl(url: string | null | undefined): string {
  if (!url) return '';
  const fileId = extractDriveFileId(url);
  if (!fileId) return url;
  return `https://drive.google.com/file/d/${fileId}/view`;
}

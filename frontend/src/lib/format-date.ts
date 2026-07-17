/**
 * Shared date formatter for the Avanzadas components (ListaAvanzadas,
 * DetalleAvanzada). Not a repo-wide refactor — the 6+ other components with
 * their own inline formatDate() are intentionally left untouched.
 */

export interface FormatDateOptions {
  weekday?: 'long' | 'short' | 'narrow';
  includeTime?: boolean;
}

/**
 * Formats a date string in es-CO. Date-only strings (YYYY-MM-DD) are
 * anchored to local noon before parsing so they don't shift a day back in
 * negative-UTC-offset environments. Returns "Sin fecha" for empty input and
 * the original string unmodified if it cannot be parsed.
 */
export function formatDate(
  dateStr: string | null | undefined,
  options: FormatDateOptions = {}
): string {
  if (!dateStr) return 'Sin fecha';

  const { weekday = 'short', includeTime = false } = options;
  const hasTime = /T\d{2}:\d{2}/.test(dateStr);
  const parseable = hasTime ? dateStr : `${dateStr}T12:00:00`;
  const date = new Date(parseable);

  if (isNaN(date.getTime())) return dateStr;

  const formatOptions: Intl.DateTimeFormatOptions = {
    weekday,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  if (includeTime) {
    formatOptions.hour = '2-digit';
    formatOptions.minute = '2-digit';
  }

  return date.toLocaleDateString('es-CO', formatOptions);
}

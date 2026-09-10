import { environment } from '../../../environments/environment';

/**
 * Resolve an image URL coming from the API so it always points at the
 * same origin the frontend uses for API calls. The backend stores full
 * URLs built from APP_URL, which may not match the served API origin.
 */
export function resolveImageUrl(url: string | null | undefined, fallback: string): string {
  if (!url) return fallback;
  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('assets')) return url;

  const apiOrigin = environment.apiUrl.replace(/\/api\/v1\/?$/, '');

  if (/^https?:\/\//.test(url)) {
    return url.replace(/^https?:\/\/[^/]+/, apiOrigin);
  }

  const path = url.startsWith('/') ? url : `/storage/${url}`;
  return apiOrigin + path;
}

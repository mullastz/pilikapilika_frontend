import { environment } from '../../../environments/environment';

/**
 * Resolve legacy API image paths against the configured API origin while
 * preserving external URLs and local preview URLs.
 */
export function resolveImageUrl(url: string | null | undefined, fallback: string): string {
  if (!url) return fallback;
  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('assets')) return url;

  const apiOrigin = environment.apiUrl.replace(/\/api\/v1\/?$/, '');

  if (/^https?:\/\//.test(url)) {
    const path = url.replace(/^https?:\/\/[^/]+/, '').split(/[?#]/, 1)[0];
    return path.includes('/storage/') ? url.replace(/^https?:\/\/[^/]+/, apiOrigin) : url;
  }

  const path = url.startsWith('/') ? url : `/storage/${url}`;
  return apiOrigin + path;
}

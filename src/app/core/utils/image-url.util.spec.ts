import { environment } from '../../../environments/environment';
import { resolveImageUrl } from './image-url.util';

describe('resolveImageUrl', () => {
  it('preserves absolute R2 URLs', () => {
    const url = 'https://pub-example.r2.dev/profile-photos/photo.jpg';

    expect(resolveImageUrl(url, 'assets/fallback.jpg')).toBe(url);
  });

  it('rewrites legacy absolute Laravel storage URLs to the configured API origin', () => {
    const apiOrigin = environment.apiUrl.replace(/\/api\/v1\/?$/, '');

    expect(resolveImageUrl('http://localhost:8000/storage/profile-photos/photo.jpg', '')).toBe(
      `${apiOrigin}/storage/profile-photos/photo.jpg`,
    );
  });
});

import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { Blog } from './blog';
import { BlogService, parseBlogPosts } from '../../core/services/blog.service';

const post = { slug: 'parcel-tips', title: 'Parcel tips', excerpt: 'Prepare your parcel.', body: '<script>unsafe()</script>\nPack carefully.', published: true };

describe('Blog', () => {
  async function render(slug: string | null) {
    await TestBed.configureTestingModule({
      imports: [Blog], providers: [provideRouter([]), provideHttpClient(),
        { provide: BlogService, useValue: { getPosts: () => of([post]) } },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap(slug ? { slug } : {})) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Blog);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('lists the existing guides and new published articles', async () => {
    const page = await render(null);
    expect(page.querySelector('a[href="/china-to-tanzania-cargo"]')).not.toBeNull();
    expect(page.querySelector('a[href="/how-it-works"]')).not.toBeNull();
    expect(page.querySelector('a[href="/blog/parcel-tips"]')).not.toBeNull();
  });
  it('renders article text without executing stored markup', async () => {
    const page = await render('parcel-tips');
    expect(page.querySelector('h1')?.textContent).toBe('Parcel tips');
    expect(page.querySelector('article script')).toBeNull();
    expect(page.textContent).toContain('<script>unsafe()</script>');
  });
  it('shows an unavailable message for an unknown article', async () => {
    const page = await render('missing');
    expect(page.querySelector('h1')?.textContent).toBe('Article not found');
  });
  it('handles absent, malformed, or unsafe blog data', () => {
    expect(parseBlogPosts('invalid')).toEqual([]);
    expect(parseBlogPosts('{}')).toEqual([]);
    expect(parseBlogPosts(JSON.stringify([{ ...post, slug: '../bad' }]))).toEqual([]);
  });
});
